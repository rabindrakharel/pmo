/**
 * Context Persistence Service
 * Writes session_{session_id}_memory_data.json files to track conversation state
 * Helps with debugging and understanding incremental context building
 * @module orchestrator/agents/context-persistence
 */

import fs from 'fs/promises';
import path from 'path';
import type { AgentContextState } from './agent-context.service.js';

/**
 * Context Persistence Service
 * Manages context JSON files per session
 */
export class ContextPersistenceService {
  private contextDir: string;

  constructor(contextDir: string = './logs/contexts') {
    this.contextDir = contextDir;
  }

  /**
   * Initialize context directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.contextDir, { recursive: true });
      console.log(`[ContextPersistence] 📁 Context directory: ${this.contextDir}`);
    } catch (error: any) {
      console.error(`[ContextPersistence] ❌ Failed to create context directory: ${error.message}`);
    }
  }

  /**
   * Get file path for session
   */
  private getFilePath(sessionId: string): string {
    return path.join(this.contextDir, `session_${sessionId}_memory_data.json`);
  }

  /**
   * Write context to file
   */
  async writeContext(state: AgentContextState, metadata?: {
    nodeName?: string;
    action?: string;
    timestamp?: Date;
  }): Promise<void> {
    try {
      const filePath = this.getFilePath(state.sessionId);

      // Build comprehensive snapshot
      const snapshot = {
        // Metadata
        metadata: {
          sessionId: state.sessionId,
          chatSessionId: state.chatSessionId,
          userId: state.userId,
          currentNode: state.currentNode,
          previousNode: state.previousNode,
          completed: state.completed,
          conversationEnded: state.conversationEnded,
          endReason: state.endReason,
          lastUpdated: metadata?.timestamp?.toISOString() || new Date().toISOString(),
          action: metadata?.action || 'update',
          nodeName: metadata?.nodeName,
        },

        // Full context (from agent_config.json schema)
        context: state.context,

        // Message history
        messages: state.messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp.toISOString(),
        })),

        // Statistics
        statistics: {
          totalMessages: state.messages.length,
          userMessages: state.messages.filter(m => m.role === 'user').length,
          assistantMessages: state.messages.filter(m => m.role === 'assistant').length,
          nodesTraversed: state.context.node_traversal_path?.length || 0,
          flagsSet: Object.values(state.context.flags || {}).filter(v => v === 1).length,
          flagsTotal: Object.keys(state.context.flags || {}).length,
        },

        // Validation
        validation: {
          mandatoryFieldsSet: this.checkMandatoryFields(state),
          contextKeys: Object.keys(state.context),
          flagsSet: Object.entries(state.context.flags || {})
            .filter(([_, v]) => v === 1)
            .map(([k]) => k),
        },
      };

      // Write to file
      await fs.writeFile(
        filePath,
        JSON.stringify(snapshot, null, 2),
        'utf-8'
      );

      console.log(`[ContextPersistence] 💾 Written: ${path.basename(filePath)} (${metadata?.action || 'update'})`);
    } catch (error: any) {
      console.error(`[ContextPersistence] ❌ Failed to write context: ${error.message}`);
    }
  }

  /**
   * Initialize context file for new session
   */
  async initializeContext(state: AgentContextState): Promise<void> {
    await this.writeContext(state, {
      action: 'initialize',
      nodeName: state.currentNode,
      timestamp: new Date(),
    });

    console.log(`[ContextPersistence] 🆕 Initialized context file for session ${state.sessionId.substring(0, 8)}...`);
  }

  /**
   * Update context file after node execution
   */
  async updateAfterNode(state: AgentContextState, nodeName: string): Promise<void> {
    await this.writeContext(state, {
      action: 'node_execution',
      nodeName,
      timestamp: new Date(),
    });
  }

  /**
   * Update context file after navigation
   */
  async updateAfterNavigation(state: AgentContextState, fromNode: string, toNode: string): Promise<void> {
    await this.writeContext(state, {
      action: 'navigation',
      nodeName: `${fromNode} → ${toNode}`,
      timestamp: new Date(),
    });
  }

  /**
   * Update context file at conversation end
   */
  async finalizeContext(state: AgentContextState): Promise<void> {
    await this.writeContext(state, {
      action: 'finalize',
      nodeName: state.currentNode,
      timestamp: new Date(),
    });

    console.log(`[ContextPersistence] ✅ Finalized context file for session ${state.sessionId.substring(0, 8)}...`);
  }

  /**
   * Read context from file
   */
  async readContext(sessionId: string): Promise<any | null> {
    try {
      const filePath = this.getFilePath(sessionId);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`[ContextPersistence] ❌ Failed to read context: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Check if mandatory fields are set
   */
  private checkMandatoryFields(state: AgentContextState): Record<string, boolean> {
    const mandatoryFields = ['customers_main_ask', 'customer_phone_number'];
    const result: Record<string, boolean> = {};

    for (const field of mandatoryFields) {
      const value = state.context[field];
      result[field] = value !== undefined && value !== null && value !== '';
    }

    return result;
  }

  /**
   * List all context files
   */
  async listContextFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.contextDir);
      return files.filter(f => f.startsWith('session_') && f.endsWith('_memory_data.json'));
    } catch (error: any) {
      console.error(`[ContextPersistence] ❌ Failed to list context files: ${error.message}`);
      return [];
    }
  }

  /**
   * Delete old context files (cleanup)
   */
  async cleanupOldFiles(olderThanDays: number = 7): Promise<number> {
    try {
      const files = await this.listContextFiles();
      const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
      let deleted = 0;

      for (const file of files) {
        const filePath = path.join(this.contextDir, file);
        const stats = await fs.stat(filePath);

        if (stats.mtimeMs < cutoffTime) {
          await fs.unlink(filePath);
          deleted++;
        }
      }

      if (deleted > 0) {
        console.log(`[ContextPersistence] 🗑️  Deleted ${deleted} old context files`);
      }

      return deleted;
    } catch (error: any) {
      console.error(`[ContextPersistence] ❌ Failed to cleanup old files: ${error.message}`);
      return 0;
    }
  }
}

/**
 * Singleton instance
 */
let instance: ContextPersistenceService | null = null;

export function getContextPersistenceService(contextDir?: string): ContextPersistenceService {
  if (!instance) {
    instance = new ContextPersistenceService(contextDir);
    instance.initialize();
  }
  return instance;
}
