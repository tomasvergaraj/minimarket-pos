import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Numeric, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Product(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sku: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    barcode: Mapped[str | None] = mapped_column(String(50), unique=True, index=True, nullable=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    unit: Mapped[str] = mapped_column(String(20), default="un")  # un, kg, lt
    cost_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    sell_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    tax_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=19.0)  # IVA Chile 19%
    stock: Mapped[int] = mapped_column(Integer, default=0)
    min_stock: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Pack / presentation: links to a base product whose stock is deducted
    is_pack: Mapped[bool] = mapped_column(Boolean, default=False)
    units_contained: Mapped[int] = mapped_column(Integer, default=1)  # base units per sale of this item
    base_product_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("products.id", ondelete="SET NULL"), nullable=True
    )

    # Legacy columns (kept for DB compatibility, not used in business logic)
    pack_size: Mapped[int] = mapped_column(Integer, default=1)
    pack_price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)

    # Oferta / discount
    discount_price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    discount_ends_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
