import pandas as pd
from sklearn.ensemble import IsolationForest
import numpy as np

# Global variable to store our trained model in memory for fast inference
_engagement_model = None

def train_fake_engagement_model(ratings_dataframe: pd.DataFrame):
    """
    Trains an Isolation Forest model to detect anomalous rating behavior.
    Features extracted per user:
    - Number of ratings given
    - Average rating value
    - Variance of rating value (if they only ever give 1s or 5s, variance is low)
    """
    global _engagement_model
    
    if ratings_dataframe.empty or len(ratings_dataframe) < 10:
        # Not enough data to train an anomaly detector
        return False
        
    # Aggregate features per user
    user_stats = ratings_dataframe.groupby('user_id').agg(
        num_ratings=('rating', 'count'),
        avg_rating=('rating', 'mean'),
        var_rating=('rating', lambda x: np.var(x) if len(x) > 1 else 0.0)
    ).reset_index()
    
    # Feature matrix: [num_ratings, avg_rating, var_rating]
    X = user_stats[['num_ratings', 'avg_rating', 'var_rating']].fillna(0)
    
    # Isolation forest assumes around 5% of users might be bots/spam
    model = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
    model.fit(X)
    
    # Store the user behavior classification mapping
    user_stats['is_anomalous'] = model.predict(X)
    # predict returns -1 for outliers and 1 for inliers. Let's convert to boolean.
    user_stats['is_fake'] = user_stats['is_anomalous'] == -1
    
    # Save a dictionary mapping user_id -> is_fake
    _engagement_model = dict(zip(user_stats['user_id'], user_stats['is_fake']))
    
    return True


def is_user_fake(user_id: int) -> bool:
    """
    Checks if a given user_id has been flagged as fake/bot behavior.
    If the model isn't trained yet or user isn't found, defaults to False (innocent until proven guilty).
    """
    if _engagement_model is None:
        return False
        
    return _engagement_model.get(user_id, False)

def fetch_clean_ratings(ratings_dataframe: pd.DataFrame) -> pd.DataFrame:
    """
    Returns the ratings dataframe with all suspected fake users removed.
    """
    if _engagement_model is None or ratings_dataframe.empty:
        return ratings_dataframe
        
    # Keep only users that are NOT in the fake dictionary or have 'False' attached to them
    def check_fake(u_id):
        return is_user_fake(u_id)
        
    filtered = ratings_dataframe[~ratings_dataframe['user_id'].apply(check_fake)]
    return filtered
