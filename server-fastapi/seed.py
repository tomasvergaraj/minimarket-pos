"""Seed script: creates tables and inserts demo data."""
from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.models import Product, User, CashRegister


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Admin user
    if not db.query(User).filter(User.username == "admin").first():
        db.add(User(username="admin", pin="1234", full_name="Administrador", role="admin"))

    # Cashier
    if not db.query(User).filter(User.username == "cajero1").first():
        db.add(User(username="cajero1", pin="0000", full_name="Cajero 1", role="cashier"))

    # Registers
    for i in range(1, 4):
        name = f"Caja {i}"
        if not db.query(CashRegister).filter(CashRegister.name == name).first():
            db.add(CashRegister(name=name))

    # Sample products
    products = [
        {"sku": "BEB001", "barcode": "7801234560012", "name": "Coca-Cola 1.5L", "category": "Bebidas", "sell_price": 1490, "cost_price": 990, "stock": 50},
        {"sku": "BEB002", "barcode": "7801234560029", "name": "Agua Mineral 600ml", "category": "Bebidas", "sell_price": 590, "cost_price": 290, "stock": 100},
        {"sku": "SNK001", "barcode": "7801234560036", "name": "Papas Fritas Lays 150g", "category": "Snacks", "sell_price": 1290, "cost_price": 790, "stock": 30},
        {"sku": "PAN001", "barcode": "7801234560043", "name": "Pan Molde Integral", "category": "Panadería", "sell_price": 1990, "cost_price": 1200, "stock": 20},
        {"sku": "LAC001", "barcode": "7801234560050", "name": "Leche Entera 1L", "category": "Lácteos", "sell_price": 890, "cost_price": 590, "stock": 40},
        {"sku": "LAC002", "barcode": "7801234560067", "name": "Yogurt Natural 170g", "category": "Lácteos", "sell_price": 490, "cost_price": 290, "stock": 60},
        {"sku": "LIM001", "barcode": "7801234560074", "name": "Detergente Líquido 1L", "category": "Limpieza", "sell_price": 2490, "cost_price": 1590, "stock": 15},
        {"sku": "LIM002", "barcode": "7801234560081", "name": "Papel Higiénico x4", "category": "Limpieza", "sell_price": 1990, "cost_price": 1190, "stock": 25},
        {"sku": "CON001", "barcode": "7801234560098", "name": "Arroz 1kg", "category": "Abarrotes", "sell_price": 1190, "cost_price": 790, "stock": 35},
        {"sku": "CON002", "barcode": "7801234560104", "name": "Fideos Spaghetti 400g", "category": "Abarrotes", "sell_price": 690, "cost_price": 390, "stock": 45},
    ]

    for p in products:
        if not db.query(Product).filter(Product.sku == p["sku"]).first():
            db.add(Product(**p))

    db.commit()
    db.close()
    print("Seed completed.")


if __name__ == "__main__":
    seed()
