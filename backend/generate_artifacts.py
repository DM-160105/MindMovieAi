import pandas as pd
import numpy as np
import ast
from sklearn.feature_extraction.text import CountVectorizer
import pickle
import nltk
from nltk.stem.porter import PorterStemmer
import faiss
from hf_utils import get_dataset_file
from nltk.stem.porter import PorterStemmer
import faiss

try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

def convert(obj):
    if pd.isna(obj): return []
    L = []
    try:
        for i in ast.literal_eval(obj):
            L.append(i['name'])
    except:
        pass
    return L

def convert3(obj):
    if pd.isna(obj): return []
    L = []
    counter = 0
    try:
        for i in ast.literal_eval(obj):
            if counter != 3:
                L.append(i['name'])
                counter+=1
            else:
                break
    except:
        pass
    return L

def fetch_director(obj):
    if pd.isna(obj): return []
    L = []
    try:
        for i in ast.literal_eval(obj):
            if i['job'] == 'Director':
                L.append(i['name'])
                break
    except:
        pass
    return L

def collapse(L):
    L1 = []
    for i in L:
        L1.append(str(i).replace(" ",""))
    return L1

def stem_text(text):
    if pd.isna(text): return ""
    y = []
    for i in text.split():
        y.append(ps.stem(i))
    return " ".join(y)

ps = PorterStemmer()

def main():
    print("Loading TMDB data...")
    movies = pd.read_csv(get_dataset_file('tmdb_5000_movies.csv'))
    credits = pd.read_csv(get_dataset_file('tmdb_5000_credits.csv'))
    tmdb = movies.merge(credits, on='title')
    
    tmdb['genres_list'] = tmdb['genres'].apply(convert)
    tmdb['genres_c'] = tmdb['genres'].apply(convert).apply(collapse)
    tmdb['keywords_c'] = tmdb['keywords'].apply(convert).apply(collapse)
    tmdb['cast_c'] = tmdb['cast'].apply(convert3).apply(collapse)
    tmdb['crew_c'] = tmdb['crew'].apply(fetch_director).apply(collapse)
    tmdb['production_countries_list'] = tmdb['production_countries'].apply(convert)
    
    tmdb['overview_c'] = tmdb['overview'].fillna('').apply(lambda x: x.split())
    tmdb['tags'] = tmdb['overview_c'] + tmdb['genres_c'] + tmdb['keywords_c'] + tmdb['cast_c'] + tmdb['crew_c']
    tmdb['tags'] = tmdb['tags'].apply(lambda x: " ".join(x).lower())
    tmdb['year'] = pd.to_datetime(tmdb['release_date'], errors='coerce').dt.year
    
    tmdb_df = pd.DataFrame({
        'movie_id': tmdb['movie_id'],
        'title': tmdb['title'],
        'tags': tmdb['tags'],
        'year': tmdb['year'],
        'vote_average': tmdb['vote_average'],
        'original_language': tmdb['original_language'],
        'production_countries': tmdb['production_countries_list'],
        'genres_list': tmdb['genres_list'],
        'poster_url': None
    })
    
    print("Loading Bollywood data...")
    bolly = pd.read_csv(get_dataset_file('bollywoodmovies.csv'))
    bolly['genres_list'] = bolly['genres'].fillna('').apply(lambda x: x.split('|'))
    bolly['genres_c'] = bolly['genres_list'].apply(collapse)
    bolly['cast_c'] = bolly['actors'].fillna('').apply(lambda x: x.split('|')).apply(collapse)
    bolly['overview_c'] = bolly['story'].fillna('').apply(lambda x: x.split())
    bolly['tags'] = bolly['overview_c'] + bolly['genres_c'] + bolly['cast_c']
    bolly['tags'] = bolly['tags'].apply(lambda x: " ".join(x).lower())
    
    bolly_df = pd.DataFrame({
        'movie_id': bolly['imdb_id'], # Use imdb_id as movie_id
        'title': bolly['title_x'],
        'tags': bolly['tags'],
        'year': bolly['year_of_release'],
        'vote_average': bolly['imdb_rating'],
        'original_language': 'hi',
        'production_countries': bolly['title_x'].apply(lambda x: ["India"]),
        'genres_list': bolly['genres_list'],
        'poster_url': bolly['poster_path']
    })
    
    # Filter out empty titles or IDs
    bolly_df = bolly_df.dropna(subset=['movie_id', 'title', 'tags'])

    print("Loading Anime data...")
    anime = pd.read_csv(get_dataset_file('anime-dataset-2023.csv'))
    anime['genres_list'] = anime['Genres'].fillna('').apply(lambda x: [g.strip() for g in x.split(',')])
    anime['genres_c'] = anime['genres_list'].apply(collapse)
    anime['overview_c'] = anime['Synopsis'].fillna('').apply(lambda x: x.split())
    anime['tags'] = anime['overview_c'] + anime['genres_c']
    anime['tags'] = anime['tags'].apply(lambda x: " ".join(x).lower())
    
    # Extract year from Aired. Usually e.g. "Apr 3, 1998 to Apr 24, 1999"
    anime['year'] = anime['Aired'].str.extract(r'(\d{4})').astype(float)
    
    # Keep only anime with valid tags and IDs
    anime_df = pd.DataFrame({
        'movie_id': anime['anime_id'].apply(lambda x: f"anime_{x}"),
        'title': anime['Name'],
        'tags': anime['tags'],
        'year': anime['year'],
        'vote_average': pd.to_numeric(anime['Score'], errors='coerce') / 2, # Normalize to 5 stars if Score is out of 10. Wait, TMDB is out of 10. 
        # TMDB vote_average is out of 10! Score is out of 10. No division needed.
        # Wait, let me check TMDB's vote_average
        'original_language': 'ja',
        'production_countries': anime['Name'].apply(lambda x: ["Japan"]),
        'genres_list': anime['genres_list'],
        'poster_url': anime['Image URL']
    })
    
    anime_df['vote_average'] = pd.to_numeric(anime['Score'], errors='coerce') 
    
    print("Merging all datasets...")
    # Add an origin column to know which dataset it came from
    tmdb_df['origin'] = 'tmdb'
    bolly_df['origin'] = 'bollywood'
    anime_df['origin'] = 'anime'
    
    new_df = pd.concat([tmdb_df, bolly_df, anime_df], ignore_index=True)
    
    print("Stemming tags...")
    new_df['tags'] = new_df['tags'].apply(stem_text)
    
    print("Vectorizing...")
    # We increase max_features to 10000 since dataset is much bigger
    cv = CountVectorizer(max_features=10000, stop_words='english')
    vectors = cv.fit_transform(new_df['tags']).toarray()
    
    print("Building FAISS index...")
    vectors = vectors.astype(np.float32)
    faiss.normalize_L2(vectors)
    index = faiss.IndexFlatIP(vectors.shape[1])
    index.add(vectors)
    
    print("Saving artifacts...")
    import os
    if not os.path.exists('artifacts'):
        os.makedirs('artifacts')
    
    # Save movie_dict and index
    pickle.dump(new_df.to_dict(), open('artifacts/movie_dict.pkl', 'wb'))
    faiss.write_index(index, 'artifacts/movies.index')
    
    print("Done!")

if __name__ == "__main__":
    main()
