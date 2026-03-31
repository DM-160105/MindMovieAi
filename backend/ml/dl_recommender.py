"""
Deep Learning Recommendation Engine
Uses a PyTorch MLP to map user profile + activity data → genre preference scores.
Used by the /recommend/personalized API endpoint.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np

ALL_GENRES = [
    "Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary",
    "Drama", "Family", "Fantasy", "History", "Horror", "Music", "Mystery",
    "Romance", "Science Fiction", "Thriller", "War", "Western",
    "Sci-Fi", "Musical", "Sport", "Biography", "Film-Noir", "News",
    "Shounen", "Slice of Life", "Mecha", "Supernatural", "Psychological",
    "Seinen", "Josei", "Ecchi", "Isekai", "Sports"
]
NUM_GENRES = len(ALL_GENRES)
GENRE_TO_IDX = {g: i for i, g in enumerate(ALL_GENRES)}
INPUT_DIM = 2 + NUM_GENRES + NUM_GENRES + 4  # demographics + liked + disliked + activity


class UserActivityMLP(nn.Module):
    """MLP that maps user profile + activity vectors to genre preference scores."""

    def __init__(self, input_dim=INPUT_DIM, hidden_dim=128, output_dim=NUM_GENRES):
        super().__init__()
        self.fc1 = nn.Linear(input_dim, hidden_dim)
        self.bn1 = nn.BatchNorm1d(hidden_dim)
        self.fc2 = nn.Linear(hidden_dim, hidden_dim // 2)
        self.bn2 = nn.BatchNorm1d(hidden_dim // 2)
        self.fc3 = nn.Linear(hidden_dim // 2, output_dim)
        self.dropout = nn.Dropout(0.3)

    def forward(self, x):
        x = F.relu(self.bn1(self.fc1(x)))
        x = self.dropout(x)
        x = F.relu(self.bn2(self.fc2(x)))
        x = self.dropout(x)
        out = torch.sigmoid(self.fc3(x))
        return out


def _build_user_feature_vector(
    age: int = None,
    gender: str = None,
    favorite_genres: list = None,
    disliked_genres: list = None,
    ratings: list = None,
    searches: list = None,
    clicked_movies: list = None,
    movies_df=None,
) -> np.ndarray:
    """Build the INPUT_DIM feature vector from user profile + activity data."""
    favorite_genres = favorite_genres or []
    disliked_genres = disliked_genres or []
    ratings = ratings or []
    searches = searches or []
    clicked_movies = clicked_movies or []

    vec = np.zeros(INPUT_DIM, dtype=np.float32)
    idx = 0

    # ── Demographic features ──
    # Age bucket: normalize to 0-1 over range 10-80
    if age is not None:
        vec[idx] = min(max((age - 10) / 70.0, 0.0), 1.0)
    idx += 1

    # Gender: female=0.0, male=1.0, other/unknown=0.5
    gender_lower = (gender or "").lower()
    if gender_lower in ("m", "male"):
        vec[idx] = 1.0
    elif gender_lower in ("f", "female"):
        vec[idx] = 0.0
    else:
        vec[idx] = 0.5
    idx += 1

    # ── Preferred genres (one-hot) ──
    for g in favorite_genres:
        if g in GENRE_TO_IDX:
            vec[idx + GENRE_TO_IDX[g]] = 1.0
    idx += NUM_GENRES

    # ── Disliked genres (one-hot) ──
    for g in disliked_genres:
        if g in GENRE_TO_IDX:
            vec[idx + GENRE_TO_IDX[g]] = 1.0
    idx += NUM_GENRES

    # ── Activity counts ──
    vec[idx] = min(len(ratings) / 50.0, 1.0)         # ratings count (capped at 50)
    vec[idx + 1] = min(len(searches) / 100.0, 1.0)   # search count (capped at 100)
    vec[idx + 2] = min(len(clicked_movies) / 200.0, 1.0)  # click count
    if ratings:
        avg_rating = sum(r.get("rating", 5.0) for r in ratings) / len(ratings)
        vec[idx + 3] = min(avg_rating / 10.0, 1.0)   # normalized avg rating
    else:
        vec[idx + 3] = 0.5  # neutral
    # idx += 4  (end of vector)

    return vec


def get_dl_recommendations_full(
    age: int = None,
    gender: str = None,
    favorite_genres: list = None,
    disliked_genres: list = None,
    ratings: list = None,
    searches: list = None,
    clicked_movies: list = None,
    favorites: list = None,
    watchlist: list = None,
    movies_df=None,
    top_k: int = 5,
) -> list:
    """
    Full personalized deep-learning recommendations.
    Returns a list of {"genre": str, "score": float} dicts sorted by score desc.
    
    The model weighs:
    - Explicit profile (age, gender, liked/disliked genres): strong signal
    - Rating history: strong signal (derived genre interests)
    - Search & click history: moderate signal
    """
    favorite_genres = favorite_genres or []
    disliked_genres = disliked_genres or []
    ratings = ratings or []
    searches = searches or []
    clicked_movies = clicked_movies or []
    favorites = favorites or []
    watchlist = watchlist or []

    # Build input vector
    feat = _build_user_feature_vector(
        age=age,
        gender=gender,
        favorite_genres=favorite_genres,
        disliked_genres=disliked_genres,
        ratings=ratings,
        searches=searches,
        clicked_movies=clicked_movies,
        movies_df=movies_df,
    )
    input_tensor = torch.tensor(feat, dtype=torch.float32).unsqueeze(0)  # (1, INPUT_DIM)

    # Run model (eval mode, no gradients needed)
    model = UserActivityMLP(input_dim=INPUT_DIM, hidden_dim=128, output_dim=NUM_GENRES)
    model.eval()
    with torch.no_grad():
        raw_scores = model(input_tensor).squeeze().numpy()  # (NUM_GENRES,)

    # Blend with explicit profile signal:
    # Give strong direct boost to favorite genres, strong penalty to disliked
    for g in favorite_genres:
        if g in GENRE_TO_IDX:
            raw_scores[GENRE_TO_IDX[g]] = min(raw_scores[GENRE_TO_IDX[g]] + 0.4, 1.0)

    for g in disliked_genres:
        if g in GENRE_TO_IDX:
            raw_scores[GENRE_TO_IDX[g]] = max(raw_scores[GENRE_TO_IDX[g]] - 0.5, 0.0)

    # Build fast O(1) lookup dictionary for genres
    title_to_genres = {}
    if movies_df is not None:
        if 'title_lower' in movies_df.columns:
            title_to_genres = dict(zip(movies_df['title_lower'], movies_df['genres_list']))
        else:
            title_to_genres = dict(zip(movies_df['title'].astype(str).str.lower(), movies_df['genres_list']))

    # Boost genres seen in ratings (weighted by rating score)
    if movies_df is not None and ratings:
        for r in ratings:
            title = r.get("movie_title", "")
            rating_val = r.get("rating", 5.0)
            genres = title_to_genres.get(title.lower(), [])
            if isinstance(genres, list):
                boost = (rating_val - 5.0) / 10.0  # -0.5 to +0.5
                for g in genres:
                    if g in GENRE_TO_IDX:
                        raw_scores[GENRE_TO_IDX[g]] = min(
                            max(raw_scores[GENRE_TO_IDX[g]] + boost, 0.0), 1.0
                        )

    # Boost genres seen in favorites and watchlist
    if movies_df is not None:
        for title in favorites + watchlist:
            genres = title_to_genres.get(title.lower(), [])
            if isinstance(genres, list):
                for g in genres:
                    if g in GENRE_TO_IDX:
                        raw_scores[GENRE_TO_IDX[g]] = min(raw_scores[GENRE_TO_IDX[g]] + 0.3, 1.0)

    # Sort and return top_k
    top_indices = np.argsort(raw_scores)[::-1][:top_k]
    return [
        {"genre": ALL_GENRES[i], "score": float(raw_scores[i])}
        for i in top_indices
        if raw_scores[i] > 0.0
    ]


# ── Legacy function (kept for backward compatibility with /recommend/dl) ──
def get_dl_recommendations(user_data: dict, top_k: int = 5) -> list:
    """
    Backward-compatible lightweight version (uses random input, as before).
    Use get_dl_recommendations_full() for production personalization.
    """
    input_vector = torch.rand(1, 20)
    model_legacy = nn.Sequential(
        nn.Linear(20, 64), nn.ReLU(),
        nn.Linear(64, 32), nn.ReLU(),
        nn.Linear(32, 10), nn.Sigmoid()
    )
    model_legacy.eval()
    with torch.no_grad():
        predictions = model_legacy(input_vector).squeeze().numpy()

    mock_genres = ["Action", "Drama", "Comedy", "Sci-Fi", "Romance",
                   "Horror", "Thriller", "Adventure", "Fantasy", "Animation"]
    top_indices = np.argsort(predictions)[::-1][:top_k]
    return [{"genre": mock_genres[i], "score": float(predictions[i])} for i in top_indices]
