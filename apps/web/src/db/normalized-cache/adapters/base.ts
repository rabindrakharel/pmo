// ============================================================================
// Base Data Source Adapter
// ============================================================================
// Abstract base class for data source adapters
// Implements strategy pattern for cache vs API data fetching
// ============================================================================

import type {
  EntityCode,
  EntityInstance,
  EntityLink,
  DataSourceResult,
} from '../types';

// ============================================================================
// Abstract Base Adapter
// ============================================================================

export abstract class BaseDataSourceAdapter {
  protected debug: boolean;

  constructor(debug = false) {
    this.debug = debug;
  }

  protected log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      console.log(`[DataSource] ${message}`, ...args);
    }
  }

  // ========================================
  // Layer 1: Entity Codes
  // ========================================

  abstract fetchEntityCodes(): Promise<DataSourceResult<EntityCode[]>>;
  abstract getEntityCodeSync(code: string): EntityCode | null;
  abstract getAllEntityCodesSync(): EntityCode[] | null;
  abstract getChildEntityCodesSync(parentCode: string): string[];

  // ========================================
  // Layer 2: Entity Instances
  // ========================================

  abstract fetchEntityInstances(since?: number): Promise<DataSourceResult<EntityInstance[]>>;
  abstract getEntityInstancesSync(entityCode: string): EntityInstance[];
  abstract getEntityInstanceSync(entityCode: string, entityInstanceId: string): EntityInstance | null;

  // ========================================
  // Layer 3: Entity Links
  // ========================================

  abstract fetchEntityLinks(since?: number): Promise<DataSourceResult<EntityLink[]>>;
  abstract getChildIdsSync(parentCode: string, parentId: string, childCode: string): string[];
  abstract getParentsSync(childCode: string, childId: string): Array<{
    entity_code: string;
    entity_instance_id: string;
    relationship_type: string;
  }>;
  abstract getTabCountsSync(parentCode: string, parentId: string): Record<string, number>;

  // ========================================
  // Layer 4: Entity Instance Names
  // ========================================

  abstract getEntityInstanceNameSync(entityCode: string, entityInstanceId: string): string | null;
  abstract getEntityInstanceNamesForTypeSync(entityCode: string): Record<string, string>;
  abstract mergeEntityInstanceNames(data: Record<string, Record<string, string>>): void;

  // ========================================
  // Lifecycle
  // ========================================

  abstract hydrate(): Promise<void>;
  abstract prefetch(): Promise<void>;
  abstract clear(): void;

  // ========================================
  // Granular Invalidation (for WebSocket)
  // ========================================

  /**
   * Invalidate a specific entity instance
   * Called when WebSocket receives UPDATE/DELETE for specific entity_instance_id
   */
  abstract invalidateEntityInstance(entityCode: string, entityInstanceId: string): void;

  /**
   * Invalidate a specific entity type (all instances)
   * Called when WebSocket receives batch update for an entity type
   */
  abstract invalidateEntityType(entityCode: string): void;

  /**
   * Invalidate a specific link
   * Called when WebSocket receives link change
   */
  abstract invalidateLink(
    parentCode: string,
    parentId: string,
    childCode: string,
    childId?: string
  ): void;

  /**
   * Add link to cache (optimistic update)
   */
  abstract addLinkToCache(link: EntityLink): void;

  /**
   * Remove link from cache (optimistic update)
   */
  abstract removeLinkFromCache(link: EntityLink): void;

  // ========================================
  // Status
  // ========================================

  abstract isReady(): boolean;
}

// ============================================================================
// WebSocket Invalidation Types
// ============================================================================

/**
 * Granular invalidation message from WebSocket
 * Maps to system_logging + system_subscription
 */
export interface WebSocketInvalidation {
  /** Type of change */
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  /** Which infrastructure table */
  table: 'entity' | 'entity_instance' | 'entity_instance_link' | 'entity_rbac';
  /** Entity type code */
  entity_code: string;
  /** Specific entity instance ID (for granular invalidation) */
  entity_instance_id?: string;
  /** Child entity code (for links) */
  child_entity_code?: string;
  /** Child entity instance ID (for links) */
  child_entity_instance_id?: string;
  /** Relationship type (for links) */
  relationship_type?: string;
  /** Version for out-of-order handling */
  version?: number;
  /** Timestamp of the change */
  timestamp: number;
}

/**
 * Handler function for WebSocket invalidation
 */
export type InvalidationHandler = (invalidation: WebSocketInvalidation) => void;

/**
 * Create invalidation handler for a data source adapter
 */
export function createInvalidationHandler(adapter: BaseDataSourceAdapter): InvalidationHandler {
  return (invalidation: WebSocketInvalidation) => {
    const { action, table, entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type } = invalidation;

    switch (table) {
      case 'entity':
        // Entity type metadata changed (rare - admin action)
        // Typically full refresh needed
        adapter.invalidateEntityType(entity_code);
        break;

      case 'entity_instance':
        if (action === 'DELETE' && entity_instance_id) {
          // Specific instance deleted
          adapter.invalidateEntityInstance(entity_code, entity_instance_id);
        } else if (action === 'INSERT' && entity_instance_id) {
          // New instance - need to fetch it
          adapter.invalidateEntityInstance(entity_code, entity_instance_id);
        } else if (action === 'UPDATE' && entity_instance_id) {
          // Instance updated - invalidate and refetch
          adapter.invalidateEntityInstance(entity_code, entity_instance_id);
        } else {
          // Batch or unknown - invalidate entire type
          adapter.invalidateEntityType(entity_code);
        }
        break;

      case 'entity_instance_link':
        if (entity_instance_id && child_entity_code && child_entity_instance_id) {
          if (action === 'INSERT') {
            // Add link to cache optimistically
            adapter.addLinkToCache({
              id: '',
              entity_code,
              entity_instance_id,
              child_entity_code,
              child_entity_instance_id,
              relationship_type: relationship_type || 'contains',
            });
          } else if (action === 'DELETE') {
            // Remove link from cache optimistically
            adapter.removeLinkFromCache({
              id: '',
              entity_code,
              entity_instance_id,
              child_entity_code,
              child_entity_instance_id,
              relationship_type: relationship_type || 'contains',
            });
          }
          // Also invalidate the link query to ensure consistency
          adapter.invalidateLink(entity_code, entity_instance_id, child_entity_code, child_entity_instance_id);
        }
        break;

      case 'entity_rbac':
        // RBAC changes - might need to refetch visible entities
        // This is more complex - might need to refetch entity list queries
        adapter.invalidateEntityType(entity_code);
        break;
    }
  };
}
