"""expand users.pin length for hashed pins

Revision ID: 0005
Revises: 0004
Create Date: 2026-03-13

"""
import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "pin",
        existing_type=sa.String(length=10),
        type_=sa.String(length=80),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "users",
        "pin",
        existing_type=sa.String(length=80),
        type_=sa.String(length=10),
        existing_nullable=False,
    )
