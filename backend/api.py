import pickle
import json
import pandas as pd
import numpy as np
import requests
import faiss
import datetime
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import sys
import os
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi import Depends

from database import SessionLocal, engine, get_db
import models
import auth

# Import ML modules
import ml.sentiment as sentiment_analysis
import ml.fake_engagement as fake_engagement
import ml.predict_popularity as popularity_model
import ml.poster_classifier as poster_classifier
import ml.user_preference as user_preference
import ml.youtube_ml as youtube_ml
import ml.dl_recommender as dl_recommender

# Create database tables (safe for existing DBs)
models.Base.metadata.create_all(bind=engine)


# NOTE: migrate_db() removed — PostgreSQL uses create_all() which handles all schema creation.
# SQLite-specific AUTOINCREMENT syntax is not valid in PostgreSQL.

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
# Optional auth — doesn't raise 401, just returns None
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

def get_base_path():
    """Get absolute path to resource, works for dev and for PyInstaller"""
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.dirname(os.path.abspath(__file__))
    return base_path

BASE_DIR = get_base_path()

app = FastAPI(title="Movie Recommender API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load artifacts
try:
    movies_dict = pickle.load(open(os.path.join(BASE_DIR, 'artifacts', 'movie_dict.pkl'), 'rb'))
    movies = pd.DataFrame(movies_dict)
    # Precompute title_lower for fast O(1)/vectorized lookups during personalized recommendations
    if 'title' in movies.columns:
        movies['title_lower'] = movies['title'].astype(str).str.lower()
    index = faiss.read_index(os.path.join(BASE_DIR, 'artifacts', 'movies.index'))
except FileNotFoundError:
    raise RuntimeError("Model files not found. Please run generate_artifacts.py first.")

# Optional loading of full CSV data for /movie-details
try:
    movies_csv = pd.read_csv(os.path.join(BASE_DIR, 'data', 'tmdb_5000_movies.csv'))
    credits_csv = pd.read_csv(os.path.join(BASE_DIR, 'data', 'tmdb_5000_credits.csv'))
    tmdb_full_data = movies_csv.merge(credits_csv, left_on='id', right_on='movie_id', suffixes=('', '_credits'))
except FileNotFoundError:
    print("Warning: TMDB CSV data files not found.")
    tmdb_full_data = None

try:
    anime_df_full = pd.read_csv(os.path.join(BASE_DIR, 'data', 'anime-dataset-2023.csv'))
except FileNotFoundError:
    anime_df_full = None

try:
    bolly_df_full = pd.read_csv(os.path.join(BASE_DIR, 'data', 'bollywoodmovies.csv'))
except FileNotFoundError:
    bolly_df_full = None

def fetch_poster(row):
    """Fetches the movie poster URL from TMDB API or row directly."""
    if isinstance(row, dict):
        poster_url = row.get('poster_url', None)
        origin = row.get('origin', None)
        movie_id = row.get('movie_id', None)
    else:
        poster_url = row.get('poster_url', None)
        origin = row.get('origin', None)
        movie_id = row.get('movie_id', None)
        
    if pd.notna(poster_url) and str(poster_url).strip() not in ("", "None"):
        return str(poster_url).strip()
        
    if origin == 'tmdb' and pd.notna(movie_id):
        url = "https://api.themoviedb.org/3/movie/{}?api_key=8265bd1679663a7ea12ac168da84d2e8&language=en-US".format(movie_id)
        try:
            data = requests.get(url, timeout=5)
            if data.status_code == 200:
                data = data.json()
                poster_path = data.get('poster_path')
                if poster_path:
                    return "https://image.tmdb.org/t/p/w500/" + poster_path
        except requests.exceptions.RequestException as e:
            print(f"Error fetching poster: {e}")
            
    return "https://placehold.co/500x750/333/FFFFFF?text=No+Poster"


# ─── Pydantic Models ───

class OnboardingRequest(BaseModel):
    name: str
    gender: str
    age: int
    industries: List[str]
    likes: List[str]
    dislikes: List[str]

class SelectionRequest(BaseModel):
    selected_movies: List[str]

class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    display_name: Optional[str] = None

class UserUpdate(BaseModel):
    email: Optional[str] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None

class PreferencesUpdate(BaseModel):
    display_name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    # Accept either a comma-separated string OR a list from the frontend
    favorite_genres: Optional[str] = None
    disliked_genres: Optional[str] = None
    movie_sources: Optional[str] = None   # e.g. "hollywood,bollywood,anime"
    onboarding_completed: bool = True

    class Config:
        # Allow list values to be auto-coerced to comma-separated strings
        json_encoders = {list: lambda v: ','.join(v) if v else None}


class ReviewCreate(BaseModel):
    movie_title: str
    review_text: str

class RatingCreate(BaseModel):
    movie_id: int
    movie_title: str
    rating: float

class YouTubeCommentSchema(BaseModel):
    text: str
    author: str

class YouTubeAnalyzeRequest(BaseModel):
    video_title: str
    views: int
    likes: int
    comments_count: int
    comments: List[YouTubeCommentSchema]

class PopularityRequest(BaseModel):
    budget: float
    runtime: float
    genres: List[str]

class PosterAnalysisRequest(BaseModel):
    image_url: str

class SentimentPredictRequest(BaseModel):
    text: str

class ActivityTrackRequest(BaseModel):
    activity_type: str  # "page_view", "movie_click", "search", "recommendation_click"
    page_url: Optional[str] = None
    movie_title: Optional[str] = None
    extra_data: Optional[str] = None
    duration_seconds: Optional[int] = None

class SearchTrackRequest(BaseModel):
    query: str
    results_count: Optional[int] = 0

class MovieItemCreate(BaseModel):
    movie_title: str
    poster_url: Optional[str] = None

class YoutubeCommentCreate(BaseModel):
    video_title: str
    video_id: Optional[str] = None
    text: str


# ─── Auth Helpers ───

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = auth.jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except auth.jwt.PyJWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

def get_current_user_optional(token: Optional[str] = Depends(oauth2_scheme_optional), db: Session = Depends(get_db)):
    """Returns user if authenticated, None otherwise."""
    if token is None:
        return None
    try:
        payload = auth.jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        user = db.query(models.User).filter(models.User.username == username).first()
        return user
    except:
        return None

def user_to_dict(user: models.User) -> dict:
    """Convert user model to a dict for API responses."""
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "onboarding_completed": getattr(user, "onboarding_completed", False),
        "favorite_genres": getattr(user, "favorite_genres", None),
        "disliked_genres": getattr(user, "disliked_genres", None),
        "movie_sources": getattr(user, "movie_sources", None),
        "age": getattr(user, "age", None),
        "gender": getattr(user, "gender", None),
    }


# ═══════════════════════════════════════════════════
# ─── ROUTES ───
# ═══════════════════════════════════════════════════

@app.get("/")
def read_root():
    return {"message": "Welcome to the Movie Recommender API! Use /recommend?title=MovieTitle to get recommendations."}


# ─── AUTH ENDPOINTS ───

@app.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    if user.email:
        db_email = db.query(models.User).filter(models.User.email == user.email).first()
        if db_email:
            raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(
        username=user.username,
        hashed_password=hashed_password,
        email=user.email,
        display_name=user.display_name or user.username,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Auto-generate token for immediate login
    access_token = auth.create_access_token(data={"sub": new_user.username, "user_id": new_user.id})
    
    return {
        "message": "User registered successfully",
        "user": user_to_dict(new_user),
        "access_token": access_token,
        "token_type": "bearer"
    }


@app.post("/token")
def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    access_token_expires = auth.timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.username, "user_id": user.id},
        expires_delta=access_token_expires
    )
    
    # Create session record
    try:
        ip_address = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent", None)
        auth.create_session_record(db, user.id, access_token, ip_address, user_agent)
    except Exception as e:
        print(f"Warning: Could not create session record: {e}")
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_to_dict(user)
    }


@app.get("/me")
def get_current_user_profile(current_user: models.User = Depends(get_current_user)):
    """Returns the currently authenticated user's profile."""
    return {"user": user_to_dict(current_user)}


@app.put("/me")
def update_user_profile(
    update: UserUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update the currently authenticated user's profile."""
    if update.email is not None:
        current_user.email = update.email
    if update.display_name is not None:
        current_user.display_name = update.display_name
    if update.avatar_url is not None:
        current_user.avatar_url = update.avatar_url
    
    db.commit()
    db.refresh(current_user)
    return {"user": user_to_dict(current_user), "message": "Profile updated successfully"}


def _save_preferences(prefs: PreferencesUpdate, current_user: models.User, db: Session):
    """Shared logic for saving preferences — handles list->CSV coercion."""
    def to_csv(v):
        if v is None:
            return None
        if isinstance(v, list):
            return ','.join(str(x) for x in v)
        return str(v)

    if prefs.display_name is not None:
        current_user.display_name = prefs.display_name
    if prefs.age is not None:
        current_user.age = prefs.age
    if prefs.gender is not None:
        current_user.gender = prefs.gender
    if prefs.favorite_genres is not None:
        current_user.favorite_genres = to_csv(prefs.favorite_genres)
    if prefs.disliked_genres is not None:
        current_user.disliked_genres = to_csv(prefs.disliked_genres)
    if prefs.movie_sources is not None:
        current_user.movie_sources = to_csv(prefs.movie_sources)
    current_user.onboarding_completed = prefs.onboarding_completed
    db.commit()
    db.refresh(current_user)


@app.put("/me/preferences")
def update_user_preferences_put(
    prefs: PreferencesUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Save the user's wizard preferences (PUT)."""
    _save_preferences(prefs, current_user, db)
    return {"user": user_to_dict(current_user), "message": "Preferences saved."}


@app.post("/me/preferences")
def update_user_preferences_post(
    prefs: PreferencesUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Save the user's wizard preferences (POST — alias for PUT)."""
    _save_preferences(prefs, current_user, db)
    return {"user": user_to_dict(current_user), "message": "Preferences saved."}


# ─── ACTIVITY TRACKING ───

@app.post("/track-activity")
def track_activity(
    activity: ActivityTrackRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Log user activity (page views, movie clicks, etc.)."""
    new_activity = models.UserActivity(
        user_id=current_user.id,
        activity_type=activity.activity_type,
        page_url=activity.page_url,
        movie_title=activity.movie_title,
        extra_data=activity.extra_data,
        duration_seconds=activity.duration_seconds,
    )
    db.add(new_activity)
    
    # If it's a search activity, also add to search history
    if activity.activity_type == "search" and activity.extra_data:
        try:
            search_data = json.loads(activity.extra_data)
            search_record = models.SearchHistory(
                user_id=current_user.id,
                query=search_data.get("query", ""),
                results_count=search_data.get("results_count", 0),
            )
            db.add(search_record)
        except (json.JSONDecodeError, AttributeError):
            pass
    
    db.commit()
    return {"message": "Activity tracked"}


@app.post("/track-search")
def track_search(
    search: SearchTrackRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Log a search query."""
    record = models.SearchHistory(
        user_id=current_user.id,
        query=search.query,
        results_count=search.results_count,
    )
    db.add(record)
    db.commit()
    return {"message": "Search tracked"}


@app.get("/user-history")
def get_user_history(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns the user's search and activity history."""
    searches = db.query(models.SearchHistory).filter(
        models.SearchHistory.user_id == current_user.id
    ).order_by(models.SearchHistory.timestamp.desc()).limit(50).all()
    
    activities = db.query(models.UserActivity).filter(
        models.UserActivity.user_id == current_user.id
    ).order_by(models.UserActivity.timestamp.desc()).limit(50).all()
    
    sessions = db.query(models.UserSession).filter(
        models.UserSession.user_id == current_user.id
    ).order_by(models.UserSession.login_at.desc()).limit(10).all()
    
    return {
        "searches": [
            {"id": s.id, "query": s.query, "results_count": s.results_count,
             "timestamp": s.timestamp.isoformat() if s.timestamp else None}
            for s in searches
        ],
        "activities": [
            {"id": a.id, "type": a.activity_type, "page_url": a.page_url,
             "movie_title": a.movie_title, "duration_seconds": a.duration_seconds,
             "timestamp": a.timestamp.isoformat() if a.timestamp else None}
            for a in activities
        ],
        "sessions": [
            {"id": s.id, "login_at": s.login_at.isoformat() if s.login_at else None,
             "ip_address": s.ip_address, "user_agent": s.user_agent, "is_active": s.is_active}
            for s in sessions
        ],
    }


# ─── PREFERENCE PREDICTION ───

@app.get("/predict-preferences")
def predict_user_preferences(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Predict user's preferred genres based on their activity and ratings."""
    # Get user's ratings
    ratings = db.query(models.Rating).filter(models.Rating.user_id == current_user.id).all()
    ratings_list = [{"movie_title": r.movie_title, "rating": r.rating} for r in ratings]
    
    # Get user's searches
    searches = db.query(models.SearchHistory).filter(models.SearchHistory.user_id == current_user.id).all()
    search_queries = [s.query for s in searches]
    
    # Run prediction
    result = user_preference.predict_preferences(ratings_list, search_queries, movies)
    return result


# ─── SENTIMENT PREDICTION (TF + PyTorch) ───

@app.post("/sentiment-predict")
def predict_sentiment(request: SentimentPredictRequest):
    """
    Run sentiment analysis on input text using both TensorFlow and PyTorch models.
    Returns predictions from both models for comparison.
    """
    import subprocess
    import json
    
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    results = {"input_text": text, "models": {}}
    
    # TensorFlow prediction via isolated subprocess (prevents Mac libc++abi aborts from crashing FastAPI)
    try:
        py_script = f"""
import json
import sys
try:
    from ml.sentiment_tf import predict_sentiment_tf
    res = predict_sentiment_tf({repr(text)})
    print(json.dumps(res))
except Exception as e:
    print(json.dumps({{"error": str(e)}}))
sys.exit(0)
"""
        proc = subprocess.run(["python3", "-c", py_script], capture_output=True, text=True, timeout=10)
        
        if proc.returncode != 0:
            # Native crash (e.g. 134 on Mac)
            results["models"]["tensorflow"] = {
                "error": "TensorFlow aborted natively (common on macOS arm64). Using fallback."
            }
        else:
            try:
                # Find JSON output
                for line in proc.stdout.splitlines():
                    if line.startswith('{'):
                        tf_result = json.loads(line)
                        results["models"]["tensorflow"] = tf_result
                        break
                if "tensorflow" not in results["models"]:
                    results["models"]["tensorflow"] = {"error": "Failed to parse TF output."}
            except Exception as e:
                results["models"]["tensorflow"] = {"error": str(e)}
                
    except Exception as e:
        results["models"]["tensorflow"] = {"error": str(e)}
    
    # PyTorch prediction (Now safe and isolated from TF)
    try:
        from ml.sentiment_torch import predict_sentiment_torch
        torch_result = predict_sentiment_torch(text)
        results["models"]["pytorch"] = torch_result
    except Exception as e:
        results["models"]["pytorch"] = {"error": str(e)}
    
    # Combined verdict
    tf_label = results["models"].get("tensorflow", {}).get("label", "unknown")
    pt_label = results["models"].get("pytorch", {}).get("label", "unknown")
    
    if tf_label == pt_label and tf_label != "unknown":
        results["consensus"] = tf_label
        results["agreement"] = True
    else:
        results["consensus"] = tf_label if tf_label != "unknown" else pt_label
        results["agreement"] = False
    
    return results


# ─── EXISTING ENDPOINTS (unchanged) ───

@app.post("/rate")
def rate_movie(rating: RatingCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if fake_engagement.is_user_fake(current_user.id):
        raise HTTPException(status_code=403, detail="Your account has been flagged for anomalous rating behavior.")
        
    db_rating = db.query(models.Rating).filter(
        models.Rating.user_id == current_user.id,
        models.Rating.movie_id == rating.movie_id
    ).first()

    if db_rating:
        db_rating.rating = rating.rating
        db.commit()
        db.refresh(db_rating)
        return {"message": "Rating updated", "rating": db_rating}
    else:
        new_rating = models.Rating(
            movie_id=rating.movie_id,
            movie_title=rating.movie_title,
            rating=rating.rating,
            user_id=current_user.id
        )
        db.add(new_rating)
        db.commit()
        db.refresh(new_rating)
        return {"message": "Rating added", "rating": new_rating}

@app.get("/user-ratings")
def get_user_ratings(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    ratings = db.query(models.Rating).filter(models.Rating.user_id == current_user.id).all()
    return {"ratings": ratings}

@app.post("/admin/train-engagement")
def train_engagement_model(db: Session = Depends(get_db)):
    ratings = db.query(models.Rating).all()
    if not ratings:
        return {"message": "Not enough ratings in database to train engagement model."}
        
    df = pd.DataFrame([{"user_id": r.user_id, "rating": r.rating} for r in ratings])
    success = fake_engagement.train_fake_engagement_model(df)
    if success:
        return {"message": "Engagement model successfully trained on current ratings data."}
    else:
        return {"message": "Failed to train engagement model."}

@app.get("/movies")
def get_movies(
    limit: int = 24,
    offset: int = 0,
    search: Optional[str] = None,    # keyword search on title + tags
    genre: Optional[str] = None,
    genres: Optional[str] = None,
    sources: Optional[str] = None,   # comma-separated: "bollywood,hollywood,anime"
    min_rating: Optional[float] = None,
    max_rating: Optional[float] = None,
    start_year: Optional[int] = None,
    end_year: Optional[int] = None
):
    """Get paginated movies, optionally filtered by search keyword and advanced options."""
    df = movies.copy()

    # ── Keyword search ──
    if search and search.strip():
        q = search.strip().lower()
        title_match = df['title'].str.contains(q, case=False, na=False)
        tags_match = df['tags'].str.contains(q, case=False, na=False) if 'tags' in df.columns else pd.Series([False] * len(df), index=df.index)
        match_df = df[title_match | tags_match].copy()
        
        if len(match_df) < 5:
            import difflib
            all_titles = df['title'].dropna().astype(str).tolist()
            close_titles = difflib.get_close_matches(q, all_titles, n=20, cutoff=0.5)
            if close_titles:
                fuzzy_df = df[df['title'].isin(close_titles)].copy()
                match_df = pd.concat([match_df, fuzzy_df]).drop_duplicates(subset=['id'] if 'id' in df.columns else ['title'])
                
        if not match_df.empty:
            match_df['match_len'] = match_df['title'].str.len()
            match_df = match_df.sort_values('match_len')
            
        df = match_df

    # ── Source filtering ──
    if sources:
        source_list = [s.strip().lower() for s in sources.split(",")]
        origin_map = {"hollywood": "tmdb", "bollywood": "bollywood", "anime": "anime"}
        allowed_origins = [origin_map[s] for s in source_list if s in origin_map]
        if allowed_origins:
            df = df[df['origin'].isin(allowed_origins)]

    # ── Genre filtering (single) ──
    if genre and genre != "All":
        df = df[
            df['tags'].str.contains(genre, case=False, na=False) |
            df['genres_list'].apply(lambda g: genre in g if isinstance(g, list) else False)
        ]

    # ── Genre filtering (multiple, comma-separated) ──
    if genres:
        selected_genres = [g.strip() for g in genres.split(",")]
        df = df[df['genres_list'].apply(
            lambda gl: any(g in gl for g in selected_genres) if isinstance(gl, list) else False
        )]

    # ── Rating filter ──
    if min_rating is not None and 'vote_average' in df.columns:
        df = df[df['vote_average'] >= min_rating]
    if max_rating is not None and 'vote_average' in df.columns:
        df = df[df['vote_average'] <= max_rating]

    # ── Year filter ──
    if start_year is not None and 'release_date' in df.columns:
        df['year_tmp'] = pd.to_datetime(df['release_date'], errors='coerce').dt.year
        df = df[df['year_tmp'] >= start_year]
    if end_year is not None and 'release_date' in df.columns:
        if 'year_tmp' not in df.columns:
            df['year_tmp'] = pd.to_datetime(df['release_date'], errors='coerce').dt.year
        df = df[df['year_tmp'] <= end_year]
    if 'year_tmp' in df.columns:
        df = df.drop(columns=['year_tmp'])

    # ── Sort ──
    if 'vote_average' in df.columns:
        df = df.sort_values(by='vote_average', ascending=False)

    total = len(df)
    paginated = df.iloc[offset:offset + limit]

    results = []
    for _, row in paginated.iterrows():
        poster_url = fetch_poster(row)
        results.append({
            "id": row.get('id'),
            "title": row['title'],
            "poster": poster_url,
            "poster_url": poster_url,
            "vote_average": float(row['vote_average']) if 'vote_average' in row and pd.notna(row['vote_average']) else None,
            "rating": float(row['vote_average']) if 'vote_average' in row and pd.notna(row['vote_average']) else None,
            "year": int(row['year']) if 'year' in row and pd.notna(row['year']) else None,
            "genres": row['genres_list'] if isinstance(row.get('genres_list'), list) else [],
            "origin": row.get('origin'),
        })

    return {
        "movies": results,
        "total": total,
        "has_more": (offset + limit) < total
    }


class BatchMoviesRequest(BaseModel):
    titles: List[str]


@app.post("/movies/batch")
def get_movies_batch(request: BatchMoviesRequest):
    """
    N×N Parallel FAISS-backed batch movie loader.
    Accepts a list of movie titles and returns their full details in parallel
    using a ThreadPoolExecutor for maximum throughput.
    """
    if not request.titles:
        return {"movies": []}

    def load_one(title: str) -> Optional[dict]:
        match = movies[movies['title'] == title]
        if match.empty:
            match = movies[movies['title'].str.lower() == title.lower()]
        if match.empty:
            return None
        row = match.iloc[0]
        poster_url = fetch_poster(row)
        return {
            "title": str(row['title']),
            "poster": poster_url,
            "poster_url": poster_url,
            "rating": float(row['vote_average']) if pd.notna(row.get('vote_average')) else None,
            "vote_average": float(row['vote_average']) if pd.notna(row.get('vote_average')) else None,
            "year": int(row['year']) if pd.notna(row.get('year')) else None,
            "genres": row['genres_list'] if isinstance(row.get('genres_list'), list) else [],
            "origin": row.get('origin'),
        }

    # N×N parallel load using ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=min(len(request.titles), 32)) as executor:
        results = list(executor.map(load_one, request.titles))

    return {"movies": [m for m in results if m is not None]}

@app.post("/onboarding")
def onboarding_recommendations(request: OnboardingRequest):
    filtered_movies = movies.copy()
    
    industry_mask = pd.Series([False] * len(filtered_movies), index=filtered_movies.index)
    if "Hollywood" in request.industries:
        industry_mask |= (filtered_movies['origin'] == 'tmdb')
    if "Bollywood" in request.industries:
        industry_mask |= (filtered_movies['origin'] == 'bollywood')
    if "Anime" in request.industries:
        industry_mask |= (filtered_movies['origin'] == 'anime')
    if request.industries:
        filtered_movies = filtered_movies[industry_mask]
    
    if request.dislikes:
        def has_dislike(genres):
            if not isinstance(genres, list): return False
            return any(genre in request.dislikes for genre in genres)
        filtered_movies = filtered_movies[~filtered_movies['genres_list'].apply(has_dislike)]
        
    if request.likes:
        def count_likes(genres):
            if not isinstance(genres, list): return 0
            return sum(1 for genre in genres if genre in request.likes)
        filtered_movies['like_score'] = filtered_movies['genres_list'].apply(count_likes)
        candidates = filtered_movies.sort_values(by=['like_score', 'vote_average'], ascending=[False, False])
    else:
        candidates = filtered_movies.sort_values(by='vote_average', ascending=False)
        
    top_candidates = candidates.head(12)
    
    response = []
    for _, row in top_candidates.iterrows():
        response.append({
            "title": row.title,
            "poster": fetch_poster(row),
            "year": int(row.year) if pd.notna(row.year) else None,
            "rating": float(row.vote_average) if pd.notna(row.vote_average) else None,
            "genres": row.genres_list if isinstance(row.genres_list, list) else []
        })
        
    return {"candidates": response}

@app.post("/recommend_selection")
def recommend_from_selection(request: SelectionRequest):
    if not request.selected_movies:
        raise HTTPException(status_code=400, detail="No movies selected")

    indices = []
    for title in request.selected_movies:
        if title in movies['title'].values:
            idx = int(movies[movies['title'] == title].index[0])
            indices.append(idx)
            
    if not indices:
        raise HTTPException(status_code=404, detail="Selected movies not found")

    vectors = np.array([index.reconstruct(idx) for idx in indices])
    combined_vector = vectors.sum(axis=0, keepdims=True)
    faiss.normalize_L2(combined_vector)
    
    D, I = index.search(combined_vector, k=20)
    
    recommendations = []
    count = 0
    for dist, idx in zip(D[0], I[0]):
        if count >= 10: break
        if idx in indices:
            continue
        row = movies.iloc[idx]
        rec = {
            "title": row.title,
            "poster": fetch_poster(row),
            "year": int(row.year) if pd.notna(row.year) else None,
            "rating": float(row.vote_average) if pd.notna(row.vote_average) else None,
            "genres": row.genres_list if isinstance(row.genres_list, list) else []
        }
        recommendations.append(rec)
        count += 1
            
    return {"recommendations": recommendations}

@app.get("/movie-sentiment")
def get_movie_sentiment(title: str):
    match = movies[movies['title'] == title]
    if match.empty:
        match = movies[movies['title'].str.lower() == title.lower()]
    
    rating = 7.0
    if not match.empty and pd.notna(match.iloc[0].get('vote_average')):
        rating = float(match.iloc[0]['vote_average'])
        
    analysis = sentiment_analysis.analyze_movie_sentiment(title, rating)
    return analysis

@app.post("/predict-popularity")
def predict_movie_popularity(request: PopularityRequest):
    model_path = os.path.join(BASE_DIR, 'artifacts', 'popularity_model.pkl')
    try:
        predicted_revenue = popularity_model.load_and_predict(
            budget=request.budget,
            runtime=request.runtime,
            genres=request.genres,
            model_path=model_path
        )
        return {
            "predicted_revenue": predicted_revenue,
            "currency": "USD",
            "message": "Prediction successful based on Random Forest model."
        }
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="Popularity model not trained yet.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze-poster")
def analyze_movie_poster(request: PosterAnalysisRequest):
    if not request.image_url or not request.image_url.startswith("http"):
        raise HTTPException(status_code=400, detail="A valid image URL must be provided.")
    results = poster_classifier.analyze_poster_genres(request.image_url)
    return results

@app.get("/recommend/dl")
def get_dl_recommendations_endpoint(
    current_user: models.User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Deep learning personalized recommendations based on user activity (legacy)."""
    user_data = {"likes_count": 10, "views_count": 50}
    dl_scores = dl_recommender.get_dl_recommendations(user_data, top_k=3)
    top_genres = [g["genre"] for g in dl_scores]

    if 'genres_list' in movies.columns:
        mask = movies['genres_list'].apply(
            lambda x: isinstance(x, list) and any(g in top_genres for g in x)
        )
        recommended = movies[mask].head(12)
    else:
        recommended = movies.head(12)

    results = []
    for _, row in recommended.iterrows():
        poster_url = fetch_poster(row)
        results.append({
            "title": str(row['title']),
            "poster": poster_url,
            "poster_url": poster_url,
            "year": int(row['year']) if pd.notna(row['year']) else None,
            "rating": float(row['vote_average']) if pd.notna(row['vote_average']) else None,
            "genres": row['genres_list'] if isinstance(row.get('genres_list'), list) else [],
        })

    return {"dl_scores": dl_scores, "recommendations": results}


@app.get("/recommend/personalized")
def get_personalized_recommendations(
    limit: int = 28,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Full personalized movie recommendations using Deep Learning.
    Uses user profile (age, gender, liked/disliked genres, movie_sources)
    + full activity history (ratings, searches, movie clicks) to score genres
    via the UserActivityMLP PyTorch model, then filters and re-ranks the movie catalog.
    """
    # ── Gather user profile ──
    age = getattr(current_user, 'age', None)
    gender = getattr(current_user, 'gender', None)
    fav_genres_str = getattr(current_user, 'favorite_genres', '') or ''
    dis_genres_str = getattr(current_user, 'disliked_genres', '') or ''
    movie_sources_str = getattr(current_user, 'movie_sources', '') or ''

    favorite_genres = [g.strip() for g in fav_genres_str.split(',') if g.strip()]
    disliked_genres = [g.strip() for g in dis_genres_str.split(',') if g.strip()]
    preferred_sources = [s.strip().lower() for s in movie_sources_str.split(',') if s.strip()]

    # ── Gather activity history from DB ──
    ratings_db = db.query(models.Rating).filter(models.Rating.user_id == current_user.id).all()
    ratings = [{"movie_title": r.movie_title, "rating": r.rating} for r in ratings_db]

    searches_db = db.query(models.SearchHistory).filter(
        models.SearchHistory.user_id == current_user.id
    ).order_by(models.SearchHistory.timestamp.desc()).limit(100).all()
    searches = [s.query for s in searches_db]

    clicks_db = db.query(models.UserActivity).filter(
        models.UserActivity.user_id == current_user.id,
        models.UserActivity.activity_type == 'movie_click'
    ).order_by(models.UserActivity.timestamp.desc()).limit(200).all()
    clicked_movies = [c.movie_title for c in clicks_db if c.movie_title]

    fav_db = db.query(models.Favorite).filter(models.Favorite.user_id == current_user.id).all()
    favorites = [f.movie_title for f in fav_db if f.movie_title]
    
    watchlist_db = db.query(models.Watchlist).filter(models.Watchlist.user_id == current_user.id).all()
    watchlist = [w.movie_title for w in watchlist_db if w.movie_title]

    # ── Run DL model ──
    dl_genre_scores = dl_recommender.get_dl_recommendations_full(
        age=age,
        gender=gender,
        favorite_genres=favorite_genres,
        disliked_genres=disliked_genres,
        ratings=ratings,
        searches=searches,
        clicked_movies=clicked_movies,
        favorites=favorites,
        watchlist=watchlist,
        movies_df=movies,
        top_k=8,
    )
    top_genres = [g["genre"] for g in dl_genre_scores]

    # ── Filter movie catalog ──
    df = movies.copy()

    # Apply source preference if set
    if preferred_sources:
        origin_map = {"hollywood": "tmdb", "bollywood": "bollywood", "anime": "anime"}
        allowed_origins = [origin_map[s] for s in preferred_sources if s in origin_map]
        if allowed_origins:
            df = df[df['origin'].isin(allowed_origins)]

    # Remove disliked genres
    if disliked_genres:
        def not_disliked(genres_list):
            if not isinstance(genres_list, list):
                return True
            return not any(g in disliked_genres for g in genres_list)
        df = df[df['genres_list'].apply(not_disliked)]

    # Exclude already-rated movies (user has seen them) using precomputed title_lower
    rated_titles_lower = {r['movie_title'].lower() for r in ratings}
    if 'title_lower' in df.columns:
        df = df[~df['title_lower'].isin(rated_titles_lower)]
    else:
        df = df[~df['title'].str.lower().isin(rated_titles_lower)]

    # ── Score each movie by DL genre preference ──
    genre_score_map = {g['genre']: g['score'] for g in dl_genre_scores}

    df = df.copy()
    
    # Vectorized scoring instead of slow df.apply(axis=1)
    vote_averages = df['vote_average'].fillna(5.0).values
    genres_lists = df['genres_list'].values
    
    # Compute dl_boost efficiently via list comprehension
    dl_boosts = np.array([
        sum(genre_score_map.get(g, 0.0) for g in gl) if isinstance(gl, list) else 0.0
        for gl in genres_lists
    ])
    
    # Vectorized score calculation (Weighted: 40% quality, 60% personalization)
    base_scores = vote_averages / 10.0
    df['_score'] = base_scores * 0.4 + dl_boosts * 0.6
    
    df = df.sort_values('_score', ascending=False)

    # ── Build response ──
    personalized = df.head(limit)
    
    def process_row(row):
        poster_url = fetch_poster(row)
        return {
            "id": row.get('id'),
            "title": str(row['title']),
            "poster": poster_url,
            "poster_url": poster_url,
            "vote_average": float(row['vote_average']) if pd.notna(row.get('vote_average')) else None,
            "rating": float(row['vote_average']) if pd.notna(row.get('vote_average')) else None,
            "year": int(row['year']) if pd.notna(row.get('year')) else None,
            "genres": row['genres_list'] if isinstance(row.get('genres_list'), list) else [],
            "origin": row.get('origin'),
        }
    
    # Fetch posters concurrently to avoid massive sequential API overheads
    with ThreadPoolExecutor(max_workers=min(limit, 32)) as executor:
        results = list(executor.map(process_row, [row for _, row in personalized.iterrows()]))

    profile_strength = "strong" if (favorite_genres or ratings) else ("moderate" if searches else "cold")

    return {
        "movies": results,
        "total": len(results),
        "has_more": False,
        "personalized": True,
        "profile_strength": profile_strength,
        "top_genres": top_genres,
        "user_info": {
            "age": age,
            "gender": gender,
            "favorite_genres": favorite_genres,
            "disliked_genres": disliked_genres,
            "ratings_count": len(ratings),
            "searches_count": len(searches),
        },
    }


@app.get("/recommend")
def recommend_movie(title: str):
    try:
        if title not in movies['title'].values:
            raise HTTPException(status_code=404, detail="Movie not found in the dataset.")
            
        index_id = int(movies[movies['title'] == title].index[0])
        vec = index.reconstruct(index_id).reshape(1, -1)
        D, I = index.search(vec, k=6)
        
        recommendations = []
        for dist, idx in zip(D[0][1:], I[0][1:]):
            row = movies.iloc[idx]
            rec = {
                "title": row.title,
                "poster": fetch_poster(row),
                "year": int(row.year) if pd.notna(row.year) else None,
                "rating": float(row.vote_average) if pd.notna(row.vote_average) else None
            }
            recommendations.append(rec)
            
        return {"input_movie": title, "recommendations": recommendations}
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/movie-details")
def get_movie_details(title: str):
    match = movies[movies['title'] == title]
    if match.empty:
        match = movies[movies['title'].str.lower() == title.lower()]
    if match.empty:
        raise HTTPException(status_code=404, detail="Movie not found.")

    row_main = match.iloc[0]
    origin = row_main['origin']

    def parse_json(val):
        if pd.isna(val):
            return []
        try:
            return json.loads(val)
        except (json.JSONDecodeError, TypeError):
            try:
                import ast
                val_ast = ast.literal_eval(val)
                if isinstance(val_ast, list): return val_ast
            except:
                pass
            return []

    if origin == 'tmdb' and tmdb_full_data is not None:
        tmdb_match = tmdb_full_data[tmdb_full_data['title'] == row_main['title']]
        if not tmdb_match.empty:
            row = tmdb_match.iloc[0]
            genres = [g['name'] for g in parse_json(row.get('genres', '[]'))]
            cast_raw = parse_json(row.get('cast', '[]'))
            cast = [{"name": c['name'], "character": c.get('character', ''), "order": c.get('order', 99)} for c in cast_raw[:12]]
            crew_raw = parse_json(row.get('crew', '[]'))
            director = next((c['name'] for c in crew_raw if c.get('job') == 'Director'), None)
            countries = [c['name'] for c in parse_json(row.get('production_countries', '[]'))]
            languages = [l['name'] for l in parse_json(row.get('spoken_languages', '[]'))]
            companies = [c['name'] for c in parse_json(row.get('production_companies', '[]'))]
            keywords = [k['name'] for k in parse_json(row.get('keywords', '[]'))]

            movie_id = int(row['id']) if pd.notna(row.get('id')) else None
            poster = fetch_poster(row_main)

            release_date = str(row['release_date']) if pd.notna(row.get('release_date')) else None
            year = int(release_date[:4]) if release_date and len(release_date) >= 4 else None

            return {
                "title": str(row['title']),
                "overview": str(row['overview']) if pd.notna(row.get('overview')) else None,
                "tagline": str(row['tagline']) if pd.notna(row.get('tagline')) else None,
                "poster": poster,
                "poster_url": poster,
                "year": year,
                "release_date": release_date,
                "rating": float(row['vote_average']) if pd.notna(row.get('vote_average')) else None,
                "vote_average": float(row['vote_average']) if pd.notna(row.get('vote_average')) else None,
                "vote_count": int(row['vote_count']) if pd.notna(row.get('vote_count')) else None,
                "runtime": int(row['runtime']) if pd.notna(row.get('runtime')) else None,
                "budget": int(row['budget']) if pd.notna(row.get('budget')) else None,
                "revenue": int(row['revenue']) if pd.notna(row.get('revenue')) else None,
                "popularity": float(row['popularity']) if pd.notna(row.get('popularity')) else None,
                "status": str(row['status']) if pd.notna(row.get('status')) else None,
                "original_language": str(row['original_language']) if pd.notna(row.get('original_language')) else None,
                "genres": genres,
                "cast": cast,
                "director": director,
                "production_countries": countries,
                "spoken_languages": languages,
                "production_companies": companies,
                "keywords": keywords[:10],
            }

    if origin == 'anime' and anime_df_full is not None:
        anime_match = anime_df_full[anime_df_full['Name'] == row_main['title']]
        if not anime_match.empty:
            row = anime_match.iloc[0]
            anime_poster = fetch_poster(row_main)
            anime_rating = float(row['Score']) if pd.notna(row.get('Score')) and str(row['Score']) != 'UNKNOWN' else None
            return {
                "title": str(row['Name']),
                "overview": str(row['Synopsis']) if pd.notna(row.get('Synopsis')) else None,
                "tagline": None,
                "poster": anime_poster,
                "poster_url": anime_poster,
                "year": int(row_main['year']) if pd.notna(row_main['year']) else None,
                "release_date": str(row['Aired']) if pd.notna(row.get('Aired')) else None,
                "rating": anime_rating,
                "vote_average": anime_rating,
                "vote_count": int(float(row['Scored By'])) if pd.notna(row.get('Scored By')) and str(row['Scored By']) != 'UNKNOWN' else None,
                "runtime": None,
                "budget": None,
                "revenue": None,
                "popularity": None,
                "status": str(row['Status']) if pd.notna(row.get('Status')) else None,
                "original_language": "Japanese",
                "genres": [g.strip() for g in str(row.get('Genres', '')).split(',')] if pd.notna(row.get('Genres')) and str(row.get('Genres')) != 'UNKNOWN' else [],
                "cast": [],
                "director": None,
                "production_countries": ["Japan"],
                "spoken_languages": ["Japanese"],
                "production_companies": [g.strip() for g in str(row.get('Studios', '')).split(',')] if pd.notna(row.get('Studios')) and str(row.get('Studios')) != 'UNKNOWN' else [],
                "keywords": [],
            }

    if origin == 'bollywood' and bolly_df_full is not None:
        bolly_match = bolly_df_full[bolly_df_full['title_x'] == row_main['title']]
        if not bolly_match.empty:
            row = bolly_match.iloc[0]
            bolly_poster = fetch_poster(row_main)
            bolly_rating = float(row['imdb_rating']) if pd.notna(row.get('imdb_rating')) else None
            cast = [{"name": c.strip(), "character": "", "order": i} for i, c in enumerate(str(row.get('actors', '')).split('|'))] if pd.notna(row.get('actors')) else []
            return {
                "title": str(row['title_x']),
                "overview": str(row['story']) if pd.notna(row.get('story')) else None,
                "tagline": str(row['tagline']) if pd.notna(row.get('tagline')) else None,
                "poster": bolly_poster,
                "poster_url": bolly_poster,
                "year": int(row_main['year']) if pd.notna(row_main['year']) else None,
                "release_date": str(row['release_date']) if pd.notna(row.get('release_date')) else None,
                "rating": bolly_rating,
                "vote_average": bolly_rating,
                "vote_count": int(float(row['imdb_votes'])) if pd.notna(row.get('imdb_votes')) and str(row['imdb_votes']) != 'nan' else None,
                "runtime": int(row['runtime']) if pd.notna(row.get('runtime')) else None,
                "budget": None,
                "revenue": None,
                "popularity": None,
                "status": "Released",
                "original_language": "Hindi",
                "genres": str(row['genres']).split('|') if pd.notna(row.get('genres')) else [],
                "cast": cast[:12],
                "director": None,
                "production_countries": ["India"],
                "spoken_languages": ["Hindi"],
                "production_companies": [],
                "keywords": [],
            }

    fallback_poster = fetch_poster(row_main)
    return {
        "title": str(row_main['title']),
        "overview": None,
        "poster": fallback_poster,
        "poster_url": fallback_poster,
        "year": int(row_main['year']) if pd.notna(row_main['year']) else None,
        "rating": float(row_main['vote_average']) if pd.notna(row_main['vote_average']) else None,
        "vote_average": float(row_main['vote_average']) if pd.notna(row_main['vote_average']) else None,
        "genres": row_main['genres_list'] if isinstance(row_main['genres_list'], list) else [],
        "vote_count": None,
        "runtime": None,
    }

# ─── FAVORITES & WATCHLIST ───

@app.post("/favorites")
def add_favorite(item: MovieItemCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    existing = db.query(models.Favorite).filter(
        models.Favorite.user_id == current_user.id,
        models.Favorite.movie_title == item.movie_title
    ).first()
    if existing:
        return {"message": "Already in favorites"}
    
    poster_url = item.poster_url
    if not poster_url:
        match = movies[movies['title'] == item.movie_title]
        if match.empty:
            match = movies[movies['title'].str.lower() == item.movie_title.lower()]
        if not match.empty:
            poster_url = fetch_poster(match.iloc[0])

    new_fav = models.Favorite(
        user_id=current_user.id,
        movie_title=item.movie_title,
        poster_url=poster_url
    )
    db.add(new_fav)
    db.commit()
    db.refresh(new_fav)
    return {"message": "Added to favorites", "favorite": new_fav}

@app.get("/favorites")
def get_favorites(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    favs = db.query(models.Favorite).filter(models.Favorite.user_id == current_user.id).order_by(models.Favorite.timestamp.desc()).all()
    return {"favorites": favs}

@app.delete("/favorites/{movie_title}")
def remove_favorite(movie_title: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    fav = db.query(models.Favorite).filter(
        models.Favorite.user_id == current_user.id,
        models.Favorite.movie_title == movie_title
    ).first()
    if fav:
        db.delete(fav)
        db.commit()
    return {"message": "Removed from favorites"}

@app.post("/watchlist")
def add_watchlist(item: MovieItemCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    existing = db.query(models.Watchlist).filter(
        models.Watchlist.user_id == current_user.id,
        models.Watchlist.movie_title == item.movie_title
    ).first()
    if existing:
        return {"message": "Already in watchlist"}
    
    poster_url = item.poster_url
    if not poster_url:
        match = movies[movies['title'] == item.movie_title]
        if match.empty:
            match = movies[movies['title'].str.lower() == item.movie_title.lower()]
        if not match.empty:
            poster_url = fetch_poster(match.iloc[0])

    new_watch = models.Watchlist(
        user_id=current_user.id,
        movie_title=item.movie_title,
        poster_url=poster_url
    )
    db.add(new_watch)
    db.commit()
    db.refresh(new_watch)
    return {"message": "Added to watchlist", "watchlist": new_watch}

@app.get("/watchlist")
def get_watchlist(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(models.Watchlist).filter(models.Watchlist.user_id == current_user.id).order_by(models.Watchlist.timestamp.desc()).all()
    return {"watchlist": items}

@app.delete("/watchlist/{movie_title}")
def remove_watchlist(movie_title: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(models.Watchlist).filter(
        models.Watchlist.user_id == current_user.id,
        models.Watchlist.movie_title == movie_title
    ).first()
    if item:
        db.delete(item)
        db.commit()
    return {"message": "Removed from watchlist"}

# ─── YOUTUBE & VIDEO ML ───

@app.post("/youtube/analyze")
def analyze_youtube_video(req: YouTubeAnalyzeRequest):
    comments_data = [{"text": c.text, "author": c.author} for c in req.comments]
    sentiment_analysis = youtube_ml.analyze_comments(comments_data)
    engagement_analysis = youtube_ml.detect_fake_engagement(req.views, req.likes, req.comments_count)
    return {
        "sentiment_analysis": sentiment_analysis,
        "fake_engagement": engagement_analysis
    }


@app.get("/youtube/recommend")
def get_youtube_recommendations(video_title: str, region: Optional[str] = None):
    recs = youtube_ml.recommend_videos(video_title, num_recommendations=12, region=region)
    return {"recommendations": recs}


@app.get("/youtube/video-data")
def get_youtube_video_data(video_title: str):
    """Get real dataset stats for a given video title."""
    stats = youtube_ml.get_video_stats(video_title)
    return stats or {"title": video_title, "views": 0, "likes": 0, "comment_count": 0}


@app.get("/youtube/comments")
def get_youtube_comments(video_title: str, db: Session = Depends(get_db),
                         sentiment: Optional[str] = None,
                         limit: int = 100, offset: int = 0):
    """Get all user comments for a specific video (public endpoint)."""
    query = db.query(models.YoutubeComment).filter(
        models.YoutubeComment.video_title == video_title
    )
    if sentiment and sentiment in ("positive", "negative", "neutral"):
        query = query.filter(models.YoutubeComment.sentiment_label == sentiment)
    total = query.count()
    comments = query.order_by(models.YoutubeComment.timestamp.desc()).offset(offset).limit(limit).all()
    result = []
    for c in comments:
        author = "Anonymous"
        avatar_letter = "A"
        if c.owner:
            author = c.owner.display_name or c.owner.username or "Anonymous"
            avatar_letter = author[0].upper()
        result.append({
            "id": c.id,
            "video_title": c.video_title,
            "text": c.text,
            "sentiment_label": c.sentiment_label,
            "sentiment_score": c.sentiment_score,
            "author": author,
            "avatar_letter": avatar_letter,
            "user_id": c.user_id,
            "timestamp": c.timestamp.isoformat() if c.timestamp else None,
        })
    # Sentiment summary
    all_c = db.query(models.YoutubeComment).filter(models.YoutubeComment.video_title == video_title).all()
    pos = sum(1 for c in all_c if c.sentiment_label == "positive")
    neg = sum(1 for c in all_c if c.sentiment_label == "negative")
    neu = sum(1 for c in all_c if c.sentiment_label == "neutral")
    tot = len(all_c)
    return {
        "comments": result,
        "total": total,
        "sentiment_summary": {
            "total": tot,
            "positive": pos,
            "negative": neg,
            "neutral": neu,
            "positive_pct": round(pos / tot * 100, 1) if tot else 0,
            "negative_pct": round(neg / tot * 100, 1) if tot else 0,
            "neutral_pct": round(neu / tot * 100, 1) if tot else 0,
        }
    }


@app.post("/youtube/comments")
def post_youtube_comment(
    comment: YoutubeCommentCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Post a comment on a YouTube video; sentiment auto-classified."""
    if not comment.text.strip():
        raise HTTPException(status_code=400, detail="Comment text cannot be empty.")
    # Classify sentiment
    try:
        sentiment_result = youtube_ml.classify_comment_sentiment(comment.text)
        sentiment_label = sentiment_result.get("label", "neutral")
        sentiment_score = sentiment_result.get("confidence", 0.5)
    except Exception:
        sentiment_label = "neutral"
        sentiment_score = 0.5
    new_comment = models.YoutubeComment(
        video_title=comment.video_title,
        video_id=comment.video_id,
        text=comment.text.strip(),
        sentiment_label=sentiment_label,
        sentiment_score=sentiment_score,
        user_id=current_user.id,
    )
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)
    author = current_user.display_name or current_user.username
    return {
        "message": "Comment posted",
        "comment": {
            "id": new_comment.id,
            "video_title": new_comment.video_title,
            "text": new_comment.text,
            "sentiment_label": new_comment.sentiment_label,
            "sentiment_score": new_comment.sentiment_score,
            "author": author,
            "avatar_letter": author[0].upper() if author else "A",
            "user_id": current_user.id,
            "timestamp": new_comment.timestamp.isoformat() if new_comment.timestamp else None,
        }
    }


# ─── REVIEWS WITH SENTIMENT ───

@app.post("/reviews")
def create_review(
    review: ReviewCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Post a review for a movie; sentiment is analyzed automatically."""
    sentiment_label = None
    sentiment_confidence = None
    sentiment_score = None

    # Run quick PyTorch sentiment on review text
    try:
        from ml.sentiment_torch import predict_sentiment_torch
        result = predict_sentiment_torch(review.review_text)
        sentiment_label = result.get("label", "neutral")
        sentiment_confidence = result.get("confidence", 0.0)
        sentiment_score = result.get("score", 0.0)
    except Exception as e:
        print(f"Sentiment analysis failed: {e}")

    new_review = models.MovieReview(
        user_id=current_user.id,
        movie_title=review.movie_title,
        review_text=review.review_text,
        sentiment_label=sentiment_label,
        sentiment_confidence=sentiment_confidence,
        sentiment_score=sentiment_score,
    )
    db.add(new_review)
    db.commit()
    db.refresh(new_review)

    return {
        "message": "Review posted",
        "review": {
            "id": new_review.id,
            "movie_title": new_review.movie_title,
            "review_text": new_review.review_text,
            "sentiment_label": new_review.sentiment_label,
            "sentiment_confidence": new_review.sentiment_confidence,
            "author": current_user.display_name or current_user.username,
            "timestamp": new_review.timestamp.isoformat() if new_review.timestamp else None,
        }
    }


@app.get("/reviews")
def get_movie_reviews(movie_title: str, db: Session = Depends(get_db)):
    """Get all reviews for a specific movie."""
    reviews = db.query(models.MovieReview).filter(
        models.MovieReview.movie_title == movie_title
    ).order_by(models.MovieReview.timestamp.desc()).all()

    result = []
    for r in reviews:
        author = "Anonymous"
        if r.owner:
            author = r.owner.display_name or r.owner.username or "Anonymous"
        result.append({
            "id": r.id,
            "movie_title": r.movie_title,
            "review_text": r.review_text,
            "sentiment_label": r.sentiment_label,
            "sentiment_confidence": r.sentiment_confidence,
            "author": author,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
        })

    # Compute aggregate sentiment
    total = len(result)
    positive = sum(1 for r in result if r["sentiment_label"] == "positive")
    negative = sum(1 for r in result if r["sentiment_label"] == "negative")
    neutral = total - positive - negative

    return {
        "reviews": result,
        "total": total,
        "sentiment_summary": {
            "positive": positive,
            "negative": negative,
            "neutral": neutral,
            "positive_pct": round((positive / total * 100) if total > 0 else 0, 1),
        }
    }


# ─── YOUTUBE VIDEOS LISTING ───

@app.get("/youtube/videos")
def get_youtube_videos(
    limit: int = 24,
    offset: int = 0,
    search: Optional[str] = None,
    region: Optional[str] = None,
    category: Optional[str] = None,
):
    """Returns paginated YouTube videos from the real dataset, with TF-IDF search."""
    result = youtube_ml.get_videos_page(
        limit=limit, offset=offset,
        search=search, region=region, category=category
    )
    return result


# ─── ADMIN PANEL ───

def require_admin(current_user: models.User = Depends(get_current_user)):
    if not (current_user.username == "admin" or getattr(current_user, "is_admin", False)):
        raise HTTPException(status_code=403, detail="Admin access required.")
    return current_user


@app.get("/admin/stats")
def admin_stats(
    _: models.User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    import datetime as dt
    today = dt.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    total_users = db.query(models.User).count()
    new_today = db.query(models.User).filter(models.User.created_at >= today).count()
    total_activities = db.query(models.UserActivity).count()
    total_ratings = db.query(models.Rating).count()
    total_reviews = db.query(models.MovieReview).count()
    total_comments = db.query(models.YoutubeComment).count()
    total_sessions = db.query(models.UserSession).count()
    return {
        "total_users": total_users,
        "new_users_today": new_today,
        "total_activities": total_activities,
        "total_ratings": total_ratings,
        "total_reviews": total_reviews,
        "total_youtube_comments": total_comments,
        "total_sessions": total_sessions,
    }


@app.get("/admin/users")
def admin_users(
    limit: int = 100,
    offset: int = 0,
    email: Optional[str] = None,
    name: Optional[str] = None,
    gender: Optional[str] = None,
    age: Optional[int] = None,
    sort_by: Optional[str] = None,
    _: models.User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    from sqlalchemy import func
    query = db.query(models.User)
    
    if email:
        query = query.filter(models.User.email.ilike(f"%{email}%"))
    if name:
        query = query.filter(models.User.display_name.ilike(f"%{name}%"))
    if gender:
        query = query.filter(models.User.gender.ilike(gender))
    if age is not None:
        query = query.filter(models.User.age == age)
        
    total = query.count()
    
    if sort_by == 'most_clicked':
        query = query.outerjoin(models.UserActivity).group_by(models.User.id).order_by(func.count(models.UserActivity.id).desc())
    elif sort_by == 'most_favorite':
        query = query.outerjoin(models.Favorite).group_by(models.User.id).order_by(func.count(models.Favorite.id).desc())
    elif sort_by == 'most_watchlist':
        query = query.outerjoin(models.Watchlist).group_by(models.User.id).order_by(func.count(models.Watchlist.id).desc())
    else:
        query = query.order_by(models.User.id.desc())

    users = query.offset(offset).limit(limit).all()
    result = []
    for u in users:
        # Compute session stats
        sessions = db.query(models.UserSession).filter(models.UserSession.user_id == u.id).all()
        last_login = None
        total_session_mins = 0
        if sessions:
            login_times = [s.login_at for s in sessions if s.login_at]
            if login_times:
                last_login = max(login_times).isoformat()
            for s in sessions:
                if s.last_active and s.login_at:
                    delta = (s.last_active - s.login_at).total_seconds() / 60
                    total_session_mins += max(0, delta)
        # Activity counts
        activity_count = db.query(models.UserActivity).filter(models.UserActivity.user_id == u.id).count()
        rating_count = db.query(models.Rating).filter(models.Rating.user_id == u.id).count()
        fav_count = db.query(models.Favorite).filter(models.Favorite.user_id == u.id).count()
        wl_count = db.query(models.Watchlist).filter(models.Watchlist.user_id == u.id).count()
        comment_count = db.query(models.YoutubeComment).filter(models.YoutubeComment.user_id == u.id).count()
        result.append({
            "id": u.id,
            "username": u.username,
            "display_name": u.display_name,
            "email": u.email,
            "gender": getattr(u, "gender", None),
            "age": getattr(u, "age", None),
            "favorite_genres": getattr(u, "favorite_genres", None),
            "is_admin": getattr(u, "is_admin", False),
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "last_login": last_login,
            "total_session_mins": round(total_session_mins, 1),
            "session_count": len(sessions),
            "activity_count": activity_count,
            "rating_count": rating_count,
            "favorites_count": fav_count,
            "watchlist_count": wl_count,
            "comment_count": comment_count,
        })
    return {"users": result, "total": total}


@app.get("/admin/activities")
def admin_activities(
    limit: int = 200,
    offset: int = 0,
    activity_type: Optional[str] = None,
    email: Optional[str] = None,
    name: Optional[str] = None,
    _: models.User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    query = db.query(models.UserActivity).join(models.User, models.UserActivity.user_id == models.User.id)
    if activity_type:
        query = query.filter(models.UserActivity.activity_type == activity_type)
    if email:
        query = query.filter(models.User.email.ilike(f"%{email}%"))
    if name:
        query = query.filter(models.User.display_name.ilike(f"%{name}%"))
        
    total = query.count()
    activities = query.order_by(models.UserActivity.timestamp.desc()).offset(offset).limit(limit).all()
    result = []
    for a in activities:
        user_name = "Anonymous"
        if a.owner:
            user_name = a.owner.display_name or a.owner.username or "Anonymous"
        result.append({
            "id": a.id,
            "user_id": a.user_id,
            "username": user_name,
            "activity_type": a.activity_type,
            "page_url": a.page_url,
            "movie_title": a.movie_title,
            "duration_seconds": a.duration_seconds,
            "timestamp": a.timestamp.isoformat() if a.timestamp else None,
        })
    return {"activities": result, "total": total}


@app.get("/admin/comments")
def admin_comments(
    limit: int = 200,
    offset: int = 0,
    sentiment: Optional[str] = None,
    _: models.User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    query = db.query(models.YoutubeComment)
    if sentiment:
        query = query.filter(models.YoutubeComment.sentiment_label == sentiment)
    total = query.count()
    comments = query.order_by(models.YoutubeComment.timestamp.desc()).offset(offset).limit(limit).all()
    result = []
    for c in comments:
        author = "Anonymous"
        if c.owner:
            author = c.owner.display_name or c.owner.username or "Anonymous"
        result.append({
            "id": c.id,
            "video_title": c.video_title,
            "text": c.text,
            "sentiment_label": c.sentiment_label,
            "sentiment_score": c.sentiment_score,
            "author": author,
            "user_id": c.user_id,
            "timestamp": c.timestamp.isoformat() if c.timestamp else None,
        })
    return {"comments": result, "total": total}


@app.get("/admin/movies")
def admin_movies(
    sort_by: str = "most_clicked",
    movie_type: Optional[str] = None,
    limit: int = 100,
    _: models.User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    from collections import Counter
    # tmdb_full_data, bolly_df_full, anime_df_full are already defined globally in api.py
    
    allowed_titles = None
    if movie_type == 'hollywood' and tmdb_full_data is not None:
        allowed_titles = set(tmdb_full_data['title'].dropna().tolist())
    elif movie_type == 'bollywood' and bolly_df_full is not None:
        allowed_titles = set(bolly_df_full['title_x'].dropna().tolist())
    elif movie_type == 'anime' and anime_df_full is not None:
        allowed_titles = set(anime_df_full['Name'].dropna().tolist())
        
    activities = db.query(models.UserActivity.movie_title).filter(models.UserActivity.activity_type == 'movie_click').filter(models.UserActivity.movie_title.isnot(None)).all()
    clicks_counter = Counter([a[0] for a in activities])
    
    favorites = db.query(models.Favorite.movie_title).filter(models.Favorite.movie_title.isnot(None)).all()
    fav_counter = Counter([f[0] for f in favorites])
    
    watchlists = db.query(models.Watchlist.movie_title).filter(models.Watchlist.movie_title.isnot(None)).all()
    wl_counter = Counter([w[0] for w in watchlists])
    
    all_titles = set(clicks_counter.keys()).union(fav_counter.keys()).union(wl_counter.keys())
    
    if allowed_titles is not None:
        all_titles = all_titles.intersection(allowed_titles)
        
    results = []
    for t in all_titles:
        results.append({
            "title": t,
            "clicks": clicks_counter.get(t, 0),
            "favorites": fav_counter.get(t, 0),
            "watchlist": wl_counter.get(t, 0)
        })
        
    if sort_by == 'most_clicked':
        results.sort(key=lambda x: x["clicks"], reverse=True)
    elif sort_by == 'most_favorite':
        results.sort(key=lambda x: x["favorites"], reverse=True)
    elif sort_by == 'most_watchlist':
        results.sort(key=lambda x: x["watchlist"], reverse=True)
        
    return {"movies": results[:limit]}


@app.get("/admin/youtube")
def admin_youtube_stats(
    sort_by: str = "most_clicked",
    limit: int = 100,
    _: models.User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    from collections import Counter
    
    activities = db.query(models.UserActivity.movie_title).filter(models.UserActivity.activity_type == 'youtube_video').filter(models.UserActivity.movie_title.isnot(None)).all()
    clicks_counter = Counter([a[0] for a in activities])
    
    comments = db.query(models.YoutubeComment.video_title).filter(models.YoutubeComment.video_title.isnot(None)).all()
    comments_counter = Counter([c[0] for c in comments])
    
    all_titles = set(clicks_counter.keys()).union(comments_counter.keys())
    
    results = []
    for t in all_titles:
        results.append({
            "title": t,
            "clicks": clicks_counter.get(t, 0),
            "comments": comments_counter.get(t, 0)
        })
        
    if sort_by == 'most_clicked':
        results.sort(key=lambda x: x["clicks"], reverse=True)
    elif sort_by == 'most_commented':
        results.sort(key=lambda x: x["comments"], reverse=True)
        
    return {"youtube_videos": results[:limit]}


# ─── Movie Reviews (with auto-sentiment) ────────────────────────────────────────

class ReviewCreate(BaseModel):
    review_text: str

@app.post("/movies/{title}/reviews")
def post_movie_review(
    title: str,
    body: ReviewCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit a review for a movie. Auto-runs sentiment analysis."""
    from ml.youtube_ml import classify_comment_sentiment
    sentiment = classify_comment_sentiment(body.review_text)

    review = models.MovieReview(
        movie_title=title,
        user_id=current_user.id,
        review_text=body.review_text,
        sentiment_label=sentiment["label"],
        sentiment_confidence=sentiment["confidence"],
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return {
        "id": review.id,
        "review_text": review.review_text,
        "sentiment_label": review.sentiment_label,
        "sentiment_confidence": review.sentiment_confidence,
        "username": current_user.username,
        "created_at": review.timestamp.isoformat() if review.timestamp else None,
    }


@app.get("/movies/{title}/reviews")
def get_movie_reviews(
    title: str,
    db: Session = Depends(get_db),
):
    """Get all reviews for a movie, newest first."""
    reviews = (
        db.query(models.MovieReview, models.User.username)
        .join(models.User, models.User.id == models.MovieReview.user_id, isouter=True)
        .filter(models.MovieReview.movie_title == title)
        .order_by(models.MovieReview.timestamp.desc())
        .limit(100)
        .all()
    )
    return {
        "reviews": [
            {
                "id": r.MovieReview.id,
                "username": r.username or "Anonymous",
                "review_text": r.MovieReview.review_text,
                "sentiment_label": r.MovieReview.sentiment_label,
                "sentiment_confidence": r.MovieReview.sentiment_confidence or 0.0,
                "created_at": r.MovieReview.timestamp.isoformat() if r.MovieReview.timestamp else None,
            }
            for r in reviews
        ]
    }


# ─── YouTube API ─────────────────────────────────────────────────────────────────

@app.get("/youtube/videos")
def get_youtube_videos(
    limit: int = 24,
    offset: int = 0,
    search: Optional[str] = None,
    region: Optional[str] = None,
    category: Optional[str] = None,
):
    """Paginated YouTube video listing with optional filters."""
    from ml.youtube_ml import get_videos_page
    return get_videos_page(limit=limit, offset=offset, search=search, region=region, category=category)


@app.get("/youtube/search")
def search_youtube(q: str = "", limit: int = 10, region: Optional[str] = None):
    """TF-IDF based YouTube video search with NLP."""
    from ml.youtube_ml import search_videos
    videos = search_videos(q, top_k=limit, region=region)
    return {"videos": videos, "query": q}


@app.get("/youtube/trending")
def get_trending(region: Optional[str] = None, limit: int = 24):
    """Return top trending videos by views for a given region."""
    from ml.youtube_ml import get_videos_page
    return get_videos_page(limit=limit, offset=0, region=region)


@app.get("/youtube/video/{video_id}")
def get_youtube_video(video_id: str, db: Session = Depends(get_db)):
    """Get single video detail by video_id."""
    from ml.youtube_ml import _load_videos, _row_to_video
    df = _load_videos()
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail="Video not found")
    mask = df["video_id"] == video_id
    if not mask.any():
        # Fallback: first partial match
        mask = df["video_id"].str.contains(video_id[:6], na=False)
    if not mask.any():
        raise HTTPException(status_code=404, detail="Video not found")
    row = df[mask].iloc[0]
    video = _row_to_video(row)
    return {"video": video}


@app.get("/youtube/video/{video_id}/recommend")
def recommend_youtube(video_id: str, n: int = 10):
    """Recommend similar YouTube videos using TF-IDF cosine similarity."""
    from ml.youtube_ml import _load_videos, recommend_videos
    df = _load_videos()
    if df is None or df.empty:
        return {"recommendations": []}
    mask = df["video_id"] == video_id
    title = df[mask]["title"].iloc[0] if mask.any() else video_id
    recs = recommend_videos(title, num_recommendations=n)
    return {"recommendations": recs}


@app.get("/youtube/video/{video_id}/comments")
def get_video_comments(video_id: str, db: Session = Depends(get_db)):
    """Get public comments for a YouTube video."""
    comments = (
        db.query(models.YoutubeComment, models.User.username)
        .join(models.User, models.User.id == models.YoutubeComment.user_id, isouter=True)
        .filter(models.YoutubeComment.video_id == video_id)
        .order_by(models.YoutubeComment.timestamp.desc())
        .limit(200)
        .all()
    )
    return {
        "comments": [
            {
                "id": c.YoutubeComment.id,
                "username": c.username or "Anonymous",
                "comment_text": c.YoutubeComment.text,
                "sentiment_label": c.YoutubeComment.sentiment_label or "neutral",
                "sentiment_confidence": c.YoutubeComment.sentiment_score or 0.0,
                "created_at": c.YoutubeComment.timestamp.isoformat() if c.YoutubeComment.timestamp else None,
            }
            for c in comments
        ]
    }


class YTCommentCreate(BaseModel):
    comment_text: str


@app.post("/youtube/video/{video_id}/comments")
def post_video_comment(
    video_id: str,
    body: YTCommentCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Post a public comment on a YouTube video — auto-sentiment analysed."""
    from ml.youtube_ml import classify_comment_sentiment, _load_videos
    sentiment = classify_comment_sentiment(body.comment_text)

    # Resolve video title
    df = _load_videos()
    title = video_id
    if df is not None and not df.empty:
        mask = df["video_id"] == video_id
        if mask.any():
            title = str(df[mask]["title"].iloc[0])

    comment = models.YoutubeComment(
        video_id=video_id,
        video_title=title,
        text=body.comment_text,
        sentiment_label=sentiment["label"],
        sentiment_score=sentiment["confidence"],
        user_id=current_user.id,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return {
        "id": comment.id,
        "username": current_user.username,
        "comment_text": comment.text,
        "sentiment_label": comment.sentiment_label,
        "sentiment_confidence": comment.sentiment_score,
        "created_at": comment.timestamp.isoformat() if comment.timestamp else None,
    }


@app.get("/youtube/video/{video_id}/analysis")
def analyze_youtube_video(video_id: str, db: Session = Depends(get_db)):
    """Fake engagement detection + comment sentiment summary for a video."""
    from ml.youtube_ml import _load_videos, detect_fake_engagement, analyze_comments

    # Get video stats
    df = _load_videos()
    views, likes, comment_count = 0, 0, 0
    if df is not None and not df.empty:
        mask = df["video_id"] == video_id
        if mask.any():
            row = df[mask].iloc[0]
            views = int(row.get("views", 0) or 0)
            likes = int(row.get("likes", 0) or 0)
            comment_count = int(row.get("comment_count", 0) or 0)

    # Fake engagement detection
    fake = detect_fake_engagement(views, likes, comment_count)

    # Comment sentiment from stored DB comments
    stored = db.query(models.YoutubeComment).filter(models.YoutubeComment.video_id == video_id).all()
    comment_dicts = [{"text": c.text} for c in stored]
    sentiment_summary = analyze_comments(comment_dicts)

    return {
        "is_suspicious": fake["is_suspicious"],
        "flags": fake["flags"],
        "confidence": fake["confidence"],
        "sentiment_summary": sentiment_summary,
    }




if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
