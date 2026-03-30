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
from dotenv import load_dotenv

from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi import Depends

load_dotenv()

from database import get_db
import models
import auth

# Import ML modules
import ml.sentiment as sentiment_analysis
import ml.fake_engagement as fake_engagement
import ml.predict_popularity as popularity_model
import ml.poster_classifier as poster_classifier
import ml.youtube_ml as youtube_ml
import ml.dl_recommender as dl_recommender
import ml.hf_sync as hf_sync
import ml.context_recommender as context_recommender

# ─── Environment Variables ──────────────────────────────────────────────────────
TMDB_API_KEY = os.getenv("TMDB_API_KEY", "8265bd1679663a7ea12ac168da84d2e8")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
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

allowed_origins = [
    FRONTEND_URL,
    "http://localhost:3000",
    "http://localhost:3001",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load artifacts — download from Hugging Face if not present locally
from hf_utils import get_artifact_file

try:
    pkl_path = get_artifact_file('movie_dict.pkl')
    idx_path = get_artifact_file('movies.index')

    movies_dict = pickle.load(open(pkl_path, 'rb'))
    movies = pd.DataFrame(movies_dict)
    if 'title' in movies.columns:
        movies['title_lower'] = movies['title'].astype(str).str.lower()
        movies['title_acronym'] = movies['title_lower'].apply(lambda x: ''.join([w[0] for w in str(x).split() if w]))
    index = faiss.read_index(idx_path)
    print("✅ Artifacts loaded successfully.")
except Exception as e:
    print(f"❌ Failed to load artifacts: {e}")
    movies = pd.DataFrame()
    index = None

# Optional loading of full CSV data for /movie-details
from hf_utils import get_dataset_file
try:
    movies_csv_path = get_dataset_file('tmdb_5000_movies.csv')
    credits_csv_path = get_dataset_file('tmdb_5000_credits.csv')
    movies_csv = pd.read_csv(movies_csv_path)
    credits_csv = pd.read_csv(credits_csv_path)
    tmdb_full_data = movies_csv.merge(credits_csv, left_on='id', right_on='movie_id', suffixes=('', '_credits'))
except Exception as e:
    print(f"Warning: Could not load TMDB CSV data: {e}")
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
        url = "https://api.themoviedb.org/3/movie/{}?api_key={}&language=en-US".format(movie_id, TMDB_API_KEY)
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
    favorite_genres: Optional[str] = None
    disliked_genres: Optional[str] = None
    movie_sources: Optional[str] = None
    location_lat: Optional[float] = None
    location_lon: Optional[float] = None
    onboarding_completed: bool = True

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
    activity_type: str
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


# ─── Auth Helpers (MongoDB) ───

def get_current_user(token: str = Depends(oauth2_scheme), db=Depends(get_db)):
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
    user = db["users"].find_one({"username": username})
    if user is None:
        raise credentials_exception
    
    if not user.get("is_verified", False):
        raise HTTPException(
            status_code=403,
            detail="Account not verified. Please verify your email first.",
        )
    return user

def get_current_user_optional(token: Optional[str] = Depends(oauth2_scheme_optional), db=Depends(get_db)):
    """Returns user if authenticated, None otherwise."""
    if token is None:
        return None
    try:
        payload = auth.jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        user = db["users"].find_one({"username": username})
        return user
    except:
        return None


# ═══════════════════════════════════════════════════
# ─── ROUTES ───
# ═══════════════════════════════════════════════════

@app.get("/")
def read_root():
    return {"message": "Welcome to the Movie Recommender API! Use /recommend?title=MovieTitle to get recommendations."}

@app.head("/")
def read_root_head():
    """Explicitly handle HEAD requests to / to avoid 405 Method Not Allowed."""
    from fastapi.responses import Response
    return Response(status_code=200)

@app.get("/favicon.ico", include_in_schema=False)
@app.get("/apple-touch-icon.png", include_in_schema=False)
@app.get("/apple-touch-icon-precomposed.png", include_in_schema=False)
def get_favicon():
    """Return an empty response for common icon requests to avoid 404 errors in logs."""
    from fastapi.responses import Response
    return Response(status_code=204)



import re
import random
import datetime
from mailer import send_otp_email

# ─── AUTH ENDPOINTS ───

class VerifyOTPRequest(BaseModel):
    username: str
    otp_code: str

class GoogleAuthRequest(BaseModel):
    token: str

@app.post("/register")
def register(user: UserCreate, db=Depends(get_db)):
    if not re.match(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$', user.password):
        raise HTTPException(status_code=400, detail="Password must contain an uppercase letter, lowercase letter, a digit, a special character, and be at least 8 characters long.")

    db_user = db["users"].find_one({"username": user.username})
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    if user.email:
        db_email = db["users"].find_one({"email": user.email})
        if db_email:
            raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.new_user_doc(
        username=user.username,
        hashed_password=hashed_password,
        email=user.email,
        display_name=user.display_name or user.username,
    )
    
    otp_code = str(random.randint(100000, 999999))
    new_user["otp_code"] = otp_code
    new_user["otp_expires_at"] = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
    
    result = db["users"].insert_one(new_user)
    new_user["_id"] = result.inserted_id
    
    if user.email:
        send_otp_email(user.email, otp_code)
        return {
            "message": "User registered successfully. Please verify your email.",
            "user": models.user_to_dict(new_user),
            "requires_verification": True
        }
    
    access_token = auth.create_access_token(data={"sub": new_user["username"], "user_id": str(new_user["_id"])})
    
    return {
        "message": "User registered successfully",
        "user": models.user_to_dict(new_user),
        "access_token": access_token,
        "token_type": "bearer",
        "requires_verification": False
    }


@app.post("/token")
def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db=Depends(get_db)
):
    query = {"email": form_data.username} if "@" in form_data.username else {"username": form_data.username}
    user = db["users"].find_one(query)
    if not user or not auth.verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    if not user.get("is_verified", False):
        raise HTTPException(
            status_code=403, 
            detail="Account not verified. Please check your email for the verification code."
        )
    
    access_token_expires = auth.timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user["username"], "user_id": str(user["_id"])},
        expires_delta=access_token_expires
    )
    
    try:
        ip_address = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent", None)
        auth.create_session_record(db, user["_id"], access_token, ip_address, user_agent)
    except Exception as e:
        print(f"Warning: Could not create session record: {e}")
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": models.user_to_dict(user)
    }

@app.post("/verify-otp")
def verify_otp(req: VerifyOTPRequest, db=Depends(get_db)):
    query = {"email": req.username} if "@" in req.username else {"username": req.username}
    user = db["users"].find_one(query)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("is_verified"):
        return {"message": "Account already verified"}
        
    if user.get("otp_code") != req.otp_code:
        raise HTTPException(status_code=400, detail="Invalid OTP")
        
    if user.get("otp_expires_at") and user.get("otp_expires_at") < datetime.datetime.utcnow():
        raise HTTPException(status_code=400, detail="OTP has expired")
        
    db["users"].update_one({"_id": user["_id"]}, {"$set": {"is_verified": True, "otp_code": None}})
    
    access_token = auth.create_access_token(data={"sub": user["username"], "user_id": str(user["_id"])})
    
    return {
        "message": "Email verified successfully",
        "access_token": access_token,
        "token_type": "bearer",
        "user": models.user_to_dict(user)
    }

@app.post("/auth/google")
def google_auth(req: GoogleAuthRequest, db=Depends(get_db)):
    try:
        import requests
        resp = requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {req.token}"}
        )
        if not resp.ok:
            raise ValueError("Invalid Google access token")
        idinfo = resp.json()
        email = idinfo.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Google token did not contain an email")
            
        user = db["users"].find_one({"email": email})
        if not user:
            # Register new Google user
            base_username = email.split("@")[0]
            username = base_username
            counter = 1
            while db["users"].find_one({"username": username}):
                username = f"{base_username}{counter}"
                counter += 1
                
            new_user = models.new_user_doc(
                username=username,
                hashed_password="oauth_managed",
                email=email,
                display_name=idinfo.get("name") or username,
            )
            new_user["is_verified"] = True
            new_user["auth_provider"] = "google"
            new_user["avatar_url"] = idinfo.get("picture")
            
            result = db["users"].insert_one(new_user)
            new_user["_id"] = result.inserted_id
            user = new_user
            
        # Issue JWT
        access_token_expires = auth.timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = auth.create_access_token(
            data={"sub": user["username"], "user_id": str(user["_id"])},
            expires_delta=access_token_expires
        )
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": models.user_to_dict(user)
        }
        
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google token")


@app.get("/me")
def get_current_user_profile(current_user=Depends(get_current_user)):
    return {"user": models.user_to_dict(current_user)}


@app.put("/me")
def update_user_profile(
    update: UserUpdate,
    current_user=Depends(get_current_user),
    db=Depends(get_db)
):
    update_fields = {}
    if update.email is not None:
        update_fields["email"] = update.email
    if update.display_name is not None:
        update_fields["display_name"] = update.display_name
    if update.avatar_url is not None:
        update_fields["avatar_url"] = update.avatar_url
    
    if update_fields:
        db["users"].update_one({"_id": current_user["_id"]}, {"$set": update_fields})
    
    updated_user = db["users"].find_one({"_id": current_user["_id"]})
    return {"user": models.user_to_dict(updated_user), "message": "Profile updated successfully"}


def _save_preferences(prefs: PreferencesUpdate, current_user: dict, db):
    def to_csv(v):
        if v is None:
            return None
        if isinstance(v, list):
            return ','.join(str(x) for x in v)
        return str(v)

    update_fields = {}
    if prefs.display_name is not None:
        update_fields["display_name"] = prefs.display_name
    if prefs.age is not None:
        update_fields["age"] = prefs.age
    if prefs.gender is not None:
        update_fields["gender"] = prefs.gender
    if prefs.favorite_genres is not None:
        update_fields["favorite_genres"] = to_csv(prefs.favorite_genres)
    if prefs.disliked_genres is not None:
        update_fields["disliked_genres"] = to_csv(prefs.disliked_genres)
    if prefs.movie_sources is not None:
        update_fields["movie_sources"] = to_csv(prefs.movie_sources)
    if prefs.location_lat is not None:
        update_fields["location_lat"] = prefs.location_lat
    if prefs.location_lon is not None:
        update_fields["location_lon"] = prefs.location_lon
    
    update_fields["onboarding_completed"] = prefs.onboarding_completed
    
    db["users"].update_one({"_id": current_user["_id"]}, {"$set": update_fields})
    
    # Sync this updated profile to the Hugging Face CSV in the background
    updated_doc = db["users"].find_one({"_id": current_user["_id"]})
    if updated_doc:
        hf_sync.queue_user_sync(updated_doc)


@app.put("/me/preferences")
def update_user_preferences_put(
    prefs: PreferencesUpdate,
    current_user=Depends(get_current_user),
    db=Depends(get_db)
):
    _save_preferences(prefs, current_user, db)
    updated = db["users"].find_one({"_id": current_user["_id"]})
    return {"user": models.user_to_dict(updated), "message": "Preferences saved."}


@app.post("/me/preferences")
def update_user_preferences_post(
    prefs: PreferencesUpdate,
    current_user=Depends(get_current_user),
    db=Depends(get_db)
):
    _save_preferences(prefs, current_user, db)
    updated = db["users"].find_one({"_id": current_user["_id"]})
    return {"user": models.user_to_dict(updated), "message": "Preferences saved."}


# ─── ACTIVITY TRACKING ───

@app.post("/track-activity")
def track_activity(
    activity: ActivityTrackRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db)
):
    new_activity = models.new_activity_doc(
        user_id=current_user["_id"],
        activity_type=activity.activity_type,
        page_url=activity.page_url,
        movie_title=activity.movie_title,
        extra_data=activity.extra_data,
        duration_seconds=activity.duration_seconds,
    )
    db["user_activities"].insert_one(new_activity)
    
    if activity.activity_type == "search" and activity.extra_data:
        try:
            search_data = json.loads(activity.extra_data)
            search_record = models.new_search_doc(
                user_id=current_user["_id"],
                query=search_data.get("query", ""),
                results_count=search_data.get("results_count", 0),
            )
            db["search_history"].insert_one(search_record)
        except (json.JSONDecodeError, AttributeError):
            pass
    
    return {"message": "Activity tracked"}


@app.post("/track-search")
def track_search(
    search: SearchTrackRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db)
):
    record = models.new_search_doc(
        user_id=current_user["_id"],
        query=search.query,
        results_count=search.results_count,
    )
    db["search_history"].insert_one(record)
    return {"message": "Search tracked"}


@app.get("/user-history")
def get_user_history(
    current_user=Depends(get_current_user),
    db=Depends(get_db)
):
    searches = list(db["search_history"].find(
        {"user_id": current_user["_id"]}
    ).sort("timestamp", -1).limit(50))
    
    activities = list(db["user_activities"].find(
        {"user_id": current_user["_id"]}
    ).sort("timestamp", -1).limit(50))
    
    sessions = list(db["user_sessions"].find(
        {"user_id": current_user["_id"]}
    ).sort("login_at", -1).limit(10))
    
    return {
        "searches": [
            {"id": str(s["_id"]), "query": s.get("query"), "results_count": s.get("results_count"),
             "timestamp": s["timestamp"].isoformat() if s.get("timestamp") else None}
            for s in searches
        ],
        "activities": [
            {"id": str(a["_id"]), "type": a.get("activity_type"), "page_url": a.get("page_url"),
             "movie_title": a.get("movie_title"), "duration_seconds": a.get("duration_seconds"),
             "timestamp": a["timestamp"].isoformat() if a.get("timestamp") else None}
            for a in activities
        ],
        "sessions": [
            {"id": str(s["_id"]), "login_at": s["login_at"].isoformat() if s.get("login_at") else None,
             "ip_address": s.get("ip_address"), "user_agent": s.get("user_agent"), "is_active": s.get("is_active")}
            for s in sessions
        ],
    }


# ─── PREFERENCE PREDICTION ───

@app.get("/predict-preferences")
def predict_user_preferences(
    current_user=Depends(get_current_user),
    db=Depends(get_db)
):
    ratings = list(db["ratings"].find({"user_id": current_user["_id"]}))
    ratings_list = [{"movie_title": r.get("movie_title"), "rating": r.get("rating")} for r in ratings]
    
    searches = list(db["search_history"].find({"user_id": current_user["_id"]}))
    search_queries = [s.get("query") for s in searches]
    
    # Generate context-aware recommendations utilizing time of day and collaborative context
    user_id_str = str(current_user["_id"])
    result = context_recommender.get_context_recommendations(user_id_str, ratings_list, search_queries, movies)
    return result


# ─── SENTIMENT PREDICTION (TF + PyTorch) ───

@app.post("/sentiment-predict")
def predict_sentiment(request: SentimentPredictRequest):
    import subprocess
    
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    results = {"input_text": text, "models": {}}
    
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
            results["models"]["tensorflow"] = {
                "error": "TensorFlow aborted natively (common on macOS arm64). Using fallback."
            }
        else:
            try:
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
    
    try:
        from ml.sentiment_torch import predict_sentiment_torch
        torch_result = predict_sentiment_torch(text)
        results["models"]["pytorch"] = torch_result
    except Exception as e:
        results["models"]["pytorch"] = {"error": str(e)}
    
    tf_label = results["models"].get("tensorflow", {}).get("label", "unknown")
    pt_label = results["models"].get("pytorch", {}).get("label", "unknown")
    
    if tf_label == pt_label and tf_label != "unknown":
        results["consensus"] = tf_label
        results["agreement"] = True
    else:
        results["consensus"] = tf_label if tf_label != "unknown" else pt_label
        results["agreement"] = False
    
    return results


# ─── RATING ───

@app.post("/rate")
def rate_movie(rating: RatingCreate, current_user=Depends(get_current_user), db=Depends(get_db)):
    if fake_engagement.is_user_fake(str(current_user["_id"])):
        raise HTTPException(status_code=403, detail="Your account has been flagged for anomalous rating behavior.")
        
    db_rating = db["ratings"].find_one({
        "user_id": current_user["_id"],
        "movie_id": rating.movie_id
    })

    if db_rating:
        db["ratings"].update_one(
            {"_id": db_rating["_id"]},
            {"$set": {"rating": rating.rating}}
        )
        return {"message": "Rating updated"}
    else:
        new_rating = models.new_rating_doc(
            user_id=current_user["_id"],
            movie_id=rating.movie_id,
            movie_title=rating.movie_title,
            rating=rating.rating,
        )
        db["ratings"].insert_one(new_rating)
        return {"message": "Rating added"}

@app.get("/user-ratings")
def get_user_ratings(current_user=Depends(get_current_user), db=Depends(get_db)):
    ratings = list(db["ratings"].find({"user_id": current_user["_id"]}))
    return {"ratings": [models.serialize_doc(r) for r in ratings]}

@app.post("/admin/train-engagement")
def train_engagement_model(db=Depends(get_db)):
    ratings = list(db["ratings"].find())
    if not ratings:
        return {"message": "Not enough ratings in database to train engagement model."}
        
    df = pd.DataFrame([{"user_id": str(r["user_id"]), "rating": r["rating"]} for r in ratings])
    success = fake_engagement.train_fake_engagement_model(df)
    if success:
        return {"message": "Engagement model successfully trained on current ratings data."}
    else:
        return {"message": "Failed to train engagement model."}


# ─── MOVIES (no DB changes needed, these use DataFrame) ───

@app.get("/movies")
def get_movies(
    limit: int = 24,
    offset: int = 0,
    search: Optional[str] = None,
    genre: Optional[str] = None,
    genres: Optional[str] = None,
    sources: Optional[str] = None,
    min_rating: Optional[float] = None,
    max_rating: Optional[float] = None,
    start_year: Optional[int] = None,
    end_year: Optional[int] = None
):
    df = movies.copy()

    if search and search.strip():
        q = search.strip().lower()
        title_match = df['title'].str.contains(q, case=False, na=False)
        tags_match = df['tags'].str.contains(q, case=False, na=False) if 'tags' in df.columns else pd.Series([False] * len(df), index=df.index)
        acronym_match = (df['title_acronym'].str.lower() == q) if 'title_acronym' in df.columns else pd.Series([False] * len(df), index=df.index)
        match_df = df[title_match | tags_match | acronym_match].copy()
        
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

    if sources:
        source_list = [s.strip().lower() for s in sources.split(",")]
        origin_map = {"hollywood": "tmdb", "bollywood": "bollywood", "anime": "anime"}
        allowed_origins = [origin_map[s] for s in source_list if s in origin_map]
        if allowed_origins:
            df = df[df['origin'].isin(allowed_origins)]

    if genre and genre != "All":
        df = df[
            df['tags'].str.contains(genre, case=False, na=False) |
            df['genres_list'].apply(lambda g: genre in g if isinstance(g, list) else False)
        ]

    if genres:
        selected_genres = [g.strip() for g in genres.split(",")]
        df = df[df['genres_list'].apply(
            lambda gl: any(g in gl for g in selected_genres) if isinstance(gl, list) else False
        )]

    if min_rating is not None and 'vote_average' in df.columns:
        df = df[df['vote_average'] >= min_rating]
    if max_rating is not None and 'vote_average' in df.columns:
        df = df[df['vote_average'] <= max_rating]

    if start_year is not None and 'release_date' in df.columns:
        df['year_tmp'] = pd.to_datetime(df['release_date'], errors='coerce').dt.year
        df = df[df['year_tmp'] >= start_year]
    if end_year is not None and 'release_date' in df.columns:
        if 'year_tmp' not in df.columns:
            df['year_tmp'] = pd.to_datetime(df['release_date'], errors='coerce').dt.year
        df = df[df['year_tmp'] <= end_year]
    if 'year_tmp' in df.columns:
        df = df.drop(columns=['year_tmp'])

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


# ─── DL RECOMMENDATIONS ───

@app.get("/recommend/dl")
def get_dl_recommendations_endpoint(
    current_user=Depends(get_current_user_optional),
    db=Depends(get_db)
):
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
    current_user=Depends(get_current_user),
    db=Depends(get_db)
):
    age = current_user.get('age')
    gender = current_user.get('gender')
    fav_genres_str = current_user.get('favorite_genres', '') or ''
    dis_genres_str = current_user.get('disliked_genres', '') or ''
    movie_sources_str = current_user.get('movie_sources', '') or ''

    favorite_genres = [g.strip() for g in fav_genres_str.split(',') if g.strip()]
    disliked_genres = [g.strip() for g in dis_genres_str.split(',') if g.strip()]
    preferred_sources = [s.strip().lower() for s in movie_sources_str.split(',') if s.strip()]

    ratings_db = list(db["ratings"].find({"user_id": current_user["_id"]}))
    ratings = [{"movie_title": r.get("movie_title"), "rating": r.get("rating")} for r in ratings_db]

    searches_db = list(db["search_history"].find(
        {"user_id": current_user["_id"]}
    ).sort("timestamp", -1).limit(100))
    searches = [s.get("query") for s in searches_db]

    clicks_db = list(db["user_activities"].find(
        {"user_id": current_user["_id"], "activity_type": "movie_click"}
    ).sort("timestamp", -1).limit(200))
    clicked_movies = [c.get("movie_title") for c in clicks_db if c.get("movie_title")]

    fav_db = list(db["favorites"].find({"user_id": current_user["_id"]}))
    favorites = [f.get("movie_title") for f in fav_db if f.get("movie_title")]
    
    watchlist_db = list(db["watchlist"].find({"user_id": current_user["_id"]}))
    watchlist_items = [w.get("movie_title") for w in watchlist_db if w.get("movie_title")]

    dl_genre_scores = dl_recommender.get_dl_recommendations_full(
        age=age, gender=gender, favorite_genres=favorite_genres,
        disliked_genres=disliked_genres, ratings=ratings, searches=searches,
        clicked_movies=clicked_movies, favorites=favorites, watchlist=watchlist_items,
        movies_df=movies, top_k=8,
    )
    top_genres = [g["genre"] for g in dl_genre_scores]

    df = movies.copy()

    if preferred_sources:
        origin_map = {"hollywood": "tmdb", "bollywood": "bollywood", "anime": "anime"}
        allowed_origins_list = [origin_map[s] for s in preferred_sources if s in origin_map]
        if allowed_origins_list:
            df = df[df['origin'].isin(allowed_origins_list)]

    if disliked_genres:
        def not_disliked(genres_list):
            if not isinstance(genres_list, list): return True
            return not any(g in disliked_genres for g in genres_list)
        df = df[df['genres_list'].apply(not_disliked)]

    rated_titles_lower = {r['movie_title'].lower() for r in ratings}
    if 'title_lower' in df.columns:
        df = df[~df['title_lower'].isin(rated_titles_lower)]
    else:
        df = df[~df['title'].str.lower().isin(rated_titles_lower)]

    genre_score_map = {g['genre']: g['score'] for g in dl_genre_scores}
    df = df.copy()
    vote_averages = df['vote_average'].fillna(5.0).values
    genres_lists = df['genres_list'].values
    dl_boosts = np.array([
        sum(genre_score_map.get(g, 0.0) for g in gl) if isinstance(gl, list) else 0.0
        for gl in genres_lists
    ])
    base_scores = vote_averages / 10.0
    df['_score'] = base_scores * 0.4 + dl_boosts * 0.6
    df = df.sort_values('_score', ascending=False)

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
            "age": age, "gender": gender,
            "favorite_genres": favorite_genres, "disliked_genres": disliked_genres,
            "ratings_count": len(ratings), "searches_count": len(searches),
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
        if pd.isna(val): return []
        try: return json.loads(val)
        except (json.JSONDecodeError, TypeError):
            try:
                import ast
                val_ast = ast.literal_eval(val)
                if isinstance(val_ast, list): return val_ast
            except: pass
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
            int(row['id']) if pd.notna(row.get('id')) else None
            poster = fetch_poster(row_main)
            release_date = str(row['release_date']) if pd.notna(row.get('release_date')) else None
            year = int(release_date[:4]) if release_date and len(release_date) >= 4 else None
            return {
                "title": str(row['title']), "overview": str(row['overview']) if pd.notna(row.get('overview')) else None,
                "tagline": str(row['tagline']) if pd.notna(row.get('tagline')) else None,
                "poster": poster, "poster_url": poster, "year": year, "release_date": release_date,
                "rating": float(row['vote_average']) if pd.notna(row.get('vote_average')) else None,
                "vote_average": float(row['vote_average']) if pd.notna(row.get('vote_average')) else None,
                "vote_count": int(row['vote_count']) if pd.notna(row.get('vote_count')) else None,
                "runtime": int(row['runtime']) if pd.notna(row.get('runtime')) else None,
                "budget": int(row['budget']) if pd.notna(row.get('budget')) else None,
                "revenue": int(row['revenue']) if pd.notna(row.get('revenue')) else None,
                "popularity": float(row['popularity']) if pd.notna(row.get('popularity')) else None,
                "status": str(row['status']) if pd.notna(row.get('status')) else None,
                "original_language": str(row['original_language']) if pd.notna(row.get('original_language')) else None,
                "genres": genres, "cast": cast, "director": director,
                "production_countries": countries, "spoken_languages": languages,
                "production_companies": companies, "keywords": keywords[:10],
            }

    if origin == 'anime' and anime_df_full is not None:
        anime_match = anime_df_full[anime_df_full['Name'] == row_main['title']]
        if not anime_match.empty:
            row = anime_match.iloc[0]
            anime_poster = fetch_poster(row_main)
            anime_rating = float(row['Score']) if pd.notna(row.get('Score')) and str(row['Score']) != 'UNKNOWN' else None
            return {
                "title": str(row['Name']), "overview": str(row['Synopsis']) if pd.notna(row.get('Synopsis')) else None,
                "tagline": None, "poster": anime_poster, "poster_url": anime_poster,
                "year": int(row_main['year']) if pd.notna(row_main['year']) else None,
                "release_date": str(row['Aired']) if pd.notna(row.get('Aired')) else None,
                "rating": anime_rating, "vote_average": anime_rating,
                "vote_count": int(float(row['Scored By'])) if pd.notna(row.get('Scored By')) and str(row['Scored By']) != 'UNKNOWN' else None,
                "runtime": None, "budget": None, "revenue": None, "popularity": None,
                "status": str(row['Status']) if pd.notna(row.get('Status')) else None,
                "original_language": "Japanese",
                "genres": [g.strip() for g in str(row.get('Genres', '')).split(',')] if pd.notna(row.get('Genres')) and str(row.get('Genres')) != 'UNKNOWN' else [],
                "cast": [], "director": None, "production_countries": ["Japan"],
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
                "title": str(row['title_x']), "overview": str(row['story']) if pd.notna(row.get('story')) else None,
                "tagline": str(row['tagline']) if pd.notna(row.get('tagline')) else None,
                "poster": bolly_poster, "poster_url": bolly_poster,
                "year": int(row_main['year']) if pd.notna(row_main['year']) else None,
                "release_date": str(row['release_date']) if pd.notna(row.get('release_date')) else None,
                "rating": bolly_rating, "vote_average": bolly_rating,
                "vote_count": int(float(row['imdb_votes'])) if pd.notna(row.get('imdb_votes')) and str(row['imdb_votes']) != 'nan' else None,
                "runtime": int(row['runtime']) if pd.notna(row.get('runtime')) else None,
                "budget": None, "revenue": None, "popularity": None, "status": "Released",
                "original_language": "Hindi",
                "genres": str(row['genres']).split('|') if pd.notna(row.get('genres')) else [],
                "cast": cast[:12], "director": None, "production_countries": ["India"],
                "spoken_languages": ["Hindi"], "production_companies": [], "keywords": [],
            }

    fallback_poster = fetch_poster(row_main)
    return {
        "title": str(row_main['title']), "overview": None,
        "poster": fallback_poster, "poster_url": fallback_poster,
        "year": int(row_main['year']) if pd.notna(row_main['year']) else None,
        "rating": float(row_main['vote_average']) if pd.notna(row_main['vote_average']) else None,
        "vote_average": float(row_main['vote_average']) if pd.notna(row_main['vote_average']) else None,
        "genres": row_main['genres_list'] if isinstance(row_main['genres_list'], list) else [],
        "vote_count": None, "runtime": None,
    }


# ─── FAVORITES & WATCHLIST (MongoDB) ───

@app.post("/favorites")
def add_favorite(item: MovieItemCreate, current_user=Depends(get_current_user), db=Depends(get_db)):
    existing = db["favorites"].find_one({
        "user_id": current_user["_id"],
        "movie_title": item.movie_title
    })
    if existing:
        return {"message": "Already in favorites"}
    
    poster_url = item.poster_url
    if not poster_url:
        match = movies[movies['title'] == item.movie_title]
        if match.empty:
            match = movies[movies['title'].str.lower() == item.movie_title.lower()]
        if not match.empty:
            poster_url = fetch_poster(match.iloc[0])

    new_fav = models.new_favorite_doc(
        user_id=current_user["_id"],
        movie_title=item.movie_title,
        poster_url=poster_url,
    )
    db["favorites"].insert_one(new_fav)
    return {"message": "Added to favorites", "favorite": models.serialize_doc(new_fav)}

@app.get("/favorites")
def get_favorites(current_user=Depends(get_current_user), db=Depends(get_db)):
    favs = list(db["favorites"].find({"user_id": current_user["_id"]}).sort("timestamp", -1))
    return {"favorites": [models.serialize_doc(f) for f in favs]}

@app.delete("/favorites/{movie_title}")
def remove_favorite(movie_title: str, current_user=Depends(get_current_user), db=Depends(get_db)):
    db["favorites"].delete_one({
        "user_id": current_user["_id"],
        "movie_title": movie_title
    })
    return {"message": "Removed from favorites"}

@app.post("/watchlist")
def add_watchlist(item: MovieItemCreate, current_user=Depends(get_current_user), db=Depends(get_db)):
    existing = db["watchlist"].find_one({
        "user_id": current_user["_id"],
        "movie_title": item.movie_title
    })
    if existing:
        return {"message": "Already in watchlist"}
    
    poster_url = item.poster_url
    if not poster_url:
        match = movies[movies['title'] == item.movie_title]
        if match.empty:
            match = movies[movies['title'].str.lower() == item.movie_title.lower()]
        if not match.empty:
            poster_url = fetch_poster(match.iloc[0])

    new_watch = models.new_watchlist_doc(
        user_id=current_user["_id"],
        movie_title=item.movie_title,
        poster_url=poster_url,
    )
    db["watchlist"].insert_one(new_watch)
    return {"message": "Added to watchlist", "watchlist": models.serialize_doc(new_watch)}

@app.get("/watchlist")
def get_watchlist(current_user=Depends(get_current_user), db=Depends(get_db)):
    items = list(db["watchlist"].find({"user_id": current_user["_id"]}).sort("timestamp", -1))
    return {"watchlist": [models.serialize_doc(w) for w in items]}

@app.delete("/watchlist/{movie_title}")
def remove_watchlist(movie_title: str, current_user=Depends(get_current_user), db=Depends(get_db)):
    db["watchlist"].delete_one({
        "user_id": current_user["_id"],
        "movie_title": movie_title
    })
    return {"message": "Removed from watchlist"}


# ─── YOUTUBE & VIDEO ML ───

@app.post("/youtube/analyze")
def analyze_youtube_video_post(req: YouTubeAnalyzeRequest):
    comments_data = [{"text": c.text, "author": c.author} for c in req.comments]
    sentiment_result = youtube_ml.analyze_comments(comments_data)
    engagement_analysis = youtube_ml.detect_fake_engagement(req.views, req.likes, req.comments_count)
    return {
        "sentiment_analysis": sentiment_result,
        "fake_engagement": engagement_analysis
    }

@app.get("/youtube/recommend")
def get_youtube_recommendations(video_title: str, region: Optional[str] = None):
    recs = youtube_ml.recommend_videos(video_title, num_recommendations=12, region=region)
    return {"recommendations": recs}

@app.get("/youtube/video-data")
def get_youtube_video_data(video_title: str):
    stats = youtube_ml.get_video_stats(video_title)
    return stats or {"title": video_title, "views": 0, "likes": 0, "comment_count": 0}

@app.get("/youtube/comments")
def get_youtube_comments(video_title: str, db=Depends(get_db),
                         sentiment: Optional[str] = None,
                         limit: int = 100, offset: int = 0):
    query_filter = {"video_title": video_title}
    if sentiment and sentiment in ("positive", "negative", "neutral"):
        query_filter["sentiment_label"] = sentiment
    total = db["youtube_comments"].count_documents(query_filter)
    comments = list(db["youtube_comments"].find(query_filter).sort("timestamp", -1).skip(offset).limit(limit))
    result = []
    for c in comments:
        author = "Anonymous"
        avatar_letter = "A"
        owner = db["users"].find_one({"_id": c.get("user_id")})
        if owner:
            author = owner.get("display_name") or owner.get("username") or "Anonymous"
            avatar_letter = author[0].upper()
        result.append({
            "id": str(c["_id"]),
            "video_title": c.get("video_title"),
            "text": c.get("text"),
            "sentiment_label": c.get("sentiment_label"),
            "sentiment_score": c.get("sentiment_score"),
            "author": author,
            "avatar_letter": avatar_letter,
            "user_id": str(c.get("user_id")),
            "timestamp": c["timestamp"].isoformat() if c.get("timestamp") else None,
        })
    # Sentiment summary
    all_c = list(db["youtube_comments"].find({"video_title": video_title}))
    pos = sum(1 for c in all_c if c.get("sentiment_label") == "positive")
    neg = sum(1 for c in all_c if c.get("sentiment_label") == "negative")
    neu = sum(1 for c in all_c if c.get("sentiment_label") == "neutral")
    tot = len(all_c)
    return {
        "comments": result, "total": total,
        "sentiment_summary": {
            "total": tot, "positive": pos, "negative": neg, "neutral": neu,
            "positive_pct": round(pos / tot * 100, 1) if tot else 0,
            "negative_pct": round(neg / tot * 100, 1) if tot else 0,
            "neutral_pct": round(neu / tot * 100, 1) if tot else 0,
        }
    }

@app.post("/youtube/comments")
def post_youtube_comment(
    comment: YoutubeCommentCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_db)
):
    if not comment.text.strip():
        raise HTTPException(status_code=400, detail="Comment text cannot be empty.")
    try:
        sentiment_result = youtube_ml.classify_comment_sentiment(comment.text)
        sentiment_label = sentiment_result.get("label", "neutral")
        sentiment_score = sentiment_result.get("confidence", 0.5)
    except Exception:
        sentiment_label = "neutral"
        sentiment_score = 0.5
    new_comment = models.new_youtube_comment_doc(
        user_id=current_user["_id"],
        video_title=comment.video_title,
        video_id=comment.video_id,
        text=comment.text.strip(),
        sentiment_label=sentiment_label,
        sentiment_score=sentiment_score,
    )
    db["youtube_comments"].insert_one(new_comment)
    author = current_user.get("display_name") or current_user.get("username")
    return {
        "message": "Comment posted",
        "comment": {
            "id": str(new_comment["_id"]),
            "video_title": new_comment["video_title"],
            "text": new_comment["text"],
            "sentiment_label": new_comment["sentiment_label"],
            "sentiment_score": new_comment["sentiment_score"],
            "author": author,
            "avatar_letter": author[0].upper() if author else "A",
            "user_id": str(current_user["_id"]),
            "timestamp": new_comment["timestamp"].isoformat() if new_comment.get("timestamp") else None,
        }
    }


# ─── REVIEWS WITH SENTIMENT ───

@app.post("/reviews")
def create_review(
    review: ReviewCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_db)
):
    sentiment_label = None
    sentiment_confidence = None
    sentiment_score = None
    try:
        from ml.sentiment_torch import predict_sentiment_torch
        result = predict_sentiment_torch(review.review_text)
        sentiment_label = result.get("label", "neutral")
        sentiment_confidence = result.get("confidence", 0.0)
        sentiment_score = result.get("score", 0.0)
    except Exception as e:
        print(f"Sentiment analysis failed: {e}")

    new_review = models.new_review_doc(
        user_id=current_user["_id"],
        movie_title=review.movie_title,
        review_text=review.review_text,
        sentiment_label=sentiment_label,
        sentiment_confidence=sentiment_confidence,
        sentiment_score=sentiment_score,
    )
    db["movie_reviews"].insert_one(new_review)
    return {
        "message": "Review posted",
        "review": {
            "id": str(new_review["_id"]),
            "movie_title": new_review["movie_title"],
            "review_text": new_review["review_text"],
            "sentiment_label": new_review["sentiment_label"],
            "sentiment_confidence": new_review.get("sentiment_confidence"),
            "author": current_user.get("display_name") or current_user.get("username"),
            "timestamp": new_review["timestamp"].isoformat() if new_review.get("timestamp") else None,
        }
    }

@app.get("/reviews")
def get_movie_reviews_list(movie_title: str, db=Depends(get_db)):
    reviews = list(db["movie_reviews"].find({"movie_title": movie_title}).sort("timestamp", -1))
    result = []
    for r in reviews:
        owner = db["users"].find_one({"_id": r.get("user_id")})
        author = "Anonymous"
        if owner:
            author = owner.get("display_name") or owner.get("username") or "Anonymous"
        result.append({
            "id": str(r["_id"]),
            "movie_title": r.get("movie_title"),
            "review_text": r.get("review_text"),
            "sentiment_label": r.get("sentiment_label"),
            "sentiment_confidence": r.get("sentiment_confidence"),
            "author": author,
            "timestamp": r["timestamp"].isoformat() if r.get("timestamp") else None,
        })
    total = len(result)
    positive = sum(1 for r in result if r["sentiment_label"] == "positive")
    negative = sum(1 for r in result if r["sentiment_label"] == "negative")
    neutral = total - positive - negative
    return {
        "reviews": result, "total": total,
        "sentiment_summary": {
            "positive": positive, "negative": negative, "neutral": neutral,
            "positive_pct": round((positive / total * 100) if total > 0 else 0, 1),
        }
    }


# ─── YOUTUBE VIDEOS LISTING ───

@app.get("/youtube/videos")
def get_youtube_videos_list(
    limit: int = 24, offset: int = 0,
    search: Optional[str] = None, region: Optional[str] = None, category: Optional[str] = None,
):
    result = youtube_ml.get_videos_page(limit=limit, offset=offset, search=search, region=region, category=category)
    return result


# ─── ADMIN PANEL (MongoDB) ───

def require_admin(current_user=Depends(get_current_user)):
    if not (current_user.get("username") == "admin" or current_user.get("is_admin", False)):
        raise HTTPException(status_code=403, detail="Admin access required.")
    return current_user

@app.get("/admin/stats")
def admin_stats(_=Depends(require_admin), db=Depends(get_db)):
    import datetime as dt
    today = dt.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    total_users = db["users"].count_documents({})
    new_today = db["users"].count_documents({"created_at": {"$gte": today}})
    total_activities = db["user_activities"].count_documents({})
    total_ratings = db["ratings"].count_documents({})
    total_reviews = db["movie_reviews"].count_documents({})
    total_comments = db["youtube_comments"].count_documents({})
    total_sessions = db["user_sessions"].count_documents({})
    return {
        "total_users": total_users, "new_users_today": new_today,
        "total_activities": total_activities, "total_ratings": total_ratings,
        "total_reviews": total_reviews, "total_youtube_comments": total_comments,
        "total_sessions": total_sessions,
    }

@app.get("/admin/users")
def admin_users(
    limit: int = 100, offset: int = 0,
    email: Optional[str] = None, name: Optional[str] = None,
    gender: Optional[str] = None, age: Optional[int] = None,
    sort_by: Optional[str] = None,
    _=Depends(require_admin), db=Depends(get_db)
):
    query_filter = {}
    if email:
        query_filter["email"] = {"$regex": email, "$options": "i"}
    if name:
        query_filter["display_name"] = {"$regex": name, "$options": "i"}
    if gender:
        query_filter["gender"] = {"$regex": f"^{gender}$", "$options": "i"}
    if age is not None:
        query_filter["age"] = age
        
    pipeline = [
        {"$match": query_filter},
        {"$sort": {"_id": -1}},
        {"$skip": offset},
        {"$limit": limit},
        {
            "$lookup": {
                "from": "user_sessions",
                "localField": "_id",
                "foreignField": "user_id",
                "as": "sessions"
            }
        },
        {
            "$lookup": {
                "from": "user_activities",
                "let": {"uid": "$_id"},
                "pipeline": [{"$match": {"$expr": {"$eq": ["$user_id", "$$uid"]}}}, {"$count": "count"}],
                "as": "activities_count"
            }
        },
        {
            "$lookup": {
                "from": "ratings",
                "let": {"uid": "$_id"},
                "pipeline": [{"$match": {"$expr": {"$eq": ["$user_id", "$$uid"]}}}, {"$count": "count"}],
                "as": "ratings_count"
            }
        },
        {
            "$lookup": {
                "from": "favorites",
                "let": {"uid": "$_id"},
                "pipeline": [{"$match": {"$expr": {"$eq": ["$user_id", "$$uid"]}}}, {"$count": "count"}],
                "as": "favorites_count"
            }
        },
        {
            "$lookup": {
                "from": "watchlist",
                "let": {"uid": "$_id"},
                "pipeline": [{"$match": {"$expr": {"$eq": ["$user_id", "$$uid"]}}}, {"$count": "count"}],
                "as": "watchlist_count"
            }
        },
        {
            "$lookup": {
                "from": "youtube_comments",
                "let": {"uid": "$_id"},
                "pipeline": [{"$match": {"$expr": {"$eq": ["$user_id", "$$uid"]}}}, {"$count": "count"}],
                "as": "comments_count"
            }
        }
    ]
    
    users_cursor = db["users"].aggregate(pipeline)
    total = db["users"].count_documents(query_filter)
    
    result = []
    for u in users_cursor:
        sessions = u.get("sessions", [])
        last_login = None
        total_session_mins = 0
        if sessions:
            login_times = [s["login_at"] for s in sessions if s.get("login_at")]
            if login_times:
                last_login = max(login_times).isoformat()
            for s in sessions:
                if s.get("last_active") and s.get("login_at"):
                    delta = (s["last_active"] - s["login_at"]).total_seconds() / 60
                    total_session_mins += max(0, delta)
        
        result.append({
            "id": str(u["_id"]), 
            "username": u.get("username"),
            "display_name": u.get("display_name"), 
            "email": u.get("email"),
            "gender": u.get("gender"), 
            "age": u.get("age"),
            "favorite_genres": u.get("favorite_genres"),
            "is_admin": u.get("is_admin", False),
            "created_at": u["created_at"].isoformat() if u.get("created_at") else None,
            "last_login": last_login, 
            "total_session_mins": round(total_session_mins, 1),
            "session_count": len(sessions), 
            "activity_count": u.get("activities_count", [{}])[0].get("count", 0) if u.get("activities_count") else 0,
            "rating_count": u.get("ratings_count", [{}])[0].get("count", 0) if u.get("ratings_count") else 0,
            "favorites_count": u.get("favorites_count", [{}])[0].get("count", 0) if u.get("favorites_count") else 0,
            "watchlist_count": u.get("watchlist_count", [{}])[0].get("count", 0) if u.get("watchlist_count") else 0,
            "comment_count": u.get("comments_count", [{}])[0].get("count", 0) if u.get("comments_count") else 0,
        })
    return {"users": result, "total": total}

@app.get("/admin/activities")
def admin_activities(
    limit: int = 200, offset: int = 0,
    activity_type: Optional[str] = None,
    email: Optional[str] = None, name: Optional[str] = None,
    _=Depends(require_admin), db=Depends(get_db)
):
    match_stage = {}
    if activity_type:
        match_stage["activity_type"] = activity_type
        
    pipeline = [
        {"$match": match_stage},
        {"$sort": {"timestamp": -1}},
        {"$skip": offset},
        {"$limit": limit},
        {
            "$lookup": {
                "from": "users",
                "localField": "user_id",
                "foreignField": "_id",
                "as": "user_docs"
            }
        },
        {
            "$addFields": {
                "username": {
                    "$let": {
                        "vars": {"u": {"$arrayElemAt": ["$user_docs", 0]}},
                        "in": {"$ifNull": ["$$u.display_name", {"$ifNull": ["$$u.username", "Anonymous"]}]}
                    }
                }
            }
        }
    ]
    
    activities = list(db["user_activities"].aggregate(pipeline))
    total = db["user_activities"].count_documents(match_stage if match_stage else {})
    
    result = []
    for a in activities:
        result.append({
            "id": str(a["_id"]), "user_id": str(a.get("user_id")),
            "username": a.get("username", "Anonymous"), "activity_type": a.get("activity_type"),
            "page_url": a.get("page_url"), "movie_title": a.get("movie_title"),
            "duration_seconds": a.get("duration_seconds"),
            "timestamp": a["timestamp"].isoformat() if a.get("timestamp") else None,
        })
    return {"activities": result, "total": total}

@app.get("/admin/comments")
def admin_comments(
    limit: int = 200, offset: int = 0,
    sentiment: Optional[str] = None,
    _=Depends(require_admin), db=Depends(get_db)
):
    query_filter = {}
    if sentiment:
        query_filter["sentiment_label"] = sentiment
        
    pipeline = [
        {"$match": query_filter},
        {"$sort": {"timestamp": -1}},
        {"$skip": offset},
        {"$limit": limit},
        {
            "$lookup": {
                "from": "users",
                "localField": "user_id",
                "foreignField": "_id",
                "as": "user_docs"
            }
        },
        {
            "$addFields": {
                "author": {
                    "$let": {
                        "vars": {"u": {"$arrayElemAt": ["$user_docs", 0]}},
                        "in": {"$ifNull": ["$$u.display_name", {"$ifNull": ["$$u.username", "Anonymous"]}]}
                    }
                }
            }
        }
    ]
    
    comments = list(db["youtube_comments"].aggregate(pipeline))
    total = db["youtube_comments"].count_documents(query_filter)
    
    result = []
    for c in comments:
        result.append({
            "id": str(c["_id"]), "video_title": c.get("video_title"),
            "text": c.get("text"), "sentiment_label": c.get("sentiment_label"),
            "sentiment_score": c.get("sentiment_score"), "author": c.get("author", "Anonymous"),
            "user_id": str(c.get("user_id")),
            "timestamp": c["timestamp"].isoformat() if c.get("timestamp") else None,
        })
    return {"comments": result, "total": total}

@app.get("/admin/movies")
def admin_movies(
    sort_by: str = "most_clicked", movie_type: Optional[str] = None,
    limit: int = 100, _=Depends(require_admin), db=Depends(get_db)
):
    # Aggregation for counts directly in MongoDB
    pipeline_clicks = [
        {"$match": {"activity_type": "movie_click", "movie_title": {"$ne": None}}},
        {"$group": {"_id": "$movie_title", "clicks": {"$sum": 1}}}
    ]
    clicks_data = {item["_id"]: item["clicks"] for item in db["user_activities"].aggregate(pipeline_clicks)}
    
    pipeline_favs = [
        {"$match": {"movie_title": {"$ne": None}}},
        {"$group": {"_id": "$movie_title", "favorites": {"$sum": 1}}}
    ]
    fav_data = {item["_id"]: item["favorites"] for item in db["favorites"].aggregate(pipeline_favs)}
    
    pipeline_wl = [
        {"$match": {"movie_title": {"$ne": None}}},
        {"$group": {"_id": "$movie_title", "watchlist": {"$sum": 1}}}
    ]
    wl_data = {item["_id"]: item["watchlist"] for item in db["watchlist"].aggregate(pipeline_wl)}
    
    all_titles = set(clicks_data.keys()).union(fav_data.keys()).union(wl_data.keys())
    
    # Filter by type if needed
    allowed_titles = None
    if movie_type == 'hollywood' and tmdb_full_data is not None:
        allowed_titles = set(tmdb_full_data['title'].dropna().tolist())
    elif movie_type == 'bollywood' and bolly_df_full is not None:
        allowed_titles = set(bolly_df_full['title_x'].dropna().tolist())
    elif movie_type == 'anime' and anime_df_full is not None:
        allowed_titles = set(anime_df_full['Name'].dropna().tolist())
    
    if allowed_titles is not None:
        all_titles = all_titles.intersection(allowed_titles)
        
    results = [{"title": t, "clicks": clicks_data.get(t, 0), "favorites": fav_data.get(t, 0), "watchlist": wl_data.get(t, 0)} for t in all_titles]
    sort_key = {"most_clicked": "clicks", "most_favorite": "favorites", "most_watchlist": "watchlist"}.get(sort_by, "clicks")
    results.sort(key=lambda x: x[sort_key], reverse=True)
    return {"movies": results[:limit]}

@app.get("/admin/youtube")
def admin_youtube_stats(sort_by: str = "most_clicked", limit: int = 100, _=Depends(require_admin), db=Depends(get_db)):
    pipeline_clicks = [
        {"$match": {"activity_type": "youtube_video", "movie_title": {"$ne": None}}},
        {"$group": {"_id": "$movie_title", "clicks": {"$sum": 1}}}
    ]
    clicks_data = {item["_id"]: item["clicks"] for item in db["user_activities"].aggregate(pipeline_clicks)}
    
    pipeline_comments = [
        {"$match": {"video_title": {"$ne": None}}},
        {"$group": {"_id": "$video_title", "comments": {"$sum": 1}}}
    ]
    comments_data = {item["_id"]: item["comments"] for item in db["youtube_comments"].aggregate(pipeline_comments)}
    
    all_titles = set(clicks_data.keys()).union(comments_data.keys())
    results = [{"title": t, "clicks": clicks_data.get(t, 0), "comments": comments_data.get(t, 0)} for t in all_titles]
    sort_key = {"most_clicked": "clicks", "most_commented": "comments"}.get(sort_by, "clicks")
    results.sort(key=lambda x: x[sort_key], reverse=True)
    return {"youtube_videos": results[:limit]}


# ─── Movie Reviews (path-based) ───

class ReviewCreatePath(BaseModel):
    review_text: str

@app.post("/movies/{title}/reviews")
def post_movie_review(title: str, body: ReviewCreatePath, current_user=Depends(get_current_user), db=Depends(get_db)):
    from ml.youtube_ml import classify_comment_sentiment
    sentiment = classify_comment_sentiment(body.review_text)
    review = models.new_review_doc(
        user_id=current_user["_id"], movie_title=title, review_text=body.review_text,
        sentiment_label=sentiment["label"], sentiment_confidence=sentiment["confidence"],
    )
    db["movie_reviews"].insert_one(review)
    return {
        "id": str(review["_id"]), "review_text": review["review_text"],
        "sentiment_label": review["sentiment_label"], "sentiment_confidence": review.get("sentiment_confidence"),
        "username": current_user.get("username"),
        "created_at": review["timestamp"].isoformat() if review.get("timestamp") else None,
    }

@app.get("/movies/{title}/reviews")
def get_movie_reviews_by_title(title: str, db=Depends(get_db)):
    reviews = list(db["movie_reviews"].find({"movie_title": title}).sort("timestamp", -1).limit(100))
    result = []
    for r in reviews:
        owner = db["users"].find_one({"_id": r.get("user_id")})
        username = owner.get("username") if owner else "Anonymous"
        result.append({
            "id": str(r["_id"]), "username": username,
            "review_text": r.get("review_text"), "sentiment_label": r.get("sentiment_label"),
            "sentiment_confidence": r.get("sentiment_confidence", 0.0),
            "created_at": r["timestamp"].isoformat() if r.get("timestamp") else None,
        })
    return {"reviews": result}


# ─── YouTube API (path-based) ───

@app.get("/youtube/search")
def search_youtube(q: str = "", limit: int = 10, region: Optional[str] = None):
    from ml.youtube_ml import search_videos
    videos = search_videos(q, top_k=limit, region=region)
    return {"videos": videos, "query": q}

@app.get("/youtube/trending")
def get_trending(region: Optional[str] = None, limit: int = 24):
    from ml.youtube_ml import get_videos_page
    return get_videos_page(limit=limit, offset=0, region=region)

@app.get("/youtube/video/{video_id}")
def get_youtube_video(video_id: str, db=Depends(get_db)):
    from ml.youtube_ml import _load_videos, _row_to_video
    df = _load_videos()
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail="Video not found")
    mask = df["video_id"] == video_id
    if not mask.any():
        mask = df["video_id"].str.contains(video_id[:6], na=False)
    if not mask.any():
        raise HTTPException(status_code=404, detail="Video not found")
    row = df[mask].iloc[0]
    video = _row_to_video(row)
    return {"video": video}

@app.get("/youtube/video/{video_id}/recommend")
def recommend_youtube(video_id: str, n: int = 10):
    from ml.youtube_ml import _load_videos, recommend_videos
    df = _load_videos()
    if df is None or df.empty:
        return {"recommendations": []}
    mask = df["video_id"] == video_id
    title = df[mask]["title"].iloc[0] if mask.any() else video_id
    recs = recommend_videos(title, num_recommendations=n)
    return {"recommendations": recs}

@app.get("/youtube/video/{video_id}/comments")
def get_video_comments(video_id: str, db=Depends(get_db)):
    comments = list(db["youtube_comments"].find({"video_id": video_id}).sort("timestamp", -1).limit(200))
    result = []
    for c in comments:
        owner = db["users"].find_one({"_id": c.get("user_id")})
        username = owner.get("username") if owner else "Anonymous"
        result.append({
            "id": str(c["_id"]), "username": username,
            "comment_text": c.get("text"), "sentiment_label": c.get("sentiment_label", "neutral"),
            "sentiment_confidence": c.get("sentiment_score", 0.0),
            "created_at": c["timestamp"].isoformat() if c.get("timestamp") else None,
        })
    return {"comments": result}

class YTCommentCreate(BaseModel):
    comment_text: str

@app.post("/youtube/video/{video_id}/comments")
def post_video_comment(video_id: str, body: YTCommentCreate, current_user=Depends(get_current_user), db=Depends(get_db)):
    from ml.youtube_ml import classify_comment_sentiment, _load_videos
    sentiment = classify_comment_sentiment(body.comment_text)
    df = _load_videos()
    title = video_id
    if df is not None and not df.empty:
        mask = df["video_id"] == video_id
        if mask.any():
            title = str(df[mask]["title"].iloc[0])
    comment = models.new_youtube_comment_doc(
        user_id=current_user["_id"], video_id=video_id, video_title=title,
        text=body.comment_text, sentiment_label=sentiment["label"], sentiment_score=sentiment["confidence"],
    )
    db["youtube_comments"].insert_one(comment)
    return {
        "id": str(comment["_id"]), "username": current_user.get("username"),
        "comment_text": comment["text"], "sentiment_label": comment["sentiment_label"],
        "sentiment_confidence": comment.get("sentiment_score"),
        "created_at": comment["timestamp"].isoformat() if comment.get("timestamp") else None,
    }

@app.get("/youtube/video/{video_id}/analysis")
def analyze_youtube_video_detail(video_id: str, db=Depends(get_db)):
    from ml.youtube_ml import _load_videos, detect_fake_engagement, analyze_comments
    df = _load_videos()
    views, likes, comment_count = 0, 0, 0
    if df is not None and not df.empty:
        mask = df["video_id"] == video_id
        if mask.any():
            row = df[mask].iloc[0]
            views = int(row.get("views", 0) or 0)
            likes = int(row.get("likes", 0) or 0)
            comment_count = int(row.get("comment_count", 0) or 0)
    fake = detect_fake_engagement(views, likes, comment_count)
    stored = list(db["youtube_comments"].find({"video_id": video_id}))
    comment_dicts = [{"text": c.get("text")} for c in stored]
    sentiment_summary = analyze_comments(comment_dicts)
    return {
        "is_suspicious": fake["is_suspicious"], "flags": fake["flags"],
        "confidence": fake["confidence"], "sentiment_summary": sentiment_summary,
    }



# ═══════════════════════════════════════════════════
# ─── EMOTIONAL ARC ENDPOINTS ───
# ═══════════════════════════════════════════════════

import resource
import pickle as _pickle
import base64 as _base64

import ml.mood_arc as mood_arc

# ── In-memory cache for PCA model + mood presets (loaded on first request) ────
_arc_pca_model = None
_arc_mood_presets = None
_arc_loaded = False


def _load_arc_config(db):
    """Load PCA model and mood presets from MongoDB arc_config collection."""
    global _arc_pca_model, _arc_mood_presets, _arc_loaded
    if _arc_loaded:
        return

    try:
        pca_doc = db["arc_config"].find_one({"_id": "pca_model"})
        if pca_doc:
            pca_bytes = _base64.b64decode(pca_doc["data"])
            _arc_pca_model = _pickle.loads(pca_bytes)
            print("✅ Loaded PCA model from arc_config")
        else:
            print("⚠️  No PCA model found in arc_config — arc recommendations will use raw vectors")

        presets_doc = db["arc_config"].find_one({"_id": "mood_presets"})
        if presets_doc:
            _arc_mood_presets = presets_doc
            print("✅ Loaded mood presets from arc_config")
        else:
            print("⚠️  No mood presets found in arc_config — using defaults")

        _arc_loaded = True
    except Exception as e:
        print(f"⚠️  Failed to load arc_config: {e}")


class ArcRecommendRequest(BaseModel):
    current_mood: str
    desired_mood: str
    genres: List[str] = []
    limit: int = 10


class ArcRateRequest(BaseModel):
    movie_id: str
    rating: int  # 1-5
    mood_before: str
    mood_after: str


@app.get("/api/health")
def arc_health():
    """Health check with RAM usage."""
    try:
        usage = resource.getrusage(resource.RUSAGE_SELF)
        ram_mb = usage.ru_maxrss / (1024 * 1024)  # macOS returns bytes
    except Exception:
        ram_mb = -1
    return {"status": "ok", "ram_mb": round(ram_mb, 1)}


@app.get("/api/moods")
def get_moods(db=Depends(get_db)):
    """Return the 50 preset moods with their pre-computed VADER vectors."""
    _load_arc_config(db)

    if _arc_mood_presets:
        return {
            "presets": _arc_mood_presets.get("presets", mood_arc.MOOD_PRESETS),
            "popular_current": _arc_mood_presets.get("popular_current", mood_arc.POPULAR_CURRENT),
            "popular_desired": _arc_mood_presets.get("popular_desired", mood_arc.POPULAR_DESIRED),
            "all_moods": _arc_mood_presets.get("all_moods", mood_arc.ALL_MOODS),
            "vectors": _arc_mood_presets.get("vectors", {}),
        }
    else:
        # Fallback: compute on the fly (lightweight — VADER only)
        vectors = mood_arc.compute_mood_preset_vectors()
        return {
            "presets": mood_arc.MOOD_PRESETS,
            "popular_current": mood_arc.POPULAR_CURRENT,
            "popular_desired": mood_arc.POPULAR_DESIRED,
            "all_moods": mood_arc.ALL_MOODS,
            "vectors": vectors,
        }


@app.post("/api/arc-recommend")
def arc_recommend(req: ArcRecommendRequest, db=Depends(get_db)):
    """
    Main emotional arc recommendation endpoint.

    1. Convert current+desired mood text → bridge vector (40-dim)
    2. PCA transform → 10-dim arc vector
    3. Query MongoDB for candidates (filtered by genre)
    4. Cosine similarity → return top matches
    """
    _load_arc_config(db)
    limit = min(req.limit, 20)

    # Step 1+2: Build bridge vector
    bridge_raw = mood_arc.compute_bridge_vector(req.current_mood, req.desired_mood)

    if _arc_pca_model is not None:
        target_arc = _arc_pca_model.transform(bridge_raw.reshape(1, -1))[0]
    else:
        # If PCA model not available, use first 10 dims of raw vector
        target_arc = bridge_raw[:10]

    target_arc = np.array(target_arc, dtype=np.float32)

    # Step 3: Query candidates from MongoDB
    query = {}
    if req.genres:
        query["genres"] = {"$in": req.genres}

    cursor = db["arc_movies"].find(query).limit(200)
    candidates = list(cursor)

    if not candidates:
        return {
            "results": [],
            "query_arc": target_arc.tolist(),
            "message": "No movies found. Run seed_arc.py to populate the database.",
        }

    # Step 4: Cosine similarity
    arc_vectors = []
    valid_candidates = []
    for c in candidates:
        vec = c.get("arc_vector")
        if vec and len(vec) == len(target_arc):
            arc_vectors.append(vec)
            valid_candidates.append(c)

    if not valid_candidates:
        return {
            "results": [],
            "query_arc": target_arc.tolist(),
            "message": "No valid arc vectors found in database.",
        }

    candidates_matrix = np.array(arc_vectors, dtype=np.float32)
    scores = mood_arc.cosine_similarity_batch(target_arc, candidates_matrix)

    # Sort by score descending
    scored = list(zip(valid_candidates, scores))
    scored.sort(key=lambda x: x[1], reverse=True)
    top = scored[:limit]

    # Step 5: Build results
    results = []
    for movie, score in top:
        arc_labels = movie.get("arc_labels", [])
        results.append({
            "id": str(movie.get("_id", "")),
            "title": movie.get("title", ""),
            "year": movie.get("year"),
            "genres": movie.get("genres", []),
            "poster_url": movie.get("poster_url"),
            "arc_match_score": round(float(max(0, min(1, (score + 1) / 2))), 3),
            "arc_labels": arc_labels,
            "arc_explanation": mood_arc.build_arc_explanation(arc_labels),
            "overview": movie.get("overview", ""),
            "rating": movie.get("rating", 0),
        })

    return {
        "results": results,
        "query_arc": target_arc.tolist(),
    }


@app.get("/api/arc-movie/{movie_id}")
def get_arc_movie(movie_id: str, db=Depends(get_db)):
    """Fetch a single movie with arc data by its MongoDB _id."""
    from bson import ObjectId

    try:
        doc = db["arc_movies"].find_one({"_id": ObjectId(movie_id)})
    except Exception:
        doc = db["arc_movies"].find_one({"tmdb_id": int(movie_id) if movie_id.isdigit() else 0})

    if not doc:
        raise HTTPException(status_code=404, detail="Movie not found")

    arc_labels = doc.get("arc_labels", [])
    return {
        "id": str(doc.get("_id", "")),
        "title": doc.get("title", ""),
        "year": doc.get("year"),
        "genres": doc.get("genres", []),
        "poster_url": doc.get("poster_url"),
        "tmdb_id": doc.get("tmdb_id"),
        "arc_vector": doc.get("arc_vector", []),
        "arc_labels": arc_labels,
        "arc_explanation": mood_arc.build_arc_explanation(arc_labels),
        "rating": doc.get("rating", 0),
        "overview": doc.get("overview", ""),
    }


@app.post("/api/arc-rate")
def rate_arc_movie(
    req: ArcRateRequest,
    current_user=Depends(get_current_user_optional),
    db=Depends(get_db),
):
    """Save a mood-aware rating for a movie (mood before/after + stars)."""
    user_id = current_user["_id"] if current_user else "anonymous"

    doc = {
        "user_id": user_id,
        "movie_id": req.movie_id,
        "rating": req.rating,
        "mood_before": req.mood_before,
        "mood_after": req.mood_after,
        "timestamp": datetime.datetime.utcnow(),
    }
    db["arc_ratings"].insert_one(doc)
    return {"message": "Rating saved", "status": "ok"}


@app.get("/api/ping")
def ping():
    """Lightweight ping for cold-start pre-warming."""
    return {"pong": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
