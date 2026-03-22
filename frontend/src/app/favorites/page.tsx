'use client';

import { useState, useEffect } from 'react';
import { getFavorites, removeFavorite, getPersonalizedRecommendations } from '@/lib/api';
import MovieCard from '@/components/MovieCard';
import ProtectedRoute from '@/components/ProtectedRoute';
import { motion } from 'framer-motion';
import { Heart, Loader2 } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import type { Movie } from '@/components/MovieCard';
import { useIsMobile } from '@/hooks/useIsMobile';

function FavoritesContent() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [recommended, setRecommended] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const isMobile = useIsMobile();

  const fetchFavs = async () => {
    setLoading(true);
    try {
      const res = await getFavorites();
      const data = res.data?.favorites || res.data || [];
      // normalise to Movie shape
      const mapped: Movie[] = data.map((f: { movie_title?: string; title?: string; poster_url?: string; vote_average?: number }) => ({
        title: f.movie_title || f.title || '',
        poster_url: f.poster_url || '',
        vote_average: f.vote_average,
      }));
      setMovies(mapped);
    } catch { toast.error('Failed to load favorites'); }
    finally { setLoading(false); }
  };

  const fetchRecs = async () => {
    setLoadingRecs(true);
    try {
      const res = await getPersonalizedRecommendations(12);
      setRecommended(res.data?.movies || res.data?.recommendations || []);
    } catch {
      // silent fail
    } finally {
      setLoadingRecs(false);
    }
  };

  useEffect(() => { 
    fetchFavs();
    fetchRecs();
  }, []);

  const remove = async (title: string) => {
    try {
      await removeFavorite(title);
      setMovies(p => p.filter(m => m.title !== title));
      toast.success('Removed from Favorites');
    } catch { toast.error('Failed to remove'); }
  };

  return (
    <div className="page-container">
      
      <div style={{ display: 'flex', alignItems: 'center',justifyContent: 'center', gap: '0.75rem', marginBottom: '2rem',marginTop: '4rem' }}>
        <Heart size={isMobile ? 24 : 50} color="var(--danger)" fill="var(--danger)" />
        <h1 style={{ fontWeight: 900, fontSize: isMobile ? '2rem' : '3rem', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Favorites</h1>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <Loader2 size={28} className="animate-spin" color="var(--accent)" />
        </div>
      ) : movies.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 0' }}>
          <Heart size={48} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>No favorites yet</p>
          <Link href="/explore" className="btn-primary" style={{ textDecoration: 'none' }}>Explore Movies</Link>
        </div>
      ) : (
        <div style={isMobile ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' } : { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
          {movies.map((m, i) => (
            <motion.div key={m.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} style={{ position: 'relative' }}>
              <MovieCard movie={m} />
              <button
                onClick={() => remove(m.title)}
                style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', width: '26px', height: '26px', borderRadius: '50%', background: 'var(--danger)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.8rem', zIndex: 10 }}
                title="Remove"
                aria-label={`Remove ${m.title} from favorites`}
              >✕</button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Recommended Section always shown */}
      <div style={{ marginTop: '4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontWeight: 800, fontSize: '1.5rem', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {movies.length > 0 ? 'Because you like these...' : 'Recommended for you'}
          </h2>
        </div>
        {loadingRecs ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
             <Loader2 size={24} className="animate-spin" color="var(--accent)" />
          </div>
        ) : recommended.length > 0 ? (
          <div style={isMobile ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' } : { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {recommended.map((m, i) => (
              <motion.div key={m.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <MovieCard movie={m} />
              </motion.div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function FavoritesPage() {
  return <ProtectedRoute><FavoritesContent /></ProtectedRoute>;
}
