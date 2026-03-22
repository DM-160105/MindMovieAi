import random
import time

# In a real-world scenario, we would import TensorFlow/Keras and load a pre-trained CNN model
# like ResNet50 or MobileNetV2 fine-tuned on the Movie Poster Dataset.
# Due to the lack of GPU and the massive size of these models/datasets, we provide a 
# deterministic mock that fakes a neural network inference time and returns plausible genres 
# based on a hash of the image URL to keep answers consistent per image.

ALL_GENRES = [
    "Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary", "Drama",
    "Family", "Fantasy", "History", "Horror", "Music", "Mystery", "Romance",
    "Science Fiction", "TV Movie", "Thriller", "War", "Western"
]

def analyze_poster_genres(image_url: str):
    """
    Simulates a Convolutional Neural Network (CNN) analyzing a movie poster image
    to classify its genres.
    """
    # Simulate network latency and model inference time (CNNs take a moment)
    time.sleep(1.5)
    
    # Use the image URL string to seed the random generator so the same poster
    # always yields the exact same "predictions" (simulating a deterministic model).
    seed_val = sum([ord(char) for char in image_url])
    random.seed(seed_val)
    
    # Decide how many genres to predict (usually 1 to 3)
    num_predictions = random.choices([1, 2, 3], weights=[0.2, 0.6, 0.2])[0]
    
    # Pick random genres
    predicted_genres = random.sample(ALL_GENRES, num_predictions)
    
    # Generate fake confidence scores (softmax probabilities) for the top predictions
    confidences = [round(random.uniform(0.65, 0.98), 2) for _ in range(num_predictions)]
    confidences.sort(reverse=True) # Highest confidence first
    
    results = []
    for genre, conf in zip(predicted_genres, confidences):
        results.append({
            "genre": genre,
            "confidence_score": conf
        })
        
    return {
        "analyzed_image_url": image_url,
        "model_used": "MobileNetV2 (Simulated)",
        "predictions": results
    }
