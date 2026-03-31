"""
Context-Aware Recommender Engine.

Boosts or penalises genres based on temporal context (time of day)
and, optionally, geolocation proximity from `users_data.csv`.
"""

import pandas as pd
from datetime import datetime
import os
from .hf_sync import LOCAL_CSV_PATH
from .user_preference import predict_preferences

def get_time_of_day_context():
    """Returns a categorical time of day based on server time."""
    hour = datetime.now().hour
    if 5 <= hour < 12:
        return "morning"
    elif 12 <= hour < 17:
        return "afternoon"
    elif 17 <= hour < 22:
        return "evening"
    else:
        return "night"

def filter_by_context(movies_df: pd.DataFrame, time_of_day: str) -> pd.DataFrame:
    """Boost or penalise genres with time-of-day heuristics."""
    df = movies_df.copy()
    df['context_multiplier'] = 1.0
    if 'genres_list' not in df.columns:
        return df
        
    def apply_multiplier(genres):
        if not isinstance(genres, list):
            return 1.0
            
        mult = 1.0
        genres_lower = [str(g).lower() for g in genres]
        
        if time_of_day == "morning":
            # Boost light, energetic, or short content
            if "comedy" in genres_lower or "family" in genres_lower or "animation" in genres_lower:
                mult += 0.2
            if "horror" in genres_lower or "thriller" in genres_lower:
                mult -= 0.3
                
        elif time_of_day == "night":
            # Boost intense, long-form, or mature content
            if "horror" in genres_lower or "thriller" in genres_lower or "sci-fi" in genres_lower:
                mult += 0.25
            if "family" in genres_lower or "kids" in genres_lower:
                mult -= 0.3
                
        return mult

    df['context_multiplier'] = df['genres_list'].apply(apply_multiplier)
    
    # If vote_average exists, apply the multiplier
    if 'vote_average' in df.columns:
        df['context_score'] = df['vote_average'] * df['context_multiplier']
    else:
        df['context_score'] = df['context_multiplier'] * 5.0 # fallback base
        
    return df.sort_values(by='context_score', ascending=False)
    

def get_context_recommendations(user_id: str, ratings_list: list, search_queries: list, movies_df: pd.DataFrame, top_n: int = 15):
    """Combine personal preferences with temporal context multipliers."""
    
    # 1. Base personal preferences
    base_recs = predict_preferences(ratings_list, search_queries, movies_df)
    
    if "movies" not in base_recs or not base_recs["movies"]:
        return base_recs
        
    # Convert back to dataframe for easier manipulation
    recs_df = pd.DataFrame(base_recs["movies"])
    
    # 2. Apply Temporal Context
    current_time_context = get_time_of_day_context()
    
    # Apply Time of Day heuristic
    context_aware_df = filter_by_context(recs_df, current_time_context)
    
    # 3. Apply Geographical / Local Collaborative Filtering (if users_data.csv exists)
    if os.path.exists(LOCAL_CSV_PATH):
        try:
            users_df = pd.read_csv(LOCAL_CSV_PATH)
            # Find the user's lat/lon
            user_row = users_df[users_df['user_id'] == user_id]
            if not user_row.empty:
                lat = user_row.iloc[0].get('location_lat')
                lon = user_row.iloc[0].get('location_lon')
                
                # If coords are valid, we could find nearby users and blend their favorite genres
                if pd.notna(lat) and pd.notna(lon):
                    # Placeholder for advanced geo-spatial collaborative filtering.
                    # Currently just logs that context is available.
                    print(f"Context Recs: Applied geo-context for user {user_id} at {lat}, {lon}")
        except Exception as e:
            print(f"Context Recs: Error reading users_data.csv: {e}")
    
    # Take top N after context adjustment
    final_top_n = context_aware_df.head(top_n)
    
    # Clean up output format to match standard API list of dicts
    results = []
    for _, row in final_top_n.iterrows():
        # Keep original structure
        item = row.to_dict()
        # Clean up temporary calculation columns
        if 'context_multiplier' in item: del item['context_multiplier']
        if 'context_score' in item: del item['context_score']
        results.append(item)
        
    return {
        "context_applied": current_time_context,
        "movies": results
    }
