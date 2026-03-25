"""add customers table

Revision ID: 0012
Revises: 0011
Create Date: 2026-03-24

"""
import sqlalchemy as sa
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "customers" not in inspector.get_table_names():
        op.create_table(
            "customers",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("rut", sa.String(12), nullable=True, unique=True),
            sa.Column("phone", sa.String(20), nullable=True),
            sa.Column("email", sa.String(200), nullable=True),
            sa.Column("notes", sa.String(500), nullable=True),
            sa.Column("points_balance", sa.Integer, nullable=False, server_default="0"),
            sa.Column("total_purchases", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column("visit_count", sa.Integer, nullable=False, server_default="0"),
            sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
            sa.Column("created_at", sa.DateTime, nullable=False),
            sa.Column("updated_at", sa.DateTime, nullable=False),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "customers" in inspector.get_table_names():
        op.drop_table("customers")
