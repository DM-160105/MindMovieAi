import os
import sys
import pickle
import base64
import logging
import numpy as np
from sklearn.decomposition import PCA
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ml.mood_arc import (
    compute_mood_preset_vectors,
    ALL_MOODS,
    MOOD_PRESETS,
    POPULAR_CURRENT,
    POPULAR_DESIRED,
)
from seed_arc import compute_raw_arc_vector, compute_arc_labels, get_db

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

def fix_seed():
    db = get_db()
    arc_movies_col = db["arc_movies"]
    arc_config_col = db["arc_config"]

    logger.info("Loading existing movies from arc_movies...")
    movies = list(arc_movies_col.find({}))
    if not movies:
        logger.error("No movies found in arc_movies. Exiting.")
        return

    logger.info(f"Loaded {len(movies)} movies. Recomputing raw vectors using VADER...")
    analyzer = SentimentIntensityAnalyzer()
    
    raw_vectors = []
    for doc in movies:
        overview = doc.get("overview", "")
        raw_vec = compute_raw_arc_vector(overview, analyzer)
        arc_labels = compute_arc_labels(overview, analyzer)
        raw_vectors.append(raw_vec)
        
        # In-memory update
        doc["arc_labels"] = arc_labels
        doc["raw_vector"] = raw_vec

    logger.info("Fitting PCA (40 → 10 dimensions)...")
    raw_matrix = np.array(raw_vectors, dtype=np.float32)
    pca = PCA(n_components=10)
    arc_matrix = pca.fit_transform(raw_matrix)
    
    explained_var = float(pca.explained_variance_ratio_.sum())
    logger.info(f"Explained variance: {explained_var:.2%}")

    logger.info("Updating arc_vectors in MongoDB...")
    for i, doc in enumerate(movies):
        arc_vec = arc_matrix[i].tolist()
        arc_movies_col.update_one(
            {"_id": doc["_id"]},
            {"$set": {"arc_vector": arc_vec, "arc_labels": doc["arc_labels"]}}
        )

    logger.info("Saving PCA model and mood presets to `arc_config`...")
    arc_config_col.drop()

    pca_bytes = pickle.dumps(pca)
    pca_b64 = base64.b64encode(pca_bytes).decode("utf-8")

    mood_vectors = compute_mood_preset_vectors()

    arc_config_col.insert_one({
        "_id": "pca_model",
        "data": pca_b64,
        "n_components": 10,
        "explained_variance": explained_var,
    })

    arc_config_col.insert_one({
        "_id": "mood_presets",
        "presets": MOOD_PRESETS,
        "all_moods": ALL_MOODS,
        "popular_current": POPULAR_CURRENT,
        "popular_desired": POPULAR_DESIRED,
        "vectors": mood_vectors,
    })

    logger.info("✅ Fix complete!")

if __name__ == "__main__":
    fix_seed()
