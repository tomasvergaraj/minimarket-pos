import base64
import hashlib
import hmac
import json
import time
from datetime import UTC, datetime, timedelta
from typing import Any

from app.core.config import settings


ACCESS_TOKEN_TYPE = "access"
TOKEN_ALGORITHM = "HS256"
PIN_HASH_PREFIX = "pin$"


class TokenError(ValueError):
    pass


def _base64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _base64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}".encode("ascii"))


def _json_dumps(value: dict[str, Any]) -> bytes:
    return json.dumps(value, separators=(",", ":"), sort_keys=True).encode("utf-8")


def _sign(message: bytes) -> str:
    digest = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        message,
        hashlib.sha256,
    ).digest()
    return _base64url_encode(digest)


def create_access_token(*, user_id: str, role: str) -> tuple[str, int]:
    now = datetime.now(UTC)
    expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    expires_at = now + expires_delta

    header = {"alg": TOKEN_ALGORITHM, "typ": "JWT"}
    payload = {
        "sub": user_id,
        "role": role,
        "type": ACCESS_TOKEN_TYPE,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }

    encoded_header = _base64url_encode(_json_dumps(header))
    encoded_payload = _base64url_encode(_json_dumps(payload))
    encoded_signature = _sign(f"{encoded_header}.{encoded_payload}".encode("ascii"))

    token = f"{encoded_header}.{encoded_payload}.{encoded_signature}"
    return token, int(expires_delta.total_seconds())


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        encoded_header, encoded_payload, encoded_signature = token.split(".")
    except ValueError as exc:
        raise TokenError("Invalid token format") from exc

    expected_signature = _sign(f"{encoded_header}.{encoded_payload}".encode("ascii"))
    if not hmac.compare_digest(encoded_signature, expected_signature):
        raise TokenError("Invalid token signature")

    try:
        header = json.loads(_base64url_decode(encoded_header))
        payload = json.loads(_base64url_decode(encoded_payload))
    except (ValueError, json.JSONDecodeError) as exc:
        raise TokenError("Invalid token encoding") from exc

    if header.get("alg") != TOKEN_ALGORITHM:
        raise TokenError("Unsupported token algorithm")
    if payload.get("type") != ACCESS_TOKEN_TYPE:
        raise TokenError("Invalid token type")

    expires_at = payload.get("exp")
    if not isinstance(expires_at, (int, float)):
        raise TokenError("Token expiry missing")
    if int(expires_at) <= int(time.time()):
        raise TokenError("Token expired")

    return payload


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
