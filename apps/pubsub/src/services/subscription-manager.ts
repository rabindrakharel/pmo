// ============================================================================
// PubSub Service - Subscription Manager
// ============================================================================
// Manages entity subscriptions in PostgreSQL database
// ============================================================================

import type { Database } from '../db.js';
import type { Subscriber } from '../types.js';

export class SubscriptionManager {
  constructor(private db: Database) {}

  /**
   * Subscribe a user to multiple entities of the same type
   * Uses upsert to handle re-subscription gracefully
   */
  async subscribe(
    userId: string,
    connectionId: string,
    entityCode: string,
    entityIds: string[]
  ): Promise<number> {
    if (entityIds.length === 0) return 0;

    // Build array literal for PostgreSQL
    const entityIdsArray = entityIds.map(id => `'${id}'::uuid`).join(',');

    const result = await this.db.execute(`
      SELECT app.bulk_subscribe(
        $1::uuid,
        $2,
        $3,
        ARRAY[${entityIdsArray}]
      ) as count
    `, [userId, connectionId, entityCode]);

    const count = (result[0] as { count: number })?.count ?? 0;
    console.log(`[SubscriptionManager] Subscribed: user=${userId.slice(0, 8)}... entity=${entityCode} count=${count}`);

    return count;
  }

  /**
   * Unsubscribe a user from specific entities or all entities of a type
   */
  async unsubscribe(
    userId: string,
    entityCode: string,
    entityIds?: string[]
  ): Promise<number> {
    let query: string;
    let params: unknown[];

    if (entityIds && entityIds.length > 0) {
      const entityIdsArray = entityIds.map(id => `'${id}'::uuid`).join(',');
      query = `
        DELETE FROM app.system_cache_subscription
        WHERE user_id = $1::uuid
          AND entity_code = $2
          AND entity_id = ANY(ARRAY[${entityIdsArray}])
      `;
      params = [userId, entityCode];
    } else {
      query = `
        DELETE FROM app.system_cache_subscription
        WHERE user_id = $1::uuid
          AND entity_code = $2
      `;
      params = [userId, entityCode];
    }

    const result = await this.db.executeWithCount(query, params);
    console.log(`[SubscriptionManager] Unsubscribed: user=${userId.slice(0, 8)}... entity=${entityCode} count=${result.rowCount}`);

    return result.rowCount;
  }

  /**
   * Unsubscribe a user from all entities
   */
  async unsubscribeAll(userId: string): Promise<number> {
    const result = await this.db.executeWithCount(`
      DELETE FROM app.system_cache_subscription
      WHERE user_id = $1::uuid
    `, [userId]);

    console.log(`[SubscriptionManager] UnsubscribeAll: user=${userId.slice(0, 8)}... count=${result.rowCount}`);

    return result.rowCount;
  }

  /**
   * Remove all subscriptions for a specific connection (on disconnect)
   */
  async cleanupConnection(connectionId: string): Promise<number> {
    const result = await this.db.executeWithCount(`
      DELETE FROM app.system_cache_subscription
      WHERE connection_id = $1
    `, [connectionId]);

    if (result.rowCount > 0) {
      console.log(`[SubscriptionManager] Cleanup: conn=${connectionId.slice(0, 8)}... count=${result.rowCount}`);
    }

    return result.rowCount;
  }

  /**
   * Get all subscribers for a batch of entities (used by LogWatcher)
   * Returns subscribers grouped by connection
   */
  async getBatchSubscribers(
    entityCode: string,
    entityIds: string[]
  ): Promise<Subscriber[]> {
    if (entityIds.length === 0) return [];

    const entityIdsArray = entityIds.map(id => `'${id}'::uuid`).join(',');

    const result = await this.db.execute<{
      user_id: string;
      connection_id: string;
      subscribed_entity_ids: string[];
    }>(`
      SELECT * FROM app.get_batch_subscribers(
        $1,
        ARRAY[${entityIdsArray}]
      )
    `, [entityCode]);

    return result.map(row => ({
      userId: row.user_id,
      connectionId: row.connection_id,
      subscribedEntityIds: row.subscribed_entity_ids,
    }));
  }

  /**
   * Get subscription statistics
   */
  async getStats(): Promise<Array<{
    entityCode: string;
    uniqueEntities: number;
    uniqueUsers: number;
    totalSubscriptions: number;
  }>> {
    const result = await this.db.execute<{
      entity_code: string;
      unique_entities: string;
      unique_users: string;
      total_subscriptions: string;
    }>(`SELECT * FROM app.get_subscription_stats()`);

    return result.map(row => ({
      entityCode: row.entity_code,
      uniqueEntities: parseInt(row.unique_entities, 10),
      uniqueUsers: parseInt(row.unique_users, 10),
      totalSubscriptions: parseInt(row.total_subscriptions, 10),
    }));
  }

  /**
   * Clean up stale subscriptions (safety net for crashed connections)
   */
  async cleanupStaleSubscriptions(hours = 24): Promise<number> {
    const result = await this.db.executeWithCount(`
      SELECT app.cleanup_stale_subscriptions($1) as count
    `, [hours]);

    const count = (result.rows[0] as { count: number })?.count ?? 0;
    if (count > 0) {
      console.log(`[SubscriptionManager] CleanupStale: removed ${count} subscriptions older than ${hours}h`);
    }

    return count;
  }
}
