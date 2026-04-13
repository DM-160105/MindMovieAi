'use client';

import { useState, useEffect } from 'react';
import { getServerStatus } from '@/lib/api';

interface ServerWarmupProps {
  children: React.ReactNode;
}

/**
 * ServerWarmup — Glassmorphic overlay shown while the backend loads artifacts.
 *
 * Wraps page content and polls /health every 3s. Once data_ready=true,
 * the overlay fades out and children become interactive.
 *
 * Usage:
 *   <ServerWarmup>
 *     <MovieGrid movies={movies} />
 *   </ServerWarmup>
 */
export default function ServerWarmup({ children }: ServerWarmupProps) {
  const [status, setStatus] = useState<'checking' | 'warming' | 'ready'>('checking');
  const [progress, setProgress] = useState(0);
  const [serverInfo, setServerInfo] = useState('');

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    let progressInterval: ReturnType<typeof setInterval>;
    let cancelled = false;

    const check = async () => {
      if (cancelled) return;
      const s = await getServerStatus();
      if (cancelled) return;

      if (s.ready && s.dataReady) {
        setStatus('ready');
        setProgress(100);
        clearInterval(interval);
        clearInterval(progressInterval);
      } else if (s.ready) {
        setStatus('warming');
        setServerInfo(`Connected to ${s.activeServer} server`);
      } else {
        setStatus('warming');
        setServerInfo('Connecting to server...');
      }
    };

    check();
    interval = setInterval(check, 3000);

    // Simulated progress for smooth UX
    progressInterval = setInterval(() => {
      if (!cancelled) {
        setProgress((prev) => Math.min(prev + Math.random() * 12, 92));
      }
    }, 800);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearInterval(progressInterval);
    };
  }, []);

  // Already warm — render children directly
  if (status === 'ready') return <>{children}</>;

  return (
    <>
      {/* Dimmed skeleton of actual content */}
      <div style={{ opacity: 0.15, pointerEvents: 'none', filter: 'blur(2px)' }}>
        {children}
      </div>

      {/* Warm-up overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            color: '#fff',
            maxWidth: 420,
            padding: '40px 32px',
            borderRadius: 20,
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          }}
        >
          {/* Animated icon */}
          <div
            style={{
              fontSize: 56,
              marginBottom: 20,
              animation: 'pulse 2s ease-in-out infinite',
            }}
          >
            🎬
          </div>

          <h2
            style={{
              fontSize: 22,
              fontWeight: 600,
              marginBottom: 8,
              background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Warming up the AI engine
          </h2>

          <p style={{ opacity: 0.6, fontSize: 14, marginBottom: 28, lineHeight: 1.5 }}>
            Loading movie database &amp; ML models.
            <br />
            This only takes a few seconds.
          </p>

          {/* Progress bar */}
          <div
            style={{
              width: '100%',
              height: 6,
              borderRadius: 3,
              background: 'rgba(255, 255, 255, 0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                borderRadius: 3,
                background: 'linear-gradient(90deg, #8B5CF6, #EC4899, #F59E0B)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s linear infinite',
                transition: 'width 0.5s ease',
              }}
            />
          </div>

          <p style={{ opacity: 0.4, fontSize: 12, marginTop: 12 }}>
            {status === 'checking' ? 'Connecting...' : serverInfo || 'Almost there...'}
          </p>
        </div>
      </div>

      {/* CSS animations */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </>
  );
}
