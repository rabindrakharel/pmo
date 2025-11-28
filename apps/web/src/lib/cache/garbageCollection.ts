/**
 * Garbage Collection Service (v9.0.0 - TanStack Query + Dexie)
 *
 * v9.0.0: TanStack Query handles TTL-based caching. This module provides
 * minimal GC functions for backwards compatibility.
 *
 * TanStack Query + Dexie metadata cleanup:
 * - staleTime and gcTime are set on query options
 * - Stale entries trigger fresh fetch and cache update
 * - IndexedDB storage is persistent and efficient
 *
 * @example
 * // No longer needed to start/stop GC
 * // TanStack Query handles cache expiry automatically
 */

import { clearAllCaches } from '../../db/query/queryClient';

// ============================================================================
// Configuration (kept for backwards compatibility)
// ============================================================================

const GC_INTERVAL = 5 * 60 * 1000;  // 5 minutes (unused - RxDB handles TTL)
const DEBUG = false;

// ============================================================================
// State (kept for backwards compatibility)
// ============================================================================

let gcIntervalId: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

// ============================================================================
// GC Functions (v9.0.0 - TanStack Query handles TTL automatically)
// ============================================================================

/**
 * Run garbage collection (v9.0.0: TanStack Query handles TTL automatically)
 *
 * @deprecated TanStack Query has built-in TTL-based caching. This is a no-op.
 */
export function runGarbageCollection(): {
  globalSettingsCleared: boolean;
  datalabelsCleared: number;
  entityCodesCleared: boolean;
  componentMetadataCleared: number;
} {
  // TanStack Query handles TTL automatically - no manual GC needed
  if (DEBUG) {
    console.log('%c[GC] TanStack Query handles TTL automatically - no manual GC needed', 'color: #868e96');
  }

  return {
    globalSettingsCleared: false,
    datalabelsCleared: 0,
    entityCodesCleared: false,
    componentMetadataCleared: 0,
  };
}

/**
 * Start the garbage collection interval (v9.0.0: TanStack Query handles TTL automatically)
 *
 * @deprecated TanStack Query has built-in TTL-based caching. This is kept for backwards compatibility.
 */
export function startMetadataGC(): void {
  if (isRunning) {
    return;
  }

  isRunning = true;
  console.log('%c[GC] TanStack Query handles TTL automatically - metadata GC is passive', 'color: #51cf66');
}

/**
 * Stop the garbage collection interval (v9.0.0: TanStack Query handles TTL automatically)
 *
 * @deprecated TanStack Query has built-in TTL-based caching. This is kept for backwards compatibility.
 */
export function stopMetadataGC(): void {
  if (gcIntervalId) {
    clearInterval(gcIntervalId);
    gcIntervalId = null;
  }
  isRunning = false;
}

/**
 * Check if GC is currently running
 */
export function isGCRunning(): boolean {
  return isRunning;
}

/**
 * Force clear all metadata stores (use on logout)
 *
 * v9.0.0: Uses TanStack Query + Dexie clearAllCaches() instead of RxDB
 */
export async function clearAllMetadataStores(): Promise<void> {
  await clearAllCaches();
  console.log('%c[GC] All Dexie + TanStack Query cache cleared', 'color: #ff6b6b');
}

/**
 * Get current cache statistics (v9.0.0: Simplified for TanStack Query)
 *
 * @deprecated Cache stats are now managed by TanStack Query internally
 */
export function getMetadataCacheStats(): {
  globalSettings: { hasData: boolean; isExpired: boolean };
  entityCodes: { count: number; isExpired: boolean };
  datalabels: { count: number };
  componentMetadata: { count: number };
} {
  // TanStack Query manages cache internally - return placeholder values
  return {
    globalSettings: { hasData: false, isExpired: false },
    entityCodes: { count: 0, isExpired: false },
    datalabels: { count: 0 },
    componentMetadata: { count: 0 },
  };
}
