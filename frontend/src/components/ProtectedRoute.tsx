'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center',marginTop:'400px'}}>
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={40} className="animate-spin text-emerald-400" />
          <p className="text-slate-400 text-sm animate-pulse">Loading…</p>
        </div>
      </div>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
