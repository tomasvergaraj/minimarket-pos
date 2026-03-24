from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.models.kardex import KardexEntry, MovementType
from app.models.product import Product
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus
from app.models.supplier import Supplier
from app.models.user import User
from app.schemas.purchase_order import (
    PurchaseOrderCreate,
    PurchaseOrderOut,
    PurchaseOrderItemOut,
    PurchaseOrderUpdate,
    ReceivePurchaseOrderInput,
)

router = APIRouter(prefix="/purchases", tags=["purchases"])


def _enrich_order(order: PurchaseOrder, db: Session) -> PurchaseOrderOut:
    """Build PurchaseOrderOut enriched with supplier name and product info."""
    supplier = db.query(Supplier).filter(Supplier.id == order.supplier_id).first()
    items_raw = (
        db.query(PurchaseOrderItem)
        .filter(PurchaseOrderItem.purchase_order_id == order.id)
        .all()
    )
    items_out = []
    for item in items_raw:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        items_out.append(
            PurchaseOrderItemOut(
                id=item.id,
                purchase_order_id=item.purchase_order_id,
                product_id=item.product_id,
                product_name=product.name if product else None,
                product_sku=product.sku if product else None,
                quantity_ordered=item.quantity_ordered,
                quantity_received=item.quantity_received,
                unit_cost=float(item.unit_cost),
                subtotal=float(item.subtotal),
            )
        )
    return PurchaseOrderOut(
        id=order.id,
        order_number=order.order_number,
        supplier_id=order.supplier_id,
        supplier_name=supplier.name if supplier else None,
        status=order.status,
        notes=order.notes,
        subtotal=float(order.subtotal),
        total=float(order.total),
        created_by=order.created_by,
        confirmed_at=order.confirmed_at,
        received_at=order.received_at,
        created_at=order.created_at,
        updated_at=order.updated_at,
        items=items_out,
    )


def _next_order_number(db: Session) -> int:
    result = db.query(func.max(PurchaseOrder.order_number)).scalar()
    return (result or 0) + 1


@router.get("/", response_model=list[PurchaseOrderOut])
def list_purchases(
    supplier_id: str | None = None,
    status: str | None = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    q = db.query(PurchaseOrder)
    if supplier_id:
        q = q.filter(PurchaseOrder.supplier_id == supplier_id)
    if status:
        q = q.filter(PurchaseOrder.status == status)
    orders = q.order_by(PurchaseOrder.created_at.desc()).offset(skip).limit(limit).all()
    return [_enrich_order(o, db) for o in orders]


@router.post("/", response_model=PurchaseOrderOut, status_code=201)
def create_purchase(
    data: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    supplier = db.query(Supplier).filter(Supplier.id == data.supplier_id).first()
    if not supplier:
        raise HTTPException(404, "Proveedor no encontrado")
    if not data.items:
        raise HTTPException(400, "La orden debe tener al menos un ítem")

    subtotal = sum(i.quantity_ordered * i.unit_cost for i in data.items)

    order = PurchaseOrder(
        order_number=_next_order_number(db),
        supplier_id=data.supplier_id,
        notes=data.notes,
        subtotal=subtotal,
        total=subtotal,
        created_by=current_user.id,
    )
    db.add(order)
    db.flush()  # get order.id

    for item_data in data.items:
        product = db.query(Product).filter(Product.id == item_data.product_id).first()
        if not product:
            raise HTTPException(404, f"Producto {item_data.product_id} no encontrado")
        item = PurchaseOrderItem(
            purchase_order_id=order.id,
            product_id=item_data.product_id,
            quantity_ordered=item_data.quantity_ordered,
            unit_cost=item_data.unit_cost,
            subtotal=item_data.quantity_ordered * item_data.unit_cost,
        )
        db.add(item)

    db.commit()
    db.refresh(order)
    return _enrich_order(order, db)


@router.get("/{order_id}", response_model=PurchaseOrderOut)
def get_purchase(
    order_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(404, "Orden de compra no encontrada")
    return _enrich_order(order, db)


@router.put("/{order_id}", response_model=PurchaseOrderOut)
def update_purchase(
    order_id: str,
    data: PurchaseOrderUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(404, "Orden de compra no encontrada")
    if order.status != PurchaseOrderStatus.DRAFT:
        raise HTTPException(400, "Solo se pueden editar órdenes en borrador")

    if data.notes is not None:
        order.notes = data.notes

    if data.items is not None:
        # Replace all items
        db.query(PurchaseOrderItem).filter(
            PurchaseOrderItem.purchase_order_id == order_id
        ).delete()
        subtotal = 0.0
        for item_data in data.items:
            product = db.query(Product).filter(Product.id == item_data.product_id).first()
            if not product:
                raise HTTPException(404, f"Producto {item_data.product_id} no encontrado")
            line_subtotal = item_data.quantity_ordered * item_data.unit_cost
            subtotal += line_subtotal
            item = PurchaseOrderItem(
                purchase_order_id=order.id,
                product_id=item_data.product_id,
                quantity_ordered=item_data.quantity_ordered,
                unit_cost=item_data.unit_cost,
                subtotal=line_subtotal,
            )
            db.add(item)
        order.subtotal = subtotal
        order.total = subtotal

    db.commit()
    db.refresh(order)
    return _enrich_order(order, db)


@router.post("/{order_id}/confirm", response_model=PurchaseOrderOut)
def confirm_purchase(
    order_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(404, "Orden de compra no encontrada")
    if order.status != PurchaseOrderStatus.DRAFT:
        raise HTTPException(400, "La orden no está en estado borrador")

    order.status = PurchaseOrderStatus.CONFIRMED
    order.confirmed_at = datetime.utcnow()
    db.commit()
    db.refresh(order)
    return _enrich_order(order, db)


@router.post("/{order_id}/receive", response_model=PurchaseOrderOut)
def receive_purchase(
    order_id: str,
    data: ReceivePurchaseOrderInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Mark order as received, update stock via Kardex."""
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(404, "Orden de compra no encontrada")
    if order.status == PurchaseOrderStatus.RECEIVED:
        raise HTTPException(400, "La orden ya fue recibida")

    receive_map = {r.item_id: r.quantity_received for r in data.items}

    items = (
        db.query(PurchaseOrderItem)
        .filter(PurchaseOrderItem.purchase_order_id == order_id)
        .all()
    )

    for item in items:
        qty = receive_map.get(item.id, 0)
        if qty <= 0:
            continue
        item.quantity_received = qty

        # Update product stock + kardex
        product = db.query(Product).filter(Product.id == item.product_id).with_for_update().first()
        if not product:
            continue
        stock_before = product.stock
        product.stock += qty
        # Update cost price (simple weighted average is complex; just update if lower)
        if float(item.unit_cost) > 0:
            product.cost_price = float(item.unit_cost)

        kardex = KardexEntry(
            product_id=item.product_id,
            movement_type=MovementType.RESTOCK,
            quantity=qty,
            stock_before=stock_before,
            stock_after=product.stock,
            reference_id=order.id,
            notes=f"OC #{order.order_number}",
            user_id=current_user.id,
        )
        db.add(kardex)

    order.status = PurchaseOrderStatus.RECEIVED
    order.received_at = datetime.utcnow()
    db.commit()
    db.refresh(order)
    return _enrich_order(order, db)


@router.delete("/{order_id}", status_code=204)
def delete_purchase(
    order_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(404, "Orden de compra no encontrada")
    if order.status != PurchaseOrderStatus.DRAFT:
        raise HTTPException(400, "Solo se pueden eliminar órdenes en borrador")
    db.query(PurchaseOrderItem).filter(PurchaseOrderItem.purchase_order_id == order_id).delete()
    db.delete(order)
    db.commit()
