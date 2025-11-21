/**
 * Hooks Index
 *
 * Centralized export for all custom React hooks
 */

export { useColumnVisibility } from './useColumnVisibility';
export type { UseColumnVisibilityReturn } from './useColumnVisibility';

// Entity Query Hooks (React Query + Zustand integration)
export {
  useEntityList,
  useEntityDetail,
  useEntityTypes,
  useEntityMutation,
  useDatalabels,
  useCacheInvalidation,
  usePrefetch,
  queryKeys,
  CACHE_TTL,
} from './useEntityQuery';

export type {
  EntityListParams,
  EntityListResult,
  EntityDetailResult,
} from './useEntityQuery';

// Keyboard Shortcuts Hook
export { useKeyboardShortcuts } from './useKeyboardShortcuts';
