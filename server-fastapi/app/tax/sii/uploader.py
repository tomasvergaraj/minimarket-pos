"""
Comunicación con los web services del SII para subir DTEs.

Flujo de autenticación:
  1. POST /DTEWS/CrSeed.jws                  → SOAP con <SEMILLA>
  2. POST /DTEWS/GetTokenFromSeed.jws        → SOAP con <TOKEN> (semilla firmada)
  3. POST /cgi_dte/UPL/DTEUpload             → multipart con el DTE firmado

URLs:
  Certificación: https://maullin.sii.cl
  Producción:    https://palena.sii.cl

El token se cachea en memoria (≈4 min) para no pedir semilla en cada venta.
"""
import logging
import html
import base64
import hashlib
from datetime import datetime, timedelta

import httpx
from lxml import etree
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding as asym_padding
from cryptography.hazmat.primitives.serialization.pkcs12 import load_key_and_certificates

from app.core.config import settings

logger = logging.getLogger(__name__)

# Caché de token en memoria (válido por proceso/worker)
_token_cache: dict = {"token": None, "expires_at": datetime.min}


_LENIENT = etree.XMLParser(recover=True, resolve_entities=False)
XMLDSIG = "http://www.w3.org/2000/09/xmldsig#"
XMLDSIG_PREFIX = "ds"
XML_C14N_STD = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"


def _parse_sii_xml(content: bytes) -> etree._Element:
    """Parsea respuestas SII que a veces tienen contenido extra tras el root."""
    return etree.fromstring(content.strip(), _LENIENT)


def _find_text_by_localname(root: etree._Element, *tag_names: str) -> str | None:
    """Busca texto de un tag ignorando namespace y variaciones de mayusculas."""
    wanted = {name.lower() for name in tag_names}
    for elem in root.iter():
        if not isinstance(elem.tag, str):
            continue
        local_name = etree.QName(elem).localname.lower()
        if local_name in wanted and elem.text:
            text = elem.text.strip()
            if text:
                return text
    return None


def _parse_embedded_xml(text: str) -> etree._Element | None:
    """
    Parsea XML embebido dentro de respuestas SOAP del SII.
    getSeed/getToken suelen devolver el payload en texto escapado (&lt;...&gt;).
    """
    payload = html.unescape((text or "").strip())
    if not payload:
        return None
    try:
        return _parse_sii_xml(payload.encode("utf-8"))
    except etree.XMLSyntaxError:
        # Si viene con basura previa, intentar desde el primer '<'
        start = payload.find("<")
        if start == -1:
            return None
        try:
            return _parse_sii_xml(payload[start:].encode("utf-8"))
        except etree.XMLSyntaxError:
            return None


def _extract_embedded_xml(root: etree._Element, *wrapper_tags: str) -> etree._Element | None:
    wrapped = _find_text_by_localname(root, *wrapper_tags)
    if not wrapped:
        return None
    return _parse_embedded_xml(wrapped)


def _c14n_standard(element: etree._Element) -> bytes:
    return etree.tostring(element, method="c14n", exclusive=False, with_comments=False)


def _int_to_bytes(number: int) -> bytes:
    size = (number.bit_length() + 7) // 8
    return number.to_bytes(size, byteorder="big")


def _build_signed_seed_xml(semilla: str) -> str:
    """
    Construye <getToken> firmado con XML-DSig para GetTokenFromSeed.

    El SII requiere:
      - <Signature xmlns:ds="..."> con prefijo ds: para que <Certificate>
        (sin namespace) dentro de <ds:X509Data> quede en namespace VACÍO.
        El parser del SII busca Certificate con getElementsByTagNameNS("","Certificate")
        y solo lo encuentra cuando está en namespace vacío, lo cual ocurre
        únicamente cuando el padre usa prefijo (no namespace por defecto).
    """
    with open(settings.SII_CERT_PFX_PATH, "rb") as f:
        pfx_data = f.read()
    password_bytes = settings.SII_CERT_PFX_PASSWORD.encode() if settings.SII_CERT_PFX_PASSWORD else None
    private_key, certificate, _ = load_key_and_certificates(
        pfx_data, password_bytes, default_backend()
    )
    if private_key is None or certificate is None:
        raise ValueError("No se pudo extraer llave privada/certificado desde SII_CERT_PFX_PATH")

    cert_der = certificate.public_bytes(serialization.Encoding.DER)
    cert_b64 = base64.b64encode(cert_der).decode("ascii")

    public_numbers = certificate.public_key().public_numbers()
    modulus_b64 = base64.b64encode(_int_to_bytes(public_numbers.n)).decode("ascii")
    exponent_b64 = base64.b64encode(_int_to_bytes(public_numbers.e)).decode("ascii")

    root = etree.Element("getToken")
    item = etree.SubElement(root, "item")
    etree.SubElement(item, "Semilla").text = semilla

    # Prefijo ds: — NO default namespace — para que <Certificate> quede en ns vacío.
    # xmlns:ds se declara en <ds:Signature> Y en <ds:SignedInfo> explícitamente:
    # algunos validadores C14N (incluyendo el del SII) no incluyen ns heredados
    # del padre, por lo que la declaración en el nodo firmado es necesaria.
    signature = etree.SubElement(
        root,
        f"{{{XMLDSIG}}}Signature",
        nsmap={XMLDSIG_PREFIX: XMLDSIG},
    )
    signed_info = etree.SubElement(
        signature,
        f"{{{XMLDSIG}}}SignedInfo",
        nsmap={XMLDSIG_PREFIX: XMLDSIG},
    )
    cm = etree.SubElement(signed_info, f"{{{XMLDSIG}}}CanonicalizationMethod")
    cm.set("Algorithm", XML_C14N_STD)
    sm = etree.SubElement(signed_info, f"{{{XMLDSIG}}}SignatureMethod")
    sm.set("Algorithm", f"{XMLDSIG}rsa-sha1")
    ref = etree.SubElement(signed_info, f"{{{XMLDSIG}}}Reference")
    ref.set("URI", "")
    transforms = etree.SubElement(ref, f"{{{XMLDSIG}}}Transforms")
    tr = etree.SubElement(transforms, f"{{{XMLDSIG}}}Transform")
    tr.set("Algorithm", f"{XMLDSIG}enveloped-signature")
    etree.SubElement(ref, f"{{{XMLDSIG}}}DigestMethod").set("Algorithm", f"{XMLDSIG}sha1")
    digest_value = etree.SubElement(ref, f"{{{XMLDSIG}}}DigestValue")

    # Digest sobre el documento sin Signature
    root_for_digest = etree.fromstring(etree.tostring(root))
    sig_node = root_for_digest.find(f"{{{XMLDSIG}}}Signature")
    if sig_node is not None:
        root_for_digest.remove(sig_node)
    digest_bytes = hashlib.sha1(_c14n_standard(root_for_digest)).digest()
    digest_value.text = base64.b64encode(digest_bytes).decode("ascii")

    signed_info_c14n = _c14n_standard(signed_info)
    sig_bytes = private_key.sign(signed_info_c14n, asym_padding.PKCS1v15(), hashes.SHA1())
    signature_value = etree.SubElement(signature, f"{{{XMLDSIG}}}SignatureValue")
    signature_value.text = base64.b64encode(sig_bytes).decode("ascii")

    key_info = etree.SubElement(signature, f"{{{XMLDSIG}}}KeyInfo")
    kv = etree.SubElement(key_info, f"{{{XMLDSIG}}}KeyValue")
    rsa_kv = etree.SubElement(kv, f"{{{XMLDSIG}}}RSAKeyValue")
    etree.SubElement(rsa_kv, f"{{{XMLDSIG}}}Modulus").text = modulus_b64
    etree.SubElement(rsa_kv, f"{{{XMLDSIG}}}Exponent").text = exponent_b64
    x509_data = etree.SubElement(key_info, f"{{{XMLDSIG}}}X509Data")
    etree.SubElement(x509_data, f"{{{XMLDSIG}}}X509Certificate").text = cert_b64
    # <Certificate> sin namespace → queda en ns vacío dentro del scope ds: (no default ns)
    etree.SubElement(x509_data, "Certificate").text = cert_b64

    xml = etree.tostring(root, encoding="unicode")
    logger.debug("getToken XML enviado a SII:\n%s", xml)
    return xml


def _build_get_seed_envelope() -> bytes:
    service_ns = f"{settings.SII_BASE_URL}/DTEWS/CrSeed.jws"
    envelope = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<soapenv:Envelope'
        ' xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"'
        ' xmlns:xsd="http://www.w3.org/2001/XMLSchema"'
        ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        "<soapenv:Body>"
        f'<m:getSeed xmlns:m="{service_ns}"'
        ' soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"/>'
        "</soapenv:Body>"
        "</soapenv:Envelope>"
    )
    return envelope.encode("utf-8")


async def _get_seed(client: httpx.AsyncClient) -> str:
    """Obtiene la semilla desde SII via SOAP POST."""
    url = f"{settings.SII_BASE_URL}/DTEWS/CrSeed.jws"
    body = _build_get_seed_envelope()
    response = await client.post(
        url,
        content=body,
        headers={"Content-Type": "text/xml; charset=UTF-8", "SOAPAction": ""},
        follow_redirects=True,
        timeout=15.0,
    )
    response.raise_for_status()
    root = _parse_sii_xml(response.content)
    semilla = _find_text_by_localname(root, "SEMILLA", "Semilla")
    if not semilla:
        embedded = _extract_embedded_xml(root, "getSeedReturn", "return")
        if embedded is not None:
            semilla = _find_text_by_localname(embedded, "SEMILLA", "Semilla")
    if not semilla:
        raise ValueError(
            f"Respuesta de semilla SII sin <SEMILLA>: {response.text[:300]}"
        )
    return semilla.strip()


def _build_seed_envelope(semilla: str) -> bytes:
    """Construye el SOAP envelope para GetTokenFromSeed."""
    service_ns = f"{settings.SII_BASE_URL}/DTEWS/GetTokenFromSeed.jws"
    token_request_xml = _build_signed_seed_xml(semilla)
    token_request_xml_escaped = html.escape(token_request_xml, quote=False)
    envelope = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<soapenv:Envelope'
        ' xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"'
        ' xmlns:xsd="http://www.w3.org/2001/XMLSchema"'
        ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        "<soapenv:Body>"
        f'<m:getToken xmlns:m="{service_ns}"'
        ' soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">'
        '<pszXml xsi:type="xsd:string">'
        f"{token_request_xml_escaped}"
        "</pszXml>"
        "</m:getToken>"
        "</soapenv:Body>"
        "</soapenv:Envelope>"
    )
    return envelope.encode("utf-8")


def _extract_token_or_status(root: etree._Element) -> tuple[str | None, str | None, str | None]:
    token = _find_text_by_localname(root, "TOKEN", "Token")
    estado = _find_text_by_localname(root, "ESTADO", "STATUS")
    glosa = _find_text_by_localname(root, "GLOSA", "MSG")
    if token:
        return token, estado, glosa

    embedded = _extract_embedded_xml(root, "getTokenReturn", "getTokenFromSeedReturn", "return")
    if embedded is None:
        return None, estado, glosa

    token = _find_text_by_localname(embedded, "TOKEN", "Token")
    estado = _find_text_by_localname(embedded, "ESTADO", "STATUS") or estado
    glosa = _find_text_by_localname(embedded, "GLOSA", "MSG") or glosa
    return token, estado, glosa


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
        follow_redirects=True,
        timeout=15.0,
    )
    logger.debug("GetTokenFromSeed respuesta HTTP %s:\n%s", response.status_code, response.text[:2000])
    try:
        root = _parse_sii_xml(response.content)
    except etree.XMLSyntaxError:
        root = None

    token = None
    estado = None
    glosa = None
    if root is not None:
        token, estado, glosa = _extract_token_or_status(root)
        if token:
            return token.strip()

    if response.is_error:
        raise ValueError(
            "GetTokenFromSeed error HTTP "
            f"{response.status_code} estado={estado or 'N/A'} glosa={glosa or 'N/A'} "
            f"body={response.text[:300]}"
        )

    if not token:
        raise ValueError(
            "Respuesta de token SII sin <TOKEN> "
            f"estado={estado or 'N/A'} glosa={glosa or 'N/A'} body={response.text[:300]}"
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

    root = _parse_sii_xml(response.content)
    status = (
        root.findtext(".//STATUS")
        or root.findtext(".//ESTADO")
        or "UNKNOWN"
    )
    trackid = root.findtext(".//TRACKID") or ""
    glosa = root.findtext(".//GLOSA") or ""

    return {"status": status, "trackid": trackid, "glosa": glosa}
