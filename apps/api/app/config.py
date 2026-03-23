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
    replicate_api_token: str = ""

    # AI 试穿服务商："replicate" 或 "huggingface"
    tryon_provider: str = "replicate"
    # HuggingFace token（可选，不填也能用免费额度，填了速度更快）
    hf_token: str = ""
    # HuggingFace Space ID，默认官方 IDM-VTON
    hf_tryon_space: str = "yisol/IDM-VTON"

    model_config = SettingsConfigDict(
        env_file=[str(REPO_ROOT / ".env"), ".env"],
        extra="ignore",
    )


settings = Settings()
