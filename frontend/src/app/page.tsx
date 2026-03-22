'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';
import { Compass, Zap, Brain, Film } from 'lucide-react';
import Link from 'next/link';
import ShapeGrid from '@/components/ShapeGrid';
import Footer from '@/components/Footer';

const features = [
  { icon: Brain, title: 'AI Recommendations', desc: 'Deep learning models trained on your taste — genres, ratings, watch history.' },
  { icon: Zap, title: 'Instant Search', desc: 'TF-IDF + cosine similarity search across 11,000+ Bollywood, Hollywood & Anime films.' },
  { icon: Compass, title: 'Explore & Discover', desc: 'Filter by genre, rating, year, source. Save to Favorites or Watchlist.' },
  { icon: Film, title: 'Sentiment Analysis', desc: 'Dual-model PyTorch + TensorFlow sentiment on movie reviews and YouTube comments.' },
];

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace('/explore');
  }, [user, loading, router]);

  if (loading) return null;

  return (
    <>
     <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1 }}>
        <ShapeGrid 
          speed={1}
          squareSize={35}
          direction="up"
          borderColor="rgba(255,255,255,0.05)"
          hoverFillColor="rgba(255,255,255,0.1)"
          shape="hexagon"
          hoverTrailAmount={2}
        />
      </div>
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      {/* Background Grid */}
      <section style={{ maxWidth: '900px', margin: '0 auto', padding: '5rem 1.5rem 4rem', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)', borderRadius: '9999px', padding: '0.35rem 1rem', marginBottom: '2rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>✦ AI-Powered</span>
          </div>

          <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: '1.5rem' }}>
            Discover Movies<br />
            <span style={{ color: 'var(--accent)' }}>You&apos;ll Actually Love</span>
          </h1>

          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '560px', margin: '0 auto 2.5rem', lineHeight: 1.7 }}>
            Personalised AI recommendations across Bollywood, Hollywood, and Anime — powered by deep learning, TF-IDF search, and dual-model sentiment analysis.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register" className="btn-primary" style={{ padding: '0.875rem 2.5rem', fontSize: '1rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              Get Started Free
            </Link>
            <Link href="/login" className="btn-secondary" style={{ padding: '0.875rem 2rem', fontSize: '1rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              Sign In
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Feature cards */}
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 1.5rem 6rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="card"
              style={{ padding: '1.75rem' }}
            >
              <div style={{ width: '44px', height: '44px', background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <f.icon size={20} color="var(--accent)" />
              </div>
              <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{f.title}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6 }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
    <Footer />
    </>
  );
}
