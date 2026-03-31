'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useVibe } from '@/context/VibeContext';
import { getVibeMovie, rateVibeMovie } from '@/lib/api';
import VibeRadar, { VIBE_DIMENSIONS } from '@/components/VibeRadar';
import PosterImage from '@/components/PosterImage';
import { ArrowLeft, Star, Loader2, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface VibeMovieDetail {
  id: string;
  title: string;
  year: number;
  genres: string[];
  poster_url: string | null;
  tmdb_id: number;
  rating: number;
  overview: string;
  vibe_vector: number[];
  vibe_tags: string[];
  vibe_summary: string;
}

export default function VibeMoviePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { queryVector } = useVibe();

  const [movie, setMovie] = useState<VibeMovieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedRating, setSelectedRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  useEffect(() => {
    if (!params?.id) return;
    setLoading(true);
    getVibeMovie(params.id)
      .then(res => setMovie(res.data))
      .catch(() => toast.error('Movie not found'))
      .finally(() => setLoading(false));
  }, [params?.id]);

  const handleRateSubmit = useCallback(async () => {
    if (!selectedRating || !movie) return;
    setSubmittingRating(true);
    try {
      await rateVibeMovie({
        movie_id: movie.id,
        vibe_match_felt: selectedRating,
        comment: comment.trim() || undefined,
      });
      setRatingSubmitted(true);
      toast.success('Vibe rating saved — thank you!');
    } catch {
      toast.error('Could not save rating');
    } finally {
      setSubmittingRating(false);
    }
  }, [selectedRating, comment, movie]);

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <Loader2 size={36} className="animate-spin" style={{ margin: '0 auto 1rem', color: '#fbbf24' }} />
        <p style={{ color: 'var(--text-muted)' }}>Loading film details…</p>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Movie not found.</p>
        <Link href="/vibe/results" style={{ color: '#fbbf24' }}>← Back to results</Link>
      </div>
    );
  }

  const safeVector = movie.vibe_vector?.length === 6 ? movie.vibe_vector : [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
  const hasQueryVector = queryVector && queryVector.some(v => v !== 0.5);

  return (
    <div className="page-container" style={{ paddingTop: '1.5rem', maxWidth: '900px' }}>
      {/* Back */}
      <Link href="/vibe/results" style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
        color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600,
        textDecoration: 'none', marginBottom: '1.5rem',
      }}>
        <ArrowLeft size={14} /> Back to results
      </Link>

      {/* Hero: poster + info */}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '2rem', marginBottom: '2rem', alignItems: 'start' }}>
        {/* Poster */}
        <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', aspectRatio: '2/3', background: 'var(--bg-elevated)' }}>
          <PosterImage
            src={movie.poster_url || ''}
            alt={movie.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>

        {/* Right info */}
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
            {movie.genres?.map(g => (
              <span key={g} className="genre-chip">{g}</span>
            ))}
          </div>

          <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 900, lineHeight: 1.2, marginBottom: '0.3rem', letterSpacing: '-0.02em' }}>
            {movie.title}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            {movie.year}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Star size={16} style={{ color: '#fbbf24' }} />
            <span style={{ fontWeight: 800, color: '#fbbf24', fontSize: '1.1rem' }}>{movie.rating?.toFixed(1)}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>TMDB rating</span>
          </div>

          {/* Vibe summary blockquote */}
          {movie.vibe_summary && (
            <blockquote style={{
              borderLeft: '3px solid #fbbf24', paddingLeft: '1rem', marginBottom: '1rem',
              color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.9rem', lineHeight: 1.6,
            }}>
              {movie.vibe_summary}
            </blockquote>
          )}

          {/* Overview */}
          {movie.overview && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '1rem' }}>
              {movie.overview}
            </p>
          )}

          {/* Vibe tags */}
          {movie.vibe_tags?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {movie.vibe_tags.map(tag => (
                <span key={tag} style={{
                  padding: '0.25rem 0.65rem', borderRadius: '9999px',
                  background: 'rgba(251,191,36,0.08)',
                  border: '1px solid rgba(251,191,36,0.25)',
                  color: '#fbbf24', fontSize: '0.72rem', fontWeight: 600,
                }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Atmosphere Fingerprint Radar */}
      <div className="card" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.25rem' }}>Atmosphere Fingerprint</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.5rem' }}>
          The 6-dimension cinematic fingerprint of this film.
          {hasQueryVector && ' The dashed outline shows your vibe query for comparison.'}
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'flex-start' }}>
          {/* Large radar */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <VibeRadar
              vector={safeVector}
              compareVector={hasQueryVector ? queryVector : undefined}
              size={260}
              showLabels
              animated
            />
          </div>

          {/* Dimension breakdown bars */}
          <div style={{ flex: 1, minWidth: '200px' }}>
            {VIBE_DIMENSIONS.map((dim, i) => {
              const val = safeVector[i] ?? 0.5;
              const queryVal = hasQueryVector ? (queryVector[i] ?? 0.5) : null;
              const labels: Record<string, [string, string]> = {
                lighting:     ['Dark', 'Bright'],
                pacing:       ['Slow', 'Kinetic'],
                setting_type: ['Isolated', 'Urban'],
                temperature:  ['Cold', 'Warm'],
                texture:      ['Gritty', 'Polished'],
                era_feel:     ['Historical', 'Futuristic'],
              };
              const [lo, hi] = labels[dim.key] || ['Low', 'High'];

              return (
                <div key={dim.key} style={{ marginBottom: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: dim.color }}>{dim.label}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {lo} ← → {hi}
                    </span>
                  </div>
                  {/* Track */}
                  <div style={{ position: 'relative', height: '6px', background: 'var(--bg-elevated)', borderRadius: '9999px', overflow: 'hidden' }}>
                    {/* Film bar */}
                    <div style={{
                      position: 'absolute', left: 0, top: 0,
                      width: `${val * 100}%`, height: '100%',
                      background: dim.color, borderRadius: '9999px', opacity: 0.8,
                      transition: 'width 0.6s ease',
                    }} />
                    {/* Query marker */}
                    {queryVal !== null && (
                      <div style={{
                        position: 'absolute', left: `${queryVal * 100}%`,
                        top: '-2px', width: '2px', height: '10px',
                        background: '#f59e0b', transform: 'translateX(-50%)',
                        borderRadius: '1px',
                      }} />
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem' }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Film: {Math.round(val * 100)}%</span>
                    {queryVal !== null && (
                      <span style={{ fontSize: '0.65rem', color: '#f59e0b' }}>Your vibe: {Math.round(queryVal * 100)}%</span>
                    )}
                  </div>
                </div>
              );
            })}

            {hasQueryVector && (
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: '12px', height: '3px', background: '#10b981', display: 'inline-block', borderRadius: '2px' }} /> Film
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: '12px', height: '3px', background: '#f59e0b', display: 'inline-block', borderRadius: '2px' }} /> Your vibe
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rate vibe match */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.25rem' }}>Rate the vibe match</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1rem' }}>
          After watching, did the atmosphere feel right? Your rating improves future recommendations.
        </p>

        {ratingSubmitted ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#10b981', fontWeight: 700, fontSize: '0.9rem' }}>
            <CheckCircle size={20} /> Rating saved — thank you!
          </div>
        ) : (
          <>
            {/* Stars */}
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.85rem' }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setSelectedRating(n)}
                  onMouseEnter={() => setHoverRating(n)}
                  onMouseLeave={() => setHoverRating(0)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '0.1rem',
                    transform: (hoverRating >= n || selectedRating >= n) ? 'scale(1.2)' : 'scale(1)',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  <Star
                    size={28}
                    fill={(hoverRating >= n || selectedRating >= n) ? '#fbbf24' : 'transparent'}
                    stroke={(hoverRating >= n || selectedRating >= n) ? '#fbbf24' : 'var(--border-hover)'}
                  />
                </button>
              ))}
              {(hoverRating || selectedRating) > 0 && (
                <span style={{ alignSelf: 'center', marginLeft: '0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {['', 'Not at all', 'A little', 'Somewhat', 'Mostly', 'Perfect match'][hoverRating || selectedRating]}
                </span>
              )}
            </div>

            {/* Optional comment */}
            <textarea
              className="input-base"
              rows={2}
              placeholder="Optional: What felt right or off about the vibe? (helps improve matching)"
              value={comment}
              onChange={e => setComment(e.target.value)}
              style={{ fontSize: '0.85rem', resize: 'vertical', marginBottom: '0.75rem', userSelect: 'text', WebkitUserSelect: 'text' }}
            />

            <button
              onClick={handleRateSubmit}
              disabled={!selectedRating || submittingRating}
              className="btn-primary"
              style={{
                background: 'linear-gradient(135deg, #fbbf24, #fb923c)',
                boxShadow: '0 2px 12px rgba(251,191,36,0.2)',
                gap: '0.4rem', fontSize: '0.85rem',
              }}
            >
              {submittingRating ? <Loader2 size={15} className="animate-spin" /> : <Star size={15} />}
              Submit vibe rating
            </button>
          </>
        )}
      </div>

      {/* Mobile responsive */}
      <style>{`
        @media (max-width: 640px) {
          .vibe-movie-hero { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
