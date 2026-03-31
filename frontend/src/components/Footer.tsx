'use client';

import Link from 'next/link';
import { Github, Heart, Mail, ExternalLink, Sparkles, ChevronsRight } from 'lucide-react';
import { useDevice } from '@/context/DeviceContext';

const footerLinks = {
  product: [
    { label: 'Explore Movies', href: '/explore' },
    { label: 'Favorites', href: '/favorites' },
    { label: 'Watchlist', href: '/watchlist' },
  ],
  company: [
    { label: 'About Us', href: '/information' },
    { label: 'How It Works', href: '/information' },
  ],
};



export default function Footer() {
  const currentYear = new Date().getFullYear();
  const { isMobile } = useDevice();

  return (
    <footer className="footer">
      {/* Decorative top border gradient */}
      <div className="footer-gradient-border" aria-hidden />

      <div className="footer-container">
        {/* ── Top section ─────────────────────────── */}
        <div className="footer-top">
          {/* Brand column */}
          <div className="footer-brand">
            <Link href="/" className="footer-logo-link">
              
                <img src="/logo.png" alt="Logo" width={40} height={40} style={{borderRadius: '999px', outline: '1px solid var(--logo-outline)', outlineOffset: '2px'}} />
           
              <span className="footer-logo-text">Mind Movie Ai</span>
            </Link>
            <p className="footer-tagline">
              Discover your next favorite movie with AI-powered recommendations.
              Bollywood, Hollywood, Anime — all in one place.
            </p>
            <div className="footer-badge">
              <Sparkles size={12} />
              <span>Powered by Machine Learning</span>
            </div>
          </div>

          {/* Links columns */}
          <div className="footer-links-group">
            <div className="footer-links-col">
              <h4 className="footer-col-title">Navigate</h4>
              <ul className="footer-links-list">
                {footerLinks.product.map(({ label, href }) => (
                  <li key={label}>
  <Link href={href} className="footer-link">
    <div className="footer-link-inner">
      <span className="chevron-icon">
        <ChevronsRight size={12} />
      </span>
      {label}
    </div>
  </Link>
</li>
                ))}
              </ul>
            </div>

            <div className="footer-links-col">
              <h4 className="footer-col-title">Learn More</h4>
              <ul className="footer-links-list">
                {footerLinks.company.map(({ label, href }) => (
                 <li key={label}>
  <Link href={href} className="footer-link">
    <div className="footer-link-inner">
      <span className="chevron-icon">
        <ChevronsRight size={12} />
      </span>
      {label}
    </div>
  </Link>
</li>
                ))}
              </ul>
            </div>
          </div>

          {/* CTA / Social column */}
          <div className="footer-social-col">
            <h4 className="footer-col-title">Connect</h4>
            <div className={isMobile ? "footer-social-links-mobile" : "footer-social-links"}>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-social-btn"
                title="GitHub"
              >
                <Github size={16} />
                <span>GitHub</span>
                <ExternalLink size={10} className="footer-ext-icon" />
              </a>
              <a
                href="mailto:mindmovieai16@gmail.com"
                className="footer-social-btn"
                title="Email us"
              >
                <Mail size={16} />
                <span>Contact</span>
              </a>
            </div>
          </div>
        </div>

        {/* ── Bottom bar ─────────────────────────── */}
        <div className="footer-bottom" style={{marginTop:'2rem'}}>
          <p className="footer-copyright">
            © {currentYear} Mind Movie Ai. Crafted with{' '}
            <Heart size={12} className="footer-heart" /> and AI.
          </p>
          <p className="footer-built-with">
            Built with Next.js, Python & Machine Learning
          </p>
        </div>
         {/* ── Divider ────────────────────────────── */}
        <div className="footer-divider" style={{marginTop:'1rem'}} />
      </div>

         <div className='outfit-600'
  style={{
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    fontWeight: 750,
    fontSize: "clamp(2.5rem, 10vw, 11rem)",
    WebkitBackgroundClip: "text", 
    backgroundClip: "text",
    backgroundImage: "var(--footer-text)",
    color: "transparent",
    lineHeight: 0.9,
    letterSpacing: "-0.007em",
  }}
>
  Mind Movie AI
</div>

      <style>{`
        /* ── Footer Component ─────────────────────────────── */
        .footer {
          position: relative;
          margin-top: 4rem;
          background: var(--footer-bg);
          border-top: 1px solid var(--border);
          z-index: 2;
          overflow: hidden;
        }

        .footer-gradient-border {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            var(--accent) 20%,
            var(--purple) 50%,
            var(--accent-2) 80%,
            transparent 100%
          );
          opacity: 0.6;
        }

        .footer-container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 3rem 1.5rem 0rem;
        }

        /* ── Top section grid ─────────────────────── */
        .footer-top {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr;
          gap: 3rem;
          align-items: start;
        }

        /* ── Brand ────────────────────────────────── */
        .footer-brand {
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
        }

        .footer-logo-link {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          text-decoration: none;
          width: fit-content;
        }

        .footer-logo-icon {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: linear-gradient(135deg, var(--accent), var(--purple));
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          flex-shrink: 0;
        }

        .footer-logo-text {
          font-weight: 800;
          font-size: 1rem;
          color: var(--text-primary);
          letter-spacing: -0.02em;
        }

        .footer-tagline {
          color: var(--text-secondary);
          font-size: 0.82rem;
          line-height: 1.6;
          max-width: 300px;
        }

        .footer-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.3rem 0.75rem;
          border-radius: 9999px;
          background: var(--accent-subtle);
          border: 1px solid var(--accent-border);
          color: var(--accent);
          font-size: 0.7rem;
          font-weight: 600;
          width: fit-content;
        }

        /* ── Link columns ─────────────────────────── */
        .footer-links-group {
          display: flex;
          gap: 3rem;
        }

        .footer-links-col {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .footer-col-title {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          margin-bottom: 0.25rem;
        }

        .footer-links-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .footer-link {
          color: var(--text-secondary);
          font-size: 0.82rem;
          font-weight: 500;
          text-decoration: none;
          transition: color 0.2s ease, transform 0.2s ease;
          display: inline-block;
          padding: 0.15rem 0;
        }

        .footer-link:hover {
          color: var(--accent);
          transform: translateX(3px);
        }

        /* ── Social / Connect ─────────────────────── */
        .footer-social-col {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .footer-social-links {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .footer-social-links-mobile {
          display: flex;
          gap: 0.5rem;
        }

        .footer-social-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.875rem;
          border-radius: var(--radius-md);
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          color: var(--text-secondary);
          font-size: 0.8rem;
          font-weight: 500;
          text-decoration: none;
          transition: all 0.2s ease;
          width: fit-content;
        }

        .footer-social-btn:hover {
          border-color: var(--accent-border);
          color: var(--accent);
          background: var(--accent-subtle);
          transform: translateY(-1px);
        }

        .footer-ext-icon {
          opacity: 0.4;
          margin-left: auto;
        }

        /* ── Divider ──────────────────────────────── */
        .footer-divider {
          height: 1px;
          background: var(--border);
          margin: 2rem 0 1.25rem;
        }

        /* ── Bottom bar ───────────────────────────── */
        .footer-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .footer-copyright {
          color: var(--text-muted);
          font-size: 0.75rem;
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
        }

        .footer-heart {
          color: var(--danger);
          fill: var(--danger);
          animation: heartbeat 1.8s ease-in-out infinite;
        }

        .footer-built-with {
          color: var(--text-muted);
          font-size: 0.72rem;
          font-weight: 500;
        }

        @keyframes heartbeat {
          0%, 100% { transform: scale(1); }
          15% { transform: scale(1.25); }
          30% { transform: scale(1); }
          45% { transform: scale(1.15); }
          60% { transform: scale(1); }
        }

        /* ── Responsive ───────────────────────────── */
        @media (max-width: 768px) {
          .footer-top {
            grid-template-columns: 1fr;
            gap: 2rem;
          }

          .footer-links-group {
            gap: 2rem;
          }

          .footer-bottom {
            flex-direction: column;
            align-items: center;
            text-align: center;
            gap: 0.35rem;
          }

          .footer-container {
            padding: 2rem 1.25rem 0rem;
          }
        }
          .footer-link-inner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.chevron-icon {
  opacity: 0;
  transform: translateX(-6px);
  transition: all 0.25s ease;
}

.footer-link:hover .chevron-icon {
  opacity: 1;
  transform: translateX(0);
}

        @media (max-width: 480px) {
          .footer-links-group {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 1.5rem;
          }
        }
      `}</style>
    </footer>
  );
}
