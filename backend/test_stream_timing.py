import httpx
import json
import asyncio
import time

async def test_stream():
    url = "http://localhost:8000/api/chat/stream"
    payload = {
        "model": "gemini-3-flash-preview",
        "content": "search for leclerc",
        "conversation_id": None,
        "active_agents": ["search"]
    }
    
    print(f"Connecting to {url}...")
    start_total = time.time()
    last_time = start_total
    
    async with httpx.AsyncClient() as client:
        async with client.stream("POST", url, json=payload, timeout=30.0) as response:
            async for line in response.aiter_lines():
                current_time = time.time()
                delta = current_time - last_time
                
                if line.startswith("data: "):
                    data_str = line[6:]
                    try:
                        data = json.loads(data_str)
                        type_ = data.get("type")
                        content = data.get("content", "")[:30]
                        agent = data.get("agent", "")
                        status = data.get("status", "")
                        
                        print(f"[+{delta:.3f}s] Type: {type_} | Agent: {agent} | Status: {status} | Cont: {content}")
                    except:
                        print(f"[+{delta:.3f}s] Raw: {line[:50]}...")
                
                last_time = current_time

if __name__ == "__main__":
    asyncio.run(test_stream())
