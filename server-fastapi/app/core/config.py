from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/minimarket_pos"
    SERVER_HOST: str = "0.0.0.0"
    SERVER_PORT: int = 8000
    SECRET_KEY: str = "change-me-in-production"
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    STORE_NAME: str = "MiniMarket POS"
    STORE_RUT: str = ""
    STORE_ADDRESS: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
