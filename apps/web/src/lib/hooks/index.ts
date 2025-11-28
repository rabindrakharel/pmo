/**
 * Hooks Index
 *
 * Centralized export for all custom React hooks
 *
 * v8.5.0: RxDB Offline-First Architecture
 * - Entity data stored in IndexedDB via RxDB
 * - Real-time sync via WebSocket
 * - Draft persistence with undo/redo
 * - Multi-tab coordination via LeaderElection
 */

export { useColumnVisibility } from './useColumnVisibility';
export type { UseColumnVisibilityReturn } from './useColumnVisibility';

// Entity Query Hooks (RxDB + React Query integration)
// v8.6.0: RxDB offline-first pattern - all data persisted in IndexedDB
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

// v8.5.0: RxDB hooks for direct database access
export {
  useRxEntity,
  useRxEntityList,
  useRxEntityMutation,
  useRxDraft,
  useRecoverDraft,
  useRxDB,
  useRxDBReady,
  useReplicationStatus,
  // v8.6.0: RxDB metadata hooks (replaces Zustand stores)
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
