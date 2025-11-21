/**
 * ============================================================================
 * ENTITY INSTANCE LIST DATA STORE
 * ============================================================================
 *
 * Purpose: Cache entity instance lists (table/list data)
 * TTL: Short-lived (5 minutes) - refreshes frequently
 * Source: GET /api/v1/{entity}
 *
 * This store caches the raw backend data for entity lists.
 * Used for:
 * - Table view data
 * - Kanban board items
 * - Grid/card view items
 * - Quick navigation without refetch
 *
 * Cache Key: entityCode:queryHash (to differentiate filtered/paginated lists)
 *
 * Usage:
 * ```typescript
 * const { getList, setList } = useEntityInstanceListDataStore();
 * const projects = getList('project', 'page=1&limit=20');
 * ```
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

export interface EntityInstance {
  id: string;
  code?: string;
  name?: string;
  [key: string]: any;
}

export interface ListData {
  data: EntityInstance[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

interface CacheEntry {
  data: ListData;
  timestamp: number;
  ttl: number;
  entityCode: string;
  queryHash: string;
}

interface EntityInstanceListDataState {
  lists: Record<string, CacheEntry>; // key: entityCode:queryHash
}

interface EntityInstanceListDataActions {
  setList: (entityCode: string, queryHash: string, data: ListData) => void;
  getList: (entityCode: string, queryHash: string) => ListData | null;
  appendToList: (entityCode: string, queryHash: string, newItems: EntityInstance[]) => void;
  updateItemInList: (entityCode: string, instanceId: string, changes: Partial<EntityInstance>) => void;
  removeFromList: (entityCode: string, instanceId: string) => void;
  isExpired: (entityCode: string, queryHash: string) => boolean;
  invalidate: (entityCode: string, queryHash?: string) => void;
  clear: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes (short-lived)

// ============================================================================
// Helpers
// ============================================================================

function generateQueryHash(params: Record<string, any>): string {
  const sorted = Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return sorted || 'default';
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useEntityInstanceListDataStore = create<EntityInstanceListDataState & EntityInstanceListDataActions>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial State
        lists: {},

        // Setters
        setList: (entityCode: string, queryHash: string, data: ListData) => {
          const cacheKey = `${entityCode}:${queryHash}`;
          console.log(`%c[ListDataStore] Storing: ${cacheKey}`, 'color: #4dabf7; font-weight: bold', {
            itemCount: data.data.length,
            total: data.total,
          });

          const { lists } = get();
          set({
            lists: {
              ...lists,
              [cacheKey]: {
                data,
                timestamp: Date.now(),
                ttl: CACHE_TTL,
                entityCode,
                queryHash,
              },
            },
          });
        },

        // Getters
        getList: (entityCode: string, queryHash: string) => {
          const cacheKey = `${entityCode}:${queryHash}`;
          const { lists } = get();
          const entry = lists[cacheKey];

          if (!entry) return null;

          if (get().isExpired(entityCode, queryHash)) {
            console.log(`%c[ListDataStore] Cache expired: ${cacheKey}`, 'color: #fcc419');
            return null;
          }

          console.log(`%c[ListDataStore] Cache HIT: ${cacheKey}`, 'color: #51cf66; font-weight: bold', {
            itemCount: entry.data.data.length,
          });
          return entry.data;
        },

        // Append items (for infinite scroll)
        appendToList: (entityCode: string, queryHash: string, newItems: EntityInstance[]) => {
          const cacheKey = `${entityCode}:${queryHash}`;
          const { lists } = get();
          const entry = lists[cacheKey];

          if (!entry) {
            console.warn(`%c[ListDataStore] Cannot append to non-existent: ${cacheKey}`, 'color: #ff6b6b');
            return;
          }

          console.log(`%c[ListDataStore] Appending ${newItems.length} items to: ${cacheKey}`, 'color: #fcc419');

          set({
            lists: {
              ...lists,
              [cacheKey]: {
                ...entry,
                data: {
                  ...entry.data,
                  data: [...entry.data.data, ...newItems],
                },
              },
            },
          });
        },

        // Update a specific item across all lists for this entity
        updateItemInList: (entityCode: string, instanceId: string, changes: Partial<EntityInstance>) => {
          const { lists } = get();
          const newLists: Record<string, CacheEntry> = {};
          let updated = false;

          Object.entries(lists).forEach(([cacheKey, entry]) => {
            if (entry.entityCode === entityCode) {
              const updatedData = entry.data.data.map((item) => {
                if (item.id === instanceId) {
                  updated = true;
                  return { ...item, ...changes };
                }
                return item;
              });

              newLists[cacheKey] = {
                ...entry,
                data: { ...entry.data, data: updatedData },
              };
            } else {
              newLists[cacheKey] = entry;
            }
          });

          if (updated) {
            console.log(`%c[ListDataStore] Updated item ${instanceId} in ${entityCode} lists`, 'color: #fcc419');
            set({ lists: newLists });
          }
        },

        // Remove an item from all lists for this entity
        removeFromList: (entityCode: string, instanceId: string) => {
          const { lists } = get();
          const newLists: Record<string, CacheEntry> = {};
          let removed = false;

          Object.entries(lists).forEach(([cacheKey, entry]) => {
            if (entry.entityCode === entityCode) {
              const filteredData = entry.data.data.filter((item) => item.id !== instanceId);
              if (filteredData.length !== entry.data.data.length) {
                removed = true;
              }

              newLists[cacheKey] = {
                ...entry,
                data: {
                  ...entry.data,
                  data: filteredData,
                  total: entry.data.total - (entry.data.data.length - filteredData.length),
                },
              };
            } else {
              newLists[cacheKey] = entry;
            }
          });

          if (removed) {
            console.log(`%c[ListDataStore] Removed item ${instanceId} from ${entityCode} lists`, 'color: #ff6b6b');
            set({ lists: newLists });
          }
        },

        // Utilities
        isExpired: (entityCode: string, queryHash: string) => {
          const cacheKey = `${entityCode}:${queryHash}`;
          const { lists } = get();
          const entry = lists[cacheKey];
          if (!entry) return true;
          return Date.now() - entry.timestamp > entry.ttl;
        },

        invalidate: (entityCode: string, queryHash?: string) => {
          const { lists } = get();

          if (queryHash) {
            // Invalidate specific list
            const cacheKey = `${entityCode}:${queryHash}`;
            console.log(`%c[ListDataStore] Invalidated: ${cacheKey}`, 'color: #ff6b6b');
            const { [cacheKey]: _, ...rest } = lists;
            set({ lists: rest });
          } else {
            // Invalidate all lists for this entity
            console.log(`%c[ListDataStore] Invalidating all: ${entityCode}`, 'color: #ff6b6b');
            const newLists: Record<string, CacheEntry> = {};

            Object.entries(lists).forEach(([cacheKey, entry]) => {
              if (entry.entityCode !== entityCode) {
                newLists[cacheKey] = entry;
              }
            });

            set({ lists: newLists });
          }
        },

        clear: () => {
          console.log('%c[ListDataStore] Cleared all', 'color: #ff6b6b');
          set({ lists: {} });
        },
      }),
      {
        name: 'pmo-entity-instance-list-data-store',
        storage: createJSONStorage(() => sessionStorage),
        partialize: (state) => ({ lists: state.lists }),
      }
    ),
    { name: 'EntityInstanceListDataStore' }
  )
);

// Export helper
export { generateQueryHash };
