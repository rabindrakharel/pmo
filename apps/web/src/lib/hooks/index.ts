/**
 * Hooks Index
 *
 * Centralized export for all custom React hooks
 */

export { useColumnVisibility } from './useColumnVisibility';
export type { UseColumnVisibilityReturn } from './useColumnVisibility';

// Entity Query Hooks (React Query + Zustand integration)
// v8.0.0: Format at Read pattern - raw data cached, formatting on read via select
export {
  // Raw data hooks (for editing, exports, mutations)
  useEntityInstanceList,
  useEntityInstance,
  // Formatted data hooks (for display - uses select transform)
  useFormattedEntityList,
  useFormattedEntityInstance,
  // Utility hooks
  useEntityCodes,
  useEntityMutation,
  useDatalabels,
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
  // Formatted result types (v8.0.0)
  FormattedEntityInstanceListResult,
  FormattedEntityInstanceResult,
  // v8.3.0: RefData type
  RefData,
} from './useEntityQuery';

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
