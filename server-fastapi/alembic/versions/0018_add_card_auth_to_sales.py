"""add card_auth_code and card_last4 to sales

Revision ID: 0018
Revises: 0017
Create Date: 2026-03-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("sales")}

    if "card_auth_code" not in columns:
        op.add_column("sales", sa.Column("card_auth_code", sa.String(20), nullable=True))
    if "card_last4" not in columns:
        op.add_column("sales", sa.Column("card_last4", sa.String(4), nullable=True))


def downgrade():
    op.drop_column("sales", "card_last4")
    op.drop_column("sales", "card_auth_code")
