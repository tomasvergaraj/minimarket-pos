from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin, require_operational_license
from app.core.config import ROOT_DIR
from app.db.session import get_db
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductUpdate, ProductOut
from app.services.product_stock import get_effective_stock

_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_IMAGE_EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}
_IMAGES_DIR: Path = ROOT_DIR / "static" / "images"

router = APIRouter(prefix="/products", tags=["products"])


def _to_out(product: Product, db: Session) -> ProductOut:
    out = ProductOut.model_validate(product)
    effective = get_effective_stock(product, db)
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


@router.post(
    "/{product_id}/image",
    response_model=ProductOut,
    dependencies=[Depends(require_admin), Depends(require_operational_license)],
)
async def upload_product_image(
    product_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")
    if file.content_type not in _ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, "El archivo debe ser una imagen (JPEG, PNG, WebP o GIF)")

    _IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    ext = _IMAGE_EXT[file.content_type]
    filename = f"product_{product_id}.{ext}"
    dest = _IMAGES_DIR / filename

    # Remove any previous image for this product (different extension)
    for old in _IMAGES_DIR.glob(f"product_{product_id}.*"):
        if old != dest:
            old.unlink(missing_ok=True)

    content = await file.read()
    dest.write_bytes(content)

    product.image_url = f"/static/images/{filename}"
    db.commit()
    db.refresh(product)
    return _to_out(product, db)


@router.delete(
    "/{product_id}/image",
    response_model=ProductOut,
    dependencies=[Depends(require_admin), Depends(require_operational_license)],
)
def delete_product_image(product_id: str, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")
    if product.image_url:
        file_path = ROOT_DIR / product.image_url.lstrip("/")
        file_path.unlink(missing_ok=True)
        product.image_url = None
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
