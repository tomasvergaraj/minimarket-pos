"""add sync_logs table

Revision ID: 0017
Revises: 0016
Create Date: 2026-03-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = inspector.get_table_names()

    if "sync_logs" not in tables:
        op.create_table(
            "sync_logs",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("branch_id", sa.String(100), nullable=False, server_default="default"),
            sa.Column("started_at", sa.DateTime, nullable=False),
            sa.Column("completed_at", sa.DateTime, nullable=True),
            sa.Column("status", sa.String(20), nullable=False, server_default="running"),
            sa.Column("tables_synced", sa.Integer, nullable=False, server_default="0"),
            sa.Column("records_synced", sa.Integer, nullable=False, server_default="0"),
            sa.Column("error_message", sa.Text, nullable=True),
        )


def downgrade():
    op.drop_table("sync_logs")
