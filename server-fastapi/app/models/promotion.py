import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Integer, Numeric, DateTime, Boolean, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PromotionType(str, enum.Enum):
    PERCENTAGE = "percentage_discount"
    FIXED = "fixed_discount"
    BUY_N_GET_M = "buy_n_get_m"
    MIN_QUANTITY = "min_quantity"


class Promotion(Base):
    __tablename__ = "promotions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    promo_type: Mapped[PromotionType] = mapped_column(
        SAEnum(PromotionType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )

    # Scope — null means "applies to all"
    product_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("products.id", ondelete="CASCADE"), nullable=True
    )
    category_name: Mapped[str | None] = mapped_column(String(100), nullable=True)  # null = global

    # Parameters (only relevant fields are used per type)
    discount_pct: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)    # PERCENTAGE: 0-100
    discount_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)  # FIXED: amount
    buy_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)   # BUY_N_GET_M: N
    get_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)   # BUY_N_GET_M: M free
    min_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)   # MIN_QUANTITY: threshold
    special_price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)  # MIN_QUANTITY: unit price

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
