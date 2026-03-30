"""
MongoDB Database Connection & Collection Registry.

Handles connection pooling, exponential-backoff retry logic,
index creation, and exports all collection references used by the API layer.
"""

import os
import time
import logging
from typing import Optional

import dns.resolver
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import ConfigurationError, ConnectionFailure, ServerSelectionTimeoutError

# Fallback nameservers for macOS environments where /etc/resolv.conf is unreadable.
try:
    dns.resolver.default_resolver = dns.resolver.Resolver()
except dns.resolver.NoResolverConfiguration:
    dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
    dns.resolver.default_resolver.nameservers = ["8.8.8.8", "1.1.1.1"]

load_dotenv()

logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────────────────
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/stremflix")
_MAX_RETRIES = 5
_RETRY_DELAY = 2  # seconds, doubles each attempt (capped at 30 s)


def _create_client(uri: str, max_retries: int = _MAX_RETRIES) -> MongoClient:
    """Create a MongoClient with exponential-backoff retry on transient failures."""
    delay = _RETRY_DELAY
    last_exc: Optional[Exception] = None

    for attempt in range(1, max_retries + 1):
        try:
            client = MongoClient(
                uri,
                serverSelectionTimeoutMS=10_000,
                connectTimeoutMS=10_000,
            )
            client.admin.command("ping")
            logger.info("MongoDB connected (attempt %d).", attempt)
            return client
        except (ConfigurationError, ConnectionFailure, ServerSelectionTimeoutError) as exc:
            last_exc = exc
            if attempt < max_retries:
                logger.warning(
                    "MongoDB attempt %d/%d failed: %s — retrying in %ds…",
                    attempt, max_retries, exc, delay,
                )
                time.sleep(delay)
                delay = min(delay * 2, 30)
            else:
                logger.error("MongoDB connection failed after %d attempts: %s", max_retries, exc)

    raise RuntimeError(
        f"Could not connect to MongoDB after {max_retries} attempts."
    ) from last_exc


# ── Client & Database ────────────────────────────────────────────────────────
client = _create_client(MONGODB_URI)

try:
    _path = MONGODB_URI.split("//")[-1]
    _db_name = _path.split("/", 1)[1].split("?")[0] if "/" in _path else ""
    _db_name = _db_name or "mindmovieai"
except Exception:
    _db_name = "mindmovieai"

db = client[_db_name]

# ── Collection References ────────────────────────────────────────────────────
USERS = db["users"]
RATINGS = db["ratings"]
MOVIE_REVIEWS = db["movie_reviews"]
SEARCH_HISTORY = db["search_history"]
USER_ACTIVITIES = db["user_activities"]
USER_SESSIONS = db["user_sessions"]
FAVORITES = db["favorites"]
WATCHLIST = db["watchlist"]
YOUTUBE_COMMENTS = db["youtube_comments"]

# ── Emotional Arc Collections ────────────────────────────────────────────────
ARC_MOVIES = db["arc_movies"]
ARC_CONFIG = db["arc_config"]
ARC_RATINGS = db["arc_ratings"]


def ensure_indexes() -> None:
    """Create MongoDB indexes for fast queries (idempotent)."""
    try:
        USERS.create_index("username", unique=True)
        USERS.create_index("email", unique=True, sparse=True)
        RATINGS.create_index([("user_id", 1), ("movie_id", 1)])
        MOVIE_REVIEWS.create_index("movie_title")
        MOVIE_REVIEWS.create_index("user_id")
        SEARCH_HISTORY.create_index("user_id")
        USER_ACTIVITIES.create_index("user_id")
        USER_ACTIVITIES.create_index("activity_type")
        USER_SESSIONS.create_index("user_id")
        USER_SESSIONS.create_index("token_hash")
        FAVORITES.create_index([("user_id", 1), ("movie_title", 1)], unique=True)
        WATCHLIST.create_index([("user_id", 1), ("movie_title", 1)], unique=True)
        YOUTUBE_COMMENTS.create_index("video_title")
        YOUTUBE_COMMENTS.create_index("video_id")
        YOUTUBE_COMMENTS.create_index("user_id")
        ARC_MOVIES.create_index("genres")
        ARC_MOVIES.create_index([("rating", -1)])
        ARC_RATINGS.create_index("user_id")
        logger.info("MongoDB indexes ensured.")
    except Exception as exc:
        logger.warning("Could not create indexes (non-fatal): %s", exc)


ensure_indexes()


def get_db():
    """Return the database object (FastAPI dependency injection compatible)."""
    return db
