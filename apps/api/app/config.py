from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Choosing Clothes API"
    app_env: str = "development"
    api_port: int = 8765
    database_url: str = "postgresql+psycopg://postgres:postgres@127.0.0.1:55432/choosing_clothes"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
