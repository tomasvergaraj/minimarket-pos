import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
import enum

from app.db.base import Base


class MovementType(str, enum.Enum):
    SALE = "sale"
    RESTOCK = "restock"
    ADJUSTMENT = "adjustment"
    SHRINKAGE = "shrinkage"  # merma


class KardexEntry(Base):
    __tablename__ = "kardex"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id"), nullable=False)
    movement_type: Mapped[MovementType] = mapped_column(SAEnum(MovementType), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)  # positive=in, negative=out
    stock_before: Mapped[int] = mapped_column(Integer, nullable=False)
    stock_after: Mapped[int] = mapped_column(Integer, nullable=False)
    reference_id: Mapped[str | None] = mapped_column(String(36), nullable=True)  # sale_id, etc.
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
