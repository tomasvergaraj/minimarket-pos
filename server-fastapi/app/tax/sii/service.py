"""
Servicio orquestador de Boleta Electrónica DTE.

Llamado por sale_service.create_sale() luego del commit de la venta.

Flujo síncrono (dentro del request):
  1. _is_configured() → retorna None si SII no está listo (venta sigue normal)
  2. Carga CAF desde archivo (cacheado en memoria)
  3. next_folio() — SELECT FOR UPDATE, flush sin commit
  4. build_dte_xml()
  5. sign_ted()  — firma <DD> con llave CAF
  6. sign_dte()  — XML-DSig con certificado .pfx
  7. Persiste sii_folio + sii_status="PENDING" en Sale → commit
  8. Retorna xml_bytes para que el route lo pase a BackgroundTask

Flujo asíncrono (background_upload, fuera del request):
  - Obtiene token SII (semilla → token)
  - Sube el DTE
  - Actualiza sii_status → "SENT" | "UPLOAD_ERROR"

Política de errores:
  La venta NUNCA falla por SII. Cada excepción setea un sii_status descriptivo
  y loguea. El admin puede re-emitir via POST /api/tax/sii/boleta/{id}/reemit.

  NO_CAF       → CAF no cargado en DB
  NO_FOLIO     → folios agotados
  SIGN_ERROR   → fallo al firmar (cert corrupto, llave inválida, etc.)
  UPLOAD_ERROR → fallo al subir al SII (red, timeout, rechazo)
"""
import logging
from lxml import etree
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.sale import Sale
from app.tax.sii.caf import load_caf_from_file, next_folio, CAFData
from app.tax.sii.caf import FolioExhaustedError, CAFNotLoadedError
from app.tax.sii.xml_builder import build_dte_xml
from app.tax.sii.signer import sign_ted, sign_dte
from app.tax.sii.uploader import upload_dte

logger = logging.getLogger(__name__)

# Caché por proceso: {path: CAFData}
_caf_cache: dict[str, CAFData] = {}


def _load_caf() -> CAFData:
    path = settings.SII_CAF_XML_PATH
    if path not in _caf_cache:
        _caf_cache[path] = load_caf_from_file(path)
    return _caf_cache[path]


def _rut_digits(rut_con_dv: str) -> str:
    """'76.123.456-7' → '761234567' (sin puntos ni guión)"""
    return rut_con_dv.replace(".", "").replace("-", "")


def is_configured() -> bool:
    """True sólo cuando todos los campos SII requeridos están presentes."""
    return bool(
        settings.SII_ENABLED
        and settings.SII_CAF_XML_PATH
        and settings.SII_CERT_PFX_PATH
        and settings.STORE_RUT
        and settings.STORE_NAME
        and settings.STORE_GIRO
        and settings.STORE_ACTECO
    )


def emit_boleta(db: Session, sale: Sale) -> bytes | None:
    """
    Fase síncrona: asigna folio, construye y firma el DTE.

    Retorna los bytes XML firmados (para subir en background),
    o None si SII no está configurado o la emisión falla.

    next_folio() hace db.flush() pero NO commit.
    Esta función hace su propio commit al final para persistir
    el folio y el sii_status en la venta.
    """
    if not is_configured():
        return None

    # Cargar CAF
    try:
        caf = _load_caf()
    except Exception as exc:
        logger.critical("No se pudo cargar el CAF: %s", exc)
        sale.sii_status = "NO_CAF"
        db.commit()
        return None

    # Obtener folio
    try:
        folio = next_folio(db, tipo_dte=39)
    except CAFNotLoadedError as exc:
        logger.critical("CAF no registrado en DB: %s", exc)
        sale.sii_status = "NO_CAF"
        db.commit()
        return None
    except FolioExhaustedError as exc:
        logger.critical("Folios agotados: %s", exc)
        sale.sii_status = "NO_FOLIO"
        db.commit()
        return None

    # Construir y firmar DTE
    try:
        dte_root = build_dte_xml(
            sale=sale,
            folio=folio,
            caf_xml_bytes=caf.caf_xml_bytes,
            emisor_rut=settings.STORE_RUT,
            emisor_nombre=settings.STORE_NAME,
            emisor_giro=settings.STORE_GIRO,
            emisor_acteco=settings.STORE_ACTECO,
            emisor_dir=settings.STORE_ADDRESS,
            emisor_comuna=settings.STORE_COMUNA,
            emisor_ciudad=settings.STORE_CIUDAD,
        )
        sign_ted(dte_root, caf.private_key)
        # Capturar TED firmado antes de agregar la firma del documento
        doc_elem = dte_root.find("Documento")
        ted_elem = doc_elem.find("TED")
        ted_xml_str = etree.tostring(ted_elem, encoding="unicode")
        sign_dte(dte_root, settings.SII_CERT_PFX_PATH, settings.SII_CERT_PFX_PASSWORD)
    except Exception as exc:
        logger.error(
            "Error al firmar DTE para venta %s folio %d: %s",
            sale.id, folio, exc, exc_info=True,
        )
        sale.sii_folio = folio     # el folio fue consumido; se registra igual
        sale.sii_tipo_dte = 39
        sale.sii_status = "SIGN_ERROR"
        db.commit()
        return None

    # Persistir folio + estado PENDING + TED XML
    sale.sii_folio = folio
    sale.sii_tipo_dte = 39
    sale.sii_rut_receptor = "66.666.666-6"
    sale.sii_status = "PENDING"
    sale.sii_ted_xml = ted_xml_str
    db.commit()

    xml_bytes = etree.tostring(dte_root, encoding="UTF-8", xml_declaration=True)
    logger.info("DTE generado para venta %s, folio %d", sale.id, folio)
    return xml_bytes


async def background_upload(sale_id: str, xml_bytes: bytes) -> None:
    """
    Tarea de fondo: sube el DTE al SII y actualiza sii_status.

    Corre fuera del ciclo de vida del request. Abre su propia sesión DB.
    """
    from app.db.session import SessionLocal  # evitar import circular al cargar módulo

    db = SessionLocal()
    try:
        rut_digits = _rut_digits(settings.STORE_RUT)
        result = await upload_dte(
            dte_xml_bytes=xml_bytes,
            rut_sender=rut_digits,
            rut_company=rut_digits,
        )
        status_code = result.get("status", "UNKNOWN")
        # SII retorna "0" como éxito en muchos endpoints
        sii_status = "SENT" if status_code in ("0", "OK") else "UPLOAD_ERROR"

        sale = db.query(Sale).filter(Sale.id == sale_id).first()
        if sale:
            sale.sii_status = sii_status
            db.commit()

        logger.info(
            "DTE upload venta %s: status=%s trackid=%s glosa=%s",
            sale_id, status_code, result.get("trackid"), result.get("glosa"),
        )
    except Exception as exc:
        logger.error("Error en background_upload venta %s: %s", sale_id, exc, exc_info=True)
        try:
            sale = db.query(Sale).filter(Sale.id == sale_id).first()
            if sale:
                sale.sii_status = "UPLOAD_ERROR"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()
