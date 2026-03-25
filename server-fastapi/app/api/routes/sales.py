from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin, require_operational_license
from app.db.session import get_db
from app.models.sale import Sale, SaleStatus
from app.models.user import User
from app.schemas.sale import SaleCreate, SaleOut, SaleListResponse
from app.core.config import settings
from app.services.sale_service import create_sale, void_sale
from app.services.audit_service import SALE_VOID, log_action
from app.services.email_service import send_receipt_email
from app.tax.sii.service import background_upload

router = APIRouter(prefix="/sales", tags=["sales"])


@router.post(
    "/",
    response_model=SaleOut,
    status_code=201,
    dependencies=[Depends(require_operational_license)],
)
def post_sale(
    data: SaleCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        sale_data = data.model_copy(update={"seller_id": current_user.id})
        sale, dte_bytes = create_sale(db, sale_data)
        if dte_bytes is not None:
            background_tasks.add_task(background_upload, sale.id, dte_bytes)
        return sale
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/number/{sale_number}", response_model=SaleOut, dependencies=[Depends(get_current_user)])
def get_sale_by_number(sale_number: int, db: Session = Depends(get_db)):
    sale = db.query(Sale).filter(Sale.sale_number == sale_number).first()
    if not sale:
        raise HTTPException(404, "Sale not found")
    return sale


@router.get("/{sale_id}", response_model=SaleOut, dependencies=[Depends(get_current_user)])
def get_sale(sale_id: str, db: Session = Depends(get_db)):
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(404, "Sale not found")
    return sale


@router.get("/", response_model=SaleListResponse, dependencies=[Depends(require_admin)])
def list_sales(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    register_id: str | None = Query(default=None),
    status: SaleStatus | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(Sale)

    if register_id:
        q = q.filter(Sale.register_id == register_id)
    if status:
        q = q.filter(Sale.status == status)
    if date_from:
        q = q.filter(Sale.created_at >= datetime.combine(date_from, time.min))
    if date_to:
        end_date = datetime.combine(date_to + timedelta(days=1), time.min)
        q = q.filter(Sale.created_at < end_date)

    total = q.count()
    sales = q.order_by(Sale.created_at.desc()).offset(skip).limit(limit).all()

    return {
        "success": True,
        "data": sales,
        "error": None,
        "meta": {
            "total": total,
            "skip": skip,
            "limit": limit,
            "has_more": skip + len(sales) < total,
        },
    }


@router.post("/{sale_id}/send-receipt", status_code=204, dependencies=[Depends(get_current_user)])
def post_send_receipt(
    sale_id: str,
    email: str = Body(..., embed=True),
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
):
    if not settings.smtp_configured:
        raise HTTPException(400, "SMTP no configurado en el servidor")
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(404, "Sale not found")
    background_tasks.add_task(send_receipt_email, sale, email)


@router.post("/{sale_id}/void", response_model=SaleOut)
def post_void_sale(
    sale_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:
        sale = void_sale(db, sale_id)
        log_action(
            db,
            action=SALE_VOID,
            entity_type="sale",
            entity_id=sale_id,
            detail={"sale_number": sale.sale_number, "total": float(sale.total)},
            user_id=current_user.id,
            username=current_user.username,
        )
        db.commit()
        return sale
    except ValueError as e:
        raise HTTPException(400, str(e))
