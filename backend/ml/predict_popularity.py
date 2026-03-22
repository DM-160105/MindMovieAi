import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import MultiLabelBinarizer
import pickle
import os
import json

def train_and_save_popularity_model(tmdb_movies_path: str, save_path: str):
    """
    Trains a Random Forest Regressor to predict revenue (as a proxy for popularity)
    based on budget, runtime, and genres.
    """
    if not os.path.exists(tmdb_movies_path):
        print("TMDB dataset not found. Cannot train model.")
        return False
        
    df = pd.read_csv(tmdb_movies_path)
    
    # Feature Engineering
    # We need: budget, runtime, and genres (one-hot encoded)
    # Target: revenue
    
    # Drop rows where target variable (revenue) or budget is 0 (missing data essentially)
    df = df[(df['revenue'] > 1000) & (df['budget'] > 1000)].copy()
    df = df.dropna(subset=['runtime', 'genres'])
    
    def parse_genres(genre_str):
        try:
            return [g['name'] for g in json.loads(genre_str)]
        except:
            return []
            
    df['parsed_genres'] = df['genres'].apply(parse_genres)
    
    mlb = MultiLabelBinarizer()
    genre_matrix = mlb.fit_transform(df['parsed_genres'])
    genre_df = pd.DataFrame(genre_matrix, columns=mlb.classes_, index=df.index)
    
    # Combine features
    X = pd.concat([df[['budget', 'runtime']], genre_df], axis=1)
    
    # We will predict log(revenue) since revenue spans orders of magnitude
    y = np.log1p(df['revenue'])
    
    # Train test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Train Model
    model = RandomForestRegressor(n_estimators=100, max_depth=15, random_state=42)
    model.fit(X_train, y_train)
    
    score = model.score(X_test, y_test)
    print(f"Model R^2 Score on Test Set: {score:.2f}")
    
    # Save the model and the fitted MultiLabelBinarizer (to process incoming requests)
    artifacts = {
        'model': model,
        'genre_binarizer': mlb,
        'expected_features': list(X.columns)
    }
    
    with open(save_path, 'wb') as f:
        pickle.dump(artifacts, f)
        
    print(f"Popularity model saved to {save_path}")
    return True

def load_and_predict(budget: float, runtime: float, genres: list, model_path: str):
    """
    Loads the trained model and predicts revenue.
    """
    if not os.path.exists(model_path):
        raise FileNotFoundError("Model not found. Please train it first.")
        
    with open(model_path, 'rb') as f:
        artifacts = pickle.load(f)
        
    model = artifacts['model']
    mlb = artifacts['genre_binarizer']
    features = artifacts['expected_features']
    
    # Process inputs
    genre_matrix = mlb.transform([genres])
    genre_df = pd.DataFrame(genre_matrix, columns=mlb.classes_)
    
    # Construct input dataframe matching exact training columns
    input_data = pd.DataFrame({"budget": [budget], "runtime": [runtime]})
    input_df = pd.concat([input_data, genre_df], axis=1)
    
    # Ensure all expected columns exist (fill missing genres with 0)
    for col in features:
        if col not in input_df.columns:
            input_df[col] = 0
            
    # Reorder to match training
    input_df = input_df[features]
    
    # Predict (remember it predicts log(revenue))
    log_pred = model.predict(input_df)[0]
    
    # Inverse log transform
    predicted_revenue = np.expm1(log_pred)
    
    return predicted_revenue

if __name__ == "__main__":
    # If run standalone, trait it.
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    tmdb_path = os.path.join(base_dir, 'data', 'tmdb_5000_movies.csv')
    save_p = os.path.join(base_dir, 'artifacts', 'popularity_model.pkl')
    train_and_save_popularity_model(tmdb_path, save_p)
