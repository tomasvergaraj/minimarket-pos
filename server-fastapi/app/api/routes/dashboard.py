from datetime import datetime, time, timedelta
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.models.cash_register import CashSession, SessionStatus
from app.models.product import Product
from app.models.sale import Sale, SaleItem, SaleStatus
from app.schemas.dashboard import (
    DashboardStatsResponse,
    HourlyPoint,
    PaymentMethodPoint,
    SalesTrendPoint,
    TopProductAnalyticsOut,
)
from app.services.product_stock import is_below_min_stock

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStatsResponse, dependencies=[Depends(require_admin)])
def get_dashboard_stats(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    start_of_day = datetime.combine(now.date(), time.min)
    end_of_day = start_of_day + timedelta(days=1)

    ventas_hoy = (
        db.query(func.count(Sale.id))
        .filter(
            Sale.status == SaleStatus.COMPLETED,
            Sale.created_at >= start_of_day,
            Sale.created_at < end_of_day,
        )
        .scalar()
        or 0
    )
    ingresos_hoy = (
        db.query(func.coalesce(func.sum(Sale.total), 0))
        .filter(
            Sale.status == SaleStatus.COMPLETED,
            Sale.created_at >= start_of_day,
            Sale.created_at < end_of_day,
        )
        .scalar()
        or 0
    )
    ventas_anuladas = (
        db.query(func.count(Sale.id))
        .filter(
            Sale.status == SaleStatus.VOIDED,
            Sale.created_at >= start_of_day,
            Sale.created_at < end_of_day,
        )
        .scalar()
        or 0
    )
    cajas_abiertas = (
        db.query(func.count(CashSession.id))
        .filter(CashSession.status == SessionStatus.OPEN)
        .scalar()
        or 0
    )
    active_products = db.query(Product).filter(Product.is_active == True).all()
    product_cache = {product.id: product for product in active_products}
    productos_bajo_stock = sum(
        1
        for product in active_products
        if is_below_min_stock(product, db, product_cache)
    )

    top_rows = (
        db.query(
            SaleItem.product_id.label("product_id"),
            SaleItem.product_name.label("product_name"),
            func.sum(SaleItem.quantity).label("quantity_sold"),
            func.sum(SaleItem.subtotal).label("revenue"),
        )
        .join(Sale, Sale.id == SaleItem.sale_id)
        .filter(
            Sale.status == SaleStatus.COMPLETED,
            Sale.created_at >= start_of_day,
            Sale.created_at < end_of_day,
        )
        .group_by(SaleItem.product_id, SaleItem.product_name)
        .order_by(func.sum(SaleItem.quantity).desc())
        .limit(5)
        .all()
    )

    top_5_productos = [
        {
            "product_id": row.product_id,
            "product_name": row.product_name,
            "quantity_sold": int(row.quantity_sold or 0),
            "revenue": float(row.revenue or 0),
        }
        for row in top_rows
    ]

    ticket_promedio = float(ingresos_hoy) / ventas_hoy if ventas_hoy else 0.0

    return {
        "success": True,
        "data": {
            "ventas_hoy": int(ventas_hoy),
            "ingresos_hoy": float(ingresos_hoy),
            "ticket_promedio": round(ticket_promedio, 2),
            "cajas_abiertas": int(cajas_abiertas),
            "productos_bajo_stock": int(productos_bajo_stock),
            "ventas_anuladas": int(ventas_anuladas),
            "top_5_productos": top_5_productos,
        },
        "error": None,
    }


@router.get(
    "/analytics/sales-trend",
    response_model=List[SalesTrendPoint],
    dependencies=[Depends(require_admin)],
)
def get_sales_trend(
    days: int = Query(default=7, ge=1, le=90),
    db: Session = Depends(get_db),
):
    """Daily sales totals for the last N days."""
    now = datetime.utcnow()
    since = datetime.combine((now - timedelta(days=days - 1)).date(), time.min)

    rows = (
        db.query(
            func.date(Sale.created_at).label("day"),
            func.coalesce(func.sum(Sale.total), 0).label("total"),
            func.count(Sale.id).label("count"),
        )
        .filter(
            Sale.status == SaleStatus.COMPLETED,
            Sale.created_at >= since,
        )
        .group_by(func.date(Sale.created_at))
        .order_by(func.date(Sale.created_at))
        .all()
    )

    result_map = {str(row.day): (float(row.total), int(row.count)) for row in rows}
    out: List[SalesTrendPoint] = []
    for i in range(days):
        d = (now - timedelta(days=days - 1 - i)).date()
        key = str(d)
        total, count = result_map.get(key, (0.0, 0))
        out.append(SalesTrendPoint(date=key, total=total, count=count))
    return out


@router.get(
    "/analytics/hourly",
    response_model=List[HourlyPoint],
    dependencies=[Depends(require_admin)],
)
def get_hourly_sales(
    days: int = Query(default=7, ge=1, le=30),
    db: Session = Depends(get_db),
):
    """Average sales volume per hour of day over the last N days."""
    now = datetime.utcnow()
    since = datetime.combine((now - timedelta(days=days - 1)).date(), time.min)

    rows = (
        db.query(
            func.extract("hour", Sale.created_at).label("hour"),
            func.coalesce(func.sum(Sale.total), 0).label("total"),
            func.count(Sale.id).label("count"),
        )
        .filter(
            Sale.status == SaleStatus.COMPLETED,
            Sale.created_at >= since,
        )
        .group_by(func.extract("hour", Sale.created_at))
        .order_by(func.extract("hour", Sale.created_at))
        .all()
    )

    result_map = {int(row.hour): (float(row.total), int(row.count)) for row in rows}
    return [
        HourlyPoint(hour=h, total=result_map.get(h, (0.0, 0))[0], count=result_map.get(h, (0.0, 0))[1])
        for h in range(24)
    ]


@router.get(
    "/analytics/payment-methods",
    response_model=List[PaymentMethodPoint],
    dependencies=[Depends(require_admin)],
)
def get_payment_methods(
    days: int = Query(default=7, ge=1, le=90),
    db: Session = Depends(get_db),
):
    """Totals broken down by payment method for the last N days."""
    now = datetime.utcnow()
    since = datetime.combine((now - timedelta(days=days - 1)).date(), time.min)

    base = db.query(Sale).filter(
        Sale.status == SaleStatus.COMPLETED,
        Sale.created_at >= since,
    )

    rows = (
        db.query(
            func.coalesce(func.sum(Sale.cash_amount), 0).label("cash_total"),
            func.coalesce(func.sum(Sale.card_amount), 0).label("card_total"),
            func.coalesce(func.sum(Sale.transfer_amount), 0).label("transfer_total"),
            func.sum(case((Sale.cash_amount > 0, 1), else_=0)).label("cash_count"),
            func.sum(case((Sale.card_amount > 0, 1), else_=0)).label("card_count"),
            func.sum(case((Sale.transfer_amount > 0, 1), else_=0)).label("transfer_count"),
        )
        .filter(
            Sale.status == SaleStatus.COMPLETED,
            Sale.created_at >= since,
        )
        .one()
    )

    return [
        PaymentMethodPoint(method="cash", total=float(rows.cash_total or 0), count=int(rows.cash_count or 0)),
        PaymentMethodPoint(method="card", total=float(rows.card_total or 0), count=int(rows.card_count or 0)),
        PaymentMethodPoint(method="transfer", total=float(rows.transfer_total or 0), count=int(rows.transfer_count or 0)),
    ]


@router.get(
    "/analytics/top-products",
    response_model=List[TopProductAnalyticsOut],
    dependencies=[Depends(require_admin)],
)
def get_top_products(
    limit: int = Query(default=10, ge=1, le=50),
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    """Top selling products by quantity for the last N days."""
    now = datetime.utcnow()
    since = datetime.combine((now - timedelta(days=days - 1)).date(), time.min)

    rows = (
        db.query(
            SaleItem.product_id.label("product_id"),
            SaleItem.product_name.label("product_name"),
            func.sum(SaleItem.quantity).label("quantity_sold"),
            func.sum(SaleItem.subtotal).label("revenue"),
        )
        .join(Sale, Sale.id == SaleItem.sale_id)
        .filter(
            Sale.status == SaleStatus.COMPLETED,
            Sale.created_at >= since,
        )
        .group_by(SaleItem.product_id, SaleItem.product_name)
        .order_by(func.sum(SaleItem.quantity).desc())
        .limit(limit)
        .all()
    )

    return [
        TopProductAnalyticsOut(
            product_id=row.product_id,
            product_name=row.product_name,
            quantity_sold=int(row.quantity_sold or 0),
            revenue=float(row.revenue or 0),
        )
        for row in rows
    ]
