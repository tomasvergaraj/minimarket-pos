"""add loyalty fields to sales

Revision ID: 0013
Revises: 0012
Create Date: 2026-03-24

"""
import sqlalchemy as sa
from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = [c["name"] for c in inspector.get_columns("sales")]

    if "customer_id" not in existing_cols:
        op.add_column(
            "sales",
            sa.Column("customer_id", sa.String(36), sa.ForeignKey("customers.id", ondelete="SET NULL"), nullable=True),
        )
    if "points_earned" not in existing_cols:
        op.add_column("sales", sa.Column("points_earned", sa.Integer, nullable=False, server_default="0"))
    if "points_redeemed" not in existing_cols:
        op.add_column("sales", sa.Column("points_redeemed", sa.Integer, nullable=False, server_default="0"))
    if "discount_amount" not in existing_cols:
        op.add_column("sales", sa.Column("discount_amount", sa.Numeric(12, 2), nullable=False, server_default="0"))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = [c["name"] for c in inspector.get_columns("sales")]
    for col in ("discount_amount", "points_redeemed", "points_earned", "customer_id"):
        if col in existing_cols:
            op.drop_column("sales", col)
