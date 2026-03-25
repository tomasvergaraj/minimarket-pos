from datetime import datetime
from pydantic import BaseModel


class NotificationOut(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    type: str
    title: str
    body: str
    is_read: bool
    entity_id: str | None
    entity_type: str | None
    created_at: datetime
