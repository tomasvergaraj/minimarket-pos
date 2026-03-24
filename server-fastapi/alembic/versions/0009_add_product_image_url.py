"""add image_url column to products

Revision ID: 0009
Revises: 0008
Create Date: 2026-03-23

"""
import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("products")}
    if "image_url" not in cols:
        op.add_column(
            "products",
            sa.Column("image_url", sa.String(length=500), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("products")}
    if "image_url" in cols:
        op.drop_column("products", "image_url")
