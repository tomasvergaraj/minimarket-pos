from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserOut, PinLogin

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).filter(User.is_active == True).all()


@router.post("/", response_model=UserOut, status_code=201)
def create_user(data: UserCreate, db: Session = Depends(get_db)):
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
