from .agents import AgentInfo, AgentRegistry, get_available_agents
from .models import ModelRegistry, ModelInfo

get_model_info = ModelRegistry.get_model_info
AVAILABLE_MODELS = ModelRegistry.AVAILABLE_MODELS

get_agent_info = AgentRegistry.get_agent_info
AVAILABLE_AGENTS = get_available_agents()

