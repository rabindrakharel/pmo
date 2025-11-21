/**
 * Metadata Cache Store - Intelligent API Data Caching
 *
 * Provides multi-tier caching for different types of API data:
 * - Metadata: Entity field definitions (rarely changes)
 * - Datalabels: Dropdown options (changes occasionally)
 * - Global Settings: App configuration (rarely changes)
 * - Entity Lists: Cached search results (changes frequently)
 *
 * Cache Tiers:
 * 1. Session (until browser close)
 * 2. Navigation (while on same entity type)
 * 3. Time-based (TTL expiration)
 * 4. Manual (explicit invalidation)
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { devtools, subscribeWithSelector } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

type CacheTier = 'session' | 'navigation' | 'timed' | 'permanent';

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  tier: CacheTier;
  ttl?: number; // Time to live in milliseconds
  entityType?: string; // For entity-specific caching
  version?: string; // For version-based invalidation
}

interface MetadataCacheState {
  // ========================================================================
  // Tier 1: Session Cache (Persists until browser close)
  // Used for: Global settings, user preferences
  // ========================================================================
  globalSettings: CacheEntry | null;
  userPermissions: CacheEntry | null;
  entityTypes: CacheEntry | null; // List of all entity types

  // ========================================================================
  // Tier 2: Navigation Cache (Persists while on same entity)
  // Used for: Entity metadata, field definitions
  // ========================================================================
  entityMetadata: Map<string, CacheEntry>; // key: entityType
  currentEntityType: string | null; // Track current entity for cleanup

  // ========================================================================
  // Tier 3: Timed Cache (TTL-based expiration)
  // Used for: Datalabels, dropdown options
  // ========================================================================
  datalabels: Map<string, CacheEntry>; // key: datalabel name
  entityInstances: Map<string, CacheEntry>; // key: entityType (for dropdowns)

  // ========================================================================
  // Tier 4: Short-lived Cache (5 minutes)
  // Used for: List data, search results
  // ========================================================================
  entityLists: Map<string, CacheEntry>; // key: entityType:queryHash

  // ========================================================================
  // Cache Management
  // ========================================================================
  lastCleanup: number;
  cacheVersion: string;
  navigationHistory: string[]; // Track navigation for cleanup
}

interface MetadataCacheActions {
  // ========================================================================
  // Setters (with automatic tier assignment)
  // ========================================================================
  setGlobalSettings: (data: any) => void;
  setEntityTypes: (types: any[]) => void;
  setEntityMetadata: (entityType: string, metadata: any) => void;
  setDatalabels: (datalabelName: string, data: any) => void;
  setEntityInstances: (entityType: string, instances: any) => void;
  setEntityList: (entityType: string, query: string, data: any) => void;

  // ========================================================================
  // Getters (with automatic expiration check)
  // ========================================================================
  getGlobalSettings: () => any | null;
  getEntityTypes: () => any[] | null;
  getEntityMetadata: (entityType: string) => any | null;
  getDatalabels: (datalabelName: string) => any | null;
  getEntityInstances: (entityType: string) => any | null;
  getEntityList: (entityType: string, query: string) => any | null;

  // ========================================================================
  // Cache Management
  // ========================================================================
  navigateToEntity: (entityType: string) => void;
  invalidateEntity: (entityType: string) => void;
  invalidateDatalabel: (datalabelName: string) => void;
  cleanupExpired: () => void;
  clearNavigationCache: () => void;
  clearCache: () => void;
  clearAll: () => void;

  // ========================================================================
  // Utilities
  // ========================================================================
  getCacheStats: () => CacheStats;
  isExpired: (entry: CacheEntry) => boolean;
  shouldFetch: (cacheKey: string, tier: CacheTier) => boolean;
}

interface CacheStats {
  totalEntries: number;
  memoryUsage: number;
  oldestEntry: number;
  expiredCount: number;
}

// ============================================================================
// Cache TTL Configuration
// ============================================================================

const CACHE_TTL = {
  PERMANENT: Infinity,           // Never expires (global settings)
  SESSION: 24 * 60 * 60 * 1000, // 24 hours
  NAVIGATION: 30 * 60 * 1000,   // 30 minutes
  DATALABELS: 15 * 60 * 1000,   // 15 minutes
  ENTITY_LIST: 5 * 60 * 1000,   // 5 minutes
  ENTITY_INSTANCES: 10 * 60 * 1000, // 10 minutes
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useMetadataCacheStore = create<MetadataCacheState & MetadataCacheActions>()(
  subscribeWithSelector(
    devtools(
      persist(
        (set, get) => ({
          // ========================================================================
          // Initial State
          // ========================================================================
          globalSettings: null,
          userPermissions: null,
          entityTypes: null,
          entityMetadata: new Map(),
          currentEntityType: null,
          datalabels: new Map(),
          entityInstances: new Map(),
          entityLists: new Map(),
          lastCleanup: Date.now(),
          cacheVersion: '1.0.0',
          navigationHistory: [],

          // ========================================================================
          // Setters
          // ========================================================================

          setGlobalSettings: (data: any) => {
            console.log('[Cache] Storing global settings');
            set({
              globalSettings: {
                data,
                timestamp: Date.now(),
                tier: 'permanent',
                ttl: CACHE_TTL.PERMANENT,
              }
            });
          },

          setEntityTypes: (types: any[]) => {
            console.log('[Cache] Storing entity types');
            set({
              entityTypes: {
                data: types,
                timestamp: Date.now(),
                tier: 'session',
                ttl: CACHE_TTL.SESSION,
              }
            });
          },

          setEntityMetadata: (entityType: string, metadata: any) => {
            console.log(`[Cache] Storing metadata for ${entityType}`);
            const { entityMetadata } = get();
            const newMap = new Map(entityMetadata);
            newMap.set(entityType, {
              data: metadata,
              timestamp: Date.now(),
              tier: 'navigation',
              ttl: CACHE_TTL.NAVIGATION,
              entityType,
            });
            set({ entityMetadata: newMap });
          },

          setDatalabels: (datalabelName: string, data: any) => {
            console.log(`[Cache] Storing datalabel: ${datalabelName}`);
            const { datalabels } = get();
            const newMap = new Map(datalabels);
            newMap.set(datalabelName, {
              data,
              timestamp: Date.now(),
              tier: 'timed',
              ttl: CACHE_TTL.DATALABELS,
            });
            set({ datalabels: newMap });
          },

          setEntityInstances: (entityType: string, instances: any) => {
            console.log(`[Cache] Storing instances for ${entityType}`);
            const { entityInstances } = get();
            const newMap = new Map(entityInstances);
            newMap.set(entityType, {
              data: instances,
              timestamp: Date.now(),
              tier: 'timed',
              ttl: CACHE_TTL.ENTITY_INSTANCES,
              entityType,
            });
            set({ entityInstances: newMap });
          },

          setEntityList: (entityType: string, query: string, data: any) => {
            const cacheKey = `${entityType}:${query}`;
            console.log(`[Cache] Storing entity list: ${cacheKey}`);
            const { entityLists } = get();
            const newMap = new Map(entityLists);
            newMap.set(cacheKey, {
              data,
              timestamp: Date.now(),
              tier: 'timed',
              ttl: CACHE_TTL.ENTITY_LIST,
              entityType,
            });
            set({ entityLists: newMap });
          },

          // ========================================================================
          // Getters (with expiration check)
          // ========================================================================

          getGlobalSettings: () => {
            const { globalSettings } = get();
            if (!globalSettings || get().isExpired(globalSettings)) {
              return null;
            }
            return globalSettings.data;
          },

          getEntityTypes: () => {
            const { entityTypes } = get();
            if (!entityTypes || get().isExpired(entityTypes)) {
              return null;
            }
            return entityTypes.data;
          },

          getEntityMetadata: (entityType: string) => {
            const { entityMetadata, currentEntityType } = get();
            const entry = entityMetadata.get(entityType);

            // Check if we've navigated away from this entity
            if (currentEntityType && currentEntityType !== entityType) {
              console.log(`[Cache] Entity mismatch: ${currentEntityType} !== ${entityType}`);
              return null;
            }

            if (!entry || get().isExpired(entry)) {
              return null;
            }

            return entry.data;
          },

          getDatalabels: (datalabelName: string) => {
            const { datalabels } = get();
            const entry = datalabels.get(datalabelName);

            if (!entry || get().isExpired(entry)) {
              return null;
            }

            return entry.data;
          },

          getEntityInstances: (entityType: string) => {
            const { entityInstances } = get();
            const entry = entityInstances.get(entityType);

            if (!entry || get().isExpired(entry)) {
              return null;
            }

            return entry.data;
          },

          getEntityList: (entityType: string, query: string) => {
            const cacheKey = `${entityType}:${query}`;
            const { entityLists } = get();
            const entry = entityLists.get(cacheKey);

            if (!entry || get().isExpired(entry)) {
              return null;
            }

            return entry.data;
          },

          // ========================================================================
          // Cache Management
          // ========================================================================

          navigateToEntity: (entityType: string) => {
            const { currentEntityType, navigationHistory } = get();

            console.log(`[Cache] Navigating from ${currentEntityType} to ${entityType}`);

            // Clear navigation cache if switching entities
            if (currentEntityType && currentEntityType !== entityType) {
              get().clearNavigationCache();
            }

            // Update navigation history (keep last 10)
            const newHistory = [...navigationHistory.slice(-9), entityType];

            set({
              currentEntityType: entityType,
              navigationHistory: newHistory,
            });

            // Cleanup expired entries
            get().cleanupExpired();
          },

          invalidateEntity: (entityType: string) => {
            console.log(`[Cache] Invalidating entity: ${entityType}`);
            const { entityMetadata, entityLists, entityInstances } = get();

            // Remove metadata
            const newMetadata = new Map(entityMetadata);
            newMetadata.delete(entityType);

            // Remove lists
            const newLists = new Map(entityLists);
            Array.from(newLists.keys())
              .filter(key => key.startsWith(`${entityType}:`))
              .forEach(key => newLists.delete(key));

            // Remove instances
            const newInstances = new Map(entityInstances);
            newInstances.delete(entityType);

            set({
              entityMetadata: newMetadata,
              entityLists: newLists,
              entityInstances: newInstances,
            });
          },

          invalidateDatalabel: (datalabelName: string) => {
            console.log(`[Cache] Invalidating datalabel: ${datalabelName}`);
            const { datalabels } = get();
            const newMap = new Map(datalabels);
            newMap.delete(datalabelName);
            set({ datalabels: newMap });
          },

          cleanupExpired: () => {
            const state = get();
            const now = Date.now();

            // Only cleanup every 5 minutes
            if (now - state.lastCleanup < 5 * 60 * 1000) {
              return;
            }

            console.log('[Cache] Running cleanup');

            // Clean entity metadata
            const newMetadata = new Map();
            state.entityMetadata.forEach((entry, key) => {
              if (!state.isExpired(entry)) {
                newMetadata.set(key, entry);
              }
            });

            // Clean datalabels
            const newDatalabels = new Map();
            state.datalabels.forEach((entry, key) => {
              if (!state.isExpired(entry)) {
                newDatalabels.set(key, entry);
              }
            });

            // Clean entity lists
            const newLists = new Map();
            state.entityLists.forEach((entry, key) => {
              if (!state.isExpired(entry)) {
                newLists.set(key, entry);
              }
            });

            // Clean entity instances
            const newInstances = new Map();
            state.entityInstances.forEach((entry, key) => {
              if (!state.isExpired(entry)) {
                newInstances.set(key, entry);
              }
            });

            set({
              entityMetadata: newMetadata,
              datalabels: newDatalabels,
              entityLists: newLists,
              entityInstances: newInstances,
              lastCleanup: now,
            });
          },

          clearNavigationCache: () => {
            console.log('[Cache] Clearing navigation cache');
            const { currentEntityType, entityMetadata } = get();

            if (!currentEntityType) return;

            // Clear metadata for previous entity
            const newMetadata = new Map(entityMetadata);
            newMetadata.delete(currentEntityType);

            set({ entityMetadata: newMetadata });
          },

          clearCache: () => {
            console.log('[Cache] Clearing all caches (alias for clearAll)');
            get().clearAll();
          },

          clearAll: () => {
            console.log('[Cache] Clearing all caches');
            set({
              globalSettings: null,
              userPermissions: null,
              entityTypes: null,
              entityMetadata: new Map(),
              currentEntityType: null,
              datalabels: new Map(),
              entityInstances: new Map(),
              entityLists: new Map(),
              lastCleanup: Date.now(),
              navigationHistory: [],
            });
          },

          // ========================================================================
          // Utilities
          // ========================================================================

          isExpired: (entry: CacheEntry) => {
            if (!entry.ttl || entry.ttl === Infinity) {
              return false;
            }
            return Date.now() - entry.timestamp > entry.ttl;
          },

          shouldFetch: (cacheKey: string, tier: CacheTier) => {
            // Determine if we should fetch based on cache state
            switch (tier) {
              case 'permanent':
                return !get().globalSettings;
              case 'session':
                return false; // Always use cached
              case 'navigation':
                // Refetch if different entity
                return true;
              case 'timed':
                // Check TTL
                return true;
              default:
                return true;
            }
          },

          getCacheStats: () => {
            const state = get();
            let totalEntries = 0;
            let memoryUsage = 0;
            let oldestEntry = Date.now();
            let expiredCount = 0;

            // Count all cache entries
            const allMaps = [
              state.entityMetadata,
              state.datalabels,
              state.entityLists,
              state.entityInstances,
            ];

            allMaps.forEach(map => {
              map.forEach(entry => {
                totalEntries++;
                memoryUsage += JSON.stringify(entry).length;
                oldestEntry = Math.min(oldestEntry, entry.timestamp);
                if (state.isExpired(entry)) {
                  expiredCount++;
                }
              });
            });

            return {
              totalEntries,
              memoryUsage,
              oldestEntry,
              expiredCount,
            };
          },
        }),
        {
          name: 'metadata-cache-storage',
          storage: createJSONStorage(() => sessionStorage), // Use sessionStorage for session persistence
          partialize: (state) => ({
            // Only persist certain data
            globalSettings: state.globalSettings,
            entityTypes: state.entityTypes,
            datalabels: state.datalabels,
            cacheVersion: state.cacheVersion,
          }),
          version: 1,
        }
      ),
      {
        name: 'metadata-cache-store',
      }
    )
  )
);

// ============================================================================
// Convenience Hooks
// ============================================================================

export const useCachedMetadata = (entityType: string) => {
  const store = useMetadataCacheStore();
  return store.getEntityMetadata(entityType);
};

export const useCachedDatalabel = (datalabelName: string) => {
  const store = useMetadataCacheStore();
  return store.getDatalabels(datalabelName);
};

export const useCacheStats = () => {
  const store = useMetadataCacheStore();
  return store.getCacheStats();
};