"""
Bootstrap helper for Windows/Linux installers.

This script can:
1. Write a deterministic .env file for the backend.
2. Initialize schema and minimal production data.
3. Optionally load the full demo dataset via seed.py.
"""
from __future__ import annotations

import argparse
import os
import secrets
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent
ENV_PATH = ROOT_DIR / ".env"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bootstrap MiniMarket POS backend")
    parser.add_argument("--database-url", required=True)
    parser.add_argument("--server-host", default="0.0.0.0")
    parser.add_argument("--server-port", type=int, default=8000)
    parser.add_argument("--secret-key", default="")
    parser.add_argument("--store-name", default="MiniMarket POS")
    parser.add_argument("--store-rut", default="")
    parser.add_argument("--store-address", default="")
    parser.add_argument("--cors-origins", default="http://localhost:5174,http://127.0.0.1:5174")
    parser.add_argument("--admin-pin", default="1234")
    parser.add_argument("--cashier-pin", default="0000")
    parser.add_argument("--admin-name", default="Administrador")
    parser.add_argument("--cashier-name", default="Cajero 1")
    parser.add_argument("--register-count", type=int, default=3)
    parser.add_argument("--overwrite-env", action="store_true")
    parser.add_argument("--with-demo-data", action="store_true")
    return parser.parse_args()


def build_env_lines(args: argparse.Namespace) -> list[str]:
    secret_key = args.secret_key or secrets.token_urlsafe(32)
    return [
        f"DATABASE_URL={args.database_url}",
        f"SERVER_HOST={args.server_host}",
        f"SERVER_PORT={args.server_port}",
        f"SECRET_KEY={secret_key}",
        "SUPABASE_URL=",
        "SUPABASE_KEY=",
        f"STORE_NAME={args.store_name}",
        f"STORE_RUT={args.store_rut}",
        f"STORE_ADDRESS={args.store_address}",
        f"CORS_ORIGINS={args.cors_origins}",
        "",
        "# SII Boleta Electronica",
        "SII_ENABLED=false",
        "SII_AMBIENTE=certification",
        "SII_CERT_PFX_PATH=",
        "SII_CERT_PFX_PASSWORD=",
        "SII_CAF_XML_PATH=",
        "STORE_GIRO=",
        "STORE_ACTECO=521010",
        "STORE_COMUNA=Santiago",
        "STORE_CIUDAD=Santiago",
    ]


def write_env(args: argparse.Namespace) -> None:
    if ENV_PATH.exists() and not args.overwrite_env:
        print(f".env already exists at {ENV_PATH}; keeping existing file")
        return

    ENV_PATH.write_text("\n".join(build_env_lines(args)) + "\n", encoding="utf-8")
    print(f"Wrote environment file to {ENV_PATH}")


def ensure_base_data(args: argparse.Namespace) -> None:
    from app.db.base import Base
    from app.db.session import SessionLocal, engine
    from app.models import CashRegister, User
    from seed import migrate, seed as seed_demo_data

    Base.metadata.create_all(bind=engine)
    migrate()

    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            db.add(
                User(
                    username="admin",
                    pin=args.admin_pin,
                    full_name=args.admin_name,
                    role="admin",
                )
            )

        cashier = db.query(User).filter(User.username == "cajero1").first()
        if not cashier:
            db.add(
                User(
                    username="cajero1",
                    pin=args.cashier_pin,
                    full_name=args.cashier_name,
                    role="cashier",
                )
            )

        for index in range(1, args.register_count + 1):
            register_name = f"Caja {index}"
            exists = db.query(CashRegister).filter(CashRegister.name == register_name).first()
            if not exists:
                db.add(CashRegister(name=register_name))

        db.commit()
    finally:
        db.close()

    if args.with_demo_data:
        seed_demo_data()
        print("Demo data loaded.")

    print("Schema and base data initialized.")


def main() -> None:
    args = parse_args()

    if args.admin_pin == args.cashier_pin:
        raise SystemExit("admin-pin and cashier-pin must be different")

    if not args.secret_key:
        args.secret_key = secrets.token_urlsafe(32)

    os.environ["DATABASE_URL"] = args.database_url
    os.environ["SERVER_HOST"] = args.server_host
    os.environ["SERVER_PORT"] = str(args.server_port)
    os.environ["SECRET_KEY"] = args.secret_key
    os.environ["STORE_NAME"] = args.store_name
    os.environ["STORE_RUT"] = args.store_rut
    os.environ["STORE_ADDRESS"] = args.store_address
    os.environ["CORS_ORIGINS"] = args.cors_origins

    write_env(args)
    ensure_base_data(args)


if __name__ == "__main__":
    main()
