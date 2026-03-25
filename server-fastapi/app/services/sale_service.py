from datetime import datetime
import math

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.config import settings
from app.models.customer import Customer
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

    gross_subtotal = 0.0
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

        line_total = unit_price * item_data.quantity
        line_tax = round(line_total * float(product.tax_rate) / (100 + float(product.tax_rate)), 2)

        sale_item = SaleItem(
            product_id=product.id,
            product_name=product.name,
            product_sku=product.sku,
            quantity=item_data.quantity,
            unit_price=unit_price,
            subtotal=line_total,
            tax_rate=float(product.tax_rate),
            tax_amount=line_tax,
            units_per_item=int(product.units_contained) if product.is_pack else 1,
        )
        sale_items.append(sale_item)
        gross_subtotal += line_total
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

    # ── Loyalty: validate points redemption ──
    customer: Customer | None = None
    points_to_redeem = getattr(data, "points_to_redeem", 0) or 0
    discount_amount = 0.0
    if data.customer_id:
        customer = db.query(Customer).filter(Customer.id == data.customer_id, Customer.is_active == True).with_for_update().first()
        if customer and points_to_redeem > 0:
            points_to_redeem = min(points_to_redeem, customer.points_balance)
            discount_amount = round(points_to_redeem * settings.LOYALTY_POINT_VALUE, 2)

    subtotal_before_discount = round(gross_subtotal - tax_total, 2)
    # Apply loyalty discount proportionally against gross (keep tax math consistent)
    gross_after_discount = max(0.0, round(gross_subtotal - discount_amount, 2))
    # Recalculate tax after discount (pro-rata)
    if gross_subtotal > 0:
        tax_factor = tax_total / gross_subtotal
        tax_total = round(gross_after_discount * tax_factor, 2)
    else:
        tax_total = 0.0
    subtotal = round(gross_after_discount - tax_total, 2)
    total = gross_after_discount
    change = 0.0

    payment = PaymentMethod(data.payment_method)
    transfer_amount = getattr(data, "transfer_amount", 0) or 0
    if payment == PaymentMethod.CASH:
        change = data.cash_amount - total
    elif payment == PaymentMethod.MIXED:
        change = (data.cash_amount + data.card_amount + transfer_amount) - total

    # ── Loyalty: compute points earned on final total ──
    points_earned = 0
    if customer:
        points_earned = math.floor(total / 1000) * settings.LOYALTY_POINTS_PER_THOUSAND

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
        transfer_amount=transfer_amount,
        change_amount=max(change, 0),
        status=SaleStatus.COMPLETED,
        customer_id=data.customer_id if customer else None,
        points_earned=points_earned,
        points_redeemed=points_to_redeem,
        discount_amount=discount_amount,
        card_auth_code=data.card_auth_code,
        card_last4=data.card_last4,
    )
    sale.items = sale_items
    db.add(sale)

    # Update cash session totals
    if payment in (PaymentMethod.CASH, PaymentMethod.MIXED):
        session.total_cash_sales = float(session.total_cash_sales or 0) + data.cash_amount - max(change, 0)
    if payment in (PaymentMethod.CARD, PaymentMethod.MIXED):
        session.total_card_sales = float(session.total_card_sales or 0) + data.card_amount
    if payment in (PaymentMethod.TRANSFER, PaymentMethod.MIXED) and transfer_amount > 0:
        session.total_transfer_sales = float(session.total_transfer_sales or 0) + transfer_amount
    session.total_sales_count = (session.total_sales_count or 0) + 1

    db.commit()
    db.refresh(sale)

    # ── Loyalty: update customer balance ──
    if customer:
        customer.points_balance = max(0, customer.points_balance + points_earned - points_to_redeem)
        customer.total_purchases = float(customer.total_purchases or 0) + total
        customer.visit_count = (customer.visit_count or 0) + 1
        db.commit()

    # Link and close any orders (comandas) associated with this sale
    if data.order_ids:
        for oid in data.order_ids:
            order = db.query(Order).filter(Order.id == oid).first()
            if order and order.status == OrderStatus.OPEN:
                order.status = OrderStatus.CLOSED
                order.sale_id = sale.id
        db.commit()

    # ── Stock-low notifications ──
    try:
        from app.services.notification_service import check_stock_alerts_for_products
        sold_stock_ids = list({item.product_id for item in sale_items})
        check_stock_alerts_for_products(db, sold_stock_ids)
        db.commit()
    except Exception:
        pass  # don't break sale on notification failure

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
