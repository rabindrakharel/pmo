// ============================================================================
// Persistence Operations
// ============================================================================
// CRUD operations for Dexie IndexedDB
// ============================================================================

import { db } from './schema';
import type {
  GlobalSettingsRecord,
  DatalabelRecord,
  EntityCodesRecord,
  EntityInstanceNameRecord,
  EntityLinkForwardRecord,
  EntityInstanceMetadataRecord,
  EntityInstanceDataRecord,
  DraftRecord,
} from './schema';
import { DEXIE_KEYS, createQueryHash } from '../cache/keys';
import type {
  EntityCode,
  DatalabelOption,
  ViewFieldMetadata,
  EditFieldMetadata,
} from '../cache/stores';

// ============================================================================
// GLOBAL SETTINGS OPERATIONS
// ============================================================================

export async function getGlobalSettings(): Promise<Record<string, unknown> | null> {
  const record = await db.globalSettings.get(DEXIE_KEYS.globalSettings());
  return record?.settings ?? null;
}

export async function setGlobalSettings(settings: Record<string, unknown>): Promise<void> {
  await db.globalSettings.put({
    _id: DEXIE_KEYS.globalSettings(),
    settings,
    syncedAt: Date.now(),
  });
}

// ============================================================================
// DATALABEL OPERATIONS
// ============================================================================

export async function getDatalabel(key: string): Promise<DatalabelOption[] | null> {
  const normalizedKey = DEXIE_KEYS.datalabel(key);
  const record = await db.datalabel.get(normalizedKey);
  return record?.options ?? null;
}

export async function setDatalabel(key: string, options: DatalabelOption[]): Promise<void> {
  const normalizedKey = DEXIE_KEYS.datalabel(key);
  await db.datalabel.put({
    _id: normalizedKey,
    key: normalizedKey,
    options,
    syncedAt: Date.now(),
  });
}

export async function getAllDatalabels(): Promise<Record<string, DatalabelOption[]>> {
  const records = await db.datalabel.toArray();
  const result: Record<string, DatalabelOption[]> = {};
  for (const record of records) {
    result[record.key] = record.options;
  }
  return result;
}

export async function setAllDatalabels(datalabels: Array<{ name: string; options: DatalabelOption[] }>): Promise<void> {
  const now = Date.now();
  const records: DatalabelRecord[] = datalabels.map((dl) => ({
    _id: dl.name,
    key: dl.name,
    options: dl.options,
    syncedAt: now,
  }));
  await db.datalabel.bulkPut(records);
}

// ============================================================================
// ENTITY CODES OPERATIONS
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

// ============================================================================
// ENTITY INSTANCE NAMES OPERATIONS
// ============================================================================

export async function getEntityInstanceName(
  entityCode: string,
  entityInstanceId: string
): Promise<string | null> {
  const key = DEXIE_KEYS.entityInstanceName(entityCode, entityInstanceId);
  const record = await db.entityInstanceNames.get(key);
  return record?.entityInstanceName ?? null;
}

export async function setEntityInstanceName(
  entityCode: string,
  entityInstanceId: string,
  entityInstanceName: string,
  instanceCode?: string | null
): Promise<void> {
  const key = DEXIE_KEYS.entityInstanceName(entityCode, entityInstanceId);
  await db.entityInstanceNames.put({
    _id: key,
    entityCode,
    entityInstanceId,
    entityInstanceName,
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
    result[record.entityInstanceId] = record.entityInstanceName;
  }
  return result;
}

export async function setEntityInstanceNames(
  entityCode: string,
  names: Record<string, string>
): Promise<void> {
  const now = Date.now();
  const records: EntityInstanceNameRecord[] = Object.entries(names).map(([id, name]) => ({
    _id: DEXIE_KEYS.entityInstanceName(entityCode, id),
    entityCode,
    entityInstanceId: id,
    entityInstanceName: name,
    syncedAt: now,
  }));
  await db.entityInstanceNames.bulkPut(records);
}

export async function mergeEntityInstanceNames(
  data: Record<string, Record<string, string>>
): Promise<void> {
  const now = Date.now();
  const records: EntityInstanceNameRecord[] = [];

  for (const [entityCode, names] of Object.entries(data)) {
    for (const [id, name] of Object.entries(names)) {
      records.push({
        _id: DEXIE_KEYS.entityInstanceName(entityCode, id),
        entityCode,
        entityInstanceId: id,
        entityInstanceName: name,
        syncedAt: now,
      });
    }
  }

  await db.entityInstanceNames.bulkPut(records);
}

export async function deleteEntityInstanceName(
  entityCode: string,
  entityInstanceId: string
): Promise<void> {
  const key = DEXIE_KEYS.entityInstanceName(entityCode, entityInstanceId);
  await db.entityInstanceNames.delete(key);
}

// ============================================================================
// ENTITY LINKS OPERATIONS
// ============================================================================

export async function getEntityLinkChildIds(
  parentCode: string,
  parentId: string,
  childCode: string
): Promise<string[] | null> {
  const key = DEXIE_KEYS.entityLinkForward(parentCode, parentId, childCode);
  const record = await db.entityLinks.get(key);
  return record?.childIds ?? null;
}

export async function setEntityLink(
  parentCode: string,
  parentId: string,
  childCode: string,
  childIds: string[],
  relationships: Record<string, string> = {}
): Promise<void> {
  const key = DEXIE_KEYS.entityLinkForward(parentCode, parentId, childCode);
  await db.entityLinks.put({
    _id: key,
    parentCode,
    parentId,
    childCode,
    childIds,
    relationships,
    syncedAt: Date.now(),
  });
}

export async function addLinkChild(
  parentCode: string,
  parentId: string,
  childCode: string,
  childId: string,
  relationshipType: string = 'contains'
): Promise<void> {
  const key = DEXIE_KEYS.entityLinkForward(parentCode, parentId, childCode);
  const existing = await db.entityLinks.get(key);
  const now = Date.now();

  if (existing) {
    if (!existing.childIds.includes(childId)) {
      existing.childIds.push(childId);
    }
    existing.relationships[childId] = relationshipType;
    existing.syncedAt = now;
    await db.entityLinks.put(existing);
  } else {
    await db.entityLinks.put({
      _id: key,
      parentCode,
      parentId,
      childCode,
      childIds: [childId],
      relationships: { [childId]: relationshipType },
      syncedAt: now,
    });
  }
}

export async function removeLinkChild(
  parentCode: string,
  parentId: string,
  childCode: string,
  childId: string
): Promise<void> {
  const key = DEXIE_KEYS.entityLinkForward(parentCode, parentId, childCode);
  const existing = await db.entityLinks.get(key);

  if (existing) {
    existing.childIds = existing.childIds.filter((id) => id !== childId);
    delete existing.relationships[childId];

    if (existing.childIds.length === 0) {
      await db.entityLinks.delete(key);
    } else {
      existing.syncedAt = Date.now();
      await db.entityLinks.put(existing);
    }
  }
}

export async function getAllEntityLinks(): Promise<EntityLinkForwardRecord[]> {
  return await db.entityLinks.toArray();
}

// ============================================================================
// ENTITY INSTANCE METADATA OPERATIONS
// ============================================================================

export async function getEntityInstanceMetadata(
  entityCode: string
): Promise<{
  fields: string[];
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
} | null> {
  const record = await db.entityInstanceMetadata.get(entityCode);
  if (!record) return null;
  return {
    fields: record.fields,
    viewType: record.viewType,
    editType: record.editType,
  };
}

export async function setEntityInstanceMetadata(
  entityCode: string,
  metadata: {
    fields: string[];
    viewType: Record<string, ViewFieldMetadata>;
    editType: Record<string, EditFieldMetadata>;
  }
): Promise<void> {
  await db.entityInstanceMetadata.put({
    _id: entityCode,
    entityCode,
    ...metadata,
    syncedAt: Date.now(),
  });
}

// ============================================================================
// ENTITY INSTANCE DATA OPERATIONS
// ============================================================================

export async function getEntityInstanceData(
  entityCode: string,
  params: Record<string, unknown>
): Promise<{
  data: Record<string, unknown>[];
  total: number;
  syncedAt: number;
} | null> {
  const key = DEXIE_KEYS.entityInstanceData(entityCode, params);
  const record = await db.entityInstanceData.get(key);
  if (!record) return null;
  return {
    data: record.data,
    total: record.total,
    syncedAt: record.syncedAt,
  };
}

export async function setEntityInstanceData(
  entityCode: string,
  params: Record<string, unknown>,
  data: Record<string, unknown>[],
  total: number
): Promise<void> {
  const key = DEXIE_KEYS.entityInstanceData(entityCode, params);
  await db.entityInstanceData.put({
    _id: key,
    entityCode,
    queryHash: createQueryHash(params),
    params,
    data,
    total,
    syncedAt: Date.now(),
  });
}

export async function deleteEntityInstanceData(
  entityCode: string,
  params?: Record<string, unknown>
): Promise<void> {
  if (params) {
    const key = DEXIE_KEYS.entityInstanceData(entityCode, params);
    await db.entityInstanceData.delete(key);
  } else {
    // Delete all data for entity type
    await db.entityInstanceData
      .where('entityCode')
      .equals(entityCode)
      .delete();
  }
}

// ============================================================================
// DRAFT OPERATIONS
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
  data: {
    originalData: Record<string, unknown>;
    currentData: Record<string, unknown>;
    undoStack: Record<string, unknown>[];
    redoStack: Record<string, unknown>[];
  }
): Promise<void> {
  const key = DEXIE_KEYS.draft(entityCode, entityId);
  await db.draft.put({
    _id: key,
    entityCode,
    entityId,
    ...data,
    updatedAt: Date.now(),
  });
}

export async function deleteDraft(entityCode: string, entityId: string): Promise<void> {
  const key = DEXIE_KEYS.draft(entityCode, entityId);
  await db.draft.delete(key);
}

export async function getAllDrafts(): Promise<DraftRecord[]> {
  return await db.draft.toArray();
}

export async function getDraftsByEntity(entityCode: string): Promise<DraftRecord[]> {
  return await db.draft.where('entityCode').equals(entityCode).toArray();
}
