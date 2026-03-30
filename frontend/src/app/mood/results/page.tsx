'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMood, ArcMovieResult } from '@/context/MoodContext';
import { getArcRecommendations } from '@/lib/api';
import ArcSparkline from '@/components/ArcSparkline';
import { ArrowLeft, Shuffle, Star, Loader2, Film, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

const SURPRISE_MOODS = [
  'euphoric', 'nostalgic', 'curious', 'awed', 'playful',
  'reflective', 'energized', 'cathartic', 'cozy', 'bittersweet',
];

export default function MoodResultsPage() {
  const router = useRouter();
  const {
    currentMood, desiredMood, setDesiredMood,
    selectedGenres, results, setResults, setQueryArc, queryArc,
    isLoading, setIsLoading,
  } = useMood();

  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  // If no results and no mood set, redirect to mood page
  useEffect(() => {
    if (!currentMood && !desiredMood && results.length === 0) {
      router.push('/mood');
    }
  }, [currentMood, desiredMood, results, router]);

  const handleSurprise = useCallback(async () => {
    const randomMood = SURPRISE_MOODS[Math.floor(Math.random() * SURPRISE_MOODS.length)];
    setDesiredMood(randomMood);
    setIsLoading(true);

    try {
      const res = await getArcRecommendations({
        current_mood: currentMood || 'neutral',
        desired_mood: randomMood,
        genres: selectedGenres,
        limit: 12,
      });
      setResults(res.data.results || []);
      setQueryArc(res.data.query_arc || []);
      toast.success(`Surprise! Looking for "${randomMood}" vibes 🎲`);
    } catch {
      toast.error('Failed to get new recommendations');
    } finally {
      setIsLoading(false);
    }
  }, [currentMood, selectedGenres, setDesiredMood, setIsLoading, setResults, setQueryArc]);

  return (
    <div className="page-container" style={{ paddingTop: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: 'clamp(1.25rem, 3vw, 1.75rem)', fontWeight: 800, lineHeight: 1.2 }}>
              Your Emotional Matches
            </h1>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {currentMood && <>Feeling <strong style={{ color: 'var(--danger)' }}>{currentMood}</strong></>}
              {currentMood && desiredMood && ' → '}
              {desiredMood && <>wanting <strong style={{ color: 'var(--accent)' }}>{desiredMood}</strong></>}
              {results.length > 0 && <> · {results.length} movies found</>}
            </p>
          </div>
        </div>

        <button
          onClick={handleSurprise}
          disabled={isLoading}
          className="btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.8rem' }}
        >
          <Shuffle size={14} /> Surprise Me
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 1rem', gap: '1rem' }}>
          <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Matching emotional arcs...</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <Film size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>No matches found</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Try different moods or fewer genre filters. Run <code>seed_arc.py</code> to populate the database.
          </p>
          <button onClick={() => router.push('/mood')} className="btn-primary" style={{ padding: '0.6rem 1.5rem' }}>
            Try Again
          </button>
        </div>
      )}

      {/* Results grid */}
      {!isLoading && results.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1.25rem',
        }}>
          {results.map((movie: ArcMovieResult) => (
            <div
              key={movie.id}
              className="card card-hover"
              onClick={() => router.push(`/mood/movie/${movie.id}`)}
              onMouseEnter={() => setHoveredCard(movie.id)}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                cursor: 'pointer',
                overflow: 'hidden',
                transition: 'transform 0.25s ease, border-color 0.2s',
                transform: hoveredCard === movie.id ? 'translateY(-4px)' : 'none',
              }}
            >
              {/* Poster + info row */}
              <div style={{ display: 'flex', gap: '1rem', padding: '1rem' }}>
                {/* Poster */}
                <div style={{
                  width: '90px', height: '135px', borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden', flexShrink: 0, position: 'relative',
                  background: 'var(--bg-elevated)',
                }}>
                  {movie.poster_url ? (
                    <img
                      src={movie.poster_url}
                      alt={movie.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy"
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Film size={24} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  )}

                  {/* Match score badge */}
                  <div style={{
                    position: 'absolute', top: '6px', right: '6px',
                    background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
                    padding: '0.15rem 0.4rem', borderRadius: '6px',
                    fontSize: '0.65rem', fontWeight: 800,
                    color: movie.arc_match_score >= 0.7 ? '#10b981' : movie.arc_match_score >= 0.5 ? '#fbbf24' : '#ef4444',
                  }}>
                    {Math.round(movie.arc_match_score * 100)}%
                  </div>
                </div>

                {/* Info */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.25, marginBottom: '0.2rem' }}>
                      {movie.title}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      {movie.year && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{movie.year}</span>}
                      {movie.rating > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem', fontSize: '0.72rem', color: 'var(--star)' }}>
                          <Star size={10} fill="var(--star)" /> {movie.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                    {/* Genres */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.4rem' }}>
                      {movie.genres.slice(0, 3).map(g => (
                        <span key={g} className="genre-chip" style={{ fontSize: '0.62rem', padding: '0.1rem 0.45rem' }}>{g}</span>
                      ))}
                    </div>
                  </div>

                  {/* Sparkline */}
                  <ArcSparkline labels={movie.arc_labels} width={160} height={40} />
                </div>
              </div>

              {/* Arc explanation */}
              <div style={{
                padding: '0.6rem 1rem', borderTop: '1px solid var(--border)',
                background: hoveredCard === movie.id ? 'var(--bg-elevated)' : 'transparent',
                transition: 'background 0.2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem' }}>
                  <Sparkles size={11} style={{ color: 'var(--purple)' }} />
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--purple)' }}>Emotional Arc</span>
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {movie.arc_explanation || movie.arc_labels.join(' → ')}
                </p>
              </div>

              {/* Hover tooltip: "Why this movie" */}
              {hoveredCard === movie.id && movie.overview && (
                <div style={{
                  padding: '0.75rem 1rem', borderTop: '1px solid var(--border)',
                  background: 'var(--bg-elevated)',
                  animation: 'fadeIn 0.2s ease',
                }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent)', marginBottom: '0.25rem', display: 'block' }}>
                    Why this movie?
                  </span>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {movie.overview.length > 150 ? movie.overview.substring(0, 150) + '...' : movie.overview}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
