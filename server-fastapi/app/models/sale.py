import uuid
from datetime import datetime
import sqlalchemy as sa
from sqlalchemy import String, Integer, Numeric, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.db.base import Base


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    CARD = "card"
    MIXED = "mixed"
    TRANSFER = "transfer"


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

    payment_method: Mapped[PaymentMethod] = mapped_column(SAEnum(PaymentMethod, native_enum=False), nullable=False)
    cash_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    card_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    transfer_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    change_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    status: Mapped[SaleStatus] = mapped_column(SAEnum(SaleStatus), default=SaleStatus.COMPLETED)

    # Fidelización
    customer_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    points_earned: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    points_redeemed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    discount_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)

    # Transbank POS (PINpad)
    card_auth_code: Mapped[str | None] = mapped_column(String(20), nullable=True)   # ej: "123456"
    card_last4: Mapped[str | None] = mapped_column(String(4), nullable=True)        # últimos 4 dígitos

    # SII fields (future boleta electrónica)
    sii_tipo_dte: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 39=boleta
    sii_folio: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sii_rut_receptor: Mapped[str | None] = mapped_column(String(12), nullable=True)
    sii_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    sii_ted_xml: Mapped[str | None] = mapped_column(sa.Text, nullable=True)  # <TED>...</TED> firmado

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
    # How many stock units each sold "item" represents (1 for unit, pack_size for pack)
    units_per_item: Mapped[int] = mapped_column(Integer, default=1)

    sale: Mapped["Sale"] = relationship("Sale", back_populates="items")
