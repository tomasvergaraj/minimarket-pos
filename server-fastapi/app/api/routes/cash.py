from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.cash_register import CashRegister, CashSession, SessionStatus
from app.schemas.cash_register import (
    CashRegisterCreate, CashRegisterOut,
    CashSessionOpen, CashSessionClose, CashSessionOut,
)

router = APIRouter(prefix="/cash", tags=["cash"])


# --- Registers ---

@router.get("/registers", response_model=list[CashRegisterOut])
def list_registers(db: Session = Depends(get_db)):
    return db.query(CashRegister).filter(CashRegister.is_active == True).all()


@router.post("/registers", response_model=CashRegisterOut, status_code=201)
def create_register(data: CashRegisterCreate, db: Session = Depends(get_db)):
    reg = CashRegister(name=data.name)
    db.add(reg)
    db.commit()
    db.refresh(reg)
    return reg


# --- Sessions ---

@router.post("/sessions/open", response_model=CashSessionOut, status_code=201)
def open_session(data: CashSessionOpen, db: Session = Depends(get_db)):
    existing = (
        db.query(CashSession)
        .filter(CashSession.register_id == data.register_id, CashSession.status == SessionStatus.OPEN)
        .first()
    )
    if existing:
        raise HTTPException(400, "Register already has an open session")

    session = CashSession(
        register_id=data.register_id,
        user_id=data.user_id,
        opening_amount=data.opening_amount,
        status=SessionStatus.OPEN,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.post("/sessions/{session_id}/close", response_model=CashSessionOut)
def close_session(session_id: str, data: CashSessionClose, db: Session = Depends(get_db)):
    session = db.query(CashSession).filter(CashSession.id == session_id).with_for_update().first()
    if not session:
        raise HTTPException(404, "Session not found")
    if session.status != SessionStatus.OPEN:
        raise HTTPException(400, "Session is already closed")

    expected = float(session.opening_amount) + float(session.total_cash_sales or 0)
    session.closing_amount = data.closing_amount
    session.expected_cash = expected
    session.difference = data.closing_amount - expected
    session.status = SessionStatus.CLOSED
    session.closed_at = datetime.utcnow()

    db.commit()
    db.refresh(session)
    return session


@router.get("/sessions/active", response_model=list[CashSessionOut])
def list_active_sessions(db: Session = Depends(get_db)):
    return db.query(CashSession).filter(CashSession.status == SessionStatus.OPEN).all()


@router.get("/sessions/{session_id}", response_model=CashSessionOut)
def get_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(CashSession).filter(CashSession.id == session_id).first()
    if not session:
        raise HTTPException(404, "Session not found")
    return session
