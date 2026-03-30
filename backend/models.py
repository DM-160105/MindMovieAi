"""
MongoDB Document Factories & Serialization Helpers.

Each `new_*_doc()` function returns a plain dict ready for MongoDB insertion.
`serialize_doc()` and `user_to_dict()` prepare documents for JSON API responses.
"""

import datetime
from bson import ObjectId

# ── Collection Name Constants ────────────────────────────────────────────────
USERS_COLLECTION = "users"
RATINGS_COLLECTION = "ratings"
MOVIE_REVIEWS_COLLECTION = "movie_reviews"
SEARCH_HISTORY_COLLECTION = "search_history"
USER_ACTIVITIES_COLLECTION = "user_activities"
USER_SESSIONS_COLLECTION = "user_sessions"
FAVORITES_COLLECTION = "favorites"
WATCHLIST_COLLECTION = "watchlist"
YOUTUBE_COMMENTS_COLLECTION = "youtube_comments"


# ── Serialization ────────────────────────────────────────────────────────────
def serialize_doc(doc: dict) -> dict:
    """Convert a MongoDB document to a JSON-serializable dict."""
    if doc is None:
        return None
    doc = dict(doc)
    for key, val in doc.items():
        if isinstance(val, ObjectId):
            doc[key] = str(val)
        elif isinstance(val, datetime.datetime):
            doc[key] = val.isoformat()
    return doc


# ── Document Factories ───────────────────────────────────────────────────────
def new_user_doc(username: str, hashed_password: str, email: str = None, display_name: str = None) -> dict:
    """Create a new user document."""
    return {
        "username": username,
        "email": email,
        "display_name": display_name or username,
        "avatar_url": None,
        "hashed_password": hashed_password,
        "created_at": datetime.datetime.utcnow(),
        "is_active": True,
        "is_admin": False,
        "onboarding_completed": False,
        "is_verified": False,
        "auth_provider": "local",
        "age": None,
        "gender": None,
        "favorite_genres": None,
        "disliked_genres": None,
        "movie_sources": None,
    }


def new_rating_doc(user_id, movie_id: int, movie_title: str, rating: float) -> dict:
    """Create a movie rating document."""
    return {
        "user_id": user_id,
        "movie_id": movie_id,
        "movie_title": movie_title,
        "rating": rating,
        "timestamp": datetime.datetime.utcnow(),
    }


def new_review_doc(user_id, movie_title: str, review_text: str,
                   sentiment_label=None, sentiment_confidence=None, sentiment_score=None) -> dict:
    """Create a movie review document with optional sentiment metadata."""
    return {
        "user_id": user_id,
        "movie_title": movie_title,
        "review_text": review_text,
        "sentiment_label": sentiment_label,
        "sentiment_confidence": sentiment_confidence,
        "sentiment_score": sentiment_score,
        "timestamp": datetime.datetime.utcnow(),
    }


def new_search_doc(user_id, query: str, results_count: int = 0) -> dict:
    """Create a search history document."""
    return {
        "user_id": user_id,
        "query": query,
        "results_count": results_count,
        "timestamp": datetime.datetime.utcnow(),
    }


def new_activity_doc(user_id, activity_type: str, page_url=None,
                     movie_title=None, extra_data=None, duration_seconds=None) -> dict:
    """Create a user activity tracking document."""
    return {
        "user_id": user_id,
        "activity_type": activity_type,
        "page_url": page_url,
        "movie_title": movie_title,
        "extra_data": extra_data,
        "duration_seconds": duration_seconds,
        "timestamp": datetime.datetime.utcnow(),
    }


def new_session_doc(user_id, token_hash: str, ip_address=None, user_agent=None) -> dict:
    """Create a login session document."""
    return {
        "user_id": user_id,
        "token_hash": token_hash,
        "login_at": datetime.datetime.utcnow(),
        "last_active": datetime.datetime.utcnow(),
        "ip_address": ip_address,
        "user_agent": user_agent,
        "is_active": True,
    }


def new_favorite_doc(user_id, movie_title: str, poster_url=None) -> dict:
    """Create a favorites document."""
    return {
        "user_id": user_id,
        "movie_title": movie_title,
        "poster_url": poster_url,
        "timestamp": datetime.datetime.utcnow(),
    }


def new_watchlist_doc(user_id, movie_title: str, poster_url=None) -> dict:
    """Create a watchlist document."""
    return {
        "user_id": user_id,
        "movie_title": movie_title,
        "poster_url": poster_url,
        "timestamp": datetime.datetime.utcnow(),
    }


def new_youtube_comment_doc(user_id, video_title: str, text: str,
                            video_id=None, sentiment_label=None, sentiment_score=None) -> dict:
    """Create a YouTube comment document with optional sentiment metadata."""
    return {
        "user_id": user_id,
        "video_title": video_title,
        "video_id": video_id,
        "text": text,
        "sentiment_label": sentiment_label,
        "sentiment_score": sentiment_score,
        "timestamp": datetime.datetime.utcnow(),
    }


def user_to_dict(user_doc: dict) -> dict:
    """Convert a user MongoDB document to a safe API response dict."""
    if user_doc is None:
        return None
    return {
        "id": str(user_doc.get("_id", "")),
        "username": user_doc.get("username"),
        "email": user_doc.get("email"),
        "display_name": user_doc.get("display_name"),
        "avatar_url": user_doc.get("avatar_url"),
        "created_at": (
            user_doc["created_at"].isoformat()
            if isinstance(user_doc.get("created_at"), datetime.datetime)
            else user_doc.get("created_at")
        ),
        "onboarding_completed": user_doc.get("onboarding_completed", False),
        "is_verified": user_doc.get("is_verified", False),
        "auth_provider": user_doc.get("auth_provider", "local"),
        "favorite_genres": user_doc.get("favorite_genres"),
        "disliked_genres": user_doc.get("disliked_genres"),
        "movie_sources": user_doc.get("movie_sources"),
        "age": user_doc.get("age"),
        "gender": user_doc.get("gender"),
        "location_lat": user_doc.get("location_lat"),
        "location_lon": user_doc.get("location_lon"),
    }
