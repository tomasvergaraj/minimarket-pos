"""add sii_folio_counters table

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-01
"""
from alembic import op
import sqlalchemy as sa

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'sii_folio_counters',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('tipo_dte', sa.Integer(), nullable=False, unique=True),
        sa.Column('caf_desde', sa.Integer(), nullable=False),
        sa.Column('caf_hasta', sa.Integer(), nullable=False),
        sa.Column('current_folio', sa.Integer(), nullable=False),
        sa.Column('caf_xml_path', sa.String(500), nullable=False),
        sa.Column(
            'updated_at',
            sa.DateTime(),
            nullable=False,
            server_default=sa.text('NOW()'),
        ),
    )


def downgrade() -> None:
    op.drop_table('sii_folio_counters')
