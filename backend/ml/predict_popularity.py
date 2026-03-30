from __future__ import annotations
"""
Revenue Prediction Pipeline (Train & Predict).

Trains a Random Forest on TMDB data using budget, runtime, and genre features
to predict log-transformed revenue. Provides a standalone predict function.
"""

import json
import os
import pickle

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import MultiLabelBinarizer


def train_and_save_popularity_model(tmdb_movies_path: str, save_path: str) -> bool:
    """Train a RandomForest on TMDB data and save the model artifacts."""
    if not os.path.exists(tmdb_movies_path):
        print("[predict_popularity] TMDB dataset not found.")
        return False

    df = pd.read_csv(tmdb_movies_path)
    df = df[(df["revenue"] > 1000) & (df["budget"] > 1000)].copy()
    df = df.dropna(subset=["runtime", "genres"])

    def _parse_genres(genre_str):
        try:
            return [g["name"] for g in json.loads(genre_str)]
        except Exception:
            return []

    df["parsed_genres"] = df["genres"].apply(_parse_genres)

    mlb = MultiLabelBinarizer()
    genre_df = pd.DataFrame(
        mlb.fit_transform(df["parsed_genres"]),
        columns=mlb.classes_,
        index=df.index,
    )

    X = pd.concat([df[["budget", "runtime"]], genre_df], axis=1)
    y = np.log1p(df["revenue"])

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = RandomForestRegressor(n_estimators=100, max_depth=15, random_state=42)
    model.fit(X_train, y_train)

    score = model.score(X_test, y_test)
    print(f"[predict_popularity] R² = {score:.2f}")

    artifacts = {"model": model, "genre_binarizer": mlb, "expected_features": list(X.columns)}
    with open(save_path, "wb") as f:
        pickle.dump(artifacts, f)

    print(f"[predict_popularity] Saved to {save_path}")
    return True


def load_and_predict(budget: float, runtime: float, genres: list[str], model_path: str) -> float:
    """Load the trained model and predict revenue for the given inputs."""
    if not os.path.exists(model_path):
        raise FileNotFoundError("Model not found. Train it first.")

    with open(model_path, "rb") as f:
        artifacts = pickle.load(f)

    model = artifacts["model"]
    mlb = artifacts["genre_binarizer"]
    expected = artifacts["expected_features"]

    genre_df = pd.DataFrame(mlb.transform([genres]), columns=mlb.classes_)
    input_df = pd.concat([pd.DataFrame({"budget": [budget], "runtime": [runtime]}), genre_df], axis=1)

    for col in expected:
        if col not in input_df.columns:
            input_df[col] = 0
    input_df = input_df[expected]

    return float(np.expm1(model.predict(input_df)[0]))


if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    train_and_save_popularity_model(
        os.path.join(base_dir, "data", "tmdb_5000_movies.csv"),
        os.path.join(base_dir, "artifacts", "popularity_model.pkl"),
    )
