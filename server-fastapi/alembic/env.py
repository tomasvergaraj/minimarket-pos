from logging.config import fileConfig
from sqlalchemy import pool, create_engine
from alembic import context

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import all models so Alembic can detect them
from app.db.base import Base
from app.models import Product, Sale, SaleItem, CashRegister, CashSession, KardexEntry, User
from app.core.config import settings

target_metadata = Base.metadata

# Use the app's DATABASE_URL (already converted to psycopg3 driver in session.py)
_db_url = settings.DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)


def run_migrations_offline() -> None:
    context.configure(url=_db_url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(_db_url, poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
