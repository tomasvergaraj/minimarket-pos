"""add notifications table

Revision ID: 0014
Revises: 0013
Create Date: 2026-03-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "notifications" not in inspector.get_table_names():
        op.create_table(
            "notifications",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("type", sa.String(30), nullable=False),
            sa.Column("title", sa.String(200), nullable=False),
            sa.Column("body", sa.Text, nullable=False),
            sa.Column("is_read", sa.Boolean, nullable=False, server_default="false"),
            sa.Column("entity_id", sa.String(36), nullable=True),
            sa.Column("entity_type", sa.String(50), nullable=True),
            sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("NOW()")),
        )
        op.create_index("ix_notifications_is_read", "notifications", ["is_read"])
        op.create_index("ix_notifications_created_at", "notifications", ["created_at"])
        op.create_index("ix_notifications_entity", "notifications", ["entity_id", "entity_type"])


def downgrade():
    op.drop_table("notifications")
