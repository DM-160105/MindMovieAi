'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMood } from '@/context/MoodContext';
import { getMoods, getArcRecommendations, pingServer } from '@/lib/api';
import { Brain, Sparkles, ArrowRight, Loader2, Zap, Heart, Coffee, Flame, Sun, Moon, CloudRain, Wind, Music, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import useIsMobile from '@/hooks/useIsMobile';

const GENRE_OPTIONS = ['Drama', 'Comedy', 'Action', 'Thriller', 'Romance', 'Sci-Fi', 'Horror', 'Animation'];

const MOOD_ICONS: Record<string, React.ReactNode> = {
  anxious: <Zap size={14} />,
  melancholic: <CloudRain size={14} />,
  restless: <Wind size={14} />,
  numb: <Moon size={14} />,
  nostalgic: <Music size={14} />,
  bored: <Coffee size={14} />,
  overwhelmed: <Flame size={14} />,
  lonely: <Moon size={14} />,
  frustrated: <Flame size={14} />,
  exhausted: <Coffee size={14} />,
  inspired: <Star size={14} />,
  calm: <Sun size={14} />,
  hopeful: <Sparkles size={14} />,
  energized: <Zap size={14} />,
  cathartic: <CloudRain size={14} />,
  joyful: <Heart size={14} />,
  'at peace': <Sun size={14} />,
  motivated: <Flame size={14} />,
  amused: <Music size={14} />,
  comforted: <Heart size={14} />,
};

export default function MoodPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const {
    currentMood, setCurrentMood,
    desiredMood, setDesiredMood,
    selectedGenres, toggleGenre,
    setResults, setQueryArc, isLoading, setIsLoading,
  } = useMood();

  const [popularCurrent, setPopularCurrent] = useState<string[]>([]);
  const [popularDesired, setPopularDesired] = useState<string[]>([]);
  const [customCurrent, setCustomCurrent] = useState('');
  const [customDesired, setCustomDesired] = useState('');
  const [serverWaking, setServerWaking] = useState(false);
  const [arcPreviewPhase, setArcPreviewPhase] = useState(0);

  // Animate the arc preview
  useEffect(() => {
    const interval = setInterval(() => {
      setArcPreviewPhase(p => (p + 1) % 100);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  // Pre-warm server + load moods
  useEffect(() => {
    const loadMoods = async () => {
      try {
        const res = await getMoods();
        const data = res.data;
        setPopularCurrent(data.popular_current || []);
        setPopularDesired(data.popular_desired || []);
      } catch {
        // Fallback defaults
        setPopularCurrent(['anxious', 'melancholic', 'restless', 'numb', 'nostalgic', 'bored', 'overwhelmed', 'lonely', 'frustrated', 'exhausted']);
        setPopularDesired(['inspired', 'calm', 'hopeful', 'energized', 'cathartic', 'joyful', 'at peace', 'motivated', 'amused', 'comforted']);
      }
    };
    loadMoods();
    pingServer().catch(() => {});
  }, []);

  const handleSearch = useCallback(async () => {
    const activeCurrent = customCurrent.trim() || currentMood;
    const activeDesired = customDesired.trim() || desiredMood;

    if (!activeCurrent) {
      toast.error('Tell us how you feel right now');
      return;
    }
    if (!activeDesired) {
      toast.error('Tell us how you want to feel');
      return;
    }

    setIsLoading(true);
    const startTime = Date.now();

    try {
      const timeout = setTimeout(() => {
        if (Date.now() - startTime > 4000) {
          setServerWaking(true);
          toast('Waking up the server… usually takes 20–30 seconds on first visit', {
            icon: '☕',
            duration: 8000,
          });
        }
      }, 4000);

      const res = await getArcRecommendations({
        current_mood: activeCurrent,
        desired_mood: activeDesired,
        genres: selectedGenres,
        limit: 12,
      });

      clearTimeout(timeout);
      setResults(res.data.results || []);
      setQueryArc(res.data.query_arc || []);
      router.push('/mood/results');
    } catch (err) {
      toast.error('Failed to get recommendations. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
      setServerWaking(false);
    }
  }, [currentMood, desiredMood, customCurrent, customDesired, selectedGenres, setResults, setQueryArc, setIsLoading, router]);

  // Generate SVG arc preview points
  const generateArcPoints = () => {
    const w = 340, h = 100, points = 20;
    const pts: string[] = [];
    for (let i = 0; i <= points; i++) {
      const t = i / points;
      const x = 20 + t * (w - 40);
      
      // Current mood influence (starts dominant, fades)
      const currentInfluence = currentMood ? Math.sin(t * Math.PI * 1.5 + arcPreviewPhase * 0.03) * (1 - t) : 0;
      // Desired mood influence (grows over time)
      const desiredInfluence = desiredMood ? Math.sin(t * Math.PI * 2 + arcPreviewPhase * 0.05) * t : 0;
      
      const y = h / 2 + (currentInfluence * -25 + desiredInfluence * 30);
      pts.push(`${x},${y}`);
    }
    return pts.join(' ');
  };

  return (
    <div className="page-container" style={{ paddingTop: '1.5rem' }}>
      {/* Hero section */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.4rem 1rem', borderRadius: '9999px',
          background: 'var(--purple-subtle)', border: '1px solid rgba(139,92,246,0.25)',
          fontSize: '0.75rem', fontWeight: 600, color: 'var(--purple)',
          marginBottom: '1rem',
        }}>
          <Brain size={14} /> Emotional Arc Engine
        </div>
        <h1 style={{
          fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', fontWeight: 900,
          lineHeight: 1.15, letterSpacing: '-0.03em', marginBottom: '0.75rem',
        }}>
          Movies that match your{' '}
          <span style={{
            background: 'linear-gradient(135deg, var(--accent), var(--purple))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            emotional journey
          </span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '520px', margin: '0 auto' }}>
          Tell us how you feel and how you want to feel. We&apos;ll find movies whose emotional arcs bridge that gap.
        </p>
      </div>

      {/* Mood selection grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem', marginBottom: '2rem',
      }}>
        {/* Current mood */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem'}}>
            <div style={{
              width: '50px', height: '50px', borderRadius: '50%',
              background: 'var(--danger-subtle)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--danger)',
            }}>
              <CloudRain size={26} style={{ color: 'var(--danger)' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1.2 }}>How do you feel now?</h2>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Select or describe your current mood</span>
            </div>
          </div>

          {/* Pill buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
            {popularCurrent.map(mood => (
              <button
                key={mood}
                onClick={() => { setCurrentMood(mood); setCustomCurrent(''); }}
                className="mood-pill"
                data-active={currentMood === mood}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  padding: '0.35rem 0.75rem', borderRadius: '9999px',
                  fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                  border: currentMood === mood ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                  background: currentMood === mood ? 'var(--accent-subtle)' : 'transparent',
                  color: currentMood === mood ? 'var(--accent)' : 'var(--text-secondary)',
                  transition: 'all 0.2s ease',
                }}
              >
                {MOOD_ICONS[mood]} {mood}
              </button>
            ))}
          </div>

          {/* Free text */}
          <input
            type="text"
            className="input-base"
            placeholder="Or describe your mood in your own words..."
            value={customCurrent}
            onChange={(e) => { setCustomCurrent(e.target.value); if (e.target.value) setCurrentMood(''); }}
            style={{ fontSize: '0.85rem' }}
          />
        </div>

        {/* Desired mood */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{
              width: '50px', height: '50px', borderRadius: '50%',
              background: 'var(--accent-subtle)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--accent)',
            }}>
              <Sparkles size={23} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1.2 }}>How do you want to feel?</h2>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Your desired emotional destination</span>
            </div>
          </div>

          {/* Pill buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
            {popularDesired.map(mood => (
              <button
                key={mood}
                onClick={() => { setDesiredMood(mood); setCustomDesired(''); }}
                className="mood-pill"
                data-active={desiredMood === mood}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  padding: '0.35rem 0.75rem', borderRadius: '9999px',
                  fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                  border: desiredMood === mood ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                  background: desiredMood === mood ? 'var(--accent-subtle)' : 'transparent',
                  color: desiredMood === mood ? 'var(--accent)' : 'var(--text-secondary)',
                  transition: 'all 0.2s ease',
                }}
              >
                {MOOD_ICONS[mood]} {mood}
              </button>
            ))}
          </div>

          {/* Free text */}
          <input
            type="text"
            className="input-base"
            placeholder="Or describe your desired mood..."
            value={customDesired}
            onChange={(e) => { setCustomDesired(e.target.value); if (e.target.value) setDesiredMood(''); }}
            style={{ fontSize: '0.85rem' }}
          />
        </div>
      </div>

      <div style={isMobile ? undefined : { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        

      {/* Genre filter */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
          Filter by genre <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {GENRE_OPTIONS.map(genre => (
            <button
              key={genre}
              onClick={() => toggleGenre(genre)}
              style={{
                padding: '0.35rem 0.85rem', borderRadius: '9999px',
                fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                border: selectedGenres.includes(genre) ? '1.5px solid var(--purple)' : '1px solid var(--border)',
                background: selectedGenres.includes(genre) ? 'var(--purple-subtle)' : 'transparent',
                color: selectedGenres.includes(genre) ? 'var(--purple)' : 'var(--text-secondary)',
                transition: 'all 0.2s ease',
              }}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* Arc preview */}
      <div className="card" style={{
        padding: '1.5rem', marginBottom: '1.5rem', textAlign: 'center',
        background: 'linear-gradient(135deg, var(--bg-card), var(--bg-elevated))',
        overflow: 'hidden', position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.08), transparent 60%)',
          pointerEvents: 'none',
        }} />
        <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Emotional Arc Preview
        </p>
        <svg width="340" height="100" viewBox="0 0 340 100" style={{ maxWidth: '100%', height: 'auto' }}>
          {/* Grid lines */}
          {[25, 50, 75].map(y => (
            <line key={y} x1="20" y1={y} x2="320" y2={y} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="4 4" />
          ))}
          
          {/* The arc line */}
          <polyline
            points={generateArcPoints()}
            fill="none"
            stroke="url(#arcGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              filter: 'drop-shadow(0 0 6px var(--accent))',
              transition: 'all 0.15s ease-out',
            }}
          />
          
          <defs>
            <linearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--danger)" />
              <stop offset="30%" stopColor="var(--warning)" />
              <stop offset="70%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="var(--purple)" />
            </linearGradient>
          </defs>

          {/* Labels */}
          <text x="25" y="95" fontSize="9" fill="var(--text-muted)" fontFamily="Inter">
            {currentMood || customCurrent || 'Current'}
          </text>
          <text x="310" y="95" fontSize="9" fill="var(--text-muted)" fontFamily="Inter" textAnchor="end">
            {desiredMood || customDesired || 'Desired'}
          </text>
        </svg>
      </div>
      </div>

      {/* CTA */}
      <div style={{ textAlign: 'center' }}>
        <button
          onClick={handleSearch}
          disabled={isLoading}
          className="btn-primary"
          style={{
            padding: '0.875rem 2.5rem', fontSize: '1rem',
            borderRadius: 'var(--radius-lg)',
            background: 'linear-gradient(135deg, var(--accent), var(--purple))',
            boxShadow: '0 4px 24px rgba(16,185,129,0.25)',
            gap: '0.6rem',
          }}
        >
          {isLoading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              {serverWaking ? 'Waking up server...' : 'Finding movies...'}
            </>
          ) : (
            <>
              <Brain size={18} /> Find My Movies <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
