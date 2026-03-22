from __future__ import annotations

import base64
import hashlib
import json
import platform
import socket
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.cash_register import CashRegister
from app.models.license_state import LicenseState


PRODUCT_CODE = "nexo-pos"
REQUEST_VERSION = 1


class LicenseError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def _utcnow() -> datetime:
    return datetime.utcnow()


def _to_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.replace(microsecond=0).isoformat() + "Z"


def _parse_datetime(value: Any) -> datetime | None:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        parsed = value
    else:
        raw = str(value).strip()
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        parsed = datetime.fromisoformat(raw)
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def _json_dumps(value: dict[str, Any]) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def _b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _serialize_features(features: list[str] | None) -> str | None:
    if not features:
        return None
    normalized = sorted({str(feature).strip() for feature in features if str(feature).strip()})
    return json.dumps(normalized, ensure_ascii=False)


def _deserialize_features(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return [str(item) for item in parsed if str(item).strip()]


def _read_machine_guid() -> str:
    if platform.system().lower() == "windows":
        try:
            import winreg

            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Cryptography") as key:
                value, _ = winreg.QueryValueEx(key, "MachineGuid")
                if value:
                    return str(value)
        except OSError:
            pass

    for candidate in ("/etc/machine-id", "/var/lib/dbus/machine-id"):
        path = Path(candidate)
        if not path.exists():
            continue
        try:
            value = path.read_text(encoding="utf-8").strip()
        except OSError:
            continue
        if value:
            return value

    return ""


def _read_windows_hw_profile_guid() -> str:
    if platform.system().lower() != "windows":
        return ""

    try:
        import winreg

        with winreg.OpenKey(
            winreg.HKEY_LOCAL_MACHINE,
            r"SYSTEM\CurrentControlSet\Control\IDConfigDB\Hardware Profiles\0001",
        ) as key:
            value, _ = winreg.QueryValueEx(key, "HwProfileGuid")
            if value:
                return str(value)
    except OSError:
        pass

    return ""


def _hash_hardware_components(components: dict[str, Any]) -> str:
    normalized = {
        key: str(value).strip()
        for key, value in components.items()
        if str(value).strip()
    }
    if not normalized:
        normalized = {"fallback": "unknown-hardware"}
    return hashlib.sha256(_json_dumps(normalized)).hexdigest()


def _build_primary_hardware_components() -> dict[str, str]:
    components = {
        "hostname": socket.gethostname(),
        "machine_id": _read_machine_guid(),
    }
    hw_profile_guid = _read_windows_hw_profile_guid()
    if hw_profile_guid:
        components["hw_profile_guid"] = hw_profile_guid

    if any(str(value).strip() for value in components.values()):
        return components

    return {"mac_address": f"{uuid.getnode():012x}"}


def _build_legacy_hardware_components() -> dict[str, str]:
    return {
        "hostname": socket.gethostname(),
        "machine_id": _read_machine_guid(),
        "mac_address": f"{uuid.getnode():012x}",
        "platform": platform.platform(),
        "processor": platform.processor(),
    }


def get_current_hardware_hashes() -> list[str]:
    hashes: list[str] = []
    for components in (_build_primary_hardware_components(), _build_legacy_hardware_components()):
        candidate = _hash_hardware_components(components)
        if candidate not in hashes:
            hashes.append(candidate)
    return hashes


def get_current_hardware_hash() -> str:
    return get_current_hardware_hashes()[0]


def _load_public_key() -> Ed25519PublicKey | None:
    path_text = settings.LICENSE_PUBLIC_KEY_PATH.strip()
    if not path_text:
        return None

    path = Path(path_text)
    if not path.exists():
        raise LicenseError("LICENSE_PUBLIC_KEY_MISSING", f"No se encontró la clave pública: {path}")

    try:
        public_key = serialization.load_pem_public_key(path.read_bytes())
    except ValueError as exc:
        raise LicenseError("LICENSE_PUBLIC_KEY_INVALID", "La clave pública no tiene un PEM válido") from exc

    if not isinstance(public_key, Ed25519PublicKey):
        raise LicenseError("LICENSE_PUBLIC_KEY_INVALID", "La clave pública debe ser Ed25519")
    return public_key


def is_verification_ready() -> bool:
    try:
        return _load_public_key() is not None
    except LicenseError:
        return False


def _get_or_create_state(db: Session) -> LicenseState:
    state = db.query(LicenseState).first()
    if state:
        return state

    now = _utcnow()
    state = LicenseState(
        installation_id=str(uuid.uuid4()),
        hardware_hash=get_current_hardware_hash(),
        status="trial",
        trial_started_at=now,
        trial_expires_at=now + timedelta(days=settings.LICENSE_TRIAL_DAYS),
        last_seen_at=now,
        max_seen_at=now,
    )
    db.add(state)
    db.commit()
    db.refresh(state)
    return state


def _build_request_payload(state: LicenseState, current_hardware_hash: str) -> dict[str, Any]:
    return {
        "version": REQUEST_VERSION,
        "product": PRODUCT_CODE,
        "installation_id": state.installation_id,
        "hardware_hash": current_hardware_hash,
        "store_name": settings.STORE_NAME,
        "store_rut": settings.STORE_RUT,
        "generated_at": _to_iso(_utcnow()),
    }


def _build_status_snapshot(
    *,
    state: LicenseState,
    current_hardware_hash: str,
    status: str,
    message: str,
    is_active: bool,
    verification_ready: bool,
    trial_days_remaining: int | None,
    register_count: int,
) -> dict[str, Any]:
    request_payload = _build_request_payload(state, current_hardware_hash)
    return {
        "status": status,
        "message": message,
        "is_active": is_active,
        "verification_ready": verification_ready,
        "installation_id": state.installation_id,
        "hardware_hash": current_hardware_hash,
        "request_code": _b64url_encode(_json_dumps(request_payload)),
        "request_payload_json": json.dumps(request_payload, indent=2, ensure_ascii=False),
        "trial_started_at": state.trial_started_at,
        "trial_expires_at": state.trial_expires_at,
        "trial_days_remaining": trial_days_remaining,
        "activated_at": state.activated_at,
        "license_id": state.license_id,
        "customer_name": state.customer_name,
        "license_type": state.license_type,
        "license_expires_at": state.license_expires_at,
        "updates_until": state.updates_until,
        "max_registers": state.max_registers,
        "features": _deserialize_features(state.features_json),
        "register_count": register_count,
        "last_validation_error": state.validation_error,
    }


def _read_signed_document(license_document: str) -> tuple[dict[str, Any], str]:
    try:
        document = json.loads(license_document)
    except json.JSONDecodeError as exc:
        raise LicenseError("LICENSE_DOCUMENT_INVALID", "El archivo de licencia no es JSON válido") from exc

    if not isinstance(document, dict):
        raise LicenseError("LICENSE_DOCUMENT_INVALID", "El archivo de licencia tiene un formato inválido")

    payload = document.get("payload")
    signature = document.get("signature")
    if not isinstance(payload, dict) or not isinstance(signature, str):
        raise LicenseError("LICENSE_DOCUMENT_INVALID", "La licencia debe incluir payload y signature")
    return payload, signature.strip()


def _verify_payload_for_machine(
    payload: dict[str, Any],
    signature: str,
    *,
    installation_id: str,
    current_hardware_hashes: list[str],
) -> dict[str, Any]:
    public_key = _load_public_key()
    if public_key is None:
        raise LicenseError(
            "LICENSE_PUBLIC_KEY_MISSING",
            "No hay clave pública configurada para verificar licencias",
        )

    try:
        signature_bytes = base64.b64decode(signature.encode("ascii"))
    except ValueError as exc:
        raise LicenseError("LICENSE_DOCUMENT_INVALID", "La firma de la licencia no es válida") from exc

    try:
        public_key.verify(signature_bytes, _json_dumps(payload))
    except InvalidSignature as exc:
        raise LicenseError("LICENSE_SIGNATURE_INVALID", "La firma de la licencia no coincide") from exc

    if str(payload.get("product")) != PRODUCT_CODE:
        raise LicenseError("LICENSE_PRODUCT_INVALID", "La licencia no corresponde a este producto")
    if str(payload.get("installation_id")) != installation_id:
        raise LicenseError("LICENSE_INSTALLATION_MISMATCH", "La licencia no corresponde a esta instalación")
    if str(payload.get("hardware_hash")) not in current_hardware_hashes:
        raise LicenseError("HARDWARE_MISMATCH", "La licencia no corresponde a este servidor")

    license_id = str(payload.get("license_id") or "").strip()
    customer_name = str(payload.get("customer_name") or "").strip()
    issued_at = _parse_datetime(payload.get("issued_at"))
    if not license_id or not customer_name or issued_at is None:
        raise LicenseError("LICENSE_DOCUMENT_INVALID", "La licencia no incluye todos los campos requeridos")

    license_expires_at = _parse_datetime(payload.get("expires_at"))
    if license_expires_at and _utcnow() > license_expires_at:
        raise LicenseError("LICENSE_EXPIRED", "La licencia enviada ya está vencida")

    features = payload.get("features") or []
    if not isinstance(features, list):
        raise LicenseError("LICENSE_DOCUMENT_INVALID", "La licencia tiene un formato de features inválido")

    return {
        "license_id": license_id,
        "customer_name": customer_name,
        "license_type": str(payload.get("license_type") or "perpetual").strip() or "perpetual",
        "issued_at": _to_iso(issued_at),
        "expires_at": _to_iso(license_expires_at),
        "updates_until": _to_iso(_parse_datetime(payload.get("updates_until"))),
        "max_registers": (
            int(payload["max_registers"])
            if payload.get("max_registers") not in (None, "")
            else None
        ),
        "features": [str(feature).strip() for feature in features if str(feature).strip()],
        "product": PRODUCT_CODE,
        "installation_id": installation_id,
        "hardware_hash": current_hardware_hashes[0],
    }


def activate_license_document(db: Session, license_document: str) -> dict[str, Any]:
    state = _get_or_create_state(db)
    current_hardware_hashes = get_current_hardware_hashes()
    current_hardware_hash = current_hardware_hashes[0]
    payload, signature = _read_signed_document(license_document.strip())
    verified_payload = _verify_payload_for_machine(
        payload,
        signature,
        installation_id=state.installation_id,
        current_hardware_hashes=current_hardware_hashes,
    )

    now = _utcnow()
    state.hardware_hash = current_hardware_hash
    state.status = "licensed"
    state.activated_at = now
    state.license_id = verified_payload["license_id"]
    state.customer_name = verified_payload["customer_name"]
    state.license_type = verified_payload["license_type"]
    state.license_expires_at = _parse_datetime(verified_payload.get("expires_at"))
    state.updates_until = _parse_datetime(verified_payload.get("updates_until"))
    state.max_registers = verified_payload.get("max_registers")
    state.features_json = _serialize_features(verified_payload.get("features"))
    state.license_payload = json.dumps(payload, ensure_ascii=False)
    state.license_signature = signature
    state.validation_error = None
    state.last_seen_at = now
    if state.max_seen_at is None or now > state.max_seen_at:
        state.max_seen_at = now

    db.commit()
    db.refresh(state)
    return get_license_status(db)


def _legacy_get_license_status(db: Session) -> dict[str, Any]:
    state = _get_or_create_state(db)
    now = _utcnow()
    current_hardware_hashes = get_current_hardware_hashes()
    current_hardware_hash = current_hardware_hashes[0]
    register_count = db.query(CashRegister).filter(CashRegister.is_active == True).count()
    verification_ready = is_verification_ready()

    if state.max_seen_at and now < state.max_seen_at - timedelta(minutes=settings.LICENSE_CLOCK_SKEW_MINUTES):
        state.status = "clock_tampered"
        state.validation_error = (
            "Se detectó un retroceso importante en el reloj del servidor. "
            "Ajusta la fecha/hora y vuelve a intentar."
        )
        state.last_seen_at = now
        db.commit()
        db.refresh(state)
        return _build_status_snapshot(
            state=state,
            current_hardware_hash=current_hardware_hash,
            status=state.status,
            message=state.validation_error,
            is_active=False,
            verification_ready=verification_ready,
            trial_days_remaining=None,
            register_count=register_count,
        )

    state.last_seen_at = now
    if state.max_seen_at is None or now > state.max_seen_at:
        state.max_seen_at = now

    if state.license_payload and state.license_signature:
        try:
            payload = json.loads(state.license_payload)
            verified_payload = _verify_payload_for_machine(
                payload,
                state.license_signature,
                installation_id=state.installation_id,
                current_hardware_hashes=current_hardware_hashes,
            )
            state.status = "licensed"
            state.validation_error = None
            state.hardware_hash = current_hardware_hash
            state.license_id = verified_payload["license_id"]
            state.customer_name = verified_payload["customer_name"]
            state.license_type = verified_payload["license_type"]
            state.license_expires_at = _parse_datetime(verified_payload.get("expires_at"))
            state.updates_until = _parse_datetime(verified_payload.get("updates_until"))
            state.max_registers = verified_payload.get("max_registers")
            state.features_json = _serialize_features(verified_payload.get("features"))
            db.commit()
            db.refresh(state)
            return _build_status_snapshot(
                state=state,
                current_hardware_hash=current_hardware_hash,
                status="licensed",
                message=f"Licencia activa para {state.customer_name}",
                is_active=True,
                verification_ready=verification_ready,
                trial_days_remaining=None,
                register_count=register_count,
            )
        except (json.JSONDecodeError, LicenseError) as exc:
            if isinstance(exc, LicenseError):
                state.status = exc.code.lower()
                state.validation_error = exc.message
            else:
                state.status = "license_document_invalid"
                state.validation_error = "La licencia guardada no tiene un formato válido"
            db.commit()
            db.refresh(state)
            return _build_status_snapshot(
                state=state,
                current_hardware_hash=current_hardware_hash,
                status=state.status,
                message=state.validation_error,
                is_active=False,
                verification_ready=verification_ready,
                trial_days_remaining=None,
                register_count=register_count,
            )

    if state.hardware_hash in current_hardware_hashes and state.hardware_hash != current_hardware_hash:
        state.status = "hardware_mismatch"
        state.validation_error = (
            "La prueba o licencia estaba asociada a otro servidor. "
            "Genera un nuevo código de activación para reemitir la licencia."
        )
        db.commit()
        db.refresh(state)
        return _build_status_snapshot(
            state=state,
            current_hardware_hash=current_hardware_hash,
            status=state.status,
            message=state.validation_error,
            is_active=False,
            verification_ready=verification_ready,
            trial_days_remaining=None,
            register_count=register_count,
        )

    if now <= state.trial_expires_at:
        remaining_seconds = max((state.trial_expires_at - now).total_seconds(), 0)
        trial_days_remaining = max(0, int((remaining_seconds + 86399) // 86400))
        state.status = "trial"
        state.validation_error = None
        db.commit()
        db.refresh(state)
        return _build_status_snapshot(
            state=state,
            current_hardware_hash=current_hardware_hash,
            status="trial",
            message=f"Prueba activa: quedan {trial_days_remaining} días",
            is_active=True,
            verification_ready=verification_ready,
            trial_days_remaining=trial_days_remaining,
            register_count=register_count,
        )

    state.status = "trial_expired"
    state.validation_error = "La prueba de 30 días terminó. Debes activar una licencia para seguir operando."
    db.commit()
    db.refresh(state)
    return _build_status_snapshot(
        state=state,
        current_hardware_hash=current_hardware_hash,
        status="trial_expired",
        message=state.validation_error,
        is_active=False,
        verification_ready=verification_ready,
        trial_days_remaining=0,
        register_count=register_count,
    )


def get_license_status(db: Session) -> dict[str, Any]:
    state = _get_or_create_state(db)
    now = _utcnow()
    current_hardware_hashes = get_current_hardware_hashes()
    current_hardware_hash = current_hardware_hashes[0]
    register_count = db.query(CashRegister).filter(CashRegister.is_active == True).count()
    verification_ready = is_verification_ready()

    if state.max_seen_at and now < state.max_seen_at - timedelta(minutes=settings.LICENSE_CLOCK_SKEW_MINUTES):
        state.status = "clock_tampered"
        state.validation_error = (
            "Se detecto un retroceso importante en el reloj del servidor. "
            "Ajusta la fecha/hora y vuelve a intentar."
        )
        state.last_seen_at = now
        db.commit()
        db.refresh(state)
        return _build_status_snapshot(
            state=state,
            current_hardware_hash=current_hardware_hash,
            status=state.status,
            message=state.validation_error,
            is_active=False,
            verification_ready=verification_ready,
            trial_days_remaining=None,
            register_count=register_count,
        )

    state.last_seen_at = now
    if state.max_seen_at is None or now > state.max_seen_at:
        state.max_seen_at = now

    if state.license_payload and state.license_signature:
        try:
            payload = json.loads(state.license_payload)
            verified_payload = _verify_payload_for_machine(
                payload,
                state.license_signature,
                installation_id=state.installation_id,
                current_hardware_hashes=current_hardware_hashes,
            )
            state.status = "licensed"
            state.validation_error = None
            state.hardware_hash = current_hardware_hash
            state.license_id = verified_payload["license_id"]
            state.customer_name = verified_payload["customer_name"]
            state.license_type = verified_payload["license_type"]
            state.license_expires_at = _parse_datetime(verified_payload.get("expires_at"))
            state.updates_until = _parse_datetime(verified_payload.get("updates_until"))
            state.max_registers = verified_payload.get("max_registers")
            state.features_json = _serialize_features(verified_payload.get("features"))
            db.commit()
            db.refresh(state)
            return _build_status_snapshot(
                state=state,
                current_hardware_hash=current_hardware_hash,
                status="licensed",
                message=f"Licencia activa para {state.customer_name}",
                is_active=True,
                verification_ready=verification_ready,
                trial_days_remaining=None,
                register_count=register_count,
            )
        except (json.JSONDecodeError, LicenseError) as exc:
            if isinstance(exc, LicenseError):
                state.status = exc.code.lower()
                state.validation_error = exc.message
            else:
                state.status = "license_document_invalid"
                state.validation_error = "La licencia guardada no tiene un formato valido"
            db.commit()
            db.refresh(state)
            return _build_status_snapshot(
                state=state,
                current_hardware_hash=current_hardware_hash,
                status=state.status,
                message=state.validation_error,
                is_active=False,
                verification_ready=verification_ready,
                trial_days_remaining=None,
                register_count=register_count,
            )

    if state.hardware_hash in current_hardware_hashes and state.hardware_hash != current_hardware_hash:
        state.hardware_hash = current_hardware_hash
        db.commit()
        db.refresh(state)
    elif current_hardware_hash != state.hardware_hash:
        # The built-in trial already stores its expiry in the database, so rebinding it
        # avoids false positives after abrupt shutdowns without granting extra days.
        if not state.license_payload and not state.license_signature and now <= state.trial_expires_at:
            state.hardware_hash = current_hardware_hash
            state.status = "trial"
            state.validation_error = None
            db.commit()
            db.refresh(state)
        else:
            state.status = "hardware_mismatch"
            state.validation_error = (
                "La prueba o licencia estaba asociada a otro servidor. "
                "Genera un nuevo codigo de activacion para reemitir la licencia."
            )
            db.commit()
            db.refresh(state)
            return _build_status_snapshot(
                state=state,
                current_hardware_hash=current_hardware_hash,
                status=state.status,
                message=state.validation_error,
                is_active=False,
                verification_ready=verification_ready,
                trial_days_remaining=None,
                register_count=register_count,
            )

    if now <= state.trial_expires_at:
        remaining_seconds = max((state.trial_expires_at - now).total_seconds(), 0)
        trial_days_remaining = max(0, int((remaining_seconds + 86399) // 86400))
        state.status = "trial"
        state.validation_error = None
        db.commit()
        db.refresh(state)
        return _build_status_snapshot(
            state=state,
            current_hardware_hash=current_hardware_hash,
            status="trial",
            message=f"Prueba activa: quedan {trial_days_remaining} dias",
            is_active=True,
            verification_ready=verification_ready,
            trial_days_remaining=trial_days_remaining,
            register_count=register_count,
        )

    state.status = "trial_expired"
    state.validation_error = "La prueba de 30 dias termino. Debes activar una licencia para seguir operando."
    db.commit()
    db.refresh(state)
    return _build_status_snapshot(
        state=state,
        current_hardware_hash=current_hardware_hash,
        status="trial_expired",
        message=state.validation_error,
        is_active=False,
        verification_ready=verification_ready,
        trial_days_remaining=0,
        register_count=register_count,
    )


def ensure_operational_license(db: Session) -> dict[str, Any]:
    status = get_license_status(db)
    if not status["is_active"]:
        raise LicenseError(status["status"].upper(), status["message"])
    return status


def ensure_register_capacity(db: Session) -> dict[str, Any]:
    status = ensure_operational_license(db)
    if status["max_registers"] is None:
        return status
    if status["register_count"] >= status["max_registers"]:
        raise LicenseError(
            "REGISTER_LIMIT_REACHED",
            f"La licencia permite {status['max_registers']} cajas activas. "
            "Compra una ampliación para agregar otra.",
        )
    return status
