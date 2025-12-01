/**
 * Normalized Cache for React Query (v6.1.0)
 *
 * Stores entities by type and ID, queries reference IDs only.
 * Updates to an entity are reflected in ALL queries that reference it.
 *
 * Benefits:
 * - No stale data across views (list shows same data as detail)
 * - Efficient memory usage (entity stored once)
 * - Optimistic updates work across all views
 *
 * @example
 * // Update entity in normalized store
 * updateNormalizedEntity(queryClient, 'project', 'uuid-123', { name: 'New Name' });
 * // All queries showing this project will reflect the change
 */

import { QueryClient } from '@tanstack/react-query';

// ============================================================================
// Types
// ============================================================================

export interface NormalizedEntity {
  id: string;
  __typename: string;  // Entity type (project, task, etc.)
  [key: string]: any;
}

export interface NormalizedStore {
  entities: Record<string, Record<string, NormalizedEntity>>;  // { project: { id1: {...}, id2: {...} } }
  lastUpdated: Record<string, number>;  // Track update timestamps per entity
}

// ============================================================================
// Store Management
// ============================================================================

const STORE_KEY = '__normalizedStore';

/**
 * Get or create the normalized store from query client
 */
export function getNormalizedStore(queryClient: QueryClient): NormalizedStore {
  let store = (queryClient as any)[STORE_KEY] as NormalizedStore | undefined;

  if (!store) {
    store = {
      entities: {},
      lastUpdated: {},
    };
    (queryClient as any)[STORE_KEY] = store;
  }

  return store;
}

/**
 * Clear the normalized store (call on logout)
 */
export function clearNormalizedStore(queryClient: QueryClient): void {
  const store = getNormalizedStore(queryClient);
  store.entities = {};
  store.lastUpdated = {};
}

// ============================================================================
// Normalization Utilities
// ============================================================================

/**
 * Normalize a single entity
 */
export function normalizeEntity(entity: any, entityType: string): NormalizedEntity {
  if (!entity || !entity.id) {
    return entity;
  }

  return {
    ...entity,
    __typename: entityType,
  };
}

/**
 * Normalize a list response and store entities
 */
export function normalizeListResponse(
  queryClient: QueryClient,
  response: { data: any[]; metadata?: any; total?: number },
  entityType: string
): {
  ids: string[];
  metadata: any;
  total: number;
} {
  const store = getNormalizedStore(queryClient);
  const ids: string[] = [];

  // Initialize entity type store if needed
  if (!store.entities[entityType]) {
    store.entities[entityType] = {};
  }

  // Normalize and store each entity
  response.data.forEach(entity => {
    if (entity && entity.id) {
      const normalized = normalizeEntity(entity, entityType);
      store.entities[entityType][entity.id] = normalized;
      store.lastUpdated[`${entityType}:${entity.id}`] = Date.now();
      ids.push(entity.id);
    }
  });

  return {
    ids,
    metadata: response.metadata,
    total: response.total || response.data.length,
  };
}

/**
 * Denormalize IDs back to full entities
 */
export function denormalizeList(
  queryClient: QueryClient,
  ids: string[],
  entityType: string
): any[] {
  const store = getNormalizedStore(queryClient);
  const entityStore = store.entities[entityType] || {};

  return ids
    .map(id => entityStore[id])
    .filter(Boolean);
}

/**
 * Get a single entity from the normalized store
 */
export function getNormalizedEntity(
  queryClient: QueryClient,
  entityType: string,
  entityId: string
): NormalizedEntity | undefined {
  const store = getNormalizedStore(queryClient);
  return store.entities[entityType]?.[entityId];
}

// ============================================================================
// Update Utilities
// ============================================================================

/**
 * Update a single entity in the normalized store
 * This will be reflected in ALL queries that reference this entity
 */
export function updateNormalizedEntity(
  queryClient: QueryClient,
  entityType: string,
  entityId: string,
  updates: Partial<NormalizedEntity>
): NormalizedEntity | null {
  const store = getNormalizedStore(queryClient);

  // Initialize entity type store if needed
  if (!store.entities[entityType]) {
    store.entities[entityType] = {};
  }

  const existing = store.entities[entityType][entityId];

  if (existing) {
    // Update existing entity
    store.entities[entityType][entityId] = {
      ...existing,
      ...updates,
      __typename: entityType,
    };
  } else {
    // Create new entity
    store.entities[entityType][entityId] = {
      id: entityId,
      ...updates,
      __typename: entityType,
    };
  }

  store.lastUpdated[`${entityType}:${entityId}`] = Date.now();

  return store.entities[entityType][entityId];
}

/**
 * Remove an entity from the normalized store
 */
export function removeNormalizedEntity(
  queryClient: QueryClient,
  entityType: string,
  entityId: string
): boolean {
  const store = getNormalizedStore(queryClient);

  if (store.entities[entityType]?.[entityId]) {
    delete store.entities[entityType][entityId];
    delete store.lastUpdated[`${entityType}:${entityId}`];
    return true;
  }

  return false;
}

/**
 * Add a new entity to the normalized store
 */
export function addNormalizedEntity(
  queryClient: QueryClient,
  entityType: string,
  entity: any
): NormalizedEntity | null {
  if (!entity || !entity.id) {
    return null;
  }

  const store = getNormalizedStore(queryClient);

  // Initialize entity type store if needed
  if (!store.entities[entityType]) {
    store.entities[entityType] = {};
  }

  const normalized = normalizeEntity(entity, entityType);
  store.entities[entityType][entity.id] = normalized;
  store.lastUpdated[`${entityType}:${entity.id}`] = Date.now();

  return normalized;
}

// ============================================================================
// Query Integration Helpers
// ============================================================================

/**
 * Invalidate all queries that might contain a specific entity
 */
export function invalidateEntityQueries(
  queryClient: QueryClient,
  entityType: string,
  entityId?: string
): void {
  // Invalidate list queries for this entity type
  queryClient.invalidateQueries({
    queryKey: ['entity-instance-list', entityType],
  });

  // If specific ID provided, invalidate detail query
  if (entityId) {
    queryClient.invalidateQueries({
      queryKey: ['entity-instance', entityType, entityId],
    });
  }
}

/**
 * Get store statistics (for debugging)
 */
export function getNormalizedStoreStats(queryClient: QueryClient): {
  entityTypes: string[];
  totalEntities: number;
  entitiesPerType: Record<string, number>;
} {
  const store = getNormalizedStore(queryClient);
  const entityTypes = Object.keys(store.entities);

  const entitiesPerType: Record<string, number> = {};
  let totalEntities = 0;

  entityTypes.forEach(type => {
    const count = Object.keys(store.entities[type] || {}).length;
    entitiesPerType[type] = count;
    totalEntities += count;
  });

  return {
    entityTypes,
    totalEntities,
    entitiesPerType,
  };
}
