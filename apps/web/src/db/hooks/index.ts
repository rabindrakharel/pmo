/**
 * RxDB Hooks - Barrel Export
 *
 * Exports all database hooks for use throughout the application.
 *
 * REPLACES:
 * - React Query hooks (useQuery, useMutation, useQueryClient)
 * - Zustand store hooks (useGlobalSettingsMetadataStore, etc.)
 */

// ============================================================================
// Database Access
// ============================================================================

export {
  useDatabase,
  useDatabaseSafe,
  useDatabaseState,
  useOnlineStatus,
  useSyncStatus
} from './useDatabase';

// ============================================================================
// Core Query Hooks (Replace React Query)
// ============================================================================

export { useRxQuery, useRxQueryPaginated } from './useRxQuery';
export type { UseRxQueryOptions, UseRxQueryResult } from './useRxQuery';

export { useRxDocument, useRxDocumentByField } from './useRxDocument';
export type { UseRxDocumentResult } from './useRxDocument';

export { useRxMutation } from './useRxMutation';
export type { UseRxMutationResult } from './useRxMutation';

// ============================================================================
// State Management Hooks (Replace Zustand)
// ============================================================================

export { useRxState, useRxStateSelector, useRxStateWithTTL } from './useRxState';
export type { UseRxStateResult } from './useRxState';

// ============================================================================
// Metadata Store Replacements
// ============================================================================

// Global Settings (replaces globalSettingsMetadataStore)
export {
  useGlobalSettings,
  useCurrencySettings,
  useDateFormatSettings,
  useTimestampFormatSettings,
  useBooleanFormatSettings
} from './useGlobalSettings';

// Datalabels (replaces datalabelMetadataStore)
export {
  useDatalabel,
  useAllDatalabels,
  useDatalabelMutations
} from './useDatalabels';
export type { DatalabelOption } from './useDatalabels';

// Entity Types (replaces entityCodeMetadataStore)
export {
  useEntityTypes,
  useEntityType,
  useEntityTypeMutations
} from './useEntityTypes';
export type { EntityCodeData } from './useEntityTypes';

// Component Metadata (replaces entityComponentMetadataStore)
export {
  useComponentMetadata,
  useAllComponentMetadata
} from './useComponentMetadata';
export type {
  ComponentName,
  ComponentMetadata,
  ViewFieldMetadata,
  EditFieldMetadata
} from './useComponentMetadata';

// ============================================================================
// Entity-Specific Hooks
// ============================================================================

export {
  useEntityList,
  useEntityInstance
} from './useEntityQuery';
export type { EntityQueryParams, FormattedRow } from './useEntityQuery';

// ============================================================================
// Edit State (replaces useEntityEditStore)
// ============================================================================

export {
  useEntityEditState,
  useIsEditing,
  useHasChanges
} from './useEntityEditState';
export type { UseEntityEditStateResult } from './useEntityEditState';
