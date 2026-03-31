"""
Emotional Arc — VADER-based mood scoring, arc vector computation, and cosine similarity.

This module handles all mood/arc logic for the emotional recommendation engine.
It deliberately avoids any transformer models to stay within Render's 512 MB RAM limit.
"""

import numpy as np
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

# ── VADER Analyzer (singleton, ~2 MB) ────────────────────────────────────────
_analyzer = SentimentIntensityAnalyzer()


# ── 50 Preset Moods ─────────────────────────────────────────────────────────
MOOD_PRESETS = {
    "current": [
        "anxious", "melancholic", "restless", "numb", "nostalgic",
        "bored", "overwhelmed", "lonely", "frustrated", "exhausted",
        "confused", "sad", "angry", "hopeless", "disconnected",
        "nervous", "irritable", "grieving", "stuck", "empty",
    ],
    "desired": [
        "inspired", "calm", "hopeful", "energized", "cathartic",
        "joyful", "at peace", "motivated", "amused", "comforted",
        "moved", "uplifted", "reflective", "excited", "grateful",
        "confident", "focused", "curious", "cozy", "euphoric",
    ],
    "neutral": [
        "surprised", "nostalgic", "thoughtful", "philosophical", "tense",
        "wistful", "bittersweet", "awed", "playful", "emotional",
    ],
}

ALL_MOODS = MOOD_PRESETS["current"] + MOOD_PRESETS["desired"] + MOOD_PRESETS["neutral"]

# ── Popular moods shown as pill buttons (10 current + 10 desired) ────────────
POPULAR_CURRENT = MOOD_PRESETS["current"][:10]
POPULAR_DESIRED = MOOD_PRESETS["desired"][:10]


def score_text_vader(text: str) -> dict:
    """Score a text string with VADER and return neg/neu/pos/compound."""
    return _analyzer.polarity_scores(text)


def compute_vader_vector(text: str, num_segments: int = 10) -> np.ndarray:
    """
    Convert mood text into a 40-dim raw vector.

    Strategy: Score the same text 10 times with slight positional weighting
    to simulate an emotional arc across segments. Early segments emphasize
    the text's core sentiment, middle segments add neutral bias, late segments
    emphasize the mood's resolution.
    """
    base_scores = _analyzer.polarity_scores(text)
    raw = []

    for i in range(num_segments):
        position = i / (num_segments - 1)  # 0.0 → 1.0

        # Positional weighting: early=raw mood, mid=dampened, late=resolution
        if position < 0.3:
            weight = 1.0 - position * 0.5
        elif position < 0.7:
            weight = 0.85 + (position - 0.3) * 0.2
        else:
            weight = 0.89 + (position - 0.7) * 0.35

        neg = base_scores["neg"] * weight
        neu = base_scores["neu"] * (1.0 - 0.2 * abs(position - 0.5))
        pos = base_scores["pos"] * (0.6 + position * 0.4)
        compound = base_scores["compound"] * weight

        raw.extend([neg, neu, pos, compound])

    return np.array(raw, dtype=np.float32)


def compute_bridge_vector(current_text: str, desired_text: str) -> np.ndarray:
    """
    Compute the bridge vector: weighted blend of current and desired mood.
    Weights: current 30%, desired 70% (desired mood matters more).
    """
    current_vec = compute_vader_vector(current_text)
    desired_vec = compute_vader_vector(desired_text)
    return current_vec * 0.3 + desired_vec * 0.7


def map_arc_label(segment_scores: dict, position: str = "mid") -> str:
    """
    Map a single segment's VADER scores to a human-readable arc label.

    position: "early" | "mid" | "late" — affects label choice for positive arcs.
    """
    compound = segment_scores.get("compound", 0)
    neg = segment_scores.get("neg", 0)
    neu = segment_scores.get("neu", 0)
    pos = segment_scores.get("pos", 0)

    if compound > 0.5:
        return {"early": "joy", "mid": "triumph", "late": "peace"}.get(position, "triumph")
    elif compound < -0.5:
        return {"early": "despair", "mid": "tension", "late": "struggle"}.get(position, "tension")
    elif neu > 0.7:
        return {"early": "calm", "mid": "neutral", "late": "calm"}.get(position, "neutral")
    elif pos > neg:
        return {"early": "hope", "mid": "turning point", "late": "hope"}.get(position, "hope")
    elif neg > pos:
        return {"early": "conflict", "mid": "dread", "late": "conflict"}.get(position, "dread")
    else:
        return "neutral"


def map_arc_labels_from_vector(arc_vector_10: np.ndarray) -> list:
    """
    Convert a 10-dim PCA arc vector into 10 human-readable labels.
    Uses thresholds on the PCA components to determine labels.
    """
    labels = []
    for i, val in enumerate(arc_vector_10):
        if i < 3:
            position = "early"
        elif i < 7:
            position = "mid"
        else:
            position = "late"

        # Map PCA value to pseudo-VADER scores for labeling
        scores = {
            "compound": float(val),
            "neg": max(0, -float(val)),
            "pos": max(0, float(val)),
            "neu": max(0, 1.0 - abs(float(val))),
        }
        labels.append(map_arc_label(scores, position))
    return labels


def build_arc_explanation(labels: list) -> str:
    """
    Build a human-readable arc explanation from a list of 10 labels.
    E.g. "Starts in despair → struggles through tension → ends with hope"
    """
    if not labels:
        return ""

    # Deduplicate consecutive labels
    segments = []
    prev = None
    for label in labels:
        if label != prev:
            segments.append(label)
            prev = label

    if len(segments) == 1:
        return f"A consistent journey of {segments[0]}"

    parts = []
    parts.append(f"Starts in {segments[0]}")

    if len(segments) > 2:
        middle = segments[1:-1]
        if len(middle) == 1:
            parts.append(f"moves through {middle[0]}")
        else:
            parts.append(f"passes through {' → '.join(middle)}")

    parts.append(f"ends with {segments[-1]}")
    return " → ".join(parts)


def cosine_similarity_batch(target: np.ndarray, candidates: np.ndarray) -> np.ndarray:
    """
    Compute cosine similarity between a target vector and a batch of candidates.

    Args:
        target: shape (D,)
        candidates: shape (N, D)

    Returns:
        scores: shape (N,) with values in [-1, 1]
    """
    target = target.flatten()
    target_norm = np.linalg.norm(target)
    if target_norm == 0:
        return np.zeros(candidates.shape[0])

    candidate_norms = np.linalg.norm(candidates, axis=1)
    # Avoid division by zero
    candidate_norms = np.where(candidate_norms == 0, 1e-10, candidate_norms)

    scores = np.dot(candidates, target) / (candidate_norms * target_norm)
    return scores


def compute_mood_preset_vectors() -> dict:
    """
    Pre-compute 40-dim VADER vectors for all 50 preset moods.
    Returns a dict mapping mood name → list of floats.
    """
    result = {}
    for mood in ALL_MOODS:
        vec = compute_vader_vector(mood)
        result[mood] = vec.tolist()
    return result
