"""Notification service — creation, deduplication, and periodic background checks."""

from datetime import datetime, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.notification import Notification, NotificationType
from app.models.product import Product
from app.models.sale import Sale, SaleItem


def create_notification(
    db: Session,
    type: NotificationType,
    title: str,
    body: str,
    entity_id: str | None = None,
    entity_type: str | None = None,
    dedup_hours: int = 24,
) -> Notification | None:
    """Create a notification. Skips if an identical unread one already exists within dedup_hours."""
    if entity_id:
        cutoff = datetime.utcnow() - timedelta(hours=dedup_hours)
        existing = (
            db.query(Notification)
            .filter(
                Notification.type == type.value,
                Notification.entity_id == entity_id,
                Notification.is_read == False,
                Notification.created_at >= cutoff,
            )
            .first()
        )
        if existing:
            return None

    n = Notification(
        type=type.value,
        title=title,
        body=body,
        entity_id=entity_id,
        entity_type=entity_type,
    )
    db.add(n)
    return n


def check_stock_alerts_for_products(db: Session, product_ids: list[str]) -> None:
    """Check a specific set of products (just sold) for stock-low and create notifications."""
    if not product_ids:
        return
    products = (
        db.query(Product)
        .filter(Product.id.in_(product_ids), Product.is_active == True, Product.min_stock > 0)
        .all()
    )
    for product in products:
        if product.stock < product.min_stock:
            create_notification(
                db,
                NotificationType.stock_low,
                f"Stock bajo: {product.name}",
                f"Stock actual {product.stock} ud. — mínimo configurado {product.min_stock} ud.",
                entity_id=product.id,
                entity_type="product",
                dedup_hours=24,
            )


def run_stock_alerts(db: Session) -> None:
    """Scan ALL active products and create stock-low notifications where needed."""
    products = (
        db.query(Product)
        .filter(Product.is_active == True, Product.min_stock > 0, Product.stock < Product.min_stock)
        .all()
    )
    for product in products:
        create_notification(
            db,
            NotificationType.stock_low,
            f"Stock bajo: {product.name}",
            f"Stock actual {product.stock} ud. — mínimo configurado {product.min_stock} ud.",
            entity_id=product.id,
            entity_type="product",
            dedup_hours=24,
        )
    db.commit()


def run_slow_mover_check(db: Session) -> None:
    """Products with stock > 0 but no sales in the last 30 days."""
    cutoff = datetime.utcnow() - timedelta(days=30)

    sold_ids_subq = (
        db.query(SaleItem.product_id)
        .join(Sale, Sale.id == SaleItem.sale_id)
        .filter(Sale.created_at >= cutoff)
        .distinct()
        .subquery()
    )

    slow_movers = (
        db.query(Product)
        .filter(
            Product.is_active == True,
            Product.stock > 0,
            ~Product.id.in_(sold_ids_subq),
        )
        .limit(20)
        .all()
    )

    for product in slow_movers:
        create_notification(
            db,
            NotificationType.slow_mover,
            f"Sin movimiento: {product.name}",
            f"Sin ventas en los últimos 30 días. Stock: {product.stock} ud.",
            entity_id=product.id,
            entity_type="product",
            dedup_hours=24 * 7,  # once per week per product
        )
    db.commit()


def create_daily_summary(db: Session) -> None:
    """Create a daily summary notification with today's sales figures."""
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    row = (
        db.query(func.count(Sale.id), func.coalesce(func.sum(Sale.total), 0))
        .filter(Sale.created_at >= today_start)
        .first()
    )
    count, total = row if row else (0, 0)

    create_notification(
        db,
        NotificationType.daily_summary,
        "Resumen del día",
        f"{count} venta{'s' if count != 1 else ''} — Total: ${float(total):,.0f}",
        dedup_hours=20,  # one per day
    )
    db.commit()
