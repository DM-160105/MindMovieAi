'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VibeMovie {
  id: string;
  title: string;
  year: number;
  genres: string[];
  poster_url: string | null;
  rating: number;
  overview: string;
  vibe_match_score: number;
  vibe_tags: string[];
  vibe_summary: string;
  vibe_vector: number[];
  dimension_match: {
    lighting: number;
    pacing: number;
    setting_type: number;
    temperature: number;
    texture: number;
    era_feel: number;
  };
}

export interface VibePreset {
  id: string;
  display_name: string;
  emoji: string;
  description: string;
  vector: number[];
}

interface VibeContextValue {
  vibeText: string;
  setVibeText: (t: string) => void;
  selectedPreset: VibePreset | null;
  setSelectedPreset: (p: VibePreset | null) => void;
  selectedGenres: string[];
  toggleGenre: (g: string) => void;
  results: VibeMovie[];
  setResults: (r: VibeMovie[]) => void;
  queryVector: number[];
  setQueryVector: (v: number[]) => void;
  queryTags: string[];
  setQueryTags: (t: string[]) => void;
  isLoading: boolean;
  setIsLoading: (l: boolean) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const VibeContext = createContext<VibeContextValue | null>(null);

export function VibeProvider({ children }: { children: React.ReactNode }) {
  const [vibeText, setVibeText] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<VibePreset | null>(null);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [results, setResults] = useState<VibeMovie[]>([]);
  const [queryVector, setQueryVector] = useState<number[]>([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
  const [queryTags, setQueryTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const toggleGenre = useCallback((genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  }, []);

  return (
    <VibeContext.Provider value={{
      vibeText, setVibeText,
      selectedPreset, setSelectedPreset,
      selectedGenres, toggleGenre,
      results, setResults,
      queryVector, setQueryVector,
      queryTags, setQueryTags,
      isLoading, setIsLoading,
    }}>
      {children}
    </VibeContext.Provider>
  );
}

export function useVibe(): VibeContextValue {
  const ctx = useContext(VibeContext);
  if (!ctx) throw new Error('useVibe must be used inside <VibeProvider>');
  return ctx;
}
