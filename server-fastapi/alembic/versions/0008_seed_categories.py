"""seed default categories for minimarket

Revision ID: 0008
Revises: 0007
Create Date: 2026-03-17

"""
import uuid
import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None

DEFAULT_CATEGORIES = [
    ("Abarrotes",            "#F59E0B"),
    ("Bebidas y Jugos",      "#3B82F6"),
    ("Bebidas Alcohólicas",  "#8B5CF6"),
    ("Lácteos y Refrigerados", "#06B6D4"),
    ("Carnes y Embutidos",   "#EF4444"),
    ("Panadería y Pastelería", "#F97316"),
    ("Frutas y Verduras",    "#22C55E"),
    ("Congelados",           "#0EA5E9"),
    ("Snacks y Confites",    "#EC4899"),
    ("Desayuno y Cereales",  "#EAB308"),
    ("Conservas y Enlatados","#84CC16"),
    ("Limpieza y Hogar",     "#14B8A6"),
    ("Cuidado Personal",     "#A855F7"),
    ("Cigarros y Tabaco",    "#6B7280"),
    ("Varios",               "#9CA3AF"),
]


def upgrade() -> None:
    bind = op.get_bind()
    # Only insert categories that don't already exist (by name)
    existing = {
        row[0]
        for row in bind.execute(sa.text("SELECT name FROM categories")).fetchall()
    }
    rows = [
        {"id": str(uuid.uuid4()), "name": name, "color": color}
        for name, color in DEFAULT_CATEGORIES
        if name not in existing
    ]
    if rows:
        op.bulk_insert(
            sa.table(
                "categories",
                sa.column("id", sa.String),
                sa.column("name", sa.String),
                sa.column("color", sa.String),
            ),
            rows,
        )


def downgrade() -> None:
    bind = op.get_bind()
    names = [name for name, _ in DEFAULT_CATEGORIES]
    placeholders = ", ".join(f"'{n}'" for n in names)
    bind.execute(sa.text(f"DELETE FROM categories WHERE name IN ({placeholders})"))
