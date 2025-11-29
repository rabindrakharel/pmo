// ============================================================================
// PubSub Service - PostgreSQL LISTEN for Real-Time Notifications
// ============================================================================
// Replaces 60-second polling with instant push via pg_notify
//
// Architecture:
//   PostgreSQL NOTIFY → pg LISTEN → WebSocket push
//
// Benefits:
//   - Sub-100ms latency (vs 60s polling)
//   - No database polling load
//   - Scales with PostgreSQL replication
// ============================================================================

import pg from 'pg';
import type { ConnectionManager } from './connection-manager.js';
import type { SubscriptionManager } from './subscription-manager.js';
import type { InvalidateMessage } from '../types.js';

const { Client } = pg;

const CHANNEL = 'entity_changes';
const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_ATTEMPTS = 10;

interface NotifyPayload {
  log_id: string;
  entity_code: string;
  entity_id: string;
  action: number;
  timestamp: number;
}

export class PgListener {
  private client: pg.Client | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(
    private connectionString: string,
    private connectionManager: ConnectionManager,
    private subscriptionManager: SubscriptionManager
  ) {}

  /**
   * Start listening for PostgreSQL notifications
   */
  async start(): Promise<void> {
    console.log('[PgListener] Starting real-time listener...');
    await this.connect();
  }

  /**
   * Stop listening and close connection
   */
  async stop(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.client) {
      try {
        await this.client.query(`UNLISTEN ${CHANNEL}`);
        await this.client.end();
      } catch (error) {
        // Ignore errors during shutdown
      }
      this.client = null;
      this.isConnected = false;
    }

    console.log('[PgListener] Stopped');
  }

  /**
   * Check if listener is running
   */
  isRunning(): boolean {
    return this.isConnected;
  }

  /**
   * Connect to PostgreSQL and start listening
   */
  private async connect(): Promise<void> {
    try {
      this.client = new Client({ connectionString: this.connectionString });

      // Handle connection errors
      this.client.on('error', (error) => {
        console.error('[PgListener] Connection error:', error.message);
        this.handleDisconnect();
      });

      // Handle notifications
      this.client.on('notification', (msg) => {
        this.handleNotification(msg);
      });

      await this.client.connect();
      await this.client.query(`LISTEN ${CHANNEL}`);

      this.isConnected = true;
      this.reconnectAttempts = 0;

      console.log(`[PgListener] Connected and listening on channel: ${CHANNEL}`);
    } catch (error) {
      console.error('[PgListener] Failed to connect:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Handle disconnection and schedule reconnect
   */
  private handleDisconnect(): void {
    this.isConnected = false;
    this.client = null;
    this.scheduleReconnect();
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(`[PgListener] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`);
      return;
    }

    const delay = RECONNECT_DELAY_MS * Math.pow(2, Math.min(this.reconnectAttempts, 5));
    this.reconnectAttempts++;

    console.log(`[PgListener] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Handle incoming PostgreSQL notification
   */
  private async handleNotification(msg: pg.Notification): Promise<void> {
    if (!msg.payload) {
      console.warn('[PgListener] Received notification without payload');
      return;
    }

    try {
      const payload: NotifyPayload = JSON.parse(msg.payload);
      await this.processChange(payload);
    } catch (error) {
      console.error('[PgListener] Failed to process notification:', error);
    }
  }

  /**
   * Process a single entity change and push to subscribers
   */
  private async processChange(payload: NotifyPayload): Promise<void> {
    const { entity_code, entity_id, action, log_id } = payload;

    // Get subscribers for this entity
    const subscribers = await this.subscriptionManager.getBatchSubscribers(
      entity_code,
      [entity_id]
    );

    if (subscribers.length === 0) {
      // No subscribers - mark as skipped in background
      this.markLogSkipped(log_id);
      return;
    }

    // Filter to only local connections
    const localSubscribers = subscribers.filter(sub =>
      this.connectionManager.hasConnection(sub.connectionId)
    );

    if (localSubscribers.length === 0) {
      // Subscribers exist but not on this pod - another pod will handle
      return;
    }

    // Build invalidation message
    const message: InvalidateMessage = {
      type: 'INVALIDATE',
      payload: {
        entityCode: entity_code,
        changes: [{
          entityId: entity_id,
          action: this.actionToString(action),
          version: 0,
        }],
        timestamp: new Date().toISOString(),
      },
    };

    // Push to each subscriber
    let pushCount = 0;
    for (const sub of localSubscribers) {
      if (sub.subscribedEntityIds.includes(entity_id)) {
        const sent = this.connectionManager.send(sub.connectionId, message);
        if (sent) pushCount++;
      }
    }

    // Mark log as sent in background
    if (pushCount > 0) {
      this.markLogSent(log_id);
      console.log(`[PgListener] Pushed ${entity_code}:${entity_id.slice(0, 8)}... to ${pushCount} connections`);
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
   * Mark log entry as sent (fire-and-forget)
   */
  private markLogSent(logId: string): void {
    // Use a separate connection from the pool for updates
    // This is fire-and-forget - don't await
    import('../db.js').then(({ pool }) => {
      pool.query(
        `UPDATE app.system_logging SET sync_status = 'sent', sync_processed_ts = now() WHERE id = $1`,
        [logId]
      ).catch((error) => {
        console.error('[PgListener] Failed to mark log sent:', error.message);
      });
    });
  }

  /**
   * Mark log entry as skipped (fire-and-forget)
   */
  private markLogSkipped(logId: string): void {
    import('../db.js').then(({ pool }) => {
      pool.query(
        `UPDATE app.system_logging SET sync_status = 'skipped', sync_processed_ts = now() WHERE id = $1`,
        [logId]
      ).catch((error) => {
        console.error('[PgListener] Failed to mark log skipped:', error.message);
      });
    });
  }
}
