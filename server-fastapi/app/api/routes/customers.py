from datetime import datetime, time

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.core.config import settings
from app.db.session import get_db
from app.models.customer import Customer
from app.models.sale import Sale, SaleStatus
from app.schemas.customer import CustomerCreate, CustomerOut, CustomerUpdate, LoyaltyConfig
from app.schemas.sale import SaleOut

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("/loyalty-config", response_model=LoyaltyConfig)
def get_loyalty_config(_=Depends(get_current_user)):
    return LoyaltyConfig(
        points_per_thousand=settings.LOYALTY_POINTS_PER_THOUSAND,
        point_value=settings.LOYALTY_POINT_VALUE,
    )


@router.get("/search", response_model=list[CustomerOut])
def search_customers(
    q: str = Query(..., min_length=1),
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Search by name, RUT or phone. Used by POS for quick lookup."""
    pattern = f"%{q}%"
    return (
        db.query(Customer)
        .filter(
            Customer.is_active == True,
            or_(
                Customer.name.ilike(pattern),
                Customer.rut.ilike(pattern),
                Customer.phone.ilike(pattern),
            ),
        )
        .limit(limit)
        .all()
    )


@router.get("/", response_model=list[CustomerOut], dependencies=[Depends(require_admin)])
def list_customers(
    search: str | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(Customer).filter(Customer.is_active == True)
    if search:
        pattern = f"%{search}%"
        q = q.filter(
            or_(
                Customer.name.ilike(pattern),
                Customer.rut.ilike(pattern),
                Customer.phone.ilike(pattern),
                Customer.email.ilike(pattern),
            )
        )
    return q.order_by(Customer.name).offset(skip).limit(limit).all()


@router.post("/", response_model=CustomerOut, status_code=201, dependencies=[Depends(require_admin)])
def create_customer(data: CustomerCreate, db: Session = Depends(get_db)):
    if data.rut:
        existing = db.query(Customer).filter(Customer.rut == data.rut).first()
        if existing:
            raise HTTPException(400, f"Ya existe un cliente con RUT {data.rut}")
    customer = Customer(**data.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.get("/{customer_id}", response_model=CustomerOut, dependencies=[Depends(require_admin)])
def get_customer(customer_id: str, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(404, "Cliente no encontrado")
    return customer


@router.put("/{customer_id}", response_model=CustomerOut, dependencies=[Depends(require_admin)])
def update_customer(customer_id: str, data: CustomerUpdate, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(404, "Cliente no encontrado")
    if data.rut and data.rut != customer.rut:
        existing = db.query(Customer).filter(Customer.rut == data.rut, Customer.id != customer_id).first()
        if existing:
            raise HTTPException(400, f"Ya existe un cliente con RUT {data.rut}")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)
    db.commit()
    db.refresh(customer)
    return customer


@router.delete("/{customer_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_customer(customer_id: str, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(404, "Cliente no encontrado")
    has_sales = db.query(Sale).filter(Sale.customer_id == customer_id).first()
    if has_sales:
        customer.is_active = False
    else:
        db.delete(customer)
    db.commit()


@router.get("/{customer_id}/history", response_model=list[SaleOut], dependencies=[Depends(require_admin)])
def get_customer_history(
    customer_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(404, "Cliente no encontrado")
    return (
        db.query(Sale)
        .filter(Sale.customer_id == customer_id, Sale.status == SaleStatus.COMPLETED)
        .order_by(Sale.created_at.desc())
        .limit(limit)
        .all()
    )


@router.post("/{customer_id}/adjust-points", response_model=CustomerOut, dependencies=[Depends(require_admin)])
def adjust_points(
    customer_id: str,
    delta: int = Query(..., description="Puntos a sumar (positivo) o restar (negativo)"),
    db: Session = Depends(get_db),
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(404, "Cliente no encontrado")
    customer.points_balance = max(0, customer.points_balance + delta)
    db.commit()
    db.refresh(customer)
    return customer
