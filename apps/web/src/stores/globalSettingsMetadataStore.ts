/**
 * ============================================================================
 * GLOBAL SETTINGS METADATA STORE
 * ============================================================================
 *
 * Purpose: Cache global formatting settings (currency, date, timestamp, boolean)
 * TTL: Session-level (30 minutes)
 * Source: GET /api/v1/settings/global
 *
 * Usage:
 * ```typescript
 * const { globalSettings, setGlobalSettings } = useGlobalSettingsMetadataStore();
 * ```
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

export interface GlobalSettings {
  currency: {
    symbol: string;
    decimals: number;
    locale: string;
    position: string;
    thousandsSeparator: string;
    decimalSeparator: string;
  };
  date: {
    style: string;
    locale: string;
    format: string;
  };
  timestamp: {
    style: string;
    locale: string;
    includeSeconds: boolean;
  };
  boolean: {
    trueLabel: string;
    falseLabel: string;
    trueColor: string;
    falseColor: string;
    trueIcon: string;
    falseIcon: string;
  };
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface GlobalSettingsMetadataState {
  globalSettings: CacheEntry<GlobalSettings> | null;
}

interface GlobalSettingsMetadataActions {
  setGlobalSettings: (settings: GlobalSettings) => void;
  getGlobalSettings: () => GlobalSettings | null;
  isExpired: () => boolean;
  clear: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const CACHE_TTL = 60 * 60 * 1000; // 1 hour (reference data)

// ============================================================================
// Store Implementation
// ============================================================================

export const useGlobalSettingsMetadataStore = create<GlobalSettingsMetadataState & GlobalSettingsMetadataActions>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial State
        globalSettings: null,

        // Setters
        setGlobalSettings: (settings: GlobalSettings) => {
          console.log('%c[GlobalSettingsStore] Storing global settings', 'color: #be4bdb; font-weight: bold');
          set({
            globalSettings: {
              data: settings,
              timestamp: Date.now(),
              ttl: CACHE_TTL,
            },
          });
        },

        // Getters
        getGlobalSettings: () => {
          const { globalSettings } = get();
          if (!globalSettings) return null;

          if (get().isExpired()) {
            console.log('%c[GlobalSettingsStore] Cache expired', 'color: #fcc419');
            return null;
          }

          console.log('%c[GlobalSettingsStore] Cache HIT', 'color: #51cf66; font-weight: bold');
          return globalSettings.data;
        },

        // Utilities
        isExpired: () => {
          const { globalSettings } = get();
          if (!globalSettings) return true;
          return Date.now() - globalSettings.timestamp > globalSettings.ttl;
        },

        clear: () => {
          console.log('%c[GlobalSettingsStore] Cleared', 'color: #ff6b6b');
          set({ globalSettings: null });
        },
      }),
      {
        name: 'pmo-global-settings-store',
        storage: createJSONStorage(() => sessionStorage),
        partialize: (state) => ({ globalSettings: state.globalSettings }),
      }
    ),
    { name: 'GlobalSettingsMetadataStore' }
  )
);
