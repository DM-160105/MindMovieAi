'use client';

import { useState } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  Brain, Database, Layers, Cpu, Film, Shield, Sparkles, Compass,
  Globe, Heart, BookmarkPlus, Users,
  MessageSquare, Lock, Search, Activity, Mail, ExternalLink,
  ChevronDown, ArrowRight, Code2, Server,
  Palette, BarChart3, CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';
import Footer from '@/components/Footer';
import { useDevice } from '@/context/DeviceContext';

/* ─── Section Header ───────────────────────────────────────── */
function SectionHeader({ badge, title, subtitle, id }: { badge: string; title: string; subtitle: string; id?: string }) {
  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5 }}
      style={{ textAlign: 'center', marginBottom: '3rem', scrollMarginTop: '100px' }}
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
        maxWidth: '620px', margin: '0 auto', lineHeight: 1.7,
      }}>
        {subtitle}
      </p>
    </motion.div>
  );
}

/* ─── Accordion Item ───────────────────────────────────────── */
function AccordionItem({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      borderRadius: '16px', border: '1px solid var(--border)',
      background: 'var(--glass-bg)', backdropFilter: 'blur(16px)',
      overflow: 'hidden', transition: 'border-color 0.2s ease',
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', padding: '1.25rem 1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-primary)', fontWeight: 700, fontSize: '1rem',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {title}
        <ChevronDown
          size={18}
          color="var(--text-muted)"
          style={{
            transition: 'transform 0.3s ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        style={{ overflow: 'hidden' }}
      >
        <div style={{
          padding: '0 1.5rem 1.5rem',
          color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.75,
        }}>
          {children}
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Data ─────────────────────────────────────────────────── */

const quickLinks = [
  { label: 'About', href: '#about' },
  { label: 'Services', href: '#services' },
  { label: 'ML Models', href: '#models' },
  { label: 'Tech Stack', href: '#tech' },
  { label: 'Architecture', href: '#architecture' },
  { label: 'Terms', href: '#terms' },
  { label: 'Privacy', href: '#privacy' },
  { label: 'Contact', href: '#contact' },
];

const services = [
  {
    icon: Brain, title: 'AI Recommendations',
    desc: 'Deep learning models trained on your taste — analyzing genres, ratings, watch history, and click behavior to deliver hyper-personalized picks.',
    color: 'var(--accent)',
  },
  {
    icon: Search, title: 'Intelligent Search',
    desc: 'TF-IDF + cosine similarity with fuzzy matching and acronym support across 11,000+ films from Hollywood, Bollywood, and Anime.',
    color: 'var(--star)',
  },
  {
    icon: MessageSquare, title: 'Sentiment Analysis',
    desc: 'Dual-model PyTorch + TensorFlow sentiment engine that analyzes reviews with 98% accuracy.',
    color: 'var(--purple)',

  },
  {
    icon: Heart, title: 'Favorites & Watchlist',
    desc: 'Save and organize movies with smart stacking that groups related titles. Rate movies to improve your AI recommendations.',
    color: 'var(--danger)',
  },
  {
    icon: Shield, title: 'Secure Authentication',
    desc: 'Email OTP verification, Google OAuth 2.0 SSO, JWT sessions with expiry, and bcrypt password encryption.',
    color: 'var(--accent)',
  },
  {
    icon: Activity, title: 'Activity Tracking',
    desc: 'Full user history — search queries, movie clicks, session logs, and preference evolution over time.',
    color: 'var(--accent-2)',
  },
  {
    icon: BarChart3, title: 'Popularity Prediction',
    desc: 'Random Forest model that predicts movie revenue based on budget, runtime, and genre composition.',
    color: 'var(--warning)',
  },
];

const mlModels = [
  { name: 'FAISS SQ8 Index', purpose: 'Content-Based Filtering', tech: 'Facebook AI', desc: 'Scalar quantized vector index for lightning-fast similarity search across 11K+ movie embeddings.', icon: Layers },
  { name: 'TF-IDF Vectorizer', purpose: 'Text Similarity', tech: 'scikit-learn', desc: 'Term frequency-inverse document frequency for converting movie tags into comparable vector representations.', icon: Search },
  { name: 'BiLSTM Sentiment', purpose: 'Review Analysis', tech: 'TensorFlow/Keras', desc: 'Bidirectional LSTM neural network for sequence-based sentiment classification of movie reviews.', icon: MessageSquare },
  { name: 'DistilBERT Sentiment', purpose: 'Review Analysis', tech: 'PyTorch/HuggingFace', desc: 'Transformer-based sentiment model for high-accuracy inference on reviews.', icon: Brain },
  { name: 'Isolation Forest', purpose: 'Anomaly Detection', tech: 'scikit-learn', desc: 'Unsupervised model detecting anomaly rating patterns in user behavior.', icon: Shield },
  { name: 'DL Recommender', purpose: 'Genre Prediction', tech: 'PyTorch', desc: 'Neural collaborative filtering model that learns latent user-genre affinity scores for personalized rankings.', icon: Activity },
  { name: 'Random Forest', purpose: 'Revenue Prediction', tech: 'scikit-learn', desc: 'Ensemble model predicting movie popularity and revenue from budget, runtime, and genre features.', icon: BarChart3 },
  { name: 'Context Recommender', purpose: 'Time-Aware', tech: 'Custom', desc: 'Combines time-of-day, user history, and collaborative signals for context-aware movie suggestions.', icon: Globe },
];

const techStack = [
  { name: 'Next.js', version: '15', desc: 'React Meta-Framework', category: 'Frontend', icon: Code2 },
  { name: 'React', version: '19', desc: 'UI Library', category: 'Frontend', icon: Code2 },
  { name: 'TypeScript', version: '5', desc: 'Type Safety', category: 'Frontend', icon: Code2 },
  { name: 'Framer Motion', version: '11', desc: 'Animations', category: 'Frontend', icon: Palette },
  { name: 'Recharts', version: '2', desc: 'Data Visualization', category: 'Frontend', icon: BarChart3 },
  { name: 'FastAPI', version: '0.115', desc: 'Python Backend', category: 'Backend', icon: Server },
  { name: 'MongoDB Atlas', version: '', desc: 'NoSQL Database', category: 'Database', icon: Database },
  { name: 'PyTorch', version: '2.x', desc: 'Deep Learning', category: 'ML', icon: Cpu },
  { name: 'TensorFlow', version: '2.x', desc: 'Deep Learning', category: 'ML', icon: Cpu },
  { name: 'FAISS', version: '', desc: 'Vector Search', category: 'ML', icon: Layers },
  { name: 'scikit-learn', version: '', desc: 'Classical ML', category: 'ML', icon: Brain },
  { name: 'Hugging Face', version: '', desc: 'Model & Data Hub', category: 'ML', icon: Sparkles },
  { name: 'TMDB API', version: 'v3', desc: 'Movie Data Source', category: 'Data', icon: Film },
  { name: 'Render', version: '', desc: 'Cloud Hosting', category: 'Infra', icon: Globe },
];

const architectureLayers = [
  { label: 'Client', desc: 'Next.js SSR + CSR with Framer Motion animations', color: 'var(--accent-2)', items: ['React 19', 'Framer Motion', 'Recharts', 'Lucide Icons'] },
  { label: 'API Gateway', desc: 'FastAPI with JWT auth, CORS, and rate limiting', color: 'var(--accent)', items: ['FastAPI', 'Pydantic', 'OAuth2', 'JWT'] },
  { label: 'ML Pipeline', desc: 'Dual-model inference with FAISS vector search', color: 'var(--purple)', items: ['TensorFlow', 'PyTorch', 'FAISS', 'scikit-learn'] },
  { label: 'Data Layer', desc: 'MongoDB Atlas + Hugging Face model storage', color: 'var(--star)', items: ['MongoDB', 'HF Hub', 'TMDB API', 'Pickle'] },
];

const teamMembers = [
  { name: 'Devang Makwana', role: 'Full-Stack Developer & ML Engineer'},
];

/* ─── Main Page ────────────────────────────────────────────── */
export default function InformationPage() {
  const { isMobile } = useDevice();

  return (
    <>
      <div style={{ minHeight: '100vh', position: 'relative' }}>
        {/* ═══════════════════════════════════════════════════
            HERO
            ═══════════════════════════════════════════════════ */}
        <section style={{
          maxWidth: '900px', margin: '0 auto',
          padding: isMobile ? '4rem 1.25rem 3rem' : '5rem 1.5rem 3rem',
          textAlign: 'center',
        }}>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
              borderRadius: '9999px', padding: '0.4rem 1.1rem', marginBottom: '2rem',
            }}>
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)',
                boxShadow: '0 0 8px var(--accent)',
              }} />
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Documentation & Legal
              </span>
            </div>

            <h1 style={{
              fontSize: isMobile ? 'clamp(2rem, 7vw, 2.5rem)' : 'clamp(2.5rem, 5vw, 3.5rem)',
              fontWeight: 900, color: 'var(--text-primary)',
              lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: '1.25rem',
            }}>
              Everything About{' '}
              <br />
              <span style={{
                background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 50%, var(--purple) 100%)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
              }}>
                Mind Movie Ai
              </span>
            </h1>

            <p style={{
              color: 'var(--text-secondary)', fontSize: isMobile ? '0.95rem' : '1.1rem',
              maxWidth: '600px', margin: '0 auto 2.5rem', lineHeight: 1.75,
            }}>
              A full-stack AI movie recommendation platform combining 8+ machine learning models
              with a premium UI.
            </p>

            {/* Quick Jump Links */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: '0.5rem',
              justifyContent: 'center', marginBottom: '1rem',
            }}>
              {quickLinks.map(l => (
                <a
                  key={l.href}
                  href={l.href}
                  style={{
                    padding: '0.4rem 0.85rem', borderRadius: '9999px',
                    fontSize: '0.78rem', fontWeight: 600,
                    background: 'var(--glass-bg)', backdropFilter: 'blur(12px)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                    textDecoration: 'none', transition: 'all 0.2s ease',
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  }}
                >
                  {l.label} <ChevronDown size={10} />
                </a>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ═══════════════════════════════════════════════════
            ABOUT
            ═══════════════════════════════════════════════════ */}
        <section style={{ maxWidth: '1100px', margin: '0 auto', padding: isMobile ? '2rem 1.25rem 4rem' : '3rem 1.5rem 5rem' }}>
          <SectionHeader
            id="about"
            badge="About Us"
            title="What is Mind Movie Ai?"
            subtitle="An AI-powered movie intelligence platform that learns your taste and recommends films you'll actually love."
          />

          <div style={{
            display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: '1.5rem',
          }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: 0.1 }}
              style={{
                padding: '2rem', borderRadius: '20px',
                background: 'var(--glass-bg)', backdropFilter: 'blur(16px)',
                border: '1px solid var(--border)',
              }}
            >
              <h3 style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>
                Our Mission
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.75, marginBottom: '1rem' }}>
                Mind Movie Ai was built to solve a simple problem: <strong style={{ color: 'var(--text-primary)' }}>finding your next favorite movie shouldn't be hard.</strong>
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.75, marginBottom: '1rem' }}>
                We combine content-based filtering, collaborative filtering, deep learning, and NLP sentiment analysis into a
                single unified platform. Whether you love Bollywood dramas, Hollywood blockbusters, or Anime series — our AI adapts to you.
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.75 }}>
                Every click, search, and rating teaches our models more about your preferences, creating a recommendation
                experience that gets smarter every day.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: 0.2 }}
              style={{
                padding: '2rem', borderRadius: '20px',
                background: 'var(--glass-bg)', backdropFilter: 'blur(16px)',
                border: '1px solid var(--border)',
              }}
            >
              <h3 style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>
                Project Info
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[
                  { label: 'Project Type', value: 'Movie Recommendation System' },
                  { label: 'Year', value: '2025–2026' },
                  { label: 'Movie Database', value: '11,000+ Movies (Hollywood, Bollywood, Anime)' },
                  { label: 'ML Models', value: '8+ Trained Models' },
                  { label: 'Accuracy', value: '98% Sentiment Analysis / 94% Recommendations' },
                ].map(item => (
                  <div key={item.label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.6rem 0', borderBottom: '1px solid var(--border)',
                  }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>{item.label}</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Team */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: 0.3 }}
            style={{
              marginTop: '1.5rem', padding: '2rem', borderRadius: '20px',
              background: 'var(--glass-bg)', backdropFilter: 'blur(16px)',
              border: '1px solid var(--border)',
            }}
          >
            <h3 style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)', marginBottom: '1.25rem' }}>
              Team Members
            </h3>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
              {teamMembers.map(m => (
                <div key={m.name} style={{
                  padding: '1.25rem', borderRadius: '14px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  textAlign: 'center',
                }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '50%',
                    background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 0.75rem', fontWeight: 900, fontSize: '0.9rem', color: 'var(--accent)',
                  }}>
                    {m.name.split(' ').map(w => w[0]).join('')}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{m.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>{m.role}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ═══════════════════════════════════════════════════
            SERVICES
            ═══════════════════════════════════════════════════ */}
        <section style={{ maxWidth: '1100px', margin: '0 auto', padding: isMobile ? '2rem 1.25rem 4rem' : '3rem 1.5rem 5rem' }}>
          <SectionHeader
            id="services"
            badge="Our Services"
            title="What You Can Do With Mind Movie Ai"
            subtitle="A complete suite of tools for movie discovery, analysis, and personalization."
          />

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
            gap: '1rem',
          }}>
            {services.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.06 }}
                style={{
                  padding: '1.5rem', borderRadius: '16px',
                  background: 'var(--glass-bg)', backdropFilter: 'blur(16px)',
                  border: '1px solid var(--border)',
                  display: 'flex', gap: '1rem', alignItems: 'flex-start',
                }}
              >
                <div style={{
                  width: '44px', height: '44px', borderRadius: '999px', flexShrink: 0,
                  background: `${s.color}15`, border: `1px solid var(--border)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <s.icon size={24} color={s.color} />
                </div>
                <div>
                  <h4 style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                    {s.title}
                  </h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.7 }}>
                    {s.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            ML MODELS
            ═══════════════════════════════════════════════════ */}
        <section style={{ maxWidth: '1100px', margin: '0 auto', padding: isMobile ? '2rem 1.25rem 4rem' : '3rem 1.5rem 5rem' }}>
          <SectionHeader
            id="models"
            badge="Machine Learning"
            title="8+ Trained ML Models Under the Hood"
            subtitle="Every recommendation is powered by a pipeline of specialized models working in concert."
          />

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
            gap: '1rem',
          }}>
            {mlModels.map((m, i) => (
              <motion.div
                key={m.name}
                initial={{ opacity: 0, scale: 0.96 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.05 }}
                style={{
                  padding: isMobile ? '1.25rem' : '1.5rem', borderRadius: '16px',
                  background: 'var(--glass-bg)', backdropFilter: 'blur(16px)',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '9999px',
                    background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <m.icon size={16} color="var(--accent)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{m.name}</h4>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>{m.purpose}</div>
                  </div>
                  <span style={{
                    fontSize: '0.6rem', fontWeight: 700, color: 'var(--accent)',
                    background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
                    padding: '0.15rem 0.5rem', borderRadius: '9999px', whiteSpace: 'nowrap',
                  }}>
                    {m.tech}
                  </span>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.65 }}>{m.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            TECH STACK
            ═══════════════════════════════════════════════════ */}
        <section style={{ maxWidth: '1100px', margin: '0 auto', padding: isMobile ? '2rem 1.25rem 4rem' : '3rem 1.5rem 5rem' }}>
          <SectionHeader
            id="tech"
            badge="Tech Stack"
            title="Built with Modern Technologies"
            subtitle="Enterprise-grade infrastructure powering every recommendation."
          />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
            {techStack.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.03 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.75rem 1.15rem', borderRadius: '14px',
                  background: 'var(--glass-bg)', backdropFilter: 'blur(12px)',
                  border: '1px solid var(--border)',
                }}
              >
                <t.icon size={16} color="var(--text-muted)" />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                    {t.name}{t.version ? ` ${t.version}` : ''}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                    {t.desc}
                  </div>
                </div>
                <span style={{
                  fontSize: '0.58rem', fontWeight: 700, color: 'var(--accent)',
                  background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
                  padding: '0.1rem 0.4rem', borderRadius: '9999px',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {t.category}
                </span>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            ARCHITECTURE
            ═══════════════════════════════════════════════════ */}
        <section style={{ maxWidth: '1100px', margin: '0 auto', padding: isMobile ? '2rem 1.25rem 4rem' : '3rem 1.5rem 5rem' }}>
          <SectionHeader
            id="architecture"
            badge="System Design"
            title="Platform Architecture"
            subtitle="A layered architecture designed for performance, scalability, and real-time ML inference."
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {architectureLayers.map((layer, i) => (
              <motion.div
                key={layer.label}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                style={{
                  padding: '1.5rem', borderRadius: '16px',
                  background: 'var(--glass-bg)', backdropFilter: 'blur(16px)',
                  border: '1px solid var(--border)',
                  borderLeft: `4px solid ${layer.color}`,
                  display: 'flex', flexDirection: isMobile ? 'column' : 'row',
                  gap: '1rem', alignItems: isMobile ? 'flex-start' : 'center',
                }}
              >
                <div style={{ minWidth: isMobile ? 'auto' : '180px' }}>
                  <div style={{ fontWeight: 900, fontSize: '1rem', color: layer.color, marginBottom: '0.25rem' }}>
                    {layer.label}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {layer.desc}
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', flex: 1 }}>
                  {layer.items.map(item => (
                    <span key={item} style={{
                      padding: '0.3rem 0.7rem', borderRadius: '8px',
                      fontSize: '0.72rem', fontWeight: 600,
                      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                      color: 'var(--text-secondary)',
                    }}>
                      {item}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            TERMS & CONDITIONS
            ═══════════════════════════════════════════════════ */}
        <section style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '2rem 1.25rem 4rem' : '3rem 1.5rem 5rem' }}>
          <SectionHeader
            id="terms"
            badge="Legal"
            title="Terms & Conditions"
            subtitle="Please read these terms carefully before using Mind Movie Ai."
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <AccordionItem title="1. Acceptance of Terms" defaultOpen>
              <p>By accessing and using Mind Movie Ai, you agree to be bound by these Terms & Conditions. If you do not agree to these terms, please do not use our service.</p>
        
            </AccordionItem>

            <AccordionItem title="2. User Accounts & Registration">
              <p>To access certain features, you must create an account with a valid email address. You are responsible for maintaining the confidentiality of your account credentials.</p>
              <p style={{ marginTop: '0.75rem' }}>Email verification via OTP is required for account activation. Google OAuth is available as an alternative authentication method.</p>
              <p style={{ marginTop: '0.75rem' }}>You must not create multiple accounts, share your credentials, or use automated tools to interact with the platform.</p>
            </AccordionItem>

            <AccordionItem title="3. Acceptable Use">
              <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <li>Do not submit fake reviews or manipulate sentiment analysis results.</li>
                <li>Do not use bots or automated scripts to spam ratings or reviews.</li>
                <li>Do not attempt to reverse-engineer, exploit, or attack the platform.</li>
                <li>Do not upload or share content that is illegal, offensive, or harmful.</li>
                <li>Respect intellectual property — movie data is sourced from TMDB under their API terms.</li>
              </ul>
            </AccordionItem>

            <AccordionItem title="4. Movie Data & Content">
              <p>All movie metadata, posters, and information are sourced from <strong>The Movie Database (TMDB) API</strong> under their terms of use. We do not claim ownership of any movie content.</p>
              <p style={{ marginTop: '0.75rem' }}>TMDB data is used for educational and non-commercial purposes only. All movie posters and images are property of their respective owners.</p>
            </AccordionItem>

            <AccordionItem title="5. AI & Machine Learning Disclaimer">
              <p>AI recommendations, sentiment analysis, and popularity predictions are generated by machine learning models and may not always be accurate.</p>
              <p style={{ marginTop: '0.75rem' }}>Our models are trained on limited datasets and may contain biases. Recommendations should be treated as suggestions, not definitive judgments.</p>
            </AccordionItem>

            <AccordionItem title="6. Limitation of Liability">
              <p>Mind Movie Ai is provided &quot;as is&quot; without any warranties. We are not liable for:</p>
              <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <li>Inaccurate recommendations or sentiment analysis results</li>
                <li>Service downtime or data loss</li>
                <li>Any damages arising from the use of this platform</li>
                <li>Third-party content accessed through external links</li>
              </ul>
            </AccordionItem>

            <AccordionItem title="7. Modifications">
              <p>We reserve the right to modify these terms at any time without prior notice. Continued use of the platform after changes constitutes acceptance of the updated terms.</p>
            </AccordionItem>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            PRIVACY POLICY
            ═══════════════════════════════════════════════════ */}
        <section style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '2rem 1.25rem 4rem' : '3rem 1.5rem 5rem' }}>
          <SectionHeader
            id="privacy"
            badge="Privacy"
            title="Privacy Policy"
            subtitle="We respect your privacy. Here's exactly what data we collect and why."
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <AccordionItem title="Data We Collect" defaultOpen>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem', marginTop: '0.25rem' }}>
                {[
                  { label: 'Account Info', desc: 'Username, email, hashed password, display name.' },
                  { label: 'Preferences', desc: 'Favorite genres, age, gender, movie sources.' },
                  { label: 'Activity Data', desc: 'Search queries, movie clicks, page views.' },
                  { label: 'Ratings & Reviews', desc: 'Movie ratings, review text, sentiment labels.' },
                  { label: 'Session Data', desc: 'Login timestamps, IP address, user agent.' },
                  { label: 'OAuth Data', desc: 'Google profile name, email, and avatar (if using Google Sign-In).' },
                ].map(d => (
                  <div key={d.label} style={{
                    padding: '0.75rem', borderRadius: '10px',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  }}>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      <CheckCircle2 size={12} color="var(--accent)" style={{ marginRight: '0.4rem', display: 'inline' }} />
                      {d.label}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{d.desc}</div>
                  </div>
                ))}
              </div>
            </AccordionItem>

            <AccordionItem title="How We Use Your Data">
              <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <li>To provide personalized movie recommendations based on your preferences and behavior.</li>
                <li>To improve our ML models&apos; accuracy by training on aggregated, anonymized usage patterns.</li>
                <li>To detect and prevent fake engagement (spam ratings, bot activity).</li>
                <li>To send OTP verification emails during registration (no marketing emails).</li>
                <li>To maintain session security and prevent unauthorized access.</li>
              </ul>
            </AccordionItem>

            <AccordionItem title="Data Storage & Security">
              <p>All data is stored in <strong>MongoDB Atlas</strong> (cloud-hosted, encrypted at rest). Passwords are hashed with <strong>bcrypt</strong>. JWT tokens are used for session management with configurable expiry.</p>
              <p style={{ marginTop: '0.75rem' }}>We do not sell, share, or trade your personal data with any third parties. Your data is only used to power the features of this platform.</p>
            </AccordionItem>

            <AccordionItem title="Your Rights">
              <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <li><strong>Access:</strong> View all your data through your profile page.</li>
                <li><strong>Correction:</strong> Update your profile info at any time.</li>
                <li><strong>Deletion:</strong> Contact us to request account deletion.</li>
                <li><strong>Portability:</strong> Your ratings and reviews can be exported.</li>
              </ul>
            </AccordionItem>

            <AccordionItem title="Cookies & Third-Party Services">
              <p>We use <strong>localStorage</strong> for theme preferences and JWT token storage. No third-party tracking cookies are used.</p>
              <p style={{ marginTop: '0.75rem' }}>External services used: Google OAuth (authentication), TMDB API (movie data), Hugging Face (model storage).</p>
            </AccordionItem>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            CONTACT & LINKS
            ═══════════════════════════════════════════════════ */}
        <section style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '2rem 1.25rem 4rem' : '3rem 1.5rem 5rem' }}>
          <SectionHeader
            id="contact"
            badge="Get in Touch"
            title="Contact & Links"
            subtitle="Have questions, feedback, or want to report an issue? Reach out to us."
          />

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
            gap: '1.25rem',
          }}>
            {/* Contact Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              style={{
                padding: '2rem', borderRadius: '20px',
                background: 'var(--glass-bg)', backdropFilter: 'blur(16px)',
                border: '1px solid var(--border)',
              }}
            >
              <h3 style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '1.25rem' }}>
                Contact Us
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <a href="mailto:mindmovieai16@gmail.com" style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.875rem 1rem', borderRadius: '12px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  textDecoration: 'none', transition: 'border-color 0.2s ease',
                }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Mail size={16} color="var(--accent)" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>Email</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>mindmovieai16@gmail.com</div>
                  </div>
                </a>

                <a href="https://github.com" target="_blank" rel="noopener noreferrer" style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.875rem 1rem', borderRadius: '12px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  textDecoration: 'none', transition: 'border-color 0.2s ease',
                }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: 'var(--purple-subtle)', border: '1px solid rgba(139,92,246,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Code2 size={16} color="var(--purple)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>GitHub Repository</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>View source code</div>
                  </div>
                  <ExternalLink size={14} color="var(--text-muted)" />
                </a>
              </div>
            </motion.div>

            {/* Quick Links Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              style={{
                padding: '2rem', borderRadius: '20px',
                background: 'var(--glass-bg)', backdropFilter: 'blur(16px)',
                border: '1px solid var(--border)',
              }}
            >
              <h3 style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '1.25rem' }}>
                Quick Navigation
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                {[
                  { label: 'Explore Movies', href: '/explore', icon: Compass },
                  { label: 'Favorites', href: '/favorites', icon: Heart },
                  { label: 'Watchlist', href: '/watchlist', icon: BookmarkPlus },
                  { label: 'Mood Discovery', href: '/mood', icon: Sparkles },
                  { label: 'Profile', href: '/profile', icon: Users },
                  { label: 'Register', href: '/register', icon: ArrowRight },
                  { label: 'Login', href: '/login', icon: Lock },
                ].map(link => (
                  <Link key={link.href} href={link.href} style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.65rem 0.75rem', borderRadius: '10px',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600,
                    color: 'var(--text-secondary)', transition: 'all 0.2s ease',
                  }}>
                    <link.icon size={14} color="var(--text-muted)" />
                    {link.label}
                  </Link>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            CREDITS
            ═══════════════════════════════════════════════════ */}
        <section style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '2rem 1.25rem 3rem' : '2rem 1.5rem 4rem' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            style={{
              padding: '2rem', borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(16,185,129,0.05), rgba(139,92,246,0.05))',
              border: '1px solid var(--border)', textAlign: 'center',
            }}
          >
            <h3 style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              Acknowledgments
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.75, maxWidth: '600px', margin: '0 auto 1.25rem' }}>
              Movie data provided by{' '}
              <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                TMDB
              </a>.
              ML models powered by{' '}
              <a href="https://pytorch.org" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                PyTorch
              </a>{' '}&{' '}
              <a href="https://tensorflow.org" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                TensorFlow
              </a>.
              Deployed on{' '}
              <a href="https://render.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                Render
              </a>.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              © {new Date().getFullYear()} Mind Movie Ai
            </p>
          </motion.div>
        </section>
      </div>

      <Footer />
    </>
  );
}
