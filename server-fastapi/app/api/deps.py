from fastapi import Header, HTTPException


def require_admin(x_user_role: str | None = Header(default=None, alias="X-User-Role")) -> None:
    if (x_user_role or "").lower() != "admin":
        raise HTTPException(
            status_code=403,
            detail={"code": "FORBIDDEN", "message": "Admin role required"},
        )
