from datetime import datetime
from pydantic import BaseModel


class CustomerBase(BaseModel):
    name: str
    rut: str | None = None
    phone: str | None = None
    email: str | None = None
    notes: str | None = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: str | None = None
    rut: str | None = None
    phone: str | None = None
    email: str | None = None
    notes: str | None = None
    is_active: bool | None = None


class CustomerOut(CustomerBase):
    model_config = {"from_attributes": True}

    id: str
    points_balance: int
    total_purchases: float
    visit_count: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class LoyaltyConfig(BaseModel):
    points_per_thousand: int   # points earned per $1,000 spent
    point_value: int           # CLP value of 1 point when redeeming
