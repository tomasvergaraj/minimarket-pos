from pydantic import BaseModel
from datetime import datetime
from typing import Literal

from app.schemas.common import ApiError


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


class AuthSession(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    user: UserOut


class AuthSessionResponse(BaseModel):
    success: bool = True
    data: AuthSession
    error: ApiError | None = None


class UserUpdate(BaseModel):
    username: str | None = None
    pin: str | None = None
    full_name: str | None = None
    role: Literal["admin", "cashier"] | None = None
    is_active: bool | None = None


class UserResponse(BaseModel):
    success: bool = True
    data: UserOut
    error: ApiError | None = None
