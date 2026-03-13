import argparse
import base64
import json
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey


PRODUCT_CODE = "nexo-pos"


def _to_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _json_dumps(value: dict[str, Any]) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def _load_request_payload(request_code: str | None, request_file: str | None) -> dict[str, Any]:
    if bool(request_code) == bool(request_file):
        raise ValueError("Debes indicar exactamente uno: --request-code o --request-file")

    raw = request_code
    if request_file:
        raw = Path(request_file).read_text(encoding="utf-8").strip()

    assert raw is not None
    try:
        if raw.startswith("{"):
            payload = json.loads(raw)
        else:
            padding = "=" * (-len(raw) % 4)
            payload = json.loads(base64.urlsafe_b64decode(f"{raw}{padding}".encode("ascii")))
    except Exception as exc:
        raise ValueError("No se pudo leer el codigo de activacion") from exc

    if not isinstance(payload, dict):
        raise ValueError("La solicitud de activacion no tiene un formato valido")
    if payload.get("product") != PRODUCT_CODE:
        raise ValueError("La solicitud no corresponde a este producto")
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description="Emite una licencia offline firmada para Nexo.")
    parser.add_argument("--private-key", required=True, help="Ruta del PEM privado Ed25519")
    parser.add_argument("--request-code", help="Codigo de activacion copiado desde el sistema")
    parser.add_argument("--request-file", help="Archivo con el request JSON o el request_code")
    parser.add_argument("--customer", required=True, help="Nombre del cliente")
    parser.add_argument("--license-id", help="Identificador de licencia")
    parser.add_argument("--max-registers", type=int, help="Cantidad maxima de cajas")
    parser.add_argument("--updates-until", help="Fecha ISO de actualizaciones incluidas")
    parser.add_argument("--expires-at", help="Fecha ISO de expiracion")
    parser.add_argument("--duration-days", type=int, help="Duracion desde hoy si no es perpetua")
    parser.add_argument("--feature", action="append", default=[], help="Feature habilitada")
    parser.add_argument("--license-type", default="perpetual", help="Tipo de licencia")
    parser.add_argument("--out", required=True, help="Archivo de salida .json")
    args = parser.parse_args()

    request_payload = _load_request_payload(args.request_code, args.request_file)
    issued_at = datetime.now(timezone.utc)
    expires_at = None
    if args.expires_at:
        expires_at = datetime.fromisoformat(args.expires_at.replace("Z", "+00:00"))
    elif args.duration_days:
        expires_at = issued_at + timedelta(days=args.duration_days)

    updates_until = None
    if args.updates_until:
        updates_until = datetime.fromisoformat(args.updates_until.replace("Z", "+00:00"))

    payload = {
        "product": PRODUCT_CODE,
        "license_id": args.license_id or f"LIC-{issued_at.year}-{uuid.uuid4().hex[:8].upper()}",
        "customer_name": args.customer,
        "installation_id": request_payload["installation_id"],
        "hardware_hash": request_payload["hardware_hash"],
        "issued_at": _to_iso(issued_at),
        "expires_at": _to_iso(expires_at),
        "updates_until": _to_iso(updates_until),
        "max_registers": args.max_registers,
        "features": [feature for feature in args.feature if feature],
        "license_type": args.license_type,
    }

    private_key = serialization.load_pem_private_key(
        Path(args.private_key).read_bytes(),
        password=None,
    )
    if not isinstance(private_key, Ed25519PrivateKey):
        raise ValueError("La clave privada debe ser Ed25519")

    signature = private_key.sign(_json_dumps(payload))
    document = {
        "payload": payload,
        "signature": base64.b64encode(signature).decode("ascii"),
    }

    output_path = Path(args.out)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(document, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Licencia emitida en: {output_path.resolve()}")


if __name__ == "__main__":
    main()
