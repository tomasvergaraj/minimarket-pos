import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Integer, Numeric, DateTime, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PurchaseOrderStatus(str, enum.Enum):
    DRAFT = "draft"           # borrador — editable
    CONFIRMED = "confirmed"   # confirmada — enviada al proveedor
    RECEIVED = "received"     # recibida — stock actualizado


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_number: Mapped[int] = mapped_column(Integer, nullable=False)  # auto-incremental por app
    supplier_id: Mapped[str] = mapped_column(String(36), ForeignKey("suppliers.id"), nullable=False)
    status: Mapped[PurchaseOrderStatus] = mapped_column(
        SAEnum(PurchaseOrderStatus), default=PurchaseOrderStatus.DRAFT, nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    created_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    received_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    purchase_order_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False
    )
    product_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id"), nullable=False)
    quantity_ordered: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_received: Mapped[int] = mapped_column(Integer, default=0)
    unit_cost: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)  # quantity_ordered * unit_cost
