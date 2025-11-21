/**
 * ============================================================================
 * ZUSTAND STORES - BARREL EXPORT
 * ============================================================================
 *
 * Centralized export for all Zustand stores with their specialized purposes:
 *
 * Session-level caching (30 min TTL):
 * - globalSettingsMetadataStore: Currency, date, timestamp formatting
 * - datalabelMetadataStore: Dropdown options (dl__* fields)
 * - entityComponentMetadataStore: Field metadata by entityCode:componentName
 * - entityCodeMetadataStore: Entity types for sidebar navigation
 *
 * Short-lived caching (5 min TTL):
 * - entityInstanceDataStore: Single entity data for optimistic updates
 * - entityInstanceListDataStore: List data for tables/grids
 *
 * Other stores:
 * - useEntityEditStore: Entity edit state management
 */

// Session-level stores (30 min TTL)
export { useGlobalSettingsMetadataStore } from './globalSettingsMetadataStore';
export type { GlobalSettings } from './globalSettingsMetadataStore';

export { useDatalabelMetadataStore } from './datalabelMetadataStore';
export type { DatalabelOption, Datalabel } from './datalabelMetadataStore';

export { useEntityComponentMetadataStore } from './entityComponentMetadataStore';
export type { FieldMetadata, ComponentName, ComponentMetadata } from './entityComponentMetadataStore';

export { useEntityCodeMetadataStore } from './entityCodeMetadataStore';
export type { EntityCodeData } from './entityCodeMetadataStore';

// Short-lived stores (5 min TTL)
export { useEntityInstanceDataStore } from './entityInstanceDataStore';
export type { EntityInstance as SingleEntityInstance } from './entityInstanceDataStore';

export { useEntityInstanceListDataStore, generateQueryHash } from './entityInstanceListDataStore';
export type { EntityInstance as ListEntityInstance, ListData } from './entityInstanceListDataStore';

// Other stores
export { useEntityEditStore } from './useEntityEditStore';
