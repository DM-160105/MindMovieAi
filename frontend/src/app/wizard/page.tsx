'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, Check, Loader2, Sparkles, X } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import toast from 'react-hot-toast';
import { useDevice } from '@/context/DeviceContext';

const GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
  'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi',
  'Thriller', 'Western', 'Family', 'History', 'Music', 'Biography',
];
const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

// Desktop masonry-ish pill styling helper
const getPillSize = (genreName: string) => {
  const len = genreName.length;
  if (len > 10) return 'col-span-2';
  return 'col-span-1';
};

const stepVariants = {
  initial: { opacity: 0, x: 20 },
  in: { opacity: 1, x: 0 },
  out: { opacity: 0, x: -20 },
};

function WizardContent() {
  const { savePreferences, refreshUser } = useAuth();
  const router = useRouter();
  const { isMobile } = useDevice();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    display_name: '', age: '', gender: '',
    favorite_genres: [] as string[],
    disliked_genres: [] as string[],
  });

  const totalSteps = 4;
  const progressPct = ((step - 1) / (totalSteps - 1)) * 100;

  const toggleGenre = (list: 'favorite_genres' | 'disliked_genres', genre: string) => {
    setForm(p => ({ ...p, [list]: p[list].includes(genre) ? p[list].filter(g => g !== genre) : [...p[list], genre] }));
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      await savePreferences({
        display_name: form.display_name || undefined,
        age: form.age ? Number(form.age) : undefined,
        gender: form.gender || undefined,
        favorite_genres: form.favorite_genres,
        disliked_genres: form.disliked_genres
      });
      await refreshUser();
      toast.success('Profile saved! Welcome to Mind Movie Ai!');
      router.push('/explore');
    } catch {
      toast.error('Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  const chipStyle = (active: boolean, variant: 'green' | 'red' = 'green'): React.CSSProperties => ({
    padding: isMobile ? '0.5rem 1rem' : '0.75rem 1.25rem',
    borderRadius: '16px',
    fontSize: isMobile ? '0.85rem' : '0.95rem',
    fontWeight: 600,
    border: `1px solid ${active ? (variant === 'green' ? 'var(--accent-border)' : 'var(--danger)') : 'var(--border)'}`,
    background: active ? (variant === 'green' ? 'var(--accent-subtle)' : 'var(--danger-subtle)') : 'var(--glass-bg)',
    color: active ? (variant === 'green' ? 'var(--accent)' : 'var(--danger)') : 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    justifyContent: 'center',
    boxShadow: active ? 'none' : 'var(--shadow-sm)',
    backdropFilter: 'var(--glass-blur)'
  });

  const genreCardStyle = (active: boolean, variant: 'green' | 'red' = 'green'): React.CSSProperties => ({
    padding: '1.25rem 0.75rem',
    borderRadius: '24px',
    fontSize: '0.95rem',
    fontWeight: 600,
    border: `2px solid ${active ? (variant === 'green' ? 'var(--accent)' : 'var(--danger)') : 'var(--border)'}`,
    background: active ? (variant === 'green' ? 'var(--accent-subtle)' : 'var(--danger-subtle)') : 'var(--glass-bg)',
    color: active ? (variant === 'green' ? 'var(--accent)' : 'var(--danger)') : 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
    justifyContent: 'center',
    boxShadow: active ? `0 0 20px ${variant === 'green' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}` : 'var(--shadow-sm)',
    backdropFilter: 'var(--glass-blur)'
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--bg)', paddingTop: isMobile ? '2rem' : '4rem' }}>
      {/* Progress bar (top edge) */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '4px', background: 'var(--border)', zIndex: 50 }}>
        <motion.div animate={{ width: `${progressPct}%` }} transition={{ duration: 0.5, ease: "easeInOut" }}
          style={{ height: '100%', background: 'linear-gradient(90deg, var(--accent-2), var(--accent))', borderRadius: '0 9999px 9999px 0' }} />
      </div>

      {/* Main Centered Content */}
      <div style={{
        margin: '0 auto',
        width: '100%',
        maxWidth: '900px',
        padding: isMobile ? '2rem 1.5rem 4rem' : '2rem 2rem 6rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        background: 'var(--bg)',
        position: 'relative'
      }}>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '3rem' }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: '4px', borderRadius: '4px', background: i + 1 <= step ? 'var(--accent)' : 'var(--border)', transition: 'all 0.4s' }} />
          ))}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" variants={stepVariants} initial="initial" animate="in" exit="out" transition={{ duration: 0.3 }}>
                <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Personalize</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', fontSize: '1.05rem' }}>Basic details help our ML model calibrate.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Display Name</label>
                    <input type="text" value={form.display_name} onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))} placeholder="How should we call you?" className="input-base" style={{ padding: '0.875rem 1rem' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Age</label>
                    <input type="number" value={form.age} onChange={e => setForm(p => ({ ...p, age: e.target.value }))} placeholder="Your age" className="input-base" min="1" max="120" style={{ padding: '0.875rem 1rem' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Gender</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      {GENDERS.map(g => (
                        <button key={g} onClick={() => setForm(p => ({ ...p, gender: g }))} style={chipStyle(form.gender === g)}>
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" variants={stepVariants} initial="initial" animate="in" exit="out" transition={{ duration: 0.3 }}>
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                  <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Genres you love</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Select the ones you usually gravitate towards.</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1.5rem' }}>
                  {GENRES.map(g => {
                    const active = form.favorite_genres.includes(g);
                    return (
                      <button key={g} onClick={() => toggleGenre('favorite_genres', g)} style={genreCardStyle(active)}>
                        <div style={{
                          width: '90px', height: '90px', borderRadius: '50%', overflow: 'hidden',
                          border: active ? '3px solid var(--accent)' : '3px solid transparent',
                          padding: '2px', background: 'var(--bg)', transition: 'all 0.3s'
                        }}>
                          {/* Use Next.js unoptimized remote image or standard img, picsum seed is deterministic */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`https://picsum.photos/seed/${g}/150/150`} alt={g} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                          {active && <Check size={16} />} {g}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" variants={stepVariants} initial="initial" animate="in" exit="out" transition={{ duration: 0.3 }}>
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                  <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Genres to skip</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>We&apos;ll actively avoid these in your feed.</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1.5rem' }}>
                  {GENRES.filter(g => !form.favorite_genres.includes(g)).map(g => {
                    const active = form.disliked_genres.includes(g);
                    return (
                      <button key={g} onClick={() => toggleGenre('disliked_genres', g)} style={genreCardStyle(active, 'red')}>
                        <div style={{
                          width: '90px', height: '90px', borderRadius: '50%', overflow: 'hidden',
                          border: active ? '3px solid var(--danger)' : '3px solid transparent',
                          padding: '2px', background: 'var(--bg)', transition: 'all 0.3s'
                        }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`https://picsum.photos/seed/${g}/150/150`} alt={g} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                          {active && <X size={16} />} {g}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="step4" variants={stepVariants} initial="initial" animate="in" exit="out" transition={{ duration: 0.3 }}>
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }}>
                    <div style={{ width: '90px', height: '90px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2.5rem', boxShadow: '0 0 40px var(--accent-border)' }}>
                      <Check size={44} color="#fff" />
                    </div>
                  </motion.div>
                  <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '1rem' }}>You&apos;re all set!</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '1rem', lineHeight: 1.6 }}>
                    {form.favorite_genres.length > 0 ? `We're building an initial model based on your love for ${form.favorite_genres.slice(0, 3).join(', ')}.` : "We'll show you a great mix of movies to start!"}
                  </p>
                  <div style={{ padding: '1.5rem', background: 'var(--bg-elevated)', borderRadius: '1rem', border: '1px solid var(--border)' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                      <Sparkles size={16} color="var(--accent)" /> AI Context Engine Enabled
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Navigation */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4rem', gap: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
          {step > 1 && (
            <button onClick={() => setStep(s => Math.max(1, s - 1))} className="btn-secondary" style={{ marginRight: 'auto' }}>
              <ArrowLeft size={16} /> Back
            </button>
          )}
          {step < totalSteps ? (
            <button onClick={() => setStep(s => s + 1)} className="btn-primary" style={{ paddingLeft: '2rem', paddingRight: '2rem' }}>
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <button onClick={handleFinish} disabled={loading} className="btn-primary" style={{ paddingLeft: '2rem', paddingRight: '2rem' }}>
              {loading ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><Check size={16} /> Start Exploring</>}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

export default function WizardPage() {
  return <ProtectedRoute><WizardContent /></ProtectedRoute>;
}

