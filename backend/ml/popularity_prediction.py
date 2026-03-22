import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import MultiLabelBinarizer
import numpy as np
import pickle
import os

class PopularityPredictor:
    def __init__(self, data_path="datasets/tmdb_5000_movies.csv"):
        self.data_path = data_path
        self.model = RandomForestRegressor(n_estimators=50, random_state=42)
        self.mlb = MultiLabelBinarizer()
        self.is_trained = False
        
    def _extract_genres(self, genres_json):
        try:
            import ast
            genres = ast.literal_eval(genres_json)
            return [g['name'] for g in genres]
        except:
            return []

    def load_and_preprocess(self):
        try:
            df = pd.read_csv(self.data_path)
            if 'revenue' not in df.columns or 'budget' not in df.columns:
                return None
            
            # Simple feature extraction
            df['genre_list'] = df['genres'].apply(self._extract_genres)
            genre_encoded = pd.DataFrame(self.mlb.fit_transform(df['genre_list']), columns=self.mlb.classes_, index=df.index)
            
            # Combine
            features = pd.concat([df[['budget']], genre_encoded], axis=1).fillna(0)
            target = df['revenue']
            
            return features, target
        except Exception as e:
            print(f"Error loading data: {e}")
            return None, None

    def train(self):
        X, y = self.load_and_preprocess()
        if X is not None and y is not None:
            self.model.fit(X, y)
            self.is_trained = True
            
            # Save artifacts
            with open("models/popularity_model.pkl", "wb") as f:
                pickle.dump(self.model, f)
            with open("models/mlb_encoder.pkl", "wb") as f:
                pickle.dump(self.mlb, f)
            print("Successfully trained and saved popularity prediction model.")
            return True
        return False

    def predict_revenue(self, budget, genres):
        """
        genres: list of strings (e.g. ['Action', 'Adventure'])
        budget: float/int
        """
        if not self.is_trained:
            # Try to load
            try:
                with open("models/popularity_model.pkl", "rb") as f:
                    self.model = pickle.load(f)
                with open("models/mlb_encoder.pkl", "rb") as f:
                    self.mlb = pickle.load(f)
                self.is_trained = True
            except FileNotFoundError:
                print("Model not trained and no saved model found.")
                return 0
                
        # Transform input
        genre_encoded = self.mlb.transform([genres])
        features = pd.DataFrame(genre_encoded, columns=self.mlb.classes_)
        features.insert(0, 'budget', budget)
        
        # Missing columns handled by filling 0
        prediction = self.model.predict(features)
        return float(prediction[0])

if __name__ == "__main__":
    predictor = PopularityPredictor()
    predictor.train()
