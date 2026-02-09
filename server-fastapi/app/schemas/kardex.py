from pydantic import BaseModel
from datetime import datetime


class KardexCreate(BaseModel):
    product_id: str
    movement_type: str  # sale, restock, adjustment, shrinkage
    quantity: int
    notes: str | None = None
    user_id: str | None = None
    reference_id: str | None = None


class KardexOut(BaseModel):
    id: str
    product_id: str
    movement_type: str
    quantity: int
    stock_before: int
    stock_after: int
    reference_id: str | None
    notes: str | None
    user_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
