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
// 4-LAYER NORMALIZED CACHE HOOKS (NEW)
// ============================================================================

export {
  // Layer 1: Entity Types
  useEntityTypes,
  getEntityTypeSync,
  getAllEntityTypesSync,
  getChildEntityCodesSync,
  prefetchEntityTypes,
  ENTITY_TYPES_KEY,
  type EntityType,

  // Layer 2: Entity Instances
  useEntityInstances,
  getEntityInstancesSync,
  getEntityInstanceSync,
  prefetchEntityInstances,
  ENTITY_INSTANCES_KEY,
  type EntityInstance,

  // Layer 3: Entity Links
  useEntityLinks,
  getChildIdsSync,
  getParentsSync,
  prefetchEntityLinks,
  addLinkToCache,
  removeLinkFromCache,
  invalidateEntityLinks,
  ENTITY_LINKS_KEY,
  type EntityLink,

  // Layer 4: Entity Instance Names
  useEntityInstanceNames,
  getEntityInstanceNameSync,
  getEntityInstanceNamesForTypeSync,
  mergeEntityInstanceNames,
  ENTITY_INSTANCE_NAMES_KEY,

  // Derived queries
  useNormalizedEntityList,

  // Hydration & Prefetch
  hydrateNormalizedCache,
  prefetchNormalizedCache,

  // Cache management
  clearNormalizedCacheMemory,
  invalidateEntityInstance,
} from './useNormalizedCache';

// Cache utilities (re-exported from queryClient)
export {
  invalidateMetadataCache,
  clearAllMetadataCache,
  invalidateEntityQueries,
  clearAllCaches,
} from '../query/queryClient';
