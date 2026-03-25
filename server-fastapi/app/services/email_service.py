"""Email receipt service — sends HTML receipts via SMTP."""

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime

from app.core.config import settings
from app.models.sale import Sale


def _build_receipt_html(sale: Sale) -> str:
    store_name = settings.STORE_NAME or "Nexo"
    store_rut = settings.STORE_RUT or ""
    store_address = settings.STORE_ADDRESS or ""
    date_str = sale.created_at.strftime("%d/%m/%Y %H:%M") if sale.created_at else ""

    method_labels = {"cash": "Efectivo", "card": "Tarjeta", "transfer": "Transferencia", "mixed": "Mixto"}
    method_label = method_labels.get(str(sale.payment_method.value if hasattr(sale.payment_method, 'value') else sale.payment_method), "—")

    rows = ""
    for item in (sale.items or []):
        rows += f"""
        <tr>
          <td style="padding:4px 8px;border-bottom:1px solid #eee;">{item.product_name}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:center;">{item.quantity}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${item.unit_price:,.0f}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${item.subtotal:,.0f}</td>
        </tr>"""

    discount_row = ""
    discount_amount = float(getattr(sale, "discount_amount", 0) or 0)
    if discount_amount > 0:
        discount_row = f'<tr><td colspan="3" style="padding:4px 8px;text-align:right;color:#059669;">Descuento puntos</td><td style="padding:4px 8px;text-align:right;color:#059669;">-${discount_amount:,.0f}</td></tr>'

    change_row = ""
    if float(sale.change_amount or 0) > 0:
        change_row = f'<tr><td colspan="3" style="padding:4px 8px;text-align:right;color:#6b7280;">Vuelto</td><td style="padding:4px 8px;text-align:right;color:#6b7280;">${float(sale.change_amount):,.0f}</td></tr>'

    return f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>Boleta #{sale.sale_number}</title></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

    <!-- Header -->
    <div style="background:#4f46e5;color:#fff;padding:24px 28px;">
      <h1 style="margin:0;font-size:22px;font-weight:700;">{store_name}</h1>
      {f'<p style="margin:4px 0 0;font-size:12px;opacity:.8;">RUT: {store_rut}</p>' if store_rut else ''}
      {f'<p style="margin:2px 0 0;font-size:12px;opacity:.8;">{store_address}</p>' if store_address else ''}
    </div>

    <!-- Receipt info -->
    <div style="padding:20px 28px;border-bottom:1px solid #e5e7eb;">
      <table width="100%">
        <tr>
          <td style="font-size:13px;color:#6b7280;">Boleta N°</td>
          <td style="font-size:13px;font-weight:700;text-align:right;">#{sale.sale_number}</td>
        </tr>
        <tr>
          <td style="font-size:13px;color:#6b7280;">Fecha</td>
          <td style="font-size:13px;text-align:right;">{date_str}</td>
        </tr>
        <tr>
          <td style="font-size:13px;color:#6b7280;">Pago</td>
          <td style="font-size:13px;text-align:right;">{method_label}</td>
        </tr>
      </table>
    </div>

    <!-- Items -->
    <div style="padding:16px 28px;">
      <table width="100%" style="font-size:13px;border-collapse:collapse;">
        <thead>
          <tr style="color:#6b7280;font-size:11px;text-transform:uppercase;">
            <th style="padding:4px 8px;text-align:left;">Producto</th>
            <th style="padding:4px 8px;text-align:center;">Cant.</th>
            <th style="padding:4px 8px;text-align:right;">P. unit.</th>
            <th style="padding:4px 8px;text-align:right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {rows}
          {discount_row}
          {change_row}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="padding:12px 8px 4px;font-size:14px;font-weight:700;text-align:right;">TOTAL</td>
            <td style="padding:12px 8px 4px;font-size:18px;font-weight:700;text-align:right;color:#4f46e5;">${float(sale.total):,.0f}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Footer -->
    <div style="padding:16px 28px;background:#f9fafb;text-align:center;font-size:11px;color:#9ca3af;">
      Gracias por su compra · Documento informativo, no válido como boleta tributaria
    </div>
  </div>
</body>
</html>"""


def send_receipt_email(sale: Sale, to_email: str) -> None:
    """Send HTML receipt to the given email. Raises on error."""
    if not settings.smtp_configured:
        raise ValueError("SMTP no configurado en el servidor")

    from_name = settings.SMTP_FROM_NAME or settings.STORE_NAME or "Nexo"
    from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USER

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Tu boleta #{sale.sale_number} de {from_name}"
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = to_email

    html = _build_receipt_html(sale)
    msg.attach(MIMEText(html, "html", "utf-8"))

    if settings.SMTP_USE_TLS:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(from_email, [to_email], msg.as_bytes())
    else:
        with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(from_email, [to_email], msg.as_bytes())
