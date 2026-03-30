from __future__ import annotations
"""
Fake Engagement Detection (Isolation Forest).

Trains an Isolation Forest on per-user rating statistics to flag bot-like
behaviour. Provides helpers to filter suspicious users from rating data.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

_engagement_model: dict | None = None


def train_fake_engagement_model(ratings_dataframe: pd.DataFrame) -> bool:
    """Train an Isolation Forest on user rating patterns and cache results."""
    global _engagement_model

    if ratings_dataframe.empty or len(ratings_dataframe) < 10:
        return False

    user_stats = ratings_dataframe.groupby("user_id").agg(
        num_ratings=("rating", "count"),
        avg_rating=("rating", "mean"),
        var_rating=("rating", lambda x: np.var(x) if len(x) > 1 else 0.0),
    ).reset_index()

    X = user_stats[["num_ratings", "avg_rating", "var_rating"]].fillna(0)
    model = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
    model.fit(X)

    # -1 = outlier, 1 = inlier → convert to boolean
    user_stats["is_fake"] = model.predict(X) == -1
    _engagement_model = dict(zip(user_stats["user_id"], user_stats["is_fake"]))
    return True


def is_user_fake(user_id) -> bool:
    """Return True if *user_id* was flagged as fake/bot behaviour."""
    if _engagement_model is None:
        return False
    return _engagement_model.get(user_id, False)


def fetch_clean_ratings(ratings_dataframe: pd.DataFrame) -> pd.DataFrame:
    """Return *ratings_dataframe* with suspected fake users removed."""
    if _engagement_model is None or ratings_dataframe.empty:
        return ratings_dataframe
    return ratings_dataframe[~ratings_dataframe["user_id"].apply(is_user_fake)]
