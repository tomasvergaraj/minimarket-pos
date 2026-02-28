from pydantic import BaseModel


class ApiError(BaseModel):
    code: str
    message: str


class PaginationMeta(BaseModel):
    total: int
    skip: int
    limit: int
    has_more: bool
