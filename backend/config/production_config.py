from .base_config import BaseConfig

class ProductionConfig(BaseConfig):
    """Production configuration with overrides."""
    ENV: str = "production"
    DEBUG: bool = False
