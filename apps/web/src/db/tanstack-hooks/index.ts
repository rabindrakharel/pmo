// ============================================================================
// TanStack + Dexie Hooks - Public API
// ============================================================================
// Re-exports all hooks and utilities for clean imports
// ============================================================================

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

// Cache utilities (re-exported from queryClient)
export {
  invalidateMetadataCache,
  clearAllMetadataCache,
  invalidateEntityQueries,
  clearAllCaches,
} from '../query/queryClient';
