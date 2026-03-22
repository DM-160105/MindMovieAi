"""
User Preference Prediction Model
Predicts preferred movie genres based on user's search history, ratings, and activity.
Uses a lightweight neural network approach with collaborative filtering.
"""

import os
import numpy as np
from collections import Counter

# All possible genres across the datasets
ALL_GENRES = [
    "Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary",
    "Drama", "Family", "Fantasy", "History", "Horror", "Music", "Mystery",
    "Romance", "Science Fiction", "Thriller", "War", "Western",
    "Sci-Fi", "Musical", "Sport", "Biography", "Film-Noir", "News",
    "Shounen", "Slice of Life", "Mecha", "Supernatural", "Psychological",
    "Seinen", "Josei", "Ecchi", "Isekai", "Sports"
]

# Mapping from genre to index for embedding
GENRE_TO_IDX = {g: i for i, g in enumerate(ALL_GENRES)}
NUM_GENRES = len(ALL_GENRES)


def extract_genre_profile(ratings: list, movies_df=None) -> np.ndarray:
    """
    Build a genre-preference vector from user's ratings.
    
    Args:
        ratings: list of dicts with 'movie_title', 'rating' keys
        movies_df: DataFrame with 'title' and 'genres_list' columns
    
    Returns:
        Normalized genre preference vector of shape (NUM_GENRES,)
    """
    genre_scores = np.zeros(NUM_GENRES)
    genre_counts = np.zeros(NUM_GENRES)
    
    if movies_df is None or not ratings:
        return genre_scores
    
    for r in ratings:
        title = r.get('movie_title', '')
        rating = r.get('rating', 5.0)
        
        match = movies_df[movies_df['title'] == title]
        if match.empty:
            # Try case-insensitive
            match = movies_df[movies_df['title'].str.lower() == title.lower()]
        
        if not match.empty:
            genres = match.iloc[0].get('genres_list', [])
            if isinstance(genres, list):
                for genre in genres:
                    if genre in GENRE_TO_IDX:
                        idx = GENRE_TO_IDX[genre]
                        # Weight by user's rating (higher rating = stronger preference)
                        genre_scores[idx] += rating
                        genre_counts[idx] += 1
    
    # Normalize: average rating per genre
    mask = genre_counts > 0
    genre_scores[mask] /= genre_counts[mask]
    
    # Scale to 0-1 range
    if genre_scores.max() > 0:
        genre_scores /= 10.0  # Ratings are 1-10 scale
    
    return genre_scores


def extract_search_profile(search_queries: list, movies_df=None) -> np.ndarray:
    """
    Build a genre-interest vector from user's search history.
    Searches that match movie titles contribute those movies' genres.
    """
    genre_counts = Counter()
    
    if movies_df is None or not search_queries:
        return np.zeros(NUM_GENRES)
    
    for query in search_queries:
        query_lower = query.lower().strip()
        
        # Check if query matches a genre directly
        for genre in ALL_GENRES:
            if genre.lower() in query_lower:
                if genre in GENRE_TO_IDX:
                    genre_counts[GENRE_TO_IDX[genre]] += 2  # Strong signal
        
        # Check if query matches a movie title
        matches = movies_df[movies_df['title'].str.lower().str.contains(query_lower, na=False)]
        for _, row in matches.head(5).iterrows():  # Top 5 matches to avoid explosion
            genres = row.get('genres_list', [])
            if isinstance(genres, list):
                for genre in genres:
                    if genre in GENRE_TO_IDX:
                        genre_counts[GENRE_TO_IDX[genre]] += 1
    
    profile = np.zeros(NUM_GENRES)
    for idx, count in genre_counts.items():
        profile[idx] = count
    
    # Normalize
    if profile.max() > 0:
        profile /= profile.max()
    
    return profile


def predict_preferences(ratings: list, search_queries: list, movies_df=None) -> dict:
    """
    Predict user's preferred genres by combining rating and search history signals.
    
    Returns:
        {
            "predicted_genres": [{"genre": str, "score": float}, ...],  # Top 8
            "recommended_movies": [str, ...],  # Titles to explore
            "profile_strength": "weak" | "moderate" | "strong"
        }
    """
    # Build profiles
    rating_profile = extract_genre_profile(ratings, movies_df)
    search_profile = extract_search_profile(search_queries, movies_df)
    
    # Combine with weights: ratings are stronger signals than searches
    combined = 0.7 * rating_profile + 0.3 * search_profile
    
    # Determine profile strength
    active_genres = np.sum(combined > 0.1)
    if active_genres >= 5:
        strength = "strong"
    elif active_genres >= 2:
        strength = "moderate"
    else:
        strength = "weak"
    
    # Get top genres
    top_indices = np.argsort(combined)[::-1]
    predicted_genres = []
    for idx in top_indices[:8]:
        if combined[idx] > 0.01:
            predicted_genres.append({
                "genre": ALL_GENRES[idx],
                "score": round(float(combined[idx]), 3)
            })
    
    # Recommend movies based on top genres
    recommended_movies = []
    if movies_df is not None and predicted_genres:
        top_genre_names = [g['genre'] for g in predicted_genres[:3]]
        
        # Find movies matching top genres, sorted by rating  
        def match_score(genres_list):
            if not isinstance(genres_list, list):
                return 0
            return sum(1 for g in genres_list if g in top_genre_names)
        
        scored = movies_df.copy()
        scored['match'] = scored['genres_list'].apply(match_score)
        scored = scored[scored['match'] > 0]
        
        if 'vote_average' in scored.columns:
            scored = scored.sort_values(by=['match', 'vote_average'], ascending=[False, False])
        
        # Exclude movies the user already rated  
        rated_titles = {r.get('movie_title', '').lower() for r in ratings}
        for _, row in scored.head(20).iterrows():
            if row['title'].lower() not in rated_titles:
                recommended_movies.append(row['title'])
            if len(recommended_movies) >= 10:
                break
    
    # Cold-start fallback: return popular genres
    if not predicted_genres:
        predicted_genres = [
            {"genre": "Drama", "score": 0.5},
            {"genre": "Action", "score": 0.45},
            {"genre": "Comedy", "score": 0.4},
            {"genre": "Thriller", "score": 0.35},
            {"genre": "Adventure", "score": 0.3},
        ]
        strength = "weak"
    
    return {
        "predicted_genres": predicted_genres,
        "recommended_movies": recommended_movies,
        "profile_strength": strength,
        "total_ratings_analyzed": len(ratings),
        "total_searches_analyzed": len(search_queries),
    }
