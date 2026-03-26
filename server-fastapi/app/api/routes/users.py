import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.core.config import settings
from app.core.limiter import limiter
from app.core.security import create_access_token, create_refresh_token_value, hash_pin, is_hashed_pin, verify_pin
from app.db.session import get_db
from app.services.audit_service import USER_CREATE, USER_UPDATE, USER_DEACTIVATE, log_action
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.schemas.user import (
    AuthSessionResponse,
    PinLogin,
    RefreshRequest,
    TokenRefreshResponse,
    UserCreate,
    UserOut,
    UserResponse,
    UserUpdate,
)

router = APIRouter(prefix="/users", tags=["users"])
logger = logging.getLogger(__name__)


def _find_user_by_pin(
    db: Session,
    pin: str,
    *,
    exclude_user_id: str | None = None,
    active_only: bool = False,
) -> User | None:
    q = db.query(User).filter(
        or_(
            User.pin == hash_pin(pin),
            User.pin == pin,
        )
    )
    if exclude_user_id:
        q = q.filter(User.id != exclude_user_id)
    if active_only:
        q = q.filter(User.is_active == True)
    return q.first()


@router.get("/", response_model=list[UserOut], dependencies=[Depends(require_admin)])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).filter(User.is_active == True).all()


@router.post("/", response_model=UserOut, status_code=201)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if _find_user_by_pin(db, data.pin):
        raise HTTPException(409, {"code": "PIN_TAKEN", "message": "Ya existe un usuario con ese PIN"})

    payload = data.model_dump()
    payload["pin"] = hash_pin(data.pin)
    new_user = User(**payload)
    db.add(new_user)
    db.flush()
    log_action(
        db,
        action=USER_CREATE,
        entity_type="user",
        entity_id=new_user.id,
        detail={"username": new_user.username, "role": new_user.role},
        user_id=current_user.id,
        username=current_user.username,
    )
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post("/login/pin", response_model=AuthSessionResponse)
@limiter.limit("10/minute")
def login_pin(request: Request, data: PinLogin, db: Session = Depends(get_db)):
    user = _find_user_by_pin(db, data.pin, active_only=True)
    if not user or not verify_pin(data.pin, user.pin):
        raise HTTPException(401, {"code": "INVALID_PIN", "message": "PIN invalido"})

    if not is_hashed_pin(user.pin):
        user.pin = hash_pin(data.pin)
        try:
            db.commit()
            db.refresh(user)
        except SQLAlchemyError:
            db.rollback()
            db.refresh(user)
            logger.exception("Could not upgrade stored PIN hash during login for user %s", user.id)

    access_token, expires_in = create_access_token(user_id=user.id, role=user.role)

    token_value = create_refresh_token_value()
    rt = RefreshToken(
        user_id=user.id,
        token=token_value,
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(rt)
    db.commit()

    return {
        "success": True,
        "data": {
            "access_token": access_token,
            "refresh_token": token_value,
            "token_type": "bearer",
            "expires_in": expires_in,
            "user": user,
        },
        "error": None,
    }


@router.post("/refresh", response_model=TokenRefreshResponse)
def refresh_token(data: RefreshRequest, db: Session = Depends(get_db)):
    now = datetime.utcnow()
    rt = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.token == data.refresh_token,
            RefreshToken.revoked == False,  # noqa: E712
            RefreshToken.expires_at > now,
        )
        .first()
    )
    if not rt:
        raise HTTPException(401, {"code": "INVALID_REFRESH_TOKEN", "message": "Token de refresco inválido o expirado"})

    user = db.query(User).filter(User.id == rt.user_id, User.is_active == True).first()  # noqa: E712
    if not user:
        raise HTTPException(401, {"code": "INVALID_REFRESH_TOKEN", "message": "Usuario no disponible"})

    # Rotate: revoke old, issue new
    rt.revoked = True

    new_token_value = create_refresh_token_value()
    new_rt = RefreshToken(
        user_id=user.id,
        token=new_token_value,
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(new_rt)

    access_token, expires_in = create_access_token(user_id=user.id, role=user.role)
    db.commit()

    return {
        "success": True,
        "data": {
            "access_token": access_token,
            "refresh_token": new_token_value,
            "token_type": "bearer",
            "expires_in": expires_in,
        },
        "error": None,
    }


@router.post("/logout", status_code=204)
def logout(data: RefreshRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rt = db.query(RefreshToken).filter(
        RefreshToken.token == data.refresh_token,
        RefreshToken.user_id == current_user.id,
    ).first()
    if rt:
        rt.revoked = True
        db.commit()


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, {"code": "USER_NOT_FOUND", "message": "User not found"})

    payload = data.model_dump(exclude_unset=True)
    if "username" in payload:
        username_exists = (
            db.query(User)
            .filter(User.username == payload["username"], User.id != user_id)
            .first()
        )
        if username_exists:
            raise HTTPException(409, {"code": "USERNAME_TAKEN", "message": "Username already exists"})
    if "pin" in payload:
        pin_exists = _find_user_by_pin(db, payload["pin"], exclude_user_id=user_id)
        if pin_exists:
            raise HTTPException(409, {"code": "PIN_TAKEN", "message": "Ya existe un usuario con ese PIN"})
        payload["pin"] = hash_pin(payload["pin"])

    for key, value in payload.items():
        setattr(user, key, value)

    was_deactivated = "is_active" in data.model_dump(exclude_unset=True) and not data.is_active  # type: ignore[union-attr]
    log_action(
        db,
        action=USER_DEACTIVATE if was_deactivated else USER_UPDATE,
        entity_type="user",
        entity_id=user_id,
        detail={"changed_fields": list(data.model_dump(exclude_unset=True).keys()), "target_username": user.username},
        user_id=current_user.id,
        username=current_user.username,
    )
    db.commit()
    db.refresh(user)
    return {"success": True, "data": user, "error": None}
