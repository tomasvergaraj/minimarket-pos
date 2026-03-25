from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.limiter import limiter
from app.db.session import get_db
from app.schemas.license import LicenseActivateRequest, LicenseStatusResponse
from app.services.license_service import LicenseError, activate_license_document, get_license_status

router = APIRouter(prefix="/license", tags=["license"])


@router.get("/status", response_model=LicenseStatusResponse, dependencies=[Depends(require_admin)])
def license_status(db: Session = Depends(get_db)):
    return {
        "success": True,
        "data": get_license_status(db),
        "error": None,
    }


@router.post("/activate", response_model=LicenseStatusResponse, dependencies=[Depends(require_admin)])
@limiter.limit("5/minute")
def activate_license(request: Request, data: LicenseActivateRequest, db: Session = Depends(get_db)):
    try:
        status = activate_license_document(db, data.license_document)
    except LicenseError as exc:
        raise HTTPException(400, {"code": exc.code, "message": exc.message}) from exc

    return {
        "success": True,
        "data": status,
        "error": None,
    }
