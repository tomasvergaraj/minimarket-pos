"""
Sync Worker: syncs local PostgreSQL data to Supabase cloud backup.
Runs as a background service on the server PC.
"""
import os
import time
import logging
from datetime import datetime, timedelta

import schedule
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("sync-worker")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
LOCAL_DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/minimarket_pos")

TABLES_TO_SYNC = ["products", "sales", "sale_items", "cash_sessions", "kardex", "users"]


def check_internet() -> bool:
    import httpx
    try:
        httpx.get("https://httpbin.org/get", timeout=5)
        return True
    except Exception:
        return False


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

        with engine.connect() as conn:
            for table in TABLES_TO_SYNC:
                try:
                    # Get records modified in last hour
                    if table in ("sales", "sale_items"):
                        result = conn.execute(text(
                            f"SELECT * FROM {table} WHERE created_at >= :since"
                        ), {"since": datetime.utcnow() - timedelta(hours=1)})
                    else:
                        result = conn.execute(text(
                            f"SELECT * FROM {table} WHERE updated_at >= :since OR created_at >= :since"
                        ), {"since": datetime.utcnow() - timedelta(hours=1)})

                    rows = [dict(row._mapping) for row in result]

                    if rows:
                        # Convert datetime objects to ISO strings
                        for row in rows:
                            for key, val in row.items():
                                if isinstance(val, datetime):
                                    row[key] = val.isoformat()

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
