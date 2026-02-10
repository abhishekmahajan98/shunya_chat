from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from .constants.agents import AgentModels

class BaseConfig(BaseSettings):
    """Base configuration with common settings and environment variables."""
    
    # API Keys
    GOOGLE_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    
    # Database (Supabase)
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    
    # App Settings
    ENV: str = "base"
    DEBUG: bool = False
    FRONTEND_URL: str = "http://localhost:5173"
    
    # Unstructured.io (Document Parsing)
    UNSTRUCTURED_API_KEY: str = ""
    UNSTRUCTURED_API_URL: str = "https://api.unstructuredapp.io/general/v0/general"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
