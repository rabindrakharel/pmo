/**
 * ============================================================================
 * ZUSTAND STORES - ALL MIGRATED TO TANSTACK QUERY + DEXIE (v9.0.0)
 * ============================================================================
 *
 * All Zustand stores have been migrated to TanStack Query + Dexie:
 *
 * MIGRATED METADATA STORES:
 * - datalabelMetadataStore → useDatalabel, getDatalabelSync
 * - entityCodeMetadataStore → useEntityCodes, getEntityCodesSync
 * - globalSettingsMetadataStore → useGlobalSettings, getGlobalSettingsSync
 *
 * MIGRATED UI STATE STORES:
 * - useEntityEditStore → useDraft (persistent drafts in IndexedDB via Dexie)
 *
 * This file is kept for backwards compatibility but exports nothing.
 * New code should import directly from '@/db/tanstack-hooks'.
 */

// No exports - all stores migrated to TanStack Query + Dexie
