/**
 * PostgreSQL Checkpointer for LangGraph
 * Persists LangGraph state to PostgreSQL using existing orchestrator tables
 * @module orchestrator/langgraph/postgres-checkpointer
 */

import type { BaseCheckpointSaver } from '@langchain/langgraph';
import type { Checkpoint, CheckpointMetadata, CheckpointTuple } from '@langchain/langgraph-checkpoint';
import type { OrchestratorState } from '../types/langgraph-state.types.js';
import { StateManagerService } from '../state/state-manager.service.js';

/**
 * PostgreSQL Checkpointer
 * Implements LangGraph's BaseCheckpointSaver interface
 * Uses existing orchestrator_session and orchestrator_state tables
 */
export class PostgresCheckpointer implements Partial<BaseCheckpointSaver> {
  private stateManager: StateManagerService;

  constructor(stateManager: StateManagerService) {
    this.stateManager = stateManager;
  }

  /**
   * Save checkpoint to PostgreSQL
   */
  async put(
    config: { configurable?: { thread_id: string } },
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata
  ): Promise<{ configurable: { thread_id: string; checkpoint_id: string } }> {
    const threadId = config.configurable?.thread_id;
    if (!threadId) {
      throw new Error('thread_id is required in config');
    }

    // Extract state from checkpoint
    const state = checkpoint.channel_values as OrchestratorState;

    try {
      // Check if session exists
      let session = await this.stateManager.getSession(threadId);

      if (!session) {
        // Create new session
        session = await this.stateManager.createSession({
          session_id: threadId,
          chat_session_id: state.chatSessionId,
          user_id: state.userId,
          current_intent: state.currentIntent,
          current_node: state.currentNode,
          status: state.status,
        });
      } else {
        // Update existing session
        await this.stateManager.updateSession(threadId, {
          current_node: state.currentNode,
          status: state.status,
          session_context: {
            completed: state.completed,
            conversationEnded: state.conversationEnded,
            endReason: state.endReason,
            turnCount: state.turnCount,
            offTopicCount: state.offTopicCount,
          },
        });
      }

      // Save all state variables
      if (state.variables) {
        for (const [key, value] of Object.entries(state.variables)) {
          await this.stateManager.setState(threadId, key, value, {
            source: 'langgraph_checkpoint',
            node_context: state.currentNode,
            validated: true,
          });
        }
      }

      // Save metadata
      await this.stateManager.setState(threadId, '_checkpoint_metadata', {
        checkpoint_id: checkpoint.id,
        metadata,
        timestamp: new Date().toISOString(),
      }, {
        source: 'langgraph_checkpoint',
        node_context: state.currentNode,
      });

      return {
        configurable: {
          thread_id: threadId,
          checkpoint_id: checkpoint.id,
        },
      };
    } catch (error: any) {
      console.error('[PostgresCheckpointer] Error saving checkpoint:', error);
      throw new Error(`Failed to save checkpoint: ${error.message}`);
    }
  }

  /**
   * Get checkpoint from PostgreSQL
   */
  async get(config: { configurable?: { thread_id: string; checkpoint_id?: string } }): Promise<CheckpointTuple | undefined> {
    const threadId = config.configurable?.thread_id;
    if (!threadId) {
      return undefined;
    }

    try {
      // Get session
      const session = await this.stateManager.getSession(threadId);
      if (!session) {
        return undefined;
      }

      // Get all state variables
      const stateVars = await this.stateManager.getAllState(threadId);

      // Reconstruct OrchestratorState
      const state: Partial<OrchestratorState> = {
        sessionId: threadId,
        chatSessionId: session.chat_session_id,
        userId: session.user_id,
        currentIntent: session.current_intent,
        currentNode: session.current_node,
        status: session.status as any,
        variables: {},
        messages: [],
        agentActions: [],
        requiresUserInput: false,
        completed: session.session_context?.completed || false,
        conversationEnded: session.session_context?.conversationEnded || false,
        endReason: session.session_context?.endReason,
        offTopicCount: session.session_context?.offTopicCount || 0,
        turnCount: session.session_context?.turnCount || 0,
        metadata: {
          startTime: session.created_ts,
          lastUpdateTime: session.updated_ts || session.created_ts,
          totalAgentCalls: session.total_agent_calls || 0,
          totalMcpCalls: session.total_mcp_calls || 0,
        },
      };

      // Populate variables
      for (const stateVar of stateVars) {
        if (stateVar.key === '_checkpoint_metadata') {
          continue; // Skip metadata
        }
        state.variables![stateVar.key] = stateVar.value;
      }

      // Get checkpoint metadata
      const metadataVar = stateVars.find(v => v.key === '_checkpoint_metadata');
      const checkpointId = metadataVar?.value?.checkpoint_id || session.id;
      const metadata = metadataVar?.value?.metadata || {};

      // Create checkpoint
      const checkpoint: Checkpoint = {
        v: 1,
        id: checkpointId,
        ts: session.updated_ts?.toISOString() || session.created_ts.toISOString(),
        channel_values: state,
        channel_versions: {},
        versions_seen: {},
      };

      // Return checkpoint tuple
      return {
        config: {
          configurable: {
            thread_id: threadId,
            checkpoint_id: checkpointId,
          },
        },
        checkpoint,
        metadata,
        parentConfig: undefined,
      };
    } catch (error: any) {
      console.error('[PostgresCheckpointer] Error getting checkpoint:', error);
      return undefined;
    }
  }

  /**
   * List checkpoints (returns latest checkpoint for thread)
   */
  async *list(config: { configurable?: { thread_id?: string } }, options?: { limit?: number }): AsyncGenerator<CheckpointTuple> {
    const threadId = config.configurable?.thread_id;
    if (!threadId) {
      return;
    }

    const checkpoint = await this.get(config);
    if (checkpoint) {
      yield checkpoint;
    }
  }

  /**
   * Get tuple (alias for get)
   */
  async getTuple(config: { configurable?: { thread_id: string } }): Promise<CheckpointTuple | undefined> {
    return this.get(config);
  }
}

/**
 * Create PostgresCheckpointer instance
 */
export function createPostgresCheckpointer(stateManager: StateManagerService): PostgresCheckpointer {
  return new PostgresCheckpointer(stateManager);
}
