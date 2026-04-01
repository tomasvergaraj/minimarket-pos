"""Generate thermal-style PDF receipts using reportlab."""
import io
from zoneinfo import ZoneInfo

from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.platypus.flowables import HRFlowable

from app.core.config import settings


def _clp(value: float) -> str:
    return "$" + f"{int(round(value)):,}".replace(",", ".")


def generate_receipt_pdf(sale) -> bytes:
    """Return raw PDF bytes for a sale receipt."""
    buffer = io.BytesIO()

    PAGE_W = 80 * mm
    PAGE_H = 250 * mm  # generous height; bottom whitespace is acceptable
    MARGIN = 5 * mm

    doc = SimpleDocTemplate(
        buffer,
        pagesize=(PAGE_W, PAGE_H),
        rightMargin=MARGIN,
        leftMargin=MARGIN,
        topMargin=6 * mm,
        bottomMargin=6 * mm,
    )

    center = ParagraphStyle("c", fontName="Helvetica", fontSize=8, leading=10, alignment=TA_CENTER)
    center_b = ParagraphStyle("cb", fontName="Helvetica-Bold", fontSize=10, leading=12, alignment=TA_CENTER)
    center_sm = ParagraphStyle("csm", fontName="Helvetica", fontSize=7, leading=9, alignment=TA_CENTER)
    normal = ParagraphStyle("n", fontName="Helvetica", fontSize=7, leading=9, alignment=TA_LEFT)
    right = ParagraphStyle("r", fontName="Helvetica", fontSize=7, leading=9, alignment=TA_RIGHT)
    right_b = ParagraphStyle("rb", fontName="Helvetica-Bold", fontSize=7, leading=9, alignment=TA_RIGHT)
    normal_b = ParagraphStyle("nb", fontName="Helvetica-Bold", fontSize=7, leading=9, alignment=TA_LEFT)

    W = PAGE_W - 2 * MARGIN  # usable width

    elems = []

    # ── Store header ──────────────────────────────────────────────────────────
    elems.append(Paragraph(settings.STORE_NAME or "Minimarket", center_b))
    if settings.STORE_RUT:
        elems.append(Paragraph(f"RUT: {settings.STORE_RUT}", center_sm))
    if settings.STORE_ADDRESS:
        elems.append(Paragraph(settings.STORE_ADDRESS, center_sm))

    elems.append(Spacer(1, 3 * mm))
    elems.append(HRFlowable(width="100%", thickness=0.5, color=colors.black))
    elems.append(Spacer(1, 2 * mm))

    # ── Sale info ─────────────────────────────────────────────────────────────
    elems.append(Paragraph(f"<b>Boleta N° {sale.sale_number}</b>", center))
    _chile_tz = ZoneInfo("America/Santiago")
    _local_dt = sale.created_at.replace(tzinfo=ZoneInfo("UTC")).astimezone(_chile_tz)
    fecha = _local_dt.strftime("%d/%m/%Y  %H:%M")
    elems.append(Paragraph(fecha, center_sm))

    elems.append(Spacer(1, 3 * mm))
    elems.append(HRFlowable(width="100%", thickness=0.5, color=colors.black))
    elems.append(Spacer(1, 2 * mm))

    # ── Items table ───────────────────────────────────────────────────────────
    col = [W * 0.47, W * 0.08, W * 0.22, W * 0.23]

    rows = [[
        Paragraph("<b>Producto</b>", normal_b),
        Paragraph("<b>Cant</b>", right_b),
        Paragraph("<b>P.Unit</b>", right_b),
        Paragraph("<b>Total</b>", right_b),
    ]]

    for item in sale.items:
        rows.append([
            Paragraph(item.product_name, normal),
            Paragraph(str(item.quantity), right),
            Paragraph(_clp(float(item.unit_price)), right),
            Paragraph(_clp(float(item.subtotal)), right),
        ])

    tbl = Table(rows, colWidths=col, repeatRows=1)
    tbl.setStyle(TableStyle([
        ("FONTSIZE",      (0, 0), (-1, -1), 7),
        ("LEADING",       (0, 0), (-1, -1), 9),
        ("LINEBELOW",     (0, 0), (-1, 0),  0.5, colors.black),
        ("LINEBELOW",     (0, -1), (-1, -1), 0.5, colors.black),
        ("TOPPADDING",    (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elems.append(tbl)
    elems.append(Spacer(1, 2 * mm))

    # ── Totals ────────────────────────────────────────────────────────────────
    net = max(float(sale.total) - float(sale.tax_amount), 0)
    lw, vw = W * 0.58, W * 0.42

    totals = [
        [Paragraph("Subtotal (neto):", normal), Paragraph(_clp(net), right)],
        [Paragraph("IVA (19%):", normal), Paragraph(_clp(float(sale.tax_amount)), right)],
    ]
    if float(sale.discount_amount) > 0:
        totals.append([
            Paragraph("Descuento:", normal),
            Paragraph(f"-{_clp(float(sale.discount_amount))}", right),
        ])
    totals.append([
        Paragraph("<b>TOTAL:</b>", normal_b),
        Paragraph(f"<b>{_clp(float(sale.total))}</b>", right_b),
    ])

    ttbl = Table(totals, colWidths=[lw, vw])
    ttbl.setStyle(TableStyle([
        ("FONTSIZE",      (0, 0), (-1, -1), 7),
        ("LEADING",       (0, 0), (-1, -1), 9),
        ("TOPPADDING",    (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ("LINEABOVE",     (0, -1), (-1, -1), 0.5, colors.black),
    ]))
    elems.append(ttbl)
    elems.append(Spacer(1, 2 * mm))

    # ── Payment ───────────────────────────────────────────────────────────────
    pay_map = {"cash": "Efectivo", "card": "Tarjeta", "transfer": "Transferencia", "mixed": "Pago mixto"}
    elems.append(Paragraph(f"Forma de pago: {pay_map.get(sale.payment_method, sale.payment_method)}", center_sm))
    if float(sale.cash_amount) > 0 and float(sale.change_amount) > 0:
        elems.append(Paragraph(f"Recibido: {_clp(float(sale.cash_amount))}  —  Vuelto: {_clp(float(sale.change_amount))}", center_sm))
    if sale.card_last4:
        elems.append(Paragraph(f"Tarjeta **** {sale.card_last4}", center_sm))

    elems.append(Spacer(1, 3 * mm))
    elems.append(HRFlowable(width="100%", thickness=0.5, color=colors.black))
    elems.append(Spacer(1, 2 * mm))
    elems.append(Paragraph("¡Gracias por su compra!", center_sm))

    doc.build(elems)
    return buffer.getvalue()
