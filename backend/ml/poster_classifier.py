"""
Poster Genre Classifier (Simulated CNN).

Provides a deterministic mock of a MobileNetV2-based poster classifier.
A real implementation would load a fine-tuned model; this simulation
uses URL hashing for reproducible predictions.
"""

import random
import time

ALL_GENRES = [
    "Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary",
    "Drama", "Family", "Fantasy", "History", "Horror", "Music", "Mystery",
    "Romance", "Science Fiction", "TV Movie", "Thriller", "War", "Western",
]


def analyze_poster_genres(image_url: str) -> dict:
    """Simulate CNN inference on a poster image and return genre predictions."""
    time.sleep(1.5)  # simulate model inference latency

    # Deterministic seed from URL for reproducible results
    random.seed(sum(ord(c) for c in image_url))
    num_predictions = random.choices([1, 2, 3], weights=[0.2, 0.6, 0.2])[0]
    predicted_genres = random.sample(ALL_GENRES, num_predictions)
    confidences = sorted(
        [round(random.uniform(0.65, 0.98), 2) for _ in range(num_predictions)],
        reverse=True,
    )

    return {
        "analyzed_image_url": image_url,
        "model_used": "MobileNetV2 (Simulated)",
        "predictions": [
            {"genre": g, "confidence_score": c}
            for g, c in zip(predicted_genres, confidences)
        ],
    }
