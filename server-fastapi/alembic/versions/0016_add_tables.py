"""add tables and update orders

Revision ID: 0016
Revises: 0015
Create Date: 2026-03-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = inspector.get_table_names()
    columns = {c["name"] for c in inspector.get_columns("orders")} if "orders" in tables else set()

    # Create tables table
    if "tables" not in tables:
        op.create_table(
            "tables",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("name", sa.String(60), nullable=False),
            sa.Column("capacity", sa.Integer, nullable=False, server_default="4"),
            sa.Column("pos_x", sa.Integer, nullable=False, server_default="0"),
            sa.Column("pos_y", sa.Integer, nullable=False, server_default="0"),
            sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
            sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("NOW()")),
        )

    # Add table_id to orders
    if "table_id" not in columns:
        op.add_column("orders", sa.Column("table_id", sa.String(36), nullable=True))
        op.create_foreign_key(
            "fk_orders_table_id", "orders", "tables", ["table_id"], ["id"],
            ondelete="SET NULL",
        )

    # Add bill_requested to orders
    if "bill_requested" not in columns:
        op.add_column("orders", sa.Column("bill_requested", sa.Boolean, nullable=False, server_default="false"))


def downgrade():
    op.drop_constraint("fk_orders_table_id", "orders", type_="foreignkey")
    op.drop_column("orders", "table_id")
    op.drop_column("orders", "bill_requested")
    op.drop_table("tables")
