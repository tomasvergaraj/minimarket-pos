"""add suppliers and purchase_orders tables

Revision ID: 0010
Revises: 0009
Create Date: 2026-03-24

"""
import sqlalchemy as sa
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if "suppliers" not in existing_tables:
        op.create_table(
            "suppliers",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("rut", sa.String(20), nullable=True),
            sa.Column("contact_name", sa.String(200), nullable=True),
            sa.Column("phone", sa.String(30), nullable=True),
            sa.Column("email", sa.String(200), nullable=True),
            sa.Column("address", sa.Text, nullable=True),
            sa.Column("notes", sa.Text, nullable=True),
            sa.Column("is_active", sa.Boolean, nullable=False, server_default="1"),
            sa.Column("created_at", sa.DateTime, nullable=False),
            sa.Column("updated_at", sa.DateTime, nullable=False),
        )

    if "purchase_orders" not in existing_tables:
        op.create_table(
            "purchase_orders",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("order_number", sa.Integer, nullable=False),
            sa.Column("supplier_id", sa.String(36), sa.ForeignKey("suppliers.id"), nullable=False),
            sa.Column(
                "status",
                sa.Enum("draft", "confirmed", "received", name="purchaseorderstatus"),
                nullable=False,
                server_default="draft",
            ),
            sa.Column("notes", sa.Text, nullable=True),
            sa.Column("subtotal", sa.Numeric(12, 2), nullable=False, server_default="0"),
            sa.Column("total", sa.Numeric(12, 2), nullable=False, server_default="0"),
            sa.Column("created_by", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("confirmed_at", sa.DateTime, nullable=True),
            sa.Column("received_at", sa.DateTime, nullable=True),
            sa.Column("created_at", sa.DateTime, nullable=False),
            sa.Column("updated_at", sa.DateTime, nullable=False),
        )

    if "purchase_order_items" not in existing_tables:
        op.create_table(
            "purchase_order_items",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column(
                "purchase_order_id",
                sa.String(36),
                sa.ForeignKey("purchase_orders.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("product_id", sa.String(36), sa.ForeignKey("products.id"), nullable=False),
            sa.Column("quantity_ordered", sa.Integer, nullable=False),
            sa.Column("quantity_received", sa.Integer, nullable=False, server_default="0"),
            sa.Column("unit_cost", sa.Numeric(12, 2), nullable=False),
            sa.Column("subtotal", sa.Numeric(12, 2), nullable=False),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if "purchase_order_items" in existing_tables:
        op.drop_table("purchase_order_items")
    if "purchase_orders" in existing_tables:
        op.drop_table("purchase_orders")
    if "suppliers" in existing_tables:
        op.drop_table("suppliers")
