from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    worker_name: str = "Choosing Clothes Worker"
    worker_log_level: str = "INFO"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
