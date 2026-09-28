"""Encrypt integration secrets at rest (Fernet)."""

from __future__ import annotations

import base64
import hashlib
import logging
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from config import settings

logger = logging.getLogger("uvicorn.error")


def _derive_fernet_key(raw: str) -> bytes:
    """Turn any non-empty secret into a url-safe 32-byte Fernet key."""
    digest = hashlib.sha256(raw.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    secret = (settings.INTEGRATIONS_ENCRYPTION_KEY or "").strip()
    if not secret:
        # Dev fallback — stable per process config, not for production
        secret = f"dev-insecure::{settings.DUMMY_USER_ID}::{settings.ENV}"
        logger.warning(
            "INTEGRATIONS_ENCRYPTION_KEY unset; using insecure derived key"
        )
    return Fernet(_derive_fernet_key(secret))


def encrypt_secret(plaintext: str | None) -> str | None:
    if plaintext is None:
        return None
    return _fernet().encrypt(plaintext.encode("utf-8")).decode("ascii")


def decrypt_secret(ciphertext: str | None) -> str | None:
    if ciphertext is None:
        return None
    try:
        return _fernet().decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Failed to decrypt integration secret") from exc
