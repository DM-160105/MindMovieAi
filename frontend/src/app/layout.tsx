import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import Navbar from '@/components/Navbar';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'Mind Movie Ai — AI Movie Recommender',
  description: 'Discover your next favorite movie with AI-powered recommendations. Bollywood, Hollywood, Anime.',
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>
            {/* Ambient background blobs */}
            <div className="ambient-blob ambient-blob-1" aria-hidden />
            <div className="ambient-blob ambient-blob-2" aria-hidden />

            <Navbar />
            <main style={{ position: 'relative', zIndex: 1 }}>
              {children}
            </main>
            

            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.875rem',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.875rem',
                },
              }}
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
