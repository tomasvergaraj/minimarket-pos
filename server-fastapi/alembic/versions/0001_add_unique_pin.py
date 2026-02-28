"""add unique constraint to users.pin

Revision ID: 0001
Revises:
Create Date: 2026-02-27

"""
from alembic import op

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint('uq_users_pin', 'users', ['pin'])


def downgrade() -> None:
    op.drop_constraint('uq_users_pin', 'users', type_='unique')
