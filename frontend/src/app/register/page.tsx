'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useDevice } from '@/context/DeviceContext';
import { useGoogleLogin } from '@react-oauth/google';

export default function RegisterPage() {
  const { register, refreshUser } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ display_name: '', username: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const { isMobile } = useDevice();

  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  useEffect(() => {
    if (showOtp) {
      document.body.classList.add('hide-navbar');
    } else {
      document.body.classList.remove('hide-navbar');
    }
    return () => document.body.classList.remove('hide-navbar');
  }, [showOtp]);

  const pwd = form.password;
  const validations = {
    length: pwd.length >= 8,
    lower: /[a-z]/.test(pwd),
    upper: /[A-Z]/.test(pwd),
    digit: /\d/.test(pwd),
    special: /[@$!%*?&#]/.test(pwd),
  };
  const isPwdValid = Object.values(validations).every(Boolean);
  const doPasswordsMatch = form.password === form.confirmPassword && form.password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.password) { toast.error('Username and password are required'); return; }
    if (!doPasswordsMatch) { toast.error('Passwords do not match'); return; }
    if (!isPwdValid) { toast.error('Please meet all password requirements'); return; }
    setLoading(true);
    try {
      await register({ username: form.username, email: form.email, password: form.password, display_name: form.display_name });
      if (form.email) {
        toast.success('Account created! Please verify your email.');
        setShowOtp(true);
      } else {
        toast.success('Account created!');
        router.push('/wizard');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Registration failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.email || form.username, otp_code: otpCode }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Invalid OTP');
      }
      
      const data = await res.json();
      if (data.access_token) {
        localStorage.setItem('stremflix_token', data.access_token);
        await refreshUser();
      }
      
      toast.success('Email verified successfully!');
      router.push('/wizard');
    } catch(err: any) {
      toast.error(err.message || 'Verification failed');
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
        toast.success('Account created via Google!');
        window.location.href = '/wizard'; 
      } catch (err) {
        toast.error('Google registration failed');
      } finally {
        setLoading(false);
      }
    },
    onError: () => toast.error('Google login cancelled.'),
  });

  const field = (id: string, label: string, type: string, key: keyof typeof form, placeholder: string, required = false) => (
    <div key={id} className="input-group-floating">
      <input
        id={id}
        type={type}
        value={form[key]}
        onChange={(e) => setForm(p => ({ ...p, [key]: e.target.value }))}
        placeholder=" "
        className="input-floating"
        required={required}
        autoComplete={type === 'password' ? 'new-password' : undefined}
      />
      <label htmlFor={id} className="label-floating">
        {label}{required && ' *'}
      </label>
    </div>
  );

  return (
    <>
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1 }}>
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
          {field('reg-email', 'Email', 'email', 'email', 'your@email.com', true)}
          
          <div key="reg-password" className="input-group-floating">
            <input
              id="reg-password"
              type="password"
              value={form.password}
              onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
              placeholder=" "
              className="input-floating"
              required
              autoComplete="new-password"
            />
            <label htmlFor="reg-password" className="label-floating">
              Password *
            </label>
            {form.password && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', padding: '0.5rem', background: 'var(--glass-bg)', borderRadius: '8px' }}>
                 <span style={{ color: validations.length ? 'var(--accent)' : 'inherit' }}>{validations.length ? '✓' : '○'} At least 8 characters</span>
                 <span style={{ color: validations.upper && validations.lower ? 'var(--accent)' : 'inherit' }}>{validations.upper && validations.lower ? '✓' : '○'} Upper & lowercase letters</span>
                 <span style={{ color: validations.digit ? 'var(--accent)' : 'inherit' }}>{validations.digit ? '✓' : '○'} At least one number</span>
                 <span style={{ color: validations.special ? 'var(--accent)' : 'inherit' }}>{validations.special ? '✓' : '○'} Special character (@$!%*?&#)</span>
              </div>
            )}
          </div>

          <div key="reg-confirm-password" className="input-group-floating" style={{ marginTop: '0.5rem' }}>
            <input
              id="reg-confirm-password"
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
              placeholder=" "
              className="input-floating"
              required
              autoComplete="new-password"
            />
            <label htmlFor="reg-confirm-password" className="label-floating">
              Confirm Password *
            </label>
            {form.confirmPassword && !doPasswordsMatch && (
              <span style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '0.4rem', display: 'block' }}>Passwords do not match</span>
            )}
            {form.confirmPassword && doPasswordsMatch && (
              <span style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: '0.4rem', display: 'block' }}>Passwords match ✓</span>
            )}
          </div>

          <button type="submit" disabled={loading || (form.password.length > 0 && !isPwdValid) || (form.confirmPassword.length > 0 && !doPasswordsMatch)} className="btn-primary" style={{ width: '100%', marginTop: '0.5rem', padding: '0.875rem' }}>
            {loading ? <><Loader2 size={16} className="animate-spin" /> Creating account…</> : 'Create Account'}
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
           <span style={{ fontWeight: 600 }}>Sign up with Google</span>
        </button>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 700 }}>Sign in</Link>
        </p>
      </motion.div>
    </div>

    {/* OTP Verification Modal */}
    {showOtp && (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card" style={{ padding: '2.5rem', width: '90%', maxWidth: '420px', textAlign: 'center' }}>
           <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1rem' }}>Verify your email</h2>
           <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem' }}>
             We sent a 6-digit confirmation code to <strong style={{ color: 'var(--text-primary)' }}>{form.email}</strong>. Enter it below to activate your account.
           </p>
           <input 
             type="text" 
             value={otpCode} 
             onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))} 
             placeholder="000000" 
             style={{ fontSize: '2.5rem', textAlign: 'center', letterSpacing: '0.75rem', padding: '1rem', width: '100%', borderRadius: '12px', background: 'var(--bg)', border: '2px solid var(--border)', color: 'var(--text-primary)', marginBottom: '2rem', fontWeight: 700 }} 
             maxLength={6} 
           />
           <button onClick={handleVerifyOtp} disabled={loading || otpCode.length !== 6} className="btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}>
              {loading ? <Loader2 size={20} className="animate-spin mx-auto" /> : 'Verify Email'}
           </button>
        </motion.div>
      </div>
    )}
    </>
  );
}
