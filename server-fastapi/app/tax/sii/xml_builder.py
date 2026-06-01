"""
Construcción del XML DTE Tipo 39 (Boleta Electrónica) en namespace SII.

Schema SII para tipo 39:
- DTE root con xmlns="http://www.sii.cl/SiiDte"
- IdDoc: TipoDTE, Folio, FchEmis (opc: IndServicio, IndMntNeto)
- Emisor: RUTEmisor, RznSocEmisor, GiroEmisor, DirOrigen, CmnaOrigen, CiudadOrigen
- Receptor: RUTRecep (sin puntos: 66666666-6)
- Totales: MntNeto (opc), MntExe (opc), IVA (opc), MntTotal (req). NO lleva TasaIVA.
- TED queda en namespace empty (xmlns="") — el formato del CAF lo exige así
- CAF embebido en TED/DD conserva su propio namespace (vacío)

El DTE se crea desde el inicio en namespace SII para que c14n sea consistente
entre el documento standalone y cuando se incluye en <EnvioBOLETA> (también
en namespace SII). Si el DTE estuviera sin namespace, la herencia del
EnvioBOLETA cambiaría el c14n y la firma fallaría con "Error en Firma".
"""
from datetime import datetime, timezone
from lxml import etree

from app.models.sale import Sale

SII_NS = "http://www.sii.cl/SiiDte"
XSI_NS = "http://www.w3.org/2001/XMLSchema-instance"
SII = f"{{{SII_NS}}}"


def _rut_parts(rut_con_dv: str) -> tuple[str, str]:
    """'76.123.456-7' → ('76123456', '7')"""
    clean = rut_con_dv.replace(".", "").replace("-", "")
    return clean[:-1], clean[-1].upper()


def _mnt_neto(total_bruto: int) -> int:
    """Extrae monto neto desde total bruto con IVA 19%."""
    return round(total_bruto * 100 / 119)


def _escape_xml(s: str) -> str:
    """Escape texto para construcción manual de XML del TED."""
    return (s.replace("&", "&amp;").replace("<", "&lt;")
             .replace(">", "&gt;").replace('"', "&quot;").replace("'", "&apos;"))


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
    item_units: list[str] | None = None,
    references: list[dict] | None = None,
) -> etree._Element:
    """
    Construye el árbol XML DTE Tipo 39 sin firmar, en namespace SII.

    Raises:
        ValueError: si la venta no tiene ítems o el total es cero.
    """
    if not sale.items:
        raise ValueError("La venta no tiene ítems — no se puede construir el DTE")

    monto_afecto_bruto = 0
    monto_exento = 0
    for it in sale.items:
        subtotal_int = int(round(float(it.subtotal)))
        if float(it.tax_rate or 0) == 0:
            monto_exento += subtotal_int
        else:
            monto_afecto_bruto += subtotal_int

    total_int = monto_afecto_bruto + monto_exento
    if total_int <= 0:
        raise ValueError(f"Total de venta inválido: {total_int}")

    mnt_neto = _mnt_neto(monto_afecto_bruto) if monto_afecto_bruto > 0 else 0
    iva = monto_afecto_bruto - mnt_neto if monto_afecto_bruto > 0 else 0
    emis_rut, emis_dv = _rut_parts(emisor_rut)
    fecha_emis = sale.created_at.strftime("%Y-%m-%d")
    tmst_now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    doc_id = f"T39F{folio}"

    # ── Raíz DTE en namespace SII ─────────────────────────────────────────
    # IMPORTANTE: declaramos xmlns:xsi en el DTE también (no se usa aquí pero
    # cuando el DTE va dentro de EnvioBOLETA, EnvioBOLETA declara xmlns:xsi
    # para schemaLocation. Si el DTE no la declara aparte, la heredaria y el
    # c14n(Documento) cambiaria entre standalone vs in-envelope -> firma falla.
    dte = etree.Element(f"{SII}DTE", version="1.0", nsmap={None: SII_NS, "xsi": XSI_NS})
    doc = etree.SubElement(dte, f"{SII}Documento", ID=doc_id)

    enc = etree.SubElement(doc, f"{SII}Encabezado")

    id_doc = etree.SubElement(enc, f"{SII}IdDoc")
    etree.SubElement(id_doc, f"{SII}TipoDTE").text = "39"
    etree.SubElement(id_doc, f"{SII}Folio").text = str(folio)
    etree.SubElement(id_doc, f"{SII}FchEmis").text = fecha_emis
    etree.SubElement(id_doc, f"{SII}IndServicio").text = "3"

    emisor = etree.SubElement(enc, f"{SII}Emisor")
    etree.SubElement(emisor, f"{SII}RUTEmisor").text = f"{emis_rut}-{emis_dv}"
    etree.SubElement(emisor, f"{SII}RznSocEmisor").text = emisor_nombre[:100]
    etree.SubElement(emisor, f"{SII}GiroEmisor").text = emisor_giro[:80]
    etree.SubElement(emisor, f"{SII}DirOrigen").text = emisor_dir[:70]
    etree.SubElement(emisor, f"{SII}CmnaOrigen").text = emisor_comuna[:20]
    etree.SubElement(emisor, f"{SII}CiudadOrigen").text = emisor_ciudad[:20]

    receptor = etree.SubElement(enc, f"{SII}Receptor")
    etree.SubElement(receptor, f"{SII}RUTRecep").text = "66666666-6"
    etree.SubElement(receptor, f"{SII}RznSocRecep").text = "Sin Nombre"

    totales = etree.SubElement(enc, f"{SII}Totales")
    if monto_afecto_bruto > 0:
        etree.SubElement(totales, f"{SII}MntNeto").text = str(mnt_neto)
    if monto_exento > 0:
        etree.SubElement(totales, f"{SII}MntExe").text = str(monto_exento)
    if monto_afecto_bruto > 0:
        etree.SubElement(totales, f"{SII}IVA").text = str(iva)
    etree.SubElement(totales, f"{SII}MntTotal").text = str(total_int)

    # ── Detalle ───────────────────────────────────────────────────────────
    for idx, item in enumerate(sale.items, start=1):
        det = etree.SubElement(doc, f"{SII}Detalle")
        etree.SubElement(det, f"{SII}NroLinDet").text = str(idx)
        if float(item.tax_rate or 0) == 0:
            etree.SubElement(det, f"{SII}IndExe").text = "1"
        etree.SubElement(det, f"{SII}NmbItem").text = item.product_name[:80]
        etree.SubElement(det, f"{SII}QtyItem").text = str(item.quantity)
        unit = (item_units[idx - 1] if item_units and idx - 1 < len(item_units) else "un") or "un"
        etree.SubElement(det, f"{SII}UnmdItem").text = unit
        etree.SubElement(det, f"{SII}PrcItem").text = str(int(round(float(item.unit_price))))
        etree.SubElement(det, f"{SII}MontoItem").text = str(int(round(float(item.subtotal))))

    # ── Referencias ───────────────────────────────────────────────────────
    if references:
        for nro, ref in enumerate(references, start=1):
            r = etree.SubElement(doc, f"{SII}Referencia")
            etree.SubElement(r, f"{SII}NroLinRef").text = str(nro)
            if ref.get("tipo_doc"):
                etree.SubElement(r, f"{SII}TpoDocRef").text = str(ref["tipo_doc"])
            if ref.get("folio"):
                etree.SubElement(r, f"{SII}FolioRef").text = str(ref["folio"])
            if ref.get("fecha"):
                etree.SubElement(r, f"{SII}FchRef").text = str(ref["fecha"])
            if ref.get("cod_ref"):
                etree.SubElement(r, f"{SII}CodRef").text = str(ref["cod_ref"])
            if ref.get("razon_ref"):
                etree.SubElement(r, f"{SII}RazonRef").text = str(ref["razon_ref"])[:90]

    # ── TED ───────────────────────────────────────────────────────────────
    # TED en namespace SII (schema lo exige). Para que la firma del CAF
    # sobre c14n(DD) verifique en SII, NO usamos el workaround en _c14n —
    # usamos lxml c14n directo, que produce el mismo output con `xmlns=""`
    # en descendientes que SII espera.
    ted = etree.SubElement(doc, f"{SII}TED", version="1.0")
    dd = etree.SubElement(ted, f"{SII}DD")
    etree.SubElement(dd, f"{SII}RE").text = f"{emis_rut}-{emis_dv}"
    etree.SubElement(dd, f"{SII}TD").text = "39"
    etree.SubElement(dd, f"{SII}F").text = str(folio)
    etree.SubElement(dd, f"{SII}FE").text = fecha_emis
    etree.SubElement(dd, f"{SII}RR").text = "66666666-6"
    etree.SubElement(dd, f"{SII}RSR").text = "Sin Nombre"
    etree.SubElement(dd, f"{SII}MNT").text = str(total_int)
    etree.SubElement(dd, f"{SII}IT1").text = sale.items[0].product_name[:40]

    caf_elem = etree.fromstring(caf_xml_bytes)
    dd.append(caf_elem)

    etree.SubElement(dd, f"{SII}TSTED").text = tmst_now

    etree.SubElement(ted, f"{SII}FRMT", algoritmo="SHA1withRSA")

    etree.SubElement(doc, f"{SII}TmstFirma").text = tmst_now

    return dte
