'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import PosterImage from '@/components/PosterImage';
import { motion } from 'framer-motion';
import { Star, Film } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { trackActivity } from '@/lib/api';

export interface Movie {
  title: string;
  poster_url?: string;
  poster?: string;
  vote_average?: number;
  rating?: number;
  year?: number;
  genres?: string[];
  origin?: string;
}

interface Props {
  movie: Movie;
  rank?: number;
}

export default function MovieCard({ movie, rank }: Props) {
  const { token } = useAuth();
  const router = useRouter();
  const rating = movie.vote_average ?? movie.rating;
  const poster = movie.poster_url || movie.poster;

  const handleClick = () => {
    if (token) trackActivity({ activity_type: 'movie_click', movie_title: movie.title });
    router.push(`/movie/${encodeURIComponent(movie.title)}`);
  };

  return (
    <div
      onClick={handleClick}
      style={{ cursor: 'pointer', position: 'relative' }}
      role="button"
      aria-label={`View details for ${movie.title}`}
    >
      <motion.div
        whileHover={{ y: -4, scale: 1.02 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="card"
        style={{ overflow: 'hidden' }}
      >
        {/* Rank badge */}
        {rank && (
          <div style={{
            position: 'absolute', top: '0.5rem', left: '0.5rem', zIndex: 10,
            background: 'var(--accent)', color: '#fff',
            fontSize: '0.65rem', fontWeight: 800, padding: '0.15rem 0.45rem',
            borderRadius: '0.375rem',
          }}>
            #{rank}
          </div>
        )}

        {/* Origin badge */}
        {movie.origin && (
          <div style={{
            position: 'absolute', top: '0.5rem', right: '0.5rem', zIndex: 10,
            background: 'transparent', border: '1px solid var(--border)',
            color: '#e8e8e8', fontSize: '0.6rem', fontWeight: 700,
            padding: '0.15rem 0.4rem', borderRadius: '0.3rem', textTransform: 'uppercase',
          }}>
            {movie.origin === 'tmdb' ? 'HW' : movie.origin === 'bollywood' ? 'BW' : 'AN'}
          </div>
        )}

        {/* Poster */}
        <div style={{ paddingTop: '150%', position: 'relative', background: 'var(--bg-elevated)' }}>
          <div style={{ position: 'absolute', inset: 0 }}>
            <PosterImage
              src={poster}
              alt={movie.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        </div>

        {/* Info */}
        <div style={{ padding: '0.75rem' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: '0.35rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {movie.title}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.25rem' }}>
            {rating && rating > 0 ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: 'var(--star)', fontWeight: 700, fontSize: '0.75rem' }}>
                <Star size={11} fill="var(--star)" color="var(--star)" />
                {Number(rating).toFixed(1)}
              </span>
            ) : <span />}
            {movie.year && <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{movie.year}</span>}
          </div>
          {movie.genres && movie.genres.length > 0 && (
            <div style={{ marginTop: '0.4rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
              {movie.genres.slice(0, 2).map(g => (
                <span key={g} className="genre-chip">{g}</span>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
