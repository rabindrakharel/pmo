// ============================================================================
// Hydration from Dexie to Sync Stores
// ============================================================================
// Loads persisted data into memory at startup
// ============================================================================

import { db } from './schema';
import { DEXIE_CONFIG } from '../cache/constants';
import {
  globalSettingsStore,
  datalabelStore,
  entityCodesStore,
  entityInstanceNamesStore,
  entityLinksStore,
  entityInstanceMetadataStore,
} from '../cache/stores';

// ============================================================================
// HYDRATION FUNCTIONS
// ============================================================================

/**
 * Hydrate all sync stores from Dexie on startup
 * Only loads data newer than DEXIE_CONFIG.hydrationMaxAge
 *
 * @returns Number of records hydrated
 */
export async function hydrateFromDexie(): Promise<{
  globalSettings: boolean;
  datalabels: number;
  entityCodes: number;
  entityInstanceNames: number;
  entityLinks: number;
  entityMetadata: number;
  total: number;
}> {
  const maxAge = DEXIE_CONFIG.hydrationMaxAge;
  const cutoff = Date.now() - maxAge;

  let datalabelsCount = 0;
  let entityCodesCount = 0;
  let entityInstanceNamesCount = 0;
  let entityLinksCount = 0;
  let entityMetadataCount = 0;
  let globalSettingsLoaded = false;

  try {
    // Hydrate global settings
    const settings = await db.globalSettings.get('settings');
    if (settings && settings.syncedAt > cutoff) {
      globalSettingsStore.set(settings.settings);
      globalSettingsLoaded = true;
    }

    // Hydrate datalabels
    const datalabels = await db.datalabel
      .filter((d) => d.syncedAt > cutoff)
      .toArray();
    for (const dl of datalabels) {
      datalabelStore.set(dl.key, dl.options);
    }
    datalabelsCount = datalabels.length;

    // Hydrate entity codes
    const codes = await db.entityCodes.get('all');
    if (codes && codes.syncedAt > cutoff) {
      entityCodesStore.set(codes.codes);
      entityCodesCount = codes.codes.length;
    }

    // Hydrate entity instance names
    const names = await db.entityInstanceNames
      .filter((n) => n.syncedAt > cutoff)
      .toArray();
    // Group by entity code for efficient store population
    const namesByCode = new Map<string, Record<string, string>>();
    for (const name of names) {
      if (!namesByCode.has(name.entityCode)) {
        namesByCode.set(name.entityCode, {});
      }
      namesByCode.get(name.entityCode)![name.entityInstanceId] = name.entityInstanceName;
    }
    for (const [entityCode, namesMap] of namesByCode) {
      entityInstanceNamesStore.set(entityCode, namesMap);
    }
    entityInstanceNamesCount = names.length;

    // Hydrate entity links (forward index)
    const links = await db.entityLinks
      .filter((l) => l.syncedAt > cutoff)
      .toArray();
    for (const link of links) {
      entityLinksStore.setForward(link.parentCode, link.parentId, link.childCode, {
        parentCode: link.parentCode,
        parentId: link.parentId,
        childCode: link.childCode,
        childIds: link.childIds,
        relationships: link.relationships,
      });
    }
    entityLinksCount = links.length;

    // Hydrate entity metadata
    const metadata = await db.entityInstanceMetadata
      .filter((m) => m.syncedAt > cutoff)
      .toArray();
    for (const meta of metadata) {
      entityInstanceMetadataStore.set(meta.entityCode, {
        fields: meta.fields,
        viewType: meta.viewType,
        editType: meta.editType,
      });
    }
    entityMetadataCount = metadata.length;

    const total =
      (globalSettingsLoaded ? 1 : 0) +
      datalabelsCount +
      entityCodesCount +
      entityInstanceNamesCount +
      entityLinksCount +
      entityMetadataCount;

    console.log(
      `%c[Hydrate] Loaded from Dexie: ${total} total (${datalabelsCount} datalabels, ${entityCodesCount} entity codes, ${entityInstanceNamesCount} names, ${entityLinksCount} links, ${entityMetadataCount} metadata)`,
      'color: #51cf66; font-weight: bold'
    );

    return {
      globalSettings: globalSettingsLoaded,
      datalabels: datalabelsCount,
      entityCodes: entityCodesCount,
      entityInstanceNames: entityInstanceNamesCount,
      entityLinks: entityLinksCount,
      entityMetadata: entityMetadataCount,
      total,
    };
  } catch (error) {
    console.error('[Hydrate] Failed to hydrate from Dexie:', error);
    return {
      globalSettings: false,
      datalabels: 0,
      entityCodes: 0,
      entityInstanceNames: 0,
      entityLinks: 0,
      entityMetadata: 0,
      total: 0,
    };
  }
}

/**
 * Hydrate TanStack Query cache from sync stores
 * Call this after hydrateFromDexie() to populate query cache
 */
export function hydrateQueryCacheFromStores(queryClient: {
  setQueryData: (key: unknown[], data: unknown) => void;
}): void {
  // Global settings
  const settings = globalSettingsStore.get();
  if (settings) {
    queryClient.setQueryData(['globalSettings'], settings);
  }

  // Entity codes
  const codes = entityCodesStore.getAll();
  if (codes) {
    queryClient.setQueryData(['entityCodes'], codes);
  }

  // Note: Datalabels and entity instance names are loaded on-demand
  // as they're keyed by specific values (datalabel key, entity code)
}

/**
 * Check if Dexie has any cached data
 * Useful for showing loading states
 */
export async function hasCachedData(): Promise<boolean> {
  const [settingsCount, datalabelCount, codesCount] = await Promise.all([
    db.globalSettings.count(),
    db.datalabel.count(),
    db.entityCodes.count(),
  ]);
  return settingsCount > 0 || datalabelCount > 0 || codesCount > 0;
}

/**
 * Get age of oldest cached data
 * Returns null if no data cached
 */
export async function getOldestCacheAge(): Promise<number | null> {
  const settings = await db.globalSettings.get('settings');
  const codes = await db.entityCodes.get('all');

  const timestamps = [settings?.syncedAt, codes?.syncedAt].filter(Boolean) as number[];

  if (timestamps.length === 0) return null;

  const oldest = Math.min(...timestamps);
  return Date.now() - oldest;
}
