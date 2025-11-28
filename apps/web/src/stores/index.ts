/**
 * ============================================================================
 * ZUSTAND STORES - BARREL EXPORT (v8.6.0)
 * ============================================================================
 *
 * ARCHITECTURE (v8.6.0 - RxDB Unified State):
 * - RxDB: SOLE data cache for entity instances + metadata
 * - Zustand: UI state only (useEntityEditStore pending migration)
 *
 * MIGRATED TO RxDB (v8.6.0):
 * - datalabelMetadataStore → useRxDatalabel, getDatalabelSync
 * - entityCodeMetadataStore → useRxEntityCodes, getEntityCodesSync
 * - entityComponentMetadataStore → useRxComponentMetadata
 * - globalSettingsMetadataStore → useRxGlobalSettings, getGlobalSettingsSync
 *
 * REMAINING (pending migration to useRxDraft):
 * - useEntityEditStore: Entity edit state management (dirty fields, undo/redo)
 */

// UI State stores (pending migration to useRxDraft)
export { useEntityEditStore } from './useEntityEditStore';
