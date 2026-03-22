'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { addFavorite, removeFavorite, addToWatchlist, removeFromWatchlist, getFavorites, getWatchlist } from '@/lib/api';
import { Heart, Bookmark, ChevronDown, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';

interface Props {
  movieTitle: string;
}

export default function SaveButton({ movieTitle }: Props) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [inFav, setInFav] = useState(false);
  const [inWL, setInWL] = useState(false);
  const [loading, setLoading] = useState<'fav' | 'wl' | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [favRes, wlRes] = await Promise.allSettled([getFavorites(), getWatchlist()]);
        if (favRes.status === 'fulfilled') {
          const favs = favRes.value.data?.favorites || favRes.value.data || [];
          setInFav(favs.some((f: { movie_title?: string; title?: string }) => (f.movie_title || f.title) === movieTitle));
        }
        if (wlRes.status === 'fulfilled') {
          const wls = wlRes.value.data?.watchlist || wlRes.value.data || [];
          setInWL(wls.some((w: { movie_title?: string; title?: string }) => (w.movie_title || w.title) === movieTitle));
        }
      } catch { /* silent */ }
    })();
  }, [user, movieTitle]);

  const toggleFav = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading('fav');
    try {
      if (inFav) {
        await removeFavorite(movieTitle);
        setInFav(false);
        toast.success('Removed from Favorites');
      } else {
        await addFavorite(movieTitle);
        setInFav(true);
        toast.success('Added to Favorites ❤️');
      }
    } catch { toast.error('Failed to update favorites'); }
    finally { setLoading(null); setExpanded(false); }
  };

  const toggleWL = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading('wl');
    try {
      if (inWL) {
        await removeFromWatchlist(movieTitle);
        setInWL(false);
        toast.success('Removed from Watchlist');
      } else {
        await addToWatchlist(movieTitle);
        setInWL(true);
        toast.success('Added to Watchlist 🕐');
      }
    } catch { toast.error('Failed to update watchlist'); }
    finally { setLoading(null); setExpanded(false); }
  };

  if (!user) return null;

  return (
    <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
      {/* Main Save button */}
      <button
        onClick={() => setExpanded(p => !p)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          padding: '0.6rem 1rem', borderRadius: '0.75rem', fontWeight: 700, fontSize: '0.85rem',
          background: (inFav || inWL) ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
          border: `1px solid ${(inFav || inWL) ? 'var(--accent-border)' : 'var(--border)'}`,
          color: (inFav || inWL) ? 'var(--accent)' : 'var(--text-secondary)',
          cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.18s',
        }}
        aria-label="Save movie"
      >
        {inFav ? <Heart size={15} fill="var(--accent)" color="var(--accent)" /> : inWL ? <Bookmark size={15} fill="var(--accent)" color="var(--accent)" /> : '🔖'}
        Save
        <ChevronDown size={13} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {/* Expanded options */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
              background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '0.75rem',
              overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            }}
          >
            <button
              onClick={toggleFav}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.7rem 1rem', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', color: inFav ? 'var(--accent)' : 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'inherit', justifyContent: 'center' }}
            >
              {loading === 'fav' ? <Loader2 size={14} className="animate-spin" /> : undefined}
              {inFav ? 'Remove from Favorites' : '❤️ Add to Favorites'}
            </button>
            <button
              onClick={toggleWL}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.7rem 1rem', background: 'none', border: 'none', cursor: 'pointer', color: inWL ? 'var(--accent)' : 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'inherit', justifyContent: 'center' }}
            >
              {loading === 'wl' ? <Loader2 size={14} className="animate-spin" /> : undefined}
              {inWL ? 'Remove from Watchlist' : '🕐 Add to Watchlist'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
