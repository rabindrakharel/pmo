// ============================================================================
// Invalidation Handlers
// ============================================================================
// Handle cache invalidation events from WebSocket
// ============================================================================

import type { QueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '../cache/keys';
import {
  entityLinksStore,
  entityInstanceNamesStore,
  entityInstanceMetadataStore,
} from '../cache/stores';
import { db } from '../persistence/schema';
import {
  deleteEntityInstanceData,
  deleteEntityInstanceName,
  addLinkChild,
  removeLinkChild,
} from '../persistence/operations';
import type { NormalizedInvalidatePayload } from './manager';

// ============================================================================
// TYPES
// ============================================================================

export interface EntityChangeEvent {
  entityCode: string;
  entityId: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
}

export interface LinkChangeEvent {
  action: 'INSERT' | 'DELETE';
  parentCode: string;
  parentId: string;
  childCode: string;
  childId: string;
  relationshipType: string;
}

export interface InvalidationHandler {
  onEntityChange(event: EntityChangeEvent): void;
  onNormalizedChange(payload: NormalizedInvalidatePayload): void;
  onLinkChange(event: LinkChangeEvent): void;
}

// ============================================================================
// CREATE INVALIDATION HANDLER
// ============================================================================

/**
 * Create an invalidation handler bound to a QueryClient
 *
 * @param queryClient - TanStack Query client for cache invalidation
 */
export function createInvalidationHandler(queryClient: QueryClient): InvalidationHandler {
  return {
    /**
     * Handle entity data changes (INSERT, UPDATE, DELETE)
     */
    onEntityChange(event: EntityChangeEvent): void {
      const { entityCode, entityId, action } = event;

      if (action === 'DELETE') {
        // Remove from TanStack Query cache
        queryClient.removeQueries({
          queryKey: QUERY_KEYS.entity(entityCode, entityId),
        });

        // Remove from Dexie
        deleteEntityInstanceName(entityCode, entityId).catch(() => {
          // May not exist
        });

        // Remove from sync store
        entityInstanceNamesStore.clearType(entityCode);
      }

      // Invalidate entity instance data (list queries)
      queryClient.invalidateQueries({
        queryKey: ['entityInstanceData', entityCode],
        refetchType: 'active',
      });

      // Clear from Dexie to prevent stale hydration
      deleteEntityInstanceData(entityCode).catch((error) => {
        console.warn(`[Invalidation] Failed to clear Dexie cache for ${entityCode}:`, error);
      });

      // Invalidate single entity query if UPDATE
      if (action === 'UPDATE') {
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.entity(entityCode, entityId),
          refetchType: 'active',
        });
      }
    },

    /**
     * Handle normalized cache table changes
     */
    onNormalizedChange(payload: NormalizedInvalidatePayload): void {
      const { table, action, entity_code, entity_instance_id } = payload;

      switch (table) {
        case 'entity':
          // Entity type definitions changed
          queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.entityCodes,
            refetchType: 'active',
          });
          break;

        case 'entity_instance':
          if (entity_code && entity_instance_id) {
            if (action === 'DELETE') {
              // Remove from sync store
              entityInstanceNamesStore.clearType(entity_code);

              // Remove from Dexie
              deleteEntityInstanceName(entity_code, entity_instance_id).catch(() => {
                // May not exist
              });
            }

            // Invalidate name lookup queries
            queryClient.invalidateQueries({
              queryKey: QUERY_KEYS.entityInstanceNames(entity_code),
              refetchType: 'active',
            });
          }
          break;

        case 'entity_instance_link':
          // Link graph changed - invalidate all link queries
          queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.entityLinks,
            refetchType: 'active',
          });
          break;
      }
    },

    /**
     * Handle link changes (parent-child relationships)
     */
    onLinkChange(event: LinkChangeEvent): void {
      const { action, parentCode, parentId, childCode, childId, relationshipType } = event;

      if (action === 'INSERT') {
        // Update sync store (optimistic)
        entityLinksStore.addLink(parentCode, parentId, childCode, childId, relationshipType);

        // Update Dexie
        addLinkChild(parentCode, parentId, childCode, childId, relationshipType).catch((error) => {
          console.warn('[Invalidation] Failed to add link to Dexie:', error);
        });
      } else if (action === 'DELETE') {
        // Update sync store (optimistic)
        entityLinksStore.removeLink(parentCode, parentId, childCode, childId);

        // Update Dexie
        removeLinkChild(parentCode, parentId, childCode, childId).catch((error) => {
          console.warn('[Invalidation] Failed to remove link from Dexie:', error);
        });
      }

      // Invalidate link queries to ensure consistency
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.entityLinks,
        refetchType: 'active',
      });
    },
  };
}

// ============================================================================
// MANUAL INVALIDATION FUNCTIONS
// ============================================================================

/**
 * Manually invalidate entity instance data
 *
 * @param queryClient - TanStack Query client
 * @param entityCode - Entity type code
 * @param entityId - Optional entity instance ID (if provided, also invalidates single entity)
 */
export async function invalidateEntityData(
  queryClient: QueryClient,
  entityCode: string,
  entityId?: string
): Promise<void> {
  // Invalidate list queries
  queryClient.invalidateQueries({
    queryKey: ['entityInstanceData', entityCode],
    refetchType: 'active',
  });

  // Invalidate single entity query
  if (entityId) {
    queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.entity(entityCode, entityId),
      refetchType: 'active',
    });
  }

  // Clear from Dexie
  await deleteEntityInstanceData(entityCode);
}

/**
 * Manually invalidate metadata cache
 *
 * @param queryClient - TanStack Query client
 * @param type - Type of metadata to invalidate
 * @param key - Optional key for specific item
 */
export async function invalidateMetadataCache(
  queryClient: QueryClient,
  type: 'datalabel' | 'entityCodes' | 'globalSettings' | 'entityInstanceMetadata',
  key?: string
): Promise<void> {
  switch (type) {
    case 'datalabel':
      if (key) {
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.datalabel(key),
          refetchType: 'active',
        });
        await db.datalabel.delete(key);
      } else {
        queryClient.invalidateQueries({
          queryKey: ['datalabel'],
          refetchType: 'active',
        });
        await db.datalabel.clear();
      }
      break;

    case 'entityCodes':
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.entityCodes,
        refetchType: 'active',
      });
      await db.entityCodes.clear();
      break;

    case 'globalSettings':
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.globalSettings,
        refetchType: 'active',
      });
      await db.globalSettings.clear();
      break;

    case 'entityInstanceMetadata':
      if (key) {
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.entityInstanceMetadata(key),
          refetchType: 'active',
        });
        await db.entityInstanceMetadata.delete(key);
        entityInstanceMetadataStore.clear();
      } else {
        queryClient.invalidateQueries({
          queryKey: ['entityInstanceMetadata'],
          refetchType: 'active',
        });
        await db.entityInstanceMetadata.clear();
        entityInstanceMetadataStore.clear();
      }
      break;
  }

  console.log(
    `%c[Invalidation] Metadata cache invalidated: ${type}${key ? `:${key}` : ''}`,
    'color: #ff6b6b'
  );
}

/**
 * Clear all caches (for logout)
 *
 * @param queryClient - TanStack Query client
 */
export async function clearAllCaches(queryClient: QueryClient): Promise<void> {
  // Clear TanStack Query cache
  queryClient.clear();

  // Clear Dexie (except drafts)
  await Promise.all([
    db.globalSettings.clear(),
    db.datalabel.clear(),
    db.entityCodes.clear(),
    db.entityInstanceNames.clear(),
    db.entityLinks.clear(),
    db.entityInstanceMetadata.clear(),
    db.entityInstanceData.clear(),
  ]);

  console.log('[Invalidation] All caches cleared');
}
