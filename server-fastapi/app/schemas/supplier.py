from pydantic import BaseModel
from datetime import datetime


class SupplierBase(BaseModel):
    name: str
    rut: str | None = None
    contact_name: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    notes: str | None = None


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
    name: str | None = None
    rut: str | None = None
    contact_name: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    notes: str | None = None
    is_active: bool | None = None


class SupplierOut(SupplierBase):
    id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
