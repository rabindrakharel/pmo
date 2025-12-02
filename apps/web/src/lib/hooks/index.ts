/**
 * Hooks Index
 *
 * Centralized export for all custom React hooks
 *
 * v9.1.0: TanStack Query + Dexie Architecture (No Wrapper Layer)
 * - TanStack Query: Server state management with automatic caching
 * - Dexie: IndexedDB persistence for offline-first
 * - WebSocket: Real-time cache invalidation via PubSub service
 *
 * CANONICAL HOOKS (from @/db/tanstack-index - see NORMALIZED_CACHE_ARCHITECTURE.md):
 * - useEntity, useEntityInstanceData, useDatalabel, useEntityCodes, etc.
 *
 * FORMAT-AT-READ: Formatting happens in components via useMemo, not in hooks
 */

export { useColumnVisibility } from './useColumnVisibility';
export type { UseColumnVisibilityReturn } from './useColumnVisibility';

// ============================================================================
// CANONICAL HOOKS - From @/db/tanstack-index (SINGLE SOURCE OF TRUTH)
// ============================================================================
export {
  // Entity data hooks
  useEntity,
  useEntityInstanceData,
  useEntityMutation,
  // Metadata hooks
  useDatalabel,
  useAllDatalabels,
  useEntityCodes,
  useEntityInstanceMetadata,
  useGlobalSettings,
  // Entity instance names
  useEntityInstanceNames,
  // Entity links
  useEntityLinks,
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
  getEntityCodeSync,
  getGlobalSettingsSync,
  getSettingSync,
  getEntityInstanceNameSync,
  getChildIdsSync,
  // Prefetch functions (used by AuthContext)
  prefetchAllDatalabels,
  prefetchEntityCodes,
  prefetchGlobalSettings,
  // Cache invalidation
  invalidateMetadataCache,
  invalidateEntityQueries,
  clearAllMetadataCache,
} from '../../db/tanstack-index';

export type {
  UseDraftResult,
  DraftInfo,
  DatalabelOption,
  EntityCodeData,
  GlobalSettings,
  RefData,
} from '../../db/tanstack-index';

// ============================================================================
// ref_data_entityInstance Cache (dropdown + view resolution)
// v11.0.0: Legacy useRefData hook removed - use getEntityInstanceNameSync() instead
// ============================================================================
export {
  // React Hooks
  useRefDataEntityInstanceOptions,
  useRefDataEntityInstanceResolver,
  useRefDataEntityInstanceUpsert,
  // Utility Functions (for use outside components)
  upsertRefDataEntityInstance,
  getRefDataEntityInstance,
  resolveFromRefDataEntityInstance,
  prefetchRefDataEntityInstances,
  // v11.0.0: ref_data_entityInstanceKeys removed - uses unified ['entityInstanceNames', entityCode] key
} from './useRefDataEntityInstance';

export type {
  EntityInstanceLookup,
  EntityInstanceOption,
} from './useRefDataEntityInstance';

// ============================================================================
// UI Utility Hooks
// ============================================================================
export { useKeyboardShortcuts } from './useKeyboardShortcuts';
