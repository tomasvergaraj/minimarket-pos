from pydantic import BaseModel, computed_field
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
    # Pack / presentación
    is_pack: bool = False
    units_contained: int = 1       # base units per sale of this item
    base_product_id: str | None = None
    # Oferta / descuento
    discount_price: float | None = None
    discount_ends_at: datetime | None = None


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
    is_pack: bool | None = None
    units_contained: int | None = None
    base_product_id: str | None = None
    discount_price: float | None = None
    discount_ends_at: datetime | None = None


class ProductOut(ProductBase):
    id: str
    stock: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def is_on_offer(self) -> bool:
        """True when discount_price is active (not expired)."""
        if not self.discount_price or self.discount_price <= 0:
            return False
        if self.discount_ends_at is None:
            return True
        return self.discount_ends_at > datetime.utcnow()

    model_config = {"from_attributes": True}
