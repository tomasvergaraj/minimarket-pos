from collections.abc import Mapping

from sqlalchemy.orm import Session

from app.models.product import Product


def get_effective_stock(
    product: Product,
    db: Session,
    product_cache: Mapping[str, Product] | None = None,
) -> int:
    """Return the stock exposed to users, including derived stock for pack products."""
    if product.is_pack and product.base_product_id:
        base_product = product_cache.get(product.base_product_id) if product_cache else None
        if base_product is None:
            base_product = db.query(Product).filter(Product.id == product.base_product_id).first()
        if base_product is None:
            return 0
        return int(base_product.stock) // max(int(product.units_contained), 1)

    return int(product.stock)


def is_below_min_stock(
    product: Product,
    db: Session,
    product_cache: Mapping[str, Product] | None = None,
) -> bool:
    return get_effective_stock(product, db, product_cache) <= int(product.min_stock)
