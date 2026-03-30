'use client';

import { useState, useEffect, useCallback } from 'react';
import { getWatchlist, removeFromWatchlist, getRecommendations } from '@/lib/api';
import { useIsMobile } from '@/hooks/useIsMobile';
import MovieCard from '@/components/MovieCard';
import ProtectedRoute from '@/components/ProtectedRoute';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, Loader2, X, Layers, Sparkles, Film, Star } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import type { Movie } from '@/components/MovieCard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MovieStack {
  label: string;    // shortest/base title, e.g. "Dragon Ball"
  movies: Movie[];  // all entries in this series
}

// ─── Series-Aware Stacking Algorithm ─────────────────────────────────────────

/** Normalise to bare lowercase words, e.g. "Dragon Ball Z: Kai!" → ["dragon","ball","z","kai"] */
function normalise(title: string): string[] {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}

/** Length of the longest shared word-prefix between two word arrays */
function commonPrefixLen(a: string[], b: string[]): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/**
 * Group movies into series stacks.
 * Two movies belong together when their normalised titles share ≥2 prefix words,
 * OR one title is a complete prefix of the other (e.g. "Naruto" / "Naruto Shippuden").
 */
function buildSeriesStacks(movies: Movie[]): MovieStack[] {
  const MIN_SHARED = 2;

  // Sort shortest-first so the base series name comes first
  const sorted = [...movies].sort(
    (a, b) => normalise(a.title).length - normalise(b.title).length,
  );

  type Group = { label: string; normKey: string[]; movies: Movie[] };
  const groups: Group[] = [];

  for (const movie of sorted) {
    const norm = normalise(movie.title);
    let matched = false;

    for (const g of groups) {
      const shared = commonPrefixLen(norm, g.normKey);
      const minLen  = Math.min(norm.length, g.normKey.length);

      if (
        shared >= MIN_SHARED ||
        (norm.length === 1 && g.normKey.length === 1 && shared === 1) ||
        (shared === minLen && minLen >= 1 && norm.length !== g.normKey.length)
      ) {
        g.movies.push(movie);
        matched = true;
        break;
      }
    }

    if (!matched) {
      groups.push({ label: movie.title, normKey: norm, movies: [movie] });
    }
  }

  return groups.map(g => ({ label: g.label, movies: g.movies }));
}

// ─── Stack Modal ──────────────────────────────────────────────────────────────

function StackModal({
  stack,
  onClose,
  onRemove,
}: {
  stack: MovieStack;
  onClose: () => void;
  onRemove: (movie: Movie, idxInStack: number) => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <>
      {/*
       * KEY FIX: The backdrop IS the centering flex-container.
       * We do NOT use transform:translate on the modal child because
       * Framer Motion overrides `transform`, breaking the centering.
       */}
      <motion.div
        key="backdrop-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 400,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          /* ← flexbox does the centering, no transform needed on child */
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}
      >
        {/* Modal panel — click stops propagation so backdrop-click won't close when clicking inside */}
        <motion.div
          key="modal-panel"
          initial={{ opacity: 0, y: 48, scale: 0.93 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 32, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 340, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            /* no top/left/transform — centering handled by parent flex */
            position: 'relative',
            zIndex: 401,
            width: 'min(640px, 94vw)',
            maxHeight: '82vh',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '1.5rem',
            boxShadow: '0 32px 80px rgba(0,0,0,0.65)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* ── Header ── */}
          <div style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: '0.875rem',
            background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-surface) 100%)',
            flexShrink: 0,
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '0.75rem',
              background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Layers size={18} color="var(--accent)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {stack.label} Series
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                {stack.movies.length} movie{stack.movies.length !== 1 ? 's' : ''} in this stack
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: '50%', width: '32px', height: '32px',
                cursor: 'pointer', color: 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background 0.15s',
              }}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* ── Movie grid inside modal ── */}
          <div style={{
            overflowY: 'auto',
            flex: 1,
            padding: '1.25rem 1.5rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: '1rem',
          }}>
            {stack.movies.map((m, idx) => {
              const poster = m.poster_url || m.poster;
              const rating = m.vote_average ?? m.rating;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  style={{ position: 'relative' }}
                >
                  <div style={{
                    borderRadius: '10px', overflow: 'hidden',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                  }}>
                    {/* Poster */}
                    <div style={{ paddingTop: '150%', position: 'relative' }}>
                      <div style={{ position: 'absolute', inset: 0 }}>
                        {poster
                          ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={poster} alt={m.title}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                          ) : (
                            <div style={{
                              width: '100%', height: '100%',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Film size={28} color="var(--text-muted)" />
                            </div>
                          )}
                        {/* Gradient */}
                        <div style={{
                          position: 'absolute', inset: 0,
                          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 55%)',
                          pointerEvents: 'none',
                        }} />
                        {/* Rating badge */}
                        {rating != null && rating > 0 && (
                          <div style={{
                            position: 'absolute', bottom: '0.4rem', left: '0.4rem',
                            display: 'flex', alignItems: 'center', gap: '0.2rem',
                            background: 'rgba(0,0,0,0.55)', borderRadius: '0.375rem',
                            padding: '0.15rem 0.4rem', backdropFilter: 'blur(4px)',
                          }}>
                            <Star size={9} fill="var(--star)" color="var(--star)" />
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#fff' }}>
                              {Number(rating).toFixed(1)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Title + remove */}
                    <div style={{ padding: '0.5rem 0.6rem' }}>
                      <p style={{
                        fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-primary)',
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        lineHeight: 1.3, marginBottom: '0.4rem',
                      }}>
                        {m.title}
                      </p>
                      <button
                        onClick={() => onRemove(m, idx)}
                        style={{
                          width: '100%', padding: '0.3rem', fontSize: '0.68rem',
                          fontWeight: 700, fontFamily: 'inherit',
                          background: 'rgba(239,68,68,0.12)',
                          color: '#ef4444',
                          border: '1px solid rgba(239,68,68,0.25)',
                          borderRadius: '0.4rem', cursor: 'pointer',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.25)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.12)')}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}

// ─── Series Stack Card ────────────────────────────────────────────────────────

function SeriesStackCard({
  stack,
  onClick,
  onRemoveSingle,
}: {
  stack: MovieStack;
  onClick: () => void;
  onRemoveSingle: (movie: Movie) => void;
}) {
  const count   = stack.movies.length;
  const isSeries = count > 1;
  const posters  = stack.movies
    .map(m => m.poster_url || m.poster)
    .filter((p): p is string => Boolean(p))
    .slice(0, 3);

  return (
    <motion.div
      whileHover={{ y: isSeries ? -6 : -3 }}
      transition={{ type: 'spring', stiffness: 280, damping: 22 }}
      onClick={isSeries ? onClick : undefined}
      role={isSeries ? 'button' : undefined}
      tabIndex={isSeries ? 0 : undefined}
      onKeyDown={isSeries ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      style={{ position: 'relative', cursor: isSeries ? 'pointer' : 'default', outline: 'none' }}
      aria-label={isSeries ? `Open ${stack.label} series stack` : undefined}
    >
      {/* Fan layer 3 (furthest back) */}
      {isSeries && posters.length >= 3 && (
        <div style={{
          position: 'absolute', top: '12px', left: '10px', right: '10px', bottom: '-4px',
          borderRadius: '10px', overflow: 'hidden', transform: 'rotate(4deg)',
          background: 'var(--bg-elevated)', border: '1px solid var(--border)', zIndex: 0,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          <img src={posters[2]} alt="" aria-hidden="true"
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}
          />
        </div>
      )}
      {/* Fan layer 2 */}
      {isSeries && (
        <div style={{
          position: 'absolute', top: '6px', left: '5px', right: '5px', bottom: '-2px',
          borderRadius: '10px', overflow: 'hidden', transform: 'rotate(2deg)',
          background: 'var(--bg-elevated)', border: '1px solid var(--border)', zIndex: 1,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          {posters[1] && (
            <img src={posters[1]} alt="" aria-hidden="true"
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.75 }}
            />
          )}
        </div>
      )}

      {/* Front card */}
      <div className="card" style={{
        overflow: 'hidden', position: 'relative', zIndex: 2,
        boxShadow: isSeries ? '0 12px 32px rgba(0,0,0,0.4)' : undefined,
        border: isSeries ? '1px solid var(--accent-border)' : undefined,
      }}>
        {isSeries && (
          <div style={{
            position: 'absolute', top: '0.5rem', left: '0.5rem', zIndex: 10,
            display: 'flex', alignItems: 'center', gap: '0.25rem',
            background: 'var(--accent)', color: '#fff',
            fontSize: '0.62rem', fontWeight: 800,
            padding: '0.2rem 0.5rem', borderRadius: '0.4rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
          }}>
            <Layers size={9} />
            {count} films
          </div>
        )}

        {/* Main poster */}
        <div style={{ paddingTop: '150%', position: 'relative', background: 'var(--bg-elevated)' }}>
          <div style={{ position: 'absolute', inset: 0 }}>
            {posters[0]
              ? (
                <img src={posters[0]} alt={stack.label}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Film size={40} color="var(--text-muted)" />
                </div>
              )}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)',
              pointerEvents: 'none',
            }} />
          </div>
        </div>

        {/* Info */}
        <div style={{ padding: '0.75rem' }}>
          <p style={{
            fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)',
            lineHeight: 1.3, marginBottom: '0.35rem',
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {stack.label}
          </p>
          {isSeries ? (
            <span style={{
              fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent)',
              display: 'flex', alignItems: 'center', gap: '0.25rem',
            }}>
              <Layers size={10} /> Series · {count} titles · tap to expand
            </span>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onRemoveSingle(stack.movies[0]); }}
              style={{
                fontSize: '0.7rem', fontWeight: 600, fontFamily: 'inherit',
                color: '#ef4444', background: 'none', border: 'none',
                cursor: 'pointer', padding: 0,
              }}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Watchlist Component ─────────────────────────────────────────────────

function WatchlistContent() {
  const [rawMovies,  setRawMovies]  = useState<Movie[]>([]);
  const [stacks,     setStacks]     = useState<MovieStack[]>([]);
  const [recommended, setRecommended] = useState<Movie[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loadingRecs,setLoadingRecs]= useState(false);
  const [activeStack,setActiveStack]= useState<MovieStack | null>(null);
  const [recSeeds,   setRecSeeds]   = useState<string[]>([]);
  const isMobile = useIsMobile();

  const applyStacks = useCallback((movies: Movie[]) => {
    const s = buildSeriesStacks(movies);
    setStacks(s);
    setActiveStack(prev => {
      if (!prev) return null;
      const refreshed = s.find(x => x.label === prev.label);
      return refreshed && refreshed.movies.length > 0 ? refreshed : null;
    });
    return s;
  }, []);

  const fetchWL = async (): Promise<Movie[]> => {
    setLoading(true);
    try {
      const res = await getWatchlist();
      const data = res.data?.watchlist || res.data || [];
      const mapped: Movie[] = data.map((w: {
        movie_title?: string; title?: string; poster_url?: string; vote_average?: number;
      }) => ({
        title: w.movie_title || w.title || '',
        poster_url: w.poster_url || '',
        vote_average: w.vote_average,
      }));
      setRawMovies(mapped);
      applyStacks(mapped);
      return mapped;
    } catch {
      toast.error('Failed to load watchlist');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchSimilarRecs = async (movies: Movie[]) => {
    if (movies.length === 0) return;
    setLoadingRecs(true);
    const seeds = [...new Set(movies.map(m => m.title))].slice(0, 3);
    setRecSeeds(seeds);
    try {
      const results = await Promise.allSettled(seeds.map(t => getRecommendations(t)));
      const wlSet = new Set(movies.map(m => m.title.toLowerCase()));
      const merged: Movie[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled') {
          const recs: Movie[] = r.value.data?.recommendations || r.value.data?.movies || r.value.data || [];
          merged.push(...recs);
        }
      }
      const seen = new Set<string>();
      const final = merged
        .filter(m => {
          const k = m.title.toLowerCase();
          if (seen.has(k) || wlSet.has(k)) return false;
          seen.add(k);
          return true;
        })
        .sort(() => Math.random() - 0.5)
        .slice(0, 12);
      setRecommended(final);
    } catch { /* silent */ }
    finally { setLoadingRecs(false); }
  };

  useEffect(() => {
    fetchWL().then(movies => fetchSimilarRecs(movies));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeSingleOccurrence = async (movie: Movie) => {
    try {
      await removeFromWatchlist(movie.title);
      const idx = rawMovies.findIndex(m => m.title === movie.title);
      if (idx === -1) return;
      const updated = [...rawMovies.slice(0, idx), ...rawMovies.slice(idx + 1)];
      setRawMovies(updated);
      applyStacks(updated);
      toast.success('Removed from Watchlist');
    } catch { toast.error('Failed to remove'); }
  };

  const removeFromStackByIndex = async (movie: Movie, idxInStack: number) => {
    try {
      await removeFromWatchlist(movie.title);
      let count = 0;
      const updated = rawMovies.filter(m => {
        if (m.title === movie.title && count === idxInStack) { count++; return false; }
        if (m.title === movie.title) count++;
        return true;
      });
      setRawMovies(updated);
      applyStacks(updated);
      toast.success('Removed from Watchlist');
    } catch { toast.error('Failed to remove'); }
  };

  const hasSeriesStacks = stacks.some(s => s.movies.length > 1);
  const seriesCount     = stacks.filter(s => s.movies.length > 1).length;

  return (
    <div className="page-container">
      {/* ── Stack Modal ─ rendered via AnimatePresence ── */}
      <AnimatePresence>
        {activeStack && (
          <StackModal
            stack={activeStack}
            onClose={() => setActiveStack(null)}
            onRemove={removeFromStackByIndex}
          />
        )}
      </AnimatePresence>

      {/* ── Page header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '0.75rem', marginBottom: '2.5rem',
      }}>
        <Bookmark size={isMobile ? 24 : 44} color="var(--accent-2)" fill="var(--accent-2)" />
        <h1 style={{
          fontWeight: 900, fontSize: isMobile ? '2rem' : '2.8rem',
          color: 'var(--text-primary)', letterSpacing: '-0.02em',
        }}>
          My Watchlist
        </h1>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
          <Loader2 size={32} className="animate-spin" color="var(--accent)" />
        </div>

      ) : stacks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 0' }}>
          <Bookmark size={52} color="var(--text-muted)" style={{ marginBottom: '1.25rem' }} />
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', fontSize: '1rem' }}>
            Your watchlist is empty
          </p>
          <Link href="/explore" className="btn-primary" style={{ textDecoration: 'none' }}>
            Explore Movies
          </Link>
        </div>

      ) : (
        <>
          {hasSeriesStacks && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                marginBottom: '1.75rem',
                padding: '0.55rem 1.1rem',
                borderRadius: '9999px',
                background: 'var(--accent-subtle)',
                border: '1px solid var(--accent-border)',
                fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 600,
              }}
            >
              <Layers size={13} />
              {seriesCount} series stacked — tap a stack to see all titles
            </motion.div>
          )}

          <div style={
            isMobile
              ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))', gap: '1.25rem' }
              : { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '1.5rem' }
          }>
            {stacks.map((stack, i) => (
              <motion.div
                key={stack.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.4) }}
              >
                <SeriesStackCard
                  stack={stack}
                  onClick={() => setActiveStack(stack)}
                  onRemoveSingle={removeSingleOccurrence}
                />
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* ── Similarity-Based Recommendations ── */}
      <div style={{ marginTop: '4.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
          <Sparkles size={18} color="var(--accent)" />
          <h2 style={{
            fontWeight: 800, fontSize: '1.4rem',
            color: 'var(--text-primary)', letterSpacing: '-0.02em',
          }}>
            {rawMovies.length > 0 ? 'Movies You Might Like' : 'Recommended for you'}
          </h2>
        </div>

        {recSeeds.length > 0 && rawMovies.length > 0 && (
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Based on: {recSeeds.slice(0, 2).map(t => `"${t}"`).join(', ')}
            {recSeeds.length > 2 ? ' & more' : ''}
          </p>
        )}
        {!(recSeeds.length > 0 && rawMovies.length > 0) && (
          <div style={{ marginBottom: '1.5rem' }} />
        )}

        {loadingRecs ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2.5rem' }}>
            <Loader2 size={26} className="animate-spin" color="var(--accent)" />
          </div>
        ) : recommended.length > 0 ? (
          <div style={
            isMobile
              ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))', gap: '1rem' }
              : { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))', gap: '1rem' }
          }>
            {recommended.map((m, i) => (
              <motion.div
                key={m.title + i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.4) }}
              >
                <MovieCard movie={m} />
              </motion.div>
            ))}
          </div>
        ) : !loadingRecs && rawMovies.length > 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No similar movies found right now.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function WatchlistPage() {
  return <ProtectedRoute><WatchlistContent /></ProtectedRoute>;
}
