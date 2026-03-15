"""Seed script: creates tables and inserts demo data."""
from datetime import datetime, timedelta
from sqlalchemy import text, inspect as sa_inspect

from app.core.security import hash_pin
from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.models import Product, User, CashRegister


def _get_or_create(db, sku: str, **kwargs) -> Product:
    """Return existing product by SKU or create and flush a new one."""
    obj = db.query(Product).filter(Product.sku == sku).first()
    if not obj:
        obj = Product(sku=sku, **kwargs)
        db.add(obj)
        db.flush()  # assigns id without committing
    return obj


def migrate():
    """Add new columns to existing tables (idempotent ALTER TABLE)."""
    insp = sa_inspect(engine)

    product_cols = {c["name"] for c in insp.get_columns("products")}
    sale_item_cols = {c["name"] for c in insp.get_columns("sale_items")}
    user_cols = {c["name"]: c for c in insp.get_columns("users")}

    with engine.connect() as conn:
        if "updated_at" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT NOW()"))
            print("  + users.updated_at")
        else:
            pin_type = user_cols["pin"]["type"]
            pin_length = getattr(pin_type, "length", None)
            if pin_length is not None and pin_length < 80:
                conn.execute(text("ALTER TABLE users ALTER COLUMN pin TYPE VARCHAR(80)"))
                print("  ~ users.pin -> VARCHAR(80)")
        if "pack_size" not in product_cols:
            conn.execute(text("ALTER TABLE products ADD COLUMN pack_size INTEGER NOT NULL DEFAULT 1"))
            print("  + products.pack_size")
        if "pack_price" not in product_cols:
            conn.execute(text("ALTER TABLE products ADD COLUMN pack_price NUMERIC(12,2)"))
            print("  + products.pack_price")
        if "discount_price" not in product_cols:
            conn.execute(text("ALTER TABLE products ADD COLUMN discount_price NUMERIC(12,2)"))
            print("  + products.discount_price")
        if "discount_ends_at" not in product_cols:
            conn.execute(text("ALTER TABLE products ADD COLUMN discount_ends_at TIMESTAMP"))
            print("  + products.discount_ends_at")
        if "units_per_item" not in sale_item_cols:
            conn.execute(text("ALTER TABLE sale_items ADD COLUMN units_per_item INTEGER NOT NULL DEFAULT 1"))
            print("  + sale_items.units_per_item")
        if "is_pack" not in product_cols:
            conn.execute(text("ALTER TABLE products ADD COLUMN is_pack BOOLEAN NOT NULL DEFAULT FALSE"))
            print("  + products.is_pack")
        if "units_contained" not in product_cols:
            conn.execute(text("ALTER TABLE products ADD COLUMN units_contained INTEGER NOT NULL DEFAULT 1"))
            print("  + products.units_contained")
        if "base_product_id" not in product_cols:
            conn.execute(text("ALTER TABLE products ADD COLUMN base_product_id VARCHAR(36) REFERENCES products(id) ON DELETE SET NULL"))
            print("  + products.base_product_id")
        conn.commit()


def seed():
    Base.metadata.create_all(bind=engine)
    migrate()
    db = SessionLocal()

    # Admin user
    if not db.query(User).filter(User.username == "admin").first():
        db.add(User(username="admin", pin=hash_pin("1234"), full_name="Administrador", role="admin"))

    # Cashier
    if not db.query(User).filter(User.username == "cajero1").first():
        db.add(User(username="cajero1", pin=hash_pin("0000"), full_name="Cajero 1", role="cashier"))

    # Registers
    for i in range(1, 4):
        name = f"Caja {i}"
        if not db.query(CashRegister).filter(CashRegister.name == name).first():
            db.add(CashRegister(name=name))

    # ── BOTILLERÍA DEMO ──────────────────────────────────────────────

    now = datetime.utcnow()
    week = now + timedelta(days=7)
    two_weeks = now + timedelta(days=14)

    # ── CERVEZAS (unidades base) ─────────────────────────────────────
    cristal = _get_or_create(db, "CRV001",
        barcode="7802050012341",
        name="Cerveza Cristal Lata 350ml",
        category="Cervezas",
        sell_price=990, cost_price=550, stock=120, tax_rate=19,
    )
    escudo = _get_or_create(db, "CRV002",
        barcode="7802050012358",
        name="Cerveza Escudo Lata 350ml",
        category="Cervezas",
        sell_price=1090, cost_price=620, stock=96, tax_rate=19,
    )
    heineken = _get_or_create(db, "CRV003",
        barcode="8712000023732",
        name="Cerveza Heineken Botella 330ml",
        category="Cervezas",
        sell_price=1590, cost_price=900, stock=48, tax_rate=19,
        # Oferta por lanzamiento — expira en 1 semana
        discount_price=1290, discount_ends_at=week,
    )
    corona = _get_or_create(db, "CRV004",
        barcode="7501040302407",
        name="Cerveza Corona Botella 355ml",
        category="Cervezas",
        sell_price=1790, cost_price=1050, stock=36, tax_rate=19,
    )

    # ── CERVEZAS PACKS (stock = 0, se consume del base) ─────────────
    _get_or_create(db, "CRV001P6",
        barcode="7802050012365",
        name="Cerveza Cristal Six-Pack 350ml x6",
        category="Cervezas",
        sell_price=4990, cost_price=3000, stock=0, tax_rate=19,
        is_pack=True, units_contained=6, base_product_id=cristal.id,
    )
    _get_or_create(db, "CRV001C24",
        barcode="7802050012372",
        name="Cerveza Cristal Caja x24",
        category="Cervezas",
        sell_price=17990, cost_price=11000, stock=0, tax_rate=19,
        is_pack=True, units_contained=24, base_product_id=cristal.id,
    )
    _get_or_create(db, "CRV002P6",
        barcode="7802050012389",
        name="Cerveza Escudo Six-Pack 350ml x6",
        category="Cervezas",
        sell_price=5490, cost_price=3300, stock=0, tax_rate=19,
        is_pack=True, units_contained=6, base_product_id=escudo.id,
    )
    _get_or_create(db, "CRV003P6",
        barcode="8712000046700",
        name="Cerveza Heineken Six-Pack 330ml x6",
        category="Cervezas",
        sell_price=7990, cost_price=4900, stock=0, tax_rate=19,
        is_pack=True, units_contained=6, base_product_id=heineken.id,
        # Oferta en pack también
        discount_price=6990, discount_ends_at=week,
    )

    # ── VINOS ────────────────────────────────────────────────────────
    _get_or_create(db, "VIN001",
        barcode="7804320001234",
        name="Vino Casillero del Diablo Cabernet 750ml",
        category="Vinos",
        sell_price=4990, cost_price=2800, stock=24, tax_rate=19,
        discount_price=3990, discount_ends_at=week,
    )
    _get_or_create(db, "VIN002",
        barcode="7804320005678",
        name="Vino Gato Negro Carménère 750ml",
        category="Vinos",
        sell_price=2490, cost_price=1400, stock=30, tax_rate=19,
    )
    _get_or_create(db, "VIN003",
        barcode="7804320009012",
        name="Vino Frontera Blanco 1.5L",
        category="Vinos",
        sell_price=2990, cost_price=1600, stock=18, tax_rate=19,
        discount_price=2390, discount_ends_at=two_weeks,
    )
    _get_or_create(db, "VIN004",
        barcode="7804320003456",
        name="Vino Santa Rita 120 Sauvignon 750ml",
        category="Vinos",
        sell_price=2990, cost_price=1700, stock=20, tax_rate=19,
    )

    # ── PISCOS ───────────────────────────────────────────────────────
    _get_or_create(db, "PIS001",
        barcode="7802150001122",
        name="Pisco Mistral 35° 750ml",
        category="Piscos",
        sell_price=7990, cost_price=4500, stock=15, tax_rate=19,
    )
    _get_or_create(db, "PIS002",
        barcode="7802150002233",
        name="Pisco Control C 35° 1L",
        category="Piscos",
        sell_price=6990, cost_price=3800, stock=12, tax_rate=19,
        discount_price=5490, discount_ends_at=week,
    )
    _get_or_create(db, "PIS003",
        barcode="7802150003344",
        name="Pisco Alto del Carmen 40° 500ml",
        category="Piscos",
        sell_price=8990, cost_price=5200, stock=8, tax_rate=19,
    )

    # ── DESTILADOS ───────────────────────────────────────────────────
    _get_or_create(db, "DES001",
        barcode="7350051994483",
        name="Vodka Absolut 750ml",
        category="Destilados",
        sell_price=14990, cost_price=8500, stock=10, tax_rate=19,
    )
    _get_or_create(db, "DES002",
        barcode="5010196001234",
        name="Whisky Johnnie Walker Red 750ml",
        category="Destilados",
        sell_price=19990, cost_price=12000, stock=6, tax_rate=19,
        discount_price=16990, discount_ends_at=two_weeks,
    )
    _get_or_create(db, "DES003",
        barcode="5013967012345",
        name="Ron Bacardí Carta Blanca 750ml",
        category="Destilados",
        sell_price=9990, cost_price=5800, stock=8, tax_rate=19,
    )

    # ── BEBIDAS ──────────────────────────────────────────────────────
    _get_or_create(db, "BEB001",
        barcode="7801234560012",
        name="Coca-Cola 1.5L",
        category="Bebidas",
        sell_price=1490, cost_price=850, stock=48, tax_rate=19,
    )
    _get_or_create(db, "BEB002",
        barcode="7801234560029",
        name="Sprite 1.5L",
        category="Bebidas",
        sell_price=1290, cost_price=750, stock=36, tax_rate=19,
    )
    _get_or_create(db, "BEB003",
        barcode="7806600013361",
        name="Agua Mineral Cachantun 1.5L",
        category="Bebidas",
        sell_price=790, cost_price=350, stock=60, tax_rate=19,
    )
    _get_or_create(db, "BEB004",
        barcode="7802470000109",
        name="Jugo Watts Naranja 1L",
        category="Bebidas",
        sell_price=1190, cost_price=650, stock=24, tax_rate=19,
    )

    # ── SNACKS ───────────────────────────────────────────────────────
    _get_or_create(db, "SNK010",
        barcode="7802260100101",
        name="Papas Fritas Lays 40g",
        category="Snacks",
        sell_price=490, cost_price=270, stock=80, tax_rate=19,
    )
    _get_or_create(db, "SNK011",
        barcode="7802260100118",
        name="Maní Salado 100g",
        category="Snacks",
        sell_price=390, cost_price=200, stock=60, tax_rate=19,
    )
    _get_or_create(db, "SNK012",
        barcode="7622201169022",
        name="Galletas Oreo 154g",
        category="Snacks",
        sell_price=990, cost_price=550, stock=40, tax_rate=19,
    )

    # ── CIGARRILLOS ──────────────────────────────────────────────────
    _get_or_create(db, "CIG001",
        barcode="7891234000123",
        name="Cigarrillos Marlboro Rojo x20",
        category="Cigarrillos",
        sell_price=5990, cost_price=4200, stock=50, tax_rate=19,
    )
    _get_or_create(db, "CIG002",
        barcode="7891234000130",
        name="Cigarrillos Belmont Azul x20",
        category="Cigarrillos",
        sell_price=4990, cost_price=3500, stock=40, tax_rate=19,
    )

    db.commit()
    db.close()
    print("Seed completed.")
    print("  Botillería: cervezas (unidad + six-pack + caja), vinos, piscos, destilados, bebidas, snacks, cigarrillos")
    print("  Ofertas activas: Heineken, Heineken 6-pack, Casillero, Frontera Blanco, Control C, Johnnie Walker")


if __name__ == "__main__":
    seed()
