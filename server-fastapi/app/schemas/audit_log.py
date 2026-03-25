from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AuditLogOut(BaseModel):
    id: str
    timestamp: datetime
    user_id: str | None
    username: str | None
    action: str
    entity_type: str
    entity_id: str | None
    detail: str | None
    ip_address: str | None

    model_config = {"from_attributes": True}
