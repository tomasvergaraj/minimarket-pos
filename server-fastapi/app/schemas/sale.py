from pydantic import BaseModel
from datetime import datetime


class SaleItemCreate(BaseModel):
    product_id: str
    quantity: int


class SaleCreate(BaseModel):
    cash_session_id: str
    register_id: str
    seller_id: str | None = None
    payment_method: str  # cash, card, mixed
    cash_amount: float = 0
    card_amount: float = 0
    items: list[SaleItemCreate]


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
    created_at: datetime
    items: list[SaleItemOut]

    model_config = {"from_attributes": True}
