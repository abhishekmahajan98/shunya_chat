from contextlib import AsyncExitStack, asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import settings
from mcp_servers import MCP_SERVERS
from routers.assistants import router as assistants_router
from routers.chat import router as chat_router

# Build ASGI apps for each MCP agent (mounted at /mcp/{id})
_mcp_apps = {
    agent_id: server.http_app(path="", transport="sse")
    for agent_id, server in MCP_SERVERS.items()
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with AsyncExitStack() as stack:
        for mcp_app in _mcp_apps.values():
            await stack.enter_async_context(mcp_app.lifespan(app))
        yield


app = FastAPI(
    title="Shunya Chat API",
    description="LangChain agent harness (basic + deep) with mounted MCP agents",
    version="0.5.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(assistants_router)

# Same pattern as before: /mcp/{agent_name}
for agent_id, mcp_app in _mcp_apps.items():
    app.mount(f"/mcp/{agent_id}", mcp_app)


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "store": "supabase" if settings.SUPABASE_URL and settings.SUPABASE_KEY else "memory",
        "auth": "dummy",
        "mcp_agents": list(MCP_SERVERS.keys()),
    }


frontend_dist = Path(__file__).parent / "static"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")
