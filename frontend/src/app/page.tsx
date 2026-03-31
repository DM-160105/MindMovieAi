'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { motion, useInView } from 'framer-motion';
import {
  Brain, Zap, Compass, Film, Shield, Sparkles,
  Play, Star, TrendingUp, Globe, Users, ArrowRight, ChevronRight,
  Aperture, Heart, BookmarkPlus, Search, MessageSquare, Cpu,
  Layers, Lock, Activity,
} from 'lucide-react';
import Link from 'next/link';
import Footer from '@/components/Footer';
import { useDevice } from '@/context/DeviceContext';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts';

/* ─── Data ─────────────────────────────────────────────────── */

const heroStats = [
  { value: '11K+', label: 'Movies', icon: Film },
  { value: '98%', label: 'Accuracy', icon: TrendingUp },
  { value: '3', label: 'Industries', icon: Globe },
  { value: '6+', label: 'ML Models', icon: Cpu },
];

const features = [
  {
    icon: Brain,
    title: 'AI Recommendations',
    desc: 'Deep learning models trained on your unique taste — genres, ratings, watch history, and click behavior.',
    color: 'var(--accent)',
    gradient: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.02))',
  },
  {
    icon: Zap,
    title: 'Lightning Search',
    desc: 'TF-IDF + cosine similarity with fuzzy matching and acronym support across 11,000+ films.',
    color: 'var(--star)',
    gradient: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,191,36,0.02))',
  },
  {
    icon: Compass,
    title: 'Explore & Discover',
    desc: 'Filter by genre, rating, year, and source. Infinite scroll with a premium 3D hero carousel.',
    color: 'var(--accent-2)',
    gradient: 'linear-gradient(135deg, rgba(14,165,233,0.15), rgba(14,165,233,0.02))',
  },
  {
    icon: Film,
    title: 'Sentiment Analysis',
    desc: 'Dual-model PyTorch + TensorFlow sentiment engine for movie reviews.',
    color: 'var(--purple)',
    gradient: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.02))',
  },
  {
    icon: Aperture,
    title: 'Vibe Check',
    desc: 'vibe check your movie with our AI using atmosphere of the movie.',
    color: 'var(--danger)',
    gradient: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.02))',
  },
  {
    icon: Shield,
    title: 'Secure Auth',
    desc: 'Email OTP verification, Google OAuth, JWT sessions, and encrypted password storage.',
    color: 'var(--accent)',
    gradient: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.02))',
  },
];

const mlModels = [
  { name: 'FAISS Vector Index', purpose: 'Content-Based Filtering', tech: 'Facebook AI', icon: Layers },
  { name: 'TF-IDF Vectorizer', purpose: 'Text Similarity', tech: 'scikit-learn', icon: Search },
  { name: 'Sentiment (TF)', purpose: 'Review Analysis', tech: 'TensorFlow', icon: MessageSquare },
  { name: 'Sentiment (PT)', purpose: 'Review Analysis', tech: 'PyTorch', icon: Brain },
  { name: 'Fake Engagement', purpose: 'Anomaly Detection', tech: 'Isolation Forest', icon: Shield },
  { name: 'DL Recommender', purpose: 'Genre Prediction', tech: 'Neural Network', icon: Activity },
];

const techStack = [
  { name: 'Next.js', desc: 'React Framework', category: 'Frontend' },
  { name: 'FastAPI', desc: 'Python Backend', category: 'Backend' },
  { name: 'MongoDB', desc: 'NoSQL Database', category: 'Database' },
  { name: 'FAISS', desc: 'Vector Search', category: 'ML' },
  { name: 'PyTorch', desc: 'Deep Learning', category: 'ML' },
  { name: 'TensorFlow', desc: 'Deep Learning', category: 'ML' },
  { name: 'Hugging Face', desc: 'Model Hub', category: 'ML' },
  { name: 'Render', desc: 'Cloud Deploy', category: 'Infra' },
];

const datasetData = [
  { name: 'Hollywood', value: 4803, color: 'var(--accent)' },
  { name: 'Bollywood', value: 3400, color: 'var(--purple)' },
  { name: 'Anime', value: 2450, color: 'var(--accent-2)' },
];

const sentimentData = [
  { epoch: 'Epoch 1', tf: 65, pt: 60 },
  { epoch: 'Epoch 5', tf: 75, pt: 73 },
  { epoch: 'Epoch 10', tf: 85, pt: 84 },
  { epoch: 'Epoch 15', tf: 93, pt: 95 },
  { epoch: 'Epoch 20', tf: 96, pt: 98 },
];

const userJourney = [
  { step: '01', title: 'Create Account', desc: 'Sign up with email or Google — verified with OTP for security.', icon: Lock },
  { step: '02', title: 'Complete Wizard', desc: 'Tell us your favorite genres, industries, and preferences.', icon: Sparkles },
  { step: '03', title: 'Explore Movies', desc: 'Browse the explore page with infinite scroll and a 3D hero carousel.', icon: Compass },
  { step: '04', title: 'Get AI Picks', desc: 'Receive personalized recommendations that improve with every click.', icon: Brain },
];

/* ─── Animated Counter ─────────────────────────────────────── */
function AnimatedCounter({ value, duration = 2000 }: { value: string; duration?: number }) {
  const [displayValue, setDisplayValue] = useState('0');
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  
  useEffect(() => {
    if (!isInView) return;
    const numericPart = value.replace(/[^0-9.]/g, '');
    const suffix = value.replace(/[0-9.]/g, '');
    const target = parseFloat(numericPart);
    if (isNaN(target)) { setDisplayValue(value); return; }
    
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(target * eased);
      setDisplayValue(current + suffix);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [isInView, value, duration]);
  
  return <span ref={ref}>{displayValue}</span>;
}

/* ─── Floating Particles ───────────────────────────────────── */
function FloatingParticles() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute',
            width: `${2 + Math.random() * 4}px`,
            height: `${2 + Math.random() * 4}px`,
            borderRadius: '50%',
            background: i % 3 === 0 ? 'var(--accent)' : i % 3 === 1 ? 'var(--purple)' : 'var(--accent-2)',
            opacity: 0.15 + Math.random() * 0.2,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30 - Math.random() * 40, 0],
            x: [0, (Math.random() - 0.5) * 30, 0],
            opacity: [0.15, 0.35, 0.15],
          }}
          transition={{
            duration: 4 + Math.random() * 6,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: Math.random() * 3,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Section Header ───────────────────────────────────────── */
function SectionHeader({ badge, title, subtitle }: { badge: string; title: string; subtitle: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5 }}
      style={{ textAlign: 'center', marginBottom: '3.5rem' }}
    >
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
        background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
        borderRadius: '9999px', padding: '0.3rem 0.9rem', marginBottom: '1.25rem',
      }}>
        <Sparkles size={12} color="var(--accent)" />
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {badge}
        </span>
      </div>
      <h2 style={{
        fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', fontWeight: 900,
        color: 'var(--text-primary)', letterSpacing: '-0.03em',
        lineHeight: 1.15, marginBottom: '1rem',
      }}>
        {title}
      </h2>
      <p style={{
        color: 'var(--text-secondary)', fontSize: '1rem',
        maxWidth: '600px', margin: '0 auto', lineHeight: 1.7,
      }}>
        {subtitle}
      </p>
    </motion.div>
  );
}

/* ─── Main Page ────────────────────────────────────────────── */
export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { isMobile } = useDevice();
  const [heroOpacity, setHeroOpacity] = useState(1);

  useEffect(() => {
    if (!loading && user) router.replace('/explore');
  }, [user, loading, router]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const opacity = Math.max(0, 1 - scrollY / 600);
      setHeroOpacity(opacity);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (loading) return null;

  return (
    <>
      {/* ═══════════════════════════════════════════════════
          SECTION 1 — HERO
          ═══════════════════════════════════════════════════ */}
      <section
        style={{ opacity: heroOpacity, transform: `scale(${0.95 + heroOpacity * 0.05})`, transition: 'transform 0.1s ease-out' }}
      >
        <div style={{
          position: 'relative', minHeight: isMobile ? '85vh' : '90vh',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: isMobile ? '4rem 1.25rem 3rem' : '6rem 1.5rem 4rem',
          overflow: 'hidden',
        }}>
          <FloatingParticles />

          {/* Radial glow behind hero */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -60%)',
            width: isMobile ? '300px' : '700px', height: isMobile ? '300px' : '700px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: '860px' }}
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
                borderRadius: '9999px', padding: '0.4rem 1.1rem', marginBottom: '2rem',
              }}
            >
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)',
                boxShadow: '0 0 8px var(--accent)',
                animation: 'pulse 2s ease-in-out infinite',
              }} />
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                AI-Powered Movie Intelligence
              </span>
            </motion.div>

            {/* Headline */}
            <h1 style={{
              fontSize: isMobile ? 'clamp(2.2rem, 8vw, 3rem)' : 'clamp(3rem, 6vw, 4.5rem)',
              fontWeight: 900, color: 'var(--text-primary)',
              lineHeight: 1.08, letterSpacing: '-0.04em', marginBottom: '1.5rem',
            }}>
              Your Next Favorite Movie,{' '}
              <span style={{
                background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 50%, var(--purple) 100%)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text',
                color: 'transparent',
              }}>
                Found by AI
              </span>
            </h1>

            {/* Subheadline */}
            <p style={{
              color: 'var(--text-secondary)', fontSize: isMobile ? '0.95rem' : '1.15rem',
              maxWidth: '600px', margin: '0 auto 2.5rem', lineHeight: 1.75,
            }}>
              Personalized recommendations across Bollywood, Hollywood & Anime — powered by 6+ ML models, 
              FAISS vector search, and dual-model sentiment analysis.
            </p>

            {/* CTA Buttons */}
            <div style={{
              display: 'flex', gap: '0.875rem', justifyContent: 'center',
              flexWrap: 'wrap', marginBottom: '3.5rem',
            }}>
              <Link href="/register" className="btn-primary" style={{
                padding: isMobile ? '0.85rem 2rem' : '1rem 2.75rem',
                fontSize: isMobile ? '0.9rem' : '1rem',
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                borderRadius: '14px',
                boxShadow: '0 0 25px rgba(16,185,129,0.25)',
              }}>
                Get Started Free <ArrowRight size={16} />
              </Link>
              <Link href="/login" className="btn-secondary" style={{
                padding: isMobile ? '0.85rem 1.75rem' : '1rem 2.25rem',
                fontSize: isMobile ? '0.9rem' : '1rem',
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                borderRadius: '14px',
              }}>
                <Play size={14} fill="var(--text-secondary)" /> Sign In
              </Link>
            </div>

            {/* Hero Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              style={{
                display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                gap: isMobile ? '0.75rem' : '1rem',
                maxWidth: '680px', margin: '0 auto',
              }}
            >
              {heroStats.map((s) => (
                <div key={s.label} style={{
                  padding: isMobile ? '1rem 0.75rem' : '1.25rem 1rem',
                  borderRadius: '16px',
                  background: 'var(--glass-bg)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid var(--border)',
                  textAlign: 'center',
                }}>
                  <s.icon size={16} color="var(--accent)" style={{ marginBottom: '0.5rem' }} />
                  <div style={{ fontSize: isMobile ? '1.5rem' : '1.75rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
                    <AnimatedCounter value={s.value} />
                  </div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '0.35rem' }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          SECTION 2 — FEATURES
          ═══════════════════════════════════════════════════ */}
      <section style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '3rem 1.25rem 5rem' : '4rem 1.5rem 6rem' }}>
        <SectionHeader
          badge="Core Features"
          title="Everything You Need to Discover Movies"
          subtitle="A complete AI-powered movie intelligence platform — from discovery to sentiment analysis."
        />

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: '1.25rem',
        }}>
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              style={{
                padding: isMobile ? '1.5rem' : '2rem',
                borderRadius: '20px',
                background: f.gradient,
                border: '1px solid var(--border)',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'default',
                transition: 'border-color 0.2s ease, transform 0.2s ease',
              }}
              whileHover={{ y: -4, borderColor: 'var(--border-hover)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem'}}>
                {/* Icon */}
                <div style={{
                  width: '48px', height: '48px', borderRadius: '999px',
                  border: "1.5px solid var(--border)",
                  background: `${f.color}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <f.icon size={25} color={f.color} />
              </div>

              <h3 style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)'}}>
                {f.title}
              </h3>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.7 }}>
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          SECTION 3 — HOW IT WORKS
          ═══════════════════════════════════════════════════ */}
      <section style={{
        padding: isMobile ? '4rem 1.25rem 5rem' : '5rem 1.5rem 6rem',
        position: 'relative',
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <SectionHeader
            badge="How It Works"
            title="From Signup to Smart Picks in 4 Steps"
            subtitle="A seamless onboarding experience that learns your taste instantly."
          />

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
            gap: isMobile ? '1.5rem' : '1.5rem',
            position: 'relative',
          }}>
            {/* Connecting line (desktop only) */}
            {!isMobile && (
              <div style={{
                position: 'absolute', top: '55px', left: '12.5%', right: '12.5%',
                height: '2px',
                background: 'linear-gradient(90deg, var(--accent), var(--purple), var(--accent-2), var(--accent))',
                opacity: 0.3,
              }} />
            )}

            {userJourney.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ delay: i * 0.12, duration: 0.4 }}
                style={{ textAlign: 'center', position: 'relative' }}
              >
                {/* Step circle */}
                <div style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: 'var(--glass-bg)', backdropFilter: 'blur(12px)',
                  border: '2px solid var(--accent-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 1.25rem', position: 'relative', zIndex: 2,
                }}>
                  <step.icon size={22} color="var(--accent)" />
                </div>

                <div style={{
                  fontSize: '0.65rem', fontWeight: 800, color: 'var(--accent)',
                  textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem',
                }}>
                  Step {step.step}
                </div>
                <h4 style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  {step.title}
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.65 }}>
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          SECTION 4 — ML MODELS SHOWCASE
          ═══════════════════════════════════════════════════ */}
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: isMobile ? '3rem 1.25rem 5rem' : '4rem 1.5rem 6rem' }}>
        <SectionHeader
          badge="Under The Hood"
          title="6+ Machine Learning Models"
          subtitle="Every recommendation is powered by a pipeline of trained models working together."
        />

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
          gap: isMobile ? '0.75rem' : '1rem',
        }}>
          {mlModels.map((m, i) => (
            <motion.div
              key={m.name}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: i * 0.06 }}
              style={{
                padding: isMobile ? '1rem' : '1.5rem',
                borderRadius: '16px',
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--border)',
                transition: 'border-color 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem'}}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '999px',
                background: 'var(--accent-subtle)',
                border: '1px solid var(--accent-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <m.icon size={16} color="var(--accent)" />
              </div>
              <h4 style={{ fontWeight: 800, fontSize: isMobile ? '0.82rem' : '0.9rem', color: 'var(--text-primary)'}}>
                {m.name}
              </h4>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                {m.purpose}
              </p>
              <span style={{
                fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent)',
                background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
                padding: '0.15rem 0.5rem', borderRadius: '9999px',
              }}>
                {m.tech}
              </span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          SECTION 5 — DATA & ACCURACY CHARTS
          ═══════════════════════════════════════════════════ */}
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: isMobile ? '3rem 1.25rem 5rem' : '4rem 1.5rem 6rem' }}>
        <SectionHeader
          badge="Data Intelligence"
          title="Built on Massive Data & Precision"
          subtitle="Our dual-model architecture trains on tens of thousands of data points for unparalleled accuracy."
        />

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
          gap: '1.5rem',
        }}>
          {/* Pie Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            style={{
              padding: '2rem', borderRadius: '20px',
              background: 'var(--glass-bg)', backdropFilter: 'blur(16px)',
              border: '1px solid var(--border)',
            }}
          >
            <h3 style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
              Global Movie Dataset
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '1.5rem' }}>
              Content distribution across 3 film industries
            </p>
            <div style={{ height: '240px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={datasetData} cx="50%" cy="50%"
                    innerRadius={65} outerRadius={95} paddingAngle={5}
                    dataKey="value" stroke="none"
                  >
                    {datasetData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{
                      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                      borderRadius: '12px', fontSize: '0.85rem',
                    }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
              {datasetData.map(d => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: d.color, boxShadow: `0 0 8px ${d.color}` }} />
                  {d.name} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({d.value.toLocaleString()})</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Area Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ delay: 0.1 }}
            style={{
              padding: '2rem', borderRadius: '20px',
              background: 'var(--glass-bg)', backdropFilter: 'blur(16px)',
              border: '1px solid var(--border)',
            }}
          >
            <h3 style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
              Sentiment Model Accuracy
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '1.5rem' }}>
              Dual deep learning training convergence
            </p>
            <div style={{ height: '240px', width: '100%', marginLeft: '-15px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sentimentData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTf" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorPt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--purple)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--purple)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="epoch" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} dx={-10} domain={[50, 100]} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)',
                      border: '1px solid var(--border)', borderRadius: '12px',
                    }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                  />
                  <Area type="monotone" dataKey="tf" stroke="var(--accent)" strokeWidth={3} fillOpacity={1} fill="url(#colorTf)" name="TensorFlow" />
                  <Area type="monotone" dataKey="pt" stroke="var(--purple)" strokeWidth={3} fillOpacity={1} fill="url(#colorPt)" name="PyTorch" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{ width: '16px', height: '3px', borderRadius: '2px', background: 'var(--accent)' }} /> TensorFlow
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{ width: '16px', height: '3px', borderRadius: '2px', background: 'var(--purple)' }} /> PyTorch
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          SECTION 6 — PLATFORM FEATURES BENTO
          ═══════════════════════════════════════════════════ */}
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: isMobile ? '3rem 1.25rem 5rem' : '4rem 1.5rem 6rem' }}>
        <SectionHeader
          badge="Platform"
          title="More Than Just Recommendations"
          subtitle="A full-featured movie intelligence platform with tools for every film lover."
        />

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: '1rem',
        }}>
          {[
            { icon: Heart, title: 'Favorites', desc: 'Save and organize movies you love.', color: 'var(--danger)' },
            { icon: BookmarkPlus, title: 'Watchlist', desc: 'Smart stacking groups related titles together.', color: 'var(--accent-2)' },
            { icon: Star, title: 'Ratings', desc: 'Rate movies to improve your AI recommendations.', color: 'var(--star)' },
            { icon: MessageSquare, title: 'Reviews', desc: 'Write reviews with real-time NLP sentiment analysis.', color: 'var(--purple)' },
            { icon: Aperture, title: 'Vibe Check', desc: 'vibe check your movie with our AI using atmosphere of the movie.', color: 'var(--danger)' },
            { icon: Users, title: 'User Profiles', desc: 'Track watch history, sessions, and preferences.', color: 'var(--accent)' },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: i * 0.06 }}
              style={{
                padding: '1.5rem', borderRadius: '16px',
                background: 'var(--glass-bg)', backdropFilter: 'blur(16px)',
                border: '1px solid var(--border)',
                display: 'flex', gap: '1rem', alignItems: 'flex-start',
                transition: 'border-color 0.2s ease',
              }}
            >
              <div style={{
                width: '40px', height: '40px', borderRadius: '999px', flexShrink: 0,
                background: `${item.color}15`, border: `1.5px solid var(--border)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <item.icon size={18} color={item.color} />
              </div>
              <div>
                <h4 style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
                  {item.title}
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.6 }}>
                  {item.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          SECTION 7 — TECH STACK
          ═══════════════════════════════════════════════════ */}
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: isMobile ? '3rem 1.25rem 5rem' : '4rem 1.5rem 6rem' }}>
        <SectionHeader
          badge="Tech Stack"
          title="Built with Modern Technologies"
          subtitle="Enterprise-grade infrastructure powering every recommendation."
        />

        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center',
        }}>
          {techStack.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem 1.25rem', borderRadius: '14px',
                background: 'var(--glass-bg)', backdropFilter: 'blur(12px)',
                border: '1px solid var(--border)',
                transition: 'border-color 0.2s ease',
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  {t.name}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  {t.desc}
                </div>
              </div>
              <span style={{
                fontSize: '0.6rem', fontWeight: 700, color: 'var(--accent)',
                background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
                padding: '0.1rem 0.45rem', borderRadius: '9999px',
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {t.category}
              </span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          SECTION 8 — CTA
          ═══════════════════════════════════════════════════ */}
      <section style={{ padding: isMobile ? '4rem 1.25rem 5rem' : '5rem 1.5rem 6rem' }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          style={{
            maxWidth: '800px', margin: '0 auto', textAlign: 'center',
            padding: isMobile ? '3rem 1.5rem' : '4rem 3rem',
            borderRadius: '24px', position: 'relative', overflow: 'hidden',
            background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(139,92,246,0.06))',
            border: '1px solid var(--border)',
          }}
        >
          {/* Glow accent */}
          <div style={{
            position: 'absolute', top: '-50%', left: '50%', transform: 'translateX(-50%)',
            width: '300px', height: '300px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '16px',
              background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.5rem',
            }}>
              <Sparkles size={24} color="var(--accent)" />
            </div>

            <h2 style={{
              fontSize: isMobile ? '1.75rem' : '2.25rem', fontWeight: 900,
              color: 'var(--text-primary)', letterSpacing: '-0.03em',
              lineHeight: 1.15, marginBottom: '1rem',
            }}>
              Ready to Discover{' '}
              <span style={{ color: 'var(--accent)' }}>Smarter</span>?
            </h2>
            <p style={{
              color: 'var(--text-secondary)', fontSize: '1rem',
              maxWidth: '480px', margin: '0 auto 2rem', lineHeight: 1.7,
            }}>
              Join now and let our AI learn your taste. Every click makes your recommendations better.
            </p>
            <div style={{ display: 'flex', gap: '0.875rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/register" className="btn-primary" style={{
                padding: '1rem 2.5rem', fontSize: '1rem',
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                borderRadius: '14px', boxShadow: '0 0 30px rgba(16,185,129,0.2)',
              }}>
                Create Free Account <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      <Footer />

      {/* Keyframe for pulse */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.5); }
        }
      `}</style>
    </>
  );
}
