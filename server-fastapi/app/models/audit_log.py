import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(
        sa.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    timestamp: Mapped[datetime] = mapped_column(
        sa.DateTime, nullable=False, default=datetime.utcnow, index=True
    )
    user_id: Mapped[str | None] = mapped_column(sa.String(36), nullable=True, index=True)
    username: Mapped[str | None] = mapped_column(sa.String(100), nullable=True)
    action: Mapped[str] = mapped_column(sa.String(50), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(sa.String(50), nullable=False, index=True)
    entity_id: Mapped[str | None] = mapped_column(sa.String(36), nullable=True)
    detail: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(sa.String(50), nullable=True)
