"""
JWT Authentication & Password Hashing Utilities.

Provides bcrypt password hashing (with SHA-256 pre-hash to bypass the 72-char
bcrypt limit), JWT access/refresh token creation, and session management.
"""

import os
import hashlib
from datetime import datetime, timedelta
from typing import Optional

import jwt
from dotenv import load_dotenv
from passlib.context import CryptContext

load_dotenv()

# ── Configuration ────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super_secret_key_movie_recommender")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7   # 7 days
REFRESH_TOKEN_EXPIRE_DAYS = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against its bcrypt hash."""
    pre_hashed = hashlib.sha256(plain_password.encode("utf-8")).hexdigest()
    return pwd_context.verify(pre_hashed, hashed_password)


def get_password_hash(password: str) -> str:
    """Return a bcrypt hash of *password* (SHA-256 pre-hashed)."""
    pre_hashed = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return pwd_context.hash(pre_hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """Create a signed JWT refresh token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def hash_token(token: str) -> str:
    """Return a truncated SHA-256 hash of *token* for safe session storage."""
    return hashlib.sha256(token.encode()).hexdigest()[:32]


def create_session_record(db, user_id, token: str, ip_address: str = None, user_agent: str = None):
    """Insert a new session document into MongoDB."""
    import models
    session_doc = models.new_session_doc(
        user_id=user_id,
        token_hash=hash_token(token),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db["user_sessions"].insert_one(session_doc)
    return session_doc
