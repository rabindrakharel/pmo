/**
 * Hooks Index (v9.0.0)
 *
 * Centralized export for all custom React hooks.
 *
 * v9.0.0: Migrated to RxDB + RxState (removed React Query + Zustand)
 */

// ============================================================================
// Database Access (from RxDB)
// ============================================================================

export {
  useDatabase,
  useDatabaseSafe,
  useDatabaseState,
  useOnlineStatus,
  useSyncStatus
} from '../../db/hooks';

// ============================================================================
// Core Query Hooks (RxDB - replaces React Query)
// ============================================================================

export { useRxQuery, useRxQueryPaginated } from '../../db/hooks';
export type { UseRxQueryOptions, UseRxQueryResult } from '../../db/hooks';

export { useRxDocument, useRxDocumentByField } from '../../db/hooks';
export type { UseRxDocumentResult } from '../../db/hooks';

export { useRxMutation } from '../../db/hooks';
export type { UseRxMutationResult } from '../../db/hooks';

// ============================================================================
// State Management Hooks (RxState - replaces Zustand)
// ============================================================================

export { useRxState, useRxStateSelector, useRxStateWithTTL } from '../../db/hooks';
export type { UseRxStateResult } from '../../db/hooks';

// ============================================================================
// Metadata Store Hooks (from RxDB)
// ============================================================================

// Global Settings (replaces globalSettingsMetadataStore)
export {
  useGlobalSettings,
  useCurrencySettings,
  useDateFormatSettings,
  useTimestampFormatSettings,
  useBooleanFormatSettings
} from '../../db/hooks';

// Datalabels (replaces datalabelMetadataStore)
export {
  useDatalabel,
  useAllDatalabels,
  useDatalabelMutations
} from '../../db/hooks';
export type { DatalabelOption } from '../../db/hooks';

// Entity Types (replaces entityCodeMetadataStore)
export {
  useEntityTypes,
  useEntityType,
  useEntityTypeMutations
} from '../../db/hooks';
export type { EntityCodeData } from '../../db/hooks';

// Component Metadata (replaces entityComponentMetadataStore)
export {
  useComponentMetadata,
  useAllComponentMetadata
} from '../../db/hooks';
export type {
  ComponentName,
  ComponentMetadata,
  ViewFieldMetadata,
  EditFieldMetadata
} from '../../db/hooks';

// ============================================================================
// Entity-Specific Hooks (from RxDB)
// ============================================================================

export {
  useEntityList,
  useEntityInstance
} from '../../db/hooks';
export type { EntityQueryParams, FormattedRow } from '../../db/hooks';

// ============================================================================
// Edit State (replaces useEntityEditStore)
// ============================================================================

export {
  useEntityEditState,
  useIsEditing,
  useHasChanges
} from '../../db/hooks';
export type { UseEntityEditStateResult } from '../../db/hooks';

// ============================================================================
// RefData Resolution Hooks (v8.3.1 - metadata-based, no pattern matching)
// ============================================================================

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

// Re-export RefData type from refDataResolver
export type { RefData } from '../refDataResolver';

// ============================================================================
// Utility Hooks (UI-specific, no data dependencies)
// ============================================================================

export { useColumnVisibility } from './useColumnVisibility';
export type { UseColumnVisibilityReturn } from './useColumnVisibility';

export { useKeyboardShortcuts, useShortcutHints } from './useKeyboardShortcuts';

export { useKanbanColumns } from './useKanbanColumns';

export { useViewMode } from './useViewMode';

export { useS3Upload } from './useS3Upload';

// ============================================================================
// v9.0.0: Backward Compatibility Shims
// ============================================================================
// These provide compatibility with v8.x hook names during migration.
// They map to RxDB equivalents or provide no-op implementations.
// ============================================================================

// Alias for old hook names
export { useEntityInstance as useFormattedEntityInstance } from '../../db/hooks';
export { useEntityList as useEntityInstanceList } from '../../db/hooks';

// No-op shims for removed functionality
export function useEntityMutation(_entityCode: string) {
  return {
    updateEntity: async (_id: string, _data: any) => {
      console.warn('[v9.0.0] useEntityMutation.updateEntity is deprecated. Use RxDB document.patch() instead.');
      return { success: true };
    },
    createEntity: async (_data: any) => {
      console.warn('[v9.0.0] useEntityMutation.createEntity is deprecated. Use RxDB collection.insert() instead.');
      return { success: true, id: '' };
    },
    deleteEntity: async (_id: string) => {
      console.warn('[v9.0.0] useEntityMutation.deleteEntity is deprecated. Use RxDB document methods instead.');
      return { success: true };
    },
    isUpdating: false,
    isCreating: false,
    isDeleting: false,
  };
}

export function useCacheInvalidation() {
  return {
    invalidateEntity: (_entityCode: string, _entityId?: string) => {
      console.warn('[v9.0.0] useCacheInvalidation is deprecated. RxDB handles reactivity automatically.');
    },
    invalidateAll: () => {
      console.warn('[v9.0.0] useCacheInvalidation.invalidateAll is deprecated. RxDB handles reactivity automatically.');
    },
  };
}

export function usePrefetch() {
  return {
    prefetchEntity: async (_entityCode: string, _entityId: string) => {
      console.warn('[v9.0.0] usePrefetch is deprecated. RxDB handles data syncing via replication.');
    },
  };
}

export function useDatalabels(_datalabelKey: string) {
  console.warn('[v9.0.0] useDatalabels is deprecated. Use useDatalabel from RxDB hooks instead.');
  return { data: [], isLoading: false };
}

export function useEntityCodes() {
  console.warn('[v9.0.0] useEntityCodes is deprecated. Use useEntityTypes from RxDB hooks instead.');
  return { data: [], isLoading: false };
}

// Query keys shim (no longer needed with RxDB)
export const queryKeys = {
  entity: (_code: string) => ['entity', _code],
  entityInstance: (_code: string, _id: string) => ['entity', _code, _id],
};

// Cache TTL shim
export const CACHE_TTL = {
  SHORT: 60000,
  MEDIUM: 300000,
  LONG: 1800000,
};
