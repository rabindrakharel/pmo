/**
 * ============================================================================
 * ZUSTAND STORES - BARREL EXPORT (v6.0.0)
 * ============================================================================
 *
 * ARCHITECTURE:
 * - React Query: SOLE data cache for entity instances (lists & details)
 * - Zustand: METADATA caching + UI state only
 *
 * Metadata Stores (1 hour TTL):
 * - globalSettingsMetadataStore: Currency, date, timestamp formatting
 * - datalabelMetadataStore: Dropdown options (dl__* fields)
 * - entityComponentMetadataStore: Field metadata by entityCode:componentName
 * - entityCodeMetadataStore: Entity types for sidebar navigation
 *
 * UI State Stores (no TTL):
 * - useEntityEditStore: Entity edit state management (dirty fields, undo/redo)
 *
 * REMOVED (v6.0.0 - Eliminated Dual Cache):
 * - entityInstanceDataStore: Now using React Query only
 * - entityInstanceListDataStore: Now using React Query only
 */

// Metadata stores (1 hour TTL)
export { useGlobalSettingsMetadataStore } from './globalSettingsMetadataStore';
export type { GlobalSettings } from './globalSettingsMetadataStore';

export { useDatalabelMetadataStore } from './datalabelMetadataStore';
export type { DatalabelOption, Datalabel } from './datalabelMetadataStore';

export { useEntityComponentMetadataStore } from './entityComponentMetadataStore';
export type { FieldMetadata, ComponentName, ComponentMetadata } from './entityComponentMetadataStore';

export { useEntityCodeMetadataStore } from './entityCodeMetadataStore';
export type { EntityCodeData } from './entityCodeMetadataStore';

// UI State stores (no persistence)
export { useEntityEditStore } from './useEntityEditStore';
