'use client';


import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getMovies, getPersonalizedRecommendations, addFavorite, addToWatchlist, trackActivity, trackSearch } from '@/lib/api';
import MovieCard from '@/components/MovieCard';
import ProtectedRoute from '@/components/ProtectedRoute';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, X, SlidersHorizontal, Star, Sparkles, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Movie } from '@/components/MovieCard';
import { useIsMobile } from '@/hooks/useIsMobile';

const GENRES = ['Action','Adventure','Animation','Comedy','Crime','Documentary','Drama','Fantasy','Horror','Mystery','Romance','Sci-Fi','Thriller','Western','Family','History','Music','Biography'];
const SOURCES = ['Hollywood', 'Bollywood', 'Anime'];
const YEARS = Array.from({ length: 2024 - 1970 + 1 }, (_, i) => 2024 - i);

function SkeletonCard() {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="skeleton" style={{ paddingTop: '150%' }} />
      <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div className="skeleton" style={{ height: '12px', borderRadius: '6px', width: '85%' }} />
        <div className="skeleton" style={{ height: '10px', borderRadius: '6px', width: '50%' }} />
      </div>
    </div>
  );
}

interface Filters {
  sources: string[];
  genres: string[];
  minRating: number;
  yearFrom: number;
  yearTo: number;
}

function FilterDrawer({ open, onClose, filters, setFilters }: { open: boolean; onClose: () => void; filters: Filters; setFilters: (f: Filters) => void }) {
  const [local, setLocal] = useState(filters);
  const apply = () => { setFilters(local); onClose(); };
  const reset = () => setLocal({ sources: [], genres: [], minRating: 0, yearFrom: 1970, yearTo: 2024 });
  const isMobile = useIsMobile();
  

  useEffect(() => { setLocal(filters); }, [filters]);

  const toggleArr = (key: 'sources' | 'genres', val: string) =>
    setLocal(p => ({ ...p, [key]: p[key].includes(val) ? p[key].filter(x => x !== val) : [...p[key], val] }));

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.4rem 0.875rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 600,
    border: `1px solid ${active ? 'var(--accent-border)' : 'var(--border)'}`,
    background: active ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    cursor: 'pointer', transition: 'all 0.18s',
  });

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, backdropFilter: 'blur(4px)' }}
          />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              position: 'fixed', top: 100,right: 0, bottom: 170, borderRadius: '16px', backgroundColor: 'var(--bg-surface)', width: '360px', maxWidth: '90vw',
              border: '1px solid var(--border)',
              borderRight: 'none', zIndex: 201, overflowY: 'auto', display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--bg-surface)' }}>
              <h3 style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <SlidersHorizontal size={16} /> Filters
              </h3>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.25rem' }}><X size={20} /></button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              {/* Source */}
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>Movie Source</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {SOURCES.map(s => <button key={s} onClick={() => toggleArr('sources', s)} style={chipStyle(local.sources.includes(s))}>{s}</button>)}
                </div>
              </div>

              {/* Genre */}
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>Genre</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {GENRES.map(g => <button key={g} onClick={() => toggleArr('genres', g)} style={{ ...chipStyle(local.genres.includes(g)), fontSize: '0.75rem', padding: '0.3rem 0.7rem' }}>{g}</button>)}
                </div>
              </div>

              {/* Rating */}
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
                  Min Rating{local.minRating > 0 && <span style={{ color: 'var(--accent)', marginLeft: '0.5rem' }}>≥ {local.minRating} <Star size={10} fill="var(--accent)" /></span>}
                </p>
                <input type="range" min={0} max={9} step={0.5} value={local.minRating}
                  onChange={e => setLocal(p => ({ ...p, minRating: Number(e.target.value) }))}
                  style={{ width: '100%', accentColor: 'var(--accent)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  <span>Any</span><span>9.0+</span>
                </div>
              </div>

              {/* Year */}
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>Year: {local.yearFrom} – {local.yearTo}</p>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <select value={local.yearFrom} onChange={e => setLocal(p => ({ ...p, yearFrom: Number(e.target.value) }))}
                    style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '0.5rem', color: 'var(--text-primary)', padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}>
                    {YEARS.map(y => <option key={y} value={y} style={{ background: 'var(--bg-surface)' }}>{y}</option>)}
                  </select>
                  <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>–</span>
                  <select value={local.yearTo} onChange={e => setLocal(p => ({ ...p, yearTo: Number(e.target.value) }))}
                    style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '0.5rem', color: 'var(--text-primary)', padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}>
                    {YEARS.map(y => <option key={y} value={y} style={{ background: 'var(--bg-surface)' }}>{y}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.75rem', position: 'sticky', bottom: 0, background: 'var(--bg-surface)' }}>
              <button onClick={reset} className="btn-secondary" style={{ flex: 1 }}>Reset</button>
              <button onClick={apply} className="btn-primary" style={{ flex: 2 }}>Apply Filters</button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

const PAGE_SIZE = 28;

function ExploreContent() {
  const { user } = useAuth();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({ sources: [], genres: [], minRating: 0, yearFrom: 1970, yearTo: 2024 });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isPersonalized, setIsPersonalized] = useState(false);
  const [topGenres, setTopGenres] = useState<string[]>([]);
  const [profileStrength, setProfileStrength] = useState<string>('cold');
  const searchRef = useRef<HTMLInputElement>(null);
  const suggestTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const queryTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isMobile = useIsMobile();

  const activeFilterCount = filters.sources.length + filters.genres.length + (filters.minRating > 0 ? 1 : 0) + (filters.yearFrom !== 1970 || filters.yearTo !== 2024 ? 1 : 0);

  // Parse user profile from auth context
  const userFavGenres = user?.favorite_genres || [];
  const hasProfile = userFavGenres.length > 0 || !!user?.age || !!user?.gender;

  // Determine if we should use personalized recommendations
  const shouldPersonalize = hasProfile && !query && activeFilterCount === 0;

  const fetchPersonalized = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPersonalizedRecommendations(PAGE_SIZE);
      const data = res.data;
      const newMovies: Movie[] = data.movies || [];
      setMovies(newMovies);
      setIsPersonalized(true);
      setHasMore(false);
      setTopGenres(data.top_genres || []);
      setProfileStrength(data.profile_strength || 'cold');
    } catch {
      // Fall back to regular movie list
      fetchRegular(true);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRegular = useCallback(async (reset = true) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    const currentOffset = reset ? 0 : offset;
    try {
      const params: Record<string, string | number> = { limit: PAGE_SIZE, offset: currentOffset };
      if (query) params.search = query;
      if (filters.genres.length) params.genre = filters.genres[0];
      if (filters.sources.length) params.sources = filters.sources.join(',');
      const res = await getMovies(params as Parameters<typeof getMovies>[0]);
      const data = res.data;
      const newMovies: Movie[] = data.movies || data.results || data || [];

      // Client-side filter by rating and year
      const filtered = newMovies.filter(m => {
        const rating = m.vote_average ?? m.rating ?? 0;
        const year = m.year ?? 0;
        if (filters.minRating > 0 && rating < filters.minRating) return false;
        if (year > 0 && (year < filters.yearFrom || year > filters.yearTo)) return false;
        return true;
      });

      if (reset) {
        setMovies(filtered);
        setOffset(PAGE_SIZE);
      } else {
        setMovies(p => [...p, ...filtered]);
        setOffset(p => p + PAGE_SIZE);
      }
      setHasMore(data.has_more ?? newMovies.length === PAGE_SIZE);
      setIsPersonalized(false);
      setTopGenres([]);
    } catch { toast.error('Failed to load movies'); }
    finally { if (reset) setLoading(false); else setLoadingMore(false); }
  }, [query, filters, offset]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track search queries
  const doTrackSearch = useCallback((q: string, count: number) => {
    if (q.trim()) {
      trackSearch(q);
      trackActivity({ activity_type: 'search', page_url: '/explore' });
    }
  }, []);

  useEffect(() => {
    if (shouldPersonalize) {
      fetchPersonalized();
    } else {
      fetchRegular(true);
    }
  }, [query, filters, shouldPersonalize]); // eslint-disable-line react-hooks/exhaustive-deps

  // Autocomplete suggestions
  useEffect(() => {
    clearTimeout(suggestTimer.current);
    if (search.length < 2) { setSuggestions([]); return; }
    suggestTimer.current = setTimeout(async () => {
      try {
        const res = await getMovies({ search, limit: 6 });
        const data = res.data;
        const ms: Movie[] = data.movies || data.results || data || [];
        setSuggestions(ms.slice(0, 6).map((m: Movie) => m.title).filter(Boolean));
      } catch { /* ignore */ }
    }, 250);
    return () => clearTimeout(suggestTimer.current);
  }, [search]);

  // Main search debounce
  useEffect(() => {
    clearTimeout(queryTimer.current);
    queryTimer.current = setTimeout(() => {
      if (search !== query && search.trim().length > 0) {
        setQuery(search);
        doTrackSearch(search, 0);
      } else if (search.trim() === '' && query !== '') {
        setQuery('');
      }
    }, 400);
    return () => clearTimeout(queryTimer.current);
  }, [search, query, doTrackSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(search);
    setShowSuggestions(false);
    if (search.trim()) doTrackSearch(search, 0);
  };

  const pickSuggestion = (title: string) => {
    setSearch(title); setQuery(title); setShowSuggestions(false);
    doTrackSearch(title, 0);
  };

  const clearSearch = () => {
    setSearch(''); setQuery(''); setSuggestions([]);
  };

  // Profile strength badge config
  const strengthConfig = {
    strong: { label: '✨ Highly Personalized', color: 'var(--accent)' },
    moderate: { label: '🎯 Personalized For You', color: 'var(--star)' },
    cold: { label: '🔥 Trending & Popular', color: 'var(--text-muted)' },
  };
  const badge = strengthConfig[profileStrength as keyof typeof strengthConfig] || strengthConfig.cold;

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontWeight: 900, fontSize: '2rem', color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
          {query ? 'Search Results' : isPersonalized ? 'Recommended For You' : 'Explore Movies'}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {user?.display_name ? `Welcome back, ${user.display_name}!` : 'Discover your next favourite'}
          </p>
          {isPersonalized && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              padding: '0.2rem 0.6rem', borderRadius: '9999px',
              background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
              color: badge.color, fontSize: '0.72rem', fontWeight: 700,
            }}>
              <Sparkles size={11} /> {badge.label}
            </span>
          )}
        </div>

        {/* User genre interest chips (from personalized DL output) */}
        {isPersonalized && topGenres.length > 0 && (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.75rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Based on your love of:</span>
            {topGenres.slice(0, 5).map(g => (
              <button
                key={g}
                onClick={() => setFilters(f => ({ ...f, genres: f.genres.includes(g) ? f.genres.filter(x => x !== g) : [...f.genres, g] }))}
                style={{
                  padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700,
                  border: '1px solid var(--accent-border)', background: 'var(--accent-subtle)',
                  color: 'var(--accent)', cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {g}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search + Filter row */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', alignItems: 'center' }}>
        {/* Search with suggestions */}
        <div style={{ position: 'relative', flex: 1 }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '9999px', padding: isMobile ? '0.8rem 0.5rem' : '0.8rem 1.25rem', transition: 'border-color 0.2s' }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setTimeout(() => setShowSuggestions(false), 150); }}>
            <Search size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setShowSuggestions(true); }}
              placeholder="Search Bollywood, Hollywood, Anime…"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '0.9rem', fontFamily: 'inherit' }}
              autoComplete="off"
            />
            {search && <button type="button" onClick={clearSearch} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}><X size={14} /></button>}
          </form>

          {/* Suggestions dropdown */}
          <AnimatePresence>
            {showSuggestions && suggestions.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                style={{ position: 'absolute', top: 'calc(100% + 9px)', left: 0, right: 0, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '0.875rem', overflow: 'hidden', zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
                {suggestions.map((s, i) => (
                  <button key={i} onMouseDown={() => pickSuggestion(s)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 1rem', background: 'none', border: 'none', borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.875rem', fontFamily: 'inherit', textAlign: 'left' }}>
                    <Search size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    {s}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Filter button */}
        <button
          onClick={() => setFilterOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.8rem 1.25rem', borderRadius: '9999px',
            background: activeFilterCount > 0 ? 'var(--accent-subtle)' : 'var(--bg-surface)',
            border: `1px solid ${activeFilterCount > 0 ? 'var(--accent-border)' : 'var(--border)'}`,
            color: activeFilterCount > 0 ? 'var(--accent)' : 'var(--text-secondary)',
            fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit', transition: 'all 0.2s',
          }}
        >
          <Filter size={15} />
          Filters
          {activeFilterCount > 0 && (
            <span style={{ background: 'var(--accent)', color: '#fff', width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800 }}>
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Active filter tags */}
      {(query || activeFilterCount > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.5rem', alignItems: 'center' }}>
          {query && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.65rem', borderRadius: '9999px', background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)', color: 'var(--accent)', fontSize: '0.78rem', fontWeight: 600 }}>
              &ldquo;{query}&rdquo;
              <button onClick={clearSearch} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 0, lineHeight: 1 }}><X size={11} /></button>
            </span>
          )}
          {filters.sources.map(s => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.65rem', borderRadius: '9999px', background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)', color: 'var(--accent)', fontSize: '0.78rem', fontWeight: 600 }}>
              {s}<button onClick={() => setFilters(f => ({ ...f, sources: f.sources.filter(x => x !== s) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 0 }}><X size={11} /></button>
            </span>
          ))}
          {filters.genres.map(g => (
            <span key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.65rem', borderRadius: '9999px', background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)', color: 'var(--accent)', fontSize: '0.78rem', fontWeight: 600 }}>
              {g}<button onClick={() => setFilters(f => ({ ...f, genres: f.genres.filter(x => x !== g) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 0 }}><X size={11} /></button>
            </span>
          ))}
          <button onClick={() => { clearSearch(); setFilters({ sources: [], genres: [], minRating: 0, yearFrom: 1970, yearTo: 2024 }); }} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            Clear all
          </button>
        </div>
      )}

      {/* Result count + mode indicator */}
      {!loading && movies.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          {query ? (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <Search size={12} style={{ display: 'inline', marginRight: '0.3rem' }} />
              {movies.length} result{movies.length !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
            </span>
          ) : isPersonalized ? (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <TrendingUp size={12} /> {movies.length} personalized picks
            </span>
          ) : (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Showing {movies.length} movies
            </span>
          )}
        </div>
      )}

      {/* Movie grid */}
      {loading ? (
        <div style={isMobile ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' } : { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
          {Array.from({ length: 28 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : movies.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>No movies found</p>
          <p style={{ fontSize: '0.85rem' }}>Try a different search or clear your filters</p>
        </div>
      ) : (
       
        <div style={isMobile ? { display: 'grid', gridTemplateColumns:  'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' } : { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
          {movies.map((movie, i) => (
            <motion.div key={`${movie.title}-${i}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.4) }}>
              <MovieCard movie={movie} />
            </motion.div>
          ))}
        </div>
      )}

      {/* Load more (only in non-personalized mode) */}
      {hasMore && !loading && !isPersonalized && (
        <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
          <button onClick={() => fetchRegular(false)} disabled={loadingMore} className="btn-secondary" style={{ padding: '0.75rem 2.5rem' }}>
            {loadingMore ? 'Loading…' : 'Load More'}
          </button>
        </div>
      )}

      {/* Filter drawer */}
      <FilterDrawer open={filterOpen} onClose={() => setFilterOpen(false)} filters={filters} setFilters={setFilters} />
    </div>
  );
}

export default function ExplorePage() {
  return <ProtectedRoute><ExploreContent /></ProtectedRoute>;
}
