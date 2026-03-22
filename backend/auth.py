from passlib.context import CryptContext
from datetime import datetime, timedelta
import jwt
import hashlib
from pydantic import BaseModel
from typing import Optional

SECRET_KEY = "super_secret_key_movie_recommender"  # In production, use environment variable
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days
REFRESH_TOKEN_EXPIRE_DAYS = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password, hashed_password):
    # Pre-hash to bypass bcrypt 72 character limit bug in passlib
    pre_hashed = hashlib.sha256(plain_password.encode('utf-8')).hexdigest()
    return pwd_context.verify(pre_hashed, hashed_password)


def get_password_hash(password):
    # Pre-hash to bypass bcrypt 72 character limit bug in passlib
    pre_hashed = hashlib.sha256(password.encode('utf-8')).hexdigest()
    return pwd_context.hash(pre_hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def hash_token(token: str) -> str:
    """Create a hash of the token for session tracking (don't store raw tokens)."""
    return hashlib.sha256(token.encode()).hexdigest()[:32]


def create_session_record(db, user_id: int, token: str, ip_address: str = None, user_agent: str = None):
    """Create a session record in the database."""
    import models
    session = models.UserSession(
        user_id=user_id,
        token_hash=hash_token(token),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session
