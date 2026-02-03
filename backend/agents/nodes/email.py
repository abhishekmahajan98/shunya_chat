"""
Mock Email Sender Agent Node.
Simulates sending an email (doesn't actually send).
"""
import uuid
from datetime import datetime
from ..state import AgentState


async def email_node(state: AgentState) -> dict:
    """
    Mock email sender - simulates email composition and sending.
    Returns confirmation without actually sending.
    """
    last_message = state["messages"][-1]
    content = last_message.content if hasattr(last_message, 'content') else str(last_message)
    
    # Collect all previous agent results to include in email
    agent_results = state.get("agent_results", [])
    
    # Build email content from agent results
    email_body_parts = ["# Summary of Results\n"]
    for result in agent_results:
        if result.get("agent") != "email":
            agent_name = result.get("agent", "Unknown")
            email_body_parts.append(f"\n## {agent_name.title()} Results\n")
            if "answer" in result:
                email_body_parts.append(result["answer"])
            if "data" in result:
                email_body_parts.append(f"Retrieved {result.get('record_count', 0)} records")
    
    # Create mock email record
    mock_email = {
        "id": str(uuid.uuid4()),
        "to": "user@example.com",
        "subject": f"Shunya Chat Results - {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "body_preview": "".join(email_body_parts)[:200] + "...",
        "status": "queued",  # In reality would be "sent"
        "created_at": datetime.now().isoformat()
    }
    
    return {
        "agent_results": [{
            "agent": "email",
            "status": "success",
            "message": "Email prepared (mock - not actually sent)",
            "email": mock_email
        }]
    }
