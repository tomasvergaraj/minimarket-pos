from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.models.product import Product
from app.models.kardex import KardexEntry, MovementType
from app.models.user import User
from app.schemas.kardex import KardexCreate, KardexOut

router = APIRouter(prefix="/kardex", tags=["kardex"])


@router.post("/", response_model=KardexOut, status_code=201)
def create_movement(
    data: KardexCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    product = db.query(Product).filter(Product.id == data.product_id).with_for_update().first()
    if not product:
        raise HTTPException(404, "Product not found")

    movement = MovementType(data.movement_type)

    # Pack products don't own their own stock — their effective stock is derived as
    # base_product.stock // units_contained.  So we must adjust the base product instead,
    # scaling the quantity by units_contained.
    if product.is_pack and product.base_product_id:
        base_product = (
            db.query(Product)
            .filter(Product.id == product.base_product_id)
            .with_for_update()
            .first()
        )
        if not base_product:
            raise HTTPException(404, "Base product not found")

        units = max(int(product.units_contained), 1)
        effective_qty = abs(data.quantity) * units

        stock_before = base_product.stock
        if movement == MovementType.RESTOCK:
            base_product.stock += effective_qty
        elif movement == MovementType.SHRINKAGE:
            base_product.stock -= effective_qty
        elif movement == MovementType.ADJUSTMENT:
            base_product.stock += data.quantity * units
        else:
            raise HTTPException(400, "Use sales endpoint for sale movements")

        note = f"[Pack: {product.name} ×{data.quantity}] {data.notes or ''}".strip()
        entry = KardexEntry(
            product_id=base_product.id,
            movement_type=movement,
            quantity=effective_qty,
            stock_before=stock_before,
            stock_after=base_product.stock,
            reference_id=data.reference_id,
            notes=note,
            user_id=current_user.id,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return entry

    # Regular (non-pack) product
    stock_before = product.stock

    if movement == MovementType.RESTOCK:
        product.stock += abs(data.quantity)
    elif movement == MovementType.SHRINKAGE:
        product.stock -= abs(data.quantity)
    elif movement == MovementType.ADJUSTMENT:
        product.stock += data.quantity  # can be +/-
    else:
        raise HTTPException(400, "Use sales endpoint for sale movements")

    entry = KardexEntry(
        product_id=data.product_id,
        movement_type=movement,
        quantity=data.quantity,
        stock_before=stock_before,
        stock_after=product.stock,
        reference_id=data.reference_id,
        notes=data.notes,
        user_id=current_user.id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/product/{product_id}", response_model=list[KardexOut], dependencies=[Depends(require_admin)])
def get_product_kardex(product_id: str, limit: int = 50, db: Session = Depends(get_db)):
    return (
        db.query(KardexEntry)
        .filter(KardexEntry.product_id == product_id)
        .order_by(KardexEntry.created_at.desc())
        .limit(limit)
        .all()
    )
