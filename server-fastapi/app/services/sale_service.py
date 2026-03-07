from datetime import datetime

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.product import Product
from app.models.sale import Sale, SaleItem, PaymentMethod, SaleStatus
from app.models.cash_register import CashSession
from app.models.kardex import KardexEntry, MovementType
from app.models.order import Order, OrderStatus
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

        # Determine which product owns the stock
        units_to_deduct = item_data.quantity
        if product.is_pack and product.base_product_id:
            stock_product = db.query(Product).filter(
                Product.id == product.base_product_id
            ).with_for_update().first()
            if not stock_product:
                raise ValueError(f"Producto base no encontrado para {product.name}")
            units_to_deduct = item_data.quantity * max(int(product.units_contained), 1)
        else:
            stock_product = product

        if stock_product.stock < units_to_deduct:
            raise ValueError(
                f"Stock insuficiente para {product.name}: "
                f"{stock_product.stock // max(int(product.units_contained), 1)} disponibles"
            )

        # Effective unit price: override → active discount → regular price
        if item_data.unit_price_override is not None:
            unit_price = float(item_data.unit_price_override)
        elif (product.discount_price and float(product.discount_price) > 0 and
              (product.discount_ends_at is None or product.discount_ends_at > datetime.utcnow())):
            unit_price = float(product.discount_price)
        else:
            unit_price = float(product.sell_price)

        line_subtotal = unit_price * item_data.quantity
        line_tax = round(line_subtotal * float(product.tax_rate) / (100 + float(product.tax_rate)), 2)

        sale_item = SaleItem(
            product_id=product.id,
            product_name=product.name,
            product_sku=product.sku,
            quantity=item_data.quantity,
            unit_price=unit_price,
            subtotal=line_subtotal,
            tax_rate=float(product.tax_rate),
            tax_amount=line_tax,
            units_per_item=int(product.units_contained) if product.is_pack else 1,
        )
        sale_items.append(sale_item)
        subtotal += line_subtotal
        tax_total += line_tax

        stock_before = stock_product.stock
        stock_product.stock -= units_to_deduct

        kardex = KardexEntry(
            product_id=stock_product.id,
            movement_type=MovementType.SALE,
            quantity=-units_to_deduct,
            stock_before=stock_before,
            stock_after=stock_product.stock,
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

    # Link and close any orders (comandas) associated with this sale
    if data.order_ids:
        for oid in data.order_ids:
            order = db.query(Order).filter(Order.id == oid).first()
            if order and order.status == OrderStatus.OPEN:
                order.status = OrderStatus.CLOSED
                order.sale_id = sale.id
        db.commit()

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
            units_restored = item.quantity * (item.units_per_item or 1)
            # Restore to the correct stock owner (base product for packs)
            stock_product = product
            if product.is_pack and product.base_product_id:
                bp = db.query(Product).filter(Product.id == product.base_product_id).with_for_update().first()
                if bp:
                    stock_product = bp
            stock_before = stock_product.stock
            stock_product.stock += units_restored
            kardex = KardexEntry(
                product_id=stock_product.id,
                movement_type=MovementType.ADJUSTMENT,
                quantity=units_restored,
                stock_before=stock_before,
                stock_after=stock_product.stock,
                reference_id=sale_id,
                notes="Sale voided",
            )
            db.add(kardex)

    db.commit()
    db.refresh(sale)
    return sale
