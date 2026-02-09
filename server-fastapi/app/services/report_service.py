from io import BytesIO
from datetime import datetime, date

from openpyxl import Workbook
from sqlalchemy.orm import Session

from app.models.sale import Sale, SaleItem, SaleStatus
from app.models.product import Product


def generate_sales_report(db: Session, date_from: date, date_to: date) -> BytesIO:
    wb = Workbook()
    ws = wb.active
    ws.title = "Ventas"

    headers = ["N° Venta", "Fecha", "Método Pago", "Subtotal", "IVA", "Total", "Estado", "Productos"]
    ws.append(headers)

    sales = (
        db.query(Sale)
        .filter(Sale.created_at >= datetime.combine(date_from, datetime.min.time()))
        .filter(Sale.created_at <= datetime.combine(date_to, datetime.max.time()))
        .order_by(Sale.sale_number)
        .all()
    )

    for sale in sales:
        products_str = "; ".join(f"{i.product_name} x{i.quantity}" for i in sale.items)
        ws.append([
            sale.sale_number,
            sale.created_at.strftime("%Y-%m-%d %H:%M"),
            sale.payment_method.value,
            float(sale.subtotal),
            float(sale.tax_amount),
            float(sale.total),
            sale.status.value,
            products_str,
        ])

    # Summary row
    completed = [s for s in sales if s.status == SaleStatus.COMPLETED]
    ws.append([])
    ws.append(["TOTAL COMPLETADAS", "", "", "", "", sum(float(s.total) for s in completed)])

    for col in ws.columns:
        max_length = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[col[0].column_letter].width = min(max_length + 2, 40)

    output = BytesIO()
    wb.save(output)
    output.seek(0)
    return output


def generate_inventory_report(db: Session) -> BytesIO:
    wb = Workbook()
    ws = wb.active
    ws.title = "Inventario"

    headers = ["SKU", "Código Barra", "Nombre", "Categoría", "Stock", "Stock Mín.", "P. Costo", "P. Venta", "Activo"]
    ws.append(headers)

    products = db.query(Product).order_by(Product.name).all()

    for p in products:
        ws.append([
            p.sku,
            p.barcode or "",
            p.name,
            p.category or "",
            p.stock,
            p.min_stock,
            float(p.cost_price),
            float(p.sell_price),
            "Sí" if p.is_active else "No",
        ])

    for col in ws.columns:
        max_length = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[col[0].column_letter].width = min(max_length + 2, 40)

    output = BytesIO()
    wb.save(output)
    output.seek(0)
    return output
