// ============================================================================
// TanStack + Dexie Hooks - Public API
// ============================================================================
// Re-exports all hooks and utilities for clean imports
// ============================================================================

// Entity hooks (legacy)
export {
  useEntity,
  useEntityMutation,
  type UseEntityResult,
  type UseEntityMutationResult,
} from './useEntity';

export {
  useEntityList,
  useEntityInfiniteList,
  type UseEntityListParams,
  type UseEntityListResult,
  type UseEntityInfiniteListResult,
} from './useEntityList';

// Offline-first hooks
export {
  useOfflineEntity,
  useOfflineEntityList,
  isEntityCached,
  getCachedEntity,
  type UseOfflineEntityResult,
  type UseOfflineEntityListResult,
} from './useOfflineEntity';

// Metadata hooks
export {
  useDatalabel,
  useAllDatalabels,
  getDatalabelSync,
  setDatalabelSync,
  clearDatalabelCache,
  prefetchAllDatalabels,
  type DatalabelOption,
  type UseDatalabelResult,
  type UseAllDatalabelsResult,
} from './useDatalabel';

export {
  useEntityCodes,
  getEntityCodesSync,
  getEntityByCodeSync,
  clearEntityCodesCache,
  prefetchEntityCodes,
  type EntityCodeData,
  type UseEntityCodesResult,
} from './useEntityCodes';

export {
  useGlobalSettings,
  getGlobalSettingsSync,
  getSettingSync,
  clearGlobalSettingsCache,
  prefetchGlobalSettings,
  type GlobalSettings,
  type UseGlobalSettingsResult,
} from './useGlobalSettings';

// Draft hooks
export {
  useDraft,
  useRecoverDrafts,
  type UseDraftResult,
  type DraftInfo,
  type UseRecoverDraftsResult,
} from './useDraft';

// ============================================================================
// 4-LAYER NORMALIZED CACHE HOOKS (Modular Architecture)
// ============================================================================
// Re-exports from normalized-cache module for backward compatibility
// New code should import directly from '@/db/normalized-cache'
// ============================================================================

export {
  // Types
  type EntityCode,
  type EntityInstance,
  type EntityLink,
  type CacheConfig,
  type CacheStrategy,

  // Configuration
  CacheConfigProvider,
  useCacheConfig,
  useLayerEnabled,
  isCacheEnabled,
  isLayerEnabledSync,
  getCacheConfig,

  // Layer 1: Entity Codes
  useEntityCodes,
  getEntityCodeSync,
  getAllEntityCodesSync,
  getChildEntityCodesSync,
  prefetchEntityCodes,

  // Layer 2: Entity Instances
  useEntityInstances,
  getEntityInstancesSync,
  getEntityInstanceSync,
  prefetchEntityInstances,

  // Layer 3: Entity Links
  useEntityLinks,
  getChildIdsSync,
  getParentsSync,
  prefetchEntityLinks,
  addLinkToCache,
  removeLinkFromCache,
  invalidateEntityLinks,

  // Layer 4: Entity Instance Names
  useEntityInstanceNames,
  getEntityInstanceNameSync,
  getEntityInstanceNamesForTypeSync,
  mergeEntityInstanceNames,

  // Derived queries
  useNormalizedEntityList,

  // Hydration & Prefetch
  hydrateNormalizedCache,
  prefetchNormalizedCache,

  // Cache management
  clearNormalizedCacheMemory,
  invalidateEntityInstance,

  // Query keys
  QUERY_KEYS,
} from '../normalized-cache';

// Legacy query key exports for backward compatibility
import { QUERY_KEYS } from '../normalized-cache';
export const ENTITY_CODES_KEY = QUERY_KEYS.ENTITY_CODES;
export const ENTITY_INSTANCES_KEY = QUERY_KEYS.ENTITY_INSTANCES;
export const ENTITY_LINKS_KEY = QUERY_KEYS.ENTITY_LINKS;
export const ENTITY_INSTANCE_NAMES_KEY = QUERY_KEYS.ENTITY_INSTANCE_NAMES;

// Cache utilities (re-exported from queryClient)
export {
  invalidateMetadataCache,
  clearAllMetadataCache,
  invalidateEntityQueries,
  clearAllCaches,
} from '../query/queryClient';
