"""
Synthesizer Node.
Combines agent results into a final response for the user.
"""
import os
from google import genai
from dotenv import load_dotenv
from .state import AgentState

load_dotenv()

SYNTHESIZER_PROMPT = """You are a helpful assistant. Based on the following agent results and the user's original question, provide a comprehensive and well-formatted response.

Agent Results:
{agent_results}

Original Question: {user_message}

Guidelines:
- Synthesize all relevant information from the agent results
- Use markdown formatting for clarity (headers, lists, tables if appropriate)
- Cite sources when available (from search results)
- Be concise but thorough
- If agents returned errors, acknowledge them gracefully
"""


async def synthesizer_node(state: AgentState) -> dict:
    """
    Synthesize agent results into a final user-facing response.
    """
    last_message = state["messages"][-1]
    user_message = last_message.content if hasattr(last_message, 'content') else str(last_message)
    
    agent_results = state.get("agent_results", [])
    
    # If no agent results, this is a direct LLM response (no agents were activated)
    if not agent_results:
        return {"final_response": None}  # Let the streaming endpoint handle direct LLM
    
    # Format agent results for the synthesizer
    results_text = ""
    for result in agent_results:
        agent_name = result.get("agent", "Unknown")
        status = result.get("status", "unknown")
        
        results_text += f"\n### {agent_name.upper()} Agent ({status})\n"
        
        if status == "success":
            if "answer" in result:
                results_text += f"Answer: {result['answer']}\n"
            if "citations" in result and result["citations"]:
                results_text += f"Sources: {', '.join(result['citations'][:3])}\n"
            if "data" in result:
                # Include the ACTUAL data, not just metadata
                import json
                results_text += f"Retrieved {result.get('record_count', 0)} records:\n"
                results_text += f"```json\n{json.dumps(result['data'], indent=2)}\n```\n"
            if "email" in result:
                results_text += f"Email Status: {result['email']['status']}\n"
                results_text += f"Subject: {result['email']['subject']}\n"
        else:
            results_text += f"Error: {result.get('error', 'Unknown error')}\n"
    
    # Use Gemini to synthesize
    prompt = SYNTHESIZER_PROMPT.format(
        agent_results=results_text,
        user_message=user_message
    )
    
    try:
        api_key = os.getenv("GOOGLE_API_KEY")
        client = genai.Client(api_key=api_key)
        
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[{"role": "user", "parts": [{"text": prompt}]}]
        )
        
        return {"final_response": response.text}
        
    except Exception as e:
        # Fallback: return raw results
        return {
            "final_response": f"I gathered the following information:\n{results_text}"
        }
