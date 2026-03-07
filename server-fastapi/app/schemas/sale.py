from pydantic import BaseModel
from datetime import datetime

from app.schemas.common import ApiError, PaginationMeta


class SaleItemCreate(BaseModel):
    product_id: str
    quantity: int
    unit_price_override: float | None = None  # override price (e.g. manual discount)


class SaleCreate(BaseModel):
    cash_session_id: str
    register_id: str
    seller_id: str | None = None
    payment_method: str  # cash, card, mixed
    cash_amount: float = 0
    card_amount: float = 0
    items: list[SaleItemCreate]
    # Optional: IDs of open orders (comandas) to link/close with this sale
    order_ids: list[str] | None = None


class SaleItemOut(BaseModel):
    id: str
    product_id: str
    product_name: str
    product_sku: str
    quantity: int
    unit_price: float
    subtotal: float
    tax_rate: float
    tax_amount: float
    units_per_item: int = 1

    model_config = {"from_attributes": True}


class SaleOut(BaseModel):
    id: str
    sale_number: int
    cash_session_id: str
    register_id: str
    seller_id: str | None
    subtotal: float
    tax_amount: float
    total: float
    payment_method: str
    cash_amount: float
    card_amount: float
    change_amount: float
    status: str
    # Campos SII (None cuando la integración no está activa)
    sii_tipo_dte: int | None = None
    sii_folio: int | None = None
    sii_rut_receptor: str | None = None
    sii_status: str | None = None
    sii_ted_xml: str | None = None
    created_at: datetime
    items: list[SaleItemOut]

    model_config = {"from_attributes": True}


class SaleListResponse(BaseModel):
    success: bool = True
    data: list[SaleOut]
    error: ApiError | None = None
    meta: PaginationMeta
