from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text, Boolean
from sqlalchemy.orm import relationship
import datetime
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True, nullable=True)
    display_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    hashed_password = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    onboarding_completed = Column(Boolean, default=False)
    age = Column(Integer, nullable=True)
    gender = Column(String, nullable=True)
    favorite_genres = Column(String, nullable=True)   # comma-separated liked genres
    disliked_genres = Column(String, nullable=True)   # comma-separated disliked genres
    movie_sources = Column(String, nullable=True)     # e.g. "hollywood,bollywood,anime"

    ratings = relationship("Rating", back_populates="owner")
    search_history = relationship("SearchHistory", back_populates="owner")
    activities = relationship("UserActivity", back_populates="owner")
    sessions = relationship("UserSession", back_populates="owner")
    favorites = relationship("Favorite", back_populates="owner")
    watchlist = relationship("Watchlist", back_populates="owner")
    reviews = relationship("MovieReview", back_populates="owner")
    yt_comments = relationship("YoutubeComment", back_populates="owner")


class Rating(Base):
    __tablename__ = "ratings"

    id = Column(Integer, primary_key=True, index=True)
    movie_id = Column(Integer, index=True)
    movie_title = Column(String)
    rating = Column(Float)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="ratings")


class MovieReview(Base):
    __tablename__ = "movie_reviews"

    id = Column(Integer, primary_key=True, index=True)
    movie_title = Column(String, index=True)
    review_text = Column(Text)
    sentiment_label = Column(String, nullable=True)       # "positive" | "negative" | "neutral"
    sentiment_confidence = Column(Float, nullable=True)   # 0.0 – 1.0
    sentiment_score = Column(Float, nullable=True)        # raw score
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="reviews")


class SearchHistory(Base):
    __tablename__ = "search_history"

    id = Column(Integer, primary_key=True, index=True)
    query = Column(String, index=True)
    results_count = Column(Integer, default=0)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="search_history")


class UserActivity(Base):
    __tablename__ = "user_activities"

    id = Column(Integer, primary_key=True, index=True)
    activity_type = Column(String, index=True)  # "page_view", "movie_click", "search", "recommendation_click"
    page_url = Column(String, nullable=True)
    movie_title = Column(String, nullable=True)
    extra_data = Column(Text, nullable=True)        # JSON string
    duration_seconds = Column(Integer, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="activities")


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    token_hash = Column(String, index=True)
    login_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_active = Column(DateTime, default=datetime.datetime.utcnow)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    user_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="sessions")


class Favorite(Base):
    __tablename__ = "favorites"

    id = Column(Integer, primary_key=True, index=True)
    movie_title = Column(String, index=True)
    poster_url = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="favorites")


class Watchlist(Base):
    __tablename__ = "watchlist"

    id = Column(Integer, primary_key=True, index=True)
    movie_title = Column(String, index=True)
    poster_url = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="watchlist")


class YoutubeComment(Base):
    __tablename__ = "youtube_comments"

    id = Column(Integer, primary_key=True, index=True)
    video_title = Column(String, index=True)
    video_id = Column(String, nullable=True, index=True)
    text = Column(Text, nullable=False)
    sentiment_label = Column(String, nullable=True)   # positive | negative | neutral
    sentiment_score = Column(Float, nullable=True)    # confidence 0.0-1.0
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="yt_comments")
