'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useVibe } from '@/context/VibeContext';
import { getVibePresets, getVibeMatch } from '@/lib/api';
import VibeRadar from '@/components/VibeRadar';
import { Aperture, Sparkles, ArrowRight, Loader2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDevice } from '@/context/DeviceContext';

const GENRE_OPTIONS = ['Drama', 'Comedy', 'Action', 'Thriller', 'Romance', 'Sci-Fi', 'Horror', 'Animation', 'Mystery', 'Crime'];

const PLACEHOLDER_EXAMPLES = [
  'rainy city at 3am, neon reflections, melancholic and slow...',
  'warm Mediterranean coast, golden light, slow lunches and wine...',
  'cold sterile office, sharp suits, psychological tension...',
  'dusty summer road trip, open highway, nostalgic freedom...',
  'foggy European city, old cobblestones, quiet cafes at dusk...',
  'neon cyberpunk future, electric streets, dystopian rain...',
];

export default function VibePage() {
  const router = useRouter();
  const {
    vibeText, setVibeText,
    selectedPreset, setSelectedPreset,
    selectedGenres, toggleGenre,
    setResults, setQueryVector, setQueryTags,
    queryVector, isLoading, setIsLoading,
  } = useVibe();

  const [presets, setPresets] = useState<Array<{
    id: string; display_name: string; emoji: string; description: string; vector: number[];
  }>>([]);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [liveVector, setLiveVector] = useState<number[]>(queryVector);
  const [serverWaking, setServerWaking] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { isMobile } = useDevice();

  // Cycle placeholder examples
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex(i => (i + 1) % PLACEHOLDER_EXAMPLES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Load presets
  useEffect(() => {
    getVibePresets()
      .then(res => setPresets(res.data.presets || []))
      .catch(() => {});
  }, []);

  // Live radar debounced update as user types
  useEffect(() => {
    if (selectedPreset) {
      setLiveVector(selectedPreset.vector);
      return;
    }
    if (!vibeText || vibeText.length < 4) {
      setLiveVector([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await getVibeMatch({ vibe_text: vibeText, limit: 1 });
        const v = res.data.query_vector;
        if (v && v.length === 6) setLiveVector(v);
      } catch {}
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [vibeText, selectedPreset]);

  const handleSearch = useCallback(async () => {
    const hasText = vibeText.trim().length > 0;
    const hasPreset = !!selectedPreset;

    if (!hasText && !hasPreset) {
      toast.error('Describe a vibe or pick a preset first');
      return;
    }

    setIsLoading(true);
    const wakingTimer = setTimeout(() => {
      setServerWaking(true);
      toast('Waking up the server… usually takes 20–30 seconds on first visit', {
        icon: '☕', duration: 8000,
      });
    }, 4000);

    try {
      const res = await getVibeMatch({
        vibe_text: hasText ? vibeText : undefined,
        preset_id: hasPreset ? selectedPreset!.id : undefined,
        genres: selectedGenres.length > 0 ? selectedGenres : undefined,
        limit: 12,
      });
      clearTimeout(wakingTimer);
      setResults(res.data.results || []);
      setQueryVector(res.data.query_vector || liveVector);
      setQueryTags(res.data.query_tags || []);
      router.push('/vibe/results');
    } catch {
      toast.error('Could not get recommendations. Please try again.');
    } finally {
      setIsLoading(false);
      setServerWaking(false);
    }
  }, [vibeText, selectedPreset, selectedGenres, liveVector, setResults, setQueryVector, setQueryTags, setIsLoading, router]);

  return (
    <div className="page-container" style={{ paddingTop: '1.5rem' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.4rem 1rem', borderRadius: '9999px',
          background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)',
          fontSize: '0.75rem', fontWeight: 600, color: '#fbbf24',
          marginBottom: '1rem',
        }}>
          <Aperture size={14} /> Cinematic Atmosphere Engine
        </div>
        <h1 style={{
          fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', fontWeight: 900,
          lineHeight: 1.15, letterSpacing: '-0.03em', marginBottom: '0.75rem',
        }}>
          What world do you want to{' '}
          <span style={{
            background: 'linear-gradient(135deg, #fbbf24, #fb923c)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            live in for two hours?
          </span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '540px', margin: '0 auto' }}>
          Describe a texture, not a plot. The world you want to inhabit — its light, pace, setting, temperature. We find films whose documented atmosphere matches yours.
        </p>
      </div>

      {/* Main content: left = input, right = live radar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(200px, 1fr))' : 'minmax(0, 1fr) 500px',
        gap: '1.5rem',
        marginBottom: '1.5rem',
        alignItems: 'start',
      }}>
        {/* Left column */}
        <div>
          {/* Textarea */}
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.6rem' }}>
              Describe the atmosphere
            </label>
            <div style={{ position: 'relative' }}>
              <textarea
                id="vibe-textarea"
                className="input-base"
                rows={4}
                placeholder={PLACEHOLDER_EXAMPLES[placeholderIndex]}
                value={vibeText}
                onChange={e => {
                  setVibeText(e.target.value);
                  if (selectedPreset) setSelectedPreset(null);
                }}
                style={{
                  resize: 'vertical',
                  fontSize: '0.95rem',
                  lineHeight: 1.7,
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  userSelect: 'text',
                  WebkitUserSelect: 'text',
                }}
              />
              {vibeText && (
                <div style={{
                  position: 'absolute', bottom: '0.75rem', right: '0.75rem',
                  fontSize: '0.7rem', color: 'var(--text-muted)',
                }}>
                  {vibeText.length} chars
                </div>
              )}
            </div>
            {selectedPreset && (
              <div style={{
                marginTop: '0.6rem', padding: '0.4rem 0.75rem', borderRadius: '9999px',
                background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)',
                fontSize: '0.78rem', color: '#fbbf24', fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              }}>
                {selectedPreset.emoji} {selectedPreset.display_name} preset active
                <button onClick={() => setSelectedPreset(null)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#fbbf24', fontWeight: 700, marginLeft: '0.2rem', fontSize: '0.9rem',
                }}>×</button>
              </div>
            )}
          </div>

          {/* Genre filter */}
          <div className="card" style={{ padding: '1.1rem', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Filter by genre <span style={{ fontWeight: 400 }}>(optional)</span>
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {GENRE_OPTIONS.map(genre => (
                <button
                  key={genre}
                  onClick={() => toggleGenre(genre)}
                  style={{
                    padding: '0.3rem 0.75rem', borderRadius: '9999px',
                    fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                    border: selectedGenres.includes(genre) ? '1.5px solid #fbbf24' : '1px solid var(--border)',
                    background: selectedGenres.includes(genre) ? 'rgba(251,191,36,0.12)' : 'transparent',
                    color: selectedGenres.includes(genre) ? '#fbbf24' : 'var(--text-secondary)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>

          {/* CTA */}
          <button
            id="vibe-submit"
            onClick={handleSearch}
            disabled={isLoading}
            className="btn-primary"
            style={{
              width: '100%', padding: '0.9rem', fontSize: '1rem',
              background: 'linear-gradient(135deg, #fbbf24, #fb923c)',
              boxShadow: '0 4px 24px rgba(251,191,36,0.25)',
              borderRadius: 'var(--radius-lg)', gap: '0.6rem',
            }}
          >
            {isLoading ? (
              <><Loader2 size={18} className="animate-spin" />{serverWaking ? 'Waking up server...' : 'Finding films...'}</>
            ) : (
              <><Search size={18} /> Find my films <ArrowRight size={16} /></>
            )}
          </button>
        </div>

        {/* Right column — live radar */}
        <div style={{ position: 'sticky', top: '80px' }}>
          <div className="card" style={{
            padding: '1.25rem', textAlign: 'center',
            background: 'linear-gradient(135deg, var(--bg-card), var(--bg-elevated))',
          }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Atmosphere Fingerprint
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
              <VibeRadar
                vector={liveVector}
                size={200}
                showLabels
                animated
              />
            </div>
            {/* Dimension legend */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem', textAlign: 'left' }}>
              {[
                { label: 'Lighting',  color: '#60a5fa', val: liveVector[0] },
                { label: 'Pacing',    color: '#2dd4bf', val: liveVector[1] },
                { label: 'Setting',   color: '#a78bfa', val: liveVector[2] },
                { label: 'Temp',      color: '#fb923c', val: liveVector[3] },
                { label: 'Texture',   color: '#fbbf24', val: liveVector[4] },
                { label: 'Era',       color: '#4ade80', val: liveVector[5] },
              ].map(d => (
                <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{d.label}</span>
                  <span style={{ fontSize: '0.68rem', color: d.color, marginLeft: 'auto', fontWeight: 700 }}>
                    {Math.round(d.val * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Preset grid */}
      <div>
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Sparkles size={14} /> Or pick a vibe preset
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(150px, 1fr))' : 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '0.75rem',
        }}>
          {(presets.length > 0 ? presets : FALLBACK_PRESETS).map(preset => {
            const isSelected = selectedPreset?.id === preset.id;
            return (
              <button
                key={preset.id}
                id={`preset-${preset.id}`}
                onClick={() => {
                  setSelectedPreset(isSelected ? null : preset);
                  if (!isSelected) setVibeText('');
                }}
                style={{
                  padding: '0.9rem 1rem', borderRadius: 'var(--radius-md)',
                  border: isSelected ? '2px solid #fbbf24' : '1.5px solid var(--border)',
                  background: isSelected ? 'rgba(251,191,36,0.08)' : 'var(--glass-bg)',
                  backdropFilter: 'var(--glass-blur)',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? '0 0 16px rgba(251,191,36,0.15)' : 'none',
                }}
                className="card-hover"
              >
                <div style={{ fontSize: '1.4rem', marginBottom: '0.3rem' }}>{preset.emoji}</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isSelected ? '#fbbf24' : 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  {preset.display_name}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {preset.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile responsive override */}
      <style>{`
        @media (max-width: 768px) {
          .vibe-layout { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

// Fallback presets if server is cold
const FALLBACK_PRESETS = [
  { id: 'rainy-city-night',   emoji: '🌧️', display_name: 'Rainy city night',      description: 'neon reflections, wet streets, 3am loneliness',       vector: [0.15, 0.22, 0.82, 0.18, 0.58, 0.72] },
  { id: 'dusty-road-trip',    emoji: '🛣️', display_name: 'Dusty road trip',        description: 'open highway, warm summer, nostalgic freedom',        vector: [0.85, 0.52, 0.28, 0.88, 0.45, 0.32] },
  { id: 'cold-corporate',     emoji: '🏢', display_name: 'Cold corporate thriller', description: 'sterile offices, sharp suits, psychological games',    vector: [0.78, 0.68, 0.88, 0.08, 0.85, 0.82] },
  { id: 'cozy-cabin',         emoji: '🏔️', display_name: 'Cozy cabin winter',      description: 'firelit interiors, snow outside, intimate warmth',    vector: [0.52, 0.18, 0.12, 0.65, 0.35, 0.42] },
  { id: 'neon-cyberpunk',     emoji: '⚡', display_name: 'Neon cyberpunk',          description: 'electric cities, rain, future dystopia',              vector: [0.22, 0.88, 0.92, 0.22, 0.72, 0.92] },
  { id: 'mediterranean-sun',  emoji: '☀️', display_name: 'Mediterranean sun',       description: 'golden coasts, slow lunches, sensory warmth',         vector: [0.95, 0.32, 0.48, 0.92, 0.28, 0.45] },
  { id: 'dark-gothic',        emoji: '🌲', display_name: 'Dark gothic forest',      description: 'ancient trees, dread, beautiful isolation',           vector: [0.08, 0.15, 0.12, 0.15, 0.62, 0.15] },
  { id: '80s-neon-pastel',    emoji: '🕹️', display_name: '80s neon pastel',        description: 'synth pop colours, arcade glow, retro energy',        vector: [0.55, 0.72, 0.78, 0.58, 0.68, 0.22] },
  { id: 'sparse-desert',      emoji: '🏜️', display_name: 'Sparse desert',          description: 'vast emptiness, brutal sun, existential silence',     vector: [0.95, 0.15, 0.05, 0.95, 0.22, 0.45] },
  { id: 'gritty-realism',     emoji: '🏗️', display_name: 'Gritty urban realism',   description: 'handheld camera, grey concrete, raw truth',           vector: [0.32, 0.58, 0.82, 0.25, 0.08, 0.62] },
  { id: 'foggy-european',     emoji: '🌫️', display_name: 'Foggy European',         description: 'old cobblestones, grey skies, quiet cafes',           vector: [0.28, 0.20, 0.52, 0.28, 0.42, 0.18] },
  { id: 'underwater-dreamlike', emoji: '🌀', display_name: 'Dreamlike & surreal',  description: 'logic bends, colour saturated, hypnotic flow',        vector: [0.55, 0.28, 0.45, 0.52, 0.38, 0.52] },
];
