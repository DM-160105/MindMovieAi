'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

export interface ArcMovieResult {
  id: string;
  title: string;
  year: number | null;
  genres: string[];
  poster_url: string | null;
  arc_match_score: number;
  arc_labels: string[];
  arc_explanation: string;
  overview: string;
  rating: number;
}

interface MoodState {
  currentMood: string;
  desiredMood: string;
  selectedGenres: string[];
  results: ArcMovieResult[];
  queryArc: number[];
  isLoading: boolean;
  setCurrentMood: (m: string) => void;
  setDesiredMood: (m: string) => void;
  setSelectedGenres: (g: string[]) => void;
  setResults: (r: ArcMovieResult[]) => void;
  setQueryArc: (a: number[]) => void;
  setIsLoading: (l: boolean) => void;
  toggleGenre: (g: string) => void;
}

const MoodContext = createContext<MoodState | null>(null);

export function MoodProvider({ children }: { children: ReactNode }) {
  const [currentMood, setCurrentMood] = useState('');
  const [desiredMood, setDesiredMood] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [results, setResults] = useState<ArcMovieResult[]>([]);
  const [queryArc, setQueryArc] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  return (
    <MoodContext.Provider
      value={{
        currentMood, desiredMood, selectedGenres, results, queryArc, isLoading,
        setCurrentMood, setDesiredMood, setSelectedGenres, setResults,
        setQueryArc, setIsLoading, toggleGenre,
      }}
    >
      {children}
    </MoodContext.Provider>
  );
}

export function useMood() {
  const ctx = useContext(MoodContext);
  if (!ctx) throw new Error('useMood must be used within MoodProvider');
  return ctx;
}
