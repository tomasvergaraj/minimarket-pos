"""
Construcción del XML DTE Tipo 39 (Boleta Electrónica).

Notas para Tipo 39:
- MntBruto=1  → precios en <Detalle> incluyen IVA
- IndServicio=3 → boleta de servicios (B2C electrónica)
- RUTRecep="66.666.666-6" → consumidor anónimo (sin RUT)
- MntNeto = round(total × 100 / 119)  (extracción desde precio bruto)
- IVA = MntTotal − MntNeto
- El elemento <FRMT> dentro de <TED> se deja vacío; signer.sign_ted() lo llena.
"""
from datetime import datetime, timezone
from lxml import etree

from app.models.sale import Sale


def _rut_parts(rut_con_dv: str) -> tuple[str, str]:
    """'76.123.456-7' → ('76123456', '7')"""
    clean = rut_con_dv.replace(".", "").replace("-", "")
    return clean[:-1], clean[-1].upper()


def _mnt_neto(total_bruto: int) -> int:
    """Extrae monto neto desde total bruto con IVA 19%."""
    return round(total_bruto * 100 / 119)


def build_dte_xml(
    sale: Sale,
    folio: int,
    caf_xml_bytes: bytes,
    emisor_rut: str,
    emisor_nombre: str,
    emisor_giro: str,
    emisor_acteco: int,
    emisor_dir: str,
    emisor_comuna: str,
    emisor_ciudad: str,
) -> etree._Element:
    """
    Construye el árbol XML DTE Tipo 39 sin firmar.

    El elemento raíz es <DTE version="1.0">.
    El hijo <Documento ID="T39F{folio}"> lleva el ID usado por XML-DSig.
    El <FRMT> dentro de <TED> queda vacío — sign_ted() lo completa.

    Raises:
        ValueError: si la venta no tiene ítems o el total es cero.
    """
    if not sale.items:
        raise ValueError("La venta no tiene ítems — no se puede construir el DTE")

    total_int = int(round(float(sale.total)))
    if total_int <= 0:
        raise ValueError(f"Total de venta inválido: {total_int}")

    mnt_neto = _mnt_neto(total_int)
    iva = total_int - mnt_neto
    emis_rut, emis_dv = _rut_parts(emisor_rut)
    fecha_emis = sale.created_at.strftime("%Y-%m-%d")
    tmst_now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    doc_id = f"T39F{folio}"

    # ── Raíz ──────────────────────────────────────────────────────────────
    dte = etree.Element("DTE", version="1.0")
    doc = etree.SubElement(dte, "Documento", ID=doc_id)

    # ── Encabezado ────────────────────────────────────────────────────────
    enc = etree.SubElement(doc, "Encabezado")

    id_doc = etree.SubElement(enc, "IdDoc")
    etree.SubElement(id_doc, "TipoDTE").text = "39"
    etree.SubElement(id_doc, "Folio").text = str(folio)
    etree.SubElement(id_doc, "FchEmis").text = fecha_emis
    etree.SubElement(id_doc, "IndServicio").text = "3"
    etree.SubElement(id_doc, "MntBruto").text = "1"
    etree.SubElement(id_doc, "TpoMoneda").text = "PESO CL"

    emisor = etree.SubElement(enc, "Emisor")
    etree.SubElement(emisor, "RUTEmisor").text = f"{emis_rut}-{emis_dv}"
    etree.SubElement(emisor, "RznSoc").text = emisor_nombre[:100]
    etree.SubElement(emisor, "GiroEmis").text = emisor_giro[:80]
    etree.SubElement(emisor, "Acteco").text = str(emisor_acteco)
    etree.SubElement(emisor, "DirOrigen").text = emisor_dir[:70]
    etree.SubElement(emisor, "CmnaOrigen").text = emisor_comuna[:20]
    etree.SubElement(emisor, "CiudadOrigen").text = emisor_ciudad[:20]

    receptor = etree.SubElement(enc, "Receptor")
    etree.SubElement(receptor, "RUTRecep").text = "66.666.666-6"
    etree.SubElement(receptor, "RznSocRecep").text = "Sin Nombre"

    totales = etree.SubElement(enc, "Totales")
    etree.SubElement(totales, "MntNeto").text = str(mnt_neto)
    etree.SubElement(totales, "TasaIVA").text = "19"
    etree.SubElement(totales, "IVA").text = str(iva)
    etree.SubElement(totales, "MntTotal").text = str(total_int)

    # ── Detalle ───────────────────────────────────────────────────────────
    for idx, item in enumerate(sale.items, start=1):
        det = etree.SubElement(doc, "Detalle")
        etree.SubElement(det, "NroLinDet").text = str(idx)
        etree.SubElement(det, "NmbItem").text = item.product_name[:80]
        etree.SubElement(det, "QtyItem").text = str(item.quantity)
        etree.SubElement(det, "UnmdItem").text = "un"
        etree.SubElement(det, "PrcItem").text = str(int(round(float(item.unit_price))))
        etree.SubElement(det, "MontoItem").text = str(int(round(float(item.subtotal))))

    # ── TED (Timbre Electrónico Digital) ──────────────────────────────────
    ted = etree.SubElement(doc, "TED", version="1.0")
    dd = etree.SubElement(ted, "DD")
    etree.SubElement(dd, "RE").text = f"{emis_rut}-{emis_dv}"
    etree.SubElement(dd, "TD").text = "39"
    etree.SubElement(dd, "F").text = str(folio)
    etree.SubElement(dd, "FE").text = fecha_emis
    etree.SubElement(dd, "RR").text = "66.666.666-6"
    etree.SubElement(dd, "RSR").text = "Sin Nombre"
    etree.SubElement(dd, "MNT").text = str(total_int)
    etree.SubElement(dd, "IT1").text = sale.items[0].product_name[:40]

    # Incrustar elemento <CAF> dentro de <DD>
    caf_elem = etree.fromstring(caf_xml_bytes)
    dd.append(caf_elem)

    etree.SubElement(dd, "TSTED").text = tmst_now

    # <FRMT> vacío — sign_ted() lo llenará con la firma RSA
    etree.SubElement(ted, "FRMT", algoritmo="SHA1withRSA")

    etree.SubElement(doc, "TmstFirma").text = tmst_now

    return dte
