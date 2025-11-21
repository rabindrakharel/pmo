/**
 * Hooks Index
 *
 * Centralized export for all custom React hooks
 */

export { useColumnVisibility } from './useColumnVisibility';
export type { UseColumnVisibilityReturn } from './useColumnVisibility';

// Entity Query Hooks (React Query + Zustand integration)
export {
  useEntityInstanceList,
  useEntityInstance,
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
  EntityInstanceListResult,
  EntityInstanceResult,
} from './useEntityQuery';

// Keyboard Shortcuts Hook
export { useKeyboardShortcuts } from './useKeyboardShortcuts';
