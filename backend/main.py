from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings

from routers.chat import router as chat_router
from routers.agents import router as agents_router
from routers.auth import router as auth_router

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


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
