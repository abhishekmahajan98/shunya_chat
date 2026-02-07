"""
Hierarchical Agent Graph.
Orchestrates a Supervisor (Router) and Worker Agents (ReAct loops).
"""
import os
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import HumanMessage, SystemMessage

from .state import AgentState
from .router import supervisor_node
from .synthesizer import synthesizer_node
from .mcp_client import get_mcp_client
from config import settings, AgentModels


from langchain_core.runnables import RunnableConfig

async def mcp_executor_node(state: AgentState, config: RunnableConfig) -> dict:
    """
    Worker Factory & Executor.
    Iterates through the Supervisor's plan (active_agents list of goals).
    For each goal:
      1. Spins up a specific ReAct agent for that MCP server.
      2. Gives it the specific goal.
      3. Runs it to completion.
    """
    active_goals = state.get("active_agents", [])
    mcp_client = get_mcp_client()
    
    # Get queue if available for streaming progress
    queue = config.get("configurable", {}).get("queue")
    
    if not active_goals:
        return {"agent_results": []}
    
    results = []
    
    # Shared LLM for all workers
    api_key = settings.GOOGLE_API_KEY
    if not api_key:
         return {"agent_results": [{"agent": "system", "error": "Internal Error: GOOGLE_API_KEY not set in config."}]}

    try:
        if AgentModels.EXECUTOR_PROVIDER == "google":
            from langchain_google_genai import ChatGoogleGenerativeAI
            llm = ChatGoogleGenerativeAI(
                model=AgentModels.EXECUTOR_MODEL,
                temperature=0,
                google_api_key=api_key
            )
        elif AgentModels.EXECUTOR_PROVIDER == "anthropic":
            from langchain_anthropic import ChatAnthropic
            anthropic_api_key = settings.ANTHROPIC_API_KEY
            llm = ChatAnthropic(
                model=AgentModels.EXECUTOR_MODEL,
                temperature=0,
                anthropic_api_key=anthropic_api_key
            )
        else:
            raise ValueError(f"Unsupported executor provider: {AgentModels.EXECUTOR_PROVIDER}")
    except Exception as e:
        return {"agent_results": [{"agent": "system", "error": f"LLM Init Failed: {str(e)}"}]}

    # Context accumulator for dependency chaining
    context = ""
    
    # Format history for workers to resolve context
    history_text = ""
    for msg in state["messages"][:-1]:
        role = "User" if (hasattr(msg, 'type') and msg.type == "human") else "Assistant"
        content = msg.content if hasattr(msg, 'content') else str(msg)
        history_text += f"{role}: {content}\n"
    
    for step in active_goals:
        agent_name = step["agent"]
        goal = step["goal"]
        step_id = step.get("id") # Unique ID from router (e.g. step-1)
        
        # Emit start event
        if queue:
            await queue.put({
                "type": "agent_status",
                "id": step_id, # Emitting the unique plan ID
                "agent": agent_name,
                "name": agent_name, # ideally we get real name
                "goal": goal,
                "status": "running"
            })
            # Force yield to allow stream consumer to flush update
            import asyncio
            await asyncio.sleep(0.01)
        
        try:
            # 1. Get Tools for this Agent
            tools = await mcp_client.get_langchain_tools(agent_name)
            
            if not tools:
                 results.append({"agent": agent_name, "error": f"No tools found for {agent_name}"})
                 continue
    
            # 2. Create ReAct Agent
            worker_agent = create_react_agent(llm, tools)
            
            # 3. specific prompt for the worker
            agent_config = mcp_client.get_server_by_id(agent_name)
            system_prompt = agent_config.system_prompt if agent_config else ""
            
            worker_input = f"""
            {system_prompt}
            
            You are the '{agent_name}' specialist.
            
            Chat History:
            {history_text}
            
            Your Goal: {goal}
            
            Context from previous steps in this turn:
            {context}
            
            Use your tools to achieve the goal. Return the final answer clearly.
            """
    
            # 4. Invoke the worker
            # Attach callback handler to stream real-time tool usage
            from .callbacks import AgentCallbackHandler
            # Pass step_id so tool events can be nested under this step
            callback = AgentCallbackHandler(queue, agent_name, parent_id=step_id)
            
            worker_response = await worker_agent.ainvoke(
                {"messages": [HumanMessage(content=worker_input)]},
                config={"callbacks": [callback]}
            )
            
            # 5. Extract result
            final_message = worker_response["messages"][-1]
            step_result = final_message.content
            
            # Extract URLs for citations
            import re
            urls = re.findall(r'(https?://[^\s)]+)', step_result)
            unique_urls = list(set(urls))
            
            # 6. Store and Update Context
            results.append({
                "agent": agent_name,
                "goal": goal,
                "result": step_result,
                "citations": unique_urls, # Store extracted citations
                "id": step_id # CRITICAL: Ensure unique ID maps back to plan
            })
            context += f"\n- {agent_name} found: {step_result}"
            
            # Emit complete event
            if queue:
                await queue.put({
                    "type": "agent_status",
                    "id": step_id,
                    "agent": agent_name,
                    "name": agent_name,
                    "goal": goal,
                    "status": "complete"
                })
                # Also emit agent_result for the "✓" markers
                await queue.put({
                    "type": "agent_result",
                    "id": step_id,
                    "agent": agent_name,
                    "data": step_result
                })
            
        except Exception as e:
            # Catch worker failures properly
            import traceback
            traceback.print_exc()
            results.append({
                "agent": agent_name,
                "goal": goal,
                "error": f"Execution failed: {str(e)}",
                "id": step_id
            })
            
            # Emit error event
            if queue:
                await queue.put({
                    "type": "agent_status",
                    "id": step_id,
                    "agent": agent_name,
                    "name": agent_name,
                    "goal": goal,
                    "status": "failed",
                    "error": str(e)
                })
    
    return {"agent_results": results}


def route_after_supervisor(state: AgentState) -> str:
    """
    Determine next step after Supervisor.
    If plan exists (active_agents), go to executor. Otherwise, skip to synthesizer.
    """
    if state.get("active_agents"):
        return "executor"
    return "synthesizer"


def build_agent_graph():
    """
    Build and compile the Hierarchical Agent Graph.
    
    Flow:
    START -> Supervisor -> [Worker Factory (Executor)] -> Synthesizer -> END
    """
    graph = StateGraph(AgentState)
    
    # Add nodes
    graph.add_node("router", supervisor_node) # Node name kept as 'router' for now to minimize unexpected breaks, but logic is Supervisor
    graph.add_node("executor", mcp_executor_node)
    graph.add_node("synthesizer", synthesizer_node)
    
    # Entry point
    graph.add_edge(START, "router")
    
    # Conditional routing after router/supervisor
    graph.add_conditional_edges(
        "router",
        route_after_supervisor,
        {
            "executor": "executor",
            "synthesizer": "synthesizer"
        }
    )
    
    # Executor always goes to synthesizer
    graph.add_edge("executor", "synthesizer")
    
    # Synthesizer ends the graph
    graph.add_edge("synthesizer", END)
    
    return graph.compile()


# Singleton graph instance
_agent_graph = None


def get_agent_graph():
    """Get or create the agent graph singleton."""
    global _agent_graph
    if _agent_graph is None:
        _agent_graph = build_agent_graph()
    return _agent_graph
