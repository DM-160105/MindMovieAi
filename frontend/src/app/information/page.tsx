'use client';

import { motion } from 'framer-motion';
import { Brain, Database, Layers, Cpu, Film } from 'lucide-react';
import Footer from '@/components/Footer';

const tech = [
  { icon: Brain, title: 'Sentiment Analysis', desc: 'Dual-model sentiment inference using TensorFlow BiLSTM and PyTorch, running in parallel for maximum accuracy on movie overviews and user reviews.', color: 'var(--purple)' },
  { icon: Database, title: 'Content-Based Filtering', desc: 'Cosine-similarity recommender over 11,000+ movie metadata vectors (genres, tags, overview embeddings) for instant similar-movie suggestions.', color: 'var(--accent)' },
  { icon: Layers, title: 'Collaborative Filtering', desc: 'User-preference engine that analyses your search history and click activity to model latent genre affinities and recommend movies you\'ll love.', color: 'var(--accent-2)' },
  { icon: Cpu, title: 'Deep Learning Recommender', desc: 'PyTorch neural collaborative filtering model trained on user-movie interactions for personalised rankings beyond simple genre matching.', color: 'var(--warning)' },
  { icon: Film, title: 'Movie Catalog', desc: 'Aggregated dataset of 11,000+ Bollywood, Hollywood, and Anime films with TMDB metadata, cast, poster images, and financial data.', color: 'var(--danger)' },
];

const stack = [
  'Next.js 15', 'React 19', 'TypeScript', 'TailwindCSS v4', 'Framer Motion',
  'FastAPI', 'PostgreSQL', 'SQLAlchemy', 'PyTorch', 'TensorFlow/Keras',
  'scikit-learn', 'pandas', 'numpy', 'TMDB API',
];

export default function InformationPage() {
  return (
    <>
    <div className="page-container">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: '1rem' }}>
            About{' '}
            <span style={{ color: 'var(--accent)' }}>Mind Movie Ai</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '560px', margin: '0 auto', lineHeight: 1.7 }}>
            A full-stack AI movie recommendation platform built with FastAPI, PyTorch, TensorFlow, and Next.js — combining multiple ML approaches for a truly personalised experience.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '3rem' }}>
          {tech.map((t, i) => (
            <motion.div key={t.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="card" style={{ padding: '1.75rem' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '0.75rem', background: `color-mix(in srgb, ${t.color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${t.color} 25%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <t.icon size={20} color={t.color} />
              </div>
              <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.6rem' }}>{t.title}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6 }}>{t.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="card" style={{ padding: '2rem' }}>
          <h2 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '1.25rem' }}>Technology Stack</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
            {stack.map((s) => (
              <span key={s} style={{ padding: '0.35rem 0.85rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
    <Footer />
    </>
  );
}
