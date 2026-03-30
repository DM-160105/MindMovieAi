"""
MindMovieAi — Offline Emotional Arc Seeding Script

THIS SCRIPT RUNS ONCE LOCALLY (or on Colab / HF Space).
It MUST NOT run on Render — it uses too much RAM and network calls.

Steps:
  1. Load MovieLens 25M from Kaggle (top 5000 most-rated movies)
  2. Fetch plot summaries from TMDB API
  3. Score each plot with VADER → 40-dim raw vectors
  4. PCA reduce to 10-dim arc vectors
  5. Insert into MongoDB `arc_movies` collection
  6. Save PCA model + mood presets into `arc_config` collection

Usage:
  pip install kagglehub pandas pymongo[srv] requests vaderSentiment scikit-learn numpy python-dotenv
  python seed_arc.py
"""

import os
import sys
import time
import pickle
import base64
import logging
from typing import Optional

import numpy as np
import pandas as pd
import requests
from dotenv import load_dotenv
from pymongo import MongoClient
from sklearn.decomposition import PCA
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

# Add parent dir for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ml.mood_arc import (
    map_arc_label,
    compute_mood_preset_vectors,
    ALL_MOODS,
    MOOD_PRESETS,
    POPULAR_CURRENT,
    POPULAR_DESIRED,
)

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ── Config ───────────────────────────────────────────────────────────────────
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/mindmovieai")
TMDB_API_KEY = os.getenv("TMDB_API_KEY", "8265bd1679663a7ea12ac168da84d2e8")
MAX_MOVIES = 5000
PCA_COMPONENTS = 10
TMDB_RATE_LIMIT_DELAY = 0.26  # ~4 req/sec to stay under TMDB free limit

# Kaggle dataset identifier
KAGGLE_DATASET = "garymk/movielens-25m-dataset"


def get_db():
    """Connect to MongoDB and return the database object."""
    import dns.resolver
    try:
        dns.resolver.default_resolver = dns.resolver.Resolver()
    except dns.resolver.NoResolverConfiguration:
        dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
        dns.resolver.default_resolver.nameservers = ["8.8.8.8", "1.1.1.1"]

    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=10_000)
    client.admin.command("ping")
    logger.info("✅ Connected to MongoDB")

    path = MONGODB_URI.split("//")[-1]
    db_name = path.split("/", 1)[1].split("?")[0] if "/" in path else "mindmovieai"
    db_name = db_name or "mindmovieai"
    return client[db_name]


def _find_csv(base_path: str, filename: str) -> str:
    """Recursively find a CSV file within the downloaded Kaggle dataset directory."""
    for root, dirs, files in os.walk(base_path):
        for f in files:
            if f.lower() == filename.lower():
                return os.path.join(root, f)
    raise FileNotFoundError(f"Could not find {filename} in {base_path}")


def load_movielens_top_movies(max_movies: int = MAX_MOVIES) -> list:
    """
    Load MovieLens 25M dataset from Kaggle (garymk/movielens-25m-dataset)
    and return the top `max_movies` most-rated movie IDs with titles and genres.
    """
    try:
        import kagglehub
    except ImportError:
        logger.error("❌ Install kagglehub: pip install kagglehub")
        sys.exit(1)

    logger.info(f"📥 Downloading MovieLens 25M from Kaggle ({KAGGLE_DATASET})...")
    dataset_path = kagglehub.dataset_download(KAGGLE_DATASET)
    logger.info(f"📂 Dataset downloaded to: {dataset_path}")

    # Find the CSV files inside the downloaded directory
    ratings_csv = _find_csv(dataset_path, "ratings.csv")
    movies_csv = _find_csv(dataset_path, "movies.csv")
    logger.info(f"   ratings.csv: {ratings_csv}")
    logger.info(f"   movies.csv:  {movies_csv}")

    # Count ratings per movie (stream to save memory)
    logger.info("📊 Counting ratings per movie...")
    movie_counts = {}
    for chunk in pd.read_csv(ratings_csv, usecols=["movieId"], chunksize=500_000):
        for mid in chunk["movieId"]:
            movie_counts[mid] = movie_counts.get(mid, 0) + 1

    # Sort by count descending, take top N
    top_ids = sorted(movie_counts, key=lambda m: movie_counts[m], reverse=True)[:max_movies]
    top_set = set(top_ids)
    logger.info(f"🎬 Selected top {len(top_ids)} most-rated movies")

    # Load movie metadata
    logger.info("📥 Loading movie metadata from movies.csv...")
    movies_df = pd.read_csv(movies_csv)

    movies = []
    for _, row in movies_df.iterrows():
        mid = row["movieId"]
        if mid not in top_set:
            continue

        title_raw = str(row.get("title", ""))
        # Extract year from title like "Toy Story (1995)"
        year = None
        title = title_raw
        if title_raw and "(" in title_raw:
            try:
                year_str = title_raw.rsplit("(", 1)[1].rstrip(")")
                year = int(year_str)
                title = title_raw.rsplit("(", 1)[0].strip()
            except (ValueError, IndexError):
                pass

        genres_raw = str(row.get("genres", ""))
        genres = genres_raw.split("|") if genres_raw and genres_raw != "(no genres listed)" else []
        movies.append({
            "movielens_id": int(mid),
            "title": title,
            "year": year,
            "genres": genres,
            "rating_count": movie_counts[mid],
        })

    logger.info(f"📋 Loaded metadata for {len(movies)} movies")
    return movies


def fetch_tmdb_data(title: str, year: Optional[int] = None) -> Optional[dict]:
    """
    Search TMDB for a movie by title+year and return plot overview + poster + rating.
    Returns None if not found.
    """
    search_url = "https://api.themoviedb.org/3/search/movie"
    params = {"api_key": TMDB_API_KEY, "query": title, "language": "en-US"}
    if year:
        params["year"] = year

    try:
        resp = requests.get(search_url, params=params, timeout=10)
        if resp.status_code != 200:
            return None
        results = resp.json().get("results", [])
        if not results:
            return None

        movie = results[0]
        poster_path = movie.get("poster_path")
        return {
            "tmdb_id": movie["id"],
            "overview": movie.get("overview", ""),
            "poster_url": f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else None,
            "rating": movie.get("vote_average", 0),
        }
    except Exception as e:
        logger.warning(f"TMDB error for '{title}': {e}")
        return None


def split_text_segments(text: str, num_segments: int = 10) -> list:
    """Split text into roughly equal segments."""
    if not text or not text.strip():
        return [""] * num_segments

    words = text.split()
    if len(words) < num_segments:
        # Pad with empty strings
        segments = [" ".join(words[i:i+1]) if i < len(words) else "" for i in range(num_segments)]
        return segments

    chunk_size = len(words) // num_segments
    segments = []
    for i in range(num_segments):
        start = i * chunk_size
        end = start + chunk_size if i < num_segments - 1 else len(words)
        segments.append(" ".join(words[start:end]))
    return segments


def compute_raw_arc_vector(overview: str, analyzer: SentimentIntensityAnalyzer) -> np.ndarray:
    """
    Split plot into 10 segments, score each with VADER.
    Returns a 40-dim raw vector (10 segments × 4 VADER scores).
    """
    segments = split_text_segments(overview, 10)
    raw = []
    for seg in segments:
        if seg.strip():
            scores = analyzer.polarity_scores(seg)
        else:
            scores = {"neg": 0.0, "neu": 1.0, "pos": 0.0, "compound": 0.0}
        raw.extend([scores["neg"], scores["neu"], scores["pos"], scores["compound"]])
    return np.array(raw, dtype=np.float32)


def compute_arc_labels(overview: str, analyzer: SentimentIntensityAnalyzer) -> list:
    """Compute 10 arc labels from the movie's plot segments."""
    segments = split_text_segments(overview, 10)
    labels = []
    for i, seg in enumerate(segments):
        if i < 3:
            position = "early"
        elif i < 7:
            position = "mid"
        else:
            position = "late"

        if seg.strip():
            scores = analyzer.polarity_scores(seg)
        else:
            scores = {"neg": 0.0, "neu": 1.0, "pos": 0.0, "compound": 0.0}
        labels.append(map_arc_label(scores, position))
    return labels


def seed():
    """Main seeding function."""
    db = get_db()
    analyzer = SentimentIntensityAnalyzer()

    # ── Step 1: Load MovieLens data ──────────────────────────────────────────
    movies = load_movielens_top_movies(MAX_MOVIES)
    if not movies:
        logger.error("❌ No movies loaded. Exiting.")
        return

    # ── Step 2: Fetch TMDB data + compute raw vectors ────────────────────────
    logger.info("🔍 Fetching TMDB data and computing arc vectors...")
    raw_vectors = []
    enriched_movies = []
    failed_count = 0

    for idx, movie in enumerate(movies):
        if idx % 100 == 0:
            logger.info(f"  Processing {idx}/{len(movies)}...")

        tmdb = fetch_tmdb_data(movie["title"], movie["year"])
        time.sleep(TMDB_RATE_LIMIT_DELAY)

        if not tmdb or not tmdb.get("overview"):
            failed_count += 1
            continue

        overview = tmdb["overview"]
        raw_vec = compute_raw_arc_vector(overview, analyzer)
        arc_labels = compute_arc_labels(overview, analyzer)

        raw_vectors.append(raw_vec)
        enriched_movies.append({
            "title": movie["title"],
            "year": movie["year"],
            "genres": movie["genres"],
            "poster_url": tmdb.get("poster_url"),
            "tmdb_id": tmdb["tmdb_id"],
            "rating": tmdb.get("rating", 0),
            "overview": overview,
            "arc_labels": arc_labels,
            "raw_vector": raw_vec,
        })

    logger.info(f"✅ Enriched {len(enriched_movies)} movies ({failed_count} failed TMDB lookup)")

    if not enriched_movies:
        logger.error("❌ No enriched movies. Exiting.")
        return

    # ── Step 3: PCA reduction (40-dim → 10-dim) ─────────────────────────────
    logger.info("🔬 Fitting PCA (40 → 10 dimensions)...")
    raw_matrix = np.array(raw_vectors, dtype=np.float32)
    pca = PCA(n_components=PCA_COMPONENTS)
    arc_matrix = pca.fit_transform(raw_matrix)
    logger.info(f"  Explained variance: {pca.explained_variance_ratio_.sum():.2%}")

    # ── Step 4: Insert into MongoDB ──────────────────────────────────────────
    logger.info("💾 Inserting movies into MongoDB `arc_movies` collection...")
    arc_movies_col = db["arc_movies"]
    arc_movies_col.drop()  # Fresh insert

    docs = []
    for i, movie in enumerate(enriched_movies):
        arc_vec = arc_matrix[i].tolist()
        doc = {
            "title": movie["title"],
            "year": movie["year"],
            "genres": movie["genres"],
            "poster_url": movie["poster_url"],
            "tmdb_id": movie["tmdb_id"],
            "arc_vector": arc_vec,
            "arc_labels": movie["arc_labels"],
            "rating": movie["rating"],
            "overview": movie["overview"],
        }
        docs.append(doc)

    if docs:
        arc_movies_col.insert_many(docs)
        logger.info(f"  Inserted {len(docs)} movies")

    # Create indexes
    arc_movies_col.create_index("genres")
    arc_movies_col.create_index([("rating", -1)])
    arc_movies_col.create_index([("title", "text")])
    logger.info("  Created indexes on arc_movies")

    # ── Step 5: Save PCA model + mood presets to `arc_config` ────────────────
    logger.info("💾 Saving PCA model and mood presets to `arc_config`...")
    arc_config_col = db["arc_config"]
    arc_config_col.drop()

    # Serialize PCA model as base64 pickle
    pca_bytes = pickle.dumps(pca)
    pca_b64 = base64.b64encode(pca_bytes).decode("utf-8")

    # Pre-compute mood preset vectors
    mood_vectors = compute_mood_preset_vectors()

    arc_config_col.insert_one({
        "_id": "pca_model",
        "data": pca_b64,
        "n_components": PCA_COMPONENTS,
        "explained_variance": float(pca.explained_variance_ratio_.sum()),
    })

    arc_config_col.insert_one({
        "_id": "mood_presets",
        "presets": MOOD_PRESETS,
        "all_moods": ALL_MOODS,
        "popular_current": POPULAR_CURRENT,
        "popular_desired": POPULAR_DESIRED,
        "vectors": mood_vectors,
    })

    logger.info("✅ Seeding complete!")
    logger.info(f"   Movies: {len(docs)}")
    logger.info(f"   PCA model saved (explained variance: {pca.explained_variance_ratio_.sum():.2%})")
    logger.info(f"   Mood presets: {len(ALL_MOODS)}")


if __name__ == "__main__":
    seed()
