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
        self.latest_run_ids = {} # Store run_id by tool name
        
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
        self.latest_run_ids[tool_name] = run_id
        
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
                "type": "tool_start",
                "agent": self.agent_name,
                "name": self.agent_name,
                "tool_name": tool_name,
                "input": display_input,
                "parent_id": self.parent_id,
                "tool_run_id": str(run_id)
            })
            # Force flush
            import asyncio
            await asyncio.sleep(0.01)
            print(f"DEBUG: on_tool_start emitted for {tool_name} run_id={run_id}")

    async def on_tool_end(
        self, 
        output: str, 
        *, 
        run_id: UUID, 
        parent_run_id: Optional[UUID] = None, 
        **kwargs: Any
    ) -> None:
        """Called when a tool finishes running."""
        if not run_id:
            return

        # Truncate output if it's too long
        max_length = 500
        display_output = str(output)
        if len(display_output) > max_length:
            display_output = display_output[:max_length] + "... [truncated]"

        # Signal completion of the specific tool action
        if self.queue:
             await self.queue.put({
                "type": "tool_end",
                "tool_run_id": str(run_id),
                "output": display_output
            })
             # Force flush
             import asyncio
             await asyncio.sleep(0.01)
             print(f"DEBUG: on_tool_end emitted for run_id={run_id}")

    async def on_tool_error(
        self, 
        error: BaseException, 
        *, 
        run_id: UUID, 
        parent_run_id: Optional[UUID] = None, 
        **kwargs: Any
    ) -> None:
        """Called when a tool errors."""
        print(f"DEBUG: on_tool_error CALLED for run_id={run_id}. Error={error}")
        if self.queue:
             await self.queue.put({
                "type": "tool_error",
                "tool_run_id": str(run_id),
                "error": str(error)
            })

    async def manual_tool_end(self, tool_name: str, output: Any) -> None:
        """Manually trigger tool end logic when automatic callbacks fail."""
        run_id = self.latest_run_ids.get(tool_name)
        if not run_id:
            print(f"DEBUG: manual_tool_end could not find run_id for {tool_name}")
            return
            
        print(f"DEBUG: manual_tool_end triggering for {tool_name} run_id={run_id}")
        
        # Format output
        import json
        output_str = json.dumps(output) if isinstance(output, (dict, list)) else str(output)
        
        await self.on_tool_end(output_str, run_id=run_id)

    async def manual_tool_error(self, tool_name: str, error: BaseException) -> None:
        """Manually trigger tool error logic."""
        run_id = self.latest_run_ids.get(tool_name)
        if not run_id:
            print(f"DEBUG: manual_tool_error could not find run_id for {tool_name}")
            return
            
        print(f"DEBUG: manual_tool_error triggering for {tool_name} run_id={run_id}")
        await self.on_tool_error(error, run_id=run_id)
