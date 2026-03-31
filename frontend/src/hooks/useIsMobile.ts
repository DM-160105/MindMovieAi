/**
 * useIsMobile — re-exports from DeviceContext for backward compatibility.
 *
 * All breakpoint evaluation now happens once at the app root in DeviceProvider.
 * This file exists to avoid touching every import across the codebase.
 *
 * For NEW code, prefer importing directly from '@/context/DeviceContext':
 *   import { useDevice } from '@/context/DeviceContext';
 *   const { isMobile, isTablet, isDesktop, isLargeDesktop } = useDevice();
 */
export { useIsMobile, useIsMobile as default, useDevice } from '@/context/DeviceContext';
