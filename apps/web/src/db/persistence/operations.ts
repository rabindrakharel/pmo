// ============================================================================
// Dexie CRUD Operations
// ============================================================================
// Type-safe operations for each store with timestamp management
// ============================================================================

import { db } from './schema';
import type {
  DatalabelRecord,
  EntityInstanceNameRecord,
  EntityLinkForwardRecord,
  EntityLinkReverseRecord,
  EntityInstanceDataRecord,
  DraftRecord,
} from './schema';
import type {
  GlobalSettings,
  DatalabelOption,
  EntityCode,
  EntityInstanceMetadata,
  ViewFieldMetadata,
  EditFieldMetadata,
  Draft,
} from '../cache/types';
import { DEXIE_KEYS, createQueryHash } from '../cache/keys';

// ============================================================================
// Global Settings Operations
// ============================================================================

export async function getGlobalSettings(): Promise<GlobalSettings | null> {
  const record = await db.globalSettings.get(DEXIE_KEYS.globalSettings());
  return record?.settings ?? null;
}

export async function setGlobalSettings(settings: GlobalSettings): Promise<void> {
  await db.globalSettings.put({
    _id: DEXIE_KEYS.globalSettings(),
    settings,
    syncedAt: Date.now(),
  });
}

export async function clearGlobalSettings(): Promise<void> {
  await db.globalSettings.clear();
}

// ============================================================================
// Datalabel Operations
// ============================================================================

export async function getDatalabel(key: string): Promise<DatalabelOption[] | null> {
  const normalizedKey = DEXIE_KEYS.datalabel(key);
  const record = await db.datalabel.get(normalizedKey);
  return record?.options ?? null;
}

export async function setDatalabel(
  key: string,
  options: DatalabelOption[]
): Promise<void> {
  const normalizedKey = DEXIE_KEYS.datalabel(key);
  await db.datalabel.put({
    _id: normalizedKey,
    key: normalizedKey,
    options,
    syncedAt: Date.now(),
  });
}

export async function getAllDatalabels(): Promise<DatalabelRecord[]> {
  return db.datalabel.toArray();
}

export async function clearDatalabel(key?: string): Promise<void> {
  if (key) {
    await db.datalabel.delete(DEXIE_KEYS.datalabel(key));
  } else {
    await db.datalabel.clear();
  }
}

// ============================================================================
// Entity Codes Operations
// ============================================================================

export async function getEntityCodes(): Promise<EntityCode[] | null> {
  const record = await db.entityCodes.get(DEXIE_KEYS.entityCodes());
  return record?.codes ?? null;
}

export async function setEntityCodes(codes: EntityCode[]): Promise<void> {
  await db.entityCodes.put({
    _id: DEXIE_KEYS.entityCodes(),
    codes,
    syncedAt: Date.now(),
  });
}

export async function clearEntityCodes(): Promise<void> {
  await db.entityCodes.clear();
}

// ============================================================================
// Entity Instance Names Operations
// ============================================================================

export async function getEntityInstanceName(
  entityCode: string,
  entityInstanceId: string
): Promise<string | null> {
  const key = DEXIE_KEYS.entityInstanceName(entityCode, entityInstanceId);
  const record = await db.entityInstanceNames.get(key);
  return record?.name ?? null;
}

export async function setEntityInstanceName(
  entityCode: string,
  entityInstanceId: string,
  name: string,
  instanceCode?: string | null
): Promise<void> {
  const key = DEXIE_KEYS.entityInstanceName(entityCode, entityInstanceId);
  await db.entityInstanceNames.put({
    _id: key,
    entityCode,
    entityInstanceId,
    name,
    instanceCode,
    syncedAt: Date.now(),
  });
}

export async function getEntityInstanceNamesForType(
  entityCode: string
): Promise<Record<string, string>> {
  const records = await db.entityInstanceNames
    .where('entityCode')
    .equals(entityCode)
    .toArray();

  const result: Record<string, string> = {};
  for (const record of records) {
    result[record.entityInstanceId] = record.name;
  }
  return result;
}

export async function bulkSetEntityInstanceNames(
  entityCode: string,
  names: Record<string, string>
): Promise<void> {
  const now = Date.now();
  const records: EntityInstanceNameRecord[] = Object.entries(names).map(
    ([entityInstanceId, name]) => ({
      _id: DEXIE_KEYS.entityInstanceName(entityCode, entityInstanceId),
      entityCode,
      entityInstanceId,
      name,
      syncedAt: now,
    })
  );
  await db.entityInstanceNames.bulkPut(records);
}

export async function clearEntityInstanceNames(entityCode?: string): Promise<void> {
  if (entityCode) {
    await db.entityInstanceNames.where('entityCode').equals(entityCode).delete();
  } else {
    await db.entityInstanceNames.clear();
  }
}

// Convenience alias
export const setEntityInstance = setEntityInstanceName;

// ============================================================================
// Entity Link Operations
// ============================================================================

export async function getEntityLinkForward(
  parentCode: string,
  parentId: string,
  childCode: string
): Promise<EntityLinkForwardRecord | null> {
  const key = DEXIE_KEYS.entityLinkForward(parentCode, parentId, childCode);
  return (await db.entityLinkForward.get(key)) ?? null;
}

export async function setEntityLinkForward(
  record: Omit<EntityLinkForwardRecord, '_id' | 'syncedAt'>
): Promise<void> {
  const key = DEXIE_KEYS.entityLinkForward(
    record.parentCode,
    record.parentId,
    record.childCode
  );
  await db.entityLinkForward.put({
    ...record,
    _id: key,
    syncedAt: Date.now(),
  });
}

export async function getEntityLinkReverse(
  childCode: string,
  childId: string
): Promise<EntityLinkReverseRecord | null> {
  const key = DEXIE_KEYS.entityLinkReverse(childCode, childId);
  return (await db.entityLinkReverse.get(key)) ?? null;
}

export async function setEntityLinkReverse(
  record: Omit<EntityLinkReverseRecord, '_id' | 'syncedAt'>
): Promise<void> {
  const key = DEXIE_KEYS.entityLinkReverse(record.childCode, record.childId);
  await db.entityLinkReverse.put({
    ...record,
    _id: key,
    syncedAt: Date.now(),
  });
}

export async function clearEntityLinks(): Promise<void> {
  await Promise.all([
    db.entityLinkForward.clear(),
    db.entityLinkReverse.clear(),
  ]);
}

// ============================================================================
// Entity Instance Metadata Operations
// ============================================================================

export interface EntityInstanceMetadataWithTimestamp {
  _id: string;
  entityCode: string;
  fields: string[];
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
  syncedAt: number;
}

export async function getEntityInstanceMetadata(
  entityCode: string,
  component: string = 'entityListOfInstancesTable'
): Promise<EntityInstanceMetadataWithTimestamp | null> {
  const record = await db.entityInstanceMetadata.get(
    DEXIE_KEYS.entityInstanceMetadata(entityCode, component)
  );
  if (!record) return null;
  return {
    _id: record._id,
    entityCode: record.entityCode,
    fields: record.metadata?.fields ?? [],
    viewType: record.metadata?.viewType ?? {},
    editType: record.metadata?.editType ?? {},
    syncedAt: record.syncedAt,
  };
}

export async function setEntityInstanceMetadata(
  entityCode: string,
  component: string,
  fields: string[],
  viewType: Record<string, ViewFieldMetadata>,
  editType: Record<string, EditFieldMetadata>
): Promise<void> {
  await db.entityInstanceMetadata.put({
    _id: DEXIE_KEYS.entityInstanceMetadata(entityCode, component),
    entityCode,
    metadata: { fields, viewType, editType },
    syncedAt: Date.now(),
  });
}

export async function clearEntityInstanceMetadata(
  entityCode?: string,
  component?: string
): Promise<void> {
  if (entityCode && component) {
    await db.entityInstanceMetadata.delete(
      DEXIE_KEYS.entityInstanceMetadata(entityCode, component)
    );
  } else if (entityCode) {
    // Clear all components for this entity
    const records = await db.entityInstanceMetadata
      .where('entityCode')
      .equals(entityCode)
      .toArray();
    await db.entityInstanceMetadata.bulkDelete(records.map(r => r._id));
  } else {
    await db.entityInstanceMetadata.clear();
  }
}

// ============================================================================
// Entity Instance Data Operations
// ============================================================================

export async function getEntityInstanceData(
  entityCode: string,
  params: Record<string, unknown>
): Promise<EntityInstanceDataRecord | null> {
  const key = DEXIE_KEYS.entityInstanceData(entityCode, params);
  return (await db.entityInstanceData.get(key)) ?? null;
}

export async function setEntityInstanceData(
  entityCode: string,
  params: Record<string, unknown>,
  data: Record<string, unknown>[],
  total: number,
  metadata?: EntityInstanceMetadata,
  refData?: Record<string, Record<string, string>>
): Promise<void> {
  const key = DEXIE_KEYS.entityInstanceData(entityCode, params);
  await db.entityInstanceData.put({
    _id: key,
    entityCode,
    queryHash: createQueryHash(params),
    params,
    data,
    total,
    metadata,
    refData,
    syncedAt: Date.now(),
  });
}

export async function clearEntityInstanceData(entityCode?: string): Promise<void> {
  if (entityCode) {
    await db.entityInstanceData.where('entityCode').equals(entityCode).delete();
  } else {
    await db.entityInstanceData.clear();
  }
}

export async function clearStaleEntityInstanceData(maxAgeMs: number): Promise<number> {
  const cutoff = Date.now() - maxAgeMs;
  const count = await db.entityInstanceData
    .where('syncedAt')
    .below(cutoff)
    .count();
  await db.entityInstanceData.where('syncedAt').below(cutoff).delete();
  return count;
}

/**
 * Update a single item in ALL cached entity instance data records for an entity type
 * Used for optimistic updates to keep Dexie in sync with TanStack Query
 *
 * @param entityCode - Entity type code (e.g., 'project')
 * @param entityId - ID of the entity to update
 * @param updater - Function to update the item
 * @returns Number of cache entries updated
 */
export async function updateEntityInstanceDataItem<T extends { id: string }>(
  entityCode: string,
  entityId: string,
  updater: (item: T) => T
): Promise<number> {
  // Get all cached data for this entity type
  const records = await db.entityInstanceData
    .where('entityCode')
    .equals(entityCode)
    .toArray();

  let updatedCount = 0;

  for (const record of records) {
    const data = record.data as T[];
    const index = data.findIndex((item) => item.id === entityId);

    if (index !== -1) {
      // Update the item
      const updatedData = [...data];
      updatedData[index] = updater(data[index]);

      // Write back to Dexie
      await db.entityInstanceData.put({
        ...record,
        data: updatedData,
        syncedAt: Date.now(),
      });
      updatedCount++;
    }
  }

  return updatedCount;
}

/**
 * Delete a single item from ALL cached entity instance data records for an entity type
 * Used for optimistic deletes to keep Dexie in sync with TanStack Query
 *
 * @param entityCode - Entity type code (e.g., 'project')
 * @param entityId - ID of the entity to delete
 * @returns Number of cache entries updated
 */
export async function deleteEntityInstanceDataItem(
  entityCode: string,
  entityId: string
): Promise<number> {
  // Get all cached data for this entity type
  const records = await db.entityInstanceData
    .where('entityCode')
    .equals(entityCode)
    .toArray();

  let updatedCount = 0;

  for (const record of records) {
    const data = record.data as Array<{ id: string }>;
    const filteredData = data.filter((item) => item.id !== entityId);

    if (filteredData.length !== data.length) {
      // Item was removed, write back to Dexie
      await db.entityInstanceData.put({
        ...record,
        data: filteredData,
        total: Math.max(0, (record.total || 0) - 1),
        syncedAt: Date.now(),
      });
      updatedCount++;
    }
  }

  return updatedCount;
}

/**
 * Add a new item to ALL cached entity instance data records for an entity type
 * Used for optimistic creates to keep Dexie in sync with TanStack Query
 *
 * @param entityCode - Entity type code (e.g., 'project')
 * @param newItem - The new item to add
 * @param prepend - Whether to add at the beginning (default: true)
 * @returns Number of cache entries updated
 */
export async function addEntityInstanceDataItem<T extends { id: string }>(
  entityCode: string,
  newItem: T,
  prepend: boolean = true
): Promise<number> {
  // Get all cached data for this entity type
  const records = await db.entityInstanceData
    .where('entityCode')
    .equals(entityCode)
    .toArray();

  let updatedCount = 0;

  for (const record of records) {
    const data = record.data as T[];

    // Add the item
    const updatedData = prepend ? [newItem, ...data] : [...data, newItem];

    // Write back to Dexie
    await db.entityInstanceData.put({
      ...record,
      data: updatedData,
      total: (record.total || 0) + 1,
      syncedAt: Date.now(),
    });
    updatedCount++;
  }

  return updatedCount;
}

/**
 * Replace a temp item with a real item in ALL cached entity instance data records
 * Used after optimistic create when server returns the real entity with ID
 *
 * @param entityCode - Entity type code
 * @param tempId - Temporary ID to replace
 * @param realItem - The real item from server
 * @returns Number of cache entries updated
 */
export async function replaceEntityInstanceDataItem<T extends { id: string }>(
  entityCode: string,
  tempId: string,
  realItem: T
): Promise<number> {
  return updateEntityInstanceDataItem<T>(entityCode, tempId, () => realItem);
}

// ============================================================================
// Draft Operations
// ============================================================================

export async function getDraft(
  entityCode: string,
  entityId: string
): Promise<DraftRecord | null> {
  const key = DEXIE_KEYS.draft(entityCode, entityId);
  return (await db.draft.get(key)) ?? null;
}

export async function setDraft(
  entityCode: string,
  entityId: string,
  draft: Omit<Draft, 'entityCode' | 'entityId' | 'updatedAt'>
): Promise<void> {
  const key = DEXIE_KEYS.draft(entityCode, entityId);
  await db.draft.put({
    _id: key,
    entityCode,
    entityId,
    ...draft,
    updatedAt: Date.now(),
  });
}

export async function updateDraft(
  entityCode: string,
  entityId: string,
  updates: Partial<Omit<Draft, 'entityCode' | 'entityId' | 'updatedAt'>>
): Promise<void> {
  const key = DEXIE_KEYS.draft(entityCode, entityId);
  const existing = await db.draft.get(key);
  if (existing) {
    await db.draft.put({
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    });
  }
}

export async function deleteDraft(
  entityCode: string,
  entityId: string
): Promise<void> {
  const key = DEXIE_KEYS.draft(entityCode, entityId);
  await db.draft.delete(key);
}

export async function getAllDrafts(): Promise<DraftRecord[]> {
  return db.draft.toArray();
}

export async function getDraftsForEntity(entityCode: string): Promise<DraftRecord[]> {
  return db.draft.where('entityCode').equals(entityCode).toArray();
}

// Note: Drafts survive logout, so we provide a separate clear method
export async function clearDrafts(): Promise<void> {
  await db.draft.clear();
}

// ============================================================================
// Bulk Clear Operations
// ============================================================================

/**
 * Clear all stores except drafts (for logout)
 */
export async function clearAllExceptDrafts(): Promise<void> {
  await Promise.all([
    db.globalSettings.clear(),
    db.datalabel.clear(),
    db.entityCodes.clear(),
    db.entityInstanceNames.clear(),
    db.entityLinkForward.clear(),
    db.entityLinkReverse.clear(),
    db.entityInstanceMetadata.clear(),
    db.entityInstanceData.clear(),
    // Note: draft is NOT cleared
  ]);
}

/**
 * Clear all stores including drafts (for complete reset)
 */
export async function clearAllStores(): Promise<void> {
  await Promise.all([
    db.globalSettings.clear(),
    db.datalabel.clear(),
    db.entityCodes.clear(),
    db.entityInstanceNames.clear(),
    db.entityLinkForward.clear(),
    db.entityLinkReverse.clear(),
    db.entityInstanceMetadata.clear(),
    db.entityInstanceData.clear(),
    db.draft.clear(),
  ]);
}

/**
 * Clear stale data older than maxAge
 */
export async function clearStaleData(maxAgeMs: number = 30 * 60 * 1000): Promise<number> {
  const cutoff = Date.now() - maxAgeMs;
  let count = 0;

  // Clear stale entity instance data
  const staleData = await db.entityInstanceData
    .where('syncedAt')
    .below(cutoff)
    .count();
  await db.entityInstanceData.where('syncedAt').below(cutoff).delete();
  count += staleData;

  // Clear stale datalabels
  const staleDatalabels = await db.datalabel
    .filter((d) => d.syncedAt < cutoff)
    .count();
  await db.datalabel.filter((d) => d.syncedAt < cutoff).delete();
  count += staleDatalabels;

  return count;
}
