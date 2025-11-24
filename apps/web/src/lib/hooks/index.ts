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
} from './useEntityQuery';

// Keyboard Shortcuts Hook
export { useKeyboardShortcuts } from './useKeyboardShortcuts';
