from .models import ModelRegistry, ModelInfo
from .agents import AgentModels

# Helper for backward compatibility or direct access
get_model_info = ModelRegistry.get_model_info
AVAILABLE_MODELS = ModelRegistry.AVAILABLE_MODELS
