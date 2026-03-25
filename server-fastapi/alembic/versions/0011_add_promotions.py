"""add promotions table

Revision ID: 0011
Revises: 0010
Create Date: 2026-03-24

"""
import sqlalchemy as sa
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "promotions" not in inspector.get_table_names():
        op.create_table(
            "promotions",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column(
                "promo_type",
                sa.Enum(
                    "percentage_discount",
                    "fixed_discount",
                    "buy_n_get_m",
                    "min_quantity",
                    name="promotiontype",
                ),
                nullable=False,
            ),
            sa.Column("product_id", sa.String(36), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=True),
            sa.Column("category_name", sa.String(100), nullable=True),
            sa.Column("discount_pct", sa.Numeric(5, 2), nullable=True),
            sa.Column("discount_amount", sa.Numeric(12, 2), nullable=True),
            sa.Column("buy_qty", sa.Integer, nullable=True),
            sa.Column("get_qty", sa.Integer, nullable=True),
            sa.Column("min_qty", sa.Integer, nullable=True),
            sa.Column("special_price", sa.Numeric(12, 2), nullable=True),
            sa.Column("is_active", sa.Boolean, nullable=False, server_default="1"),
            sa.Column("starts_at", sa.DateTime, nullable=True),
            sa.Column("ends_at", sa.DateTime, nullable=True),
            sa.Column("created_at", sa.DateTime, nullable=False),
            sa.Column("updated_at", sa.DateTime, nullable=False),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "promotions" in inspector.get_table_names():
        op.drop_table("promotions")
