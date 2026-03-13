import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class LicenseState(Base):
    __tablename__ = "license_state"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    installation_id: Mapped[str] = mapped_column(String(36), unique=True, nullable=False)
    hardware_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="trial")
    trial_started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    trial_expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    max_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    activated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    license_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    customer_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    license_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    license_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updates_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    max_registers: Mapped[int | None] = mapped_column(Integer, nullable=True)
    features_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    license_payload: Mapped[str | None] = mapped_column(Text, nullable=True)
    license_signature: Mapped[str | None] = mapped_column(Text, nullable=True)
    validation_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
