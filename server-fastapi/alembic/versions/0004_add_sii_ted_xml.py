"""add sii_ted_xml column to sales

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-01
"""
import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    sale_columns = {column["name"] for column in inspector.get_columns("sales")}
    if "sii_ted_xml" in sale_columns:
        return

    op.add_column(
        "sales",
        sa.Column("sii_ted_xml", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    sale_columns = {column["name"] for column in inspector.get_columns("sales")}
    if "sii_ted_xml" not in sale_columns:
        return

    op.drop_column("sales", "sii_ted_xml")
