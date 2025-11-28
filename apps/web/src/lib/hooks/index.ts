/**
 * Hooks Index
 *
 * Centralized export for all custom React hooks
 *
 * v9.0.0: TanStack Query + Dexie Architecture
 * - TanStack Query: Server state management with automatic caching
 * - Dexie: IndexedDB persistence for offline-first
 * - WebSocket: Real-time cache invalidation via PubSub service
 */

export { useColumnVisibility } from './useColumnVisibility';
export type { UseColumnVisibilityReturn } from './useColumnVisibility';

// Entity Query Hooks (TanStack Query + Dexie - v9.0.0)
// These hooks use TanStack Query + Dexie internally for entity data storage
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

// v9.0.0: TanStack + Dexie hooks - SINGLE SOURCE OF TRUTH
export {
  // Entity hooks (direct access)
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
  // Cache invalidation
  invalidateMetadataCache,
  clearAllMetadataCache,
} from '../../db/tanstack-hooks';

export type {
  UseDraftResult,
  DraftInfo,
  DatalabelOption,
  EntityCodeData,
  GlobalSettings,
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
