/**
 * Session Memory Queue Service
 * RabbitMQ-based queue for session memory data updates
 * Prevents race conditions by processing updates sequentially per session
 *
 * @module orchestrator/services/session-memory-queue
 */

import amqp, { type Connection, type Channel, type ConsumeMessage } from 'amqplib';
import { getSessionMemoryDataService } from './session-memory-data.service.js';

interface SessionMemoryUpdateMessage {
  sessionId: string;
  operation: 'create' | 'update' | 'append' | 'delete';
  data: any;
  timestamp: string;
}

export class SessionMemoryQueueService {
  private connection: Connection | null = null;
  private publishChannel: Channel | null = null;
  private consumerChannel: Channel | null = null;

  private readonly EXCHANGE_NAME = 'session-memory-exchange';
  private readonly QUEUE_NAME = 'session-memory-updates';
  private readonly RABBITMQ_URL: string;

  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly RECONNECT_DELAY_MS = 5000;

  private isShuttingDown = false;

  constructor() {
    // RabbitMQ URL from environment or default to local
    this.RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
  }

  /**
   * Initialize RabbitMQ connection and channels
   */
  async initialize(): Promise<void> {
    try {
      console.log('[SessionMemoryQueue] 🐰 Connecting to RabbitMQ...');

      // Create connection
      this.connection = await amqp.connect(this.RABBITMQ_URL);

      // Handle connection errors
      this.connection.on('error', (err) => {
        console.error('[SessionMemoryQueue] ❌ Connection error:', err.message);
        if (!this.isShuttingDown) {
          this.reconnect();
        }
      });

      this.connection.on('close', () => {
        console.warn('[SessionMemoryQueue] ⚠️  Connection closed');
        if (!this.isShuttingDown) {
          this.reconnect();
        }
      });

      // Create publish channel (for sending messages)
      this.publishChannel = await this.connection.createChannel();

      // Create consumer channel (for receiving messages)
      this.consumerChannel = await this.connection.createChannel();

      // Set prefetch to 1 to ensure sequential processing per session
      await this.consumerChannel.prefetch(1);

      // Create topic exchange for routing by session ID
      await this.publishChannel.assertExchange(this.EXCHANGE_NAME, 'topic', {
        durable: true
      });

      // Create queue for session memory updates
      await this.consumerChannel.assertQueue(this.QUEUE_NAME, {
        durable: true,
        arguments: {
          'x-message-ttl': 86400000 // 24 hours message TTL
        }
      });

      // Bind queue to exchange with wildcard pattern (session.*)
      await this.consumerChannel.bindQueue(
        this.QUEUE_NAME,
        this.EXCHANGE_NAME,
        'session.*'
      );

      console.log('[SessionMemoryQueue] ✅ RabbitMQ initialized');
      console.log(`[SessionMemoryQueue]    Exchange: ${this.EXCHANGE_NAME}`);
      console.log(`[SessionMemoryQueue]    Queue: ${this.QUEUE_NAME}`);

      this.reconnectAttempts = 0; // Reset reconnect counter on successful connection
    } catch (error: any) {
      console.error('[SessionMemoryQueue] ❌ Failed to initialize:', error.message);

      if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
        this.reconnect();
      } else {
        console.error('[SessionMemoryQueue] ❌ Max reconnection attempts reached. Giving up.');
        throw error;
      }
    }
  }

  /**
   * Reconnect to RabbitMQ after connection loss
   */
  private async reconnect(): Promise<void> {
    this.reconnectAttempts++;
    console.log(`[SessionMemoryQueue] 🔄 Reconnecting (attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`);

    // Clean up existing connections
    await this.cleanup();

    // Wait before reconnecting
    await new Promise(resolve => setTimeout(resolve, this.RECONNECT_DELAY_MS));

    // Try to reconnect
    await this.initialize();
  }

  /**
   * Publish session memory update to queue
   */
  async publishUpdate(message: SessionMemoryUpdateMessage): Promise<void> {
    if (!this.publishChannel) {
      console.warn('[SessionMemoryQueue] ⚠️  Publish channel not ready, initializing...');
      await this.initialize();
    }

    try {
      const routingKey = `session.${message.sessionId}`;
      const messageBuffer = Buffer.from(JSON.stringify(message));

      const published = this.publishChannel!.publish(
        this.EXCHANGE_NAME,
        routingKey,
        messageBuffer,
        {
          persistent: true,
          contentType: 'application/json',
          timestamp: Date.now()
        }
      );

      if (!published) {
        console.warn('[SessionMemoryQueue] ⚠️  Message buffer full, waiting for drain...');
        await new Promise(resolve => this.publishChannel!.once('drain', resolve));
      }

      console.log(`[SessionMemoryQueue] 📤 Published update for session ${message.sessionId} (operation: ${message.operation})`);
    } catch (error: any) {
      console.error('[SessionMemoryQueue] ❌ Failed to publish message:', error.message);
      throw error;
    }
  }

  /**
   * Start consuming messages from queue
   */
  async startConsumer(): Promise<void> {
    if (!this.consumerChannel) {
      console.warn('[SessionMemoryQueue] ⚠️  Consumer channel not ready, initializing...');
      await this.initialize();
    }

    try {
      console.log('[SessionMemoryQueue] 🎧 Starting message consumer...');

      await this.consumerChannel!.consume(
        this.QUEUE_NAME,
        async (msg) => {
          if (msg) {
            await this.processMessage(msg);
          }
        },
        {
          noAck: false // Manual acknowledgment
        }
      );

      console.log('[SessionMemoryQueue] ✅ Consumer started');
    } catch (error: any) {
      console.error('[SessionMemoryQueue] ❌ Failed to start consumer:', error.message);
      throw error;
    }
  }

  /**
   * Process individual message from queue
   */
  private async processMessage(msg: ConsumeMessage): Promise<void> {
    const startTime = Date.now();

    try {
      const message: SessionMemoryUpdateMessage = JSON.parse(msg.content.toString());

      console.log(`[SessionMemoryQueue] 🔧 Processing ${message.operation} for session ${message.sessionId}`);

      const sessionMemoryService = getSessionMemoryDataService();

      switch (message.operation) {
        case 'create':
          await sessionMemoryService.createSession(message.sessionId, message.data);
          break;

        case 'update':
          await sessionMemoryService.updateSessionData(message.sessionId, message.data);
          break;

        case 'append':
          // For appending to arrays (e.g., conversation history)
          const current = await sessionMemoryService.getSessionData(message.sessionId);
          const merged = {
            ...current,
            ...message.data,
            // Merge conversation arrays
            conversations: [
              ...(current?.conversations || []),
              ...(message.data.conversations || [])
            ]
          };
          await sessionMemoryService.updateSessionData(message.sessionId, merged);
          break;

        case 'delete':
          // Delete operation (if needed)
          console.log(`[SessionMemoryQueue] 🗑️  Delete operation for session ${message.sessionId}`);
          break;

        default:
          console.warn(`[SessionMemoryQueue] ⚠️  Unknown operation: ${message.operation}`);
      }

      // Acknowledge message
      this.consumerChannel!.ack(msg);

      const duration = Date.now() - startTime;
      console.log(`[SessionMemoryQueue] ✅ Processed in ${duration}ms`);

    } catch (error: any) {
      console.error('[SessionMemoryQueue] ❌ Error processing message:', error.message);

      // Reject message and requeue (will retry)
      this.consumerChannel!.nack(msg, false, true);
    }
  }

  /**
   * Cleanup connections
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.publishChannel) {
        await this.publishChannel.close();
        this.publishChannel = null;
      }

      if (this.consumerChannel) {
        await this.consumerChannel.close();
        this.consumerChannel = null;
      }

      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
    } catch (error: any) {
      // Ignore cleanup errors
      console.warn('[SessionMemoryQueue] ⚠️  Cleanup error:', error.message);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    console.log('[SessionMemoryQueue] 🛑 Shutting down...');
    await this.cleanup();
    console.log('[SessionMemoryQueue] ✅ Shutdown complete');
  }
}

// Singleton instance
let sessionMemoryQueueService: SessionMemoryQueueService | null = null;

/**
 * Get or create session memory queue service singleton
 */
export function getSessionMemoryQueueService(): SessionMemoryQueueService {
  if (!sessionMemoryQueueService) {
    sessionMemoryQueueService = new SessionMemoryQueueService();
  }
  return sessionMemoryQueueService;
}
