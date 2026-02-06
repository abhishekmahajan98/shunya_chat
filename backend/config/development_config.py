from .base_config import BaseConfig

class DevelopmentConfig(BaseConfig):
    """Development configuration with overrides."""
    ENV: str = "development"
    DEBUG: bool = True
