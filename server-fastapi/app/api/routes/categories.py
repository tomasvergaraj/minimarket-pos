from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin, require_operational_license
from app.db.session import get_db
from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryOut

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get(
    "/",
    response_model=list[CategoryOut],
    dependencies=[Depends(get_current_user), Depends(require_operational_license)],
)
def list_categories(db: Session = Depends(get_db)):
    return db.query(Category).order_by(Category.name).all()


@router.post(
    "/",
    response_model=CategoryOut,
    status_code=201,
    dependencies=[Depends(require_admin), Depends(require_operational_license)],
)
def create_category(data: CategoryCreate, db: Session = Depends(get_db)):
    existing = db.query(Category).filter(Category.name == data.name).first()
    if existing:
        raise HTTPException(400, f"La categoría '{data.name}' ya existe")
    cat = Category(name=data.name, color=data.color)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.put(
    "/{category_id}",
    response_model=CategoryOut,
    dependencies=[Depends(require_admin), Depends(require_operational_license)],
)
def update_category(category_id: str, data: CategoryUpdate, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(404, "Categoría no encontrada")
    if data.name is not None:
        existing = db.query(Category).filter(Category.name == data.name, Category.id != category_id).first()
        if existing:
            raise HTTPException(400, f"La categoría '{data.name}' ya existe")
        cat.name = data.name
    if data.color is not None:
        cat.color = data.color
    db.commit()
    db.refresh(cat)
    return cat


@router.delete(
    "/{category_id}",
    dependencies=[Depends(require_admin), Depends(require_operational_license)],
)
def delete_category(category_id: str, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(404, "Categoría no encontrada")
    db.delete(cat)
    db.commit()
    return {"ok": True}
