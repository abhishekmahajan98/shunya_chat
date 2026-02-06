from typing import Any, Dict, List, Optional
from uuid import UUID
from langchain_core.callbacks import AsyncCallbackHandler
from langchain_core.outputs import LLMResult

class AgentCallbackHandler(AsyncCallbackHandler):
    """Callback handler to stream agent tool usage events to the frontend."""
    
    def __init__(self, queue, agent_name: str, parent_id: Optional[str] = None):
        self.queue = queue
        self.agent_name = agent_name
        self.parent_id = parent_id
        
    async def on_tool_start(
        self, 
        serialized: Dict[str, Any], 
        input_str: str, 
        *, 
        run_id: UUID, 
        parent_run_id: Optional[UUID] = None, 
        tags: Optional[List[str]] = None, 
        metadata: Optional[Dict[str, Any]] = None, 
        **kwargs: Any
    ) -> None:
        """Called when a tool starts running."""
        tool_name = serialized.get("name", "tool")
        
        # Parse input if it's a JSON string, otherwise use raw
        display_input = input_str
        # Try to make it look nicer if it's a simple query
        import json
        try:
            input_dict = json.loads(input_str)
            if isinstance(input_dict, dict) and "query" in input_dict:
                display_input = f"'{input_dict['query']}'"
            elif isinstance(input_dict, dict) and len(input_dict) == 1:
                display_input = str(list(input_dict.values())[0])
        except:
            pass
            
        if self.queue:
            await self.queue.put({
                "type": "agent_status",
                "agent": self.agent_name,
                "name": self.agent_name,
                "status": "running",
                "parent_id": self.parent_id,
                "goal": f"Using {tool_name}: {display_input}"
            })
            # Force flush
            import asyncio
            await asyncio.sleep(0.01)

    async def on_tool_end(
        self, 
        output: str, 
        *, 
        run_id: UUID, 
        parent_run_id: Optional[UUID] = None, 
        **kwargs: Any
    ) -> None:
        """Called when a tool finishes running."""
        # Signal completion of the specific tool action
        if self.queue:
             await self.queue.put({
                "type": "agent_status", 
                "agent": self.agent_name,
                "name": self.agent_name,
                "status": "complete",
                "goal": "Tool execution finished" # We use a special marker or just status update
            })
             # Force flush
             import asyncio
             await asyncio.sleep(0.01)
    async def on_tool_error(
        self, 
        error: BaseException, 
        *, 
        run_id: UUID, 
        parent_run_id: Optional[UUID] = None, 
        **kwargs: Any
    ) -> None:
        """Called when a tool errors."""
        if self.queue:
             await self.queue.put({
                "type": "agent_status", 
                "agent": self.agent_name,
                "status": "failed",
                "error": str(error)
            })
