from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from config import settings

from routers.chat import router as chat_router
from routers.auth import router as auth_router

app = FastAPI(
    title="Shunya Chat API",
    description="Minimal backend: auth, chat, and conversation history",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(auth_router)


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


frontend_dist = Path(__file__).parent / "static"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")
