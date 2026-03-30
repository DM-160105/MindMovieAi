'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useState } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { Compass, Heart, Bookmark, Youtube, User, LogIn, Moon, Sun, ShieldCheck, Brain, Info } from 'lucide-react';
import { useEffect, useRef } from "react";

const navLinks = [
  { href: '/explore',   label: 'Explore',    icon: Compass, auth: true },
  { href: '/mood',      label: 'Mood',       icon: Brain,   auth: true },
  { href: '/youtube',   label: 'YouTube',    icon: Youtube, auth: true },
  { href: '/favorites', label: 'Favorites',  icon: Heart,   auth: true },
  { href: '/watchlist', label: 'Watchlist',  icon: Bookmark,auth: true },
  { href: '/information', label: 'About',   icon: Info,    auth: false },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const menuRef = useRef(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      // Add a small threshold to avoid jitter
      if (currentScrollY > lastScrollY && currentScrollY > 60) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !(menuRef.current as HTMLElement).contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuRef]);

  const handleLogout = () => {
    logout();
    router.push('/');
    setMenuOpen(false);
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const linkStyle = (href: string) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.4rem 0.75rem',
    borderRadius: '9999px',
    border: isActive(href) ? '1px solid var(--accent)' : '',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: isActive(href) ? 'var(--accent)' : 'var(--text-secondary)',
    background: isActive(href) ? 'var(--accent-subtle)' : 'transparent',
    textDecoration: 'none',
    transition: 'color 0.2s, background 0.2s',
    cursor: 'pointer',
  } as React.CSSProperties);

  if (pathname.startsWith('/admin')) return null;

  return (
    <nav 
      className="navbar" 
      role="navigation" 
      aria-label="Main navigation"
      style={{
        transform: isVisible ? 'translateY(0)' : 'translateY(calc(-100% - 20px))',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: isMobile ? '0.78rem' : undefined, height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
         <nav className="navbar-relative" role="navigation" aria-label="Main navigation">

        {/* Brand */}
        <Link href={user ? (user.is_admin ? '/admin' : '/explore') : '/'} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', flexShrink: 0 }} onClick={() => setMenuOpen(false)}>
          <div style={{ width: '30px', height: '30px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/logo.png" alt="Logo" width={30} height={30} style={{ borderRadius: '9999px', outline: '1px solid var(--logo-outline)',outlineOffset: '1.5px' }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: '0.9rem',color: '#787777ff', letterSpacing: '-0.02em' }}>
            Mind Movie Ai
          </span>
        </Link>
        </nav>
        {!isMobile && !user?.is_admin && (
          <nav className="navbar-relative" role="navigation" aria-label="Main navigation">
            {/* Desktop nav */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flex: 1, justifyContent: 'center' }} className="desktop-nav">
              {navLinks.filter(l => !l.auth || user).map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} style={linkStyle(href)}>
                  {Icon && <Icon size={14} />}
                  {label}
                </Link>
              ))}
            </div>
          </nav>
        )}
        {/* Right side */}
        <nav className="navbar-relative" role="navigation" aria-label="Main navigation" style={{ paddingLeft: isMobile ? '0.6rem' : undefined, paddingRight: isMobile ? '0.6rem' : undefined}}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
          {/* Theme toggle — Telegram style */}
          {user ? (
          <button
            onClick={toggle}
            className="theme-toggle"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <span className={`theme-toggle-thumb ${theme === 'light' ? 'active' : ''}`}>
              {theme === 'dark'
                ? <Moon size={10} color="#fff" />
                : <Sun size={10} color="#fff" />
              }
            </span>
          </button>): isMobile ? undefined : (
          <button
            onClick={toggle}
            className="theme-toggle"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <span className={`theme-toggle-thumb ${theme === 'light' ? 'active' : ''}`}>
              {theme === 'dark'
                ? <Moon size={10} color="#fff" />
                : <Sun size={10} color="#fff" />
              }
            </span>
          </button>)}

          {user ? (
            <>
              {user.is_admin && (
                <Link href="/admin" style={{ display: 'flex', alignItems: 'center', padding: '0.35rem', borderRadius: '0.5rem', color: 'var(--warning)', textDecoration: 'none' }} title="Admin Panel">
                  <ShieldCheck size={18} />
                </Link>
              )}
              <Link
                href={isMobile ? "#" : "/profile"}
                style={{
                  width: '34px', height: '34px', borderRadius: '50%',
                  background: 'var(--glass-bg)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: '0.8rem', color: '#787777ff',
                  textDecoration: 'none', flexShrink: 0,
                  border: '2px solid var(--border)',
                  overflow: 'hidden'
                }}
                title="Profile"
              >
                {user?.avatar_url ? (
                  isMobile ? (
                    <button onClick={() => setMenuOpen(!menuOpen)} style={{ width: '100%', height: '100%', border: 'none', background: 'none', cursor: 'pointer' }}>
                      <img src={user.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                    </button>
                  ) : (
                    <img src={user.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                  )
                ) : (
                  isMobile ? (
                    <button onClick={() => setMenuOpen(!menuOpen)} style={{ width: '120%', height: '120%', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 900, fontSize: '0.8rem', color: '#787777ff' }}>
                      {(user?.display_name || user?.username || 'U').trim().split(/\s+/).map(word => word[0]).join('').toUpperCase()}
                    </button>
                  ) : (
                    (user?.display_name || user?.username || 'U').trim().split(/\s+/).map(word => word[0]).join('').toUpperCase()
                  )
                )}
              </Link>
            </>
          ) : (
            <>
            {isMobile ? ( <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Link href="/login" className="btn-secondary" style={{ padding: '0.45rem 0.7rem', fontSize: '0.7rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <LogIn size={14} /> Login
              </Link>
              <Link href="/register" className="btn-primary-mobile" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center',}}>
                Sign Up
              </Link>
            </div>) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Link href="/login" className="btn-secondary" style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <LogIn size={14} /> Login
              </Link>
              <Link href="/register" className="btn-primary" style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                Sign Up
              </Link>
            </div>
            )}
            </>
          )}
        </div>
        </nav>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          ref={menuRef}
          style={{
          position: 'absolute', top: '64px', right: '14px',
          background: 'var(--glass-bg)',
          WebkitBackdropFilter: 'var(--glass-blur)',
          backdropFilter: 'var(--glass-blur)',
          border: '2px solid var(--border)',
          transition: 'background var(--transition), border-color var(--transition)',
          borderRadius: '15px',
          flexDirection: 'column',
          padding: '1rem 1.3rem',
          display: 'flex', gap: '0.5rem',
          zIndex: 200,
        }}>
          {navLinks.filter(l => (!l.auth || user) && !user?.is_admin).map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setMenuOpen(false)}
              style={{ ...linkStyle(href), justifyContent: 'flex-start',}}
            >
              {Icon && <Icon size={16} />}
              {label}
            </Link>
          ))}
          {user ? (
            <>
              <Link href="/profile" onClick={() => setMenuOpen(false)} style={{ ...linkStyle('/profile'), justifyContent: 'flex-start', padding: '0.625rem 0.875rem' }}>
                <User size={16} /> Profile
              </Link>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <button onClick={handleLogout} style={{ ...linkStyle('/'), justifyContent: 'flex-start', padding: '0.625rem 0.875rem', color: 'var(--danger)', background: 'var(--danger-subtle)', border: '1.5px solid var(--border)' }}>
                  Sign Out
                </button>
              </div>
            </>
          ) : (
          undefined
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
        @media (min-width: 769px) {
          .mobile-menu-btn { display: none !important; }
          #desktop-logout { display: inline-flex !important; }
        }
      `}</style>
    </nav>
  );
}
