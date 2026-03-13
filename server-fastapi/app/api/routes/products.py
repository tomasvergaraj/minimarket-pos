from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin, require_operational_license
from app.db.session import get_db
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductUpdate, ProductOut

router = APIRouter(prefix="/products", tags=["products"])


def _effective_stock(product: Product, db: Session) -> int:
    """For pack products, stock = floor(base_product.stock / units_contained)."""
    if product.is_pack and product.base_product_id:
        base = db.query(Product).filter(Product.id == product.base_product_id).first()
        if base:
            return int(base.stock) // max(int(product.units_contained), 1)
        return 0
    return int(product.stock)


def _to_out(product: Product, db: Session) -> ProductOut:
    out = ProductOut.model_validate(product)
    effective = _effective_stock(product, db)
    if effective != out.stock:
        out = out.model_copy(update={"stock": effective})
    return out


@router.get(
    "/",
    response_model=list[ProductOut],
    dependencies=[Depends(get_current_user), Depends(require_operational_license)],
)
def list_products(
    search: str | None = None,
    category: str | None = None,
    active_only: bool = True,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    q = db.query(Product)
    if active_only:
        q = q.filter(Product.is_active == True)
    if search:
        q = q.filter(
            Product.name.ilike(f"%{search}%")
            | Product.sku.ilike(f"%{search}%")
            | Product.barcode.ilike(f"%{search}%")
        )
    if category:
        q = q.filter(Product.category == category)
    products = q.order_by(Product.name).offset(skip).limit(limit).all()
    return [_to_out(p, db) for p in products]


@router.get(
    "/barcode/{barcode}",
    response_model=ProductOut,
    dependencies=[Depends(get_current_user), Depends(require_operational_license)],
)
def get_by_barcode(barcode: str, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.barcode == barcode, Product.is_active == True).first()
    if not product:
        raise HTTPException(404, "Product not found")
    return _to_out(product, db)


@router.get(
    "/{product_id}",
    response_model=ProductOut,
    dependencies=[Depends(get_current_user), Depends(require_operational_license)],
)
def get_product(product_id: str, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")
    return _to_out(product, db)


@router.post(
    "/",
    response_model=ProductOut,
    status_code=201,
    dependencies=[Depends(require_admin), Depends(require_operational_license)],
)
def create_product(data: ProductCreate, db: Session = Depends(get_db)):
    dump = data.model_dump()
    if dump.get("is_pack"):
        dump["stock"] = 0  # pack products don't own stock
    product = Product(**dump)
    db.add(product)
    db.commit()
    db.refresh(product)
    return _to_out(product, db)


@router.put(
    "/{product_id}",
    response_model=ProductOut,
    dependencies=[Depends(require_admin), Depends(require_operational_license)],
)
def update_product(product_id: str, data: ProductUpdate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(product, key, value)
    db.commit()
    db.refresh(product)
    return _to_out(product, db)


@router.delete(
    "/{product_id}",
    dependencies=[Depends(require_admin), Depends(require_operational_license)],
)
def delete_product(product_id: str, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")
    product.is_active = False
    db.commit()
    return {"ok": True}


@router.get(
    "/categories/list",
    response_model=list[str],
    dependencies=[Depends(get_current_user), Depends(require_operational_license)],
)
def list_categories(db: Session = Depends(get_db)):
    rows = db.query(Product.category).filter(Product.category.isnot(None)).distinct().all()
    return [r[0] for r in rows]
