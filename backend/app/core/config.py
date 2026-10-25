"""Runtime configuration. Secrets come from the environment; commit only .env.example."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    # PostgreSQL primary (docker-compose); SQLite URL works for local tests with the same migrations.
    database_url: str = 'sqlite:///./data/muletrace.db'
    upload_dir: str = 'data/incoming'
    max_upload_bytes: int = 25 * 1024 * 1024  # laptop-scale guard
    max_csv_rows: int = 500_000
    app_name: str = 'MuleTrace Investigation API'


settings = Settings()
