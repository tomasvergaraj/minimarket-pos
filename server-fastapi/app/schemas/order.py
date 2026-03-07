from pydantic import BaseModel
from datetime import datetime


class OrderItemIn(BaseModel):
    product_id: str
    quantity: int


class OrderCreate(BaseModel):
    register_id: str
    seller_id: str | None = None
    reference: str | None = None
    notes: str | None = None
    items: list[OrderItemIn] = []


class OrderPatch(BaseModel):
    """Partial update: replace items and/or reference/notes."""
    items: list[OrderItemIn] | None = None
    reference: str | None = None
    notes: str | None = None


class OrderItemOut(BaseModel):
    id: str
    product_id: str
    product_name: str
    product_sku: str
    quantity: int
    unit_price: float
    subtotal: float

    model_config = {"from_attributes": True}


class OrderOut(BaseModel):
    id: str
    order_number: int
    register_id: str
    seller_id: str | None
    status: str
    reference: str | None
    notes: str | None
    sale_id: str | None
    created_at: datetime
    updated_at: datetime
    items: list[OrderItemOut]

    model_config = {"from_attributes": True}
