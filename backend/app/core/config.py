"""Runtime configuration. Secrets come from the environment; commit only .env.example."""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    # PostgreSQL primary (docker-compose); SQLite URL works for local tests with the same migrations.
    # Default resolves against the repo root regardless of launch directory.
    database_url: str = f'sqlite:///{REPO_ROOT / "data" / "muletrace.db"}'
    upload_dir: str = str(REPO_ROOT / 'data' / 'incoming')
    historical_dir: str = str(REPO_ROOT / 'data' / 'historical')
    artifacts_dir: str = str(REPO_ROOT / 'artifacts')
    reports_dir: str = str(REPO_ROOT / 'reports')
    max_upload_bytes: int = 25 * 1024 * 1024  # laptop-scale guard
    max_csv_rows: int = 500_000
    app_name: str = 'Suraag Investigation API'
    # Browser UIs call the API cross-origin; allow only explicit local/preview origins.
    cors_origins: str = 'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173,http://localhost:4173,https://redesign.muletrace-5gm.pages.dev'


settings = Settings()
