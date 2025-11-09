/**
 * Centralized LLM Logger Service
 * Consolidates ALL agent context, conversations, LLM calls, and responses into llm.log
 * @module orchestrator/services/llm-logger
 */

import fs from 'fs/promises';
import path from 'path';
import type { AgentContextState } from '../agents/agent-context.service.js';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

/**
 * LLM Logger Service
 * Single source of truth for all LLM-related logging
 */
export class LLMLoggerService {
  private logFilePath: string;
  private logDir: string = './logs';

  constructor() {
    this.logFilePath = path.join(this.logDir, 'llm.log');
    this.initializeLogFile();
  }

  /**
   * Initialize log file and directory
   */
  private async initializeLogFile(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });

      // Create initial log file with header if it doesn't exist
      try {
        await fs.access(this.logFilePath);
      } catch {
        const header = `
╔════════════════════════════════════════════════════════════════════════════════╗
║                        COMPREHENSIVE LLM ACTIVITY LOG                          ║
║                                                                                ║
║  This file contains ALL LLM calls, agent context, conversations, and          ║
║  decisions made by the multi-agent orchestration system.                      ║
║                                                                                ║
║  Log Started: ${new Date().toISOString()}                                   ║
╚════════════════════════════════════════════════════════════════════════════════╝

`;
        await fs.writeFile(this.logFilePath, header, 'utf-8');
      }

      console.log(`[LLMLogger] 📝 Logging all LLM activity to: ${this.logFilePath}`);
    } catch (error: any) {
      console.error(`[LLMLogger] ❌ Failed to initialize log file: ${error.message}`);
    }
  }

  /**
   * Append to log file
   */
  private async appendToLog(content: string): Promise<void> {
    try {
      await fs.appendFile(this.logFilePath, content + '\n', 'utf-8');
    } catch (error: any) {
      console.error(`[LLMLogger] ❌ Failed to append to log: ${error.message}`);
    }
  }

  /**
   * Log session start
   */
  async logSessionStart(sessionId: string, chatSessionId?: string, userId?: string): Promise<void> {
    const entry = `
╔════════════════════════════════════════════════════════════════════════════════╗
║                            NEW SESSION STARTED                                 ║
╚════════════════════════════════════════════════════════════════════════════════╝
📅 Timestamp: ${new Date().toISOString()}
🆔 Session ID: ${sessionId}
💬 Chat Session ID: ${chatSessionId || 'N/A'}
👤 User ID: ${userId || 'N/A'}

`;
    await this.appendToLog(entry);
  }

  /**
   * Log iteration start
   */
  async logIterationStart(
    iteration: number,
    sessionId: string,
    currentNode: string,
    userMessage?: string
  ): Promise<void> {
    const entry = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 ITERATION ${iteration}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ Timestamp: ${new Date().toISOString()}
🆔 Session: ${sessionId.substring(0, 8)}...
🎯 Current Node: ${currentNode}
${userMessage ? `👤 User Message: ${userMessage}\n` : ''}`;
    await this.appendToLog(entry);
  }

  /**
   * Log agent context state (before execution)
   */
  async logContextState(state: AgentContextState, label: string = 'CONTEXT STATE'): Promise<void> {
    const entry = `
📊 [${label}]
   Current Node: ${state.currentNode}
   Previous Node: ${state.previousNode || '(none)'}

   🏁 Flags:
${JSON.stringify(state.context.flags || {}, null, 6)}

   📝 Mandatory Fields:
      - customers_main_ask: ${state.context.customers_main_ask || '(not set)'}
      - customer_phone_number: ${state.context.customer_phone_number || '(not set)'}

   📋 Other Context Fields:
      - customer_name: ${state.context.customer_name || '(not set)'}
      - service_catalog: ${state.context.matching_service_catalog_to_solve_customers_issue || '(not set)'}
      - task_id: ${state.context.task_id || '(not set)'}
      - next_node_to_go_to: ${state.context.next_node_to_go_to || '(not set)'}
      - next_course_of_action: ${state.context.next_course_of_action || '(not set)'}

   🛤️  Node Traversal Path: ${JSON.stringify(state.context.node_traversal_path || [])}

   💬 Conversation History (${(state.context.summary_of_conversation_on_each_step_until_now || []).length} exchanges):
${(state.context.summary_of_conversation_on_each_step_until_now || []).slice(-3).map((ex: any, idx: number) => `      ${ex.index || idx}. [CUSTOMER] ${ex.customer.substring(0, 80)}${ex.customer.length > 80 ? '...' : ''}\n         [AGENT] ${ex.agent.substring(0, 80)}${ex.agent.length > 80 ? '...' : ''}`).join('\n')}
`;
    await this.appendToLog(entry);
  }

  /**
   * Log LLM call (before making the call)
   */
  async logLLMCall(args: {
    agentType: string;
    model: string;
    messages: ChatCompletionMessageParam[];
    temperature: number;
    maxTokens: number;
    jsonMode: boolean;
    tools?: any[];
    sessionId?: string;
  }): Promise<void> {
    const systemMsg = args.messages.find(m => m.role === 'system');
    const userMsg = args.messages.find(m => m.role === 'user');
    const systemPrompt = systemMsg && typeof systemMsg.content === 'string' ? systemMsg.content : '';
    const userPrompt = userMsg && typeof userMsg.content === 'string' ? userMsg.content : '';

    const entry = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 [LLM CALL] Agent: ${args.agentType}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ Timestamp: ${new Date().toISOString()}
${args.sessionId ? `🆔 Session: ${args.sessionId.substring(0, 8)}...\n` : ''}🔧 Model: ${args.model}
🌡️  Temperature: ${args.temperature}
📊 Max Tokens: ${args.maxTokens}
📝 JSON Mode: ${args.jsonMode ? 'YES' : 'NO'}
💬 Message Count: ${args.messages.length}
${args.tools ? `🛠️  Tools: ${args.tools.length} available\n` : ''}
┌─── SYSTEM PROMPT (FULL) ────────────────────────────────────────────────────┐
${systemPrompt}
└──────────────────────────────────────────────────────────────────────────────┘

┌─── USER PROMPT (FULL) ──────────────────────────────────────────────────────┐
${userPrompt}
└──────────────────────────────────────────────────────────────────────────────┘

${args.messages.length > 2 ? `📜 Full Message History (${args.messages.length} messages):\n${args.messages.map((msg, idx) => `   ${idx + 1}. [${msg.role.toUpperCase()}] ${typeof msg.content === 'string' ? msg.content.substring(0, 150) : '(complex)'}...`).join('\n')}\n` : ''}`;
    await this.appendToLog(entry);
  }

  /**
   * Log LLM response (after receiving the response)
   */
  async logLLMResponse(args: {
    agentType: string;
    content: string;
    tokensUsed: number;
    promptTokens: number;
    completionTokens: number;
    costCents: number;
    latencyMs: number;
    toolCalls?: any[];
    sessionId?: string;
  }): Promise<void> {
    const entry = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ [LLM RESPONSE] Agent: ${args.agentType}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ Timestamp: ${new Date().toISOString()}
${args.sessionId ? `🆔 Session: ${args.sessionId.substring(0, 8)}...\n` : ''}📊 Tokens: ${args.tokensUsed} (prompt: ${args.promptTokens}, completion: ${args.completionTokens})
💰 Cost: $${(args.costCents / 100).toFixed(4)}
⚡ Latency: ${args.latencyMs}ms
${args.toolCalls ? `🛠️  Tool Calls: ${args.toolCalls.length}\n${JSON.stringify(args.toolCalls, null, 2)}\n` : ''}
┌─── RESPONSE (FULL) ─────────────────────────────────────────────────────────┐
${args.content}
└──────────────────────────────────────────────────────────────────────────────┘

`;
    await this.appendToLog(entry);
  }

  /**
   * Log agent execution (worker, navigator, etc.)
   */
  async logAgentExecution(args: {
    agentType: 'worker_reply' | 'worker_mcp' | 'navigator';
    nodeName: string;
    result: any;
    sessionId?: string;
  }): Promise<void> {
    const entry = `
🎭 [AGENT EXECUTION] ${args.agentType.toUpperCase()}
   Node: ${args.nodeName}
   ${args.sessionId ? `Session: ${args.sessionId.substring(0, 8)}...\n   ` : ''}Timestamp: ${new Date().toISOString()}

   Result:
${JSON.stringify(args.result, null, 6)}

`;
    await this.appendToLog(entry);
  }

  /**
   * Log navigator decision
   */
  async logNavigatorDecision(args: {
    currentNode: string;
    decision: string;
    nextNode: string;
    reason: string;
    contextUpdates?: any;
    sessionId?: string;
  }): Promise<void> {
    const entry = `
🧭 [NAVIGATOR DECISION]
   From Node: ${args.currentNode}
   Decision: ${args.decision}
   Next Node: ${args.nextNode}
   Reason: ${args.reason}
   ${args.sessionId ? `Session: ${args.sessionId.substring(0, 8)}...\n   ` : ''}Timestamp: ${new Date().toISOString()}
   ${args.contextUpdates ? `\n   Context Updates:\n${JSON.stringify(args.contextUpdates, null, 6)}` : ''}

`;
    await this.appendToLog(entry);
  }

  /**
   * Log conversation turn (user message + AI response)
   */
  async logConversationTurn(args: {
    userMessage: string;
    aiResponse: string;
    sessionId?: string;
  }): Promise<void> {
    const entry = `
💬 [CONVERSATION TURN]
   ${args.sessionId ? `Session: ${args.sessionId.substring(0, 8)}...\n   ` : ''}Timestamp: ${new Date().toISOString()}

   👤 USER: ${args.userMessage}

   🤖 AI: ${args.aiResponse}

`;
    await this.appendToLog(entry);
  }

  /**
   * Log iteration end
   */
  async logIterationEnd(args: {
    iteration: number;
    nextNode: string;
    conversationEnded: boolean;
    endReason?: string;
    sessionId?: string;
  }): Promise<void> {
    const entry = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✔️  ITERATION ${args.iteration} COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Next Node: ${args.nextNode}
   Conversation Ended: ${args.conversationEnded ? 'YES' : 'NO'}
   ${args.endReason ? `End Reason: ${args.endReason}\n   ` : ''}${args.sessionId ? `Session: ${args.sessionId.substring(0, 8)}...\n   ` : ''}Timestamp: ${new Date().toISOString()}

`;
    await this.appendToLog(entry);
  }

  /**
   * Log session end
   */
  async logSessionEnd(args: {
    sessionId: string;
    endReason: string;
    totalIterations: number;
    totalMessages: number;
  }): Promise<void> {
    const entry = `
╔════════════════════════════════════════════════════════════════════════════════╗
║                              SESSION ENDED                                     ║
╚════════════════════════════════════════════════════════════════════════════════╝
🆔 Session ID: ${args.sessionId}
📅 Timestamp: ${new Date().toISOString()}
🏁 End Reason: ${args.endReason}
🔄 Total Iterations: ${args.totalIterations}
💬 Total Messages: ${args.totalMessages}

`;
    await this.appendToLog(entry);
  }

  /**
   * Log error
   */
  async logError(args: {
    component: string;
    error: Error;
    context?: any;
    sessionId?: string;
  }): Promise<void> {
    const entry = `
❌ [ERROR] ${args.component}
   ${args.sessionId ? `Session: ${args.sessionId.substring(0, 8)}...\n   ` : ''}Timestamp: ${new Date().toISOString()}
   Error: ${args.error.message}
   Stack: ${args.error.stack}
   ${args.context ? `\n   Context:\n${JSON.stringify(args.context, null, 6)}` : ''}

`;
    await this.appendToLog(entry);
  }

  /**
   * Log arbitrary message
   */
  async log(message: string): Promise<void> {
    const entry = `[${new Date().toISOString()}] ${message}`;
    await this.appendToLog(entry);
  }
}

/**
 * Singleton instance
 */
let instance: LLMLoggerService | null = null;

export function getLLMLogger(): LLMLoggerService {
  if (!instance) {
    instance = new LLMLoggerService();
  }
  return instance;
}
