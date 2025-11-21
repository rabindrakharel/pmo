/**
 * ============================================================================
 * ENTITY INSTANCE DATA STORE
 * ============================================================================
 *
 * Purpose: Cache individual entity instance data for optimistic updates
 * TTL: Short-lived (5 minutes) - synced with backend frequently
 * Source: GET /api/v1/{entity}/{id}
 *
 * This store caches the raw backend data for single entity instances.
 * Used for:
 * - Optimistic rendering during edits
 * - Local state management before backend sync
 * - Quick navigation between detail views
 *
 * Usage:
 * ```typescript
 * const { getInstance, setInstance, updateInstance } = useEntityInstanceDataStore();
 * const project = getInstance('project', 'uuid-123');
 * updateInstance('project', 'uuid-123', { name: 'New Name' }); // Optimistic update
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

interface CacheEntry {
  data: EntityInstance;
  timestamp: number;
  ttl: number;
  entityCode: string;
  isDirty: boolean; // Has local changes not synced to backend
}

interface EntityInstanceDataState {
  instances: Record<string, CacheEntry>; // key: entityCode:instanceId
}

interface EntityInstanceDataActions {
  setInstance: (entityCode: string, instanceId: string, data: EntityInstance) => void;
  getInstance: (entityCode: string, instanceId: string) => EntityInstance | null;
  updateInstance: (entityCode: string, instanceId: string, changes: Partial<EntityInstance>) => void;
  markSynced: (entityCode: string, instanceId: string) => void;
  isDirty: (entityCode: string, instanceId: string) => boolean;
  isExpired: (entityCode: string, instanceId: string) => boolean;
  invalidate: (entityCode: string, instanceId: string) => void;
  invalidateEntity: (entityCode: string) => void;
  clear: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes (short-lived)

// ============================================================================
// Store Implementation
// ============================================================================

export const useEntityInstanceDataStore = create<EntityInstanceDataState & EntityInstanceDataActions>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial State
        instances: {},

        // Setters
        setInstance: (entityCode: string, instanceId: string, data: EntityInstance) => {
          const cacheKey = `${entityCode}:${instanceId}`;
          console.log(`%c[InstanceDataStore] Storing: ${cacheKey}`, 'color: #4dabf7; font-weight: bold');

          const { instances } = get();
          set({
            instances: {
              ...instances,
              [cacheKey]: {
                data,
                timestamp: Date.now(),
                ttl: CACHE_TTL,
                entityCode,
                isDirty: false,
              },
            },
          });
        },

        // Getters
        getInstance: (entityCode: string, instanceId: string) => {
          const cacheKey = `${entityCode}:${instanceId}`;
          const { instances } = get();
          const entry = instances[cacheKey];

          if (!entry) return null;

          if (get().isExpired(entityCode, instanceId)) {
            console.log(`%c[InstanceDataStore] Cache expired: ${cacheKey}`, 'color: #fcc419');
            return null;
          }

          console.log(`%c[InstanceDataStore] Cache HIT: ${cacheKey}`, 'color: #51cf66; font-weight: bold', {
            isDirty: entry.isDirty,
          });
          return entry.data;
        },

        // Optimistic Update
        updateInstance: (entityCode: string, instanceId: string, changes: Partial<EntityInstance>) => {
          const cacheKey = `${entityCode}:${instanceId}`;
          const { instances } = get();
          const entry = instances[cacheKey];

          if (!entry) {
            console.warn(`%c[InstanceDataStore] Cannot update non-existent: ${cacheKey}`, 'color: #ff6b6b');
            return;
          }

          console.log(`%c[InstanceDataStore] Optimistic update: ${cacheKey}`, 'color: #fcc419; font-weight: bold', changes);

          set({
            instances: {
              ...instances,
              [cacheKey]: {
                ...entry,
                data: { ...entry.data, ...changes },
                isDirty: true,
              },
            },
          });
        },

        markSynced: (entityCode: string, instanceId: string) => {
          const cacheKey = `${entityCode}:${instanceId}`;
          const { instances } = get();
          const entry = instances[cacheKey];

          if (entry) {
            set({
              instances: {
                ...instances,
                [cacheKey]: {
                  ...entry,
                  isDirty: false,
                  timestamp: Date.now(), // Reset TTL after sync
                },
              },
            });
          }
        },

        // Utilities
        isDirty: (entityCode: string, instanceId: string) => {
          const cacheKey = `${entityCode}:${instanceId}`;
          const { instances } = get();
          return instances[cacheKey]?.isDirty ?? false;
        },

        isExpired: (entityCode: string, instanceId: string) => {
          const cacheKey = `${entityCode}:${instanceId}`;
          const { instances } = get();
          const entry = instances[cacheKey];
          if (!entry) return true;
          return Date.now() - entry.timestamp > entry.ttl;
        },

        invalidate: (entityCode: string, instanceId: string) => {
          const cacheKey = `${entityCode}:${instanceId}`;
          console.log(`%c[InstanceDataStore] Invalidated: ${cacheKey}`, 'color: #ff6b6b');

          const { instances } = get();
          const { [cacheKey]: _, ...rest } = instances;
          set({ instances: rest });
        },

        invalidateEntity: (entityCode: string) => {
          console.log(`%c[InstanceDataStore] Invalidating all: ${entityCode}`, 'color: #ff6b6b');

          const { instances } = get();
          const newInstances: Record<string, CacheEntry> = {};

          Object.entries(instances).forEach(([cacheKey, entry]) => {
            if (entry.entityCode !== entityCode) {
              newInstances[cacheKey] = entry;
            }
          });

          set({ instances: newInstances });
        },

        clear: () => {
          console.log('%c[InstanceDataStore] Cleared all', 'color: #ff6b6b');
          set({ instances: {} });
        },
      }),
      {
        name: 'pmo-entity-instance-data-store',
        storage: createJSONStorage(() => sessionStorage),
        partialize: (state) => ({ instances: state.instances }),
      }
    ),
    { name: 'EntityInstanceDataStore' }
  )
);
