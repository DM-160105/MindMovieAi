from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import random

analyzer = SentimentIntensityAnalyzer()

# A curated list of mock reviews to simulate scraping since we don't have live API keys right now.
MOCK_REVIEWS_POSITIVE = [
    "Absolutely breathtaking! The cinematography and acting were top notch.",
    "A masterpiece. Kept me on the edge of my seat the whole time.",
    "Loved every second of it. Highly recommend to everyone.",
    "Such a beautiful story with incredible character development.",
    "One of the best movies of the year hands down."
]

MOCK_REVIEWS_MIXED = [
    "It was okay, but the pacing felt really slow in the middle.",
    "Great visuals but the plot was a bit confusing and hard to follow.",
    "An interesting concept, though the execution could have been better.",
    "Decent watch for a weekend, not the best but not the worst.",
    "Good acting, but the ending felt very rushed."
]

MOCK_REVIEWS_NEGATIVE = [
    "Terrible waste of time. I fell asleep halfway through.",
    "The dialogue was extremely cringeworthy and the plot made no sense.",
    "Awful special effects and wooden acting. Do not watch.",
    "Complete garbage. I want my money back.",
    "So boring and predictable. Avoid at all costs."
]

def generate_mock_reviews_for_movie(title: str, rating: float):
    """
    Generates a list of mock reviews tailored slightly to the movie's overall rating
    to make the sentiment analysis look realistic.
    """
    num_reviews = random.randint(15, 30)
    reviews = []
    
    # Skew the distribution of reviews based on the TMDB rating
    if rating >= 7.5:
        weights = [0.7, 0.2, 0.1] # Mostly positive
    elif rating >= 5.5:
        weights = [0.3, 0.5, 0.2] # Mixed
    else:
        weights = [0.1, 0.3, 0.6] # Mostly negative
        
    for _ in range(num_reviews):
        choice = random.choices(["pos", "mix", "neg"], weights=weights)[0]
        if choice == "pos":
            reviews.append(random.choice(MOCK_REVIEWS_POSITIVE))
        elif choice == "mix":
            reviews.append(random.choice(MOCK_REVIEWS_MIXED))
        else:
            reviews.append(random.choice(MOCK_REVIEWS_NEGATIVE))
            
    return reviews


def analyze_movie_sentiment(title: str, rating: float = 7.0):
    """
    Analyzes a batch of reviews for a movie using VADER and returns the aggregate score.
    Returns percentages for Positive, Neutral, and Negative sentiments.
    """
    reviews = generate_mock_reviews_for_movie(title, rating)
    
    total_pos = 0
    total_neu = 0
    total_neg = 0
    count = len(reviews)
    
    for review in reviews:
        score = analyzer.polarity_scores(review)
        # VADER returns 'compound', 'pos', 'neu', 'neg'
        # We'll categorize based on the compound score
        compound = score['compound']
        
        if compound >= 0.05:
            total_pos += 1
        elif compound <= -0.05:
            total_neg += 1
        else:
            total_neu += 1
            
    return {
        "positive_percent": round((total_pos / count) * 100, 1),
        "neutral_percent": round((total_neu / count) * 100, 1),
        "negative_percent": round((total_neg / count) * 100, 1),
        "total_reviews_analyzed": count,
        "sample_reviews": reviews[:3] # Return a few to display on the frontend
    }
