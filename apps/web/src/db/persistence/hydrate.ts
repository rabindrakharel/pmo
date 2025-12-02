// ============================================================================
// Cache Hydration - Dexie to TanStack Query
// ============================================================================
// Loads persisted data from IndexedDB into TanStack Query cache on startup
// ============================================================================

import { queryClient } from '../cache/client';
import { QUERY_KEYS } from '../cache/keys';
import { HYDRATION_CONFIG, SESSION_STORE_CONFIG } from '../cache/constants';
import type {
  GlobalSettings,
  DatalabelOption,
  EntityCode,
  EntityInstanceMetadata,
} from '../cache/types';
// v11.0.0: Removed sync store imports - TanStack Query cache is the single source of truth
import { db } from './schema';

// ============================================================================
// Hydration Results Type
// ============================================================================

export interface HydrationResult {
  success: boolean;
  counts: {
    globalSettings: number;
    datalabels: number;
    entityCodes: number;
    entityInstanceNames: number;
    entityInstanceMetadata: number;
    total: number;
  };
  errors: string[];
}

// ============================================================================
// Main Hydration Function
// ============================================================================

/**
 * Hydrate TanStack Query cache from Dexie on app startup
 *
 * This provides instant data on page load from IndexedDB,
 * while TanStack Query handles background refresh.
 *
 * Only hydrates data that is:
 * 1. Fresher than HYDRATION_CONFIG.maxAge (30 minutes)
 * 2. Valid (no corruption)
 *
 * v11.0.0: Sync stores removed - TanStack Query cache is the single source of truth.
 * Sync accessors (getDatalabelSync, etc.) read directly from queryClient.getQueryData().
 */
export async function hydrateFromDexie(): Promise<HydrationResult> {
  const maxAge = HYDRATION_CONFIG.maxAge;
  const now = Date.now();
  const errors: string[] = [];
  const counts = {
    globalSettings: 0,
    datalabels: 0,
    entityCodes: 0,
    entityInstanceNames: 0,
    entityInstanceMetadata: 0,
    total: 0,
  };

  try {
    // Run hydrations in parallel for better performance
    const [
      globalSettingsResult,
      datalabelsResult,
      entityCodesResult,
      entityInstanceNamesResult,
      entityInstanceMetadataResult,
    ] = await Promise.allSettled([
      hydrateGlobalSettings(now, maxAge),
      hydrateDatalabels(now, maxAge),
      hydrateEntityCodes(now, maxAge),
      hydrateEntityInstanceNames(now, maxAge),
      hydrateEntityInstanceMetadata(now, maxAge),
    ]);

    // Process results
    if (globalSettingsResult.status === 'fulfilled') {
      counts.globalSettings = globalSettingsResult.value;
    } else {
      errors.push(`globalSettings: ${globalSettingsResult.reason}`);
    }

    if (datalabelsResult.status === 'fulfilled') {
      counts.datalabels = datalabelsResult.value;
    } else {
      errors.push(`datalabels: ${datalabelsResult.reason}`);
    }

    if (entityCodesResult.status === 'fulfilled') {
      counts.entityCodes = entityCodesResult.value;
    } else {
      errors.push(`entityCodes: ${entityCodesResult.reason}`);
    }

    if (entityInstanceNamesResult.status === 'fulfilled') {
      counts.entityInstanceNames = entityInstanceNamesResult.value;
    } else {
      errors.push(`entityInstanceNames: ${entityInstanceNamesResult.reason}`);
    }

    if (entityInstanceMetadataResult.status === 'fulfilled') {
      counts.entityInstanceMetadata = entityInstanceMetadataResult.value;
    } else {
      errors.push(`entityInstanceMetadata: ${entityInstanceMetadataResult.reason}`);
    }

    counts.total =
      counts.globalSettings +
      counts.datalabels +
      counts.entityCodes +
      counts.entityInstanceNames +
      counts.entityInstanceMetadata;

    return {
      success: errors.length === 0,
      counts,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      counts,
      errors: [`Unexpected error: ${error}`],
    };
  }
}

// ============================================================================
// Individual Hydration Functions
// ============================================================================

async function hydrateGlobalSettings(now: number, maxAge: number): Promise<number> {
  const record = await db.globalSettings.get('settings');
  if (!record) return 0;
  if (now - record.syncedAt > maxAge) return 0;

  // v11.0.0: Set in TanStack Query cache only (sync accessors read from queryClient)
  queryClient.setQueryData(QUERY_KEYS.globalSettings(), record.settings);

  return 1;
}

async function hydrateDatalabels(now: number, maxAge: number): Promise<number> {
  const records = await db.datalabel
    .filter((d) => now - d.syncedAt < maxAge)
    .toArray();

  let count = 0;
  for (const record of records) {
    // v11.0.0: Set in TanStack Query cache only (sync accessors read from queryClient)
    queryClient.setQueryData(QUERY_KEYS.datalabel(record.key), record.options);
    count++;
  }

  return count;
}

async function hydrateEntityCodes(now: number, maxAge: number): Promise<number> {
  const record = await db.entityCodes.get('all');
  if (!record) return 0;
  if (now - record.syncedAt > maxAge) return 0;

  // v11.0.0: Set in TanStack Query cache only (sync accessors read from queryClient)
  queryClient.setQueryData(QUERY_KEYS.entityCodes(), record.codes);

  return record.codes.length;
}

async function hydrateEntityInstanceNames(now: number, maxAge: number): Promise<number> {
  const records = await db.entityInstanceNames
    .filter((r) => now - r.syncedAt < maxAge)
    .toArray();

  // Group by entityCode for efficient hydration
  const byCode = new Map<string, Record<string, string>>();
  for (const record of records) {
    if (!byCode.has(record.entityCode)) {
      byCode.set(record.entityCode, {});
    }
    byCode.get(record.entityCode)![record.entityInstanceId] = record.name;
  }

  // Hydrate each entity type
  let count = 0;
  for (const [entityCode, names] of byCode.entries()) {
    // v11.0.0: Set in TanStack Query cache only (sync accessors read from queryClient)
    queryClient.setQueryData(QUERY_KEYS.entityInstanceNames(entityCode), names);
    count += Object.keys(names).length;
  }

  return count;
}

async function hydrateEntityInstanceMetadata(now: number, maxAge: number): Promise<number> {
  const records = await db.entityInstanceMetadata
    .filter((r) => now - r.syncedAt < maxAge)
    .toArray();

  let count = 0;
  for (const record of records) {
    // v11.0.0: Set in TanStack Query cache only (sync accessors read from queryClient)
    queryClient.setQueryData(
      QUERY_KEYS.entityInstanceMetadata(record.entityCode),
      record.metadata
    );
    count++;
  }

  return count;
}

// ============================================================================
// Persist to Dexie After API Fetch
// ============================================================================

/**
 * Persist data to Dexie after fetching from API
 * Called by hooks after successful API response
 */
export async function persistToGlobalSettings(
  settings: GlobalSettings
): Promise<void> {
  await db.globalSettings.put({
    _id: 'settings',
    settings,
    syncedAt: Date.now(),
  });
}

export async function persistToDatalabel(
  key: string,
  options: DatalabelOption[]
): Promise<void> {
  await db.datalabel.put({
    _id: key,
    key,
    options,
    syncedAt: Date.now(),
  });
}

export async function persistToEntityCodes(
  codes: EntityCode[]
): Promise<void> {
  await db.entityCodes.put({
    _id: 'all',
    codes,
    syncedAt: Date.now(),
  });
}

export async function persistToEntityInstanceNames(
  entityCode: string,
  names: Record<string, string>
): Promise<void> {
  const now = Date.now();
  const records = Object.entries(names).map(([entityInstanceId, name]) => ({
    _id: `${entityCode}:${entityInstanceId}`,
    entityCode,
    entityInstanceId,
    name,
    syncedAt: now,
  }));
  await db.entityInstanceNames.bulkPut(records);
}

export async function persistToEntityInstanceMetadata(
  entityCode: string,
  metadata: EntityInstanceMetadata
): Promise<void> {
  await db.entityInstanceMetadata.put({
    _id: entityCode,
    entityCode,
    metadata,
    syncedAt: Date.now(),
  });
}

export async function persistToEntityInstanceData(
  entityCode: string,
  queryHash: string,
  params: Record<string, unknown>,
  data: Record<string, unknown>[],
  total: number,
  metadata?: unknown,
  refData?: Record<string, Record<string, string>>
): Promise<void> {
  await db.entityInstanceData.put({
    _id: `${entityCode}:${queryHash}`,
    entityCode,
    queryHash,
    params,
    data,
    total,
    metadata: metadata as any,
    refData,
    syncedAt: Date.now(),
  });
}
