"""add expenses table

Revision ID: 0015
Revises: 0014
Create Date: 2026-03-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "expenses" not in inspector.get_table_names():
        op.create_table(
            "expenses",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("category", sa.String(30), nullable=False, server_default="other"),
            sa.Column("description", sa.String(300), nullable=False),
            sa.Column("notes", sa.Text, nullable=True),
            sa.Column("expense_date", sa.Date, nullable=False),
            sa.Column("created_by_id", sa.String(36), nullable=True),
            sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("NOW()")),
            sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.text("NOW()")),
        )
        op.create_index("ix_expenses_expense_date", "expenses", ["expense_date"])
        op.create_index("ix_expenses_category", "expenses", ["category"])


def downgrade():
    op.drop_table("expenses")
