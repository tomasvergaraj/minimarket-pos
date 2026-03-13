from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.security import create_access_token, hash_pin, is_hashed_pin, verify_pin
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import (
    AuthSessionResponse,
    PinLogin,
    UserCreate,
    UserOut,
    UserResponse,
    UserUpdate,
)

router = APIRouter(prefix="/users", tags=["users"])


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


@router.post("/", response_model=UserOut, status_code=201, dependencies=[Depends(require_admin)])
def create_user(data: UserCreate, db: Session = Depends(get_db)):
    if _find_user_by_pin(db, data.pin):
        raise HTTPException(409, {"code": "PIN_TAKEN", "message": "Ya existe un usuario con ese PIN"})

    payload = data.model_dump()
    payload["pin"] = hash_pin(data.pin)
    user = User(**payload)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login/pin", response_model=AuthSessionResponse)
def login_pin(data: PinLogin, db: Session = Depends(get_db)):
    user = _find_user_by_pin(db, data.pin, active_only=True)
    if not user or not verify_pin(data.pin, user.pin):
        raise HTTPException(401, {"code": "INVALID_PIN", "message": "PIN invalido"})

    if not is_hashed_pin(user.pin):
        user.pin = hash_pin(data.pin)
        db.commit()
        db.refresh(user)

    access_token, expires_in = create_access_token(user_id=user.id, role=user.role)
    return {
        "success": True,
        "data": {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": expires_in,
            "user": user,
        },
        "error": None,
    }


@router.put("/{user_id}", response_model=UserResponse, dependencies=[Depends(require_admin)])
def update_user(user_id: str, data: UserUpdate, db: Session = Depends(get_db)):
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

    db.commit()
    db.refresh(user)
    return {"success": True, "data": user, "error": None}
