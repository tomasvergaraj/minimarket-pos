from pydantic import BaseModel
from datetime import datetime
from app.models.purchase_order import PurchaseOrderStatus


class PurchaseOrderItemCreate(BaseModel):
    product_id: str
    quantity_ordered: int
    unit_cost: float


class PurchaseOrderItemOut(BaseModel):
    id: str
    purchase_order_id: str
    product_id: str
    product_name: str | None = None
    product_sku: str | None = None
    quantity_ordered: int
    quantity_received: int
    unit_cost: float
    subtotal: float

    model_config = {"from_attributes": True}


class PurchaseOrderCreate(BaseModel):
    supplier_id: str
    notes: str | None = None
    items: list[PurchaseOrderItemCreate]


class PurchaseOrderUpdate(BaseModel):
    notes: str | None = None
    items: list[PurchaseOrderItemCreate] | None = None


class PurchaseOrderOut(BaseModel):
    id: str
    order_number: int
    supplier_id: str
    supplier_name: str | None = None
    status: PurchaseOrderStatus
    notes: str | None = None
    subtotal: float
    total: float
    created_by: str | None = None
    confirmed_at: datetime | None = None
    received_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    items: list[PurchaseOrderItemOut] = []

    model_config = {"from_attributes": True}


class ReceiveItemInput(BaseModel):
    item_id: str
    quantity_received: int


class ReceivePurchaseOrderInput(BaseModel):
    items: list[ReceiveItemInput]
