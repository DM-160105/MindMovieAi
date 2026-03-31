'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useDevice } from '@/context/DeviceContext';
import { useGoogleLogin } from '@react-oauth/google';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { isMobile } = useDevice();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.password) { toast.error('Please fill in all fields'); return; }
    setLoading(true);
    try {
      const loggedInUser = await login(form.username, form.password);
      toast.success('Welcome back!');
      if (loggedInUser.is_admin || loggedInUser.username === 'admin') {
        router.push('/admin');
      } else {
        router.push('/explore');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Invalid username or password';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: tokenResponse.access_token }),
        });
        if (!res.ok) throw new Error('Google Login Failed');
        const data = await res.json();
        localStorage.setItem('stremflix_token', data.access_token);
        toast.success('Welcome via Google!');
        window.location.href = '/explore'; 
      } catch (err) {
        toast.error('Google authentication failed');
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      toast.error('Google login was cancelled or failed.');
    }
  });

  return (
    <>
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1 }}>
      </div>
    <div style={{ minHeight: isMobile ? '90vh' : '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem' }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="card"
        style={{ width: '100%', maxWidth: '440px', padding: '2.5rem' }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
           <div style={{ width: isMobile ? '80px' : '120px', height: isMobile ? '80px' : '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem',outline: '3px solid var(--logo-outline)',outlineOffset: '4px',borderRadius: '9999px'}}>
            <img src="/logo.png" alt="Logo" width={isMobile ? '80px' : '120px'} height={isMobile ? '80px' : '120px'} style={{ borderRadius: '9999px'}}/>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Welcome back</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Sign in to your Mind Movie Ai account</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="input-group-floating">
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              value={form.username}
              onChange={(e) => setForm(p => ({ ...p, username: e.target.value }))}
              placeholder=" "
              className="input-floating"
              required
            />
            <label htmlFor="login-username" className="label-floating">Username or Email</label>
          </div>
          <div className="input-group-floating">
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
              placeholder=" "
              className="input-floating"
              required
            />
            <label htmlFor="login-password" className="label-floating">Password</label>
          </div>
          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', marginTop: '0.5rem', padding: '0.875rem' }}>
            {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in…</> : 'Sign In'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1.5rem 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>OR</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
        </div>

        <button type="button" onClick={() => handleGoogleLogin()} disabled={loading} className="btn-secondary" style={{ width: '100%', padding: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', background: '#fff', color: '#000', border: 'none' }}>
           {/* eslint-disable-next-line @next/next/no-img-element */}
           <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" style={{ width: 20, height: 20 }} />
           <span style={{ fontWeight: 600 }}>Continue with Google</span>
        </button>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          No account?{' '}
          <Link href="/register" style={{ color: 'var(--accent)', fontWeight: 700 }}>Create one</Link>
        </p>
      </motion.div>
    </div>
    </>
  );
}
