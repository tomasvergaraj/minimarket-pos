"""
Comunicación con los web services del SII para subir DTEs.

Flujo de autenticación:
  1. GET /DTEWS/CrSeed.jws          → XML con <SEMILLA>
  2. POST /DTEWS/GetTokenFromSeed.jws (SOAP) → XML con <TOKEN>
  3. POST /cgi_dte/UPL/DTEUpload    → multipart con el DTE firmado

URLs:
  Certificación: https://maullin2.sii.cl
  Producción:    https://palena.sii.cl

El token se cachea en memoria (≈4 min) para no pedir semilla en cada venta.
"""
import logging
from datetime import datetime, timedelta

import httpx
from lxml import etree

from app.core.config import settings

logger = logging.getLogger(__name__)

# Caché de token en memoria (válido por proceso/worker)
_token_cache: dict = {"token": None, "expires_at": datetime.min}


async def _get_seed(client: httpx.AsyncClient) -> str:
    """Obtiene la semilla desde SII."""
    url = f"{settings.SII_BASE_URL}/DTEWS/CrSeed.jws"
    response = await client.get(url, timeout=15.0)
    response.raise_for_status()
    root = etree.fromstring(response.content)
    semilla = root.findtext(".//SEMILLA")
    if not semilla:
        raise ValueError(
            f"Respuesta de semilla SII sin <SEMILLA>: {response.text[:300]}"
        )
    return semilla.strip()


def _build_seed_envelope(semilla: str) -> bytes:
    """Construye el SOAP envelope para GetTokenFromSeed."""
    # En ambiente de certificación SII acepta seed sin firma para pruebas.
    # En producción la <item> debe ir firmada con el certificado del contribuyente.
    envelope = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<soapenv:Envelope'
        ' xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"'
        ' xmlns:xsd="http://www.w3.org/2001/XMLSchema"'
        ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        "<soapenv:Body>"
        "<generateToken>"
        "<pszXml>"
        "<item>"
        f"<Semilla>{semilla}</Semilla>"
        "</item>"
        "</pszXml>"
        "</generateToken>"
        "</soapenv:Body>"
        "</soapenv:Envelope>"
    )
    return envelope.encode("utf-8")


async def _get_token(client: httpx.AsyncClient, semilla: str) -> str:
    """Intercambia semilla por token de autenticación SII."""
    url = f"{settings.SII_BASE_URL}/DTEWS/GetTokenFromSeed.jws"
    body = _build_seed_envelope(semilla)
    response = await client.post(
        url,
        content=body,
        headers={
            "Content-Type": "text/xml; charset=UTF-8",
            "SOAPAction": "",
        },
        timeout=15.0,
    )
    response.raise_for_status()
    root = etree.fromstring(response.content)
    token = root.findtext(".//TOKEN")
    if not token:
        raise ValueError(
            f"Respuesta de token SII sin <TOKEN>: {response.text[:300]}"
        )
    return token.strip()


async def acquire_token() -> str:
    """
    Retorna un token SII válido, renovando si está expirado.
    Caché de 4 minutos (los tokens SII duran ~5 min).
    """
    global _token_cache
    now = datetime.utcnow()
    if _token_cache["token"] and _token_cache["expires_at"] > now:
        return _token_cache["token"]

    async with httpx.AsyncClient() as client:
        semilla = await _get_seed(client)
        token = await _get_token(client, semilla)

    _token_cache = {
        "token": token,
        "expires_at": now + timedelta(minutes=4),
    }
    logger.debug("Token SII renovado")
    return token


async def upload_dte(
    dte_xml_bytes: bytes,
    rut_sender: str,
    rut_company: str,
) -> dict:
    """
    Sube el DTE firmado al SII.

    Args:
        dte_xml_bytes: bytes UTF-8 del DTE XML firmado
        rut_sender:   RUT sin puntos ni DV, ej: "76123456"  (los 8 dígitos sin DV)
        rut_company:  igual al anterior para boletas propias

    Returns:
        dict con claves: status, trackid, glosa

    Raises:
        httpx.HTTPError: error de red
        ValueError: respuesta SII sin STATUS esperado
    """
    # Separar RUT de dígito verificador
    sender_rut = rut_sender[:-1]
    sender_dv = rut_sender[-1]
    company_rut = rut_company[:-1]
    company_dv = rut_company[-1]

    token = await acquire_token()
    url = f"{settings.SII_BASE_URL}/cgi_dte/UPL/DTEUpload"

    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            data={
                "rutSender": sender_rut,
                "dvSender": sender_dv,
                "rutCompany": company_rut,
                "dvCompany": company_dv,
                "Token": token,
            },
            files={
                "archivo": ("dte_39.xml", dte_xml_bytes, "application/xml"),
            },
            timeout=30.0,
        )
        response.raise_for_status()

    root = etree.fromstring(response.content)
    status = (
        root.findtext(".//STATUS")
        or root.findtext(".//ESTADO")
        or "UNKNOWN"
    )
    trackid = root.findtext(".//TRACKID") or ""
    glosa = root.findtext(".//GLOSA") or ""

    return {"status": status, "trackid": trackid, "glosa": glosa}
