from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ROOT_DIR / ".env",
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        extra="ignore",
    )

    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/minimarket_pos"
    SERVER_HOST: str = "0.0.0.0"
    SERVER_PORT: int = 8000
    SECRET_KEY: str = "change-me-in-production"
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    STORE_NAME: str = "MiniMarket POS"
    STORE_RUT: str = ""
    STORE_ADDRESS: str = ""
    CORS_ORIGINS: str = "http://localhost:5174,http://127.0.0.1:5174"

    # SII Boleta Electrónica (todos opcionales — la integración se desactiva si faltan)
    SII_ENABLED: bool = False
    SII_CERT_PFX_PATH: str = ""       # ruta absoluta al archivo .pfx
    SII_CERT_PFX_PASSWORD: str = ""   # contraseña del .pfx
    SII_CAF_XML_PATH: str = ""        # ruta absoluta al archivo CAF XML de SII
    STORE_GIRO: str = ""              # giro comercial, ej: "COMERCIO AL POR MENOR"
    STORE_ACTECO: int = 0             # código actividad económica SII, ej: 521010
    STORE_COMUNA: str = ""            # ej: "Santiago"
    STORE_CIUDAD: str = ""            # ej: "Santiago"
    SII_AMBIENTE: str = "certification"  # "certification" | "production"

    @property
    def SII_BASE_URL(self) -> str:
        if self.SII_AMBIENTE == "production":
            return "https://palena.sii.cl"
        return "https://maullin.sii.cl"

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls,
        init_settings,
        env_settings,
        dotenv_settings,
        file_secret_settings,
    ):
        # In this project the local backend .env is the source of truth.
        # Put dotenv ahead of process env so stale launcher variables do not
        # silently disable SII or clear certificate/CAF paths.
        return init_settings, dotenv_settings, env_settings, file_secret_settings


settings = Settings()
