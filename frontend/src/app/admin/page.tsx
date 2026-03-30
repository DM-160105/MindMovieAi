'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { motion } from 'framer-motion';
import { Users, Activity, Film, Youtube, BarChart3, Loader2, ShieldCheck, LogOut, Globe } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

interface AdminUser {
  id: number;
  username: string;
  email: string;
  display_name?: string;
  age?: number;
  gender?: string;
  favorite_genres?: string;
  created_at?: string;
  session_count?: number;
  activity_count?: number;
  is_admin?: boolean;
}

interface AdminStats {
  total_users: number;
  total_sessions: number;
  total_activities: number;
  total_reviews: number;
  total_yt_comments: number;
  total_favorites: number;
  total_watchlist: number;
}

interface AdminActivity {
  id: number;
  username: string;
  activity_type: string;
  movie_title?: string;
  page_url?: string;
  timestamp?: string;
}

interface AdminMovie { title: string; clicks: number; favorites: number; watchlist: number; }
interface AdminYouTube { title: string; clicks: number; comments: number; }
type Tab = 'overview' | 'users' | 'activity' | 'movies' | 'youtube';

function StatCard({ label, value, icon: Icon, color, loading }: { label: string; value: number; icon: React.ElementType; color: string; loading?: boolean }) {
  if (loading) return (
    <div className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div className="skeleton" style={{ width: '52px', height: '52px', borderRadius: '12px', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton" style={{ height: '24px', width: '60%', marginBottom: '0.4rem' }} />
        <div className="skeleton" style={{ height: '12px', width: '40%' }} />
      </div>
    </div>
  );
  return (
    <div className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: `color-mix(in srgb, ${color} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 22%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={22} color={color} />
      </div>
      <div>
        <p style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{(value ?? 0).toLocaleString()}</p>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '0.2rem' }}>{label}</p>
      </div>
    </div>
  );
}

function TableSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div style={{ padding: '1rem' }}>
      <div className="skeleton" style={{ height: '40px', width: '100%', marginBottom: '1rem', borderRadius: '4px' }} />
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="skeleton" style={{ height: '48px', width: '100%', marginBottom: '0.5rem', borderRadius: '4px', opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="skeleton" style={{ width: '100%', height: '80%', borderRadius: '8px' }} />
  );
}

function Table({ headers, rows, loading }: { headers: string[]; rows: (string | number | null | undefined)[][]; loading?: boolean }) {
  if (loading) return <TableSkeleton columns={headers.length} />;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {headers.map(h => (
              <th key={h} style={{ padding: '0.625rem 0.875rem', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No data found</td></tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
                {row.map((cell, j) => (
                  <td key={j} style={{ padding: '0.625rem 0.875rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{cell ?? '—'}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminPage() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [activity, setActivity] = useState<AdminActivity[]>([]);
  const [movies, setMovies] = useState<AdminMovie[]>([]);
  const [youtubeVids, setYoutubeVids] = useState<AdminYouTube[]>([]);
  
  // Independent loading states
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [loadingMovies, setLoadingMovies] = useState(false);
  const [loadingYoutube, setLoadingYoutube] = useState(false);

  const [userFilters, setUserFilters] = useState({ email: '', name: '', gender: '', age: '', sortBy: '' });
  const [activityFilters, setActivityFilters] = useState({ email: '', name: '' });
  const [movieFilters, setMovieFilters] = useState({ type: '', sortBy: 'most_clicked' });
  const [ytFilters, setYtFilters] = useState({ sortBy: 'most_clicked' });
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!authLoading) {
      const isAdmin = user?.is_admin || user?.username === 'admin';
      if (!user || !isAdmin) { router.replace('/explore'); return; }
      fetchStats();
    }
  }, [authLoading, user]); // eslint-disable-line

  useEffect(() => {
    if (tab === 'overview') {
      if (!stats) fetchStats();
      if (users.length === 0) fetchUsers();
      if (activity.length === 0) fetchActivity();
      if (movies.length === 0) fetchMovies();
      if (youtubeVids.length === 0) fetchYoutube();
    } else if (tab === 'users') {
      fetchUsers();
    } else if (tab === 'activity') {
      fetchActivity();
    } else if (tab === 'movies') {
      fetchMovies();
    } else if (tab === 'youtube') {
      fetchYoutube();
    }
  }, [tab]); // eslint-disable-line

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await api.get('/admin/stats');
      setStats(res.data);
    } catch (e) { console.error(e); }
    finally { setLoadingStats(false); }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams();
      if (userFilters.email) params.append('email', userFilters.email);
      if (userFilters.name) params.append('name', userFilters.name);
      if (userFilters.gender) params.append('gender', userFilters.gender);
      if (userFilters.age) params.append('age', userFilters.age);
      if (userFilters.sortBy) params.append('sort_by', userFilters.sortBy);
      const res = await api.get(`/admin/users?${params.toString()}`);
      setUsers(res.data.users || res.data || []);
    } catch (e) { console.error(e); }
    finally { setLoadingUsers(false); }
  };

  const fetchActivity = async () => {
    setLoadingActivity(true);
    try {
      const params = new URLSearchParams();
      if (activityFilters.email) params.append('email', activityFilters.email);
      if (activityFilters.name) params.append('name', activityFilters.name);
      const res = await api.get(`/admin/activities?${params.toString()}`);
      setActivity(res.data.activities || res.data || []);
    } catch (e) { console.error(e); }
    finally { setLoadingActivity(false); }
  };

  const fetchMovies = async () => {
    setLoadingMovies(true);
    try {
      const params = new URLSearchParams();
      if (movieFilters.type) params.append('movie_type', movieFilters.type);
      if (movieFilters.sortBy) params.append('sort_by', movieFilters.sortBy);
      const res = await api.get(`/admin/movies?${params.toString()}`);
      setMovies(res.data.movies || []);
    } catch (e) { console.error(e); }
    finally { setLoadingMovies(false); }
  };

  const fetchYoutube = async () => {
    setLoadingYoutube(true);
    try {
      const params = new URLSearchParams();
      if (ytFilters.sortBy) params.append('sort_by', ytFilters.sortBy);
      const res = await api.get(`/admin/youtube?${params.toString()}`);
      setYoutubeVids(res.data.youtube_videos || []);
    } catch (e) { console.error(e); }
    finally { setLoadingYoutube(false); }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 size={32} className="animate-spin" color="var(--accent)" />
    </div>
  );

  const tabStyle = (t: Tab): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.5rem 1rem', borderRadius: '0.625rem',
    fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
    border: 'none', fontFamily: 'inherit', transition: 'all 0.15s',
    background: tab === t ? 'var(--accent-subtle)' : 'transparent',
    color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
  });

  const usersByDate = Object.entries(users.reduce((acc, u) => {
    if (u.created_at) { const date = new Date(u.created_at).toLocaleDateString(); acc[date] = (acc[date] || 0) + 1; }
    return acc;
  }, {} as Record<string, number>)).map(([date, count]) => ({ date, Users: count })).reverse();
  
  const activitiesByDate = Object.entries(activity.reduce((acc, a) => {
    if (a.timestamp) { const date = new Date(a.timestamp).toLocaleDateString(); acc[date] = (acc[date] || 0) + 1; }
    return acc;
  }, {} as Record<string, number>)).map(([date, count]) => ({ date, Activity: count })).reverse();

  const topMoviesData = movies.slice(0, 5).map(m => ({
    name: m.title.length > 15 ? m.title.substring(0, 15) + '...' : m.title,
    Clicks: m.clicks, Favorites: m.favorites, Watchlist: m.watchlist
  }));

  const topYtData = youtubeVids.slice(0, 5).map(y => ({
    name: y.title.length > 15 ? y.title.substring(0, 15) + '...' : y.title,
    Clicks: y.clicks, Comments: y.comments
  }));

  return (
    <div className="page-container" style={{ position: 'relative' }}>
      {/* Header Actions */}
      <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', display: 'flex', gap: '0.75rem', zIndex: 10 }}>
        <button 
          onClick={() => router.push('/explore')} 
          className="btn-secondary" 
          style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', borderRadius: '0.75rem' }}
        >
          <Globe size={16} />
          {!isMobile && 'View Site'}
        </button>
        <button 
          onClick={handleLogout} 
          className="btn-danger" 
          style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', borderRadius: '0.75rem' }}
        >
          <LogOut size={16} />
          {!isMobile && 'Logout'}
        </button>
      </div>

      {/* Header */}
    
      
        <div style={{ width: isMobile ? '80px' : '120px', height: isMobile ? '80px' : '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem',outline: '3px solid var(--logo-outline)',outlineOffset: '4px',borderRadius: '9999px'}}>
            <img src="/logo.png" alt="Logo" width={isMobile ? '80px' : '120px'} height={isMobile ? '80px' : '120px'} style={{ borderRadius: '9999px'}}/>
          </div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem', justifyContent: 'center', flexDirection: 'column' }}>
            <h1 style={{ fontWeight: 900, fontSize: '1.75rem', color: 'var(--text-primary)' }}>Admin Panel</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Platform overview and user management</p>
          </div>
      

      {/* Tab bar */}
      {isMobile ? (
      <div style={{display: 'grid',gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',gap: '0.25rem', marginBottom: '2rem', background: 'var(--bg-elevated)', padding: '0.25rem', borderRadius: '0.75rem', border: '1px solid var(--border)'}}>
      
        <button style={tabStyle('overview')} onClick={() => setTab('overview')}><BarChart3 size={25} /> Overview</button>
        <button style={tabStyle('users')} onClick={() => setTab('users')}><Users size={25} /> Users ({users.length})</button>
        <button style={tabStyle('activity')} onClick={() => setTab('activity')}><Activity size={25} /> Activity</button>
        <button style={tabStyle('movies')} onClick={() => setTab('movies')}><Film size={25} /> Movies ({movies.length})</button>
        <button style={tabStyle('youtube')} onClick={() => setTab('youtube')}><Youtube size={25} /> YouTube ({youtubeVids.length})</button>
      </div>): ( <div style={{ display: 'flex', justifyContent: 'center',alignItems: 'center'}}>
      <div style={{display: 'flex',gap: '0.25rem', marginBottom: '2rem', background: 'var(--bg-elevated)', padding: '0.25rem', borderRadius: '0.75rem', width: 'fit-content', border: '1px solid var(--border)' }}>
        <button style={tabStyle('overview')} onClick={() => setTab('overview')}><BarChart3 size={14} /> Overview</button>
        <button style={tabStyle('users')} onClick={() => setTab('users')}><Users size={14} /> Users ({users.length})</button>
        <button style={tabStyle('activity')} onClick={() => setTab('activity')}><Activity size={14} /> Activity</button>
        <button style={tabStyle('movies')} onClick={() => setTab('movies')}><Film size={14} /> Movies ({movies.length})</button>
        <button style={tabStyle('youtube')} onClick={() => setTab('youtube')}><Youtube size={14} /> YouTube ({youtubeVids.length})</button>
        </div>
      </div>)
      }
     

      {/* Content */}
      <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(150px, 1fr))' : 'repeat(auto-fill, minmax(210px, 1fr))', gap: '1rem' }}>
              <StatCard label="Total Users" value={stats?.total_users || 0} icon={Users} color="var(--accent)" loading={loadingStats} />
              <StatCard label="Sessions" value={stats?.total_sessions || 0} icon={BarChart3} color="var(--accent-2)" loading={loadingStats} />
              <StatCard label="Activities" value={stats?.total_activities || 0} icon={Activity} color="var(--purple)" loading={loadingStats} />
              <StatCard label="Movie Reviews" value={stats?.total_reviews || 0} icon={Film} color="var(--warning)" loading={loadingStats} />
              <StatCard label="YT Comments" value={stats?.total_yt_comments || 0} icon={Youtube} color="var(--danger)" loading={loadingStats} />
              <StatCard label="Favorites" value={stats?.total_favorites || 0} icon={BarChart3} color="var(--star)" loading={loadingStats} />
            </div>

            {/* Dashboards */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.5rem' }}>
              
              {/* Users Area Chart */}
              <div className="card" style={{ padding: '1.25rem', height: '300px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}><Users size={16} style={{display:'inline'}}/> User Growth</h3>
                {loadingUsers ? <ChartSkeleton /> : (
                  <ResponsiveContainer width="100%" height="80%">
                    <AreaChart data={usersByDate}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                      <Area type="monotone" dataKey="Users" stroke="var(--accent)" fill="var(--accent-subtle)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Activity Line Chart */}
              <div className="card" style={{ padding: '1.25rem', height: '300px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}><Activity size={16} style={{display:'inline'}}/> Activity Trends</h3>
                {loadingActivity ? <ChartSkeleton /> : (
                  <ResponsiveContainer width="100%" height="80%">
                    <LineChart data={activitiesByDate}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                      <Line type="monotone" dataKey="Activity" stroke="var(--purple)" strokeWidth={3} dot={{ r: 4, fill: 'var(--purple)' }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Top Movies Bar Chart */}
              <div className="card" style={{ padding: '1.25rem', height: '300px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}><Film size={16} style={{display:'inline'}}/> Top Movies Metrics</h3>
                {loadingMovies ? <ChartSkeleton /> : (
                  <ResponsiveContainer width="100%" height="80%">
                    <BarChart data={topMoviesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} interval={0} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Bar dataKey="Clicks" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Favorites" fill="var(--star)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Watchlist" fill="var(--purple)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Top YouTube Bar Chart */}
              <div className="card" style={{ padding: '1.25rem', height: '300px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}><Youtube size={16} style={{display:'inline'}}/> Top YouTube Metrics</h3>
                {loadingYoutube ? <ChartSkeleton /> : (
                  <ResponsiveContainer width="100%" height="80%">
                    <BarChart data={topYtData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} interval={0} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Bar dataKey="Clicks" fill="var(--danger)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Comments" fill="var(--warning)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
              <h2 style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)', marginRight: 'auto' }}>All Users</h2>
              <input type="text" placeholder="Email" value={userFilters.email} onChange={e => setUserFilters(f => ({ ...f, email: e.target.value }))} style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '0.8rem' }} />
              <input type="text" placeholder="Name" value={userFilters.name} onChange={e => setUserFilters(f => ({ ...f, name: e.target.value }))} style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '0.8rem', width: '100px' }} />
              <input type="number" placeholder="Age" value={userFilters.age} onChange={e => setUserFilters(f => ({ ...f, age: e.target.value }))} style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '0.8rem', width: '70px' }} />
              <select value={userFilters.gender} onChange={e => setUserFilters(f => ({ ...f, gender: e.target.value }))} style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                <option value="">Any Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
              <select value={userFilters.sortBy} onChange={e => setUserFilters(f => ({ ...f, sortBy: e.target.value }))} style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                <option value="">Sort: Newest</option>
                <option value="most_clicked">Most Clicked</option>
                <option value="most_favorite">Most Favorite</option>
                <option value="most_watchlist">Most Watchlist</option>
              </select>
              <button onClick={fetchUsers} className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Apply</button>
            </div>
            <Table
              loading={loadingUsers}
              headers={['ID', 'Username', 'Display Name', 'Email', 'Age', 'Gender', 'Genres', 'Sessions', 'Activities', 'Admin']}
              rows={users.map(u => [
                u.id, u.username, u.display_name || '—', u.email,
                u.age ?? '—', u.gender || '—',
                (u.favorite_genres || '').split(',').slice(0, 3).join(', ') || '—',
                u.session_count ?? 0, u.activity_count ?? 0,
                u.is_admin ? '✅' : '—',
              ])}
            />
          </div>
        )}

        {tab === 'activity' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
              <h2 style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)', marginRight: 'auto' }}>Recent Activity</h2>
              <input type="text" placeholder="User Email" value={activityFilters.email} onChange={e => setActivityFilters(f => ({ ...f, email: e.target.value }))} style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '0.8rem' }} />
              <input type="text" placeholder="User Name" value={activityFilters.name} onChange={e => setActivityFilters(f => ({ ...f, name: e.target.value }))} style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '0.8rem', width: '100px' }} />
              <button onClick={fetchActivity} className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Apply</button>
            </div>
            <Table
              loading={loadingActivity}
              headers={['ID', 'User', 'Activity Type', 'Movie / Page', 'Timestamp']}
              rows={activity.map(a => [
                a.id, a.username,
                (a.activity_type || '').replace(/_/g, ' '),
                a.movie_title || a.page_url || '—',
                a.timestamp ? new Date(a.timestamp).toLocaleString() : '—',
              ])}
            />
          </div>
        )}

        {tab === 'movies' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
              <h2 style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)', marginRight: 'auto' }}>Movies Data</h2>
              <select value={movieFilters.type} onChange={e => setMovieFilters(f => ({ ...f, type: e.target.value }))} style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                <option value="">All Movie Types</option>
                <option value="hollywood">Hollywood</option>
                <option value="bollywood">Bollywood</option>
                <option value="anime">Anime</option>
              </select>
              <select value={movieFilters.sortBy} onChange={e => setMovieFilters(f => ({ ...f, sortBy: e.target.value }))} style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                <option value="most_clicked">Most Clicked</option>
                <option value="most_favorite">Most Favorite</option>
                <option value="most_watchlist">Most Watchlist</option>
              </select>
              <button onClick={fetchMovies} className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Apply</button>
            </div>
            <Table
              loading={loadingMovies}
              headers={['Movie Title', 'Clicks', 'Favorites', 'Watchlist']}
              rows={movies.map(m => [m.title, m.clicks, m.favorites, m.watchlist])}
            />
          </div>
        )}

        {tab === 'youtube' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
              <h2 style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)', marginRight: 'auto' }}>YouTube Videos Data</h2>
              <select value={ytFilters.sortBy} onChange={e => setYtFilters(f => ({ ...f, sortBy: e.target.value }))} style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                <option value="most_clicked">Most Clicked</option>
                <option value="most_commented">Most Commented</option>
              </select>
              <button onClick={fetchYoutube} className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Apply</button>
            </div>
            <Table
              loading={loadingYoutube}
              headers={['Video Title', 'Clicks', 'Comments']}
              rows={youtubeVids.map(y => [y.title, y.clicks, y.comments])}
            />
          </div>
        )}
      </motion.div>
    </div>
  );
}
