"""T008 - Application configuration loaded from environment variables."""

import os

from dotenv import load_dotenv

load_dotenv()

try:
    from pydantic_settings import BaseSettings

    class Settings(BaseSettings):
        DATABASE_URL: str = "postgresql://localhost:6543/postgres"
        SUPABASE_SERVICE_KEY: str = ""
        FRONTEND_URL: str = "http://localhost:3000"
        DB_POOL_MAX_SIZE: int = 40

        class Config:
            env_file = ".env"

except ImportError:

    class Settings:  # type: ignore[no-redef]
        def __init__(self) -> None:
            self.DATABASE_URL: str = os.environ.get(
                "DATABASE_URL", "postgresql://localhost:6543/postgres"
            )
            self.SUPABASE_SERVICE_KEY: str = os.environ.get(
                "SUPABASE_SERVICE_KEY", ""
            )
            self.FRONTEND_URL: str = os.environ.get(
                "FRONTEND_URL", "http://localhost:3000"
            )
            self.DB_POOL_MAX_SIZE: int = int(os.environ.get(
                "DB_POOL_MAX_SIZE", "40"
            ))


settings = Settings()
