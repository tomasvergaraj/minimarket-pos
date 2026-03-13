from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin, require_operational_license
from app.db.session import get_db
from app.models.cash_register import CashRegister, CashSession, SessionStatus
from app.models.user import User
from app.services.license_service import LicenseError, ensure_register_capacity
from app.schemas.cash_register import (
    CashRegisterCreate, CashRegisterOut,
    CashSessionOpen, CashSessionClose, CashSessionOut, CashSessionListResponse,
)

router = APIRouter(prefix="/cash", tags=["cash"])


# --- Registers ---

@router.get(
    "/registers",
    response_model=list[CashRegisterOut],
    dependencies=[Depends(get_current_user), Depends(require_operational_license)],
)
def list_registers(db: Session = Depends(get_db)):
    return db.query(CashRegister).filter(CashRegister.is_active == True).all()


@router.post(
    "/registers",
    response_model=CashRegisterOut,
    status_code=201,
    dependencies=[Depends(require_admin), Depends(require_operational_license)],
)
def create_register(data: CashRegisterCreate, db: Session = Depends(get_db)):
    try:
        ensure_register_capacity(db)
    except LicenseError as exc:
        raise HTTPException(403, {"code": exc.code, "message": exc.message}) from exc

    reg = CashRegister(name=data.name)
    db.add(reg)
    db.commit()
    db.refresh(reg)
    return reg


# --- Sessions ---

@router.post(
    "/sessions/open",
    response_model=CashSessionOut,
    status_code=201,
    dependencies=[Depends(require_operational_license)],
)
def open_session(
    data: CashSessionOpen,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = (
        db.query(CashSession)
        .filter(CashSession.register_id == data.register_id, CashSession.status == SessionStatus.OPEN)
        .first()
    )
    if existing:
        raise HTTPException(400, "Register already has an open session")

    session = CashSession(
        register_id=data.register_id,
        user_id=current_user.id,
        opening_amount=data.opening_amount,
        status=SessionStatus.OPEN,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.post(
    "/sessions/{session_id}/close",
    response_model=CashSessionOut,
    dependencies=[Depends(require_operational_license)],
)
def close_session(
    session_id: str,
    data: CashSessionClose,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.query(CashSession).filter(CashSession.id == session_id).with_for_update().first()
    if not session:
        raise HTTPException(404, "Session not found")
    if session.status != SessionStatus.OPEN:
        raise HTTPException(400, "Session is already closed")
    if session.user_id and session.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(403, "Session belongs to another user")

    expected = float(session.opening_amount) + float(session.total_cash_sales or 0)
    session.closing_amount = data.closing_amount
    session.expected_cash = expected
    session.difference = data.closing_amount - expected
    session.status = SessionStatus.CLOSED
    session.closed_at = datetime.utcnow()

    db.commit()
    db.refresh(session)
    return session


@router.get("/sessions", response_model=CashSessionListResponse, dependencies=[Depends(require_admin)])
def list_sessions(
    register_id: str | None = Query(default=None),
    status: SessionStatus | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(CashSession)
    if register_id:
        q = q.filter(CashSession.register_id == register_id)
    if status:
        q = q.filter(CashSession.status == status)
    if date_from:
        q = q.filter(CashSession.opened_at >= datetime.combine(date_from, time.min))
    if date_to:
        end_date = datetime.combine(date_to + timedelta(days=1), time.min)
        q = q.filter(CashSession.opened_at < end_date)

    total = q.count()
    sessions = q.order_by(CashSession.opened_at.desc()).offset(skip).limit(limit).all()

    return {
        "success": True,
        "data": sessions,
        "error": None,
        "meta": {
            "total": total,
            "skip": skip,
            "limit": limit,
            "has_more": skip + len(sessions) < total,
        },
    }


@router.get(
    "/sessions/active",
    response_model=list[CashSessionOut],
    dependencies=[Depends(get_current_user), Depends(require_operational_license)],
)
def list_active_sessions(db: Session = Depends(get_db)):
    return db.query(CashSession).filter(CashSession.status == SessionStatus.OPEN).all()


@router.get(
    "/sessions/{session_id}",
    response_model=CashSessionOut,
    dependencies=[Depends(get_current_user), Depends(require_operational_license)],
)
def get_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(CashSession).filter(CashSession.id == session_id).first()
    if not session:
        raise HTTPException(404, "Session not found")
    return session
