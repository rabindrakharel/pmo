// ============================================================================
// RxDB RefData Hooks (v8.7.0)
// ============================================================================
// Entity instance lookups for dropdowns and reference resolution
// Replaces React Query-based useRefDataEntityInstanceCache
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getDatabase } from '../database';
import { createMetadataId, METADATA_TTL, type MetadataDocType } from '../schemas/metadata.schema';
import { apiClient } from '../../../lib/api';

// ============================================================================
// Types
// ============================================================================

export interface EntityInstanceLookup {
  [uuid: string]: string;  // uuid → name
}

export interface EntityInstanceOption {
  value: string;  // uuid
  label: string;  // name
}

export interface RefData {
  [entityCode: string]: EntityInstanceLookup;
}

export interface UseRxRefDataOptionsResult {
  options: EntityInstanceOption[];
  lookup: EntityInstanceLookup;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// ============================================================================
// Sync Cache (for non-hook access)
// ============================================================================
// In-memory cache populated during prefetch for synchronous access

const refDataSyncCache = new Map<string, EntityInstanceLookup>();

/**
 * Get ref data synchronously (for formatters, utilities)
 */
export function getRefDataSync(entityCode: string): EntityInstanceLookup | null {
  return refDataSyncCache.get(entityCode) || null;
}

/**
 * Resolve UUID to name synchronously
 */
export function resolveRefDataSync(
  entityCode: string,
  uuid: string | null | undefined
): string | undefined {
  if (!uuid) return undefined;
  const cache = refDataSyncCache.get(entityCode);
  return cache?.[uuid];
}

/**
 * Clear sync cache (on logout)
 */
export function clearRefDataSyncCache(): void {
  refDataSyncCache.clear();
}

/**
 * Update sync cache (internal)
 */
function updateSyncCache(entityCode: string, lookup: EntityInstanceLookup): void {
  const existing = refDataSyncCache.get(entityCode) || {};
  refDataSyncCache.set(entityCode, { ...existing, ...lookup });
}

// ============================================================================
// RxDB Storage Functions
// ============================================================================

/**
 * Upsert ref_data_entityInstance into RxDB
 * Merges new data with existing cache (doesn't replace)
 */
export async function upsertRefDataToRxDB(refData: RefData): Promise<void> {
  if (!refData || typeof refData !== 'object') return;

  const db = await getDatabase();
  const now = Date.now();

  for (const [entityCode, lookups] of Object.entries(refData)) {
    if (!lookups || typeof lookups !== 'object') continue;

    const docId = createMetadataId('refdata', entityCode);

    try {
      // Get existing data
      const existing = await db.metadata.findOne(docId).exec();
      const existingLookup = (existing?.data as EntityInstanceLookup) || {};

      // Merge lookups
      const merged = { ...existingLookup, ...lookups };

      // Upsert to RxDB
      await db.metadata.upsert({
        _id: docId,
        type: 'refdata',
        key: entityCode,
        data: merged,
        cachedAt: now,
        ttl: METADATA_TTL.refdata,
        _deleted: false,
      });

      // Update sync cache
      updateSyncCache(entityCode, merged);

      console.log(
        `%c[RxDB RefData] 📥 Upserted ${Object.keys(lookups).length} entries for ${entityCode}`,
        'color: #be4bdb',
        { total: Object.keys(merged).length }
      );
    } catch (error) {
      console.error(`[RxDB RefData] Failed to upsert ${entityCode}:`, error);
    }
  }
}

/**
 * Get ref data from RxDB
 */
export async function getRefDataFromRxDB(entityCode: string): Promise<EntityInstanceLookup | null> {
  const db = await getDatabase();
  const docId = createMetadataId('refdata', entityCode);

  const doc = await db.metadata.findOne(docId).exec();
  if (doc && !doc._deleted) {
    return doc.data as EntityInstanceLookup;
  }
  return null;
}

// ============================================================================
// Prefetch Functions
// ============================================================================

let prefetchPromise: Promise<void> | null = null;

/**
 * Prefetch entity instances for multiple entity types
 * Stores in RxDB and sync cache
 */
export async function prefetchRefData(
  entityCodes: string[],
  options: { limit?: number } = {}
): Promise<void> {
  // Deduplication guard
  if (prefetchPromise) {
    console.log(
      '%c[RxDB RefData] ⏳ Prefetch already in progress',
      'color: #fcc419'
    );
    return prefetchPromise;
  }

  prefetchPromise = _doPrefetchRefData(entityCodes, options);

  try {
    await prefetchPromise;
  } finally {
    prefetchPromise = null;
  }
}

async function _doPrefetchRefData(
  entityCodes: string[],
  options: { limit?: number } = {}
): Promise<void> {
  const { limit = 500 } = options;
  const token = localStorage.getItem('auth_token');

  if (!token) {
    console.warn('[RxDB RefData] No auth token, skipping prefetch');
    return;
  }

  console.log(
    `%c[RxDB RefData] 🔄 Prefetching: ${entityCodes.join(', ')}`,
    'color: #ff6b6b'
  );

  const db = await getDatabase();
  const now = Date.now();

  const promises = entityCodes.map(async (entityCode) => {
    try {
      const response = await apiClient.get(
        `/api/v1/entity/${entityCode}/entity-instance`,
        { params: { active_only: true, limit } }
      );

      const items = response.data?.data || response.data || [];

      // Transform to lookup format: { uuid: name }
      const lookup: EntityInstanceLookup = {};
      for (const item of items) {
        if (item.id && item.name) {
          lookup[item.id] = item.name;
        }
      }

      // Store in RxDB
      const docId = createMetadataId('refdata', entityCode);
      await db.metadata.upsert({
        _id: docId,
        type: 'refdata',
        key: entityCode,
        data: lookup,
        cachedAt: now,
        ttl: METADATA_TTL.refdata,
        _deleted: false,
      });

      // Update sync cache
      updateSyncCache(entityCode, lookup);

      console.log(
        `%c[RxDB RefData] ✅ Cached ${Object.keys(lookup).length} ${entityCode} instances`,
        'color: #51cf66'
      );
    } catch (error) {
      console.error(`[RxDB RefData] ❌ Failed to prefetch ${entityCode}:`, error);
    }
  });

  await Promise.all(promises);

  // Summary log
  console.log(
    `%c[RxDB RefData] 📊 Prefetch complete:`,
    'color: #be4bdb; font-weight: bold'
  );
  entityCodes.forEach((entityCode) => {
    const cache = refDataSyncCache.get(entityCode);
    console.log(
      `  ${cache ? '✅' : '❌'} ${entityCode}: ${cache ? Object.keys(cache).length : 0} items`
    );
  });
}

// ============================================================================
// React Hooks
// ============================================================================

/**
 * Hook to get entity instance options for dropdown population
 *
 * @example
 * const { options, isLoading } = useRxRefDataOptions('employee');
 * // options = [{ value: 'uuid-1', label: 'James Miller' }, ...]
 */
export function useRxRefDataOptions(
  entityCode: string | null,
  options: { enabled?: boolean; limit?: number } = {}
): UseRxRefDataOptionsResult {
  const { enabled = true, limit = 500 } = options;

  const [lookup, setLookup] = useState<EntityInstanceLookup>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch function
  const fetchData = useCallback(async () => {
    if (!entityCode || !enabled) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const db = await getDatabase();
      const docId = createMetadataId('refdata', entityCode);

      // Check cache first
      const cached = await db.metadata.findOne(docId).exec();
      if (cached && !cached._deleted) {
        const cachedLookup = cached.data as EntityInstanceLookup;
        setLookup(cachedLookup);
        updateSyncCache(entityCode, cachedLookup);

        // Check if stale
        const isStale = Date.now() - cached.cachedAt > cached.ttl;
        if (!isStale) {
          setIsLoading(false);
          return;
        }
      }

      // Fetch from API
      const response = await apiClient.get(
        `/api/v1/entity/${entityCode}/entity-instance`,
        { params: { active_only: true, limit } }
      );

      const items = response.data?.data || response.data || [];
      const newLookup: EntityInstanceLookup = {};
      for (const item of items) {
        if (item.id && item.name) {
          newLookup[item.id] = item.name;
        }
      }

      // Store in RxDB
      const now = Date.now();
      await db.metadata.upsert({
        _id: docId,
        type: 'refdata',
        key: entityCode,
        data: newLookup,
        cachedAt: now,
        ttl: METADATA_TTL.refdata,
        _deleted: false,
      });

      // Update state and sync cache
      setLookup(newLookup);
      updateSyncCache(entityCode, newLookup);

      console.log(
        `%c[RxDB RefData] ✅ Fetched ${Object.keys(newLookup).length} ${entityCode} instances`,
        'color: #51cf66'
      );
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      console.error(`[RxDB RefData] Failed to fetch ${entityCode}:`, err);
    } finally {
      setIsLoading(false);
    }
  }, [entityCode, enabled, limit]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Subscribe to RxDB changes
  useEffect(() => {
    if (!entityCode || !enabled) return;

    let subscription: any;
    let lastDataHash: string | null = null;

    getDatabase().then(db => {
      const docId = createMetadataId('refdata', entityCode);
      subscription = db.metadata.findOne(docId).$.subscribe(doc => {
        if (doc && !doc._deleted) {
          const newLookup = doc.data as EntityInstanceLookup;
          const newHash = JSON.stringify(newLookup);
          if (newHash !== lastDataHash) {
            lastDataHash = newHash;
            setLookup(newLookup);
            updateSyncCache(entityCode, newLookup);
          }
        }
      });
    });

    return () => subscription?.unsubscribe();
  }, [entityCode, enabled]);

  // Transform lookup to options array
  const selectOptions = useMemo((): EntityInstanceOption[] => {
    return Object.entries(lookup)
      .map(([uuid, name]) => ({ value: uuid, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [lookup]);

  return {
    options: selectOptions,
    lookup,
    isLoading,
    error,
    refetch: fetchData,
  };
}

/**
 * Hook for resolving entity UUIDs to names
 *
 * @example
 * const { resolveName } = useRxRefDataResolver();
 * const managerName = resolveName('employee', project.manager__employee_id);
 */
export function useRxRefDataResolver() {
  /**
   * Resolve single UUID to name
   */
  const resolveName = useCallback(
    (entityCode: string, uuid: string | null | undefined): string | undefined => {
      return resolveRefDataSync(entityCode, uuid);
    },
    []
  );

  /**
   * Resolve array of UUIDs to names
   */
  const resolveNames = useCallback(
    (entityCode: string, uuids: string[] | null | undefined): string[] => {
      if (!uuids || !Array.isArray(uuids)) return [];
      return uuids
        .map((uuid) => resolveRefDataSync(entityCode, uuid))
        .filter((name): name is string => !!name);
    },
    []
  );

  /**
   * Resolve UUID to name with fallback
   */
  const resolveNameWithFallback = useCallback(
    (
      entityCode: string,
      uuid: string | null | undefined,
      fallback: 'uuid' | 'empty' | 'unknown' = 'uuid'
    ): string => {
      const name = resolveRefDataSync(entityCode, uuid);
      if (name) return name;

      switch (fallback) {
        case 'uuid':
          return uuid || '';
        case 'empty':
          return '';
        case 'unknown':
          return 'Unknown';
        default:
          return uuid || '';
      }
    },
    []
  );

  /**
   * Check if entity type has cached data
   */
  const hasCachedData = useCallback(
    (entityCode: string): boolean => {
      const cache = refDataSyncCache.get(entityCode);
      return !!cache && Object.keys(cache).length > 0;
    },
    []
  );

  /**
   * Get cache size for entity type
   */
  const getCacheSize = useCallback(
    (entityCode: string): number => {
      const cache = refDataSyncCache.get(entityCode);
      return cache ? Object.keys(cache).length : 0;
    },
    []
  );

  return {
    resolveName,
    resolveNames,
    resolveNameWithFallback,
    hasCachedData,
    getCacheSize,
  };
}

/**
 * Hook to upsert ref_data from API responses
 *
 * @example
 * const upsertRefData = useRxRefDataUpsert();
 * upsertRefData(response.ref_data_entityInstance);
 */
export function useRxRefDataUpsert() {
  return useCallback(
    (refData: RefData | undefined) => {
      if (refData) {
        upsertRefDataToRxDB(refData);
      }
    },
    []
  );
}

// ============================================================================
// Clear All RefData (for logout)
// ============================================================================

export async function clearAllRefData(): Promise<void> {
  const db = await getDatabase();

  // Clear from RxDB
  const docs = await db.metadata.find({
    selector: { type: 'refdata' }
  }).exec();

  for (const doc of docs) {
    await doc.remove();
  }

  // Clear sync cache
  clearRefDataSyncCache();

  console.log('%c[RxDB RefData] 🗑️ Cleared all ref data cache', 'color: #ff6b6b');
}
