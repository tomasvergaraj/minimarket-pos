from pydantic import BaseModel

from app.schemas.common import ApiError


class ConfigOut(BaseModel):
    store_name: str
    store_rut: str
    store_address: str


class ConfigUpdate(BaseModel):
    store_name: str
    store_rut: str = ""
    store_address: str = ""


class ConfigResponse(BaseModel):
    success: bool = True
    data: ConfigOut
    error: ApiError | None = None
