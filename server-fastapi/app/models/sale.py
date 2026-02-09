import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Numeric, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.db.base import Base


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    CARD = "card"
    MIXED = "mixed"


class SaleStatus(str, enum.Enum):
    COMPLETED = "completed"
    VOIDED = "voided"


class Sale(Base):
    __tablename__ = "sales"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sale_number: Mapped[int] = mapped_column(Integer, autoincrement=True, unique=True, index=True)
    cash_session_id: Mapped[str] = mapped_column(String(36), ForeignKey("cash_sessions.id"), nullable=False)
    register_id: Mapped[str] = mapped_column(String(36), ForeignKey("cash_registers.id"), nullable=False)
    seller_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)

    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    tax_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    payment_method: Mapped[PaymentMethod] = mapped_column(SAEnum(PaymentMethod), nullable=False)
    cash_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    card_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    change_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    status: Mapped[SaleStatus] = mapped_column(SAEnum(SaleStatus), default=SaleStatus.COMPLETED)

    # SII fields (future boleta electrónica)
    sii_tipo_dte: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 39=boleta
    sii_folio: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sii_rut_receptor: Mapped[str | None] = mapped_column(String(12), nullable=True)
    sii_status: Mapped[str | None] = mapped_column(String(20), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    items: Mapped[list["SaleItem"]] = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")


class SaleItem(Base):
    __tablename__ = "sale_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sale_id: Mapped[str] = mapped_column(String(36), ForeignKey("sales.id"), nullable=False)
    product_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id"), nullable=False)
    product_name: Mapped[str] = mapped_column(String(200), nullable=False)
    product_sku: Mapped[str] = mapped_column(String(50), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    tax_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=19.0)
    tax_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    sale: Mapped["Sale"] = relationship("Sale", back_populates="items")
