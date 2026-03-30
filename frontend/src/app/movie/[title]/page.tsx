'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getMovieDetails, getRecommendations, trackActivity } from '@/lib/api';
import api from '@/lib/api';
import PosterImage from '@/components/PosterImage';
import MovieCard from '@/components/MovieCard';
import SaveButton from '@/components/SaveButton';
import { motion } from 'framer-motion';
import {
  Star, ArrowLeft, Send, Loader2, AlertCircle, Clock, Globe,
  DollarSign, BarChart2, Users, MapPin, Briefcase, Tag,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import type { Movie } from '@/components/MovieCard';
import { useIsMobile } from '@/hooks/useIsMobile';

interface CastMember {
  name: string;
  character?: string;
  order?: number;
}

interface Review {
  id: number;
  username: string;
  review_text: string;
  sentiment_label: 'positive' | 'negative' | 'neutral';
  sentiment_confidence: number;
  created_at: string;
}

interface MovieDetail {
  title: string;
  overview?: string;
  poster?: string;        // API returns 'poster'
  poster_url?: string;    // some responses return 'poster_url'
  vote_average?: number;
  rating?: number;
  vote_count?: number;
  year?: number;
  genres?: string[];
  cast?: CastMember[];
  director?: string;
  runtime?: number;
  tagline?: string;
  budget?: number;
  revenue?: number;
  popularity?: number;
  status?: string;
  original_language?: string;
  release_date?: string;
  production_countries?: string[];
  spoken_languages?: string[];
  production_companies?: string[];
  keywords?: string[];
}

const sentimentStyle = (label: string) => {
  if (label === 'positive') return 'badge-positive';
  if (label === 'negative') return 'badge-negative';
  return 'badge-neutral';
};
const sentimentIcon = (label: string) => label === 'positive' ? '✅' : label === 'negative' ? '❌' : '➖';

function formatCurrency(n: number | undefined | null): string | null {
  if (!n || n <= 0) return null;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function MetaChip({ label }: { label: string }) {
  return (
    <span style={{
      padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600,
      background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
    }}>{label}</span>
  );
}

export default function MovieDetailPage() {
  const { title } = useParams<{ title: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [recs, setRecs] = useState<Movie[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  const decodedTitle = decodeURIComponent(title);

  const fetchReviews = useCallback(async () => {
    try {
      const res = await api.get(`/movies/${encodeURIComponent(decodedTitle)}/reviews`);
      setReviews(res.data.reviews || res.data || []);
    } catch { /* no reviews yet */ }
  }, [decodedTitle]);

  useEffect(() => {
    // Track movie click for future personalized recommendations
    trackActivity({ activity_type: 'movie_click', movie_title: decodedTitle, page_url: `/movie/${title}` });

    // Load all 3 data sources in parallel for maximum speed
    (async () => {
      setLoading(true);
      const [detRes, recRes, revRes] = await Promise.allSettled([
        getMovieDetails(decodedTitle),
        getRecommendations(decodedTitle),
        api.get(`/movies/${encodeURIComponent(decodedTitle)}/reviews`),
      ]);

      if (detRes.status === 'fulfilled') {
        const d = detRes.value.data;
        setMovie(d.movie || d);
      } else {
        toast.error('Movie not found');
      }

      if (recRes.status === 'fulfilled') {
        const r = recRes.value.data;
        setRecs(r.recommendations || r.movies || r || []);
      }

      if (revRes.status === 'fulfilled') {
        setReviews(revRes.value.data?.reviews || revRes.value.data || []);
      }

      setLoading(false);
    })();
  }, [decodedTitle, title]);  

  const submitReview = async () => {
    if (!reviewText.trim()) { toast.error('Write something first'); return; }
    if (!user) { toast.error('Please log in to review'); return; }
    setSubmitting(true);
    try {
      await api.post(`/movies/${encodeURIComponent(decodedTitle)}/reviews`, { review_text: reviewText });
      toast.success('Review posted!');
      setReviewText('');
      fetchReviews();
    } catch { toast.error('Failed to post review'); }
    finally { setSubmitting(false); }
  };

  const sentSummary = reviews.length > 0 ? {
    pos: reviews.filter(r => r.sentiment_label === 'positive').length,
    neg: reviews.filter(r => r.sentiment_label === 'negative').length,
    neu: reviews.filter(r => r.sentiment_label === 'neutral').length,
  } : null;

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <Loader2 size={36} color="var(--accent)" className="animate-spin" />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading movie details…</p>
      </div>
    </div>
  );

  if (!movie) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
      <AlertCircle size={40} color="var(--danger)" />
      <p style={{ color: 'var(--text-secondary)' }}>Movie not found</p>
      <Link href="/explore" className="btn-primary" style={{ textDecoration: 'none' }}>Back to Explore</Link>
    </div>
  );

  // Resolve poster: API can return 'poster' or 'poster_url'
  const posterSrc = movie.poster || movie.poster_url || null;
  const rating = movie.vote_average ?? movie.rating;
  const castNames = (movie.cast || []).map(c => typeof c === 'string' ? c : c.name).filter(Boolean);
  const budgetStr = formatCurrency(movie.budget);
  const revenueStr = formatCurrency(movie.revenue);

  return (
    <div className="page-container" style={isMobile ? { padding: '1rem' } : undefined}>
    

      {/* Hero section */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        style={isMobile ? { display: 'grid', gridTemplateRows: 'auto 1fr', gap: '2.5rem', marginBottom: '3rem', alignItems: 'start',marginTop: '10px' } : { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2.5rem', marginBottom: '3rem', alignItems: 'start',marginTop: '20px' }}>
        {/* Poster */}
        {isMobile ? (  <div style={{ display: 'flex', alignItems: 'center',justifyContent: 'center',flex:"inline-flex"}}><div style={{ width:'200px', flexShrink: 0}}>
          <div className="card" style={{ overflow: 'hidden', borderRadius: '1rem', aspectRatio: '2/3', minHeight: '280px'}}>
            <PosterImage src={posterSrc} alt={movie.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
          {user && (
            <div style={{ marginTop: '1rem' }}>
              <SaveButton movieTitle={movie.title} />
            </div>
            
          )}
        </div>
      </div>) : (  <div style={{ width: '346px', flexShrink: 0 }}>
          <div className="card" style={{ overflow: 'hidden', borderRadius: '1rem', aspectRatio: '2/3', minHeight: '280px' }}>
            <PosterImage src={posterSrc} alt={movie.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
          {user && (
            <div style={{ marginTop: '1rem' }}>
              <SaveButton movieTitle={movie.title} />
            </div>
          )}
        </div>)}
      

        {/* Info */}
        <div>
          {movie.tagline && (
            <p style={{ color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
              {movie.tagline}
            </p>
          )}
          <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: '0.75rem', lineHeight: 1.2 }}>
            {movie.title}
          </h1>

          {/* Core stats row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
            {rating && rating > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--star)', fontWeight: 800, fontSize: '1rem' }}>
                <Star size={16} fill="var(--star)" color="var(--star)" /> {Number(rating).toFixed(1)}/10
              </span>
            )}
            {movie.vote_count && movie.vote_count > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                <Users size={13} /> {movie.vote_count.toLocaleString()} votes
              </span>
            )}
            {movie.year && <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{movie.year}</span>}
            {movie.runtime && movie.runtime > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                <Clock size={13} /> {movie.runtime} min
              </span>
            )}
            {movie.status && (
              <span style={{ padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}>
                {movie.status}
              </span>
            )}
          </div>

          {/* Genres */}
          {movie.genres && movie.genres.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.25rem' }}>
              {movie.genres.map(g => <span key={g} className="genre-chip">{g}</span>)}
            </div>
          )}

          {/* Overview */}
          {movie.overview && (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '1.25rem', maxWidth: '600px', textAlign: 'justify', paddingRight: isMobile ? '1rem' : undefined, paddingLeft: isMobile ? '1rem' : undefined }}>
              <p style={{ fontWeight: 700,fontSize: '1.2rem',marginBottom: '0.5rem', }}>Overview</p>
              {movie.overview}
            </div>
          )}

          {/* Director & Cast */}
          {movie.director && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
              Directed by <strong style={{ color: 'var(--text-secondary)' }}>{movie.director}</strong>
            </p>
          )}
          {castNames.length > 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Cast: <strong style={{ color: 'var(--text-secondary)' }}>{castNames.slice(0, 5).join(', ')}{castNames.length > 5 ? '…' : ''}</strong>
            </p>
          )}

          {/* Extended metadata grid */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(150px, 1fr))' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.875rem', marginTop: '1rem' }}>
            {/* Budget */}
            {budgetStr && (
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '0.75rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                  <DollarSign size={13} color="var(--text-muted)" />
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Budget</span>
                </div>
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{budgetStr}</span>
              </div>
            )}

            {/* Revenue */}
            {revenueStr && (
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '0.75rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                  <BarChart2 size={13} color="var(--text-muted)" />
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Revenue</span>
                </div>
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{revenueStr}</span>
              </div>
            )}

            {/* Language */}
            {movie.original_language && (
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '0.75rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                  <Globe size={13} color="var(--text-muted)" />
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Language</span>
                </div>
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)', textTransform: 'uppercase' }}>{movie.original_language}</span>
              </div>
            )}

            {/* Popularity */}
            {movie.popularity && movie.popularity > 0 && (
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '0.75rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                  <BarChart2 size={13} color="var(--text-muted)" />
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Popularity</span>
                </div>
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{Number(movie.popularity).toFixed(1)}</span>
              </div>
            )}
          </div>

          {/* Production countries */}
          {movie.production_countries && movie.production_countries.length > 0 && (
            <div style={{ marginTop: '0.875rem' }}>
              <p style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
                <MapPin size={12} /> Countries
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {movie.production_countries.map(c => <MetaChip key={c} label={c} />)}
              </div>
            </div>
          )}

          {/* Production companies */}
          {movie.production_companies && movie.production_companies.length > 0 && (
            <div style={{ marginTop: '0.875rem' }}>
              <p style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
                <Briefcase size={12} /> Studios
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {movie.production_companies.slice(0, 4).map(c => <MetaChip key={c} label={c} />)}
              </div>
            </div>
          )}

          {/* Keywords */}
          {movie.keywords && movie.keywords.length > 0 && (
            <div style={{ marginTop: '0.875rem' }}>
              <p style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
                <Tag size={12} /> Keywords
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {movie.keywords.slice(0, 10).map(k => <MetaChip key={k} label={k} />)}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Reviews section */}
      <div className="card" style={{ padding: '1.75rem', marginBottom: '3rem' }}>
        <h2 style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '1.25rem' }}>
          Reviews &amp; Sentiment Analysis
        </h2>

        {/* Sentiment summary bar */}
        {sentSummary && (
          <div style={{ marginBottom: '1.5rem', background: 'var(--bg-elevated)', borderRadius: '0.75rem', overflow: 'hidden', height: '8px', display: 'flex' }}>
            {sentSummary.pos > 0 && <div style={{ flex: sentSummary.pos, background: 'var(--accent)', transition: 'flex 0.5s' }} title={`${sentSummary.pos} positive`} />}
            {sentSummary.neu > 0 && <div style={{ flex: sentSummary.neu, background: 'var(--border)', transition: 'flex 0.5s' }} title={`${sentSummary.neu} neutral`} />}
            {sentSummary.neg > 0 && <div style={{ flex: sentSummary.neg, background: 'var(--danger)', transition: 'flex 0.5s' }} title={`${sentSummary.neg} negative`} />}
          </div>
        )}
        {sentSummary && (
          <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {[{ label: '✅ Positive', count: sentSummary.pos, cls: 'badge-positive' },
              { label: '➖ Neutral', count: sentSummary.neu, cls: 'badge-neutral' },
              { label: '❌ Negative', count: sentSummary.neg, cls: 'badge-negative' }].map(x => (
              <span key={x.label} className={x.cls} style={{ fontSize: '0.8rem' }}>{x.label}: {x.count}</span>
            ))}
          </div>
        )}

        {/* Post review */}
        {user ? (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '50%',border: '1.5px solid var(--border)', background: 'var(--bg-blur)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', color: '#787777ff', flexShrink: 0 }}>
              {(user.display_name || user.username || 'U').trim().split(/\s+/).map(word => word[0]).join('').toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <textarea
                value={reviewText}
                onChange={e => setReviewText(e.target.value)}
                placeholder="Share your thoughts… Our AI will analyse the sentiment."
                rows={3}
                className="input-base"
                style={{ resize: 'vertical', minHeight: '80px' }}
              />
              <button onClick={submitReview} disabled={submitting} style={{ marginTop: '0.5rem', padding: '0.8rem 1.1rem', fontSize: '0.82rem' ,  color:'#939090ff', border: '1.5px solid rgba(125, 125, 125, 0.14)',WebkitBackdropFilter: 'blur(10px)',backdropFilter: 'blur(10px)',backgroundColor: 'transparent',   display: 'inline-flex',alignItems: 'center',justifyContent: 'center',gap: '0.5rem',borderRadius: 'var(--radius-md)',fontWeight: 700,cursor: 'pointer',transition: 'background var(--transition), transform var(--transition)'}}>
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {submitting ? ' Posting…' : ' Post Review'}
              </button>
            </div>
          </div>
        ) : (
          <Link href="/login" style={{ color: 'var(--accent)', fontSize: '0.875rem', display: 'block', marginBottom: '1.5rem' }}>Sign in to write a review →</Link>
        )}

        {/* Review list */}
        {reviews.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No reviews yet. Be the first!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {reviews.map((r) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '0.875rem', padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent)' }}>
                      {(r.username || 'U').trim().split(/\s+/).map(word => word[0]).join('').toUpperCase()}
                    </div>
                    <span style={{ fontWeight: 700, fontSize:isMobile ? '0.6rem' : '0.8rem', color: 'var(--text-primary)' }}>{r.username}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className={sentimentStyle(r.sentiment_label)} style={{ fontSize: isMobile ? '0.4rem' : '0.72rem' }}>
                      {sentimentIcon(r.sentiment_label)} {r.sentiment_label} {r.sentiment_confidence > 0 && `(${Math.round(r.sentiment_confidence * 100)}%)`}
                    </span>
                    <span style={{ fontSize: isMobile ? '0.5rem' : '0.72rem', color: 'var(--text-muted)' }}>{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>{r.review_text}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Similar recommendations */}
      {recs.length > 0 && (
        <div>
          <h2 style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '1.5rem' }}>More Like This</h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(140px, 1fr))' : 'repeat(auto-fill, minmax(230px, 1fr))', gap: '1rem' }}>
            {recs.slice(0, 12).map((m, i) => (
              <MovieCard key={`${m.title}-${i}`} movie={m} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
