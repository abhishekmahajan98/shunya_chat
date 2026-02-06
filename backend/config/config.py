import os
from dotenv import load_dotenv

# Load .env early so get_config() can see APP_ENV
load_dotenv()

from .base_config import BaseConfig
from .development_config import DevelopmentConfig
from .production_config import ProductionConfig

def get_config():
    """Factory function to get the appropriate configuration object."""
    env = os.getenv("APP_ENV", "development").lower()
    
    if env == "production":
        return ProductionConfig()
    elif env == "development":
        return DevelopmentConfig()
    return BaseConfig()

# Single source of truth for all backend settings
settings = get_config()
