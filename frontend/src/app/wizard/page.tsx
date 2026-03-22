'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, Check, Loader2 } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import toast from 'react-hot-toast';

const GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
  'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi',
  'Thriller', 'Western', 'Family', 'History', 'Music', 'Biography',
];
const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

const stepVariants = {
  initial: { opacity: 0, x: 40 },
  in: { opacity: 1, x: 0 },
  out: { opacity: 0, x: -40 },
};

function WizardContent() {
  const { savePreferences, refreshUser } = useAuth();
  const router = useRouter();
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
      await savePreferences({ display_name: form.display_name || undefined, age: form.age ? Number(form.age) : undefined, gender: form.gender || undefined, favorite_genres: form.favorite_genres, disliked_genres: form.disliked_genres });
      await refreshUser();
      toast.success('Profile saved! Welcome to Mind Movie Ai!');
      router.push('/explore');
    } catch { toast.error('Failed to save preferences'); }
    finally { setLoading(false); }
  };

  const chipStyle = (active: boolean, variant: 'green' | 'red' = 'green'): React.CSSProperties => ({
    padding: '0.5rem 1.1rem', borderRadius: '9999px', fontSize: '0.85rem', fontWeight: 600,
    border: `1px solid ${active ? (variant === 'green' ? 'var(--accent-border)' : 'var(--danger)') : 'var(--border)'}`,
    background: active ? (variant === 'green' ? 'var(--accent-subtle)' : 'var(--danger-subtle)') : 'var(--bg-elevated)',
    color: active ? (variant === 'green' ? 'var(--accent)' : 'var(--danger)') : 'var(--text-secondary)',
    cursor: 'pointer', transition: 'all 0.2s',
  });

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '4rem' }}>
      {/* Progress bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '3px', background: 'var(--border)', zIndex: 50 }}>
        <motion.div animate={{ width: `${progressPct}%` }} transition={{ duration: 0.4 }}
          style={{ height: '100%', background: 'var(--accent)', borderRadius: '0 9999px 9999px 0' }} />
      </div>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '5rem 1.5rem 2rem' }}>
        {/* Step dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '3rem' }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{ width: i + 1 === step ? '28px' : '8px', height: '8px', borderRadius: '4px', background: i + 1 <= step ? 'var(--accent)' : 'var(--border)', transition: 'all 0.3s' }} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" variants={stepVariants} initial="initial" animate="in" exit="out" transition={{ duration: 0.3 }}>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', marginBottom: '0.75rem' }}>Tell us about yourself</h2>
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '2.5rem' }}>Help us personalise your experience</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Display Name</label>
                  <input type="text" value={form.display_name} onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))} placeholder="Your name" className="input-base" />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Age</label>
                  <input type="number" value={form.age} onChange={e => setForm(p => ({ ...p, age: e.target.value }))} placeholder="Your age" className="input-base" min="1" max="120" />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.75rem' }}>Gender</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {GENDERS.map(g => <button key={g} onClick={() => setForm(p => ({ ...p, gender: g }))} style={chipStyle(form.gender === g)}>{g}</button>)}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" variants={stepVariants} initial="initial" animate="in" exit="out" transition={{ duration: 0.3 }}>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', marginBottom: '0.75rem' }}>Genres you love</h2>
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '2.5rem' }}>Select as many as you like</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
                {GENRES.map(g => <button key={g} onClick={() => toggleGenre('favorite_genres', g)} style={chipStyle(form.favorite_genres.includes(g))}>{form.favorite_genres.includes(g) && '✓ '}{g}</button>)}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" variants={stepVariants} initial="initial" animate="in" exit="out" transition={{ duration: 0.3 }}>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', marginBottom: '0.75rem' }}>Genres to skip</h2>
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '2.5rem' }}>We&apos;ll avoid these in your feed</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
                {GENRES.filter(g => !form.favorite_genres.includes(g)).map(g => <button key={g} onClick={() => toggleGenre('disliked_genres', g)} style={chipStyle(form.disliked_genres.includes(g), 'red')}>{form.disliked_genres.includes(g) && '✕ '}{g}</button>)}
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="step4" variants={stepVariants} initial="initial" animate="in" exit="out" transition={{ duration: 0.3 }}>
              <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                <div style={{ width: '80px', height: '80px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem' }}>
                  <Check size={40} color="#fff" />
                </div>
                <h2 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '1rem' }}>You&apos;re all set!</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '0.5rem' }}>
                  {form.favorite_genres.length > 0 ? `We'll recommend movies in ${form.favorite_genres.slice(0, 3).join(', ')} and more.` : "We'll show you a great mix of movies to start!"}
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>You can always update your preferences from your profile.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3rem', gap: '1rem' }}>
          <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1} className="btn-secondary" style={{ opacity: step === 1 ? 0 : 1 }}>
            <ArrowLeft size={16} /> Back
          </button>
          {step < totalSteps ? (
            <button onClick={() => setStep(s => s + 1)} className="btn-primary"><ArrowRight size={16} />Next</button>
          ) : (
            <button onClick={handleFinish} disabled={loading} className="btn-primary">
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
