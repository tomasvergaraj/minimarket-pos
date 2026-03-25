from pydantic import BaseModel
from datetime import datetime
from app.models.promotion import PromotionType


class PromotionBase(BaseModel):
    name: str
    promo_type: PromotionType
    product_id: str | None = None
    category_name: str | None = None
    discount_pct: float | None = None
    discount_amount: float | None = None
    buy_qty: int | None = None
    get_qty: int | None = None
    min_qty: int | None = None
    special_price: float | None = None
    is_active: bool = True
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class PromotionCreate(PromotionBase):
    pass


class PromotionUpdate(BaseModel):
    name: str | None = None
    promo_type: PromotionType | None = None
    product_id: str | None = None
    category_name: str | None = None
    discount_pct: float | None = None
    discount_amount: float | None = None
    buy_qty: int | None = None
    get_qty: int | None = None
    min_qty: int | None = None
    special_price: float | None = None
    is_active: bool | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class PromotionOut(PromotionBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
