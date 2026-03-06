"""
Generador de materiales de prueba SII para desarrollo local.

Genera:
  1. Un par RSA + certificado X.509 autofirmado -> test_cert.pfx
  2. Un archivo CAF XML sintético (con su propio par RSA)  -> test_caf_39.xml

IMPORTANTE: Estos archivos son SOLO para pruebas locales del código.
NO son aceptados por el SII real. Para conectarte a maullin2.sii.cl
necesitas materiales reales (ver instrucciones al final del script).

Uso:
  cd server-fastapi
  pip install cryptography lxml
  python generate_test_materials.py

Salida:
  test_materials/test_cert.pfx        # certificado empresa (contraseña: test1234)
  test_materials/test_caf_39.xml      # CAF Tipo 39, folios 1-200
  test_materials/instrucciones.txt    # cómo configurar .env
"""
import base64
import os
import datetime
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID
from lxml import etree


OUT_DIR = Path(__file__).parent / "test_materials"
CERT_PASSWORD = b"test1234"

# Datos ficticios para pruebas — usar tu RUT y datos reales en producción
TEST_RUT = "76.354.771-K"
TEST_RAZON_SOCIAL = "EMPRESA DE PRUEBA SpA"
TEST_GIRO = "COMERCIO AL POR MENOR DE ALMACENES"
FOLIO_DESDE = 1
FOLIO_HASTA = 200


def generar_clave_rsa(bits: int = 2048):
    return rsa.generate_private_key(public_exponent=65537, key_size=bits)


def generar_certificado_pfx(out_path: Path) -> None:
    """Genera un certificado X.509 autofirmado y lo exporta como .pfx."""
    print("Generando certificado .pfx ...")
    key = generar_clave_rsa()

    rut_limpio = TEST_RUT.replace(".", "").replace("-", "")
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "CL"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, TEST_RAZON_SOCIAL),
        x509.NameAttribute(NameOID.COMMON_NAME, f"RUT {TEST_RUT}"),
        x509.NameAttribute(NameOID.SERIAL_NUMBER, rut_limpio),
    ])

    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.datetime.now(datetime.timezone.utc))
        .not_valid_after(datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=365))
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .sign(key, hashes.SHA256())
    )

    pfx_bytes = pkcs12.serialize_key_and_certificates(
        name=b"test_cert",
        key=key,
        cert=cert,
        cas=None,
        encryption_algorithm=serialization.BestAvailableEncryption(CERT_PASSWORD),
    )

    out_path.write_bytes(pfx_bytes)
    print(f"  -> {out_path}  (password: {CERT_PASSWORD.decode()})")


def generar_caf_xml(out_path: Path) -> None:
    """
    Genera un CAF XML sintético con par RSA propio.
    Replica exactamente la estructura que emite el SII.
    """
    print("Generando CAF XML ...")

    # Par RSA para el CAF (distinto al certificado de empresa)
    caf_key = generar_clave_rsa(1024)  # SII usa 1024 bits en sus CAFs
    caf_pub = caf_key.public_key()
    pub_numbers = caf_pub.public_numbers()

    # Módulo e exponente en base64 (formato SII)
    modulus_bytes = pub_numbers.n.to_bytes((pub_numbers.n.bit_length() + 7) // 8, "big")
    mod_b64 = base64.b64encode(modulus_bytes).decode()
    exp_b64 = base64.b64encode(
        pub_numbers.e.to_bytes((pub_numbers.e.bit_length() + 7) // 8, "big")
    ).decode()

    # Fecha de autorización
    fecha_auth = datetime.date.today().isoformat()
    rut_limpio = TEST_RUT.replace(".", "").replace("-", "")

    # Construir elemento <DA>
    da_str = (
        f"<DA>"
        f"<RE>{TEST_RUT}</RE>"
        f"<RS>{TEST_RAZON_SOCIAL}</RS>"
        f"<TD>39</TD>"
        f"<RNG><D>{FOLIO_DESDE}</D><H>{FOLIO_HASTA}</H></RNG>"
        f"<FA>{fecha_auth}</FA>"
        f"<RSAPK><M>{mod_b64}</M><E>{exp_b64}</E></RSAPK>"
        f"<IDK>100</IDK>"
        f"</DA>"
    )
    da_bytes = da_str.encode("utf-8")

    # Firma sintética de <DA> con la llave CAF (simula la firma del SII)
    frma_bytes = caf_key.sign(da_bytes, padding.PKCS1v15(), hashes.SHA1())
    frma_b64 = base64.b64encode(frma_bytes).decode()

    # Llave privada CAF en PEM (sin encriptar, tal como la entrega el SII)
    pem_key = caf_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()

    # XML completo
    xml_str = f"""<?xml version="1.0" encoding="UTF-8"?>
<AUTORIZACION>
 <CAF version="1.0">
  {da_str}
  <FRMA algoritmo="SHA1withRSA">{frma_b64}</FRMA>
 </CAF>
 <RSASK>{pem_key}</RSASK>
</AUTORIZACION>"""

    out_path.write_text(xml_str, encoding="utf-8")
    print(f"  -> {out_path}  (folios {FOLIO_DESDE}-{FOLIO_HASTA}, RUT {TEST_RUT})")


def generar_instrucciones(cert_path: Path, caf_path: Path, txt_path: Path) -> None:
    contenido = f"""
MATERIALES DE PRUEBA GENERADOS
================================
Fecha: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}

Archivos generados:
  Certificado: {cert_path.resolve()}
  CAF XML:     {caf_path.resolve()}

CONFIGURACIÓN .env
==================
Copia estas líneas en tu archivo .env:

  SII_ENABLED=true
  SII_AMBIENTE=certification
  SII_CERT_PFX_PATH={cert_path.resolve()}
  SII_CERT_PFX_PASSWORD=test1234
  SII_CAF_XML_PATH={caf_path.resolve()}
  STORE_RUT={TEST_RUT}
  STORE_NAME={TEST_RAZON_SOCIAL}
  STORE_GIRO={TEST_GIRO}
  STORE_ACTECO=521010
  STORE_COMUNA=Santiago
  STORE_CIUDAD=Santiago
  STORE_ADDRESS=Calle de Prueba 123

CARGAR CAF EN LA BASE DE DATOS
================================
Con el servidor corriendo:

  curl -X POST http://localhost:8000/api/tax/sii/caf/load \\
    -H "Content-Type: application/json" \\
    -d '{{"caf_xml_path": "{caf_path.resolve()}"}}'

(requiere token de admin en el header Authorization)

VERIFICAR ESTADO
================
  curl http://localhost:8000/api/tax/sii/status

LIMITACIONES DE ESTOS MATERIALES
==================================
- El certificado es autofirmado: NO lo acepta el SII real.
- El CAF tiene una firma sintética: funciona para probar el código local,
  pero el SII rechazará los DTEs generados con él.
- Sirven para verificar que el XML se construye y firma correctamente,
  que los endpoints responden, y que el flujo de folios funciona.

PARA MATERIALES REALES (certificación SII)
==========================================
1. CERTIFICADO DIGITAL (.pfx)
   - Proveedores: Acepta (acepta.com), E-Sign, GlobalSign Chile
   - Costo aprox: USD 30-80/año
   - Entregan el .pfx y contraseña por email
   - Para certificación SII usa el mismo cert de producción

2. CAF XML (folios Tipo 39)
   - Portal de certificación SII: https://maullin2.sii.cl
   - Ingresar con RUT + contraseña del contribuyente
   - Ir a: Factura Electrónica -> Certificación -> Solicitar Folios
   - Seleccionar Tipo 39, cantidad (ej: 100), descargar XML
   - El archivo se llama algo como: caf_0039_001_000100.xml

3. REGISTRO EN PORTAL CERTIFICACIÓN
   - https://maullin2.sii.cl -> Mi SII -> Acceso al Sistema
   - El RUT debe tener obligaciones de IVA (2da categoría)
   - El proceso de certificación DTE requiere enviar DTEs de prueba
     y que SII los valide antes de autorizar producción
"""
    txt_path.write_text(contenido.strip(), encoding="utf-8")
    print(f"  -> {txt_path}")


def main():
    OUT_DIR.mkdir(exist_ok=True)
    cert_path = OUT_DIR / "test_cert.pfx"
    caf_path = OUT_DIR / "test_caf_39.xml"
    txt_path = OUT_DIR / "instrucciones.txt"

    generar_certificado_pfx(cert_path)
    generar_caf_xml(caf_path)
    generar_instrucciones(cert_path, caf_path, txt_path)

    print()
    print("OK Materiales generados en:", OUT_DIR.resolve())
    print()
    print("Próximos pasos:")
    print("  1. Lee test_materials/instrucciones.txt")
    print("  2. Copia las variables al .env")
    print("  3. alembic upgrade head")
    print("  4. Carga el CAF: POST /api/tax/sii/caf/load")
    print("  5. Verifica: GET /api/tax/sii/status -> configured: true")
    print()


if __name__ == "__main__":
    main()
