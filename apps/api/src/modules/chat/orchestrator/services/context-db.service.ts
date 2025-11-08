import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * LowDB Schema for Session Context Data
 */
export interface SessionContextData {
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
      customer_name: string;
      customer_phone_number: string;
      customer_email: string;
      customer_id: string;
      customers_main_ask: string;
      matching_service_catalog_to_solve_customers_issue: string;
      related_entities_for_customers_ask: string;
      task_id: string;
      appointment_details: string;
      project_id: string;
      assigned_employee_id: string;
      assigned_employee_name: string;
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

export interface ContextDatabase {
  sessions: Record<string, SessionContextData>;
}

/**
 * LowDB Service for Session Context Storage
 *
 * Provides in-memory JSON storage with file persistence for agent session data.
 * Replaces direct JSON file writes with atomic database operations.
 */
export class ContextDbService {
  private db: Low<ContextDatabase> | null = null;
  private dbPath: string;
  private initPromise: Promise<void> | null = null;

  constructor(dbPath?: string) {
    // Default to logs/contexts/sessions.db.json
    this.dbPath = dbPath || join(process.cwd(), 'logs', 'contexts', 'sessions.db.json');
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
      const adapter = new JSONFile<ContextDatabase>(this.dbPath);
      this.db = new Low<ContextDatabase>(adapter, { sessions: {} });

      // Read existing data
      await this.db.read();

      // Initialize sessions if not exists
      if (!this.db.data.sessions) {
        this.db.data.sessions = {};
        await this.db.write();
      }

      console.log(`[ContextDbService] ✅ Initialized LowDB at ${this.dbPath}`);
      console.log(`[ContextDbService] 📊 Loaded ${Object.keys(this.db.data.sessions).length} existing sessions`);
    })();

    return this.initPromise;
  }

  /**
   * Ensure database is initialized
   */
  private ensureInitialized(): void {
    if (!this.db) {
      throw new Error('ContextDbService not initialized. Call initialize() first.');
    }
  }

  /**
   * Get session context data by session ID
   */
  async getSession(sessionId: string): Promise<SessionContextData | null> {
    this.ensureInitialized();
    await this.db!.read();

    const session = this.db!.data.sessions[sessionId];
    if (session) {
      console.log(`[ContextDbService] 📖 Read session ${sessionId.substring(0, 8)}...`);
    }

    return session || null;
  }

  /**
   * Save or update session context data
   */
  async saveSession(sessionData: SessionContextData): Promise<void> {
    this.ensureInitialized();

    const sessionId = sessionData.sessionId;
    const shortId = sessionId.substring(0, 8);
    const action = sessionData.action || 'update';

    // Update in-memory data
    this.db!.data.sessions[sessionId] = {
      ...sessionData,
      lastUpdated: new Date().toISOString(),
      action,
    };

    // Persist to file
    await this.db!.write();

    console.log(`[ContextDbService] 💾 Saved session ${shortId}... (${action})`);
  }

  /**
   * Update session context (merge with existing)
   */
  async updateSession(
    sessionId: string,
    updates: Partial<SessionContextData>,
    action: string = 'update'
  ): Promise<void> {
    this.ensureInitialized();
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
          ...existing.context.data_extraction_fields,
          ...(updates.context.data_extraction_fields || {}),
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

    const shortId = sessionId.substring(0, 8);
    console.log(`[ContextDbService] 🔄 Updated session ${shortId}... (${action})`);
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    this.ensureInitialized();
    await this.db!.read();

    if (this.db!.data.sessions[sessionId]) {
      delete this.db!.data.sessions[sessionId];
      await this.db!.write();

      const shortId = sessionId.substring(0, 8);
      console.log(`[ContextDbService] 🗑️  Deleted session ${shortId}...`);
    }
  }

  /**
   * Get all sessions
   */
  async getAllSessions(): Promise<SessionContextData[]> {
    this.ensureInitialized();
    await this.db!.read();

    return Object.values(this.db!.data.sessions);
  }

  /**
   * Get sessions by user ID
   */
  async getSessionsByUser(userId: string): Promise<SessionContextData[]> {
    this.ensureInitialized();
    await this.db!.read();

    return Object.values(this.db!.data.sessions).filter(
      session => session.userId === userId
    );
  }

  /**
   * Get active (not completed) sessions
   */
  async getActiveSessions(): Promise<SessionContextData[]> {
    this.ensureInitialized();
    await this.db!.read();

    return Object.values(this.db!.data.sessions).filter(
      session => !session.completed && !session.conversationEnded
    );
  }

  /**
   * Clear all sessions (use with caution)
   */
  async clearAll(): Promise<void> {
    this.ensureInitialized();

    this.db!.data.sessions = {};
    await this.db!.write();

    console.log(`[ContextDbService] 🧹 Cleared all sessions`);
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
   * Compact database (remove old completed sessions)
   */
  async compact(olderThanDays: number = 7): Promise<number> {
    this.ensureInitialized();
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
      console.log(`[ContextDbService] 🗜️  Compacted: removed ${removedCount} old sessions`);
    }

    return removedCount;
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
let contextDbInstance: ContextDbService | null = null;

/**
 * Get singleton instance of ContextDbService
 */
export function getContextDbService(): ContextDbService {
  if (!contextDbInstance) {
    contextDbInstance = new ContextDbService();
  }
  return contextDbInstance;
}
