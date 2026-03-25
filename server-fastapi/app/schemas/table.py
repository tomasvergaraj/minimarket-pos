from datetime import datetime
from pydantic import BaseModel


class TableCreate(BaseModel):
    name: str
    capacity: int = 4
    pos_x: int = 0
    pos_y: int = 0


class TableUpdate(BaseModel):
    name: str | None = None
    capacity: int | None = None
    pos_x: int | None = None
    pos_y: int | None = None
    is_active: bool | None = None


class TableOut(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    name: str
    capacity: int
    pos_x: int
    pos_y: int
    is_active: bool
    created_at: datetime


class TableStatus(BaseModel):
    """Table enriched with its current open order info."""
    id: str
    name: str
    capacity: int
    pos_x: int
    pos_y: int
    is_active: bool
    # Derived from current open order
    status: str  # "free" | "occupied" | "bill_requested"
    order_id: str | None
    order_number: int | None
    order_total: float | None
    opened_at: datetime | None
    item_count: int
