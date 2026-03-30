from __future__ import annotations
"""
VADER Sentiment Analysis for Movie Reviews.

Generates rating-skewed mock reviews and aggregates VADER compound scores
into positive / neutral / negative percentages.
"""

import random

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

analyzer = SentimentIntensityAnalyzer()

# ── Mock Review Pools ────────────────────────────────────────────────────────
_POSITIVE = [
    "Absolutely breathtaking! The cinematography and acting were top notch.",
    "A masterpiece. Kept me on the edge of my seat the whole time.",
    "Loved every second of it. Highly recommend to everyone.",
    "Such a beautiful story with incredible character development.",
    "One of the best movies of the year hands down.",
]

_MIXED = [
    "It was okay, but the pacing felt really slow in the middle.",
    "Great visuals but the plot was a bit confusing and hard to follow.",
    "An interesting concept, though the execution could have been better.",
    "Decent watch for a weekend, not the best but not the worst.",
    "Good acting, but the ending felt very rushed.",
]

_NEGATIVE = [
    "Terrible waste of time. I fell asleep halfway through.",
    "The dialogue was extremely cringeworthy and the plot made no sense.",
    "Awful special effects and wooden acting. Do not watch.",
    "Complete garbage. I want my money back.",
    "So boring and predictable. Avoid at all costs.",
]


def generate_mock_reviews_for_movie(title: str, rating: float) -> list[str]:
    """Generate rating-skewed mock reviews for demonstration purposes."""
    num_reviews = random.randint(15, 30)

    if rating >= 7.5:
        weights = [0.7, 0.2, 0.1]
    elif rating >= 5.5:
        weights = [0.3, 0.5, 0.2]
    else:
        weights = [0.1, 0.3, 0.6]

    pools = {"pos": _POSITIVE, "mix": _MIXED, "neg": _NEGATIVE}
    reviews = []
    for _ in range(num_reviews):
        bucket = random.choices(["pos", "mix", "neg"], weights=weights)[0]
        reviews.append(random.choice(pools[bucket]))

    return reviews


def analyze_movie_sentiment(title: str, rating: float = 7.0) -> dict:
    """Aggregate VADER sentiment scores across generated movie reviews."""
    reviews = generate_mock_reviews_for_movie(title, rating)
    pos = neu = neg = 0

    for review in reviews:
        compound = analyzer.polarity_scores(review)["compound"]
        if compound >= 0.05:
            pos += 1
        elif compound <= -0.05:
            neg += 1
        else:
            neu += 1

    count = len(reviews)
    return {
        "positive_percent": round(pos / count * 100, 1),
        "neutral_percent": round(neu / count * 100, 1),
        "negative_percent": round(neg / count * 100, 1),
        "total_reviews_analyzed": count,
        "sample_reviews": reviews[:3],
    }
