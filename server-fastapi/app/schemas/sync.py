from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SyncLogOut(BaseModel):
    id: int
    branch_id: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    status: str
    tables_synced: int
    records_synced: int
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class SyncStatus(BaseModel):
    configured: bool
    branch_id: str
    last_sync: Optional[SyncLogOut] = None
    recent_logs: list[SyncLogOut] = []


class SyncConfigOut(BaseModel):
    supabase_url: str
    supabase_key_masked: str
    branch_id: str
    sync_enabled: bool


class SyncConfigUpdate(BaseModel):
    supabase_url: str
    supabase_key: str
    branch_id: str
