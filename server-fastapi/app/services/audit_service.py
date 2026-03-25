import json
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog

# ── Action constants ──────────────────────────────────────────────────────────
SALE_VOID = "SALE_VOID"
PRICE_CHANGE = "PRICE_CHANGE"
STOCK_ADJUSTMENT = "STOCK_ADJUSTMENT"
PRODUCT_CREATE = "PRODUCT_CREATE"
PRODUCT_DELETE = "PRODUCT_DELETE"
USER_CREATE = "USER_CREATE"
USER_UPDATE = "USER_UPDATE"
USER_DEACTIVATE = "USER_DEACTIVATE"
SESSION_OPEN = "SESSION_OPEN"
SESSION_CLOSE = "SESSION_CLOSE"
PURCHASE_RECEIVE = "PURCHASE_RECEIVE"
EXPENSE_CREATE = "EXPENSE_CREATE"


def log_action(
    db: Session,
    *,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    detail: dict[str, Any] | None = None,
    user_id: str | None = None,
    username: str | None = None,
    ip_address: str | None = None,
) -> None:
    """
    Append an audit entry. Does NOT commit — caller is responsible.
    Silently swallows errors so a log failure never breaks a transaction.
    """
    try:
        entry = AuditLog(
            timestamp=datetime.utcnow(),
            user_id=user_id,
            username=username,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id else None,
            detail=json.dumps(detail, default=str) if detail else None,
            ip_address=ip_address,
        )
        db.add(entry)
    except Exception:
        pass
