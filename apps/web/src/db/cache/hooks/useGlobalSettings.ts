// ============================================================================
// useGlobalSettings Hook
// ============================================================================
// Hook for accessing global application settings
// Session-level store - prefetch on login, 10 min background refresh
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { QUERY_KEYS } from '../keys';
import { SESSION_STORE_CONFIG, STORE_STALE_TIMES } from '../constants';
import { globalSettingsStore } from '../stores';
import type { GlobalSettings, UseGlobalSettingsResult } from '../types';
import { getGlobalSettings, setGlobalSettings } from '../../persistence/operations';
import { persistToGlobalSettings } from '../../persistence/hydrate';

// ============================================================================
// Default Settings
// ============================================================================

const DEFAULT_SETTINGS: GlobalSettings = {
  currency: { symbol: '$', decimals: 2, locale: 'en-CA' },
  date: { format: 'YYYY-MM-DD', locale: 'en-CA' },
};

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for accessing global application settings
 *
 * STORE: globalSettings
 * LAYER: Session-level (prefetch on login, 10 min staleTime)
 * PERSISTENCE: Dexie IndexedDB with 24-hour TTL
 *
 * Features:
 * - Returns cached data instantly if available
 * - Background refetch when stale
 * - Sync store for non-hook access
 * - Persists to IndexedDB for offline access
 */
export function useGlobalSettings(): UseGlobalSettingsResult {
  const query = useQuery<GlobalSettings>({
    queryKey: QUERY_KEYS.globalSettings(),
    queryFn: async () => {
      // Layer 2: Check Dexie (already done by hydration, but check for updates)
      const cached = await getGlobalSettings();

      // Layer 3: Fetch from API
      try {
        const response = await apiClient.get<{ data: GlobalSettings }>(
          '/api/v1/settings/global'
        );
        const settings = response.data?.data || DEFAULT_SETTINGS;

        // Persist to Dexie
        await persistToGlobalSettings(settings);

        return settings;
      } catch (error) {
        // If API fails but we have cached data, use it
        if (cached) {
          return cached;
        }
        throw error;
      }
    },
    staleTime: STORE_STALE_TIMES.globalSettings,
    gcTime: SESSION_STORE_CONFIG.gcTime,
    placeholderData: DEFAULT_SETTINGS,
  });

  // Update sync store when data changes
  useEffect(() => {
    if (query.data) {
      globalSettingsStore.set(query.data);
    }
  }, [query.data]);

  const getSetting = useCallback(
    <K extends keyof GlobalSettings>(key: K): GlobalSettings[K] => {
      return query.data?.[key] ?? DEFAULT_SETTINGS[key];
    },
    [query.data]
  );

  return {
    settings: query.data ?? DEFAULT_SETTINGS,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    getSetting,
  };
}

// ============================================================================
// Prefetch Function
// ============================================================================

/**
 * Prefetch global settings into cache
 * Called during app initialization
 */
export async function prefetchGlobalSettings(): Promise<void> {
  try {
    const response = await apiClient.get<{ data: GlobalSettings }>(
      '/api/v1/settings/global'
    );
    const settings = response.data?.data || DEFAULT_SETTINGS;

    // Set in query cache
    const { queryClient } = await import('../client');
    queryClient.setQueryData(QUERY_KEYS.globalSettings(), settings);

    // Set in sync store
    globalSettingsStore.set(settings);

    // Persist to Dexie
    await persistToGlobalSettings(settings);
  } catch (error) {
    console.error('[useGlobalSettings] Prefetch failed:', error);
  }
}

// ============================================================================
// Clear Function
// ============================================================================

/**
 * Clear global settings cache
 * Called on logout
 */
export async function clearGlobalSettingsCache(): Promise<void> {
  const { queryClient } = await import('../client');
  queryClient.removeQueries({ queryKey: QUERY_KEYS.globalSettings() });
  globalSettingsStore.clear();
  const { clearGlobalSettings } = await import('../../persistence/operations');
  await clearGlobalSettings();
}

// ============================================================================
// Sync Access (Re-export for convenience)
// ============================================================================

export { getGlobalSettingsSync, getSettingSync } from '../stores';
