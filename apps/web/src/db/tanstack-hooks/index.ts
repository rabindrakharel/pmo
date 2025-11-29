// ============================================================================
// TanStack + Dexie Hooks - Public API
// ============================================================================
// Re-exports from normalized-cache module (4-layer architecture)
// ============================================================================

import type { EntityCode } from '../normalized-cache';
import { getAllEntityCodesSync, getEntityCodeSync } from '../normalized-cache';

// Legacy type alias for backward compatibility
export type EntityCodeData = EntityCode & {
  /** @deprecated Use ui_label instead */
  label?: string;
  /** @deprecated Use ui_icon instead */
  icon?: string | null;
  /** @deprecated */
  descr?: string;
  /** @deprecated */
  parent_entity_codes?: string[];
};

// Legacy function aliases for backward compatibility
/** @deprecated Use getAllEntityCodesSync instead */
export const getEntityCodesSync = getAllEntityCodesSync;
/** @deprecated Use getEntityCodeSync instead */
export const getEntityByCodeSync = getEntityCodeSync;

// Entity hooks
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

// Datalabel hooks
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

// Global settings hooks
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
// 4-LAYER NORMALIZED CACHE (Primary Architecture)
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

// Cache utilities
export {
  invalidateMetadataCache,
  clearAllMetadataCache,
  invalidateEntityQueries,
  clearAllCaches,
} from '../query/queryClient';
