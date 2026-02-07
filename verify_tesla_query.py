import requests
import json
import time

url = "http://localhost:8000/api/chat/stream"
payload = {
    "model": "gemini-3-flash-preview",
    "content": "What was Tesla's total revenue in 2023? Calculate 15% of that amount for a hypothetical R&D budget.",
    "active_agents": ["search", "calculator"]
}

print(f"--- SIMULATION START ---")
print(f"Query: {payload['content']}")
print(f"Agents: {payload['active_agents']}\n")

try:
    response = requests.post(url, json=payload, stream=True, timeout=180)
    
    full_text = ""
    for line in response.iter_lines():
        if line:
            line_str = line.decode('utf-8')
            if line_str.startswith('data: '):
                try:
                    data = json.loads(line_str[6:])
                    event_type = data.get('type')
                    
                    if event_type == 'agent_status':
                        agent = data.get('agent', 'system')
                        status = data.get('status')
                        goal = data.get('goal', '')
                        tool = data.get('tool_run_id', '')
                        error = data.get('error', '')
                        if tool:
                           print(f"[TOOL: {agent}] {status} | {goal}")
                           if error: print(f"  ERROR: {error}")
                        else:
                           print(f"[AGENT: {agent}] {status} | {goal}")
                    
                    elif event_type == 'text':
                        content = data.get('content', '')
                        full_text += content
                        print(content, end='', flush=True)
                    
                    elif event_type == 'error':
                        print(f"\n[STREAM ERROR] {data.get('content')}")
                        
                    elif event_type == 'done':
                        print(f"\n\n--- STREAM COMPLETE ---")
                except Exception:
                    pass
except Exception as e:
    print(f"Request Error: {e}")

print("\n--- SIMULATION END ---")
