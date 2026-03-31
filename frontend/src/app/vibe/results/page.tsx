'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useVibe, type VibePreset } from '@/context/VibeContext';
import { getVibeMatch, getVibePresets } from '@/lib/api';
import VibeRadar from '@/components/VibeRadar';
import PosterImage from '@/components/PosterImage';
import { ArrowLeft, Shuffle, Star, Loader2, Aperture, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

// ── Helpers ───────────────────────────────────────────────────────────────────

function matchBadgeStyle(score: number): { bg: string; color: string; border: string; label: string } {
  const pct = Math.round(score * 100);
  if (pct >= 85) return { bg: 'rgba(16,185,129,0.12)', color: '#10b981', border: 'rgba(16,185,129,0.3)', label: `${pct}%` };
  if (pct >= 70) return { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)', label: `${pct}%` };
  return { bg: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: 'rgba(139,92,246,0.25)', label: `${pct}%` };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function VibeResultsPage() {
  const router = useRouter();
  const {
    results, setResults,
    queryVector, setQueryVector,
    setQueryTags,
    vibeText,
    selectedPreset, setSelectedPreset,
    selectedGenres,
    setIsLoading, isLoading,
  } = useVibe();

  const [presets, setPresets] = useState<VibePreset[]>([]);
  const [surprisingLoader, setSurprisingLoader] = useState(false);

  // If arrived directly with no results, bounce back
  useEffect(() => {
    if (results.length === 0 && !isLoading) {
      // Give a moment in case of hot-reload navigation
      const t = setTimeout(() => {
        if (results.length === 0) router.push('/vibe');
      }, 300);
      return () => clearTimeout(t);
    }
  }, [results.length, isLoading, router]);

  // Load presets for "Surprise me"
  useEffect(() => {
    getVibePresets()
      .then(res => setPresets(res.data.presets || []))
      .catch(() => {});
  }, []);

  const handleSurpriseMe = useCallback(async () => {
    const pool = presets.length > 0 ? presets : [];
    if (pool.length === 0) { toast.error('Presets not loaded yet'); return; }

    const random = pool[Math.floor(Math.random() * pool.length)] as VibePreset;
    setSurprisingLoader(true);
    try {
      const res = await getVibeMatch({
        preset_id: random.id,
        genres: selectedGenres.length > 0 ? selectedGenres : undefined,
        limit: 12,
      });
      setSelectedPreset(random);
      setResults(res.data.results || []);
      setQueryVector(res.data.query_vector || random.vector);
      setQueryTags(res.data.query_tags || []);
      toast.success(`🎲 ${random.emoji} ${random.display_name}`, { duration: 2500 });
    } catch {
      toast.error('Could not fetch surprise results');
    } finally {
      setSurprisingLoader(false);
    }
  }, [presets, selectedGenres, setResults, setQueryVector, setQueryTags, setSelectedPreset]);

  if (results.length === 0) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 1rem', color: '#fbbf24' }} />
        <p style={{ color: 'var(--text-muted)' }}>Loading results…</p>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ paddingTop: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.75rem' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.25rem, 3vw, 1.75rem)', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {selectedPreset ? (
              <><span style={{ marginRight: '0.4rem' }}>{selectedPreset.emoji}</span>{selectedPreset.display_name}</>
            ) : vibeText ? (
              <>Films matching <span style={{ color: '#fbbf24' }}>your vibe</span></>
            ) : 'Your atmosphere matches'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.2rem' }}>
            {results.length} film{results.length !== 1 ? 's' : ''} matched · ranked by atmosphere similarity
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Query radar (mini) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)' }}>
            <VibeRadar vector={queryVector} size={48} showLabels={false} />
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your vibe</div>
              <div style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 600 }}>
                {selectedPreset?.display_name || 'Custom'}
              </div>
            </div>
          </div>

          <button
            onClick={handleSurpriseMe}
            disabled={surprisingLoader}
            className="btn-secondary"
            style={{ gap: '0.4rem', fontSize: '0.82rem', padding: '0.55rem 1rem' }}
          >
            {surprisingLoader ? <Loader2 size={14} className="animate-spin" /> : <Shuffle size={14} />}
            Surprise me
          </button>
        </div>
      </div>

      {/* Results grid */}
      {results.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '1rem',
        }}>
          {results.map(movie => {
            const badge = matchBadgeStyle(movie.vibe_match_score);
            const dimVec = [
              movie.dimension_match?.lighting ?? 0.5,
              movie.dimension_match?.pacing ?? 0.5,
              movie.dimension_match?.setting_type ?? 0.5,
              movie.dimension_match?.temperature ?? 0.5,
              movie.dimension_match?.texture ?? 0.5,
              movie.dimension_match?.era_feel ?? 0.5,
            ];

            return (
              <Link
                key={movie.id}
                href={`/vibe/movie/${movie.id}`}
                style={{ textDecoration: 'none' }}
              >
                <div
                  className="card card-hover"
                  style={{
                    overflow: 'hidden', cursor: 'pointer',
                    transition: 'transform 0.2s ease, border-color 0.2s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'}
                >
                  {/* Poster */}
                  <div style={{ position: 'relative', aspectRatio: '2/3', overflow: 'hidden', background: 'var(--bg-elevated)' }}>
                    <PosterImage
                      src={movie.poster_url || ''}
                      alt={movie.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {/* Match badge overlay */}
                    <div style={{
                      position: 'absolute', top: '0.6rem', right: '0.6rem',
                      padding: '0.25rem 0.55rem', borderRadius: '9999px',
                      background: badge.bg, border: `1px solid ${badge.border}`,
                      color: badge.color, fontSize: '0.72rem', fontWeight: 800,
                      backdropFilter: 'blur(8px)',
                    }}>
                      {badge.label} match
                    </div>
                    {/* Mini radar overlay */}
                    <div style={{
                      position: 'absolute', bottom: '0.6rem', right: '0.6rem',
                      background: 'rgba(0,0,0,0.65)', borderRadius: '50%',
                      backdropFilter: 'blur(8px)', padding: '3px',
                    }}>
                      <VibeRadar vector={dimVec} size={52} showLabels={false} animated={false} />
                    </div>
                  </div>

                  {/* Info */}
                  <div style={{ padding: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.3rem' }}>
                      <h3 style={{ fontSize: '0.9rem', fontWeight: 800, lineHeight: 1.3, flex: 1 }}>{movie.title}</h3>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>{movie.year}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.5rem' }}>
                      <Star size={11} style={{ color: '#fbbf24', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24' }}>{movie.rating?.toFixed(1)}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>
                        {movie.genres?.slice(0, 2).join(' · ')}
                      </span>
                    </div>

                    {/* Vibe summary */}
                    {movie.vibe_summary && (
                      <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginBottom: '0.5rem', lineHeight: 1.4, fontStyle: 'italic' }}>
                        {movie.vibe_summary}
                      </p>
                    )}

                    {/* Vibe tags */}
                    {movie.vibe_tags?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {movie.vibe_tags.slice(0, 4).map(tag => (
                          <span key={tag} style={{
                            padding: '0.18rem 0.5rem', borderRadius: '9999px',
                            background: 'rgba(251,191,36,0.08)',
                            border: '1px solid rgba(251,191,36,0.2)',
                            color: '#fbbf24', fontSize: '0.65rem', fontWeight: 600,
                          }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .vibe-results-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 420px) {
          .vibe-results-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
      <AlertCircle size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>No films found</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
        The vibe_movies database may be empty. Run <code>python backend/seed_vibes.py</code> to populate it.
      </p>
      <Link href="/vibe" className="btn-primary" style={{
        textDecoration: 'none', background: 'linear-gradient(135deg, #fbbf24, #fb923c)',
        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
      }}>
        <Aperture size={15} /> Try a different vibe
      </Link>
    </div>
  );
}
