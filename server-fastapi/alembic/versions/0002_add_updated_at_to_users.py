"""add updated_at to users table

Revision ID: 0002
Revises: 0001
Create Date: 2026-02-27

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
    )


def downgrade() -> None:
    op.drop_column('users', 'updated_at')
