/**
 * Garbage Collection Service for Metadata Stores (v6.1.0)
 *
 * Periodically cleans up expired entries from Zustand metadata stores.
 * Prevents memory leaks from stale cached data.
 *
 * Features:
 * - Runs every 5 minutes
 * - Cleans expired entries from all metadata stores
 * - Logs cleanup activity for debugging
 * - Can be started/stopped programmatically
 *
 * @example
 * // Start GC on app mount
 * useEffect(() => {
 *   startMetadataGC();
 *   return () => stopMetadataGC();
 * }, []);
 */

import { useGlobalSettingsMetadataStore } from '../../stores/globalSettingsMetadataStore';
import { useDatalabelMetadataStore } from '../../stores/datalabelMetadataStore';
import { useEntityComponentMetadataStore } from '../../stores/entityComponentMetadataStore';
import { useEntityCodeMetadataStore } from '../../stores/entityCodeMetadataStore';

// ============================================================================
// Configuration
// ============================================================================

const GC_INTERVAL = 5 * 60 * 1000;  // 5 minutes
const DEBUG = false;  // Set to true for verbose logging

// ============================================================================
// State
// ============================================================================

let gcIntervalId: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

// ============================================================================
// GC Functions
// ============================================================================

/**
 * Run garbage collection on all metadata stores
 */
export function runGarbageCollection(): {
  globalSettingsCleared: boolean;
  datalabelsCleared: number;
  entityCodesCleared: boolean;
  componentMetadataCleared: number;
} {
  const results = {
    globalSettingsCleared: false,
    datalabelsCleared: 0,
    entityCodesCleared: false,
    componentMetadataCleared: 0,
  };

  // Check and clear global settings if expired
  const globalSettingsStore = useGlobalSettingsMetadataStore.getState();
  if (globalSettingsStore.isExpired()) {
    globalSettingsStore.clear();
    results.globalSettingsCleared = true;
    if (DEBUG) console.log('%c[GC] Cleared expired globalSettings', 'color: #868e96');
  }

  // Check and clear entity codes if expired
  const entityCodeStore = useEntityCodeMetadataStore.getState();
  if (entityCodeStore.isExpired()) {
    entityCodeStore.clear();
    results.entityCodesCleared = true;
    if (DEBUG) console.log('%c[GC] Cleared expired entityCodes', 'color: #868e96');
  }

  // Check and clear expired datalabels
  const datalabelStore = useDatalabelMetadataStore.getState();
  const expiredDatalabels = datalabelStore.getExpiredKeys?.() || [];
  expiredDatalabels.forEach(key => {
    datalabelStore.invalidate(key);
    results.datalabelsCleared++;
  });
  if (results.datalabelsCleared > 0 && DEBUG) {
    console.log(`%c[GC] Cleared ${results.datalabelsCleared} expired datalabels`, 'color: #868e96');
  }

  // Check and clear expired component metadata
  const componentStore = useEntityComponentMetadataStore.getState();
  const expiredComponents = componentStore.getExpiredKeys?.() || [];
  expiredComponents.forEach(key => {
    const [entityCode] = key.split(':');
    componentStore.invalidateEntity(entityCode);
    results.componentMetadataCleared++;
  });
  if (results.componentMetadataCleared > 0 && DEBUG) {
    console.log(`%c[GC] Cleared ${results.componentMetadataCleared} expired component metadata`, 'color: #868e96');
  }

  return results;
}

/**
 * Start the garbage collection interval
 */
export function startMetadataGC(): void {
  if (isRunning) {
    console.log('%c[GC] Already running', 'color: #fcc419');
    return;
  }

  // Run immediately on start
  runGarbageCollection();

  // Then run periodically
  gcIntervalId = setInterval(() => {
    const results = runGarbageCollection();

    const hasCleared =
      results.globalSettingsCleared ||
      results.entityCodesCleared ||
      results.datalabelsCleared > 0 ||
      results.componentMetadataCleared > 0;

    if (hasCleared) {
      console.log('%c[GC] Metadata cleanup completed', 'color: #51cf66', results);
    }
  }, GC_INTERVAL);

  isRunning = true;
  console.log('%c[GC] Metadata garbage collection started (interval: 5 min)', 'color: #51cf66');
}

/**
 * Stop the garbage collection interval
 */
export function stopMetadataGC(): void {
  if (gcIntervalId) {
    clearInterval(gcIntervalId);
    gcIntervalId = null;
  }
  isRunning = false;
  console.log('%c[GC] Metadata garbage collection stopped', 'color: #ff6b6b');
}

/**
 * Check if GC is currently running
 */
export function isGCRunning(): boolean {
  return isRunning;
}

/**
 * Force clear all metadata stores (use on logout)
 */
export function clearAllMetadataStores(): void {
  useGlobalSettingsMetadataStore.getState().clear();
  useDatalabelMetadataStore.getState().clear();
  useEntityComponentMetadataStore.getState().clear();
  useEntityCodeMetadataStore.getState().clear();

  console.log('%c[GC] All metadata stores cleared', 'color: #ff6b6b');
}

/**
 * Get current cache statistics
 */
export function getMetadataCacheStats(): {
  globalSettings: { hasData: boolean; isExpired: boolean };
  entityCodes: { count: number; isExpired: boolean };
  datalabels: { count: number };
  componentMetadata: { count: number };
} {
  const globalSettingsStore = useGlobalSettingsMetadataStore.getState();
  const entityCodeStore = useEntityCodeMetadataStore.getState();
  const datalabelStore = useDatalabelMetadataStore.getState();
  const componentStore = useEntityComponentMetadataStore.getState();

  return {
    globalSettings: {
      hasData: !!globalSettingsStore.getGlobalSettings(),
      isExpired: globalSettingsStore.isExpired(),
    },
    entityCodes: {
      count: entityCodeStore.getEntityCodes()?.length || 0,
      isExpired: entityCodeStore.isExpired(),
    },
    datalabels: {
      count: Object.keys(datalabelStore.getAllDatalabels() || {}).length,
    },
    componentMetadata: {
      count: Object.keys(componentStore.cache || {}).length,
    },
  };
}
