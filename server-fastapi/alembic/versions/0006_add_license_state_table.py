"""add license_state table

Revision ID: 0006
Revises: 0005
Create Date: 2026-03-13

"""
import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "license_state" in inspector.get_table_names():
        return

    op.create_table(
        "license_state",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("installation_id", sa.String(length=36), nullable=False, unique=True),
        sa.Column("hardware_hash", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("trial_started_at", sa.DateTime(), nullable=False),
        sa.Column("trial_expires_at", sa.DateTime(), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(), nullable=True),
        sa.Column("max_seen_at", sa.DateTime(), nullable=True),
        sa.Column("activated_at", sa.DateTime(), nullable=True),
        sa.Column("license_id", sa.String(length=120), nullable=True),
        sa.Column("customer_name", sa.String(length=200), nullable=True),
        sa.Column("license_type", sa.String(length=32), nullable=True),
        sa.Column("license_expires_at", sa.DateTime(), nullable=True),
        sa.Column("updates_until", sa.DateTime(), nullable=True),
        sa.Column("max_registers", sa.Integer(), nullable=True),
        sa.Column("features_json", sa.Text(), nullable=True),
        sa.Column("license_payload", sa.Text(), nullable=True),
        sa.Column("license_signature", sa.Text(), nullable=True),
        sa.Column("validation_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "license_state" not in inspector.get_table_names():
        return

    op.drop_table("license_state")
