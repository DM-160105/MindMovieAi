'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getArcMovie, rateArcMovie } from '@/lib/api';
import { ArrowLeft, Star, Film, Loader2, Heart, Send } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import toast from 'react-hot-toast';

interface ArcMovie {
  id: string;
  title: string;
  year: number | null;
  genres: string[];
  poster_url: string | null;
  tmdb_id: number | null;
  arc_vector: number[];
  arc_labels: string[];
  arc_explanation: string;
  rating: number;
  overview: string;
}

const LABEL_VALUES: Record<string, number> = {
  triumph: 1.0, joy: 0.85, peace: 0.75, hope: 0.6,
  'turning point': 0.4, calm: 0.3, neutral: 0.2,
  struggle: -0.3, tension: -0.5, conflict: -0.65,
  dread: -0.8, despair: -1.0,
};

const RATE_MOODS = [
  'inspired', 'calm', 'hopeful', 'energized', 'moved',
  'reflective', 'sad', 'anxious', 'amused', 'unchanged',
];

export default function MoodMoviePage() {
  const params = useParams();
  const router = useRouter();
  const movieId = params?.id as string;

  const [movie, setMovie] = useState<ArcMovie | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [moodAfter, setMoodAfter] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!movieId) return;
    setLoading(true);
    getArcMovie(movieId)
      .then(res => setMovie(res.data))
      .catch(() => toast.error('Failed to load movie'))
      .finally(() => setLoading(false));
  }, [movieId]);

  const chartData = movie?.arc_labels.map((label, i) => ({
    segment: `S${i + 1}`,
    label,
    value: LABEL_VALUES[label] ?? 0,
  })) || [];

  const handleRate = async () => {
    if (!userRating || !moodAfter) {
      toast.error('Please select both a rating and your mood after watching');
      return;
    }
    setSubmitting(true);
    try {
      await rateArcMovie({
        movie_id: movieId,
        rating: userRating,
        mood_before: 'unknown',
        mood_after: moodAfter,
      });
      toast.success('Thanks for your feedback! 🎬');
    } catch {
      toast.error('Failed to save rating');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <Film size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Movie not found</h2>
        <button onClick={() => router.back()} className="btn-primary" style={{ marginTop: '1rem' }}>Go Back</button>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ paddingTop: '1.5rem' }}>
      {/* Movie hero */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'auto 1fr',
        gap: '2rem', marginBottom: '2rem', alignItems: 'start',
      }}
        className="movie-hero-grid"
      >
        {/* Poster */}
        <div style={{
          width: '220px', borderRadius: 'var(--radius-lg)',
          overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          position: 'relative',
        }}>
          {movie.poster_url ? (
            <img src={movie.poster_url} alt={movie.title} style={{ width: '100%', display: 'block' }} />
          ) : (
            <div style={{ width: '100%', aspectRatio: '2/3', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Film size={48} style={{ color: 'var(--text-muted)' }} />
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <h1 style={{
            fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)', fontWeight: 900,
            lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: '0.5rem',
          }}>
            {movie.title}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {movie.year && (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{movie.year}</span>
            )}
            {movie.rating > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', color: 'var(--star)' }}>
                <Star size={14} fill="var(--star)" /> {movie.rating.toFixed(1)}
              </span>
            )}
          </div>

          {/* Genres */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '1rem' }}>
            {movie.genres.map(g => (
              <span key={g} className="genre-chip">{g}</span>
            ))}
          </div>

          {/* Overview */}
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '1rem' }}>
            {movie.overview}
          </p>

          {/* Arc explanation */}
          <div className="card" style={{ padding: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <Heart size={14} style={{ color: 'var(--purple)' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{movie.arc_explanation}</span>
          </div>
        </div>
      </div>

      {/* Full arc chart */}
      <div className="card" style={{ padding: '0rem', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem', padding: '1.5rem 0rem 0rem 1.5rem' }}>Emotional Journey</h2>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem', padding: '0rem 0rem 0rem 1.5rem' }}>
          How this movie&apos;s emotional arc unfolds across its story
        </p>

        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="arcFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                axisLine={{ stroke: 'var(--border)' }}
                tickLine={false}
                angle={-30}
                textAnchor="end"
                height={50}
              />
              <YAxis
                domain={[-1, 1]}
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                axisLine={{ stroke: 'var(--border)' }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  fontSize: '0.8rem',
                }}
                labelStyle={{ color: 'var(--text-primary)', fontWeight: 700 }}
                itemStyle={{ color: 'var(--accent)' }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--accent)"
                strokeWidth={2.5}
                fill="url(#arcFill)"
                dot={{ r: 5, fill: 'var(--accent)', stroke: 'var(--bg)', strokeWidth: 2 }}
                activeDot={{ r: 7, fill: 'var(--accent)', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Rate after watching */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>Rate Your Experience</h2>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          How did this movie make you feel? Your feedback helps improve recommendations.
        </p>

        {/* Star rating */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>
            Your Rating
          </label>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {[1, 2, 3, 4, 5].map(s => (
              <button
                key={s}
                onMouseEnter={() => setHoverRating(s)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setUserRating(s)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '0.2rem', transition: 'transform 0.15s',
                  transform: (hoverRating >= s || userRating >= s) ? 'scale(1.15)' : 'scale(1)',
                }}
              >
                <Star
                  size={28}
                  fill={(hoverRating >= s || userRating >= s) ? 'var(--star)' : 'none'}
                  color={(hoverRating >= s || userRating >= s) ? 'var(--star)' : 'var(--text-muted)'}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Mood after watching */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>
            How do you feel now?
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {RATE_MOODS.map(m => (
              <button
                key={m}
                onClick={() => setMoodAfter(m)}
                style={{
                  padding: '0.3rem 0.7rem', borderRadius: '9999px',
                  fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                  border: moodAfter === m ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                  background: moodAfter === m ? 'var(--accent-subtle)' : 'transparent',
                  color: moodAfter === m ? 'var(--accent)' : 'var(--text-secondary)',
                  transition: 'all 0.2s',
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleRate}
          disabled={submitting}
          className="btn-primary"
          style={{ padding: '0.6rem 1.5rem', fontSize: '0.85rem' }}
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={14} />}
          Submit Feedback
        </button>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .movie-hero-grid {
            grid-template-columns: 1fr !important;
            text-align: center;
          }
          .movie-hero-grid > div:first-child {
            margin: 0 auto;
            width: 180px !important;
          }
        }
      `}</style>
    </div>
  );
}
