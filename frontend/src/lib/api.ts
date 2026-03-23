import axios from 'axios';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Inject JWT token from localStorage on every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('stremflix_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const loginUser = (username: string, password: string) =>
  api.post('/token', new URLSearchParams({ username, password }), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

export const registerUser = (data: {
  username: string;
  email: string;
  password: string;
  display_name?: string;
}) => api.post('/register', data);

// Backend returns { user: {...} } — caller should read res.data.user
export const getMe = () => api.get('/me');

// Backend PreferencesUpdate expects comma-separated strings (not arrays)
// This helper converts arrays → CSV before sending
export const updatePreferences = (data: {
  display_name?: string;
  age?: number;
  gender?: string;
  favorite_genres?: string[];
  disliked_genres?: string[];
  movie_sources?: string[];
}) => {
  const toCSV = (arr?: string[]) => (arr && arr.length > 0 ? arr.join(',') : undefined);
  return api.put('/me/preferences', {
    display_name: data.display_name,
    age: data.age,
    gender: data.gender,
    favorite_genres: toCSV(data.favorite_genres),
    disliked_genres: toCSV(data.disliked_genres),
    movie_sources: toCSV(data.movie_sources),
    onboarding_completed: true,
  });
};

// ─── Movies ───────────────────────────────────────────────────────────────────
export const getMovies = (params?: {
  search?: string;
  genre?: string;
  genres?: string;
  limit?: number;
  offset?: number;
  sources?: string;
  min_rating?: number;
  start_year?: number;
  end_year?: number;
}) => api.get('/movies', { params });

/** Deep-learning personalized recommendations based on full user profile + activity */
export const getPersonalizedRecommendations = (limit = 28) =>
  api.get('/recommend/personalized', { params: { limit } });

/** Parallel N×N batch movie details loader */
export const getMovieBatch = (titles: string[]) =>
  api.post('/movies/batch', { titles });

export const getMovieDetails = (title: string) =>
  api.get('/movie-details', { params: { title } });

export const getRecommendations = (title: string) =>
  api.get('/recommend', { params: { title } });

export const searchMovies = (query: string) =>
  api.get('/search', { params: { query } });

// ─── ML ───────────────────────────────────────────────────────────────────────
export const predictSentiment = (text: string) =>
  api.post('/sentiment-predict', { text });

export const predictPreferences = () =>
  api.get('/predict-preferences');

// ─── User Activity ────────────────────────────────────────────────────────────
export const trackActivity = (data: {
  activity_type: string;
  movie_title?: string;
  page_url?: string;
}) => api.post('/track-activity', data).catch(() => {}); // silent fail

export const trackSearch = (query: string) =>
  api.post('/track-search', { query }).catch(() => {}); // silent fail

export const getUserHistory = () => api.get('/user-history');

// ─── Favorites & Watchlist ────────────────────────────────────────────────────
export const getFavorites = () => api.get('/favorites');
export const addFavorite = (movie_title: string) =>
  api.post('/favorites', { movie_title });
export const removeFavorite = (title: string) =>
  api.delete(`/favorites/${encodeURIComponent(title)}`);

export const getWatchlist = () => api.get('/watchlist');
export const addToWatchlist = (movie_title: string) =>
  api.post('/watchlist', { movie_title });
export const removeFromWatchlist = (title: string) =>
  api.delete(`/watchlist/${encodeURIComponent(title)}`);

export default api;
