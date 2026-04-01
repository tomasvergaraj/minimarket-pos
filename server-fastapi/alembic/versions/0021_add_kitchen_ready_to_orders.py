"""add kitchen_ready to orders

Revision ID: 0021
Revises: 0020
Create Date: 2026-03-30

"""
import sqlalchemy as sa
from alembic import op

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("kitchen_ready", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("orders", "kitchen_ready")
