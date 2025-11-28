// ============================================================================
// RxDB Metadata Hooks
// ============================================================================
// Provides hooks for accessing cached metadata (datalabels, entity codes,
// global settings, component metadata) from RxDB IndexedDB storage.
//
// These hooks replace the Zustand stores for unified offline-first caching.
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { type RxDocument } from 'rxdb';
import { getDatabase, type PMODatabase } from '../database';
import {
  createMetadataId,
  isMetadataValid,
  METADATA_TTL,
  type MetadataDocType,
} from '../schemas/metadata.schema';
import { apiClient } from '../../../lib/api';

// ============================================================================
// Re-export types from Zustand stores for compatibility
// ============================================================================

/** Datalabel option structure (matches datalabelMetadataStore.ts) */
export interface DatalabelOption {
  id: number;
  name: string;
  descr?: string;
  parent_id?: number | null;
  parent_ids?: number[];
  sort_order: number;
  color_code?: string;
  active_flag?: boolean;
}

/** Entity code data structure (matches entityCodeMetadataStore.ts) */
export interface EntityCodeData {
  code: string;
  name: string;
  label: string;
  icon: string | null;
  descr?: string;
  child_entity_codes?: string[];
  parent_entity_codes?: string[];
  active_flag: boolean;
}

/** Global settings structure (matches globalSettingsMetadataStore.ts) */
export interface GlobalSettings {
  currency: {
    symbol: string;
    decimals: number;
    locale: string;
    position: string;
    thousandsSeparator: string;
    decimalSeparator: string;
  };
  date: {
    style: string;
    locale: string;
    format: string;
  };
  timestamp: {
    style: string;
    locale: string;
    includeSeconds: boolean;
  };
  boolean: {
    trueLabel: string;
    falseLabel: string;
    trueColor: string;
    falseColor: string;
    trueIcon: string;
    falseIcon: string;
  };
}

/** Component metadata structure (viewType/editType) */
export interface ComponentMetadata {
  viewType: Record<string, unknown>;
  editType: Record<string, unknown>;
}

// ============================================================================
// Internal Helper - Get or Fetch Metadata
// ============================================================================

async function getOrFetchMetadata<T>(
  db: PMODatabase,
  type: MetadataDocType['type'],
  key: string,
  fetchFn: () => Promise<T>,
): Promise<{ data: T; fromCache: boolean }> {
  const docId = createMetadataId(type, key);

  // Check cache first
  const cached = await db.metadata.findOne(docId).exec();
  if (cached && !cached._deleted && isMetadataValid(cached)) {
    console.log(
      `%c[RxDB Cache HIT] 💾 ${type}:${key}`,
      'color: #51cf66; font-weight: bold'
    );
    return { data: cached.data as T, fromCache: true };
  }

  // Fetch from server
  console.log(
    `%c[RxDB Cache MISS] 📡 Fetching ${type}:${key}`,
    'color: #fcc419; font-weight: bold'
  );

  const data = await fetchFn();

  // Store in RxDB
  await db.metadata.upsert({
    _id: docId,
    type,
    key,
    data,
    cachedAt: Date.now(),
    ttl: METADATA_TTL[type],
    _deleted: false,
  });

  return { data, fromCache: false };
}

// ============================================================================
// useRxDatalabel - Datalabel Options Hook
// ============================================================================

export interface UseRxDatalabelResult {
  options: DatalabelOption[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching datalabel options from RxDB cache
 *
 * Replaces useDatalabelMetadataStore
 *
 * @param datalabelKey - The datalabel key (e.g., 'project_stage' or 'dl__project_stage')
 * @example
 * const { options, isLoading } = useRxDatalabel('project_stage');
 */
export function useRxDatalabel(datalabelKey: string | null): UseRxDatalabelResult {
  const [options, setOptions] = useState<DatalabelOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Normalize key (remove dl__ prefix if present)
  const normalizedKey = useMemo(() => {
    if (!datalabelKey) return null;
    return datalabelKey.startsWith('dl__') ? datalabelKey.slice(4) : datalabelKey;
  }, [datalabelKey]);

  const fetchDatalabel = useCallback(async () => {
    if (!normalizedKey) {
      setOptions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const db = await getDatabase();
      const { data } = await getOrFetchMetadata<DatalabelOption[]>(
        db,
        'datalabel',
        normalizedKey,
        async () => {
          const response = await apiClient.get(`/api/v1/datalabel?name=${normalizedKey}`);
          return response.data?.data || response.data || [];
        }
      );

      setOptions(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setOptions([]);
    } finally {
      setIsLoading(false);
    }
  }, [normalizedKey]);

  // Initial fetch
  useEffect(() => {
    fetchDatalabel();
  }, [fetchDatalabel]);

  // Subscribe to RxDB changes
  useEffect(() => {
    if (!normalizedKey) return;

    let subscription: any;
    getDatabase().then(db => {
      const docId = createMetadataId('datalabel', normalizedKey);
      subscription = db.metadata.findOne(docId).$.subscribe(doc => {
        if (doc && !doc._deleted) {
          setOptions(doc.data as DatalabelOption[]);
        }
      });
    });

    return () => subscription?.unsubscribe();
  }, [normalizedKey]);

  return {
    options,
    isLoading,
    error,
    refetch: fetchDatalabel,
  };
}

// ============================================================================
// useRxAllDatalabels - All Datalabels Hook (for login prefetch)
// ============================================================================

export interface UseRxAllDatalabelsResult {
  datalabels: Record<string, DatalabelOption[]>;
  isLoading: boolean;
  error: Error | null;
  getDatalabel: (key: string) => DatalabelOption[] | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching all datalabels and storing in RxDB cache
 *
 * Call this once on login to prefetch all datalabels
 *
 * @example
 * const { datalabels, getDatalabel, isLoading } = useRxAllDatalabels();
 * const stageOptions = getDatalabel('project_stage');
 */
export function useRxAllDatalabels(): UseRxAllDatalabelsResult {
  const [datalabels, setDatalabels] = useState<Record<string, DatalabelOption[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAllDatalabels = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const db = await getDatabase();

      // Try cache first - check if we have any datalabels cached
      const cachedDocs = await db.metadata.find({
        selector: { type: { $eq: 'datalabel' }, _deleted: { $eq: false } },
      }).exec();

      const validCached = cachedDocs.filter(doc => isMetadataValid(doc));

      if (validCached.length > 0) {
        console.log(
          `%c[RxDB Cache HIT] 💾 ${validCached.length} datalabels from cache`,
          'color: #51cf66; font-weight: bold'
        );

        const result: Record<string, DatalabelOption[]> = {};
        validCached.forEach(doc => {
          result[doc.key] = doc.data as DatalabelOption[];
        });
        setDatalabels(result);
        setIsLoading(false);

        // Background refresh if any are stale
        const staleCount = cachedDocs.length - validCached.length;
        if (staleCount > 0) {
          console.log(`[RxDB] ${staleCount} stale datalabels, refreshing in background...`);
          fetchFromServer(db);
        }
        return;
      }

      // Fetch from server
      await fetchFromServer(db);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchFromServer = async (db: PMODatabase) => {
    console.log('%c[RxDB] 📡 Fetching all datalabels from server', 'color: #fcc419');

    const response = await apiClient.get('/api/v1/settings/datalabels/all');
    const datalabelList = response.data?.data || [];

    const result: Record<string, DatalabelOption[]> = {};
    const now = Date.now();

    for (const dl of datalabelList) {
      const key = dl.name;
      result[key] = dl.options || [];

      // Store in RxDB
      await db.metadata.upsert({
        _id: createMetadataId('datalabel', key),
        type: 'datalabel',
        key,
        data: dl.options || [],
        cachedAt: now,
        ttl: METADATA_TTL.datalabel,
        _deleted: false,
      });
    }

    console.log(
      `%c[RxDB] ✅ Cached ${Object.keys(result).length} datalabels`,
      'color: #51cf66'
    );

    setDatalabels(result);
  };

  // Initial fetch
  useEffect(() => {
    fetchAllDatalabels();
  }, [fetchAllDatalabels]);

  // Subscribe to RxDB changes
  useEffect(() => {
    let subscription: any;
    getDatabase().then(db => {
      subscription = db.metadata
        .find({ selector: { type: { $eq: 'datalabel' }, _deleted: { $eq: false } } })
        .$.subscribe(docs => {
          const result: Record<string, DatalabelOption[]> = {};
          docs.forEach(doc => {
            result[doc.key] = doc.data as DatalabelOption[];
          });
          setDatalabels(result);
        });
    });

    return () => subscription?.unsubscribe();
  }, []);

  const getDatalabel = useCallback(
    (key: string): DatalabelOption[] | null => {
      const normalizedKey = key.startsWith('dl__') ? key.slice(4) : key;
      return datalabels[normalizedKey] || null;
    },
    [datalabels]
  );

  return {
    datalabels,
    isLoading,
    error,
    getDatalabel,
    refetch: fetchAllDatalabels,
  };
}

// ============================================================================
// useRxEntityCodes - Entity Types Hook
// ============================================================================

export interface UseRxEntityCodesResult {
  entityCodes: EntityCodeData[];
  entityCodesMap: Map<string, EntityCodeData>;
  isLoading: boolean;
  error: Error | null;
  getEntityByCode: (code: string) => EntityCodeData | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching entity type definitions from RxDB cache
 *
 * Replaces useEntityCodeMetadataStore
 *
 * @example
 * const { entityCodes, getEntityByCode, isLoading } = useRxEntityCodes();
 * const projectEntity = getEntityByCode('project');
 */
export function useRxEntityCodes(): UseRxEntityCodesResult {
  const [entityCodes, setEntityCodes] = useState<EntityCodeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEntityCodes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const db = await getDatabase();
      const { data } = await getOrFetchMetadata<EntityCodeData[]>(
        db,
        'entity',
        'all',
        async () => {
          const response = await apiClient.get('/api/v1/entity/types');
          return Array.isArray(response.data) ? response.data : response.data?.data || [];
        }
      );

      setEntityCodes(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setEntityCodes([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchEntityCodes();
  }, [fetchEntityCodes]);

  // Subscribe to RxDB changes
  useEffect(() => {
    let subscription: any;
    getDatabase().then(db => {
      const docId = createMetadataId('entity', 'all');
      subscription = db.metadata.findOne(docId).$.subscribe(doc => {
        if (doc && !doc._deleted) {
          setEntityCodes(doc.data as EntityCodeData[]);
        }
      });
    });

    return () => subscription?.unsubscribe();
  }, []);

  // Build Map for O(1) lookups
  const entityCodesMap = useMemo(() => {
    const map = new Map<string, EntityCodeData>();
    entityCodes.forEach(entity => map.set(entity.code, entity));
    return map;
  }, [entityCodes]);

  const getEntityByCode = useCallback(
    (code: string): EntityCodeData | null => {
      return entityCodesMap.get(code) || null;
    },
    [entityCodesMap]
  );

  return {
    entityCodes,
    entityCodesMap,
    isLoading,
    error,
    getEntityByCode,
    refetch: fetchEntityCodes,
  };
}

// ============================================================================
// useRxGlobalSettings - Global Settings Hook
// ============================================================================

export interface UseRxGlobalSettingsResult {
  settings: GlobalSettings | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching global settings from RxDB cache
 *
 * Replaces useGlobalSettingsMetadataStore
 *
 * @example
 * const { settings, isLoading } = useRxGlobalSettings();
 */
export function useRxGlobalSettings(): UseRxGlobalSettingsResult {
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const db = await getDatabase();
      const { data } = await getOrFetchMetadata<GlobalSettings>(
        db,
        'settings',
        'global',
        async () => {
          const response = await apiClient.get('/api/v1/settings/global');
          return response.data;
        }
      );

      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setSettings(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Subscribe to RxDB changes
  useEffect(() => {
    let subscription: any;
    getDatabase().then(db => {
      const docId = createMetadataId('settings', 'global');
      subscription = db.metadata.findOne(docId).$.subscribe(doc => {
        if (doc && !doc._deleted) {
          setSettings(doc.data as GlobalSettings);
        }
      });
    });

    return () => subscription?.unsubscribe();
  }, []);

  return {
    settings,
    isLoading,
    error,
    refetch: fetchSettings,
  };
}

// ============================================================================
// useRxComponentMetadata - Component Metadata Hook
// ============================================================================

export interface UseRxComponentMetadataResult {
  metadata: ComponentMetadata | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook for fetching component metadata (viewType/editType) from RxDB cache
 *
 * Replaces useEntityComponentMetadataStore
 *
 * Note: Component metadata is populated by entity fetch hooks, not fetched independently.
 * This hook is for reading cached metadata.
 *
 * @example
 * const { metadata } = useRxComponentMetadata('project', 'entityDataTable');
 */
export function useRxComponentMetadata(
  entityCode: string,
  componentName: string
): UseRxComponentMetadataResult {
  const [metadata, setMetadata] = useState<ComponentMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!entityCode || !componentName) {
      setMetadata(null);
      setIsLoading(false);
      return;
    }

    const key = `${entityCode}:${componentName}`;
    let subscription: any;

    getDatabase()
      .then(db => {
        const docId = createMetadataId('component', key);
        subscription = db.metadata.findOne(docId).$.subscribe(doc => {
          if (doc && !doc._deleted && isMetadataValid(doc)) {
            setMetadata(doc.data as ComponentMetadata);
          } else {
            setMetadata(null);
          }
          setIsLoading(false);
        });
      })
      .catch(err => {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      });

    return () => subscription?.unsubscribe();
  }, [entityCode, componentName]);

  return {
    metadata,
    isLoading,
    error,
  };
}

// ============================================================================
// Utility: Cache Component Metadata
// ============================================================================

/**
 * Store component metadata in RxDB cache
 *
 * Call this after fetching entity data that includes metadata
 *
 * @example
 * cacheComponentMetadata('project', 'entityDataTable', metadata);
 */
export async function cacheComponentMetadata(
  entityCode: string,
  componentName: string,
  metadata: ComponentMetadata
): Promise<void> {
  const db = await getDatabase();
  const key = `${entityCode}:${componentName}`;

  await db.metadata.upsert({
    _id: createMetadataId('component', key),
    type: 'component',
    key,
    data: metadata,
    cachedAt: Date.now(),
    ttl: METADATA_TTL.component,
    _deleted: false,
  });

  console.log(
    `%c[RxDB] 📥 Cached component metadata: ${key}`,
    'color: #be4bdb'
  );
}

// ============================================================================
// Utility: Invalidate Metadata Cache
// ============================================================================

/**
 * Invalidate metadata cache entries
 *
 * @example
 * await invalidateMetadataCache('datalabel', 'project_stage');
 * await invalidateMetadataCache('entity'); // Invalidate all entity metadata
 */
export async function invalidateMetadataCache(
  type: MetadataDocType['type'],
  key?: string
): Promise<void> {
  const db = await getDatabase();

  if (key) {
    const docId = createMetadataId(type, key);
    const doc = await db.metadata.findOne(docId).exec();
    if (doc) {
      await doc.remove();
    }
    console.log(`%c[RxDB] 🗑️ Invalidated ${type}:${key}`, 'color: #ff6b6b');
  } else {
    // Invalidate all of this type
    const docs = await db.metadata
      .find({ selector: { type: { $eq: type } } })
      .exec();
    for (const doc of docs) {
      await doc.remove();
    }
    console.log(`%c[RxDB] 🗑️ Invalidated all ${type} metadata`, 'color: #ff6b6b');
  }
}

// ============================================================================
// Utility: Clear All Metadata Cache
// ============================================================================

/**
 * Clear all metadata from RxDB cache
 *
 * Use on logout or when cache needs to be reset
 */
export async function clearAllMetadataCache(): Promise<void> {
  const db = await getDatabase();
  const docs = await db.metadata.find().exec();
  for (const doc of docs) {
    await doc.remove();
  }
  console.log('%c[RxDB] 🗑️ Cleared all metadata cache', 'color: #ff6b6b');
}

// ============================================================================
// Sync Helper: Prefetch All Metadata (Login Flow)
// ============================================================================

/**
 * Prefetch all metadata after login
 *
 * Call this from AuthContext after successful login
 */
export async function prefetchAllMetadata(): Promise<void> {
  console.log('%c[RxDB] 🔄 Prefetching all metadata...', 'color: #74c0fc');

  const db = await getDatabase();
  const now = Date.now();

  try {
    // 1. Fetch all datalabels
    const datalabelsResponse = await apiClient.get('/api/v1/settings/datalabels/all');
    const datalabelList = datalabelsResponse.data?.data || [];

    for (const dl of datalabelList) {
      await db.metadata.upsert({
        _id: createMetadataId('datalabel', dl.name),
        type: 'datalabel',
        key: dl.name,
        data: dl.options || [],
        cachedAt: now,
        ttl: METADATA_TTL.datalabel,
        _deleted: false,
      });
    }
    console.log(`[RxDB] ✅ Cached ${datalabelList.length} datalabels`);

    // 2. Fetch entity codes
    const entityCodesResponse = await apiClient.get('/api/v1/entity/types');
    const entityCodes = Array.isArray(entityCodesResponse.data)
      ? entityCodesResponse.data
      : entityCodesResponse.data?.data || [];

    await db.metadata.upsert({
      _id: createMetadataId('entity', 'all'),
      type: 'entity',
      key: 'all',
      data: entityCodes,
      cachedAt: now,
      ttl: METADATA_TTL.entity,
      _deleted: false,
    });
    console.log(`[RxDB] ✅ Cached ${entityCodes.length} entity codes`);

    // 3. Fetch global settings
    const settingsResponse = await apiClient.get('/api/v1/settings/global');
    await db.metadata.upsert({
      _id: createMetadataId('settings', 'global'),
      type: 'settings',
      key: 'global',
      data: settingsResponse.data,
      cachedAt: now,
      ttl: METADATA_TTL.settings,
      _deleted: false,
    });
    console.log('[RxDB] ✅ Cached global settings');

    console.log('%c[RxDB] ✅ All metadata prefetch complete', 'color: #51cf66; font-weight: bold');
  } catch (error) {
    console.error('[RxDB] ❌ Metadata prefetch failed:', error);
    throw error;
  }
}
