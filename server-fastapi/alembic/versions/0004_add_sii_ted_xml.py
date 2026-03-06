"""add sii_ted_xml column to sales

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-01
"""
from alembic import op
import sqlalchemy as sa

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'sales',
        sa.Column('sii_ted_xml', sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('sales', 'sii_ted_xml')
