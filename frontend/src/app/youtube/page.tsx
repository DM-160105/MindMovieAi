'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, X, TrendingUp, Play, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useIsMobile } from '@/hooks/useIsMobile';

interface Video {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  views: number;
  likes: number;
  duration: string;
  uploaded_ago: string;
  category: string;
  region: string;
  video_id: string;
}

const REGIONS = ['US', 'IN', 'GB', 'CA'];

function fmtViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function VideoCardSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div className="skeleton" style={{ paddingTop: '56.25%', borderRadius: '0.875rem' }} />
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <div className="skeleton" style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div className="skeleton" style={{ height: '12px', borderRadius: '6px' }} />
          <div className="skeleton" style={{ height: '10px', borderRadius: '6px', width: '60%' }} />
        </div>
      </div>
    </div>
  );
}

function VideoCard({ video }: { video: Video }) {
  const thumb = video.thumbnail || `https://i.ytimg.com/vi/${video.video_id}/mqdefault.jpg`;

  return (
    <Link href={`/youtube/${encodeURIComponent(video.video_id)}?title=${encodeURIComponent(video.title)}`} style={{ textDecoration: 'none', display: 'block' }}>
      <motion.div whileHover={{ y: -2 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
        {/* Thumbnail */}
        <div style={{ position: 'relative', paddingTop: '56.25%', background: 'var(--bg-elevated)', borderRadius: '0.875rem', overflow: 'hidden', marginBottom: '0.75rem' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            alt={video.title}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }}
          />
          {/* Duration badge */}
          <div style={{ position: 'absolute', bottom: '0.4rem', right: '0.4rem', background: 'rgba(0,0,0,0.8)', color: '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: '0.3rem' }}>
            {video.duration}
          </div>
          {/* Play overlay */}
          <div className="play-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,69,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }} className="play-icon">
              <Play size={18} color="#fff" fill="#fff" />
            </div>
          </div>
        </div>

        {/* Info row */}
        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-start' }}>
          {/* Channel avatar */}
          <div style={{ width: '50px', height: '50px', borderRadius: '50%',border: '2px solid var(--border)', background: 'var(--bg-blur)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', color: 'rgb(120, 119, 119)', flexShrink: 0 }}>
            {(video.channel || 'C').trim().split(/\s+/).map(word => word[0]).join('').toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: '0.2rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {video.title}
            </p>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{video.channel}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {fmtViews(video.views)} views · {video.uploaded_ago}
            </p>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export default function YouTubePage() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const PAGE_SIZE = 24;

  const fetchVideos = async (reset = true) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    const o = reset ? 0 : offset;
    try {
      const params: Record<string, string | number> = { limit: PAGE_SIZE, offset: o };
      if (query) params.search = query;
      if (region) params.region = region;
      if (category) params.category = category;
      const res = await api.get('/youtube/videos', { params });
      const data = res.data;
      const vids: Video[] = data.videos || data || [];
      if (reset) { setVideos(vids); setOffset(PAGE_SIZE); } else { setVideos(p => [...p, ...vids]); setOffset(p => p + PAGE_SIZE); }
      setHasMore(data.has_more ?? false);
      if (data.categories) setCategories(data.categories.slice(0, 20));
    } catch { toast.error('Failed to load videos'); }
    finally { if (reset) setLoading(false); else setLoadingMore(false); }
  };

  useEffect(() => { fetchVideos(true); }, [query, region, category]); // eslint-disable-line

  // Autocomplete
  useEffect(() => {
    clearTimeout(suggestTimer.current);
    if (search.length < 2) { setSuggestions([]); return; }
    suggestTimer.current = setTimeout(async () => {
      try {
        const res = await api.get('/youtube/search', { params: { q: search, limit: 5 } });
        const vids: Video[] = res.data.videos || res.data || [];
        setSuggestions(vids.map(v => v.title).slice(0, 5));
      } catch { /* ignore */ }
    }, 250);
    return () => clearTimeout(suggestTimer.current);
  }, [search]);

  const pickSuggestion = (t: string) => { setSearch(t); setQuery(t); setShowSuggest(false); };
  const isMobile = useIsMobile();

  return (
    <div className="page-container">
      {/* Header */}
      <div style={isMobile ? {gap: '0.75rem', marginBottom: '2rem'} : { display: 'flex', alignItems: 'center',justifyContent: 'center', gap: '0.75rem', marginBottom: '2rem' } }>
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
          <h1 style={{ fontWeight: 900, fontSize: isMobile ? '1.5rem' : '2rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.6rem', letterSpacing: '-0.02em', marginBottom: '0.3rem' }}>
            <div style={{ background: 'var(--danger-subtle)', color: 'var(--danger)', padding: isMobile ? '0.5rem' : '1rem', borderRadius: '50%', display: 'flex', outline: '1px solid var(--logo-outline)', outlineOffset: '2px', }}>
              <TrendingUp size={isMobile ? 24 : 29} />
            </div>
            YouTube Trending
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500,marginTop: isMobile ? '1rem' : '0' }}>AI-powered video analysis, fake engagement & sentiment tracking.</p>
        </motion.div>
      </div>

      {/* Search + Region row */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <motion.div whileTap={{ scale: 0.995 }} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'var(--bg-blur)', WebkitBackdropFilter: 'blur(12px)', backdropFilter: 'blur(12px)', border: '1px solid var(--border)', borderRadius: '1rem', padding: '0.75rem 1.25rem', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', transition: 'border-color 0.2s' }}
            onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setTimeout(() => setShowSuggest(false), 150); }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
          >
            <Search size={20} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <input type="text" value={search} onChange={e => { setSearch(e.target.value); setShowSuggest(true); }}
              onKeyDown={e => { if (e.key === 'Enter') { setQuery(search); setShowSuggest(false); } }}
              placeholder="Search trending videos..."
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 500, fontFamily: 'inherit', width: '100%' }}
              autoComplete="off"
            />
            {search && <button onClick={() => { setSearch(''); setQuery(''); }} style={{ background: 'var(--bg-elevated)', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', padding: '0.3rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>}
          </motion.div>
          <AnimatePresence>
            {showSuggest && suggestions.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 5 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '1rem', zIndex: 100, overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.15)' }}>
                {suggestions.map((s, i) => (
                  <button key={i} onMouseDown={() => pickSuggestion(s)} style={{ width: '100%', padding: '0.75rem 1.25rem', background: 'none', border: 'none', borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.875rem', fontWeight: 500, fontFamily: 'inherit', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.75rem', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <Search size={14} color="var(--accent)" />{s}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Region filter */}
        <div style={{ position: 'relative', width: '130px', flexShrink: 0 }}>
          <select value={region} onChange={e => setRegion(e.target.value)}
            style={{ width: '100%', padding: '0.75rem 2.5rem 0.75rem 1.25rem', background: 'var(--bg-blur)', WebkitBackdropFilter: 'blur(12px)', backdropFilter: 'blur(12px)', border: '1px solid var(--border)', borderRadius: '1rem', color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', outline: 'none', appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', transition: 'all 0.2s', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <option value="" style={{ background: 'var(--bg-elevated)' }}>Global</option>
            {REGIONS.map(r => <option key={r} value={r} style={{ background: 'var(--bg-elevated)' }}>{r} Trending</option>)}
          </select>
          <ChevronDown size={16} color="var(--text-muted)" style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        </div>
      </div>

      {/* Category chips */}
      {categories.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setCategory('')} style={{ padding: '0.4rem 1rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 700, border: `1px solid ${!category ? 'var(--accent)' : 'var(--border)'}`, background: !category ? 'var(--accent)' : 'var(--bg-blur)', color: !category ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', boxShadow: !category ? '0 4px 12px rgba(16, 185, 129, 0.25)' : 'none' }}>All Categories</motion.button>
          {categories.map((c, i) => (
            <motion.button key={c} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }} whileTap={{ scale: 0.95 }} onClick={() => setCategory(c === category ? '' : c)} style={{ padding: '0.4rem 1rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 700, border: `1px solid ${c === category ? 'var(--accent)' : 'var(--border)'}`, background: c === category ? 'var(--accent)' : 'var(--bg-blur)', color: c === category ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', boxShadow: c === category ? '0 4px 12px rgba(16, 185, 129, 0.25)' : 'none' }}>{c}</motion.button>
          ))}
        </div>
      )}

      {/* Video grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem' }}>
          {Array.from({ length: 12 }).map((_, i) => <VideoCardSkeleton key={i} />)}
        </div>
      ) : videos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>No videos found. Try a different search.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem' }}>
          {videos.map((v, i) => (
            <motion.div key={`${v.id}-${i}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.5) }}>
              <VideoCard video={v} />
            </motion.div>
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
          <button onClick={() => fetchVideos(false)} disabled={loadingMore} className="btn-secondary" style={{ padding: '0.75rem 2.5rem' }}>
            {loadingMore ? 'Loading…' : 'Load More'}
          </button>
        </div>
      )}

      <style>{`
        .play-overlay:hover { background: rgba(0,0,0,0.3) !important; }
        .play-overlay:hover .play-icon { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
