// ============================================================================
// useGlobalSettings Hook
// ============================================================================
// Fetches global settings with TanStack Query + Dexie persistence
// Includes sync cache for non-hook access
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { db } from '../dexie/database';
import { apiClient } from '../../lib/api';
import { CACHE_STALE_TIME_METADATA } from '../query/queryClient';

// ============================================================================
// Types
// ============================================================================

export interface GlobalSettings {
  /** Currency formatting settings */
  currency: {
    symbol: string;
    decimals: number;
    locale: string;
    position: string;
    thousandsSeparator: string;
    decimalSeparator: string;
  };
  /** Date formatting settings */
  date: {
    style: string;
    locale: string;
    format: string;
  };
  /** Timestamp formatting settings */
  timestamp: {
    style: string;
    locale: string;
    includeSeconds: boolean;
  };
  /** Boolean display settings */
  boolean: {
    trueLabel: string;
    falseLabel: string;
    trueColor: string;
    falseColor: string;
    trueIcon: string;
    falseIcon: string;
  };
  /** Additional settings */
  [key: string]: unknown;
}

export interface UseGlobalSettingsResult {
  /** Settings object */
  settings: GlobalSettings | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  isError: boolean;
  /** Error object */
  error: Error | null;
  /** Get a specific setting with fallback */
  getSetting: <T = unknown>(key: string, defaultValue?: T) => T | undefined;
  /** Manual refetch */
  refetch: () => Promise<void>;
}

// ============================================================================
// Sync Cache (for non-hook access)
// ============================================================================

let globalSettingsSyncCache: GlobalSettings | null = null;

/**
 * Get global settings synchronously from in-memory cache
 *
 * @returns Settings object or null if not cached
 */
export function getGlobalSettingsSync(): GlobalSettings | null {
  return globalSettingsSyncCache;
}

/**
 * Get a specific setting synchronously
 *
 * @param key - Setting key (e.g., 'currency', 'currency.symbol')
 * @param defaultValue - Fallback value if not found
 */
export function getSettingSync<T = unknown>(key: string, defaultValue?: T): T | undefined {
  if (!globalSettingsSyncCache) return defaultValue;

  // Support nested keys like 'currency.symbol'
  const keys = key.split('.');
  let value: unknown = globalSettingsSyncCache;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return defaultValue;
    }
  }

  return value as T;
}

/**
 * Clear global settings sync cache
 */
export function clearGlobalSettingsCache(): void {
  globalSettingsSyncCache = null;
}

// ============================================================================
// Default Settings
// ============================================================================

const DEFAULT_SETTINGS: GlobalSettings = {
  currency: {
    symbol: '$',
    decimals: 2,
    locale: 'en-CA',
    position: 'prefix',
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
  date: {
    style: 'medium',
    locale: 'en-CA',
    format: 'MMM d, yyyy',
  },
  timestamp: {
    style: 'medium',
    locale: 'en-CA',
    includeSeconds: false,
  },
  boolean: {
    trueLabel: 'Yes',
    falseLabel: 'No',
    trueColor: 'green',
    falseColor: 'red',
    trueIcon: 'check',
    falseIcon: 'x',
  },
};

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for fetching global settings
 *
 * @example
 * const { settings, getSetting, isLoading } = useGlobalSettings();
 * const currencySymbol = getSetting('currency.symbol', '$');
 */
/**
 * TanStack Query Key: ['globalSetting']
 * Dexie Table: globalSetting
 */
export function useGlobalSettings(): UseGlobalSettingsResult {
  const query = useQuery<GlobalSettings, Error>({
    queryKey: ['globalSetting'],
    queryFn: async () => {
      // Fetch from API
      const response = await apiClient.get('/api/v1/settings/global');
      const settings = response.data || DEFAULT_SETTINGS;

      // Persist to Dexie globalSetting table
      await db.globalSetting.put({
        _id: 'settings',
        settings,
        syncedAt: Date.now(),
      });

      // Update sync cache
      globalSettingsSyncCache = settings;

      return settings;
    },
    staleTime: CACHE_STALE_TIME_METADATA,
    gcTime: 60 * 60 * 1000, // 1 hour (longer for static settings)
    // Provide default settings while loading
    placeholderData: DEFAULT_SETTINGS,
  });

  // Get specific setting with fallback
  const getSetting = useCallback(
    <T = unknown>(key: string, defaultValue?: T): T | undefined => {
      if (!query.data) return defaultValue;

      const keys = key.split('.');
      let value: unknown = query.data;

      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = (value as Record<string, unknown>)[k];
        } else {
          return defaultValue;
        }
      }

      return value as T;
    },
    [query.data]
  );

  return {
    settings: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    getSetting,
    refetch: async () => {
      await query.refetch();
    },
  };
}

// ============================================================================
// Prefetch Global Settings
// ============================================================================

/**
 * Prefetch global settings from server
 * Called at login to populate cache
 */
export async function prefetchGlobalSettings(): Promise<boolean> {
  try {
    const response = await apiClient.get('/api/v1/settings/global');
    const settings = response.data || DEFAULT_SETTINGS;

    // Persist to Dexie globalSetting table
    await db.globalSetting.put({
      _id: 'settings',
      settings,
      syncedAt: Date.now(),
    });

    // Update sync cache
    globalSettingsSyncCache = settings;

    console.log(
      '%c[GlobalSettings] Prefetched settings',
      'color: #51cf66; font-weight: bold'
    );

    return true;
  } catch (error) {
    console.error('[GlobalSettings] Prefetch failed:', error);

    // Fallback: Load from Dexie cache
    const cached = await db.globalSetting.get('settings');
    if (cached) {
      globalSettingsSyncCache = cached.settings as GlobalSettings;
      return true;
    }

    // Use defaults
    globalSettingsSyncCache = DEFAULT_SETTINGS;
    return false;
  }
}
