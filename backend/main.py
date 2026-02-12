from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from config import settings

from routers.chat import router as chat_router
from routers.agents import router as agents_router
from routers.auth import router as auth_router
from routers.spaces import router as spaces_router

# Import MCP servers (now local to backend directory)
from mcp_servers.calculator.server import mcp as calculator_mcp
from mcp_servers.search.server import mcp as search_mcp

app = FastAPI(
    title="Shunya Chat API",
    description="Backend API for Shunya Chat with multi-model support",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(chat_router)
app.include_router(agents_router)
app.include_router(auth_router)
app.include_router(spaces_router)

# Mount MCP servers
# FastAPI strips the mount prefix, so the path for http_app should be empty
app.mount("/mcp/calculator", calculator_mcp.http_app(path="", transport="sse"))
app.mount("/mcp/search", search_mcp.http_app(path="", transport="sse"))


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}

# Serve frontend static files at root path
# This must be last so API routes take precedence
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")
