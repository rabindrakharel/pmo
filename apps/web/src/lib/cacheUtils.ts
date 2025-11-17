/**
 * Cache Utilities
 *
 * Centralized cache invalidation for all frontend caches
 * See: docs/performance/CACHE_INVALIDATION_GUIDE.md
 */

import { clearSettingsCache } from './settingsLoader';
import { clearFieldCache, clearFieldTitleCache } from './universalFormatterService';

/**
 * Clear all frontend caches (nuclear option)
 *
 * Use this for:
 * - User logout (security)
 * - Version upgrades
 * - Major data migrations
 * - Development/testing
 *
 * @returns Promise that resolves when all caches are cleared
 */
export async function clearAllCaches(): Promise<void> {
  console.log('🧹 Clearing all frontend caches...');

  try {
    // 1. Settings cache (in-memory)
    clearSettingsCache();
    console.log('✓ Settings cache cleared');

    // 2. Field detection cache (in-memory)
    clearFieldCache();
    console.log('✓ Field detection cache cleared');

    // 3. Field title cache (in-memory)
    clearFieldTitleCache();
    console.log('✓ Field title cache cleared');

    // 4. Browser HTTP cache (if supported)
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('✓ Browser HTTP cache cleared');
      } catch (error) {
        console.warn('Failed to clear browser HTTP cache:', error);
      }
    }

    // 5. IndexedDB cache (if implemented in future)
    // TODO: Add clearPersistedCache() when IndexedDB is implemented
    // if (typeof clearPersistedCache === 'function') {
    //   await clearPersistedCache();
    //   console.log('✓ IndexedDB cache cleared');
    // }

    console.log('✅ All caches cleared successfully');
  } catch (error) {
    console.error('❌ Failed to clear some caches:', error);
    throw error;
  }
}

/**
 * Clear cache for specific datalabel
 *
 * Use this for:
 * - After updating specific settings
 * - Targeted cache invalidation
 *
 * @param datalabel - The datalabel to clear (e.g., 'dl__project_stage')
 */
export function clearDatalabelCache(datalabel: string): void {
  console.log(`🧹 Clearing cache for: ${datalabel}`);

  // Clear settings cache for this datalabel
  clearSettingsCache(datalabel);

  // Note: Color cache should also be cleared if we add clearSettingsColorCache()
  // TODO: Add clearSettingsColorCache(datalabel) when available

  console.log(`✅ Cache cleared for: ${datalabel}`);
}

/**
 * Clear cache for multiple datalabels
 *
 * @param datalabels - Array of datalabels to clear
 */
export function clearDatalabelCaches(datalabels: string[]): void {
  console.log(`🧹 Clearing cache for ${datalabels.length} datalabels`);

  datalabels.forEach(dl => clearDatalabelCache(dl));

  console.log('✅ All datalabel caches cleared');
}

/**
 * Soft invalidate - mark cache as stale but allow stale data while refreshing
 *
 * This provides better UX as users see data immediately while fresh data
 * loads in the background.
 *
 * Note: Requires implementation in settingsLoader.ts
 *
 * @param datalabel - The datalabel to soft invalidate
 */
export async function softInvalidateCache(datalabel: string): Promise<void> {
  console.log(`⏳ Soft invalidating cache for: ${datalabel}`);

  // Clear cache
  clearDatalabelCache(datalabel);

  // Trigger background reload
  // This will be picked up by next loadSettingOptions() call
  console.log(`✅ Cache soft invalidated for: ${datalabel}`);
}

/**
 * Get entity-related datalabels
 *
 * Returns all datalabels that belong to a specific entity type
 *
 * @param entityType - The entity type (e.g., 'project', 'task')
 * @returns Array of datalabel names
 */
export function getEntityDatalabels(entityType: string): string[] {
  // Common patterns for entity-specific datalabels
  const datalabels: string[] = [];

  // Standard patterns
  const patterns = [
    `dl__${entityType}_stage`,
    `dl__${entityType}_status`,
    `dl__${entityType}_type`,
    `dl__${entityType}_category`,
    `dl__${entityType}_priority`,
  ];

  return patterns;
}

/**
 * Clear cache for entire entity type
 *
 * Use this for:
 * - After importing entity data
 * - After bulk updates to entity settings
 *
 * @param entityType - The entity type (e.g., 'project', 'task')
 */
export function clearEntityCache(entityType: string): void {
  console.log(`🧹 Clearing cache for entity: ${entityType}`);

  const datalabels = getEntityDatalabels(entityType);
  clearDatalabelCaches(datalabels);

  console.log(`✅ Entity cache cleared for: ${entityType}`);
}

/**
 * Check if cache should be cleared based on version
 *
 * Call this on app initialization to auto-clear cache on version upgrade
 *
 * @param currentVersion - Current app version (e.g., '3.3.0')
 * @returns True if cache was cleared, false otherwise
 */
export async function clearCacheOnVersionUpgrade(currentVersion: string): Promise<boolean> {
  const storedVersion = localStorage.getItem('app_version');

  if (storedVersion !== currentVersion) {
    console.log(`🔄 Version upgrade detected: ${storedVersion} → ${currentVersion}`);

    // Clear all caches on version upgrade
    await clearAllCaches();

    // Update stored version
    localStorage.setItem('app_version', currentVersion);

    console.log('✅ Cache cleared due to version upgrade');
    return true;
  }

  return false;
}

/**
 * Development helper - clear cache and reload page
 *
 * Only available in development mode
 */
export async function devClearAndReload(): Promise<void> {
  if (import.meta.env.DEV) {
    await clearAllCaches();
    window.location.reload();
  } else {
    console.warn('devClearAndReload() is only available in development mode');
  }
}

// Export for use in browser console (development only)
if (import.meta.env.DEV) {
  (window as any).__clearCache = clearAllCaches;
  (window as any).__clearEntityCache = clearEntityCache;
  (window as any).__clearAndReload = devClearAndReload;
  console.log('💡 Cache utils available: __clearCache(), __clearEntityCache(), __clearAndReload()');
}
