'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';
import { Loader2, Film } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useIsMobile } from '@/hooks/useIsMobile';
import ShapeGrid from '@/components/ShapeGrid';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ display_name: '', username: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.password) { toast.error('Username and password are required'); return; }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await register({ username: form.username, email: form.email, password: form.password, display_name: form.display_name });
      toast.success('Account created! Setting up your profile…');
      router.push('/wizard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Registration failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const field = (id: string, label: string, type: string, key: keyof typeof form, placeholder: string, required = false) => (
    <div key={id}>
      <label htmlFor={id} style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
        {label}{required && ' *'}
      </label>
      <input
        id={id}
        type={type}
        value={form[key]}
        onChange={(e) => setForm(p => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder}
        className="input-base"
        required={required}
        autoComplete={type === 'password' ? 'new-password' : undefined}
      />
    </div>
  );

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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem' }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="card"
        style={{ width: '100%', maxWidth: '460px', padding: '2.5rem' }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: isMobile ? '80px' : '120px', height: isMobile ? '80px' : '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <img src="/logo.png" alt="Logo" width={isMobile ? '80px' : '120px'} height={isMobile ? '80px' : '120px'} style={{ borderRadius: '9999px'}}/>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Create Account</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Join Mind Movie Ai — it&apos;s free</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          {field('reg-name', 'Display Name', 'text', 'display_name', 'Your name')}
          {field('reg-username', 'Username', 'text', 'username', 'Choose a username', true)}
          {field('reg-email', 'Email', 'email', 'email', 'your@email.com')}
          {field('reg-password', 'Password', 'password', 'password', '••••••••', true)}
          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', marginTop: '0.5rem', padding: '0.875rem' }}>
            {loading ? <><Loader2 size={16} className="animate-spin" /> Creating account…</> : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 700 }}>Sign in</Link>
        </p>
      </motion.div>
    </div>
    </>
  );
}
