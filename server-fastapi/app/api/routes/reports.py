from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.report_service import generate_sales_report, generate_inventory_report

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/sales.xlsx")
def download_sales_report(
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: Session = Depends(get_db),
):
    output = generate_sales_report(db, date_from, date_to)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=ventas_{date_from}_{date_to}.xlsx"},
    )


@router.get("/inventory.xlsx")
def download_inventory_report(db: Session = Depends(get_db)):
    output = generate_inventory_report(db)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=inventario.xlsx"},
    )
