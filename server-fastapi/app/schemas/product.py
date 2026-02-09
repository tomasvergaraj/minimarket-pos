from pydantic import BaseModel
from datetime import datetime


class ProductBase(BaseModel):
    sku: str
    barcode: str | None = None
    name: str
    description: str | None = None
    category: str | None = None
    unit: str = "un"
    cost_price: float = 0
    sell_price: float
    tax_rate: float = 19.0
    min_stock: int = 0


class ProductCreate(ProductBase):
    stock: int = 0


class ProductUpdate(BaseModel):
    sku: str | None = None
    barcode: str | None = None
    name: str | None = None
    description: str | None = None
    category: str | None = None
    unit: str | None = None
    cost_price: float | None = None
    sell_price: float | None = None
    tax_rate: float | None = None
    min_stock: int | None = None
    is_active: bool | None = None


class ProductOut(ProductBase):
    id: str
    stock: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
