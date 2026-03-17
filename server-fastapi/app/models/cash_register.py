import uuid
from datetime import datetime
from sqlalchemy import String, Numeric, DateTime, Boolean, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
import enum

from app.db.base import Base


class SessionStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"


class CashRegister(Base):
    __tablename__ = "cash_registers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)  # "Caja 1"
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CashSession(Base):
    __tablename__ = "cash_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    register_id: Mapped[str] = mapped_column(String(36), ForeignKey("cash_registers.id"), nullable=False)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)

    status: Mapped[SessionStatus] = mapped_column(SAEnum(SessionStatus), default=SessionStatus.OPEN)
    opening_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    closing_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)

    total_cash_sales: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    total_card_sales: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    total_transfer_sales: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    total_sales_count: Mapped[int] = mapped_column(default=0)

    expected_cash: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    difference: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)

    opened_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
