from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.db.session import get_db
from app.models.table import Table
from app.models.order import Order, OrderStatus
from app.schemas.table import TableCreate, TableUpdate, TableOut, TableStatus

router = APIRouter(prefix="/tables", tags=["tables"])


@router.get("/", response_model=list[TableOut], dependencies=[Depends(get_current_user)])
def list_tables(db: Session = Depends(get_db)):
    return db.query(Table).order_by(Table.pos_y, Table.pos_x).all()


@router.get("/status", response_model=list[TableStatus], dependencies=[Depends(get_current_user)])
def get_tables_status(db: Session = Depends(get_db)):
    tables = db.query(Table).filter(Table.is_active == True).order_by(Table.pos_y, Table.pos_x).all()

    # Fetch all open orders with table_id
    open_orders = (
        db.query(Order)
        .filter(Order.status == OrderStatus.OPEN, Order.table_id.isnot(None))
        .all()
    )
    order_by_table = {o.table_id: o for o in open_orders}

    result = []
    for table in tables:
        order = order_by_table.get(table.id)
        if order is None:
            status = "free"
            order_total = None
            item_count = 0
        elif order.bill_requested:
            status = "bill_requested"
            order_total = float(sum(float(i.subtotal) for i in order.items))
            item_count = len(order.items)
        else:
            status = "occupied"
            order_total = float(sum(float(i.subtotal) for i in order.items))
            item_count = len(order.items)

        result.append(TableStatus(
            id=table.id,
            name=table.name,
            capacity=table.capacity,
            pos_x=table.pos_x,
            pos_y=table.pos_y,
            is_active=table.is_active,
            status=status,
            order_id=order.id if order else None,
            order_number=order.order_number if order else None,
            order_total=order_total,
            opened_at=order.created_at if order else None,
            item_count=item_count,
        ))

    return result


@router.post("/", response_model=TableOut, status_code=201, dependencies=[Depends(require_admin)])
def create_table(data: TableCreate, db: Session = Depends(get_db)):
    table = Table(**data.model_dump())
    db.add(table)
    db.commit()
    db.refresh(table)
    return table


@router.put("/{table_id}", response_model=TableOut, dependencies=[Depends(require_admin)])
def update_table(table_id: str, data: TableUpdate, db: Session = Depends(get_db)):
    table = db.query(Table).filter(Table.id == table_id).first()
    if not table:
        raise HTTPException(404, "Table not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(table, field, value)
    db.commit()
    db.refresh(table)
    return table


@router.delete("/{table_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_table(table_id: str, db: Session = Depends(get_db)):
    table = db.query(Table).filter(Table.id == table_id).first()
    if not table:
        raise HTTPException(404, "Table not found")
    # Check for open orders
    has_open = db.query(Order).filter(Order.table_id == table_id, Order.status == OrderStatus.OPEN).first()
    if has_open:
        raise HTTPException(400, "La mesa tiene una comanda abierta. Ciérrala antes de eliminar.")
    db.delete(table)
    db.commit()
