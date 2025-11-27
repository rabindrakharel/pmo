/**
 * useEntityTypes - Entity Type Definitions State
 *
 * REPLACES: entityCodeMetadataStore.ts (Zustand)
 *
 * Migration Notes:
 * - Before: Zustand store with sessionStorage persistence
 * - After: RxDB collection with replication sync
 * - Benefit: Real-time sync, offline support, multi-tab consistency
 */
import { useMemo, useCallback } from 'react';
import { useRxQuery } from './useRxQuery';
import { useRxDocument } from './useRxDocument';
import { useDatabase } from './useDatabase';
import type { EntityTypeDoc } from '../schemas/entityType.schema';

// ============================================================================
// Types (match old Zustand store)
// ============================================================================

export interface EntityCodeData {
  code: string;
  name: string;
  label: string;
  icon: string | null;
  descr?: string | null;
  child_entity_codes?: string[];
  parent_entity_codes?: string[];
  active_flag: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Get all entity types
 *
 * @example
 * const { entityTypes, getEntityByCode, isLoading } = useEntityTypes();
 * const projectEntity = getEntityByCode('project');
 */
export function useEntityTypes() {
  const { data, isLoading, error } = useRxQuery<'entity_type', EntityTypeDoc>('entity_type', {
    selector: {
      active_flag: true,
      _deleted: false
    }
  });

  // Convert to EntityCodeData format (match old API)
  const entityTypes = useMemo<EntityCodeData[]>(() => {
    return data.map(doc => ({
      code: doc.code,
      name: doc.name,
      label: doc.label,
      icon: doc.icon ?? null,
      descr: doc.descr,
      child_entity_codes: doc.child_entity_codes,
      parent_entity_codes: doc.parent_entity_codes,
      active_flag: doc.active_flag
    }));
  }, [data]);

  // Build map for O(1) lookups
  const entityTypesMap = useMemo(() => {
    const map = new Map<string, EntityCodeData>();
    entityTypes.forEach(entity => {
      map.set(entity.code, entity);
    });
    return map;
  }, [entityTypes]);

  // Get entity by code
  const getEntityByCode = useCallback((code: string): EntityCodeData | null => {
    return entityTypesMap.get(code) ?? null;
  }, [entityTypesMap]);

  // Get all entity codes
  const entityCodes = useMemo(() => {
    return entityTypes.map(e => e.code).sort();
  }, [entityTypes]);

  // Get child entity codes for a parent
  const getChildEntityCodes = useCallback((parentCode: string): string[] => {
    const entity = entityTypesMap.get(parentCode);
    return entity?.child_entity_codes ?? [];
  }, [entityTypesMap]);

  // Get parent entity codes for a child
  const getParentEntityCodes = useCallback((childCode: string): string[] => {
    const entity = entityTypesMap.get(childCode);
    return entity?.parent_entity_codes ?? [];
  }, [entityTypesMap]);

  return {
    entityTypes,
    entityTypesMap,
    entityCodes,
    isLoading,
    error,
    getEntityByCode,
    getChildEntityCodes,
    getParentEntityCodes,

    // Legacy API compatibility
    getEntityCodes: () => entityTypes,
    getEntityCodesMap: () => entityTypesMap
  };
}

/**
 * Get a single entity type by code
 *
 * @example
 * const { entityType, isLoading } = useEntityType('project');
 */
export function useEntityType(code: string | null | undefined) {
  const { data, isLoading, error } = useRxDocument<'entity_type', EntityTypeDoc>(
    'entity_type',
    code ?? undefined
  );

  const entityType = useMemo<EntityCodeData | null>(() => {
    if (!data) return null;
    return {
      code: data.code,
      name: data.name,
      label: data.label,
      icon: data.icon ?? null,
      descr: data.descr,
      child_entity_codes: data.child_entity_codes,
      parent_entity_codes: data.parent_entity_codes,
      active_flag: data.active_flag
    };
  }, [data]);

  return {
    entityType,
    isLoading,
    error
  };
}

/**
 * Bulk insert/update entity types (for initial sync)
 */
export function useEntityTypeMutations() {
  const db = useDatabase();

  const upsertEntityTypes = useCallback(async (entityTypes: EntityCodeData[]) => {
    const collection = db.entity_type;

    const docs = entityTypes.map(entity => ({
      code: entity.code,
      name: entity.name,
      label: entity.label,
      icon: entity.icon,
      descr: entity.descr,
      child_entity_codes: entity.child_entity_codes || [],
      parent_entity_codes: entity.parent_entity_codes || [],
      active_flag: entity.active_flag,
      _deleted: false
    }));

    await collection.bulkUpsert(docs);
  }, [db]);

  const clearEntityTypes = useCallback(async () => {
    const collection = db.entity_type;
    const docs = await collection.find().exec();
    for (const doc of docs) {
      await doc.remove();
    }
  }, [db]);

  return {
    upsertEntityTypes,
    clearEntityTypes
  };
}
