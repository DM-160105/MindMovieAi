import { useSyncExternalStore } from 'react';

// Global Singleton Memory Cache
// Stores a single active matchMedia evaluator and listener array per breakpoint
const matchMediaCache = new Map<number, MediaQueryList>();
const cacheValues = new Map<number, boolean>();
const listeners = new Set<() => void>();

// Subscribe function needed by useSyncExternalStore
function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

// Emits events to all connected components when ANY breakpoint changes
function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

// Factory to lazily initialize a MediaQueryList singleton for a specific breakpoint
function getMql(breakpoint: number): MediaQueryList | null {
  if (typeof window === 'undefined') return null;
  if (!matchMediaCache.has(breakpoint)) {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    matchMediaCache.set(breakpoint, mql);
    
    // Immediately cache the value so getSnapshot() is perfectly synchronous
    cacheValues.set(breakpoint, mql.matches);
    
    // Attach ONE listener per unique breakpoint that updates the cache and broadcasts
    const handler = (e: MediaQueryListEvent) => {
      cacheValues.set(breakpoint, e.matches);
      emitChange();
    };

    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
    } else {
      mql.addListener(handler); // Safari < 14 fallback
    }
  }
  return matchMediaCache.get(breakpoint)!;
}

// Retrieves the current value synchronously for a given breakpoint
function getSnapshot(breakpoint: number): boolean {
  if (typeof window === 'undefined') return false; // Default for SSR
  
  // Lazily inject it if this is the first time checking this layout width
  if (!cacheValues.has(breakpoint)) {
    getMql(breakpoint);
  }
  
  return cacheValues.get(breakpoint) ?? false;
}

// Server Snapshot defaults to false
function getServerSnapshot(): boolean {
  return false;
}

/**
 * useIsMobile
 *
 * Highly optimized hook returning `true` when viewport width ≤ the given breakpoint (default 768px).
 * Utilizes a global cache and React 18 `useSyncExternalStore` so that:
 * 1) It triggers perfectly synchronously, avoiding double UI renders on mount.
 * 2) 100 components using `useIsMobile(768)` will only create 1 event listener across the entire app.
 */
export function useIsMobile(breakpoint = 768): boolean {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot(breakpoint),
    getServerSnapshot
  );
}

export default useIsMobile;
