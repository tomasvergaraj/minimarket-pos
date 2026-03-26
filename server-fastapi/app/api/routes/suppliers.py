from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.models.supplier import Supplier
from app.models.user import User
from app.schemas.supplier import SupplierCreate, SupplierOut, SupplierUpdate

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


@router.get("/", response_model=list[SupplierOut])
def list_suppliers(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    q = db.query(Supplier)
    if not include_inactive:
        q = q.filter(Supplier.is_active == True)
    return q.order_by(Supplier.name).all()


@router.post("/", response_model=SupplierOut, status_code=201)
def create_supplier(
    data: SupplierCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    supplier = Supplier(**data.model_dump())
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.get("/{supplier_id}", response_model=SupplierOut)
def get_supplier(
    supplier_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id, Supplier.is_active == True).first()
    if not supplier:
        raise HTTPException(404, "Proveedor no encontrado")
    return supplier


@router.put("/{supplier_id}", response_model=SupplierOut)
def update_supplier(
    supplier_id: str,
    data: SupplierUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(404, "Proveedor no encontrado")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(supplier, field, value)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.delete("/{supplier_id}", status_code=204)
def delete_supplier(
    supplier_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(404, "Proveedor no encontrado")
    # Soft delete: check if has purchase orders
    from app.models.purchase_order import PurchaseOrder
    has_orders = db.query(PurchaseOrder).filter(PurchaseOrder.supplier_id == supplier_id).first()
    if has_orders:
        supplier.is_active = False
        db.commit()
    else:
        db.delete(supplier)
        db.commit()
