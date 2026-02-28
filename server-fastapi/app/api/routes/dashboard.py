from datetime import datetime, time, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.models.cash_register import CashSession, SessionStatus
from app.models.product import Product
from app.models.sale import Sale, SaleItem, SaleStatus
from app.schemas.dashboard import DashboardStatsResponse

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
    productos_bajo_stock = (
        db.query(func.count(Product.id))
        .filter(
            Product.is_active == True,
            Product.stock <= Product.min_stock,
        )
        .scalar()
        or 0
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
