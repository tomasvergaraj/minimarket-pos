from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.product import Product
from app.models.sale import Sale, SaleItem, PaymentMethod, SaleStatus
from app.models.cash_register import CashSession
from app.models.kardex import KardexEntry, MovementType
from app.schemas.sale import SaleCreate
from app.tax.sii.service import emit_boleta


def create_sale(db: Session, data: SaleCreate) -> tuple[Sale, bytes | None]:
    session = db.query(CashSession).filter(CashSession.id == data.cash_session_id).with_for_update().first()
    if not session or session.status.value != "open":
        raise ValueError("Cash session is not open")

    max_num = db.query(func.max(Sale.sale_number)).scalar() or 0

    subtotal = 0.0
    tax_total = 0.0
    sale_items: list[SaleItem] = []

    for item_data in data.items:
        product = db.query(Product).filter(Product.id == item_data.product_id).with_for_update().first()
        if not product:
            raise ValueError(f"Product {item_data.product_id} not found")
        if product.stock < item_data.quantity:
            raise ValueError(f"Insufficient stock for {product.name}: {product.stock} available")

        line_subtotal = float(product.sell_price) * item_data.quantity
        line_tax = round(line_subtotal * float(product.tax_rate) / (100 + float(product.tax_rate)), 2)

        sale_item = SaleItem(
            product_id=product.id,
            product_name=product.name,
            product_sku=product.sku,
            quantity=item_data.quantity,
            unit_price=float(product.sell_price),
            subtotal=line_subtotal,
            tax_rate=float(product.tax_rate),
            tax_amount=line_tax,
        )
        sale_items.append(sale_item)
        subtotal += line_subtotal
        tax_total += line_tax

        # Update stock
        stock_before = product.stock
        product.stock -= item_data.quantity

        # Kardex entry
        kardex = KardexEntry(
            product_id=product.id,
            movement_type=MovementType.SALE,
            quantity=-item_data.quantity,
            stock_before=stock_before,
            stock_after=product.stock,
            user_id=data.seller_id,
        )
        db.add(kardex)

    total = subtotal
    change = 0.0

    payment = PaymentMethod(data.payment_method)
    if payment == PaymentMethod.CASH:
        change = data.cash_amount - total
    elif payment == PaymentMethod.MIXED:
        change = (data.cash_amount + data.card_amount) - total

    sale = Sale(
        sale_number=max_num + 1,
        cash_session_id=data.cash_session_id,
        register_id=data.register_id,
        seller_id=data.seller_id,
        subtotal=subtotal,
        tax_amount=tax_total,
        total=total,
        payment_method=payment,
        cash_amount=data.cash_amount,
        card_amount=data.card_amount,
        change_amount=max(change, 0),
        status=SaleStatus.COMPLETED,
    )
    sale.items = sale_items
    db.add(sale)

    # Update cash session totals
    if payment in (PaymentMethod.CASH, PaymentMethod.MIXED):
        session.total_cash_sales = float(session.total_cash_sales or 0) + data.cash_amount - max(change, 0)
    if payment in (PaymentMethod.CARD, PaymentMethod.MIXED):
        session.total_card_sales = float(session.total_card_sales or 0) + data.card_amount
    session.total_sales_count = (session.total_sales_count or 0) + 1

    db.commit()
    db.refresh(sale)

    # Emisión DTE (después del commit; sii_status queda en PENDING si OK)
    dte_bytes = emit_boleta(db, sale)
    db.refresh(sale)  # recargar sii_folio/sii_status desde DB tras el commit de emit_boleta

    return sale, dte_bytes


def void_sale(db: Session, sale_id: str) -> Sale:
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise ValueError("Sale not found")

    sale.status = SaleStatus.VOIDED

    for item in sale.items:
        product = db.query(Product).filter(Product.id == item.product_id).with_for_update().first()
        if product:
            stock_before = product.stock
            product.stock += item.quantity
            kardex = KardexEntry(
                product_id=product.id,
                movement_type=MovementType.ADJUSTMENT,
                quantity=item.quantity,
                stock_before=stock_before,
                stock_after=product.stock,
                reference_id=sale_id,
                notes="Sale voided",
            )
            db.add(kardex)

    db.commit()
    db.refresh(sale)
    return sale
