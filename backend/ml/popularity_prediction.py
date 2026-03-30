from __future__ import annotations
"""
Revenue Popularity Prediction (Random Forest).

Trains a RandomForestRegressor on TMDB budget + genre features to predict
box-office revenue. Provides model persistence via pickle.
"""

import ast
import pickle

import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import MultiLabelBinarizer


class PopularityPredictor:
    """Predicts movie revenue from budget and genre features."""

    def __init__(self, data_path: str = "datasets/tmdb_5000_movies.csv"):
        self.data_path = data_path
        self.model = RandomForestRegressor(n_estimators=50, random_state=42)
        self.mlb = MultiLabelBinarizer()
        self.is_trained = False

    @staticmethod
    def _extract_genres(genres_json: str) -> list[str]:
        try:
            return [g["name"] for g in ast.literal_eval(genres_json)]
        except Exception:
            return []

    def load_and_preprocess(self):
        """Load TMDB CSV and return (features, target) DataFrames."""
        try:
            df = pd.read_csv(self.data_path)
            if "revenue" not in df.columns or "budget" not in df.columns:
                return None, None

            df["genre_list"] = df["genres"].apply(self._extract_genres)
            genre_encoded = pd.DataFrame(
                self.mlb.fit_transform(df["genre_list"]),
                columns=self.mlb.classes_,
                index=df.index,
            )
            features = pd.concat([df[["budget"]], genre_encoded], axis=1).fillna(0)
            return features, df["revenue"]
        except Exception as exc:
            print(f"[PopularityPredictor] Error loading data: {exc}")
            return None, None

    def train(self) -> bool:
        """Train the model and save artifacts to disk."""
        X, y = self.load_and_preprocess()
        if X is None or y is None:
            return False

        self.model.fit(X, y)
        self.is_trained = True

        with open("models/popularity_model.pkl", "wb") as f:
            pickle.dump(self.model, f)
        with open("models/mlb_encoder.pkl", "wb") as f:
            pickle.dump(self.mlb, f)
        print("[PopularityPredictor] Model trained and saved.")
        return True

    def predict_revenue(self, budget: float, genres: list[str]) -> float:
        """Predict revenue given a budget and list of genre strings."""
        if not self.is_trained:
            try:
                with open("models/popularity_model.pkl", "rb") as f:
                    self.model = pickle.load(f)
                with open("models/mlb_encoder.pkl", "rb") as f:
                    self.mlb = pickle.load(f)
                self.is_trained = True
            except FileNotFoundError:
                print("[PopularityPredictor] No saved model found.")
                return 0.0

        genre_encoded = self.mlb.transform([genres])
        features = pd.DataFrame(genre_encoded, columns=self.mlb.classes_)
        features.insert(0, "budget", budget)
        return float(self.model.predict(features)[0])


if __name__ == "__main__":
    predictor = PopularityPredictor()
    predictor.train()
