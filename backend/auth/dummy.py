"""Dummy signed-in user until Supabase Auth is wired up."""

from dataclasses import dataclass

from fastapi import Depends

from config import settings


@dataclass
class DummyUser:
    id: str
    email: str
    name: str


def get_current_user() -> DummyUser:
    """Always returns the configured demo user."""
    return DummyUser(
        id=settings.DUMMY_USER_ID,
        email=settings.DUMMY_USER_EMAIL,
        name=settings.DUMMY_USER_NAME,
    )


# FastAPI dependency alias
CurrentUser = Depends(get_current_user)
