"""add categories table, transfer payment method, transfer_amount to sales

Revision ID: 0007
Revises: 0006
Create Date: 2026-03-17

"""
import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    # --- 1. Create categories table ---
    if "categories" not in tables:
        op.create_table(
            "categories",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("name", sa.String(length=100), nullable=False, unique=True),
            sa.Column("color", sa.String(length=7), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        )

    # --- 2. Change payment_method column to VARCHAR so 'transfer' is accepted ---
    # ALTER TYPE requires owning the PostgreSQL type; altering the column does not.
    # Use information_schema (reliable) instead of SQLAlchemy type repr (unreliable for enums).
    actual_type = bind.execute(
        sa.text(
            "SELECT data_type FROM information_schema.columns "
            "WHERE table_name='sales' AND column_name='payment_method'"
        )
    ).scalar()
    if actual_type not in ("character varying", "text", "character"):
        op.execute(
            "ALTER TABLE sales ALTER COLUMN payment_method TYPE VARCHAR(20) "
            "USING payment_method::text"
        )

    # --- 3. Add transfer_amount column to sales ---
    sale_cols = {c["name"] for c in inspector.get_columns("sales")}
    if "transfer_amount" not in sale_cols:
        op.add_column(
            "sales",
            sa.Column("transfer_amount", sa.Numeric(12, 2), nullable=True, server_default="0"),
        )

    # --- 4. Add total_transfer_sales column to cash_sessions ---
    session_cols = {c["name"] for c in inspector.get_columns("cash_sessions")}
    if "total_transfer_sales" not in session_cols:
        op.add_column(
            "cash_sessions",
            sa.Column("total_transfer_sales", sa.Numeric(12, 2), nullable=True, server_default="0"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    if "categories" in tables:
        op.drop_table("categories")

    sale_cols = {c["name"] for c in inspector.get_columns("sales")}
    if "transfer_amount" in sale_cols:
        op.drop_column("sales", "transfer_amount")

    session_cols = {c["name"] for c in inspector.get_columns("cash_sessions")}
    if "total_transfer_sales" in session_cols:
        op.drop_column("cash_sessions", "total_transfer_sales")
