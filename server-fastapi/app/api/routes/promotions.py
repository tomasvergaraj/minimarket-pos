from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.models.promotion import Promotion
from app.models.user import User
from app.schemas.promotion import PromotionCreate, PromotionOut, PromotionUpdate

router = APIRouter(prefix="/promotions", tags=["promotions"])


def _is_currently_active(promo: Promotion) -> bool:
    if not promo.is_active:
        return False
    now = datetime.utcnow()
    if promo.starts_at and promo.starts_at > now:
        return False
    if promo.ends_at and promo.ends_at < now:
        return False
    return True


@router.get("/", response_model=list[PromotionOut], dependencies=[Depends(require_admin)])
def list_promotions(db: Session = Depends(get_db)):
    return db.query(Promotion).order_by(Promotion.created_at.desc()).all()


@router.get("/active", response_model=list[PromotionOut])
def list_active_promotions(db: Session = Depends(get_db)):
    """Returns currently active promotions. Used by POS without admin auth."""
    now = datetime.utcnow()
    promos = (
        db.query(Promotion)
        .filter(
            Promotion.is_active == True,
            (Promotion.starts_at == None) | (Promotion.starts_at <= now),
            (Promotion.ends_at == None) | (Promotion.ends_at >= now),
        )
        .all()
    )
    return promos


@router.post("/", response_model=PromotionOut, status_code=201)
def create_promotion(
    data: PromotionCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    promo = Promotion(**data.model_dump())
    db.add(promo)
    db.commit()
    db.refresh(promo)
    return promo


@router.get("/{promo_id}", response_model=PromotionOut, dependencies=[Depends(require_admin)])
def get_promotion(promo_id: str, db: Session = Depends(get_db)):
    promo = db.query(Promotion).filter(Promotion.id == promo_id).first()
    if not promo:
        raise HTTPException(404, "Promoción no encontrada")
    return promo


@router.put("/{promo_id}", response_model=PromotionOut)
def update_promotion(
    promo_id: str,
    data: PromotionUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    promo = db.query(Promotion).filter(Promotion.id == promo_id).first()
    if not promo:
        raise HTTPException(404, "Promoción no encontrada")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(promo, field, value)
    db.commit()
    db.refresh(promo)
    return promo


@router.delete("/{promo_id}", status_code=204)
def delete_promotion(
    promo_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    promo = db.query(Promotion).filter(Promotion.id == promo_id).first()
    if not promo:
        raise HTTPException(404, "Promoción no encontrada")
    db.delete(promo)
    db.commit()
