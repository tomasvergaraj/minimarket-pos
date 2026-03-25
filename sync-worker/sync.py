"""
Sync Worker v2 — sincroniza datos locales con Supabase (respaldo en la nube).
Soporte multi-sucursal via BRANCH_ID.

Uso:
  python sync.py           # daemon: sincroniza cada 30 min
  python sync.py --once    # ejecuta una sola vez y termina
"""
import argparse
import logging
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

try:
    import schedule
    from dotenv import load_dotenv
    from sqlalchemy import create_engine, text
except ImportError as exc:
    print(f"Dependencia faltante: {exc}\nEjecuta: pip install -r requirements.txt")
    sys.exit(1)

# ──────────────────────────────────────────────────────────────────────────────
HERE = Path(__file__).parent
load_dotenv(HERE.parent / "server-fastapi" / ".env")

LOG_FILE = HERE / "sync.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
    ],
)
logger = logging.getLogger("sync-worker")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
LOCAL_DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/minimarket_pos")
BRANCH_ID = os.getenv("BRANCH_ID", "default") or "default"

# ──────────────────────────────────────────────────────────────────────────────
# Tables config (same as cloud_sync_service.py)
# ──────────────────────────────────────────────────────────────────────────────
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

JOINED_PARENT: dict[str, tuple[str, str, str]] = {
    "sale_items":            ("sales",           "sale_id",           "created_at"),
    "purchase_order_items":  ("purchase_orders",  "purchase_order_id", "updated_at"),
    "order_items":           ("orders",           "order_id",          "updated_at"),
}


# ──────────────────────────────────────────────────────────────────────────────
def _check_internet() -> bool:
    import httpx
    try:
        httpx.get("https://httpbin.org/get", timeout=5)
        return True
    except Exception:
        return False


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


def _fetch_rows(conn, table: str, time_col, since: datetime) -> list[dict]:
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
        logger.warning(f"No se pudo leer {table}: {e}")
        return []


def _write_sync_log(engine, status: str, tables_synced: int, records_synced: int,
                    started_at: datetime, error_message: str | None = None) -> None:
    """Persist sync result to local sync_logs table."""
    try:
        with engine.connect() as conn:
            conn.execute(
                text(
                    "INSERT INTO sync_logs "
                    "(branch_id, started_at, completed_at, status, tables_synced, records_synced, error_message) "
                    "VALUES (:branch_id, :started_at, :completed_at, :status, :tables_synced, :records_synced, :error_message)"
                ),
                {
                    "branch_id": BRANCH_ID,
                    "started_at": started_at,
                    "completed_at": datetime.utcnow(),
                    "status": status,
                    "tables_synced": tables_synced,
                    "records_synced": records_synced,
                    "error_message": error_message,
                },
            )
            conn.commit()
    except Exception as e:
        logger.warning(f"No se pudo escribir sync_log: {e}")


# ──────────────────────────────────────────────────────────────────────────────
def sync_to_cloud(once: bool = False) -> None:
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.warning("Supabase no configurado (falta SUPABASE_URL / SUPABASE_KEY) — omitiendo sync")
        return

    if not _check_internet():
        logger.info("Sin conexión a internet — omitiendo sync")
        return

    logger.info(f"Iniciando sync (branch_id={BRANCH_ID}) ...")
    started_at = datetime.utcnow()
    since = datetime.now(timezone.utc) - timedelta(hours=1)

    try:
        from supabase import create_client
    except ImportError:
        logger.error("Librería supabase no instalada. Ejecuta: pip install -r requirements.txt")
        return

    db_url = LOCAL_DB_URL.replace("postgresql://", "postgresql+psycopg2://", 1)
    engine = create_engine(db_url, pool_pre_ping=True)
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    total_records = 0
    tables_synced = 0
    errors: list[str] = []

    with engine.connect() as conn:
        for table, time_col in TABLES_TO_SYNC.items():
            try:
                rows = _fetch_rows(conn, table, time_col, since)
                if rows:
                    tagged = [{**_serialize(r), "branch_id": BRANCH_ID} for r in rows]
                    supabase.table(table).upsert(tagged).execute()
                    total_records += len(rows)
                    logger.info(f"  {table}: {len(rows)} registros")
                tables_synced += 1
            except Exception as e:
                logger.error(f"  Error en {table}: {e}")
                errors.append(f"{table}: {str(e)[:100]}")

    status = "success" if not errors else "error"
    error_msg = "; ".join(errors[:3]) if errors else None
    logger.info(f"Sync completado: {tables_synced} tablas, {total_records} registros — {status}")

    _write_sync_log(engine, status, tables_synced, total_records, started_at, error_msg)


def send_daily_report() -> None:
    """Envía resumen diario de ventas vía WhatsApp Business Cloud API."""
    whatsapp_token = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
    whatsapp_phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    whatsapp_to = os.getenv("WHATSAPP_REPORT_TO", "")

    if not all([whatsapp_token, whatsapp_phone_id, whatsapp_to]):
        logger.debug("WhatsApp no configurado — omitiendo reporte diario")
        return

    try:
        import httpx
        from sqlalchemy import create_engine, text as sql_text

        db_url = LOCAL_DB_URL.replace("postgresql://", "postgresql+psycopg2://", 1)
        engine = create_engine(db_url, pool_pre_ping=True)
        today = datetime.utcnow().date()

        with engine.connect() as conn:
            row = conn.execute(
                sql_text(
                    "SELECT COUNT(*) as txn, COALESCE(SUM(total_amount),0) as total "
                    "FROM sales WHERE DATE(created_at) = :today"
                ),
                {"today": today},
            ).first()
            txn = row.txn if row else 0
            total = float(row.total) if row else 0.0

        msg = (
            f"*Resumen del día — {today.strftime('%d/%m/%Y')}*\n"
            f"Transacciones: {txn}\n"
            f"Total ventas: ${total:,.0f}\n"
            f"Sucursal: {BRANCH_ID}"
        )

        httpx.post(
            f"https://graph.facebook.com/v18.0/{whatsapp_phone_id}/messages",
            headers={"Authorization": f"Bearer {whatsapp_token}"},
            json={
                "messaging_product": "whatsapp",
                "to": whatsapp_to,
                "type": "text",
                "text": {"body": msg},
            },
            timeout=10,
        )
        logger.info("Reporte diario enviado por WhatsApp")
    except Exception as e:
        logger.error(f"Error enviando reporte WhatsApp: {e}")


# ──────────────────────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(description="Nexo Sync Worker")
    parser.add_argument("--once", action="store_true", help="Ejecutar una sola vez y salir")
    args = parser.parse_args()

    if args.once:
        sync_to_cloud(once=True)
        return

    logger.info("Sync Worker iniciado — sync cada 30 minutos")
    schedule.every(30).minutes.do(sync_to_cloud)
    schedule.every().day.at("22:00").do(send_daily_report)

    # Primera ejecución inmediata
    sync_to_cloud()

    while True:
        schedule.run_pending()
        time.sleep(60)


if __name__ == "__main__":
    main()
