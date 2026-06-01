"""
Firma digital DTE en dos fases:

Fase 1 — TED (firma <DD> con la llave privada del CAF):
  1. C14N estándar del elemento <DD>
  2. RSA-PKCS1v15 + SHA1 con la llave del CAF
  3. base64 → rellena <FRMT>

Fase 2 — XML-DSig (firma <Documento> con el certificado .pfx de la empresa):
  Schema SII requiere:
  - CanonicalizationMethod = C14N estándar (NO exclusive)
  - Transform = SOLO enveloped-signature (NO c14n adicional)
  - KeyInfo = <KeyValue><RSAKeyValue>...</RSAKeyValue></KeyValue><X509Data>...</X509Data>
"""
import base64
from io import BytesIO

from lxml import etree
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding as asym_padding
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.serialization.pkcs12 import load_key_and_certificates

XMLDSIG = "http://www.w3.org/2000/09/xmldsig#"
C14N_STD = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"
SII_NS = "http://www.sii.cl/SiiDte"


def _wrap_b64(s: str, width: int = 64) -> str:
    """Inserta saltos de línea cada `width` chars (estilo PEM) para evitar
    el límite SII de 4090 chars/línea (error CHR-00002)."""
    return "\n" + "\n".join(s[i:i + width] for i in range(0, len(s), width)) + "\n"


def _c14n(element: etree._Element) -> bytes:
    """
    C14N estándar (inclusive). SII usa Apache xmlsec (Java) que produce
    c14n correcto sin `xmlns=""` espurios en descendientes.

    Bug de lxml: cuando c14n se aplica a un subárbol con namespace default,
    emite `xmlns=""` en algunos descendientes. Re-serializamos y re-parseamos
    para aislar el elemento como nueva raíz, lo que arregla el bug y produce
    c14n equivalente a Apache xmlsec.
    """
    fresh = etree.fromstring(etree.tostring(element))
    buf = BytesIO()
    etree.ElementTree(fresh).write_c14n(buf, exclusive=False, with_comments=False)
    return buf.getvalue()


def _int_to_bytes(number: int) -> bytes:
    size = (number.bit_length() + 7) // 8
    return number.to_bytes(size, byteorder="big")


def _sha1_digest(data: bytes) -> bytes:
    from cryptography.hazmat.primitives.hashes import Hash, SHA1
    h = Hash(SHA1(), backend=default_backend())
    h.update(data)
    return h.finalize()


def sign_ted(dte_root: etree._Element, private_key: RSAPrivateKey) -> etree._Element:
    """
    Fase 1: firma el elemento <DD> del TED con la llave privada del CAF.

    Modifica dte_root en-sitio: rellena <FRMT>.text con la firma en base64.
    Retorna el mismo elemento para encadenamiento.
    """
    # TED queda en namespace VACÍO aunque el DTE padre esté en SII.
    # Buscar DD y FRMT por localname, sin importar namespace.
    dd = None
    frmt = None
    for el in dte_root.iter():
        local = etree.QName(el).localname
        if local == "DD" and dd is None:
            dd = el
        elif local == "FRMT" and frmt is None:
            frmt = el
    if dd is None:
        raise ValueError("No se encontró <DD> dentro de <TED> en el DTE")
    if frmt is None:
        raise ValueError("No se encontró <FRMT> dentro de <TED> en el DTE")

    dd_bytes = _c14n(dd)
    signature_bytes = private_key.sign(
        dd_bytes,
        asym_padding.PKCS1v15(),
        hashes.SHA1(),
    )
    frmt.text = base64.b64encode(signature_bytes).decode("ascii")
    return dte_root


def sign_xml_envelope(
    parent: etree._Element,
    target: etree._Element,
    pfx_path: str,
    pfx_password: str,
) -> etree._Element:
    """
    Firma XML-DSig genérica: firma `target` (que debe tener atributo ID) y
    adjunta <Signature> como último hijo de `parent`.

    Útil para Documento (DTE), SetDTE (EnvioBOLETA) y DocumentoConsumoFolios.

    Args:
        parent: elemento raíz al que se adjunta la firma
        target: elemento a firmar (debe tener atributo ID)
        pfx_path, pfx_password: certificado .pfx
    """
    target_id = target.get("ID")
    if not target_id:
        raise ValueError(f"Elemento a firmar no tiene atributo ID: {target.tag}")
    ref_uri = f"#{target_id}"

    with open(pfx_path, "rb") as f:
        pfx_data = f.read()
    password_bytes = pfx_password.encode() if pfx_password else None
    private_key, certificate, _ = load_key_and_certificates(
        pfx_data, password_bytes, default_backend()
    )
    cert_der = certificate.public_bytes(serialization.Encoding.DER)
    cert_b64 = base64.b64encode(cert_der).decode("ascii")

    target_c14n = _c14n(target)
    digest_value = base64.b64encode(_sha1_digest(target_c14n)).decode("ascii")

    # Extraer modulus y exponent del cert para <KeyValue><RSAKeyValue>
    public_numbers = certificate.public_key().public_numbers()
    modulus_b64 = base64.b64encode(_int_to_bytes(public_numbers.n)).decode("ascii")
    exponent_b64 = base64.b64encode(_int_to_bytes(public_numbers.e)).decode("ascii")

    # Namespace por defecto (sin prefijo ds:/ns0:) — formato que SII espera
    sig = etree.SubElement(parent, f"{{{XMLDSIG}}}Signature", nsmap={None: XMLDSIG})
    signed_info = etree.SubElement(sig, f"{{{XMLDSIG}}}SignedInfo")

    cm = etree.SubElement(signed_info, f"{{{XMLDSIG}}}CanonicalizationMethod")
    cm.set("Algorithm", C14N_STD)
    sm = etree.SubElement(signed_info, f"{{{XMLDSIG}}}SignatureMethod")
    sm.set("Algorithm", f"{XMLDSIG}rsa-sha1")

    ref = etree.SubElement(signed_info, f"{{{XMLDSIG}}}Reference")
    ref.set("URI", ref_uri)
    transforms = etree.SubElement(ref, f"{{{XMLDSIG}}}Transforms")
    t_env = etree.SubElement(transforms, f"{{{XMLDSIG}}}Transform")
    t_env.set("Algorithm", f"{XMLDSIG}enveloped-signature")
    # NO segundo Transform — schema SII solo permite uno
    dm = etree.SubElement(ref, f"{{{XMLDSIG}}}DigestMethod")
    dm.set("Algorithm", f"{XMLDSIG}sha1")
    dv = etree.SubElement(ref, f"{{{XMLDSIG}}}DigestValue")
    dv.text = digest_value

    si_c14n = _c14n(signed_info)
    sig_bytes = private_key.sign(si_c14n, asym_padding.PKCS1v15(), hashes.SHA1())
    sig_val = etree.SubElement(sig, f"{{{XMLDSIG}}}SignatureValue")
    sig_val.text = _wrap_b64(base64.b64encode(sig_bytes).decode("ascii"))

    # KeyInfo: KeyValue (RSAKeyValue) ANTES de X509Data — orden exigido por schema
    # Wrap base64 largos para respetar límite de 4090 chars/línea de SII.
    # Estos elementos están FUERA del SignedInfo, así que el wrapping no
    # afecta la firma. Para SetDTE/Documento (firmados como envoltura),
    # el c14n los incluye con sus newlines tal cual quedan acá.
    key_info = etree.SubElement(sig, f"{{{XMLDSIG}}}KeyInfo")
    key_value = etree.SubElement(key_info, f"{{{XMLDSIG}}}KeyValue")
    rsa_kv = etree.SubElement(key_value, f"{{{XMLDSIG}}}RSAKeyValue")
    etree.SubElement(rsa_kv, f"{{{XMLDSIG}}}Modulus").text = _wrap_b64(modulus_b64)
    etree.SubElement(rsa_kv, f"{{{XMLDSIG}}}Exponent").text = exponent_b64
    x509_data = etree.SubElement(key_info, f"{{{XMLDSIG}}}X509Data")
    x509_cert = etree.SubElement(x509_data, f"{{{XMLDSIG}}}X509Certificate")
    x509_cert.text = _wrap_b64(cert_b64)

    return parent


def sign_dte(
    dte_root: etree._Element,
    pfx_path: str,
    pfx_password: str,
) -> etree._Element:
    """
    Fase 2: aplica firma XML-DSig W3C sobre <Documento>.

    El elemento <Signature> se agrega como último hijo de <DTE>,
    hermano de <Documento> — formato esperado por SII.
    """
    # DTE en namespace SII — buscar Documento con namespace
    documento = dte_root.find(f"{{{SII_NS}}}Documento")
    if documento is None:
        documento = dte_root.find("Documento")  # fallback
    if documento is None:
        raise ValueError("No se encontró <Documento> dentro de <DTE>")
    return sign_xml_envelope(dte_root, documento, pfx_path, pfx_password)
