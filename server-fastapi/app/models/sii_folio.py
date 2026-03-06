import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SIIFolioCounter(Base):
    """
    Contador de folios DTE por tipo (uno por tipo_dte=39).

    current_folio arranca en caf_desde - 1.
    next_folio() en caf.py hace SELECT FOR UPDATE y luego flush,
    garantizando que dos cajas concurrentes nunca reciban el mismo folio.
    """
    __tablename__ = "sii_folio_counters"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tipo_dte: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    caf_desde: Mapped[int] = mapped_column(Integer, nullable=False)
    caf_hasta: Mapped[int] = mapped_column(Integer, nullable=False)
    current_folio: Mapped[int] = mapped_column(Integer, nullable=False)
    caf_xml_path: Mapped[str] = mapped_column(String(500), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
