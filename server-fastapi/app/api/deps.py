from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import TokenError, decode_access_token
from app.db.session import get_db
from app.models.user import User
from app.services.license_service import LicenseError, ensure_operational_license


bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail={"code": "AUTH_REQUIRED", "message": "Authentication required"},
        )

    try:
        payload = decode_access_token(credentials.credentials)
    except TokenError as exc:
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_TOKEN", "message": str(exc)},
        ) from exc

    user_id = payload.get("sub")
    role = payload.get("role")
    if not user_id or not isinstance(role, str):
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_TOKEN", "message": "Token payload is invalid"},
        )

    user = (
        db.query(User)
        .filter(User.id == user_id, User.is_active == True)
        .first()
    )
    if not user:
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_TOKEN", "message": "User is no longer available"},
        )

    if user.role != role:
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_TOKEN", "message": "Token role is no longer valid"},
        )

    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail={"code": "FORBIDDEN", "message": "Admin role required"},
        )
    return current_user


def require_operational_license(db: Session = Depends(get_db)) -> None:
    try:
        ensure_operational_license(db)
    except LicenseError as exc:
        raise HTTPException(
            status_code=403,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
