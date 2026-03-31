"""
Vibe — Offline Atmosphere Fingerprint Seeding Script

THIS SCRIPT RUNS ONCE LOCALLY (or on Colab / HF Space).
It MUST NOT run on Render — it uses Kaggle downloads, TMDB API calls, and more RAM.

Steps:
  1. Load MovieLens 25M from Kaggle (genome-tags, genome-scores, ratings, movies)
  2. Select top 5,000 most-rated movies
  3. For each movie: match genome tags to 6 atmosphere dimensions → vibe_vector[6]
  4. Fetch TMDB keywords + overview to enrich fingerprint  [PARALLEL + CACHED]
  5. Compute vibe_tags (top 8 atmosphere genome tags) + vibe_summary string
  6. Insert into MongoDB `vibe_movies` collection
  7. Save DIMENSION_KEYWORDS + VIBE_PRESETS to `vibe_config` collection

⚡ Optimizations vs original:
  - ThreadPoolExecutor: fetches up to MAX_WORKERS TMDB pages simultaneously
  - Persistent JSON cache (tmdb_cache.json): resumes from interruption / skips re-runs
  - Removed per-movie time.sleep; back-pressure controlled by semaphore + retries

Usage:
  pip install kagglehub pandas pymongo[srv] requests python-dotenv numpy
  python seed_vibes.py
"""

import json
import logging
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from threading import Lock, Semaphore
from typing import Optional

import numpy as np
import pandas as pd
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

# Add parent dir for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dimension_keywords import (
    ATMOSPHERE_GENOME_TAGS,
    DIMENSION_KEYWORDS,
    DIMENSIONS,
    VIBE_PRESETS,
)

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
MONGODB_URI    = os.getenv("MONGODB_URI", "mongodb://localhost:27017/mindmovieai")
TMDB_API_KEY   = os.getenv("TMDB_API_KEY", "8265bd1679663a7ea12ac168da84d2e8")
MAX_MOVIES     = 5000
MAX_WORKERS    = 20          # parallel TMDB threads (safe for free tier)
RETRY_ATTEMPTS = 3           # retries per failed TMDB request
RETRY_DELAY    = 1.0         # seconds between retries
KAGGLE_DATASET = "garymk/movielens-25m-dataset"
CACHE_FILE     = Path(__file__).parent / "tmdb_cache.json"

# Semaphore keeps simultaneous in-flight TMDB requests ≤ MAX_WORKERS
_tmdb_semaphore = Semaphore(MAX_WORKERS)
# Lock protects cache writes from concurrent threads
_cache_lock = Lock()


# ── Persistent TMDB Cache ─────────────────────────────────────────────────────

def _load_cache() -> dict:
    """Load the TMDB cache from disk (if it exists)."""
    if CACHE_FILE.exists():
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            logger.info(f"📦 Loaded TMDB cache with {len(data):,} entries from {CACHE_FILE.name}")
            return data
        except Exception as e:
            logger.warning(f"⚠️  Could not read cache file: {e} — starting fresh.")
    return {}


def _save_cache(cache: dict) -> None:
    """Persist the current cache to disk (thread-safe)."""
    with _cache_lock:
        try:
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(cache, f)
        except Exception as e:
            logger.warning(f"⚠️  Cache write failed: {e}")


# ── DB Connection ─────────────────────────────────────────────────────────────

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


# ── Step 1: Load MovieLens data ───────────────────────────────────────────────

def load_movielens_data(max_movies: int = MAX_MOVIES) -> tuple[list, dict, pd.DataFrame]:
    """
    Load MovieLens 25M from Kaggle.
    Returns (top_movies_list, genome_tags_dict, genome_scores_pivot).
      - top_movies_list: [{movielens_id, title, year, genres}, ...]
      - genome_tags_dict: {tag_id: tag_name}
      - genome_scores_pivot: DataFrame, index=movieId, columns=tagId, values=relevance
    """
    try:
        import kagglehub
    except ImportError:
        logger.error("❌ Install kagglehub: pip install kagglehub")
        sys.exit(1)

    logger.info(f"📥 Downloading MovieLens 25M from Kaggle ({KAGGLE_DATASET})...")
    dataset_path = kagglehub.dataset_download(KAGGLE_DATASET)
    logger.info(f"📂 Dataset at: {dataset_path}")

    ratings_csv   = _find_csv(dataset_path, "ratings.csv")
    movies_csv    = _find_csv(dataset_path, "movies.csv")
    genome_tags_f = _find_csv(dataset_path, "genome-tags.csv")
    genome_scrs_f = _find_csv(dataset_path, "genome-scores.csv")
    logger.info("   Found all 4 CSV files")

    # Count ratings per movie (streaming to keep RAM low)
    logger.info("📊 Counting ratings per movie (streaming)...")
    movie_counts: dict[int, int] = {}
    for chunk in pd.read_csv(ratings_csv, usecols=["movieId"], chunksize=500_000):
        for mid in chunk["movieId"]:
            movie_counts[mid] = movie_counts.get(mid, 0) + 1

    top_ids = sorted(movie_counts, key=lambda m: movie_counts[m], reverse=True)[:max_movies]
    top_set = set(top_ids)
    logger.info(f"🎬 Top {len(top_ids)} most-rated movies selected")

    # Load movie metadata
    movies_df = pd.read_csv(movies_csv)
    top_movies = []
    for _, row in movies_df.iterrows():
        mid = row["movieId"]
        if mid not in top_set:
            continue
        title_raw = str(row.get("title", ""))
        year = None
        title = title_raw
        if "(" in title_raw:
            try:
                year_str = title_raw.rsplit("(", 1)[1].rstrip(")")
                year = int(year_str)
                title = title_raw.rsplit("(", 1)[0].strip()
            except (ValueError, IndexError):
                pass
        genres_raw = str(row.get("genres", ""))
        genres = genres_raw.split("|") if genres_raw and genres_raw != "(no genres listed)" else []
        top_movies.append({
            "movielens_id": int(mid),
            "title": title,
            "year": year,
            "genres": genres,
            "rating_count": movie_counts[mid],
        })
    logger.info(f"📋 Loaded metadata for {len(top_movies)} movies")

    # Load genome tags → {tag_id: tag_name}
    logger.info("🏷️  Loading genome tags dictionary...")
    tags_df = pd.read_csv(genome_tags_f)
    genome_tags_dict = dict(zip(tags_df["tagId"], tags_df["tag"].str.lower()))
    logger.info(f"   {len(genome_tags_dict)} tags in genome")

    # Load genome scores for our top movies — stream to save RAM
    logger.info("🔢 Loading genome scores for top movies (may take a minute)...")
    top_movie_ids = {m["movielens_id"] for m in top_movies}
    scores_records = []
    for chunk in pd.read_csv(genome_scrs_f, chunksize=500_000):
        filtered = chunk[chunk["movieId"].isin(top_movie_ids)]
        scores_records.append(filtered)
        if len(scores_records) % 5 == 0:
            logger.info(f"   Processed {len(scores_records) * 500_000:,} rows...")

    scores_df = pd.concat(scores_records, ignore_index=True)
    logger.info(f"   {len(scores_df):,} genome score rows loaded")

    # Pivot: rows=movieId, cols=tagId, values=relevance
    logger.info("🔄 Pivoting genome scores (this may take ~30 seconds)...")
    genome_pivot = scores_df.pivot(index="movieId", columns="tagId", values="relevance")
    logger.info(f"   Pivot shape: {genome_pivot.shape}")

    return top_movies, genome_tags_dict, genome_pivot


# ── Step 2: Score atmosphere dimensions ───────────────────────────────────────

def score_dimensions(
    movielens_id: int,
    genome_tags_dict: dict,
    genome_pivot: pd.DataFrame,
    tmdb_keywords: list[str],
    tmdb_overview: str,
) -> tuple[list[float], list[str], str]:
    """
    Compute vibe_vector[6] for a movie by combining:
      - MovieLens genome tag relevance scores
      - TMDB keyword list
    Returns (vibe_vector, vibe_tags, vibe_summary).
    """
    # Build composite tag→score dict for this movie
    movie_scores: dict[str, float] = {}

    # Genome scores
    if movielens_id in genome_pivot.index:
        row = genome_pivot.loc[movielens_id]
        for tag_id, relevance in row.items():
            if relevance > 0.01:
                tag_text = genome_tags_dict.get(tag_id, "")
                if tag_text:
                    movie_scores[tag_text] = float(relevance)

    # TMDB keywords (treat as binary relevance 0.8)
    for kw in tmdb_keywords:
        kw_lower = kw.lower().strip()
        if kw_lower and kw_lower not in movie_scores:
            movie_scores[kw_lower] = 0.8

    # Score each dimension
    vibe_vector = []
    for dim in DIMENSIONS:
        dim_keywords = DIMENSION_KEYWORDS[dim]
        weighted_scores = []
        for tag_text, relevance in movie_scores.items():
            if tag_text in dim_keywords:
                weighted_scores.append(dim_keywords[tag_text] * relevance)
            else:
                for kw, score in dim_keywords.items():
                    if kw in tag_text or tag_text in kw:
                        weighted_scores.append(score * relevance * 0.7)
                        break
        vibe_vector.append(float(np.mean(weighted_scores)) if weighted_scores else 0.5)

    # Compute vibe_tags from atmosphere genome tags
    atm_set = set(ATMOSPHERE_GENOME_TAGS)
    atm_scores = [(tag, score) for tag, score in movie_scores.items() if tag in atm_set]
    atm_scores.sort(key=lambda x: x[1], reverse=True)
    vibe_tags = [t for t, _ in atm_scores[:8]]

    # Build vibe_summary
    dim_labels = {
        "lighting":    {(0.0, 0.3): "dark",       (0.3, 0.7): "moody",        (0.7, 1.0): "bright"},
        "pacing":      {(0.0, 0.3): "slow",        (0.3, 0.7): "measured",     (0.7, 1.0): "kinetic"},
        "setting_type":{(0.0, 0.3): "isolated",    (0.3, 0.7): "small-town",   (0.7, 1.0): "urban"},
        "temperature": {(0.0, 0.3): "cold",        (0.3, 0.7): "temperate",    (0.7, 1.0): "warm"},
        "texture":     {(0.0, 0.3): "gritty",      (0.3, 0.7): "naturalistic", (0.7, 1.0): "polished"},
        "era_feel":    {(0.0, 0.3): "historical",  (0.3, 0.7): "timeless",     (0.7, 1.0): "contemporary"},
    }
    summary_parts = []
    for i, dim in enumerate(DIMENSIONS):
        val = vibe_vector[i]
        for (lo, hi), label in dim_labels[dim].items():
            if lo <= val < hi or (hi == 1.0 and val == 1.0):
                summary_parts.append(label)
                break
    vibe_summary = " · ".join(summary_parts[:4])

    return vibe_vector, vibe_tags, vibe_summary


# ── Step 3: Fetch TMDB data (with retry + semaphore) ─────────────────────────

def _get(url: str, params: dict, timeout: int = 10) -> Optional[dict]:
    """GET with retry logic."""
    for attempt in range(RETRY_ATTEMPTS):
        try:
            resp = requests.get(url, params=params, timeout=timeout)
            if resp.status_code == 429:
                # Rate limited — wait and retry
                wait = float(resp.headers.get("Retry-After", RETRY_DELAY * (attempt + 1)))
                logger.debug(f"   429 rate-limited, waiting {wait:.1f}s...")
                time.sleep(wait)
                continue
            if resp.status_code == 200:
                return resp.json()
        except Exception:
            if attempt < RETRY_ATTEMPTS - 1:
                time.sleep(RETRY_DELAY)
    return None


def fetch_tmdb_keywords(tmdb_id: int) -> list[str]:
    """Fetch TMDB keyword list for a movie (no semaphore — called inside fetch_tmdb_data)."""
    data = _get(
        f"https://api.themoviedb.org/3/movie/{tmdb_id}/keywords",
        {"api_key": TMDB_API_KEY},
    )
    if data:
        return [kw["name"].lower() for kw in data.get("keywords", [])]
    return []


def fetch_tmdb_data(title: str, year: Optional[int], cache: dict) -> Optional[dict]:
    """
    Search TMDB and return {tmdb_id, overview, poster_url, rating, keywords}.
    Uses cache keyed by '{title}|{year}'. Thread-safe.
    """
    cache_key = f"{title}|{year}"

    # Cache hit — no network call needed
    with _cache_lock:
        if cache_key in cache:
            return cache[cache_key]

    with _tmdb_semaphore:
        # Double-check after acquiring semaphore (another thread may have filled it)
        with _cache_lock:
            if cache_key in cache:
                return cache[cache_key]

        params = {"api_key": TMDB_API_KEY, "query": title, "language": "en-US"}
        if year:
            params["year"] = year

        data = _get("https://api.themoviedb.org/3/search/movie", params)
        if not data:
            return None

        results = data.get("results", [])
        if not results:
            return None

        movie = results[0]
        tmdb_id = movie["id"]
        poster_path = movie.get("poster_path")
        keywords = fetch_tmdb_keywords(tmdb_id)

        result = {
            "tmdb_id":    tmdb_id,
            "overview":   movie.get("overview", ""),
            "poster_url": f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else None,
            "rating":     movie.get("vote_average", 0),
            "keywords":   keywords,
        }

        # Persist to cache
        with _cache_lock:
            cache[cache_key] = result

        return result


# ── Main seeding function ─────────────────────────────────────────────────────

def seed():
    """Main seeding function."""
    db = get_db()

    # Step 1: Load MovieLens
    movies, genome_tags_dict, genome_pivot = load_movielens_data(MAX_MOVIES)

    # Step 2: Parallel TMDB fetch
    logger.info(
        f"⚡ Fetching TMDB data for {len(movies)} movies "
        f"using {MAX_WORKERS} parallel threads..."
    )
    cache = _load_cache()
    cache_hits_before = sum(1 for m in movies if f"{m['title']}|{m['year']}" in cache)
    logger.info(f"   Cache hits (skip network): {cache_hits_before:,} / {len(movies):,}")

    # Submit all fetch tasks
    tmdb_results: dict[int, Optional[dict]] = {}  # movielens_id → tmdb dict
    completed = 0
    failed = 0
    t0 = time.time()

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_movie = {
            executor.submit(fetch_tmdb_data, m["title"], m["year"], cache): m
            for m in movies
        }

        for future in as_completed(future_to_movie):
            movie = future_to_movie[future]
            completed += 1
            try:
                result = future.result()
                tmdb_results[movie["movielens_id"]] = result
                if result is None:
                    failed += 1
            except Exception as e:
                logger.warning(f"   ⚠️  Error for '{movie['title']}': {e}")
                tmdb_results[movie["movielens_id"]] = None
                failed += 1

            if completed % 250 == 0 or completed == len(movies):
                elapsed = time.time() - t0
                rate = completed / elapsed if elapsed > 0 else 0
                eta = (len(movies) - completed) / rate if rate > 0 else 0
                logger.info(
                    f"   [{completed}/{len(movies)}] "
                    f"{rate:.1f} movies/s | "
                    f"ETA: {eta/60:.1f} min | "
                    f"failed: {failed}"
                )

    # Save full cache to disk after all fetches
    _save_cache(cache)
    logger.info(f"💾 Cache saved ({len(cache):,} entries)")

    # Step 3: Score atmosphere dimensions for each successfully fetched movie
    logger.info("🎨 Scoring atmosphere dimensions...")
    docs = []
    for movie in movies:
        tmdb = tmdb_results.get(movie["movielens_id"])
        if not tmdb:
            continue

        vibe_vector, vibe_tags, vibe_summary = score_dimensions(
            movielens_id=movie["movielens_id"],
            genome_tags_dict=genome_tags_dict,
            genome_pivot=genome_pivot,
            tmdb_keywords=tmdb.get("keywords", []),
            tmdb_overview=tmdb.get("overview", ""),
        )

        docs.append({
            "title":       movie["title"],
            "year":        movie["year"],
            "genres":      movie["genres"],
            "poster_url":  tmdb.get("poster_url"),
            "tmdb_id":     tmdb["tmdb_id"],
            "rating":      tmdb.get("rating", 0),
            "overview":    tmdb.get("overview", ""),
            "vibe_vector": vibe_vector,
            "vibe_tags":   vibe_tags,
            "vibe_summary": vibe_summary,
        })

    logger.info(f"✅ Scored {len(docs)} movies ({failed} failed TMDB lookup)")

    # Step 4: Insert into MongoDB
    logger.info("💾 Inserting into MongoDB `vibe_movies` collection...")
    vibe_col = db["vibe_movies"]
    vibe_col.drop()
    if docs:
        # Insert in batches to avoid exceeding BSON document size limits
        BATCH_SIZE = 500
        for i in range(0, len(docs), BATCH_SIZE):
            vibe_col.insert_many(docs[i:i + BATCH_SIZE])
            logger.info(f"   Inserted batch {i // BATCH_SIZE + 1} / {-(-len(docs) // BATCH_SIZE)}")

    # Create indexes
    vibe_col.create_index("genres")
    vibe_col.create_index([("rating", -1)])
    vibe_col.create_index("vibe_tags")
    vibe_col.create_index([("title", "text")])
    logger.info("   Created indexes on vibe_movies")

    # Step 5: Save config (keyword map + presets) to MongoDB
    logger.info("💾 Saving vibe_config to MongoDB...")
    config_col = db["vibe_config"]
    config_col.drop()
    config_col.insert_one({
        "_id": "dimension_keywords",
        "keywords": DIMENSION_KEYWORDS,
        "dimensions": DIMENSIONS,
    })
    config_col.insert_one({
        "_id": "vibe_presets",
        "presets": VIBE_PRESETS,
    })

    total_time = time.time() - t0
    logger.info("✅ Vibe seeding complete!")
    logger.info(f"   ⏱  Total time: {total_time/60:.1f} minutes")
    logger.info(f"   vibe_movies : {len(docs)}")
    logger.info(f"   vibe_config : dimension_keywords + {len(VIBE_PRESETS)} presets")


if __name__ == "__main__":
    seed()
