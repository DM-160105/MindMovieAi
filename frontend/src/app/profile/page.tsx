'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useIsMobile } from '@/hooks/useIsMobile';
import { getUserHistory, predictPreferences } from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import { motion } from 'framer-motion';
import { User, Search, Activity, Settings, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Footer from '@/components/Footer';

interface UserHistory {
  searches: Array<{ query: string; timestamp: string }>;
  activities: Array<{ activity_type?: string; type?: string; movie_title?: string; timestamp?: string }>;
  sessions: Array<{ ip_address: string; login_at: string }>;
}
interface Prefs { predicted_genres: { genre: string; score: number }[]; source_distribution: Record<string, number> }

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: `color-mix(in srgb, ${color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={20} color={color} />
      </div>
      <div>
        <p style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</p>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '0.2rem' }}>{label}</p>
      </div>
    </div>
  );
}

function ProfileContent() {
  const { user, logout } = useAuth();
  const [history, setHistory] = useState<UserHistory | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    (async () => {
      try {
        const [histRes, prefRes] = await Promise.allSettled([getUserHistory(), predictPreferences()]);
        if (histRes.status === 'fulfilled') setHistory(histRes.value.data);
        if (prefRes.status === 'fulfilled') setPrefs(prefRes.value.data);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  const genreList = user?.favorite_genres ?? [];

  return (
    <>
    <div className="page-container">
      {/* Profile header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: isMobile ? '1.5rem' : '2.5rem' }}>
        <div style={{ width: '110px', height: '110px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 900, color:'#787777ff', flexShrink: 0 ,border: '4px solid rgba(125, 125, 125, 0.14)',WebkitBackdropFilter: 'blur(10px)',backdropFilter: 'blur(10px)',backgroundColor: '--var(--glass-bg)', overflow: 'hidden'}}>
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
          ) : (
            (user?.display_name || user?.username || 'U').trim().split(/\s+/).map(word => word[0]).join('').toUpperCase()
          )}
        </div>
        <div>
          <h1 style={{ fontWeight: isMobile ? 800 : 900, fontSize: isMobile ? '1.5rem' : '1.75rem', color: '#787777ff', letterSpacing: '-0.02em' }}>
            {user?.display_name || user?.username}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>@{user?.username}</p>
          {user?.email && <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{user.email}</p>}
        </div>
        {isMobile ? (
      undefined
      ) : (   <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          <Link href="/wizard" className="btn-secondary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.82rem' }}>
            <Settings size={14} /> Preferences
          </Link>
          <button onClick={logout} className="btn-danger" style={{ padding: '0.5rem 1rem', fontSize: '0.82rem' }}>Sign Out</button>
        </div>)}
     
      </motion.div>

          {isMobile ? (
          <div style={{ flex: 'inline-flex', alignItems: 'center', justifyContent: 'center' , marginLeft: 'auto', display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <Link href="/wizard" className="btn-secondary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.82rem' }}>
            <Settings size={14} /> Preferences
          </Link>
          <button onClick={logout} className="btn-danger" style={{ padding: '0.5rem 1rem', fontSize: '0.82rem' }}>Sign Out</button>
        </div>) : undefined}
        

      {/* Stats */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><Loader2 size={28} className="animate-spin" color="var(--accent)" /></div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <StatCard label="Searches" value={history?.searches?.length ?? 0} icon={Search} color="var(--accent-2)" />
            <StatCard label="Activities" value={history?.activities?.length ?? 0} icon={Activity} color="var(--accent)" />
            <StatCard label="Sessions" value={history?.sessions?.length ?? 0} icon={User} color="var(--purple)" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {/* Genres */}
            {genreList.length > 0 && (
              <div className="card" style={{ padding: '1.5rem' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>Favourite Genres</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {genreList.map((g: string) => <span key={g} className="genre-chip">{g}</span>)}
                </div>
              </div>
            )}

            {/* AI predicted genres */}
            {prefs?.predicted_genres && prefs.predicted_genres.length > 0 && (
              <div className="card" style={{ padding: '1.5rem' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>AI Predicted Genres</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {prefs.predicted_genres.map((g, i) => (
                    <span key={i} style={{ padding: '0.2rem 0.65rem', borderRadius: '9999px', background: 'var(--purple-subtle)', border: '1px solid var(--purple)', color: 'var(--purple)', fontSize: '0.72rem', fontWeight: 600 }}>
                      {g.genre}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recent searches */}
            {history?.searches && history.searches.length > 0 && (
              <div className="card" style={{ padding: '1.5rem' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>Recent Searches</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {history.searches.slice(0, 8).map((s, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Search size={12} color="var(--text-muted)" /> {s.query}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{s.timestamp ? new Date(s.timestamp).toLocaleDateString() : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

           
          </div>
        </motion.div>
      )}
    </div>
    <Footer />
    </>
  );
}

export default function ProfilePage() {
  return <ProtectedRoute><ProfileContent /></ProtectedRoute>;
}
