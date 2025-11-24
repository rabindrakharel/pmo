/**
 * ============================================================================
 * DATALABEL METADATA STORE
 * ============================================================================
 *
 * Purpose: Cache datalabel options for dropdown fields (dl__* fields)
 * TTL: 1 hour
 * Source: GET /api/v1/datalabel/all (fetched on login)
 * Persistence: localStorage (survives page reloads and browser restarts)
 *
 * Usage:
 * ```typescript
 * const { getDatalabel, setDatalabel, setAllDatalabels } = useDatalabelMetadataStore();
 * const options = getDatalabel('dl__project_stage');
 * ```
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

export interface DatalabelOption {
  id: number;
  name: string;
  descr?: string;
  parent_id?: number | null;  // Legacy single parent
  parent_ids?: number[];      // ✅ NEW: Array of parent IDs for DAG
  sort_order: number;
  color_code?: string;
  active_flag?: boolean;
}

export interface Datalabel {
  name: string;
  label?: string;
  icon?: string | null;
  options: DatalabelOption[];
}

interface CacheEntry {
  data: DatalabelOption[];
  timestamp: number;
  ttl: number;
}

interface DatalabelMetadataState {
  datalabels: Record<string, CacheEntry>; // key: datalabel name (e.g., 'dl__project_stage')
}

interface DatalabelMetadataActions {
  setDatalabel: (name: string, options: DatalabelOption[]) => void;
  setAllDatalabels: (datalabels: Datalabel[]) => void;
  getDatalabel: (name: string) => DatalabelOption[] | null;
  getAllDatalabels: () => Record<string, DatalabelOption[]> | null;
  isExpired: (name: string) => boolean;
  getExpiredKeys: () => string[];
  invalidate: (name: string) => void;
  clear: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const CACHE_TTL = 60 * 60 * 1000; // 1 hour (reference data)

// ============================================================================
// Store Implementation
// ============================================================================

export const useDatalabelMetadataStore = create<DatalabelMetadataState & DatalabelMetadataActions>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial State
        datalabels: {},

        // Setters
        setDatalabel: (name: string, options: DatalabelOption[]) => {
          console.log(`%c[DatalabelStore] Storing: ${name}`, 'color: #be4bdb; font-weight: bold', {
            optionCount: options.length,
          });
          const { datalabels } = get();
          set({
            datalabels: {
              ...datalabels,
              [name]: {
                data: options,
                timestamp: Date.now(),
                ttl: CACHE_TTL,
              },
            },
          });
        },

        setAllDatalabels: (datalabelList: Datalabel[]) => {
          console.log(`%c[DatalabelStore] Storing all datalabels (${datalabelList.length} items)`, 'color: #be4bdb; font-weight: bold');
          const timestamp = Date.now();
          const newDatalabels: Record<string, CacheEntry> = {};

          datalabelList.forEach((dl) => {
            newDatalabels[dl.name] = {
              data: dl.options,
              timestamp,
              ttl: CACHE_TTL,
            };
          });

          set({ datalabels: newDatalabels });
        },

        // Getters
        getDatalabel: (name: string) => {
          const { datalabels } = get();
          const entry = datalabels[name];

          if (!entry) return null;

          if (get().isExpired(name)) {
            console.log(`%c[DatalabelStore] Cache expired: ${name}`, 'color: #fcc419');
            return null;
          }

          console.log(`%c[DatalabelStore] Cache HIT: ${name}`, 'color: #51cf66; font-weight: bold');
          return entry.data;
        },

        getAllDatalabels: () => {
          const { datalabels } = get();
          const result: Record<string, DatalabelOption[]> = {};
          let hasValidEntries = false;

          Object.entries(datalabels).forEach(([name, entry]) => {
            if (!get().isExpired(name)) {
              result[name] = entry.data;
              hasValidEntries = true;
            }
          });

          if (!hasValidEntries) return null;

          console.log(`%c[DatalabelStore] Cache HIT (all): ${Object.keys(result).length} datalabels`, 'color: #51cf66; font-weight: bold');
          return result;
        },

        // Utilities
        isExpired: (name: string) => {
          const { datalabels } = get();
          const entry = datalabels[name];
          if (!entry) return true;
          return Date.now() - entry.timestamp > entry.ttl;
        },

        getExpiredKeys: () => {
          const { datalabels } = get();
          const now = Date.now();
          return Object.entries(datalabels)
            .filter(([_, entry]) => now - entry.timestamp > entry.ttl)
            .map(([name]) => name);
        },

        invalidate: (name: string) => {
          console.log(`%c[DatalabelStore] Invalidated: ${name}`, 'color: #ff6b6b');
          const { datalabels } = get();
          const { [name]: _, ...rest } = datalabels;
          set({ datalabels: rest });
        },

        clear: () => {
          console.log('%c[DatalabelStore] Cleared all', 'color: #ff6b6b');
          set({ datalabels: {} });
        },
      }),
      {
        name: 'pmo-datalabel-store',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({ datalabels: state.datalabels }),
      }
    ),
    { name: 'DatalabelMetadataStore' }
  )
);
