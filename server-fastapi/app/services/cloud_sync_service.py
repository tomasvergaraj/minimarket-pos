"""
Cloud Sync Service — syncs local PostgreSQL data to Supabase.
Multi-sucursal aware: each record is tagged with branch_id.
"""
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings

logger = logging.getLogger(__name__)

# Table → time column for incremental sync.
# "column_name"  → WHERE column_name >= since  (incremental)
# False          → no WHERE filter (full upsert every run — for small tables)
# None           → joined sync (see JOINED_PARENT)
TABLES_TO_SYNC: dict[str, str | None | bool] = {
    "users":                "updated_at",
    "products":             "updated_at",
    "categories":           False,
    "cash_registers":       "created_at",
    "cash_sessions":        "opened_at",
    "sales":                "created_at",
    "sale_items":           None,
    "kardex":               "created_at",
    "suppliers":            "updated_at",
    "purchase_orders":      "updated_at",
    "purchase_order_items": None,
    "promotions":           "updated_at",
    "customers":            "updated_at",
    "expenses":             "updated_at",
    "tables":               "created_at",
    "orders":               "updated_at",
    "order_items":          None,
}

# For None-column tables: (parent_table, fk_column, parent_time_column)
JOINED_PARENT: dict[str, tuple[str, str, str]] = {
    "sale_items":            ("sales",          "sale_id",           "created_at"),
    "purchase_order_items":  ("purchase_orders", "purchase_order_id", "updated_at"),
    "order_items":           ("orders",          "order_id",          "updated_at"),
}


def _serialize(row: dict) -> dict:
    out = {}
    for k, v in row.items():
        if isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, Decimal):
            out[k] = float(v)
        else:
            out[k] = v
    return out


def _fetch_rows(conn, table: str, time_col: str | None | bool, since: datetime) -> list[dict]:
    try:
        if time_col is False:
            result = conn.execute(text(f"SELECT * FROM {table}"))
        elif time_col is None:
            if table not in JOINED_PARENT:
                return []
            parent, fk, pt = JOINED_PARENT[table]
            result = conn.execute(
                text(f"SELECT t.* FROM {table} t "
                     f"JOIN {parent} p ON t.{fk} = p.id "
                     f"WHERE p.{pt} >= :since"),
                {"since": since},
            )
        else:
            result = conn.execute(
                text(f"SELECT * FROM {table} WHERE {time_col} >= :since"),
                {"since": since},
            )
        return [dict(row._mapping) for row in result]
    except Exception as e:
        logger.warning(f"Could not fetch {table}: {e}")
        return []


def run_sync(db: Session) -> dict[str, Any]:
    """
    Run incremental sync to Supabase.
    Returns a dict suitable for creating/updating a SyncLog.
    Raises ValueError if Supabase is not configured.
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        raise ValueError("Supabase no está configurado (falta SUPABASE_URL o SUPABASE_KEY)")

    from app.db.session import engine

    try:
        from supabase import create_client
    except ImportError:
        raise ValueError("Librería supabase no instalada. Ejecuta: pip install supabase")

    supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    branch_id = getattr(settings, "BRANCH_ID", "default") or "default"

    # Look back 1 hour to catch any records missed in a previous interrupted sync
    since = datetime.now(timezone.utc) - timedelta(hours=1)

    total_records = 0
    tables_synced = 0
    errors: list[str] = []

    with engine.connect() as conn:
        for table, time_col in TABLES_TO_SYNC.items():
            try:
                rows = _fetch_rows(conn, table, time_col, since)
                if rows:
                    tagged = [{**_serialize(r), "branch_id": branch_id} for r in rows]
                    # Upsert — Supabase requires the conflict columns to exist in the table.
                    # branch_id must be a column in every Supabase table for multi-sucursal.
                    supabase.table(table).upsert(tagged).execute()
                    total_records += len(rows)
                    logger.info(f"Synced {len(rows)} rows → {table}")
                tables_synced += 1
            except Exception as e:
                logger.error(f"Error syncing {table}: {e}")
                errors.append(f"{table}: {str(e)[:120]}")

    return {
        "status": "success" if not errors else "error",
        "tables_synced": tables_synced,
        "records_synced": total_records,
        "error_message": "; ".join(errors[:5]) if errors else None,
    }
