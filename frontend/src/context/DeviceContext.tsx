'use client';

import React, { createContext, useContext, useSyncExternalStore } from 'react';

// ─── Breakpoint Definitions (single source of truth) ───────────────────────────
const BREAKPOINTS = {
  mobile: 768,
  tablet: 1100,
  largeDesktop: 1400,
} as const;

// ─── Global Singleton Store (zero-cost shared across entire app) ────────────────
// Only ONE matchMedia listener per breakpoint exists for the entire React tree.

interface BreakpointState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLargeDesktop: boolean;
}

const mqlCache = new Map<number, MediaQueryList>();
const valueCache = new Map<number, boolean>();
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function emitChange() {
  for (const cb of listeners) cb();
}

function initBreakpoint(bp: number): void {
  if (typeof window === 'undefined') return;
  if (mqlCache.has(bp)) return;

  const mql = window.matchMedia(`(max-width: ${bp}px)`);
  mqlCache.set(bp, mql);
  valueCache.set(bp, mql.matches);

  const handler = (e: MediaQueryListEvent) => {
    valueCache.set(bp, e.matches);
    emitChange();
  };

  if (mql.addEventListener) {
    mql.addEventListener('change', handler);
  } else {
    mql.addListener(handler); // Safari <14 fallback
  }
}

function getBreakpointValue(bp: number): boolean {
  if (typeof window === 'undefined') return false;
  if (!valueCache.has(bp)) initBreakpoint(bp);
  return valueCache.get(bp) ?? false;
}

function getSnapshot(): BreakpointState {
  const mobile = getBreakpointValue(BREAKPOINTS.mobile);
  const belowTablet = getBreakpointValue(BREAKPOINTS.tablet);
  const belowLargeDesktop = getBreakpointValue(BREAKPOINTS.largeDesktop);

  return {
    isMobile: mobile,
    isTablet: belowTablet && !mobile,
    isDesktop: !belowTablet,
    isLargeDesktop: !belowLargeDesktop,
  };
}

const SERVER_SNAPSHOT: BreakpointState = {
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  isLargeDesktop: false,
};

function getServerSnapshot(): BreakpointState {
  return SERVER_SNAPSHOT;
}

// ─── Memoized snapshot (returns same object reference if values haven't changed)
let cachedSnapshot: BreakpointState = SERVER_SNAPSHOT;

function getMemoizedSnapshot(): BreakpointState {
  const next = getSnapshot();
  if (
    cachedSnapshot.isMobile === next.isMobile &&
    cachedSnapshot.isTablet === next.isTablet &&
    cachedSnapshot.isDesktop === next.isDesktop &&
    cachedSnapshot.isLargeDesktop === next.isLargeDesktop
  ) {
    return cachedSnapshot;
  }
  cachedSnapshot = next;
  return cachedSnapshot;
}

// ─── React Context ──────────────────────────────────────────────────────────────

const DeviceContext = createContext<BreakpointState>(SERVER_SNAPSHOT);

/**
 * DeviceProvider
 *
 * Wrap this ONCE at the app root (layout.tsx). It evaluates all breakpoints
 * using a single `useSyncExternalStore` call and broadcasts via context.
 * Every descendant component that needs device info reads from context —
 * zero additional matchMedia listeners, zero redundant evaluations.
 */
export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const device = useSyncExternalStore(subscribe, getMemoizedSnapshot, getServerSnapshot);

  return (
    <DeviceContext.Provider value={device}>
      {children}
    </DeviceContext.Provider>
  );
}

/**
 * useDevice — the primary hook for device/breakpoint info.
 *
 * Returns `{ isMobile, isTablet, isDesktop, isLargeDesktop }`.
 * All values are reactive and update on resize, but the evaluation
 * happens exactly once in the DeviceProvider.
 */
export function useDevice(): BreakpointState {
  return useContext(DeviceContext);
}

/**
 * useIsMobile — backward-compatible shorthand.
 *
 * Components that only need `isMobile` can keep using this.
 * Under the hood it reads from the same DeviceContext.
 */
export function useIsMobile(): boolean {
  return useContext(DeviceContext).isMobile;
}
