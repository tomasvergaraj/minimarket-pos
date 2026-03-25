from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SyncLog(Base):
    __tablename__ = "sync_logs"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    branch_id: Mapped[str] = mapped_column(sa.String(100), nullable=False, default="default")
    started_at: Mapped[datetime] = mapped_column(sa.DateTime, nullable=False, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(sa.DateTime, nullable=True)
    # "running" | "success" | "error" | "skipped"
    status: Mapped[str] = mapped_column(sa.String(20), nullable=False, default="running")
    tables_synced: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=0)
    records_synced: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=0)
    error_message: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
