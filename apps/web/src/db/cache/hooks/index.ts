// ============================================================================
// Cache Hooks - Public API
// ============================================================================
// One hook per store, following unified cache architecture
// ============================================================================

// Global Settings
export {
  useGlobalSettings,
  prefetchGlobalSettings,
  clearGlobalSettingsCache,
  getGlobalSettingsSync,
  getSettingSync,
} from './useGlobalSettings';

// Datalabels
export {
  useDatalabel,
  useAllDatalabels,
  prefetchAllDatalabels,
  clearDatalabelCache,
  getDatalabelSync,
} from './useDatalabel';

// Entity Codes
export {
  useEntityCodes,
  prefetchEntityCodes,
  clearEntityCodesCache,
  getEntityCodesSync,
  getEntityCodeSync,
  getChildEntityCodesSync,
} from './useEntityCodes';

// Entity Instance Data (On-Demand)
export {
  useEntityInstanceData,
  useEntityInstanceMetadata,
  useEntityInfiniteList,
  clearEntityInstanceDataCache,
  type UseEntityInstanceDataResult,
  type UseEntityInstanceMetadataResult,
  type UseEntityInfiniteListResult,
} from './useEntityInstanceData';

// Single Entity & Mutations
export {
  useEntity,
  useEntityMutation,
  type UseEntityResult,
  type UseEntityMutationResult,
} from './useEntity';

// Optimistic Mutations (v9.5.0)
export {
  useOptimisticMutation,
  type OptimisticMutationContext,
  type UseOptimisticMutationOptions,
  type UseOptimisticMutationResult,
  type CreateEntityOptions,
} from './useOptimisticMutation';

// Inline Add Row (v11.3.1) - Reusable pattern for optimistic inline editing
export {
  useInlineAddRow,
  createTempRow,
  shouldBlockNavigation,
  type UseInlineAddRowOptions,
  type UseInlineAddRowResult,
  type TempRowOptions,
} from './useInlineAddRow';

// Entity Links
export {
  useEntityLinks,
  prefetchEntityLinks,
  clearEntityLinksCache,
  addLinkToCache,
  removeLinkFromCache,
  type UseEntityLinksResult,
} from './useEntityLinks';

// Entity Instance Names
export {
  useEntityInstanceNames,
  mergeEntityInstanceNames,
  clearEntityInstanceNamesCache,
  type UseEntityInstanceNamesResult,
} from './useEntityInstanceNames';

// Drafts (survives logout)
export {
  useDraft,
  useRecoverDrafts,
  type UseDraftResult,
  type DraftInfo,
  type UseRecoverDraftsResult,
} from './useDraft';

// Progressive Entity List (v10.0.0 - Cursor Pagination)
export {
  useProgressiveEntityList,
  type UseProgressiveEntityListResult,
  type ProgressiveLoadingConfig,
  type ProgressiveLoadingStatus,
  type ScrollState,
} from './useProgressiveEntityList';

// Re-export remaining sync functions from stores
export {
  getEntityInstanceNameSync,
  getEntityInstanceNamesForTypeSync,
  getChildIdsSync,
  getParentsSync,
  getEntityInstanceMetadataSync,
} from '../stores';
