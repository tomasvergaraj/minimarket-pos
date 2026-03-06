"""
Firma digital DTE en dos fases:

Fase 1 — TED (firma <DD> con la llave privada del CAF):
  1. C14N exclusive del elemento <DD>
  2. RSA-PKCS1v15 + SHA1 con la llave del CAF
  3. base64 → rellena <FRMT>

Fase 2 — XML-DSig (firma <Documento> con el certificado .pfx de la empresa):
  1. Carga .pfx con cryptography
  2. C14N exclusive de <Documento> → SHA1 → DigestValue
  3. Construye <SignedInfo> con Reference URI="#T39F{folio}"
     transforms: enveloped-signature + C14N exclusive
  4. C14N de <SignedInfo> → RSA-SHA1 → SignatureValue
  5. Appenda <Signature> como último hijo de <DTE> (hermano de <Documento>)
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
C14N_EXC = "http://www.w3.org/2001/10/xml-exc-c14n#"


def _c14n(element: etree._Element) -> bytes:
    """C14N exclusive de un elemento (serializado como subárbol)."""
    buf = BytesIO()
    etree.ElementTree(element).write_c14n(buf, exclusive=True, with_comments=False)
    return buf.getvalue()


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
    dd = dte_root.find(".//TED/DD")
    if dd is None:
        raise ValueError("No se encontró <DD> dentro de <TED> en el DTE")

    dd_bytes = _c14n(dd)
    signature_bytes = private_key.sign(
        dd_bytes,
        asym_padding.PKCS1v15(),
        hashes.SHA1(),
    )
    frmt = dte_root.find(".//TED/FRMT")
    frmt.text = base64.b64encode(signature_bytes).decode("ascii")
    return dte_root


def sign_dte(
    dte_root: etree._Element,
    pfx_path: str,
    pfx_password: str,
) -> etree._Element:
    """
    Fase 2: aplica firma XML-DSig W3C sobre <Documento>.

    El elemento <Signature> se agrega como último hijo de <DTE>,
    hermano de <Documento> — formato esperado por SII.

    Args:
        dte_root:     elemento raíz <DTE version="1.0"> ya con TED firmado.
        pfx_path:     ruta al archivo .pfx del contribuyente.
        pfx_password: contraseña del .pfx (cadena vacía si no tiene).

    Returns:
        El mismo dte_root con <Signature> agregado.
    """
    # ── Cargar certificado ────────────────────────────────────────────────
    with open(pfx_path, "rb") as f:
        pfx_data = f.read()
    password_bytes = pfx_password.encode() if pfx_password else None
    private_key, certificate, _ = load_key_and_certificates(
        pfx_data, password_bytes, default_backend()
    )
    cert_der = certificate.public_bytes(serialization.Encoding.DER)
    cert_b64 = base64.b64encode(cert_der).decode("ascii")

    # ── Digest de <Documento> ─────────────────────────────────────────────
    documento = dte_root.find("Documento")
    doc_id = documento.get("ID")           # "T39F{folio}"
    ref_uri = f"#{doc_id}"

    doc_c14n = _c14n(documento)
    digest_value = base64.b64encode(_sha1_digest(doc_c14n)).decode("ascii")

    # ── Construir <Signature> ─────────────────────────────────────────────
    sig = etree.SubElement(dte_root, f"{{{XMLDSIG}}}Signature")

    signed_info = etree.SubElement(sig, f"{{{XMLDSIG}}}SignedInfo")

    cm = etree.SubElement(signed_info, f"{{{XMLDSIG}}}CanonicalizationMethod")
    cm.set("Algorithm", C14N_EXC)

    sm = etree.SubElement(signed_info, f"{{{XMLDSIG}}}SignatureMethod")
    sm.set("Algorithm", f"{XMLDSIG}rsa-sha1")

    ref = etree.SubElement(signed_info, f"{{{XMLDSIG}}}Reference")
    ref.set("URI", ref_uri)

    transforms = etree.SubElement(ref, f"{{{XMLDSIG}}}Transforms")
    t_env = etree.SubElement(transforms, f"{{{XMLDSIG}}}Transform")
    t_env.set("Algorithm", f"{XMLDSIG}enveloped-signature")
    t_c14n = etree.SubElement(transforms, f"{{{XMLDSIG}}}Transform")
    t_c14n.set("Algorithm", C14N_EXC)

    dm = etree.SubElement(ref, f"{{{XMLDSIG}}}DigestMethod")
    dm.set("Algorithm", f"{XMLDSIG}sha1")

    dv = etree.SubElement(ref, f"{{{XMLDSIG}}}DigestValue")
    dv.text = digest_value

    # ── Firma de <SignedInfo> ─────────────────────────────────────────────
    si_c14n = _c14n(signed_info)
    sig_bytes = private_key.sign(si_c14n, asym_padding.PKCS1v15(), hashes.SHA1())

    sig_val = etree.SubElement(sig, f"{{{XMLDSIG}}}SignatureValue")
    sig_val.text = base64.b64encode(sig_bytes).decode("ascii")

    # ── KeyInfo con certificado X.509 ─────────────────────────────────────
    key_info = etree.SubElement(sig, f"{{{XMLDSIG}}}KeyInfo")
    x509_data = etree.SubElement(key_info, f"{{{XMLDSIG}}}X509Data")
    x509_cert = etree.SubElement(x509_data, f"{{{XMLDSIG}}}X509Certificate")
    x509_cert.text = cert_b64

    return dte_root
