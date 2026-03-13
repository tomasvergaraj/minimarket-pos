import argparse
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey


def main() -> None:
    parser = argparse.ArgumentParser(description="Genera un par Ed25519 para firmar licencias offline.")
    parser.add_argument("--private-out", required=True, help="Ruta del archivo PEM privado")
    parser.add_argument("--public-out", required=True, help="Ruta del archivo PEM publico")
    args = parser.parse_args()

    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key()

    private_path = Path(args.private_out)
    public_path = Path(args.public_out)
    private_path.parent.mkdir(parents=True, exist_ok=True)
    public_path.parent.mkdir(parents=True, exist_ok=True)

    private_path.write_bytes(
        private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )
    public_path.write_bytes(
        public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
    )

    print(f"Private key: {private_path.resolve()}")
    print(f"Public key:  {public_path.resolve()}")
    print("Guarda la clave privada fuera del servidor. Configura LICENSE_PUBLIC_KEY_PATH con la clave publica.")


if __name__ == "__main__":
    main()
