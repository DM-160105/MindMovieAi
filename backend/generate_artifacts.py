from __future__ import annotations
"""
Artifact Generation Pipeline.

Merges TMDB, Bollywood, and Anime datasets into a unified movie index.
Builds a FAISS SQ8 similarity index and persists it alongside a movie
dictionary pickle for the recommendation engine.
"""

import ast
import os
import pickle

import faiss
import nltk
import numpy as np
import pandas as pd
from nltk.stem.porter import PorterStemmer
from sklearn.feature_extraction.text import CountVectorizer

from hf_utils import get_dataset_file

try:
    nltk.data.find("tokenizers/punkt")
except LookupError:
    nltk.download("punkt")

ps = PorterStemmer()


# ── Text Processing Helpers ──────────────────────────────────────────────────
def _parse_names(obj) -> list[str]:
    """Extract 'name' fields from a JSON-encoded list of dicts."""
    if pd.isna(obj):
        return []
    try:
        return [item["name"] for item in ast.literal_eval(obj)]
    except Exception:
        return []


def _parse_top3(obj) -> list[str]:
    """Extract the top-3 'name' fields from a JSON-encoded list."""
    if pd.isna(obj):
        return []
    try:
        return [item["name"] for item in ast.literal_eval(obj)[:3]]
    except Exception:
        return []


def _parse_director(obj) -> list[str]:
    """Extract the director's name from a JSON-encoded crew list."""
    if pd.isna(obj):
        return []
    try:
        return [item["name"] for item in ast.literal_eval(obj) if item["job"] == "Director"][:1]
    except Exception:
        return []


def _collapse(tokens: list[str]) -> list[str]:
    """Remove spaces within each token for bag-of-words matching."""
    return [str(t).replace(" ", "") for t in tokens]


def _stem(text) -> str:
    """Apply Porter stemming to every word in *text*."""
    if pd.isna(text):
        return ""
    return " ".join(ps.stem(w) for w in text.split())


# ── Main Pipeline ────────────────────────────────────────────────────────────
def main():
    # ── TMDB ──
    print("[artifacts] Loading TMDB…")
    movies = pd.read_csv(get_dataset_file("tmdb_5000_movies.csv"))
    credits = pd.read_csv(get_dataset_file("tmdb_5000_credits.csv"))
    tmdb = movies.merge(credits, on="title")

    tmdb["genres_list"] = tmdb["genres"].apply(_parse_names)
    tmdb["genres_c"] = tmdb["genres_list"].apply(_collapse)
    tmdb["keywords_c"] = tmdb["keywords"].apply(_parse_names).apply(_collapse)
    tmdb["cast_c"] = tmdb["cast"].apply(_parse_top3).apply(_collapse)
    tmdb["crew_c"] = tmdb["crew"].apply(_parse_director).apply(_collapse)
    tmdb["production_countries_list"] = tmdb["production_countries"].apply(_parse_names)
    tmdb["overview_c"] = tmdb["overview"].fillna("").apply(str.split)
    tmdb["tags"] = (tmdb["overview_c"] + tmdb["genres_c"] + tmdb["keywords_c"]
                    + tmdb["cast_c"] + tmdb["crew_c"]).apply(lambda x: " ".join(x).lower())
    tmdb["year"] = pd.to_datetime(tmdb["release_date"], errors="coerce").dt.year

    tmdb_df = pd.DataFrame({
        "movie_id": tmdb["movie_id"], "title": tmdb["title"], "tags": tmdb["tags"],
        "year": tmdb["year"], "vote_average": tmdb["vote_average"],
        "original_language": tmdb["original_language"],
        "production_countries": tmdb["production_countries_list"],
        "genres_list": tmdb["genres_list"], "poster_url": None, "origin": "tmdb",
    })

    # ── Bollywood ──
    print("[artifacts] Loading Bollywood…")
    bolly = pd.read_csv(get_dataset_file("bollywoodmovies.csv"))
    bolly["genres_list"] = bolly["genres"].fillna("").apply(lambda x: x.split("|"))
    bolly["genres_c"] = bolly["genres_list"].apply(_collapse)
    bolly["cast_c"] = bolly["actors"].fillna("").apply(lambda x: x.split("|")).apply(_collapse)
    bolly["overview_c"] = bolly["story"].fillna("").apply(str.split)
    bolly["tags"] = (bolly["overview_c"] + bolly["genres_c"] + bolly["cast_c"]).apply(lambda x: " ".join(x).lower())

    bolly_df = pd.DataFrame({
        "movie_id": bolly["imdb_id"], "title": bolly["title_x"], "tags": bolly["tags"],
        "year": bolly["year_of_release"], "vote_average": bolly["imdb_rating"],
        "original_language": "hi", "production_countries": bolly["title_x"].apply(lambda x: ["India"]),
        "genres_list": bolly["genres_list"], "poster_url": bolly["poster_path"], "origin": "bollywood",
    }).dropna(subset=["movie_id", "title", "tags"])

    # ── Anime ──
    print("[artifacts] Loading Anime…")
    anime = pd.read_csv(get_dataset_file("anime-dataset-2023.csv"))
    anime["genres_list"] = anime["Genres"].fillna("").apply(lambda x: [g.strip() for g in x.split(",")])
    anime["genres_c"] = anime["genres_list"].apply(_collapse)
    anime["overview_c"] = anime["Synopsis"].fillna("").apply(str.split)
    anime["tags"] = (anime["overview_c"] + anime["genres_c"]).apply(lambda x: " ".join(x).lower())
    anime["year"] = anime["Aired"].str.extract(r"(\d{4})").astype(float)

    anime_df = pd.DataFrame({
        "movie_id": anime["anime_id"].apply(lambda x: f"anime_{x}"),
        "title": anime["Name"], "tags": anime["tags"], "year": anime["year"],
        "vote_average": pd.to_numeric(anime["Score"], errors="coerce"),
        "original_language": "ja", "production_countries": anime["Name"].apply(lambda x: ["Japan"]),
        "genres_list": anime["genres_list"], "poster_url": anime["Image URL"], "origin": "anime",
    })
    anime_df = anime_df[anime_df["vote_average"] >= 6.5].head(15000)

    # ── Merge & Vectorize ──
    print("[artifacts] Merging & vectorizing…")
    new_df = pd.concat([tmdb_df, bolly_df, anime_df], ignore_index=True)
    new_df["tags"] = new_df["tags"].apply(_stem)

    cv = CountVectorizer(max_features=3000, stop_words="english")
    vectors = cv.fit_transform(new_df["tags"]).toarray().astype(np.float32)
    faiss.normalize_L2(vectors)

    # ── FAISS Index (SQ8 for low memory footprint) ──
    print("[artifacts] Building FAISS SQ8 index…")
    index = faiss.IndexScalarQuantizer(vectors.shape[1], faiss.ScalarQuantizer.QT_8bit, faiss.METRIC_INNER_PRODUCT)
    index.train(vectors)
    index.add(vectors)
    print(f"[artifacts] Index built — {len(new_df)} movies, {vectors.shape[1]} features.")

    # ── Save ──
    os.makedirs("artifacts", exist_ok=True)
    pickle.dump(new_df.to_dict(), open("artifacts/movie_dict.pkl", "wb"))
    faiss.write_index(index, "artifacts/movies.index")
    print("[artifacts] Done ✓")


if __name__ == "__main__":
    main()
