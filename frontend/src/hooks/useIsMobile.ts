import { useState, useEffect } from 'react';

/**
 * useIsMobile
 *
 * Returns `true` when the viewport width is ≤ the given breakpoint (default 768 px).
 * Updates automatically on window resize.
 *
 * @example
 * const isMobile = useIsMobile();       // breakpoint 768px
 * const isTablet = useIsMobile(1024);   // breakpoint 1024px
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    // Use matchMedia for efficient, event-driven updates
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);

    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);

    // Set the initial value
    setIsMobile(mql.matches);

    // Modern browsers
    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }

    // Safari < 14 fallback
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, [breakpoint]);

  return isMobile;
}

export default useIsMobile;
