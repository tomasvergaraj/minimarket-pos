"""
Sync Worker: syncs local PostgreSQL data to Supabase cloud backup.
Runs as a background service on the server PC.
"""
import os
import time
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import schedule
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "server-fastapi", ".env"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("sync-worker")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
LOCAL_DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/minimarket_pos")

# Tables with their time column for incremental sync (order matters for FK constraints)
# Use updated_at when available so edits (not just inserts) are synced
TABLES_TO_SYNC = {
    "users": "updated_at",
    "products": "created_at",
    "cash_registers": "created_at",
    "cash_sessions": "opened_at",
    "sales": "created_at",
    "sale_items": None,  # synced via sale_id join
    "kardex": "created_at",
}


def check_internet() -> bool:
    import httpx
    try:
        httpx.get("https://httpbin.org/get", timeout=5)
        return True
    except Exception:
        return False


def serialize_row(row: dict) -> dict:
    """Convert non-JSON-serializable types."""
    for key, val in row.items():
        if isinstance(val, datetime):
            row[key] = val.isoformat()
        elif isinstance(val, Decimal):
            row[key] = float(val)
    return row


def sync_to_cloud():
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.warning("Supabase not configured, skipping sync")
        return

    if not check_internet():
        logger.info("No internet connection, skipping sync")
        return

    logger.info("Starting cloud sync...")

    try:
        from supabase import create_client
        from sqlalchemy import create_engine, text

        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        engine = create_engine(LOCAL_DB_URL)

        since = datetime.now(timezone.utc) - timedelta(hours=1)

        with engine.connect() as conn:
            for table, time_col in TABLES_TO_SYNC.items():
                try:
                    if time_col:
                        result = conn.execute(
                            text(f"SELECT * FROM {table} WHERE {time_col} >= :since"),
                            {"since": since},
                        )
                    elif table == "sale_items":
                        # sale_items has no timestamp, sync via recent sales
                        result = conn.execute(
                            text(
                                "SELECT si.* FROM sale_items si "
                                "JOIN sales s ON si.sale_id = s.id "
                                "WHERE s.created_at >= :since"
                            ),
                            {"since": since},
                        )
                    else:
                        continue

                    rows = [serialize_row(dict(row._mapping)) for row in result]

                    if rows:
                        supabase.table(table).upsert(rows).execute()
                        logger.info(f"Synced {len(rows)} rows from {table}")
                    else:
                        logger.debug(f"No new data in {table}")

                except Exception as e:
                    logger.error(f"Error syncing {table}: {e}")

        logger.info("Cloud sync completed")

    except Exception as e:
        logger.error(f"Sync failed: {e}")


def send_whatsapp_report():
    """Placeholder: daily report via WhatsApp Business Cloud API."""
    logger.info("WhatsApp daily report - placeholder")
    # TODO: Implement with WhatsApp Business Cloud API
    # POST https://graph.facebook.com/v18.0/{phone_number_id}/messages
    # Headers: Authorization: Bearer {access_token}
    # Body: { messaging_product: "whatsapp", to: "...", type: "text", text: { body: "..." } }


def main():
    logger.info("Sync Worker started")

    # Sync every 30 minutes
    schedule.every(30).minutes.do(sync_to_cloud)

    # Daily report at 22:00
    schedule.every().day.at("22:00").do(send_whatsapp_report)

    # Run initial sync
    sync_to_cloud()

    while True:
        schedule.run_pending()
        time.sleep(60)


if __name__ == "__main__":
    main()
