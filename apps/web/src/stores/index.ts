/**
 * ============================================================================
 * ZUSTAND STORES - ALL MIGRATED TO RxDB (v8.6.0)
 * ============================================================================
 *
 * All Zustand stores have been migrated to RxDB:
 *
 * MIGRATED METADATA STORES:
 * - datalabelMetadataStore → useRxDatalabel, getDatalabelSync
 * - entityCodeMetadataStore → useRxEntityCodes, getEntityCodesSync
 * - entityComponentMetadataStore → useRxComponentMetadata
 * - globalSettingsMetadataStore → useRxGlobalSettings, getGlobalSettingsSync
 *
 * MIGRATED UI STATE STORES:
 * - useEntityEditStore → useRxDraft (persistent drafts in IndexedDB)
 *
 * This file is kept for backwards compatibility but exports nothing.
 * New code should import directly from '@/db/rxdb'.
 */

// No exports - all stores migrated to RxDB
