from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]
UPLOAD_ROOT = REPO_ROOT / "uploads"


class Settings(BaseSettings):
    app_name: str = "Choosing Clothes API"
    app_env: str = "development"
    api_port: int = 8765
    database_url: str = "postgresql+psycopg://postgres:postgres@127.0.0.1:55432/choosing_clothes"
    upload_dir: str = str(UPLOAD_ROOT)

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
