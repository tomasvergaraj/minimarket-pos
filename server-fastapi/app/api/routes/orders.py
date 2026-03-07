from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.session import get_db
from app.models.order import Order, OrderItem, OrderStatus
from app.models.product import Product
from app.schemas.order import OrderCreate, OrderPatch, OrderOut

router = APIRouter(prefix="/orders", tags=["orders"])


def _next_order_number(db: Session) -> int:
    max_num = db.query(func.max(Order.order_number)).scalar() or 0
    return max_num + 1


def _build_items(db: Session, items_in: list) -> list[OrderItem]:
    items = []
    for item_data in items_in:
        product = db.query(Product).filter(Product.id == item_data.product_id).first()
        if not product:
            raise HTTPException(400, f"Product {item_data.product_id} not found")
        items.append(OrderItem(
            product_id=product.id,
            product_name=product.name,
            product_sku=product.sku,
            quantity=item_data.quantity,
            unit_price=float(product.sell_price),
            subtotal=float(product.sell_price) * item_data.quantity,
        ))
    return items


@router.post("/", response_model=OrderOut, status_code=201)
def create_order(data: OrderCreate, db: Session = Depends(get_db)):
    order = Order(
        order_number=_next_order_number(db),
        register_id=data.register_id,
        seller_id=data.seller_id,
        reference=data.reference,
        notes=data.notes,
        status=OrderStatus.OPEN,
    )
    order.items = _build_items(db, data.items)
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


# NOTE: /number/{n} must be defined BEFORE /{order_id} to avoid routing conflicts
@router.get("/number/{order_number}", response_model=OrderOut)
def get_order_by_number(order_number: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.order_number == order_number).first()
    if not order:
        raise HTTPException(404, "Order not found")
    return order


@router.get("/", response_model=list[OrderOut])
def list_orders(
    status: str | None = Query(default=None),
    register_id: str | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(Order)
    if status:
        q = q.filter(Order.status == status)
    if register_id:
        q = q.filter(Order.register_id == register_id)
    return q.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    return order


@router.patch("/{order_id}", response_model=OrderOut)
def patch_order(order_id: str, data: OrderPatch, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    if order.status != OrderStatus.OPEN:
        raise HTTPException(400, "Order is not open")

    if data.items is not None:
        order.items = _build_items(db, data.items)
    if data.reference is not None:
        order.reference = data.reference
    if data.notes is not None:
        order.notes = data.notes
    order.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(order)
    return order


@router.post("/{order_id}/cancel", response_model=OrderOut)
def cancel_order(order_id: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    if order.status == OrderStatus.CLOSED:
        raise HTTPException(400, "Cannot cancel a closed order")
    order.status = OrderStatus.CANCELLED
    order.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(order)
    return order
