import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * LowDB Schema for Session Memory Data
 * Matches the structure of session_{id}_memory_data.json files
 */
export interface SessionMemoryData {
  sessionId: string;
  chatSessionId: string;
  userId: string;
  currentNode: string;
  previousNode: string | null;
  completed: boolean;
  conversationEnded: boolean;
  endReason: string | null;
  context: {
    agent_session_id: string;
    who_are_you: string;
    data_extraction_fields: {
      customer: {
        name: string;
        phone: string;
        email: string;
        id: string;
      };
      service: {
        primary_request: string;
        catalog_match: string;
        related_entities: string;
      };
      operations: {
        solution_plan: string;
        task_id: string;
        task_name: string;
        appointment_details: string;
      };
      project: {
        id: string;
      };
      assignment: {
        employee_id: string;
        employee_name: string;
      };
    };
    next_course_of_action: string;
    next_node_to_go_to: string;
    node_traversed: string[];
    summary_of_conversation_on_each_step_until_now: Array<{
      index: number;
      customer: string;
      agent: string;
    }>;
    flags: Record<string, number>;
  };
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
  }>;
  lastUpdated: string;
  action: string;
}

export interface SessionMemoryDatabase {
  sessions: Record<string, SessionMemoryData>;
}

/**
 * Session Memory Data Service (LowDB Implementation)
 *
 * Provides in-memory JSON storage with file persistence for agent session memory data.
 * Replaces individual session_{id}_memory_data.json files with centralized LowDB.
 *
 * Usage Pattern:
 * - Agents READ freely via MCP tools
 * - Agents WRITE only via sessionMemoryDataService API (through MCP)
 * - Service ensures atomic operations and data integrity with per-session locking
 */
export class SessionMemoryDataService {
  private db: Low<SessionMemoryDatabase> | null = null;
  private dbPath: string;
  private initPromise: Promise<void> | null = null;
  private sessionLocks: Map<string, Promise<void>> = new Map();
  private readonly LOCK_TIMEOUT_MS = 10000; // 10 second timeout

  constructor(dbPath?: string) {
    // Default to logs/contexts/session_memory_data.db.json
    this.dbPath = dbPath || join(process.cwd(), 'logs', 'contexts', 'session_memory_data.db.json');
  }

  /**
   * Initialize database - call once at startup
   */
  async initialize(): Promise<void> {
    // Return existing init promise if already initializing
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      const adapter = new JSONFile<SessionMemoryDatabase>(this.dbPath);
      this.db = new Low<SessionMemoryDatabase>(adapter, { sessions: {} });

      // Read existing data
      await this.db.read();

      // Initialize sessions if not exists
      if (!this.db.data.sessions) {
        this.db.data.sessions = {};
        await this.db.write();
      }

      console.log(`[SessionMemoryDataService] ✅ Initialized LowDB at ${this.dbPath}`);
      console.log(`[SessionMemoryDataService] 📊 Loaded ${Object.keys(this.db.data.sessions).length} existing sessions`);
    })();

    return this.initPromise;
  }

  /**
   * Ensure database is initialized
   */
  private ensureInitialized(): void {
    if (!this.db) {
      throw new Error('SessionMemoryDataService not initialized. Call initialize() first.');
    }
  }

  /**
   * Acquire lock for a session (prevents race conditions during writes)
   * Throws error if lock acquisition times out
   */
  private async acquireLock(sessionId: string): Promise<() => void> {
    const lockKey = `lock:${sessionId}`;

    // Wait for existing lock to be released
    const existingLock = this.sessionLocks.get(lockKey);
    if (existingLock) {
      try {
        await Promise.race([
          existingLock,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Lock timeout for session ${sessionId}`)), this.LOCK_TIMEOUT_MS)
          )
        ]);
      } catch (error) {
        console.error(`[SessionMemoryDataService] ⚠️  Lock timeout for session ${sessionId.substring(0, 8)}...`);
        throw error;
      }
    }

    // Create new lock
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    this.sessionLocks.set(lockKey, lockPromise);

    // Return release function
    return () => {
      this.sessionLocks.delete(lockKey);
      releaseLock!();
    };
  }

  /**
   * Get session memory data by session ID
   */
  async getSession(sessionId: string): Promise<SessionMemoryData | null> {
    this.ensureInitialized();
    await this.db!.read();

    const session = this.db!.data.sessions[sessionId];
    if (session) {
      console.log(`[SessionMemoryDataService] 📖 Read session ${sessionId.substring(0, 8)}...`);
    }

    return session || null;
  }

  /**
   * Save or update session memory data (with locking to prevent race conditions)
   */
  async saveSession(sessionData: SessionMemoryData): Promise<void> {
    this.ensureInitialized();

    const sessionId = sessionData.sessionId;
    const shortId = sessionId.substring(0, 8);
    const action = sessionData.action || 'update';

    // Acquire lock for this session
    const releaseLock = await this.acquireLock(sessionId);

    try {
      console.log(`[SessionMemoryDataService] 🔒 Lock acquired for session ${shortId}...`);

      // Update in-memory data
      this.db!.data.sessions[sessionId] = {
        ...sessionData,
        lastUpdated: new Date().toISOString(),
        action,
      };

      // Persist to file
      await this.db!.write();

      console.log(`[SessionMemoryDataService] 💾 Saved session ${shortId}... (${action})`);
    } finally {
      // Always release lock, even if error occurs
      releaseLock();
      console.log(`[SessionMemoryDataService] 🔓 Lock released for session ${shortId}...`);
    }
  }

  /**
   * Update session memory data (merge with existing, with locking to prevent race conditions)
   */
  async updateSession(
    sessionId: string,
    updates: Partial<SessionMemoryData>,
    action: string = 'update'
  ): Promise<void> {
    this.ensureInitialized();

    const shortId = sessionId.substring(0, 8);

    // Acquire lock for this session
    const releaseLock = await this.acquireLock(sessionId);

    try {
      console.log(`[SessionMemoryDataService] 🔒 Lock acquired for session ${shortId}...`);

      await this.db!.read();

      const existing = this.db!.data.sessions[sessionId];
      if (!existing) {
        throw new Error(`Session ${sessionId} not found`);
      }

      // Deep merge context if provided
      if (updates.context) {
        updates.context = {
          ...existing.context,
          ...updates.context,
          data_extraction_fields: {
            customer: {
              ...existing.context.data_extraction_fields?.customer,
              ...updates.context.data_extraction_fields?.customer,
            },
            service: {
              ...existing.context.data_extraction_fields?.service,
              ...updates.context.data_extraction_fields?.service,
            },
            operations: {
              ...existing.context.data_extraction_fields?.operations,
              ...updates.context.data_extraction_fields?.operations,
            },
            project: {
              ...existing.context.data_extraction_fields?.project,
              ...updates.context.data_extraction_fields?.project,
            },
            assignment: {
              ...existing.context.data_extraction_fields?.assignment,
              ...updates.context.data_extraction_fields?.assignment,
            },
          },
        };
      }

      // Merge updates
      this.db!.data.sessions[sessionId] = {
        ...existing,
        ...updates,
        lastUpdated: new Date().toISOString(),
        action,
      };

      await this.db!.write();

      console.log(`[SessionMemoryDataService] 🔄 Updated session ${shortId}... (${action})`);
    } finally {
      // Always release lock, even if error occurs
      releaseLock();
      console.log(`[SessionMemoryDataService] 🔓 Lock released for session ${shortId}...`);
    }
  }

  /**
   * Delete session (with locking to prevent race conditions)
   */
  async deleteSession(sessionId: string): Promise<void> {
    this.ensureInitialized();

    const shortId = sessionId.substring(0, 8);

    // Acquire lock for this session
    const releaseLock = await this.acquireLock(sessionId);

    try {
      console.log(`[SessionMemoryDataService] 🔒 Lock acquired for session ${shortId}...`);

      await this.db!.read();

      if (this.db!.data.sessions[sessionId]) {
        delete this.db!.data.sessions[sessionId];
        await this.db!.write();

        console.log(`[SessionMemoryDataService] 🗑️  Deleted session ${shortId}...`);
      }
    } finally {
      // Always release lock, even if error occurs
      releaseLock();
      console.log(`[SessionMemoryDataService] 🔓 Lock released for session ${shortId}...`);
    }
  }

  /**
   * Get all sessions
   */
  async getAllSessions(): Promise<SessionMemoryData[]> {
    this.ensureInitialized();
    await this.db!.read();

    return Object.values(this.db!.data.sessions);
  }

  /**
   * Get sessions by user ID
   */
  async getSessionsByUser(userId: string): Promise<SessionMemoryData[]> {
    this.ensureInitialized();
    await this.db!.read();

    return Object.values(this.db!.data.sessions).filter(
      session => session.userId === userId
    );
  }

  /**
   * Get active (not completed) sessions
   */
  async getActiveSessions(): Promise<SessionMemoryData[]> {
    this.ensureInitialized();
    await this.db!.read();

    return Object.values(this.db!.data.sessions).filter(
      session => !session.completed && !session.conversationEnded
    );
  }

  /**
   * Clear all sessions (use with caution, with global locking)
   */
  async clearAll(): Promise<void> {
    this.ensureInitialized();

    // Use a special lock key for global operations
    const releaseLock = await this.acquireLock('__GLOBAL__');

    try {
      console.log(`[SessionMemoryDataService] 🔒 Global lock acquired for clearAll operation`);

      this.db!.data.sessions = {};
      await this.db!.write();

      console.log(`[SessionMemoryDataService] 🧹 Cleared all sessions`);
    } finally {
      releaseLock();
      console.log(`[SessionMemoryDataService] 🔓 Global lock released`);
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
    totalMessages: number;
    dbSizeBytes: number;
  }> {
    this.ensureInitialized();
    await this.db!.read();

    const sessions = Object.values(this.db!.data.sessions);
    const active = sessions.filter(s => !s.completed && !s.conversationEnded);
    const completed = sessions.filter(s => s.completed || s.conversationEnded);
    const totalMessages = sessions.reduce((sum, s) => sum + s.messages.length, 0);

    // Calculate DB size (approximate)
    const dbSizeBytes = JSON.stringify(this.db!.data).length;

    return {
      totalSessions: sessions.length,
      activeSessions: active.length,
      completedSessions: completed.length,
      totalMessages,
      dbSizeBytes,
    };
  }

  /**
   * Compact database (remove old completed sessions, with global locking)
   */
  async compact(olderThanDays: number = 7): Promise<number> {
    this.ensureInitialized();

    // Use a special lock key for global operations
    const releaseLock = await this.acquireLock('__GLOBAL__');

    try {
      console.log(`[SessionMemoryDataService] 🔒 Global lock acquired for compact operation`);

      await this.db!.read();

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      let removedCount = 0;
      const sessions = this.db!.data.sessions;

      for (const [sessionId, session] of Object.entries(sessions)) {
        if (
          (session.completed || session.conversationEnded) &&
          new Date(session.lastUpdated) < cutoffDate
        ) {
          delete sessions[sessionId];
          removedCount++;
        }
      }

      if (removedCount > 0) {
        await this.db!.write();
        console.log(`[SessionMemoryDataService] 🗜️  Compacted: removed ${removedCount} old sessions`);
      }

      return removedCount;
    } finally {
      releaseLock();
      console.log(`[SessionMemoryDataService] 🔓 Global lock released`);
    }
  }

  /**
   * Export session to JSON string (for debugging/backup)
   */
  async exportSession(sessionId: string): Promise<string> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return JSON.stringify(session, null, 2);
  }

  /**
   * Get database path
   */
  getDbPath(): string {
    return this.dbPath;
  }
}

// Singleton instance
let sessionMemoryDataServiceInstance: SessionMemoryDataService | null = null;

/**
 * Get singleton instance of SessionMemoryDataService
 */
export function getSessionMemoryDataService(): SessionMemoryDataService {
  if (!sessionMemoryDataServiceInstance) {
    sessionMemoryDataServiceInstance = new SessionMemoryDataService();
  }
  return sessionMemoryDataServiceInstance;
}
