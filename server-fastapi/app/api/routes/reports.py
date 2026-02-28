from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.services.report_service import generate_sales_report, generate_inventory_report

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/sales.xlsx", dependencies=[Depends(require_admin)])
def download_sales_report(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    today = date.today()
    start = date_from or today
    end = date_to or today
    output = generate_sales_report(db, start, end)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=ventas_{start}_{end}.xlsx"},
    )


@router.get("/inventory.xlsx", dependencies=[Depends(require_admin)])
def download_inventory_report(db: Session = Depends(get_db)):
    output = generate_inventory_report(db)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=inventario.xlsx"},
    )
