"""JWT and PIN security utilities using python-jose."""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta
from typing import Any

from jose import JWTError, jwt

from app.core.config import settings


ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"
TOKEN_ALGORITHM = "HS256"
PIN_HASH_PREFIX = "pin$"


class TokenError(ValueError):
    pass


def create_access_token(*, user_id: str, role: str) -> tuple[str, int]:
    expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    now = datetime.utcnow()
    expire = now + expires_delta
    payload: dict[str, Any] = {
        "sub": user_id,
        "role": role,
        "type": ACCESS_TOKEN_TYPE,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=TOKEN_ALGORITHM)
    return token, int(expires_delta.total_seconds())


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[TOKEN_ALGORITHM])
    except JWTError as exc:
        raise TokenError(str(exc)) from exc
    if payload.get("type") != ACCESS_TOKEN_TYPE:
        raise TokenError("Invalid token type")
    return payload


def create_refresh_token_value() -> str:
    """Return a cryptographically random 64-hex-character opaque refresh token."""
    return secrets.token_hex(32)


def hash_pin(pin: str) -> str:
    normalized_pin = str(pin).strip()
    digest = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        normalized_pin.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{PIN_HASH_PREFIX}{digest}"


def is_hashed_pin(value: str) -> bool:
    return str(value).startswith(PIN_HASH_PREFIX)


def verify_pin(pin: str, stored_value: str) -> bool:
    normalized_pin = str(pin).strip()
    stored_pin = str(stored_value)
    if is_hashed_pin(stored_pin):
        return hmac.compare_digest(stored_pin, hash_pin(normalized_pin))
    return hmac.compare_digest(stored_pin, normalized_pin)
