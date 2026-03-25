from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.models.audit_log import AuditLog
from app.schemas.audit_log import AuditLogOut

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/", response_model=list[AuditLogOut], dependencies=[Depends(require_admin)])
def list_audit_logs(
    db: Session = Depends(get_db),
    action: str | None = Query(None),
    entity_type: str | None = Query(None),
    user_id: str | None = Query(None),
    from_date: datetime | None = Query(None),
    to_date: datetime | None = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
):
    q = db.query(AuditLog)
    if action:
        q = q.filter(AuditLog.action == action)
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if user_id:
        q = q.filter(AuditLog.user_id == user_id)
    if from_date:
        q = q.filter(AuditLog.timestamp >= from_date)
    if to_date:
        q = q.filter(AuditLog.timestamp <= to_date)
    return q.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()
