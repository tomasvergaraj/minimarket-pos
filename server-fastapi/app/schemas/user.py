from pydantic import BaseModel
from datetime import datetime


class UserCreate(BaseModel):
    username: str
    pin: str
    full_name: str
    role: str = "cashier"


class UserOut(BaseModel):
    id: str
    username: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class PinLogin(BaseModel):
    pin: str
