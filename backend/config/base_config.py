from pydantic_settings import BaseSettings, SettingsConfigDict


class BaseConfig(BaseSettings):
    """Application settings."""

    ENV: str = "base"
    DEBUG: bool = False
    FRONTEND_URL: str = "http://localhost:5173"

    # Supabase (optional — falls back to in-memory store when unset)
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""

    # Dummy auth (real Supabase Auth later)
    DUMMY_USER_ID: str = "00000000-0000-4000-8000-000000000001"
    DUMMY_USER_EMAIL: str = "demo@shunya.local"
    DUMMY_USER_NAME: str = "Demo User"

    # LLM keys (at least one needed for real agent runs)
    GOOGLE_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    PERPLEXITY_API_KEY: str = ""
    PERPLEXITY_MODEL: str = "sonar"
    MODEL: str = "google_genai:gemini-3.8-flash"
    MODEL_BASE_URL: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
