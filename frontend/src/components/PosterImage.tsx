'use client';

import { useState } from 'react';
import { Film } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';

interface PosterImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function PosterImage({ src, alt, className = '', style }: PosterImageProps) {
  const [error, setError] = useState(false);
  const isMobile = useIsMobile();

  const isBroken = error || !src || src.includes('placehold.co') || src === 'N/A';

  if (isBroken) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(22, 27, 34, 0.9)',
          padding: '1rem',
       
          textAlign: 'center',
          gap: '0.5rem',
          ...style,
        }}
      >
        <div style={{ marginTop: isMobile ? '5.5rem' : '12rem' }}>
          <Film size={36} color="#475569" />
        
        <span
          style={{
            color: '#94a3b8',
            fontSize: '0.7rem',
            fontWeight: 700,
            lineHeight: 1.3,
            maxWidth: '100%',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            letterSpacing: '0.02em',
          }}
        >
          {alt}
        </span>
        <span style={{ color: '#475569', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
          No Poster
        </span>
        </div>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      onError={() => setError(true)}
      loading="lazy"
    />
  );
}
