from pydantic import BaseModel

from app.schemas.common import ApiError


class TopProductOut(BaseModel):
    product_id: str
    product_name: str
    quantity_sold: int
    revenue: float


class DashboardStatsOut(BaseModel):
    ventas_hoy: int
    ingresos_hoy: float
    ticket_promedio: float
    cajas_abiertas: int
    productos_bajo_stock: int
    ventas_anuladas: int
    top_5_productos: list[TopProductOut]


class DashboardStatsResponse(BaseModel):
    success: bool = True
    data: DashboardStatsOut
    error: ApiError | None = None


# ── Analytics schemas ──

class SalesTrendPoint(BaseModel):
    date: str          # "YYYY-MM-DD"
    total: float
    count: int


class HourlyPoint(BaseModel):
    hour: int          # 0–23
    total: float
    count: int


class PaymentMethodPoint(BaseModel):
    method: str        # "cash" | "card" | "transfer"
    total: float
    count: int


class TopProductAnalyticsOut(BaseModel):
    product_id: str
    product_name: str
    quantity_sold: int
    revenue: float
