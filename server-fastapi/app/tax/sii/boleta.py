"""
Módulo placeholder para Boleta Electrónica SII Chile.

Cuando se implemente:
- DTE Tipo 39 (Boleta Electrónica)
- Firmado XML con certificado digital
- Envío al SII via web service
- Timbre electrónico (TED)

Requiere:
- Certificado digital .pfx del contribuyente
- CAF (Código de Autorización de Folios) del SII
- RUT empresa, razón social, giro
"""

from fastapi import APIRouter

router = APIRouter(prefix="/tax/sii", tags=["sii"])


@router.get("/status")
def sii_status():
    return {
        "enabled": False,
        "message": "SII integration not yet configured",
        "required": [
            "certificate_pfx",
            "caf_xml",
            "company_rut",
            "company_name",
            "company_activity",
        ],
    }


@router.post("/boleta")
def emit_boleta():
    return {
        "error": "SII integration not configured",
        "hint": "Configure certificate and CAF first via /tax/sii/status",
    }
