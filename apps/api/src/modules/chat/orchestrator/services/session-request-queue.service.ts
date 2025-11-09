/**
 * Session-Level Request Queue Service
 * Ensures sequential processing of requests per session to prevent race conditions
 * and provide coherent agent execution
 *
 * @module orchestrator/services/session-request-queue
 * @version 1.0.0
 */

interface QueuedRequest<T> {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

interface SessionQueue {
  sessionId: string;
  queue: QueuedRequest<any>[];
  processing: boolean;
}

/**
 * Session Request Queue Service
 * Maintains separate queues for each session to ensure sequential processing
 */
export class SessionRequestQueueService {
  private sessionQueues: Map<string, SessionQueue> = new Map();
  private readonly MAX_QUEUE_SIZE = 100; // Prevent memory overflow

  /**
   * Enqueue a request for a specific session
   * Ensures requests are processed sequentially per session
   *
   * @param sessionId - Session identifier
   * @param requestFn - Async function to execute
   * @returns Promise that resolves when the request completes
   */
  async enqueue<T>(sessionId: string, requestFn: () => Promise<T>): Promise<T> {
    // Get or create queue for this session
    let sessionQueue = this.sessionQueues.get(sessionId);

    if (!sessionQueue) {
      sessionQueue = {
        sessionId,
        queue: [],
        processing: false
      };
      this.sessionQueues.set(sessionId, sessionQueue);
    }

    // Check queue size limit
    if (sessionQueue.queue.length >= this.MAX_QUEUE_SIZE) {
      throw new Error(`Queue size limit exceeded for session ${sessionId}`);
    }

    // Create a promise that will be resolved when the request executes
    return new Promise<T>((resolve, reject) => {
      const queuedRequest: QueuedRequest<T> = {
        execute: requestFn,
        resolve,
        reject
      };

      sessionQueue!.queue.push(queuedRequest);

      // Log queue status
      const queuePosition = sessionQueue!.queue.length;
      if (queuePosition > 1) {
        console.log(`[SessionRequestQueue] 📝 Session ${sessionId.substring(0, 8)}... queued (position: ${queuePosition}/${sessionQueue!.queue.length})`);
      }

      // Start processing if not already processing
      if (!sessionQueue!.processing) {
        this.processQueue(sessionId);
      }
    });
  }

  /**
   * Process queued requests for a session sequentially
   */
  private async processQueue(sessionId: string): Promise<void> {
    const sessionQueue = this.sessionQueues.get(sessionId);

    if (!sessionQueue) {
      return;
    }

    // Mark as processing
    sessionQueue.processing = true;

    while (sessionQueue.queue.length > 0) {
      const request = sessionQueue.queue[0]; // Peek at first request

      try {
        console.log(`[SessionRequestQueue] ▶️  Processing session ${sessionId.substring(0, 8)}... (${sessionQueue.queue.length} in queue)`);

        const result = await request.execute();
        request.resolve(result);

        console.log(`[SessionRequestQueue] ✅ Completed session ${sessionId.substring(0, 8)}... (${sessionQueue.queue.length - 1} remaining)`);
      } catch (error) {
        console.error(`[SessionRequestQueue] ❌ Error processing session ${sessionId.substring(0, 8)}...:`, error);
        request.reject(error as Error);
      } finally {
        // Remove completed request from queue
        sessionQueue.queue.shift();
      }
    }

    // Mark as not processing
    sessionQueue.processing = false;

    // Clean up empty queue after a delay to avoid repeated creation/deletion
    setTimeout(() => {
      const currentQueue = this.sessionQueues.get(sessionId);
      if (currentQueue && currentQueue.queue.length === 0 && !currentQueue.processing) {
        this.sessionQueues.delete(sessionId);
        console.log(`[SessionRequestQueue] 🗑️  Cleaned up empty queue for session ${sessionId.substring(0, 8)}...`);
      }
    }, 60000); // Clean up after 1 minute of inactivity
  }

  /**
   * Get queue status for a session
   */
  getQueueStatus(sessionId: string): { queueLength: number; processing: boolean } | null {
    const sessionQueue = this.sessionQueues.get(sessionId);

    if (!sessionQueue) {
      return null;
    }

    return {
      queueLength: sessionQueue.queue.length,
      processing: sessionQueue.processing
    };
  }

  /**
   * Get overall queue statistics
   */
  getStatistics(): {
    totalSessions: number;
    activeSessions: number;
    totalQueuedRequests: number;
  } {
    let activeSessions = 0;
    let totalQueuedRequests = 0;

    for (const sessionQueue of this.sessionQueues.values()) {
      if (sessionQueue.processing || sessionQueue.queue.length > 0) {
        activeSessions++;
      }
      totalQueuedRequests += sessionQueue.queue.length;
    }

    return {
      totalSessions: this.sessionQueues.size,
      activeSessions,
      totalQueuedRequests
    };
  }

  /**
   * Clear queue for a specific session (use with caution)
   */
  clearSession(sessionId: string): void {
    const sessionQueue = this.sessionQueues.get(sessionId);

    if (sessionQueue) {
      // Reject all pending requests
      for (const request of sessionQueue.queue) {
        request.reject(new Error('Queue cleared'));
      }

      this.sessionQueues.delete(sessionId);
      console.log(`[SessionRequestQueue] 🗑️  Cleared queue for session ${sessionId.substring(0, 8)}...`);
    }
  }

  /**
   * Clear all queues (use for shutdown/reset)
   */
  clearAll(): void {
    for (const [sessionId, sessionQueue] of this.sessionQueues.entries()) {
      // Reject all pending requests
      for (const request of sessionQueue.queue) {
        request.reject(new Error('All queues cleared'));
      }
    }

    this.sessionQueues.clear();
    console.log(`[SessionRequestQueue] 🗑️  Cleared all session queues`);
  }
}

/**
 * Singleton instance
 */
let instance: SessionRequestQueueService | null = null;

export function getSessionRequestQueueService(): SessionRequestQueueService {
  if (!instance) {
    instance = new SessionRequestQueueService();
    console.log('[SessionRequestQueue] 🚀 Initialized session-level request queue service');
  }
  return instance;
}
