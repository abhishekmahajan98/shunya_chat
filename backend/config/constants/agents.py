class AgentModels:
    """Default models used by the internal agentic system components."""
    
    # Supervisor / Router settings
    SUPERVISOR_MODEL = "gemini-2.0-flash"
    SUPERVISOR_PROVIDER = "google"
    
    # Executor / Worker settings
    EXECUTOR_MODEL = "gemini-2.0-flash"
    EXECUTOR_PROVIDER = "google"
    
    # Post-processing / Title settings
    TITLE_MODEL = "gemini-3-flash-preview"
    TITLE_PROVIDER = "google"
