from pydantic import BaseModel

from app.schemas.common import ApiError


class ConfigOut(BaseModel):
    store_name: str
    store_rut: str
    store_address: str
    business_type: str = "minimarket"


class ConfigUpdate(BaseModel):
    store_name: str
    store_rut: str = ""
    store_address: str = ""
    business_type: str = "minimarket"


class ConfigResponse(BaseModel):
    success: bool = True
    data: ConfigOut
    error: ApiError | None = None
