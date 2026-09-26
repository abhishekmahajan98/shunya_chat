from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import settings
from routers.assistants import router as assistants_router
from routers.chat import router as chat_router

app = FastAPI(
    title="Shunya Chat API",
    description="LangChain agent harness (basic + deep) with Supabase-ready persistence",
    version="0.4.0",
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


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "store": "supabase" if settings.SUPABASE_URL and settings.SUPABASE_KEY else "memory",
        "auth": "dummy",
    }


frontend_dist = Path(__file__).parent / "static"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")
