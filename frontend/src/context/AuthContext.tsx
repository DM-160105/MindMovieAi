'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loginUser, registerUser, getMe, updatePreferences } from '@/lib/api';

interface User {
  id: number;
  username: string;
  email: string;
  display_name?: string;
  age?: number;
  gender?: string;
  favorite_genres?: string[];
  disliked_genres?: string[];
  onboarding_completed?: boolean;
  is_admin?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  register: (data: { username: string; email: string; password: string; display_name?: string }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  savePreferences: (data: Parameters<typeof updatePreferences>[0]) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Helper: parse a user response that may be either `{user:{...}}` or flat `{...}`
function parseUserFromResponse(data: Record<string, unknown>): User {
  const u = (data?.user ?? data) as User;
  // Backend stores genres as comma-separated strings — normalise to arrays
  const toArray = (v: unknown): string[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v as string[];
    return String(v).split(',').map((s) => s.trim()).filter(Boolean);
  };
  return {
    ...u,
    favorite_genres: toArray(u.favorite_genres),
    disliked_genres: toArray(u.disliked_genres),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await getMe();
      setUser(parseUserFromResponse(res.data));
    } catch {
      localStorage.removeItem('stremflix_token');
      setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('stremflix_token');
    if (stored) {
      setToken(stored);
      fetchUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [fetchUser]);

  const login = async (username: string, password: string): Promise<User> => {
    const res = await loginUser(username, password);
    const { access_token } = res.data;
    localStorage.setItem('stremflix_token', access_token);
    setToken(access_token);

    let loggedInUser: User;
    if (res.data.user) {
      loggedInUser = parseUserFromResponse(res.data);
      setUser(loggedInUser);
    } else {
      const getRes = await getMe();
      loggedInUser = parseUserFromResponse(getRes.data);
      setUser(loggedInUser);
    }
    return loggedInUser;
  };

  const register = async (data: { username: string; email: string; password: string; display_name?: string }) => {
    const res = await registerUser(data);
    // /register returns {access_token, user}
    if (res.data.access_token) {
      localStorage.setItem('stremflix_token', res.data.access_token);
      setToken(res.data.access_token);
    }
    if (res.data.user) {
      setUser(parseUserFromResponse(res.data));
    } else {
      // Fall back to logging in
      await login(data.username, data.password);
    }
  };

  const logout = () => {
    localStorage.removeItem('stremflix_token');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    await fetchUser();
  };

  const savePreferences = async (data: Parameters<typeof updatePreferences>[0]) => {
    await updatePreferences(data);
    await refreshUser();
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser, savePreferences }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
