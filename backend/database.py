import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

# ─── MongoDB Connection ────────────────────────────────────────────────────────
MONGODB_URI = os.getenv(
    "MONGODB_URI",
    "mongodb://localhost:27017/stremflix"
)

client = MongoClient(MONGODB_URI)

# Extract database name from URI or use default
# Logic: use the path segment after the first '/', split at '?' to remove query params
try:
    # Get the part after 'mongodb://' or 'mongodb+srv://'
    after_scheme = MONGODB_URI.split("//")[-1]
    if "/" in after_scheme:
        path_segment = after_scheme.split("/", 1)[1].split("?")[0]
    else:
        path_segment = ""
    _db_name = path_segment if path_segment else "mindmovieai"
except Exception:
    _db_name = "mindmovieai"

db = client[_db_name]

# ─── Collection References ──────────────────────────────────────────────────────
# These mirror the old SQLAlchemy table names
USERS = db["users"]
RATINGS = db["ratings"]
MOVIE_REVIEWS = db["movie_reviews"]
SEARCH_HISTORY = db["search_history"]
USER_ACTIVITIES = db["user_activities"]
USER_SESSIONS = db["user_sessions"]
FAVORITES = db["favorites"]
WATCHLIST = db["watchlist"]
YOUTUBE_COMMENTS = db["youtube_comments"]

# ─── Indexes (created once, safe to call repeatedly) ────────────────────────────
def ensure_indexes():
    """Create MongoDB indexes for fast queries."""
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

ensure_indexes()


def get_db():
    """Returns the MongoDB database object. 
    For FastAPI dependency injection compatibility."""
    return db
