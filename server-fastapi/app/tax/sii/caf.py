"""
CAF (Código de Autorización de Folios) — parser y gestor de folios.

Estructura del XML CAF emitido por SII:
<AUTORIZACION>
  <CAF version="1.0">
    <DA>
      <RE>76.xxx.xxx-x</RE>       ← RUT emisor
      <RS>Razón Social</RS>
      <TD>39</TD>                  ← Tipo DTE
      <RNG><D>1</D><H>200</H></RNG>
      <FA>2024-01-01</FA>          ← Fecha autorización
      <RSAPK><M>...</M><E>...</E></RSAPK>
      <IDK>100</IDK>
    </DA>
    <FRMA algoritmo="SHA1withRSA">...</FRMA>
  </CAF>
  <RSASK>-----BEGIN RSA PRIVATE KEY-----\n...\n</RSASK>
</AUTORIZACION>
"""
import uuid
from dataclasses import dataclass

from lxml import etree
from cryptography.hazmat.primitives.serialization import load_pem_private_key
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey
from sqlalchemy.orm import Session

from app.models.sii_folio import SIIFolioCounter


class FolioExhaustedError(Exception):
    """El CAF actual está agotado. Subir un nuevo CAF al SII y cargar aquí."""


class CAFNotLoadedError(Exception):
    """No existe fila en sii_folio_counters para el tipo_dte solicitado."""


@dataclass
class CAFData:
    tipo_dte: int
    rut_emisor: str
    razon_social: str
    desde: int
    hasta: int
    fecha_autorizacion: str   # "YYYY-MM-DD"
    idk: int
    caf_xml_bytes: bytes      # bytes del elemento <CAF> para incrustar en el TED
    private_key: RSAPrivateKey


def load_caf_from_file(path: str) -> CAFData:
    """
    Parsea un archivo CAF XML descargado desde el portal SII.

    Raises:
        FileNotFoundError: si la ruta no existe
        ValueError: estructura XML inesperada o tipo_dte inválido
    """
    tree = etree.parse(path)
    root = tree.getroot()  # <AUTORIZACION>

    da = root.find(".//DA")
    if da is None:
        raise ValueError("El CAF XML no contiene el elemento <DA>")

    caf_elem = root.find(".//CAF")

    tipo = int(da.findtext("TD"))
    desde = int(da.findtext("RNG/D"))
    hasta = int(da.findtext("RNG/H"))
    fecha = da.findtext("FA")
    idk = int(da.findtext("IDK"))
    rut = da.findtext("RE")
    rs = da.findtext("RS")

    # Bytes del elemento <CAF> completo para incrustar en el TED
    caf_bytes = etree.tostring(caf_elem, encoding="unicode").encode("utf-8")

    # Llave privada RSA desde <RSASK>
    pem_text = (root.findtext("RSASK") or "").strip()
    if not pem_text:
        raise ValueError("El CAF XML no contiene <RSASK>")
    if not pem_text.startswith("-----"):
        pem_text = (
            "-----BEGIN RSA PRIVATE KEY-----\n"
            + pem_text
            + "\n-----END RSA PRIVATE KEY-----"
        )
    private_key = load_pem_private_key(pem_text.encode(), password=None)

    return CAFData(
        tipo_dte=tipo,
        rut_emisor=rut,
        razon_social=rs,
        desde=desde,
        hasta=hasta,
        fecha_autorizacion=fecha,
        idk=idk,
        caf_xml_bytes=caf_bytes,
        private_key=private_key,
    )


def next_folio(db: Session, tipo_dte: int = 39) -> int:
    """
    Reserva atómicamente el siguiente folio disponible.

    Usa SELECT FOR UPDATE para evitar que dos cajas concurrentes
    reciban el mismo folio.  Llama db.flush() dentro de la transacción
    activa; el commit lo hace el llamador.

    Returns:
        Número de folio a usar.

    Raises:
        CAFNotLoadedError: no existe fila para este tipo_dte
        FolioExhaustedError: current_folio >= caf_hasta
    """
    row: SIIFolioCounter | None = (
        db.query(SIIFolioCounter)
        .filter(SIIFolioCounter.tipo_dte == tipo_dte)
        .with_for_update()
        .first()
    )
    if row is None:
        raise CAFNotLoadedError(
            f"No hay CAF cargado para tipo_dte={tipo_dte}. "
            "Cargue el CAF via POST /api/tax/sii/caf/load"
        )
    if row.current_folio >= row.caf_hasta:
        raise FolioExhaustedError(
            f"CAF agotado para tipo_dte={tipo_dte} (hasta={row.caf_hasta}). "
            "Solicite nuevos folios en el portal SII y cargue el nuevo CAF."
        )
    row.current_folio += 1
    db.flush()
    return row.current_folio
