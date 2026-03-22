'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api, { trackActivity } from '@/lib/api';
import { motion } from 'framer-motion';
import { Play, ExternalLink, ThumbsUp, ThumbsDown, Eye, MessageSquare, AlertTriangle, Send, Loader2, ArrowLeft, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useIsMobile } from '@/hooks/useIsMobile';

interface Comment {
  id: number;
  username: string;
  comment_text: string;
  sentiment_label: 'positive' | 'negative' | 'neutral';
  sentiment_confidence: number;
  created_at: string;
}

interface VideoDetail {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  views: number;
  likes: number;
  dislikes: number;
  comment_count: number;
  category: string;
  region: string;
  description?: string;
  tags?: string;
  video_id: string;
}

interface Analysis {
  is_suspicious: boolean;
  flags: string[];
  confidence: number;
  sentiment_summary: {
    overall_sentiment: string;
    positive_pct: number;
    negative_pct: number;
    neutral_pct: number;
    sentiment_volatility: number;
    summary: string;
  };
}

function fmtViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const sentClass = (l: string) => l === 'positive' ? 'badge-positive' : l === 'negative' ? 'badge-negative' : 'badge-neutral';
const sentIcon = (l: string) => l === 'positive' ? '✅' : l === 'negative' ? '❌' : '➖';

export default function YouTubeVideoPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const titleParam = searchParams.get('title') || '';
  const { user } = useAuth();
  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [recs, setRecs] = useState<VideoDetail[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [commentFilter, setCommentFilter] = useState<'all' | 'positive' | 'negative' | 'neutral'>('all');
  const isMobile = useIsMobile();

  const loadComments = useCallback(async () => {
    try {
      const res = await api.get(`/youtube/video/${encodeURIComponent(id)}/comments`);
      setComments(res.data.comments || res.data || []);
    } catch { /* silent */ }
  }, [id]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [vRes, rRes] = await Promise.allSettled([
          api.get(`/youtube/video/${encodeURIComponent(id)}`),
          api.get(`/youtube/video/${encodeURIComponent(id)}/recommend`),
        ]);
        if (vRes.status === 'fulfilled') {
          const vData = vRes.value.data.video || vRes.value.data;
          setVideo(vData);
          if (user) {
            trackActivity({ activity_type: 'youtube_video', page_url: `/youtube/${id}`, movie_title: vData.title });
          }
        }
        if (rRes.status === 'fulfilled') setRecs(rRes.value.data.recommendations || rRes.value.data || []);
        // Analysis
        const aRes = await api.get(`/youtube/video/${encodeURIComponent(id)}/analysis`);
        setAnalysis(aRes.data);
      } catch { /* no analysis */ }
      finally { setLoading(false); }
    })();
    loadComments();
  }, [id, loadComments, user]);

  const postComment = async () => {
    if (!commentText.trim()) { toast.error('Write a comment first'); return; }
    if (!user) { toast.error('Sign in to comment'); return; }
    setSubmitting(true);
    try {
      await api.post(`/youtube/video/${encodeURIComponent(id)}/comments`, { comment_text: commentText });
      toast.success('Comment posted!');
      setCommentText('');
      loadComments();
    } catch { toast.error('Failed to post comment'); }
    finally { setSubmitting(false); }
  };

  const filteredComments = comments.filter(c => commentFilter === 'all' || c.sentiment_label === commentFilter);
  const youtubeUrl = `https://www.youtube.com/watch?v=${id}`;

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={32} className="animate-spin" color="var(--accent)" /></div>;
  if (!video) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}><p style={{ color: 'var(--text-secondary)' }}>Video not found</p><Link href="/youtube" className="btn-primary" style={{ textDecoration: 'none' }}>Back to YouTube</Link></div>;

  const thumb = video.thumbnail || `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;

  return (
    <div className="page-container">
      <div style={{ display: 'grid', gap: '2rem', alignItems: 'start',marginTop: '1.5rem' }}>
        {/* Main content */}
        <div>
          {/* Player */}
          <div style={{ position: 'relative', paddingTop: '56.25%', background: '#000', borderRadius: '1rem', overflow: 'hidden', marginBottom: '1.25rem' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumb} alt={video.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3'; }} />
            {/* YouTube Play button */}
            <a href={youtubeUrl} target="_blank" rel="noopener noreferrer"
              style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', textDecoration: 'none' }}>
              <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.96 }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderRadius: '0.5rem', padding: '0.75rem 1.75rem' }}>
                <Play size={28} color="#fff" fill="#fff" />
                <span style={{ color: '#fff', fontWeight: 800, fontSize: '1rem' }}>Play on YouTube</span>
                <ExternalLink size={14} color="#fff" />
              </motion.div>
            </a>
          </div>

          {/* Title & meta */}
          <h1 style={{ fontWeight: 900, fontSize: '1.25rem', color: 'var(--text-primary)', lineHeight: 1.35, marginBottom: '0.75rem' }}>
            {video.title || titleParam}
          </h1>
          <div style={isMobile? undefined: {display:'flex',flexDirection:'row',gap:'1rem'}}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'center', marginBottom: '1.25rem', padding: '0.875rem 1.25rem', background: 'var(--bg-elevated)', borderRadius: '0.875rem', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.7rem',  color:'#787777ff', border: '1.5px solid rgba(125, 125, 125, 0.14)',WebkitBackdropFilter: 'blur(10px)',backdropFilter: 'blur(10px)',backgroundColor: '--var(--glass-bg)'}}>
                {(video.channel || 'C').trim().split(/\s+/).map(word => word[0]).join('').toUpperCase()}
              </div>
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{video.channel}</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'center', marginBottom: '1.25rem', padding: '0.875rem 1.25rem', background: 'var(--bg-elevated)', borderRadius: '0.875rem', border: '1px solid var(--border)' }}>
            {[
              { icon: Eye, val: fmtViews(video.views), label: 'Views' },
              { icon: ThumbsUp, val: fmtViews(video.likes), label: 'Likes' },
              { icon: ThumbsDown, val: fmtViews(video.dislikes), label: 'Dislikes' },
              { icon: MessageSquare, val: fmtViews(video.comment_count), label: 'Comments' },
            ].map(({ icon: Icon, val, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Icon size={14} color="var(--text-muted)" />
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{val}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{label}</span>
              </div>
            ))}
          </div>
          </div>

          {/* Fake engagement / AI analysis */}
          {analysis && (
            <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <TrendingUp size={16} color="var(--accent)" /> AI Video Analysis
                </h3>
                {analysis.is_suspicious && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'var(--warning-subtle)', border: '1px solid var(--warning)', color: 'var(--warning)', padding: '0.2rem 0.65rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700 }}>
                    <AlertTriangle size={11} /> Suspicious Engagement
                  </span>
                )}
              </div>
              {analysis.is_suspicious && analysis.flags.map((f, i) => (
                <p key={i} style={{ color: 'var(--warning)', fontSize: '0.82rem', marginBottom: '0.3rem' }}>⚠ {f}</p>
              ))}
              {analysis.sentiment_summary && (
                <div style={{ marginTop: '0.75rem' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{analysis.sentiment_summary.summary}</p>
                  <div style={{ height: '6px', background: 'var(--bg-elevated)', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                    {analysis.sentiment_summary.positive_pct > 0 && <div style={{ flex: analysis.sentiment_summary.positive_pct, background: 'var(--accent)' }} />}
                    {analysis.sentiment_summary.neutral_pct > 0 && <div style={{ flex: analysis.sentiment_summary.neutral_pct, background: 'var(--border)' }} />}
                    {analysis.sentiment_summary.negative_pct > 0 && <div style={{ flex: analysis.sentiment_summary.negative_pct, background: 'var(--danger)' }} />}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Comments */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h3 style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                Comments ({comments.length})
              </h3>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                {(['all', 'positive', 'negative', 'neutral'] as const).map(f => (
                  <button key={f} onClick={() => setCommentFilter(f)}
                    style={{ padding: '0.25rem 0.65rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, border: `1px solid ${commentFilter === f ? 'var(--accent-border)' : 'var(--border)'}`, background: commentFilter === f ? 'var(--accent-subtle)' : 'transparent', color: commentFilter === f ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize', transition: 'all 0.15s' }}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Post comment */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', alignItems: 'flex-start' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: user ? 'var(--bg-blur)' : 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.8rem', color: user ?  '#787777ff' : 'var(--text-muted)', flexShrink: 0 }}>
                {(user?.display_name || user?.username || 'U').trim().split(/\s+/).map(word => word[0]).join('').toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <textarea value={commentText} onChange={e => setCommentText(e.target.value)} placeholder={user ? 'Add a public comment… (AI will analyse sentiment)' : 'Sign in to comment'} disabled={!user} rows={2} className="input-base" style={{ resize: 'vertical', minHeight: '70px' }} />
                {user && (
                  <button onClick={postComment} disabled={submitting} style={{ marginTop: '0.5rem', padding: '0.8rem 1.1rem', fontSize: '0.82rem' ,  color:'#939090ff', border: '1.5px solid rgba(125, 125, 125, 0.14)',WebkitBackdropFilter: 'blur(10px)',backdropFilter: 'blur(10px)',backgroundColor: 'transparent',   display: 'inline-flex',alignItems: 'center',justifyContent: 'center',gap: '0.5rem',borderRadius: 'var(--radius-md)',fontWeight: 700,cursor: 'pointer',transition: 'background var(--transition), transform var(--transition)'}}>
                    {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                    {submitting ? ' Posting…' : ' Comment'}
                  </button>
                )}
              </div>
            </div>

            {/* Comment list */}
            {filteredComments.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No {commentFilter !== 'all' ? commentFilter : ''} comments yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {filteredComments.map(c => (
                  <motion.div key={c.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', gap: '0.75rem' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', color: 'var(--accent)', flexShrink: 0 }}>
                      {(c.username || 'U').trim().split(/\s+/).map(word => word[0]).join('').toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)' }}>{c.username}</span>
                        <span className={sentClass(c.sentiment_label)} style={{ fontSize: '0.68rem' }}>{sentIcon(c.sentiment_label)} {c.sentiment_label}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleDateString()}</span>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5 }}>{c.comment_text}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: Recommended */}
        {isMobile ? undefined : (
        <div>
          <h3 style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>Up Next</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.875rem' }}>
            {recs.slice(0, 10).map((r, i) => {
              const rThumb = r.thumbnail || `https://i.ytimg.com/vi/${r.video_id}/mqdefault.jpg`;
              return (
                <Link key={i} href={`/youtube/${encodeURIComponent(r.video_id)}?title=${encodeURIComponent(r.title)}`} style={{ display: 'flex', gap: '0.625rem', flexDirection: 'column',textDecoration: 'none' }}>
                  <div style={{ width: '100%',height: '150px', flexShrink: 0, position: 'relative', paddingTop: '67px', background: 'var(--bg-elevated)', borderRadius: '0.5rem', overflow: 'hidden' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={rThumb} alt={r.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3'; }} />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35, marginBottom: '0.2rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.title}</p>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{r.channel}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
        )}
      </div>

      <style>{`@media (max-width: 900px) { .video-layout { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
