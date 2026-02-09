from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.sale import SaleCreate, SaleOut
from app.services.sale_service import create_sale, void_sale

router = APIRouter(prefix="/sales", tags=["sales"])


@router.post("/", response_model=SaleOut, status_code=201)
def post_sale(data: SaleCreate, db: Session = Depends(get_db)):
    try:
        sale = create_sale(db, data)
        return sale
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/{sale_id}", response_model=SaleOut)
def get_sale(sale_id: str, db: Session = Depends(get_db)):
    from app.models.sale import Sale
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(404, "Sale not found")
    return sale


@router.post("/{sale_id}/void", response_model=SaleOut)
def post_void_sale(sale_id: str, db: Session = Depends(get_db)):
    try:
        sale = void_sale(db, sale_id)
        return sale
    except ValueError as e:
        raise HTTPException(400, str(e))
