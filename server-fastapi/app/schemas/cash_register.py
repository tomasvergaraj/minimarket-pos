from pydantic import BaseModel
from datetime import datetime


class CashRegisterCreate(BaseModel):
    name: str


class CashRegisterOut(BaseModel):
    id: str
    name: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class CashSessionOpen(BaseModel):
    register_id: str
    user_id: str | None = None
    opening_amount: float


class CashSessionClose(BaseModel):
    closing_amount: float


class CashSessionOut(BaseModel):
    id: str
    register_id: str
    user_id: str | None
    status: str
    opening_amount: float
    closing_amount: float | None
    total_cash_sales: float
    total_card_sales: float
    total_sales_count: int
    expected_cash: float | None
    difference: float | None
    opened_at: datetime
    closed_at: datetime | None

    model_config = {"from_attributes": True}
