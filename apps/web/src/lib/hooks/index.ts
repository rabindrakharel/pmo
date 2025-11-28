/**
 * Hooks Index
 *
 * Centralized export for all custom React hooks
 *
 * v9.0.0: Hybrid RxDB + TanStack Query + Dexie Architecture
 * - RxDB: Existing entity data hooks (useEntityQuery.ts)
 * - TanStack Query + Dexie: New hooks for metadata and drafts
 * - Migration in progress - both systems available
 */

export { useColumnVisibility } from './useColumnVisibility';
export type { UseColumnVisibilityReturn } from './useColumnVisibility';

// Entity Query Hooks (RxDB integration - existing implementation)
// These hooks use RxDB internally for entity data storage
export {
  // Raw data hooks (for editing, exports, mutations)
  useEntityInstanceList,
  useEntityInstance,
  // Formatted data hooks (for display)
  useFormattedEntityList,
  useFormattedEntityInstance,
  // Utility hooks
  useEntityCodes,
  useEntityMutation,
  useDatalabels,
  useAllDatalabels,
  useGlobalSettings,
  useEntityMetadata,
  useDatalabelMutation,
  useEntityLookup,
  useCacheInvalidation,
  usePrefetch,
  queryKeys,
  CACHE_TTL,
} from './useEntityQuery';

export type {
  EntityInstanceListParams,
  // Raw result types
  EntityInstanceListResult,
  EntityInstanceResult,
  // Formatted result types
  FormattedEntityInstanceListResult,
  FormattedEntityInstanceResult,
  // RefData type
  RefData,
} from './useEntityQuery';

// v8.5.0: RxDB hooks for direct database access (legacy - still in use)
export {
  useRxEntity,
  useRxEntityList,
  useRxEntityMutation,
  useRxDraft,
  useRecoverDraft,
  useRxDB,
  useRxDBReady,
  useReplicationStatus,
  // v8.6.0: RxDB metadata hooks
  useRxDatalabel,
  useRxAllDatalabels,
  useRxEntityCodes,
  useRxGlobalSettings,
  useRxComponentMetadata,
  useMetadataLoaded,
  cacheComponentMetadata,
  invalidateMetadataCache,
  clearAllMetadataCache,
  prefetchAllMetadata,
} from '../../db/rxdb';

export type {
  DatalabelOption,
  EntityCodeData,
  GlobalSettings,
  ComponentMetadata,
} from '../../db/rxdb';

// v9.0.0: NEW TanStack + Dexie hooks (for consumer files that have migrated)
export {
  // Entity hooks
  useEntity,
  useEntityList,
  // Offline-first hooks (Dexie-only, no network)
  useOfflineEntity,
  useOfflineEntityList,
  isEntityCached,
  getCachedEntity,
  // Draft persistence (survives page refresh)
  useDraft,
  useRecoverDrafts,
  // Sync cache accessors (for non-hook contexts)
  getDatalabelSync,
  getEntityCodesSync,
  getEntityByCodeSync,
  getGlobalSettingsSync,
  getSettingSync,
  // Prefetch functions (used by AuthContext)
  prefetchAllDatalabels,
  prefetchEntityCodes,
  prefetchGlobalSettings,
} from '../../db/tanstack-hooks';

export type {
  UseDraftResult,
  DraftInfo,
} from '../../db/tanstack-hooks';

// v8.3.1: RefData Resolution Hooks (metadata-based, no pattern matching)
export {
  useRefData,
  useMergedRefData,
  useResolvedField,
  useResolvedRow,
  // Metadata-based detection utilities
  isEntityReferenceField,
  getEntityCodeFromMetadata,
  isArrayReferenceField,
  mergeRefData,
} from './useRefData';

export type { UseRefDataResult, FieldMetadata } from './useRefData';

// v8.3.2: Unified Entity Instance Cache (dropdown + view resolution)
export {
  // React Hooks
  useRefDataEntityInstanceOptions,
  useRefDataEntityInstanceResolver,
  useRefDataEntityInstanceUpsert,
  // Utility Functions (for use outside components)
  upsertRefDataEntityInstanceCache,
  getRefDataEntityInstanceCache,
  resolveFromCache,
  prefetchEntityInstances,
  // Query Keys
  refDataEntityInstanceKeys,
} from './useRefDataEntityInstanceCache';

export type {
  EntityInstanceLookup,
  EntityInstanceOption,
} from './useRefDataEntityInstanceCache';

// Keyboard Shortcuts Hook
export { useKeyboardShortcuts } from './useKeyboardShortcuts';
