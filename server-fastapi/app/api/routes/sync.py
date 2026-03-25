from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.core.config import ROOT_DIR, settings
from app.core.limiter import limiter
from app.models.sync_log import SyncLog
from app.schemas.sync import SyncConfigOut, SyncConfigUpdate, SyncLogOut, SyncStatus

router = APIRouter(prefix="/sync", tags=["sync"])


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _last_log(db: Session) -> SyncLog | None:
    return db.query(SyncLog).order_by(SyncLog.started_at.desc()).first()


def _recent_logs(db: Session, limit: int = 10) -> list[SyncLog]:
    return db.query(SyncLog).order_by(SyncLog.started_at.desc()).limit(limit).all()


def _mask_key(key: str) -> str:
    if not key:
        return ""
    if len(key) <= 8:
        return "*" * len(key)
    return key[:4] + "…" + key[-4:]


def _update_env_file(updates: dict[str, str]) -> None:
    env_path = ROOT_DIR / ".env"
    lines: list[str] = []
    if env_path.exists():
        lines = env_path.read_text(encoding="utf-8").splitlines()

    found = {k: False for k in updates}
    new_lines: list[str] = []
    for line in lines:
        key = line.split("=", 1)[0].strip()
        if key in updates:
            new_lines.append(f"{key}={updates[key]}")
            found[key] = True
        else:
            new_lines.append(line)
    for key, was_found in found.items():
        if not was_found:
            new_lines.append(f"{key}={updates[key]}")

    env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")


# ──────────────────────────────────────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/status", response_model=SyncStatus, dependencies=[Depends(require_admin)])
def get_sync_status(db: Session = Depends(get_db)):
    branch_id = getattr(settings, "BRANCH_ID", "default") or "default"
    return SyncStatus(
        configured=bool(settings.SUPABASE_URL and settings.SUPABASE_KEY),
        branch_id=branch_id,
        last_sync=_last_log(db),
        recent_logs=_recent_logs(db),
    )


@router.get("/config", response_model=SyncConfigOut, dependencies=[Depends(require_admin)])
def get_sync_config():
    branch_id = getattr(settings, "BRANCH_ID", "default") or "default"
    return SyncConfigOut(
        supabase_url=settings.SUPABASE_URL,
        supabase_key_masked=_mask_key(settings.SUPABASE_KEY),
        branch_id=branch_id,
        sync_enabled=bool(settings.SUPABASE_URL and settings.SUPABASE_KEY),
    )


@router.put("/config", dependencies=[Depends(require_admin)])
def update_sync_config(data: SyncConfigUpdate):
    updates: dict[str, str] = {
        "SUPABASE_URL": data.supabase_url,
        "BRANCH_ID": data.branch_id,
    }
    # Only update the key if a real value was provided (not the "(keep)" sentinel)
    keep_key = not data.supabase_key or data.supabase_key.strip() in ("", "(keep)")
    if not keep_key:
        updates["SUPABASE_KEY"] = data.supabase_key

    _update_env_file(updates)
    settings.SUPABASE_URL = data.supabase_url
    if not keep_key:
        settings.SUPABASE_KEY = data.supabase_key
    if hasattr(settings, "BRANCH_ID"):
        settings.BRANCH_ID = data.branch_id
    return {"success": True}


@router.post("/trigger", dependencies=[Depends(require_admin)])
@limiter.limit("5/minute")
def trigger_sync(request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        raise HTTPException(status_code=400, detail="Supabase no está configurado")

    # Prevent double-trigger: if a sync started in the last 2 minutes and is still "running"
    last = _last_log(db)
    if last and last.status == "running":
        age = (datetime.utcnow() - last.started_at).total_seconds()
        if age < 120:
            raise HTTPException(status_code=409, detail="Ya hay una sincronización en curso")

    # Create a pending log entry so the UI can show "running"
    log = SyncLog(
        branch_id=getattr(settings, "BRANCH_ID", "default") or "default",
        started_at=datetime.utcnow(),
        status="running",
        tables_synced=0,
        records_synced=0,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    background_tasks.add_task(_run_sync_bg, log.id)
    return {"message": "Sincronización iniciada", "log_id": log.id}


def _run_sync_bg(log_id: int) -> None:
    from app.db.session import SessionLocal
    from app.services.cloud_sync_service import run_sync

    with SessionLocal() as db:
        log = db.get(SyncLog, log_id)
        if not log:
            return
        try:
            result = run_sync(db)
            log.status = result["status"]
            log.tables_synced = result["tables_synced"]
            log.records_synced = result["records_synced"]
            log.error_message = result.get("error_message")
        except Exception as exc:
            log.status = "error"
            log.error_message = str(exc)[:500]
        finally:
            log.completed_at = datetime.utcnow()
            db.commit()
