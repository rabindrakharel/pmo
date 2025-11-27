// ============================================================================
// Auto-Subscribe Hook - Automatic Entity Subscription Management
// ============================================================================
// Subscribes to entity updates when component mounts, unsubscribes on unmount
// Tracks changes in entityIds to subscribe/unsubscribe incrementally
// ============================================================================

import { useEffect, useRef } from 'react';
import { useSync } from './SyncProvider';

/**
 * Hook that automatically manages subscriptions for a set of entity IDs.
 *
 * Features:
 * - Subscribes to new IDs when they appear
 * - Unsubscribes from removed IDs when they disappear
 * - Full cleanup on component unmount
 *
 * @param entityCode - The entity type code (e.g., 'project', 'task')
 * @param entityIds - Array of entity UUIDs to subscribe to
 *
 * @example
 * // In a list component
 * const { data } = useEntityInstanceList('project', params);
 * const entityIds = data?.data?.map(item => item.id) || [];
 * useAutoSubscribe('project', entityIds);
 *
 * @example
 * // In a detail component
 * const { data } = useEntityInstance('project', projectId);
 * useAutoSubscribe('project', projectId ? [projectId] : []);
 */
export function useAutoSubscribe(entityCode: string, entityIds: string[]): void {
  const { subscribe, unsubscribe } = useSync();
  const previousIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Skip if no entity code
    if (!entityCode) return;

    const currentIds = new Set(entityIds);
    const previousIds = previousIdsRef.current;

    // Find new IDs to subscribe (in current but not in previous)
    const newIds = entityIds.filter(id => !previousIds.has(id));

    // Find removed IDs to unsubscribe (in previous but not in current)
    const removedIds = [...previousIds].filter(id => !currentIds.has(id));

    // Subscribe to new entities
    if (newIds.length > 0) {
      console.log(
        `%c[AutoSubscribe] Subscribing to ${entityCode}: ${newIds.length} new entities`,
        'color: #339af0; font-weight: bold'
      );
      subscribe(entityCode, newIds);
    }

    // Unsubscribe from removed entities
    if (removedIds.length > 0) {
      console.log(
        `%c[AutoSubscribe] Unsubscribing from ${entityCode}: ${removedIds.length} removed entities`,
        'color: #fd7e14; font-weight: bold'
      );
      unsubscribe(entityCode, removedIds);
    }

    // Update the ref for next comparison
    previousIdsRef.current = currentIds;

    // Cleanup on unmount - unsubscribe from all
    return () => {
      if (currentIds.size > 0) {
        console.log(
          `%c[AutoSubscribe] Cleanup: unsubscribing from ${entityCode}: ${currentIds.size} entities`,
          'color: #fd7e14; font-weight: bold'
        );
        unsubscribe(entityCode, [...currentIds]);
      }
    };
  }, [entityCode, entityIds, subscribe, unsubscribe]);
}

/**
 * Hook that subscribes to a single entity.
 * Convenience wrapper around useAutoSubscribe.
 *
 * @param entityCode - The entity type code
 * @param entityId - Single entity UUID (or undefined/null)
 *
 * @example
 * useAutoSubscribeSingle('project', projectId);
 */
export function useAutoSubscribeSingle(
  entityCode: string,
  entityId: string | undefined | null
): void {
  const entityIds = entityId ? [entityId] : [];
  useAutoSubscribe(entityCode, entityIds);
}
