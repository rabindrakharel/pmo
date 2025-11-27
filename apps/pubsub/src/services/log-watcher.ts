// ============================================================================
// PubSub Service - Log Watcher
// ============================================================================
// Polls the logging table for pending changes and pushes to subscribers
// ============================================================================

import type { Database } from '../db.js';
import type { ConnectionManager } from './connection-manager.js';
import type { SubscriptionManager } from './subscription-manager.js';
import type { InvalidateMessage, LogEntry } from '../types.js';

const POLL_INTERVAL_MS = 60_000; // 60 seconds
const BATCH_SIZE = 1000;         // Max logs per poll

export class LogWatcher {
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    private db: Database,
    private connectionManager: ConnectionManager,
    private subscriptionManager: SubscriptionManager
  ) {}

  /**
   * Start the polling loop
   */
  start(): void {
    if (this.intervalId) {
      console.warn('[LogWatcher] Already running');
      return;
    }

    console.log(`[LogWatcher] Starting with interval: ${POLL_INTERVAL_MS}ms`);
    this.intervalId = setInterval(() => this.poll(), POLL_INTERVAL_MS);

    // Initial poll after 5 seconds (let connections establish)
    setTimeout(() => this.poll(), 5000);
  }

  /**
   * Stop the polling loop
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[LogWatcher] Stopped');
    }
  }

  /**
   * Main polling function - finds pending changes and pushes to subscribers
   */
  private async poll(): Promise<void> {
    if (this.isProcessing) {
      console.log('[LogWatcher] Skipping poll, previous still processing');
      return;
    }

    this.isProcessing = true;

    try {
      // 1. Fetch pending logs (deduplicated - only latest per entity)
      const logs = await this.db.execute<LogEntry>(`
        SELECT DISTINCT ON (entity_code, entity_id)
          id, entity_code, entity_id, action
        FROM app.logging
        WHERE sync_status = 'pending'
          AND action != 0  -- Skip VIEW actions
        ORDER BY entity_code, entity_id, created_ts DESC
        LIMIT ${BATCH_SIZE}
      `);

      if (logs.length === 0) {
        this.isProcessing = false;
        return;
      }

      console.log(`[LogWatcher] Processing ${logs.length} changes`);

      // 2. Group by entity_code
      const changesByEntity = new Map<string, LogEntry[]>();
      for (const log of logs) {
        if (!changesByEntity.has(log.entity_code)) {
          changesByEntity.set(log.entity_code, []);
        }
        changesByEntity.get(log.entity_code)!.push(log);
      }

      // 3. For each entity type, find subscribers and push
      let totalPushed = 0;
      for (const [entityCode, changes] of changesByEntity) {
        const entityIds = changes.map(c => c.entity_id);

        // Get all subscribers for these entities
        const subscribers = await this.subscriptionManager.getBatchSubscribers(
          entityCode,
          entityIds
        );

        // Filter to only local connections (this pod's connections)
        const localSubscribers = subscribers.filter(sub =>
          this.connectionManager.hasConnection(sub.connectionId)
        );

        // Push INVALIDATE to each subscriber
        for (const sub of localSubscribers) {
          // Filter changes to only those the subscriber is interested in
          const relevantChanges = changes.filter(c =>
            sub.subscribedEntityIds.includes(c.entity_id)
          );

          if (relevantChanges.length > 0) {
            const message: InvalidateMessage = {
              type: 'INVALIDATE',
              payload: {
                entityCode,
                changes: relevantChanges.map(c => ({
                  entityId: c.entity_id,
                  action: this.actionToString(c.action),
                  version: c.version ?? 0,
                })),
                timestamp: new Date().toISOString(),
              },
            };

            const sent = this.connectionManager.send(sub.connectionId, message);
            if (sent) totalPushed++;
          }
        }
      }

      // 4. Mark logs as processed
      const logIds = logs.map(l => l.id);
      const logIdsArray = logIds.map(id => `'${id}'::uuid`).join(',');

      await this.db.execute(`
        UPDATE app.logging
        SET sync_status = 'sent', sync_processed_ts = now()
        WHERE id = ANY(ARRAY[${logIdsArray}])
      `);

      console.log(`[LogWatcher] Processed ${logs.length} changes, pushed to ${totalPushed} connections`);

    } catch (error) {
      console.error('[LogWatcher] Error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Convert action number to string
   */
  private actionToString(action: number): 'CREATE' | 'UPDATE' | 'DELETE' {
    switch (action) {
      case 4: return 'CREATE';
      case 3: return 'DELETE';
      default: return 'UPDATE';
    }
  }

  /**
   * Force an immediate poll (for testing)
   */
  async forcePoll(): Promise<void> {
    await this.poll();
  }

  /**
   * Check if the watcher is running
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }
}
