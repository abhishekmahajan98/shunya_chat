from pydantic_settings import BaseSettings, SettingsConfigDict


class BaseConfig(BaseSettings):
    """Base configuration with common settings and environment variables."""

    # Database (Supabase)
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""

    # App Settings
    ENV: str = "base"
    DEBUG: bool = False
    FRONTEND_URL: str = "http://localhost:5173"

    # Kept optional for forward-compat; not required by the stub backend
    GOOGLE_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
