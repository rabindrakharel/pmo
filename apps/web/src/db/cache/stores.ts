// ============================================================================
// Sync Accessor Functions - queryClient.getQueryData() Based
// ============================================================================
// These functions provide synchronous access to TanStack Query cache data
// for formatters, utilities, and other non-React code.
//
// v11.0.0: Removed redundant Map-based stores. Now uses queryClient.getQueryData()
// directly, eliminating duplicate in-memory caches.
//
// Usage:
//   import { getDatalabelSync, getEntityCodesSync } from '@/db/cache/stores';
//   const options = getDatalabelSync('project_stage');
// ============================================================================

import type {
  GlobalSettings,
  DatalabelOption,
  EntityCode,
  EntityInstanceMetadata,
  LinkForwardIndex,
} from './types';
import { queryClient } from './client';
import { QUERY_KEYS } from './keys';

// ============================================================================
// Convenience Functions - Global Settings
// ============================================================================

/**
 * Get global settings synchronously from TanStack Query cache
 */
export function getGlobalSettingsSync(): GlobalSettings | null {
  return queryClient.getQueryData<GlobalSettings>(QUERY_KEYS.globalSettings()) ?? null;
}

/**
 * Get a specific setting synchronously
 */
export function getSettingSync<K extends keyof GlobalSettings>(
  key: K
): GlobalSettings[K] | null {
  const settings = getGlobalSettingsSync();
  return settings?.[key] ?? null;
}

// ============================================================================
// Convenience Functions - Datalabels
// ============================================================================

/**
 * Get datalabel options synchronously from TanStack Query cache
 */
export function getDatalabelSync(key: string): DatalabelOption[] | null {
  const normalizedKey = key.startsWith('dl__') ? key.slice(4) : key;
  return queryClient.getQueryData<DatalabelOption[]>(QUERY_KEYS.datalabel(normalizedKey)) ?? null;
}

// ============================================================================
// Convenience Functions - Entity Codes
// ============================================================================

/**
 * Get all entity codes synchronously from TanStack Query cache
 */
export function getEntityCodesSync(): EntityCode[] | null {
  return queryClient.getQueryData<EntityCode[]>(QUERY_KEYS.entityCodes()) ?? null;
}

/**
 * Get entity code by code synchronously
 */
export function getEntityCodeSync(code: string): EntityCode | null {
  const codes = getEntityCodesSync();
  return codes?.find(c => c.code === code) ?? null;
}

/**
 * Get child entity codes synchronously
 */
export function getChildEntityCodesSync(parentCode: string): string[] {
  const entity = getEntityCodeSync(parentCode);
  return entity?.child_entity_codes ?? [];
}

// ============================================================================
// Convenience Functions - Entity Instance Names
// ============================================================================

/**
 * Get entity instance name synchronously from TanStack Query cache
 */
export function getEntityInstanceNameSync(
  entityCode: string,
  entityInstanceId: string
): string | null {
  const names = queryClient.getQueryData<Record<string, string>>(
    QUERY_KEYS.entityInstanceNames(entityCode)
  );
  return names?.[entityInstanceId] ?? null;
}

/**
 * Get all entity instance names for a type synchronously
 */
export function getEntityInstanceNamesForTypeSync(
  entityCode: string
): Record<string, string> {
  return queryClient.getQueryData<Record<string, string>>(
    QUERY_KEYS.entityInstanceNames(entityCode)
  ) ?? {};
}

// ============================================================================
// Convenience Functions - Entity Links
// ============================================================================

/**
 * Get child IDs synchronously from TanStack Query cache
 */
export function getChildIdsSync(
  parentCode: string,
  parentId: string,
  childCode: string
): string[] {
  // Entity links are stored per parent+child combination
  const links = queryClient.getQueryData<LinkForwardIndex>(
    QUERY_KEYS.entityLinksByParent(parentCode, parentId)
  );
  // The forward index stores childIds by child code
  if (links && 'childIds' in links && links.childCode === childCode) {
    return links.childIds ?? [];
  }
  return [];
}

/**
 * Get parents synchronously from TanStack Query cache
 * Note: Reverse index lookup - checks if parent-child link exists
 */
export function getParentsSync(
  childCode: string,
  childId: string
): Array<{
  entity_code: string;
  entity_instance_id: string;
  relationship_type: string;
}> {
  // Reverse index is not directly stored - would need a different query key pattern
  // For now, return empty array - callers should use the hook for this functionality
  // This function is rarely used synchronously
  return [];
}

// ============================================================================
// Convenience Functions - Entity Instance Metadata
// ============================================================================

/**
 * Get entity instance metadata synchronously from TanStack Query cache
 */
export function getEntityInstanceMetadataSync(
  entityCode: string
): EntityInstanceMetadata | null {
  return queryClient.getQueryData<EntityInstanceMetadata>(
    QUERY_KEYS.entityInstanceMetadata(entityCode)
  ) ?? null;
}

// ============================================================================
// Cache Statistics (for debugging)
// ============================================================================

/**
 * Get statistics about TanStack Query cache contents
 * Used for debugging - shows what's currently cached
 */
export function getCacheStats(): {
  globalSettings: boolean;
  datalabelKeys: string[];
  entityCodesCount: number;
  entityInstanceNamesTypes: string[];
  entityInstanceMetadataTypes: string[];
} {
  const cache = queryClient.getQueryCache().getAll();

  const datalabelKeys: string[] = [];
  const entityInstanceNamesTypes: string[] = [];
  const entityInstanceMetadataTypes: string[] = [];

  for (const query of cache) {
    const key = query.queryKey;
    if (key[0] === 'datalabel' && key[1] !== '__all__') {
      datalabelKeys.push(key[1] as string);
    }
    if (key[0] === 'entityInstanceNames') {
      entityInstanceNamesTypes.push(key[1] as string);
    }
    if (key[0] === 'entityInstanceMetadata') {
      entityInstanceMetadataTypes.push(key[1] as string);
    }
  }

  const entityCodes = getEntityCodesSync();

  return {
    globalSettings: getGlobalSettingsSync() !== null,
    datalabelKeys,
    entityCodesCount: entityCodes?.length ?? 0,
    entityInstanceNamesTypes,
    entityInstanceMetadataTypes,
  };
}
