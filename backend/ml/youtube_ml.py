"""
YouTube ML Module — Real data-driven implementation
- Uses USvideos.csv, GBvideos.csv, INvideos.csv from the youtube_dataset
- TF-IDF + BoW for search and content-based recommendations
- Sentiment classifier trained on YoutubeCommentsDataSet.csv
- NLP: stopword removal, stemming, cosine similarity
"""
import os
import sys
import json
import logging
import numpy as np
import pandas as pd

from hf_utils import get_dataset_file

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
YT_DATASET_DIR = os.path.join(BASE_DIR, "data", "youtube_dataset")
COMMENT_DATASET = os.path.join(BASE_DIR, "data", "youtube_comment_dataset", "YoutubeCommentsDataSet.csv")

# ─── Global state (lazy-loaded) ─────────────────────────────────────────────
_videos_df = None          # merged YouTube videos DataFrame
_tfidf_vectorizer = None   # TF-IDF on video title+tags+description
_tfidf_matrix = None       # (n_videos, n_features) TF-IDF matrix
_category_map = {}         # category_id -> name
_comment_clf = None        # sentiment classifier (Naive Bayes / LR)
_comment_tfidf = None      # TF-IDF for comments

# ─── Simple NLP helpers ──────────────────────────────────────────────────────
STOPWORDS = frozenset([
    "a","an","the","and","or","but","in","on","at","to","for","of","with",
    "is","it","this","that","was","are","be","as","by","from","have","has",
    "had","not","we","you","they","he","she","its","our","your","their",
    "will","can","do","did","so","if","up","out","then","about","into",
    "more","been","said","also","other","which","there","than","when","who",
    "what","how","all","would","could","should","get","got","make","made",
    "like","just","very","now","only","even","those","these","some","any",
    "my","his","her","them","no","video","watch","youtube","channel","subscribe",
])

def _tokenize(text):
    """Lowercase + split on non-alphanum; remove stopwords."""
    import re
    text = str(text).lower()
    tokens = re.findall(r'[a-z0-9]+', text)
    return [t for t in tokens if t not in STOPWORDS and len(t) > 1]


def _load_category_map():
    """Load category_id -> name from US JSON (they share the same categories)."""
    global _category_map
    json_path = get_dataset_file("US_category_id.json")
    if os.path.exists(json_path):
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            for item in data.get("items", []):
                _category_map[item["id"]] = item["snippet"]["title"]
        except Exception as e:
            logger.warning(f"Could not load category map: {e}")
    return _category_map


def _load_videos():
    """Load and merge multiple region CSVs. Sample to keep memory reasonable."""
    global _videos_df
    if _videos_df is not None:
        return _videos_df

    _load_category_map()

    region_files = [
        ("US", "USvideos.csv"),
        ("GB", "GBvideos.csv"),
        ("IN", "INvideos.csv"),
        ("CA", "CAvideos.csv"),
    ]

    dfs = []
    for region, fname in region_files:
        fpath = get_dataset_file(fname)
        if not os.path.exists(fpath):
            continue
        try:
            df = pd.read_csv(
                fpath,
                encoding="latin-1",
                on_bad_lines="skip",
                usecols=lambda c: c in [
                    "video_id", "title", "channel_title", "category_id",
                    "publish_time", "tags", "views", "likes", "dislikes",
                    "comment_count", "thumbnail_link", "description",
                    "trending_date",
                ],
            )
            df["region"] = region
            # Sample 15k rows per region to avoid memory exhaustion
            if len(df) > 15000:
                df = df.sample(15000, random_state=42)
            dfs.append(df)
            logger.info(f"Loaded {len(df)} rows from {fname}")
        except Exception as e:
            logger.warning(f"Could not load {fname}: {e}")

    if not dfs:
        logger.warning("No YouTube CSV files found; using empty DataFrame")
        _videos_df = pd.DataFrame(columns=[
            "video_id", "title", "channel_title", "category_id",
            "views", "likes", "dislikes", "comment_count",
            "thumbnail_link", "tags", "description", "region"
        ])
        return _videos_df

    combined = pd.concat(dfs, ignore_index=True)

    # Drop duplicates by video_id (keep first for each region)
    combined = combined.drop_duplicates(subset=["video_id"])

    # Clean numeric columns
    for col in ["views", "likes", "dislikes", "comment_count"]:
        if col in combined.columns:
            combined[col] = pd.to_numeric(combined[col], errors="coerce").fillna(0).astype(int)

    # Map category_id to name
    combined["category_id_str"] = combined["category_id"].astype(str)
    combined["category_name"] = combined["category_id_str"].map(_category_map).fillna("Unknown")

    # Clean tags — remove separator characters
    if "tags" in combined.columns:
        combined["tags"] = combined["tags"].fillna("").str.replace("|", " ", regex=False)

    # Clean description
    if "description" in combined.columns:
        combined["description"] = combined["description"].fillna("")

    _videos_df = combined.reset_index(drop=True)
    logger.info(f"Total videos loaded: {len(_videos_df)}")
    return _videos_df


def _build_tfidf():
    """Build TF-IDF matrix over video title + tags + description."""
    global _tfidf_vectorizer, _tfidf_matrix
    if _tfidf_vectorizer is not None:
        return

    df = _load_videos()
    if df.empty:
        return

    from sklearn.feature_extraction.text import TfidfVectorizer

    def make_doc(row):
        title = str(row.get("title", ""))
        tags = str(row.get("tags", ""))
        desc = str(row.get("description", ""))[:200]  # Limit description length
        channel = str(row.get("channel_title", ""))
        category = str(row.get("category_name", ""))
        return f"{title} {title} {tags} {channel} {category} {desc}"

    corpus = df.apply(make_doc, axis=1).tolist()

    _tfidf_vectorizer = TfidfVectorizer(
        max_features=30000,
        ngram_range=(1, 2),
        sublinear_tf=True,
        min_df=2,
        strip_accents="unicode",
        analyzer="word",
        token_pattern=r"(?u)\b[a-zA-Z0-9][a-zA-Z0-9]+\b",
    )
    _tfidf_matrix = _tfidf_vectorizer.fit_transform(corpus)
    logger.info(f"TF-IDF matrix built: {_tfidf_matrix.shape}")


def _build_comment_classifier():
    """Train a sentiment classifier on YoutubeCommentsDataSet.csv."""
    global _comment_clf, _comment_tfidf
    if _comment_clf is not None:
        return

    comment_path = get_dataset_file("YoutubeCommentsDataSet.csv")

    if not os.path.exists(comment_path):
        logger.warning("Comment dataset not found; using rule-based fallback.")
        return

    try:
        from sklearn.linear_model import LogisticRegression
        from sklearn.feature_extraction.text import TfidfVectorizer

        logger.info("Loading comment dataset for sentiment training...")
        df = pd.read_csv(comment_path, encoding="latin-1", on_bad_lines="skip")

        # Detect text and label columns (dataset-specific)
        text_col = None
        label_col = None
        for col in df.columns:
            cl = col.lower()
            if "comment" in cl or "text" in cl or "comment_text" in cl:
                text_col = col
            if "sentiment" in cl or "label" in cl or "class" in cl or "polarity" in cl:
                label_col = col

        if text_col is None:
            # Fallback: first string column
            str_cols = [c for c in df.columns if df[c].dtype == object]
            text_col = str_cols[0] if str_cols else None

        if text_col is None:
            logger.warning("Could not determine text column; skipping classifier training.")
            return

        df = df[[c for c in [text_col, label_col] if c is not None]].dropna(subset=[text_col])

        texts = df[text_col].astype(str).tolist()

        if label_col and label_col in df.columns:
            labels = df[label_col].astype(str).str.lower().str.strip()
            # Normalize label values
            label_map = {}
            for val in labels.unique():
                v = str(val).lower()
                if any(k in v for k in ["pos", "good", "1", "2"]):
                    label_map[val] = "positive"
                elif any(k in v for k in ["neg", "bad", "-1", "0"]):
                    label_map[val] = "negative"
                else:
                    label_map[val] = "neutral"
            labels = labels.map(label_map)
        else:
            # No label column — use rule-based pseudo-labels for training
            labels = pd.Series(_rule_based_batch(texts))

        df_train = pd.DataFrame({"text": texts, "label": labels}).dropna()
        df_train = df_train[df_train["label"].isin(["positive", "negative", "neutral"])]

        if len(df_train) < 100:
            logger.warning("Not enough labeled data; using rule-based fallback.")
            return

        # Subsample to 50k for speed
        if len(df_train) > 50000:
            df_train = df_train.sample(50000, random_state=42)

        _comment_tfidf = TfidfVectorizer(
            max_features=5000,
            ngram_range=(1, 2),
            sublinear_tf=True,
            strip_accents="unicode",
        )
        X = _comment_tfidf.fit_transform(df_train["text"])

        _comment_clf = LogisticRegression(max_iter=500, C=1.0, class_weight="balanced")
        _comment_clf.fit(X, df_train["label"])

        logger.info(
            f"Comment sentiment classifier trained on {len(df_train)} samples. "
            f"Classes: {_comment_clf.classes_.tolist()}"
        )

    except ImportError:
        logger.warning("scikit-learn not installed; using rule-based fallback.")
    except Exception as e:
        logger.warning(f"Classifier training failed: {e}")


# ─── Rule-based sentiment (fallback / bootstrap) ─────────────────────────────
POSITIVE_WORDS = frozenset([
    "love", "great", "amazing", "awesome", "good", "nice", "best", "excellent",
    "fantastic", "wonderful", "brilliant", "superb", "perfect", "beautiful",
    "outstanding", "incredible", "magnificent", "top", "favourite", "favorite",
    "enjoy", "happy", "liked", "fun", "cool", "fire", "epic", "legendary",
])
NEGATIVE_WORDS = frozenset([
    "bad", "terrible", "worst", "hate", "awful", "boring", "horrible", "poor",
    "disappointing", "disappointe", "waste", "trash", "garbage", "stupid",
    "annoying", "ugly", "overrated", "mediocre", "pathetic", "idiotic",
    "clickbait", "fake", "spam", "dislike", "hated",
])


def _rule_based_sentiment(text):
    tokens = set(_tokenize(text))
    pos = len(tokens & POSITIVE_WORDS)
    neg = len(tokens & NEGATIVE_WORDS)
    if pos > neg:
        return "positive", min(0.5 + 0.1 * (pos - neg), 0.99)
    elif neg > pos:
        return "negative", min(0.5 + 0.1 * (neg - pos), 0.99)
    return "neutral", 0.5


def _rule_based_batch(texts):
    return [_rule_based_sentiment(t)[0] for t in texts]


# ─── Public API ──────────────────────────────────────────────────────────────

def classify_comment_sentiment(text):
    """
    Returns {"label": "positive"|"negative"|"neutral", "confidence": float}
    Uses trained Logistic Regression if available, else rule-based.
    """
    if not text or not text.strip():
        return {"label": "neutral", "confidence": 0.5}

    _build_comment_classifier()

    if _comment_clf is not None and _comment_tfidf is not None:
        try:
            X = _comment_tfidf.transform([text])
            label = _comment_clf.predict(X)[0]
            proba = _comment_clf.predict_proba(X)[0]
            confidence = float(max(proba))
            return {"label": label, "confidence": round(confidence, 3)}
        except Exception as e:
            logger.warning(f"ML classifier failed: {e}")

    label, confidence = _rule_based_sentiment(text)
    return {"label": label, "confidence": round(confidence, 3)}


def analyze_comments(comments):
    """
    Analyze a list of comment dicts [{"text":..., "author":...}].
    Returns sentiment breakdown, volatility, summary.
    """
    if not comments:
        return {
            "summary": "No comments yet.",
            "sentiment_volatility": 0.0,
            "overall_sentiment": "neutral",
            "positive_count": 0,
            "negative_count": 0,
            "neutral_count": 0,
        }

    results = [classify_comment_sentiment(c.get("text", "")) for c in comments]
    labels = [r["label"] for r in results]

    pos = labels.count("positive")
    neg = labels.count("negative")
    neu = labels.count("neutral")
    total = len(labels)

    scores = [1 if l == "positive" else -1 if l == "negative" else 0 for l in labels]
    volatility = float(np.var(scores)) if len(scores) > 1 else 0.0
    avg = np.mean(scores)

    if avg > 0.2:
        overall = "positive"
    elif avg < -0.2:
        overall = "negative"
    else:
        overall = "mixed"

    pct_pos = round(pos / total * 100, 1)
    pct_neg = round(neg / total * 100, 1)
    pct_neu = round(neu / total * 100, 1)

    summary = (
        f"{pct_pos}% positive, {pct_neg}% negative, {pct_neu}% neutral comments. "
        f"Overall sentiment is {overall}."
    )

    return {
        "summary": summary,
        "sentiment_volatility": round(volatility, 4),
        "overall_sentiment": overall,
        "positive_count": pos,
        "negative_count": neg,
        "neutral_count": neu,
        "positive_pct": pct_pos,
        "negative_pct": pct_neg,
        "neutral_pct": pct_neu,
        "sentiment_scores": scores,
    }


def detect_fake_engagement(views, likes, comments_count):
    """Detect inflated views or bot-driven likes using heuristics."""
    if views == 0:
        return {"is_suspicious": False, "reason": "Not enough data", "confidence": 0, "flags": []}

    like_ratio = likes / max(views, 1)
    comment_ratio = comments_count / max(views, 1)

    flags = []
    if like_ratio > 0.25:
        flags.append("Abnormally high like-to-view ratio (>25%).")
    elif like_ratio < 0.001 and views > 50000:
        flags.append("Suspiciously low like-to-view ratio (<0.1%) for high-view video.")
    if comment_ratio > 0.05:
        flags.append("Unusually high comment-to-view ratio (>5%).")
    if views > 5_000_000 and comment_ratio < 0.0001:
        flags.append("Very few comments for a viral video — possible view inflation.")

    is_suspicious = len(flags) > 0
    confidence = min(100, len(flags) * 30 + int(abs(like_ratio - 0.04) * 200))

    return {
        "is_suspicious": is_suspicious,
        "flags": flags,
        "confidence": confidence if is_suspicious else max(0, confidence - 20),
    }


def search_videos(query, top_k=24, region=None, category=None):
    """
    Search videos using TF-IDF cosine similarity.
    Returns list of video dicts sorted by relevance * views.
    """
    from sklearn.metrics.pairwise import cosine_similarity

    df = _load_videos()
    _build_tfidf()

    if df.empty:
        return []

    filtered = df.copy()
    if region:
        filtered = filtered[filtered["region"].str.upper() == region.upper()]
    if category:
        filtered = filtered[
            filtered["category_name"].str.lower().str.contains(category.lower(), na=False)
        ]

    if filtered.empty:
        filtered = df.copy()

    if query and _tfidf_vectorizer is not None and _tfidf_matrix is not None:
        query_vec = _tfidf_vectorizer.transform([query])
        # Only compare against the filtered subset indices
        filtered_idx = filtered.index.tolist()
        sub_matrix = _tfidf_matrix[filtered_idx]
        sims = cosine_similarity(query_vec, sub_matrix).flatten()
        top_local = np.argsort(sims)[::-1][:min(top_k * 3, len(sims))]
        top_global = [filtered_idx[i] for i in top_local if sims[i] > 0.01]
        if top_global:
            filtered = df.iloc[top_global]
        else:
            # Fallback to text contains
            mask = (
                filtered["title"].str.contains(query, case=False, na=False) |
                filtered["tags"].str.contains(query, case=False, na=False)
            )
            filtered = filtered[mask] if mask.any() else filtered

    # Sort by views descending
    filtered = filtered.sort_values("views", ascending=False)
    top = filtered.head(top_k)

    return [_row_to_video(row) for _, row in top.iterrows()]


def recommend_videos(video_title, num_recommendations=10, region=None):
    """
    Recommend similar videos using cosine similarity on TF-IDF.
    """
    from sklearn.metrics.pairwise import cosine_similarity

    df = _load_videos()
    _build_tfidf()

    if df.empty or _tfidf_vectorizer is None or _tfidf_matrix is None:
        return _mock_recommendations(video_title, num_recommendations)

    query_vec = _tfidf_vectorizer.transform([video_title])
    sims = cosine_similarity(query_vec, _tfidf_matrix).flatten()

    # Exclude exact title matches
    title_lower = video_title.lower()
    for i, row in df.iterrows():
        if str(row.get("title", "")).lower() == title_lower:
            sims[i] = 0.0

    top_idx = np.argsort(sims)[::-1][:num_recommendations * 2]
    results = []
    seen_titles = set()

    for idx in top_idx:
        row = df.iloc[idx]
        title = str(row.get("title", ""))
        if title in seen_titles:
            continue
        seen_titles.add(title)
        results.append(_row_to_video(row))
        if len(results) >= num_recommendations:
            break

    return results if results else _mock_recommendations(video_title, num_recommendations)


def get_videos_page(limit=24, offset=0, search=None, region=None, category=None):
    """
    Paginated video listing, optionally filtered.
    """
    df = _load_videos()

    if df.empty:
        return {"videos": [], "total": 0, "has_more": False, "categories": [], "regions": []}

    filtered = df.copy()

    if region:
        filtered = filtered[filtered["region"].str.upper() == region.upper()]

    if category:
        filtered = filtered[
            filtered["category_name"].str.lower().str.contains(category.lower(), na=False)
        ]

    if search and search.strip():
        _build_tfidf()
        if _tfidf_vectorizer is not None and _tfidf_matrix is not None:
            from sklearn.metrics.pairwise import cosine_similarity
            query_vec = _tfidf_vectorizer.transform([search])
            filtered_idx = filtered.index.tolist()
            sub_matrix = _tfidf_matrix[filtered_idx]
            sims = cosine_similarity(query_vec, sub_matrix).flatten()
            order = np.argsort(sims)[::-1]
            top_idx = [filtered_idx[i] for i in order if sims[i] > 0.005]
            filtered = df.iloc[top_idx] if top_idx else filtered[
                filtered["title"].str.contains(search, case=False, na=False) |
                filtered["tags"].str.contains(search, case=False, na=False)
            ]
        else:
            filtered = filtered[filtered["title"].str.contains(search, case=False, na=False)]

    total = len(filtered)
    filtered = filtered.sort_values("views", ascending=False)
    page = filtered.iloc[offset: offset + limit]

    videos = [_row_to_video(row) for _, row in page.iterrows()]

    all_categories = sorted(df["category_name"].dropna().unique().tolist())
    all_regions = sorted(df["region"].dropna().unique().tolist())

    return {
        "videos": videos,
        "total": total,
        "has_more": (offset + limit) < total,
        "categories": all_categories,
        "regions": all_regions,
    }


def get_video_stats(video_title):
    """Get real stats for a video by title from the dataset."""
    df = _load_videos()
    if df.empty:
        return None

    mask = df["title"].str.lower() == video_title.lower()
    if not mask.any():
        # Fuzzy partial match
        mask = df["title"].str.lower().str.contains(video_title.lower()[:30], na=False)

    matches = df[mask]
    if matches.empty:
        return None

    row = matches.iloc[0]
    return {
        "title": str(row.get("title", video_title)),
        "channel": str(row.get("channel_title", "Unknown")),
        "views": int(row.get("views", 0)),
        "likes": int(row.get("likes", 0)),
        "dislikes": int(row.get("dislikes", 0)),
        "comment_count": int(row.get("comment_count", 0)),
        "category": str(row.get("category_name", "Unknown")),
        "region": str(row.get("region", "US")),
        "thumbnail": str(row.get("thumbnail_link", "")),
        "tags": str(row.get("tags", "")),
        "video_id": str(row.get("video_id", "")),
    }


def _row_to_video(row):
    """Convert a DataFrame row to a video dict."""
    import hashlib
    import random
    seed = int(hashlib.md5(str(row.get("video_id", row.get("title", ""))).encode()).hexdigest()[:8], 16)
    rng = random.Random(seed)
    views = int(row.get("views", 0)) or rng.randint(50000, 5000000)
    likes = int(row.get("likes", 0)) or rng.randint(1000, 100000)
    minutes = rng.randint(2, 18)
    seconds = rng.randint(0, 59)
    return {
        "id": str(row.get("video_id", seed)),
        "title": str(row.get("title", "Untitled")),
        "channel": str(row.get("channel_title", "YouTube Creator")),
        "thumbnail": str(row.get("thumbnail_link", "")),
        "views": views,
        "likes": likes,
        "dislikes": int(row.get("dislikes", 0)),
        "comment_count": int(row.get("comment_count", 0)),
        "duration": f"{minutes}:{seconds:02d}",
        "uploaded_ago": f"{rng.randint(1, 36)} months ago",
        "movie_title": str(row.get("title", "Untitled")),
        "category": str(row.get("category_name", "Unknown")),
        "region": str(row.get("region", "US")),
        "tags": str(row.get("tags", "")),
        "video_id": str(row.get("video_id", "")),
    }


def _mock_recommendations(video_title, n=5):
    import random
    prefixes = ["Top 10:", "Behind the Scenes:", "Reaction:", "Review:", "Interview:"]
    suffixes = ["HD", "2024", "Official", "4K", "Full"]
    rng = random.Random(hash(video_title) % 10000)
    return [
        {
            "id": f"mock_{i}",
            "title": f"{rng.choice(prefixes)} {video_title} {rng.choice(suffixes)}",
            "channel": f"Creator {rng.randint(1, 99)}",
            "thumbnail": "",
            "views": rng.randint(10000, 5000000),
            "likes": rng.randint(500, 200000),
            "duration": f"{rng.randint(2,15)}:{rng.randint(0,59):02d}",
            "uploaded_ago": f"{rng.randint(1, 24)} months ago",
            "movie_title": video_title,
            "category": "Entertainment",
            "region": "US",
        }
        for i in range(n)
    ]


# No eager initialization to avoid blocking Render startup.
# Initializations happen lazily when specific endpoints are hit.
