from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserOut, PinLogin, UserUpdate, UserResponse

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).filter(User.is_active == True).all()


@router.post("/", response_model=UserOut, status_code=201)
def create_user(data: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.pin == data.pin).first():
        raise HTTPException(409, {"code": "PIN_TAKEN", "message": "Ya existe un usuario con ese PIN"})
    user = User(**data.model_dump())
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login/pin", response_model=UserOut)
def login_pin(data: PinLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.pin == data.pin, User.is_active == True).first()
    if not user:
        raise HTTPException(401, "Invalid PIN")
    return user


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
        pin_exists = (
            db.query(User)
            .filter(User.pin == payload["pin"], User.id != user_id)
            .first()
        )
        if pin_exists:
            raise HTTPException(409, {"code": "PIN_TAKEN", "message": "Ya existe un usuario con ese PIN"})

    for key, value in payload.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return {"success": True, "data": user, "error": None}
