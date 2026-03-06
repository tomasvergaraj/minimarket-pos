"""
Endpoints SII Boleta Electrónica.

GET  /api/tax/sii/status              → estado de configuración + folios
POST /api/tax/sii/caf/load            → carga CAF XML en DB [admin]
GET  /api/tax/sii/caf/status          → folios disponibles [admin]
POST /api/tax/sii/boleta/{id}/reemit  → re-emitir DTE fallido [admin]
"""
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.config import settings
from app.db.session import get_db
from app.models.sale import Sale
from app.models.sii_folio import SIIFolioCounter
from app.tax.sii.caf import load_caf_from_file
from app.tax.sii.service import background_upload, emit_boleta, is_configured

router = APIRouter(prefix="/tax/sii", tags=["sii"])


@router.get("/status")
def sii_status(db: Session = Depends(get_db)):
    """Estado de configuración SII y folios disponibles."""
    configured = is_configured()
    counter = (
        db.query(SIIFolioCounter)
        .filter(SIIFolioCounter.tipo_dte == 39)
        .first()
    )

    missing = [
        k
        for k, v in {
            "SII_CAF_XML_PATH": settings.SII_CAF_XML_PATH,
            "SII_CERT_PFX_PATH": settings.SII_CERT_PFX_PATH,
            "STORE_RUT": settings.STORE_RUT,
            "STORE_NAME": settings.STORE_NAME,
            "STORE_GIRO": settings.STORE_GIRO,
            "STORE_ACTECO": str(settings.STORE_ACTECO or ""),
        }.items()
        if not v
    ]

    return {
        "enabled": settings.SII_ENABLED,
        "configured": configured,
        "ambiente": settings.SII_AMBIENTE,
        "sii_base_url": settings.SII_BASE_URL,
        "folio_counter": (
            {
                "tipo_dte": counter.tipo_dte,
                "desde": counter.caf_desde,
                "hasta": counter.caf_hasta,
                "current": counter.current_folio,
                "remaining": counter.caf_hasta - counter.current_folio,
            }
            if counter
            else None
        ),
        "missing_config": missing,
    }


class CAFLoadRequest(BaseModel):
    caf_xml_path: str  # ruta absoluta en el servidor


@router.post("/caf/load", dependencies=[Depends(require_admin)])
def load_caf(data: CAFLoadRequest, db: Session = Depends(get_db)):
    """
    Parsea un archivo CAF XML e inserta/actualiza el contador de folios.
    Es seguro llamarlo de nuevo al cargar un nuevo CAF con más folios.
    """
    try:
        caf = load_caf_from_file(data.caf_xml_path)
    except FileNotFoundError:
        raise HTTPException(404, f"Archivo CAF no encontrado: {data.caf_xml_path}")
    except Exception as exc:
        raise HTTPException(400, f"Error al parsear CAF: {exc}")

    row = (
        db.query(SIIFolioCounter)
        .filter(SIIFolioCounter.tipo_dte == caf.tipo_dte)
        .first()
    )
    if row is None:
        row = SIIFolioCounter(
            id=str(uuid.uuid4()),
            tipo_dte=caf.tipo_dte,
            caf_desde=caf.desde,
            caf_hasta=caf.hasta,
            current_folio=caf.desde - 1,  # next_folio() retornará caf.desde
            caf_xml_path=data.caf_xml_path,
        )
        db.add(row)
    else:
        row.caf_desde = caf.desde
        row.caf_hasta = caf.hasta
        row.current_folio = caf.desde - 1
        row.caf_xml_path = data.caf_xml_path

    db.commit()
    return {
        "success": True,
        "tipo_dte": caf.tipo_dte,
        "desde": caf.desde,
        "hasta": caf.hasta,
        "folios_disponibles": caf.hasta - caf.desde + 1,
    }


@router.get("/caf/status", dependencies=[Depends(require_admin)])
def caf_status(db: Session = Depends(get_db)):
    """Folios disponibles en el CAF activo."""
    counter = (
        db.query(SIIFolioCounter)
        .filter(SIIFolioCounter.tipo_dte == 39)
        .first()
    )
    if not counter:
        raise HTTPException(404, "No hay CAF cargado para Tipo 39")
    return {
        "tipo_dte": counter.tipo_dte,
        "caf_path": counter.caf_xml_path,
        "desde": counter.caf_desde,
        "hasta": counter.caf_hasta,
        "current_folio": counter.current_folio,
        "remaining": counter.caf_hasta - counter.current_folio,
        "updated_at": counter.updated_at,
    }


@router.post("/boleta/{sale_id}/reemit", dependencies=[Depends(require_admin)])
def reemit_boleta(
    sale_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Re-emite el DTE para una venta que falló (SIGN_ERROR, UPLOAD_ERROR, NO_CAF).
    No re-emite si ya está en estado SENT.
    """
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(404, "Venta no encontrada")
    if sale.sii_status == "SENT":
        raise HTTPException(409, "El DTE ya fue enviado al SII para esta venta")

    dte_bytes = emit_boleta(db, sale)
    if dte_bytes is None:
        raise HTTPException(
            503,
            "SII no configurado o emisión fallida — revise los logs del servidor",
        )

    background_tasks.add_task(background_upload, sale.id, dte_bytes)
    return {
        "success": True,
        "sale_id": sale.id,
        "sii_folio": sale.sii_folio,
        "sii_status": "PENDING",
    }
