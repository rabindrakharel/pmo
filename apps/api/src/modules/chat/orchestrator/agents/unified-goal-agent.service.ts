/**
 * Unified Goal Agent - Reusable LLM Session Pattern
 *
 * Responsibilities:
 * - Maintain ONE conversation thread per goal session
 * - Load MCP tools ONCE during goal initialization
 * - Incrementally build context through conversation
 * - Return standardized JSON: { commands_to_run: [...], ask_talk_reply_to_customer: "..." }
 *
 * @module orchestrator/agents/unified-goal-agent
 * @version 5.0.0 - Session-Based Conversation Management
 */

import { getOpenAIService } from '../services/openai.service.js';
import type { AgentContextState } from './agent-context.service.js';
import type { AgentConfigV3, ConversationGoal, AgentProfile } from '../config/agent-config.schema.js';
import type { MCPAdapterService } from '../../mcp-adapter.service.js';
import { getMCPTools, executeMCPTool } from '../../mcp-adapter.service.js';
import { replacePlaceholders } from '../utils/json-path-resolver.js';
import { createToolEnrichmentEngine, type ToolEnrichmentEngine } from '../lib/tool-enrichment-engine.service.js';
import type { DAGContext } from './dag-types.js';

/**
 * Standardized goal execution output
 */
export interface UnifiedGoalResult {
  commands_to_run: string[];               // MCP tools to execute (parallel)
  ask_talk_reply_to_customer: string;      // Single customer response (not array)
  session_memory_data_update?: {           // Session memory data updates (customer.*, service.*, etc.)
    customer?: Record<string, any>;
    service?: Record<string, any>;
    operations?: Record<string, any>;
    project?: Record<string, any>;
    assignment?: Record<string, any>;
  };
  contextUpdates?: Partial<DAGContext>;    // Context updates from MCP execution (empty until promise resolves)
  mcpResults?: any;                        // Raw MCP results (null until promise resolves)
  mcpExecutionPromise?: Promise<{          // Promise for MCP execution (orchestrator awaits before state transition)
    contextUpdates: Partial<DAGContext>;
    mcpResults: any;
  }> | null;
}

/**
 * Goal conversation session
 * Stores conversation history and MCP tools for a specific goal
 */
interface GoalConversationSession {
  goalId: string;
  sessionId: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  mcpTools: any[];  // MCP tools loaded once during initialization
  initialized: boolean;
  initTimestamp: Date;
}

/**
 * Unified Goal Agent Service
 * ONE reusable LLM conversation per goal session, MCP tools loaded once
 */
export class UnifiedGoalAgent {
  private config: AgentConfigV3;
  private mcpAdapter?: MCPAdapterService;
  private authToken?: string;
  private enrichmentEngine: ToolEnrichmentEngine;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SESSION-LEVEL CONVERSATION MANAGEMENT
  // Key: `${sessionId}_${goalId}` → Conversation thread
  // MCP tools sent ONCE in system message during initialization
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  private goalConversations: Map<string, GoalConversationSession> = new Map();

  constructor(
    config: AgentConfigV3,
    mcpAdapter?: MCPAdapterService,
    authToken?: string
  ) {
    this.config = config;
    this.mcpAdapter = mcpAdapter;
    this.authToken = authToken;
    this.enrichmentEngine = createToolEnrichmentEngine(config);

    console.log(`[UnifiedGoalAgent] 🎯 Initialized with session-based conversation management (v5.0)`);
    console.log(`[UnifiedGoalAgent] ✨ MCP tools loaded ONCE per goal, context builds incrementally`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SESSION MANAGEMENT METHODS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Initialize conversation for a goal (called once per goal session)
   * Loads MCP tools and creates system message with goal context
   */
  private initializeGoalConversation(
    goalId: string,
    sessionId: string,
    state: AgentContextState
  ): GoalConversationSession {
    console.log(`\n🆕 [UnifiedGoalAgent] Initializing conversation for goal: ${goalId}`);

    // Get goal configuration
    const goal = this.config.goals.find(g => g.goal_id === goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    // Determine agent profile
    const primaryAgent = (goal as any).primary_agent || 'conversational_agent';
    const agentProfile = this.config.agent_profiles[primaryAgent];
    if (!agentProfile) {
      throw new Error(`Agent profile not found: ${primaryAgent}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // LOAD MCP TOOLS ONCE (sent in system message)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const entityBoundary = this.determineEntityBoundary(state, agentProfile);
    let mcpTools = this.mcpAdapter ? getMCPTools({
      categories: entityBoundary,
      maxTools: 40
    }) : [];

    // Filter by goal's mcp_tool_boundary (v3.1 feature)
    if ((goal as any).mcp_tool_boundary && Array.isArray((goal as any).mcp_tool_boundary)) {
      const toolBoundary = (goal as any).mcp_tool_boundary as string[];
      mcpTools = mcpTools.filter((tool: any) => toolBoundary.includes(tool.name));
      console.log(`[UnifiedGoalAgent] 🔒 Applied mcp_tool_boundary filter: ${toolBoundary.length} allowed tools`);
    }

    console.log(`[UnifiedGoalAgent] 📦 Loaded ${mcpTools.length} MCP tools for goal ${goalId}`);
    console.log(`[UnifiedGoalAgent] 🎯 Agent Profile: ${agentProfile.identity}`);

    // Build system message with goal + MCP tools
    const systemPrompt = this.buildUnifiedPrompt(
      agentProfile,
      goal,
      state,
      mcpTools
    );

    const conversation: GoalConversationSession = {
      goalId,
      sessionId,
      messages: [{ role: 'system', content: systemPrompt }],
      mcpTools,
      initialized: true,
      initTimestamp: new Date()
    };

    const conversationKey = `${sessionId}_${goalId}`;
    this.goalConversations.set(conversationKey, conversation);

    console.log(`[UnifiedGoalAgent] ✅ Conversation initialized for ${goalId} (${mcpTools.length} tools)`);
    console.log(`[UnifiedGoalAgent] 📝 System message length: ${systemPrompt.length} chars`);

    return conversation;
  }

  /**
   * Get or initialize conversation for a goal
   */
  private getOrInitializeConversation(
    goalId: string,
    sessionId: string,
    state: AgentContextState
  ): GoalConversationSession {
    const conversationKey = `${sessionId}_${goalId}`;
    let conversation = this.goalConversations.get(conversationKey);

    // Check if conversation exists and matches goal
    if (!conversation || conversation.goalId !== goalId) {
      conversation = this.initializeGoalConversation(goalId, sessionId, state);
    } else {
      console.log(`[UnifiedGoalAgent] ♻️  Reusing existing conversation for ${goalId} (${conversation.messages.length} messages)`);
    }

    return conversation;
  }

  /**
   * Clear conversation for a goal (called on goal transition)
   */
  clearGoalConversation(sessionId: string, goalId: string): void {
    const conversationKey = `${sessionId}_${goalId}`;
    const conversation = this.goalConversations.get(conversationKey);

    if (conversation) {
      console.log(`[UnifiedGoalAgent] 🗑️  Clearing conversation for goal: ${goalId} (${conversation.messages.length} messages)`);
      this.goalConversations.delete(conversationKey);
    }
  }

  /**
   * Clear all conversations for a session (on session end)
   */
  clearSessionConversations(sessionId: string): void {
    const keysToDelete: string[] = [];

    this.goalConversations.forEach((conversation, key) => {
      if (conversation.sessionId === sessionId) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      const conversation = this.goalConversations.get(key);
      if (conversation) {
        console.log(`[UnifiedGoalAgent] 🗑️  Clearing conversation for goal: ${conversation.goalId}`);
        this.goalConversations.delete(key);
      }
    });

    if (keysToDelete.length > 0) {
      console.log(`[UnifiedGoalAgent] 🧹 Cleared ${keysToDelete.length} conversations for session ${sessionId}`);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GOAL EXECUTION METHODS (Updated to use session management)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Execute goal with STREAMING: Stream customer response while MCP executes in background
   *
   * Flow:
   * 1. Get or initialize conversation (MCP tools loaded ONCE)
   * 2. Append user message to conversation
   * 3. Stream LLM response token by token (using full conversation history)
   * 4. Parse JSON and stream ask_talk_reply_to_customer
   * 5. Execute commands_to_run in parallel (background)
   * 6. Append assistant response to conversation
   * 7. Yield done when streaming + MCP complete
   */
  async *executeGoalStream(
    goalId: string,
    state: AgentContextState,
    userMessage?: string
  ): AsyncGenerator<{
    token?: string;
    done: boolean;
    response?: string;
    commands_to_run?: string[];
    session_memory_data_update?: any;
    mcpExecutionPromise?: Promise<{
      contextUpdates: Partial<DAGContext>;
      mcpResults: any;
    }> | null;
  }> {
    console.log(`\n🎯 [UnifiedGoalAgent] Streaming goal: ${goalId}`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SESSION-BASED CONVERSATION MANAGEMENT
    // Get or initialize conversation (MCP tools loaded ONCE on first call)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const conversation = this.getOrInitializeConversation(goalId, state.sessionId, state);

    // Build user prompt (if user message provided)
    if (userMessage) {
      const goal = this.config.goals.find(g => g.goal_id === goalId)!;
      const userPrompt = this.buildUserPrompt(userMessage, goal);
      conversation.messages.push({ role: 'user', content: userPrompt });
      console.log(`[UnifiedGoalAgent] 💬 Added user message to conversation (${conversation.messages.length} total messages)`);
    }

    console.log(`[UnifiedGoalAgent] 📤 Streaming with ${conversation.messages.length} messages (${conversation.mcpTools.length} tools available)`);

    // Stream LLM response using FULL conversation history
    const openaiService = getOpenAIService();
    let fullResponse = '';
    let llmOutput: any;

    try {
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // STREAM LLM RESPONSE USING CONVERSATION HISTORY
      // System message with MCP tools already in conversation (sent once)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      for await (const chunk of openaiService.callAgentStream({
        agentType: 'unified_goal',
        messages: conversation.messages,  // ✅ Incremental context building!
        temperature: 0.7,
        jsonMode: true,  // Enable JSON response format
        sessionId: state.sessionId,
      })) {
        if (chunk.done) {
          // LLM streaming complete - parse JSON
          try {
            llmOutput = JSON.parse(fullResponse || '{}');
          } catch (error) {
            console.error(`[UnifiedGoalAgent] ❌ Failed to parse LLM output as JSON`);
            llmOutput = {
              commands_to_run: [],
              ask_talk_reply_to_customer: fullResponse || 'I apologize, but I encountered an issue processing your request.'
            };
          }

          // Validate output structure
          if (!llmOutput.commands_to_run) {
            llmOutput.commands_to_run = [];
          }
          if (!llmOutput.ask_talk_reply_to_customer) {
            llmOutput.ask_talk_reply_to_customer = fullResponse || '';
          }

          // Ensure commands_to_run is array
          if (!Array.isArray(llmOutput.commands_to_run)) {
            llmOutput.commands_to_run = [];
          }

          // Ensure ask_talk_reply_to_customer is string (not array)
          if (Array.isArray(llmOutput.ask_talk_reply_to_customer)) {
            llmOutput.ask_talk_reply_to_customer = llmOutput.ask_talk_reply_to_customer[0] || '';
          }

          // Extract session_memory_data_update (optional)
          const sessionMemoryUpdate = llmOutput.session_memory_data_update || null;

          console.log(`[UnifiedGoalAgent] 📋 LLM Output:`);
          console.log(`   commands_to_run: ${llmOutput.commands_to_run.length} tools`);
          console.log(`   ask_talk_reply_to_customer: "${llmOutput.ask_talk_reply_to_customer.substring(0, 80)}..."`);
          if (sessionMemoryUpdate) {
            const categories = Object.keys(sessionMemoryUpdate);
            console.log(`   session_memory_data_update: ${categories.length} categories (${categories.join(', ')})`);
          }

          // Now stream the customer response token by token
          const customerResponse = llmOutput.ask_talk_reply_to_customer;

          // Split response into words for progressive streaming
          const words = customerResponse.split(' ');
          for (let i = 0; i < words.length; i++) {
            const token = i === 0 ? words[i] : ' ' + words[i];
            yield {
              token,
              done: false,
            };
          }

          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          // APPEND ASSISTANT RESPONSE TO CONVERSATION (for next iteration)
          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          conversation.messages.push({ role: 'assistant', content: fullResponse });
          console.log(`[UnifiedGoalAgent] 📝 Added assistant response to conversation (${conversation.messages.length} total messages)`);

          // Start MCP execution in background (if needed)
          let mcpExecutionPromise: Promise<{
            contextUpdates: Partial<DAGContext>;
            mcpResults: any;
          }> | null = null;

          if (llmOutput.commands_to_run.length > 0 && this.mcpAdapter) {
            console.log(`\n⚡ [PARALLEL MCP EXECUTION] Starting ${llmOutput.commands_to_run.length} tools (async)...`);
            mcpExecutionPromise = this.executeMCPCommands(llmOutput, state);
          }

          // Yield final done chunk
          console.log(`[UnifiedGoalAgent] ✅ Streaming complete (${customerResponse.length} chars)`);
          yield {
            token: '',
            done: true,
            response: customerResponse,
            commands_to_run: llmOutput.commands_to_run,
            session_memory_data_update: sessionMemoryUpdate,
            mcpExecutionPromise,
          };

        } else {
          // Accumulate JSON response (don't stream yet - wait for full JSON)
          fullResponse += chunk.token;
        }
      }
    } catch (error: any) {
      console.error(`[UnifiedGoalAgent] ❌ Streaming error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute goal: Single LLM call returns standardized JSON (NON-STREAMING)
   *
   * Flow:
   * 1. Get or initialize conversation (MCP tools loaded ONCE)
   * 2. Append user message to conversation
   * 3. Call LLM with full conversation history to get { commands_to_run, ask_talk_reply_to_customer }
   * 4. Append assistant response to conversation
   * 5. Execute commands_to_run in parallel
   * 6. Return ask_talk_reply_to_customer as response
   */
  async executeGoal(
    goalId: string,
    state: AgentContextState,
    userMessage?: string
  ): Promise<UnifiedGoalResult> {
    console.log(`\n🎯 [UnifiedGoalAgent] Executing goal: ${goalId}`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SESSION-BASED CONVERSATION MANAGEMENT
    // Get or initialize conversation (MCP tools loaded ONCE on first call)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const conversation = this.getOrInitializeConversation(goalId, state.sessionId, state);

    // Build user prompt (if user message provided)
    if (userMessage) {
      const goal = this.config.goals.find(g => g.goal_id === goalId)!;
      const userPrompt = this.buildUserPrompt(userMessage, goal);
      conversation.messages.push({ role: 'user', content: userPrompt });
      console.log(`[UnifiedGoalAgent] 💬 Added user message to conversation (${conversation.messages.length} total messages)`);
    }

    console.log(`[UnifiedGoalAgent] 📤 Calling LLM with ${conversation.messages.length} messages (${conversation.mcpTools.length} tools available)`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CALL LLM USING CONVERSATION HISTORY
    // System message with MCP tools already in conversation (sent once)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const openaiService = getOpenAIService();
    const result = await openaiService.callAgent({
      agentType: 'unified_goal',
      messages: conversation.messages,  // ✅ Incremental context building!
      temperature: 0.7,
      jsonMode: true,  // Enable JSON response format
      sessionId: state.sessionId,
    });

    // Parse LLM output
    let llmOutput: any;
    try {
      llmOutput = JSON.parse(result.content || '{}');
    } catch (error) {
      console.error(`[UnifiedGoalAgent] ❌ Failed to parse LLM output as JSON`);
      llmOutput = {
        commands_to_run: [],
        ask_talk_reply_to_customer: result.content || 'I apologize, but I encountered an issue processing your request.'
      };
    }

    // Validate output structure
    if (!llmOutput.commands_to_run) {
      llmOutput.commands_to_run = [];
    }
    if (!llmOutput.ask_talk_reply_to_customer) {
      llmOutput.ask_talk_reply_to_customer = result.content || '';
    }

    // Ensure commands_to_run is array
    if (!Array.isArray(llmOutput.commands_to_run)) {
      llmOutput.commands_to_run = [];
    }

    // Ensure ask_talk_reply_to_customer is string (not array)
    if (Array.isArray(llmOutput.ask_talk_reply_to_customer)) {
      llmOutput.ask_talk_reply_to_customer = llmOutput.ask_talk_reply_to_customer[0] || '';
    }

    // Extract session_memory_data_update (optional)
    const sessionMemoryUpdate = llmOutput.session_memory_data_update || null;

    console.log(`[UnifiedGoalAgent] 📋 LLM Output:`);
    console.log(`   commands_to_run: ${llmOutput.commands_to_run.length} tools`);
    console.log(`   ask_talk_reply_to_customer: "${llmOutput.ask_talk_reply_to_customer.substring(0, 80)}..."`);
    if (sessionMemoryUpdate) {
      const categories = Object.keys(sessionMemoryUpdate);
      console.log(`   session_memory_data_update: ${categories.length} categories (${categories.join(', ')})`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // APPEND ASSISTANT RESPONSE TO CONVERSATION (for next iteration)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    conversation.messages.push({ role: 'assistant', content: result.content || '' });
    console.log(`[UnifiedGoalAgent] 📝 Added assistant response to conversation (${conversation.messages.length} total messages)`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PARALLEL EXECUTION: MCP commands + Customer reply
    // 1. Start MCP execution (async, don't await yet)
    // 2. Return reply immediately
    // 3. Orchestrator can send reply while MCP executes in background
    // 4. Await MCP completion via mcpExecutionPromise before state transition
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    let mcpExecutionPromise: Promise<{
      contextUpdates: Partial<DAGContext>;
      mcpResults: any;
    }> | null = null;

    if (llmOutput.commands_to_run.length > 0 && this.mcpAdapter) {
      console.log(`\n⚡ [PARALLEL MCP EXECUTION] Starting ${llmOutput.commands_to_run.length} tools (async)...`);

      // Start MCP execution but DON'T await - let it run in background
      mcpExecutionPromise = this.executeMCPCommands(llmOutput, state);
    }

    // Return immediately with reply + MCP execution promise
    // Orchestrator can send reply while MCP executes
    return {
      commands_to_run: llmOutput.commands_to_run,
      ask_talk_reply_to_customer: llmOutput.ask_talk_reply_to_customer,
      session_memory_data_update: sessionMemoryUpdate,
      contextUpdates: {}, // Will be populated after MCP completion
      mcpResults: null,   // Will be populated after MCP completion
      mcpExecutionPromise, // Orchestrator awaits this before state transition
    };
  }

  /**
   * Execute MCP commands in parallel (background)
   * Returns promise that resolves with context updates
   */
  private async executeMCPCommands(
    llmOutput: any,
    state: AgentContextState
  ): Promise<{
    contextUpdates: Partial<DAGContext>;
    mcpResults: any;
  }> {
    const mcpPromises = llmOutput.commands_to_run.map(async (toolName: string) => {
      try {
        console.log(`   Executing: ${toolName}`);

        // Get tool arguments from LLM output (if provided)
        const toolArgs = llmOutput[`${toolName}_args`] || {};

        // Enrich arguments with context data
        const enrichedArgs = this.enrichmentEngine.enrichToolArguments(
          toolName,
          toolArgs,
          state
        );

        const toolResult = await executeMCPTool(
          toolName,
          enrichedArgs,
          this.authToken || ''
        );

        console.log(`   ✅ ${toolName} succeeded`);
        return { toolName, result: toolResult, error: null };
      } catch (error: any) {
        console.error(`   ❌ ${toolName} failed: ${error.message}`);
        return { toolName, result: null, error: error.message };
      }
    });

    const mcpResultsArray = await Promise.all(mcpPromises);

    // Process results and update context
    let contextUpdates: Partial<DAGContext> = {};
    for (const { toolName, result, error } of mcpResultsArray) {
      if (result && !error) {
        const updates = this.mapMCPResultsToContext(toolName, result);
        contextUpdates = { ...contextUpdates, ...updates };
      }
    }

    const successCount = mcpResultsArray.filter(r => !r.error).length;
    console.log(`\n   ✅ MCP execution complete: ${successCount}/${llmOutput.commands_to_run.length} tools succeeded`);
    this.logContextUpdates(contextUpdates);

    return {
      contextUpdates,
      mcpResults: mcpResultsArray
    };
  }

  /**
   * Build unified prompt with standardized structure
   *
   * Structure:
   * - Role (from agent profile)
   * - Goal (from goal config)
   * - Prompt with session memory data infused
   * - Useful MCP manifest (available tools)
   * - Example input/output pairs
   */
  private buildUnifiedPrompt(
    agentProfile: AgentProfile,
    goal: ConversationGoal,
    state: AgentContextState,
    tools: any[]
  ): string {
    // Build session memory data section
    const sessionMemoryData = this.buildSessionMemoryDataSection(goal, state.context);

    // Replace placeholders in system prompt
    let systemPromptWithValues = replacePlaceholders(agentProfile.system_prompt, state.context);
    systemPromptWithValues = systemPromptWithValues.replace(
      '{{SESSION_MEMORY_DATA}}',
      sessionMemoryData
    );

    const goalDescriptionWithValues = replacePlaceholders(goal.description, state.context);

    // Format MCP tools manifest
    const mcpManifest = tools.length > 0 ? tools.map(t =>
      `- ${t.function.name}: ${t.function.description}\n  Parameters: ${JSON.stringify(t.function.parameters?.properties || {}, null, 2)}`
    ).join('\n\n') : '(No MCP tools available for this goal)';

    // Get examples from goal config
    const examples = (goal as any).examples || [];
    const examplesSection = examples.length > 0 ? examples.map((ex: any, i: number) =>
      `## Example ${i + 1}:\n\nInput:\n${ex.input}\n\nExpected Output:\n\`\`\`json\n${JSON.stringify(ex.output, null, 2)}\n\`\`\``
    ).join('\n\n') : '';

    // Get conversation tactics
    const tactics = (goal.conversation_tactics || [])
      .map((tacticId: string) => {
        const tactic = this.config.conversation_tactics[tacticId];
        return tactic ? `- ${tactic.description}` : '';
      })
      .filter(Boolean)
      .join('\n');

    return `# ROLE
${agentProfile.identity}

# GOAL
${goalDescriptionWithValues}

**Success Criteria (what we need to complete THIS goal):**
${this.extractMandatoryFields(goal).map(f => `- ${f}`).join('\n')}

# PROMPT WITH SESSION MEMORY DATA

${systemPromptWithValues}

# USEFUL MCP MANIFEST

Available MCP tools you can use (add tool names to "commands_to_run" array):

${mcpManifest}

**Tool Usage Instructions:**
1. Add tool names to "commands_to_run" array (they will execute in parallel)
2. For each tool, provide arguments as "{toolName}_args" in your JSON output
3. Tools will be enriched with session data automatically
4. All tools execute BEFORE your reply is sent to customer

**Conversation Tactics:**
${tactics}

${examplesSection ? `\n# EXAMPLES\n\n${examplesSection}` : ''}

# OUTPUT FORMAT (JSON ONLY)

You MUST respond with valid JSON matching this structure:

\`\`\`json
{
  "commands_to_run": ["tool1", "tool2"],  // Array of MCP tool names (parallel execution)
  "tool1_args": { "param": "value" },     // Arguments for each tool (optional, will be auto-enriched)
  "tool2_args": { "param": "value" },
  "ask_talk_reply_to_customer": "Your response to customer here",  // Single string (NOT array)
  "session_memory_data_update": {         // OPTIONAL: Extract customer data from conversation
    "customer": {
      "name": "John Doe",                 // Customer full name (if mentioned)
      "phone": "555-1234",                // Phone number (if mentioned)
      "email": "john@example.com",        // Email (if mentioned)
      "address_street": "123 Main St",    // Street address component
      "address_city": "Toronto",          // City component
      "address_state": "Ontario",         // State/Province component
      "address_zipcode": "M5V 3A8"        // Postal code component
    },
    "service": {
      "primary_request": "Roof leak repair"  // Main issue (if mentioned, 5-10 words)
    }
  }
}
\`\`\`

**CRITICAL RULES:**
1. "ask_talk_reply_to_customer" MUST be a string (not array, not object)
2. "commands_to_run" MUST be an array of tool names (can be empty [])
3. "session_memory_data_update" is OPTIONAL - only include if customer provides new information in THIS exchange
4. Keep customer response natural, empathetic, and concise (1-3 sentences)
5. Only include MCP tools if you need to fetch/update data
6. Tools execute in parallel BEFORE your response is sent

**SESSION MEMORY DATA UPDATE RULES:**
- ONLY include "session_memory_data_update" if customer explicitly mentioned new information in THIS conversation turn
- Extract from CUSTOMER messages ONLY (not your own agent responses)
- Don't infer or assume - only extract explicitly stated information
- For addresses, break into components: address_street, address_city, address_state, address_zipcode
- Deep merge behavior: Only include fields you want to UPDATE (existing fields preserved)
- Example: If customer says "My name is Jane", only include: { "customer": { "name": "Jane" } }

Generate your JSON response now:`;
  }

  /**
   * Build user prompt
   */
  private buildUserPrompt(userMessage?: string, goal?: ConversationGoal): string {
    if (userMessage) {
      return `Customer just said: "${userMessage}"\n\nGenerate JSON response to progress toward goal: ${goal?.description}`;
    }
    return `Generate JSON response to progress toward goal: ${goal?.description}`;
  }

  /**
   * Extract mandatory fields from goal_success_criteria (v3.0 format)
   */
  private extractMandatoryFields(goal: ConversationGoal): string[] {
    if (!goal.goal_success_criteria) {
      return [];
    }

    const fields: string[] = [];

    // Extract from all_of conditions
    if (goal.goal_success_criteria.all_of) {
      for (const condition of goal.goal_success_criteria.all_of) {
        if (condition.json_path && condition.operator === 'is_set') {
          fields.push(condition.json_path);
        }
      }
    }

    return fields;
  }

  /**
   * Build session memory data section showing collected fields
   */
  private buildSessionMemoryDataSection(goal: ConversationGoal, context: any): string {
    const dataFields = context.data_extraction_fields || {};
    const mandatoryFields = this.extractMandatoryFields(goal);

    const collectedMandatory: string[] = [];
    const collectedOptional: string[] = [];
    const missingMandatory: string[] = [];

    // Track which mandatory fields we've seen
    const seenMandatoryFields = new Set<string>();

    // First pass: Collect all fields that have values
    Object.entries(dataFields).forEach(([category, fields]) => {
      if (typeof fields === 'object' && fields !== null) {
        Object.entries(fields).forEach(([key, value]) => {
          const fieldPath = `${category}.${key}`;
          const isMandatory = mandatoryFields.includes(fieldPath);
          const hasValue = value && value !== '' && value !== '(unknown)' && value !== '(not set)';

          if (isMandatory) {
            seenMandatoryFields.add(fieldPath);
          }

          if (hasValue) {
            const fieldLabel = this.getFieldLabel(category, key);
            const entry = `  • ${fieldLabel}: "${value}"`;

            if (isMandatory) {
              collectedMandatory.push(entry);
            } else {
              collectedOptional.push(entry);
            }
          }
        });
      }
    });

    // Second pass: Find missing mandatory fields
    mandatoryFields.forEach(fieldPath => {
      const [category, key] = fieldPath.split('.');
      const value = dataFields[category]?.[key];
      const hasValue = value && value !== '' && value !== '(unknown)' && value !== '(not set)';

      if (!hasValue) {
        const fieldLabel = this.getFieldLabel(category, key);
        missingMandatory.push(`  • ${fieldLabel}`);
      }
    });

    // Build formatted output
    const sections: string[] = [];

    // Mandatory fields section
    if (collectedMandatory.length > 0) {
      sections.push('\n✅ MANDATORY (collected for goal: ' + goal.goal_id + '):');
      sections.push(collectedMandatory.join('\n'));
    }

    if (missingMandatory.length > 0) {
      sections.push('\n❌ MANDATORY (still need):');
      sections.push(missingMandatory.join('\n'));
    }

    // Optional fields section
    if (collectedOptional.length > 0) {
      sections.push('\n📌 OPTIONAL (collected):');
      sections.push(collectedOptional.join('\n'));
    }

    // Only show rules if there's data
    if (sections.length > 0) {
      sections.push('\n⚠️ DO NOT ask for ✅ fields above. Only ask for ❌ fields.');
      return sections.join('\n');
    }

    // No data collected yet
    return '\n(No data collected yet - starting fresh)';
  }

  /**
   * Get human-readable label for a field
   */
  private getFieldLabel(category: string, field: string): string {
    const labels: Record<string, string> = {
      'customer.name': 'Customer Name',
      'customer.phone': 'Phone Number',
      'customer.email': 'Email',
      'customer.address_street': 'Street Address',
      'customer.address_city': 'City',
      'customer.address_state': 'State/Province',
      'customer.address_zipcode': 'Postal/Zip Code',
      'customer.address_country': 'Country',
      'customer.id': 'Customer ID',
      'service.primary_request': 'Service Request',
      'service.catalog_match': 'Matched Service',
      'service.related_entities': 'Related Services',
      'operations.solution_plan': 'Solution Plan',
      'operations.task_id': 'Task ID',
      'operations.task_name': 'Task Name',
      'operations.appointment_details': 'Appointment',
      'project.id': 'Project ID',
      'assignment.employee_id': 'Assigned Employee ID',
      'assignment.employee_name': 'Assigned Employee',
    };

    const key = `${category}.${field}`;
    return labels[key] || `${category}.${field}`;
  }

  /**
   * Map MCP tool results to context updates
   */
  private mapMCPResultsToContext(toolName: string, results: any): Partial<DAGContext> {
    const updates: Partial<DAGContext> = {};

    console.log(`[UnifiedGoalAgent] 📋 Mapping results from: ${toolName}`);

    // Service catalog lookup
    if (toolName.includes('service') || toolName.includes('catalog') || toolName.includes('setting')) {
      if (Array.isArray(results)) {
        updates.matching_service_catalog_to_solve_customers_issue = results[0]?.name || results[0]?.label || JSON.stringify(results);
      } else if (results.name || results.label) {
        updates.matching_service_catalog_to_solve_customers_issue = results.name || results.label;
      }
    }

    // Task operations
    if (toolName.includes('task')) {
      if (results.id || results.task_id || results.uuid) {
        updates.task_id = results.id || results.task_id || results.uuid;
      }
      if (results.name) {
        updates.task_name = results.name;
      }
    }

    // Customer operations - Update BOTH flat fields AND nested data_extraction_fields
    if (toolName.includes('customer') || toolName.includes('cust')) {
      // Flat fields (for backward compatibility and MCP context)
      if (results.id) {
        updates.customer_id = results.id;
      }
      if (results.name || results.primary_contact_name) {
        updates.customer_name = results.name || results.primary_contact_name;
      }
      if (results.primary_phone) {
        updates.customer_phone_number = results.primary_phone;
      }
      if (results.primary_email) {
        updates.customer_email = results.primary_email;
      }

      // ⚠️ FIX: Also update nested data_extraction_fields structure
      // This is what prompts read from in buildSessionMemoryDataSection()
      updates.data_extraction_fields = {
        customer: {
          id: results.id,
          name: results.name || results.primary_contact_name,
          phone: results.primary_phone,
          email: results.primary_email,
          address_street: results.primary_address,
          address_city: results.city,
          address_state: results.province,
          address_postal_code: results.postal_code,
        }
      };
    }

    // Employee operations
    if (toolName.includes('employee')) {
      if (results.id) {
        updates.assigned_employee_id = results.id;
      }
      if (results.name) {
        updates.assigned_employee_name = results.name;
      }
    }

    return updates;
  }

  /**
   * Determine entity boundary dynamically
   */
  private determineEntityBoundary(state: AgentContextState, agentProfile: AgentProfile): string[] {
    const entityBoundaryConfig = (agentProfile as any).entity_boundary;
    if (!entityBoundaryConfig) {
      return ['Customer', 'Task', 'Employee', 'Calendar', 'Settings'];
    }

    let entities = new Set<string>(entityBoundaryConfig.default_entities || []);

    const alwaysInclude = entityBoundaryConfig.always_include_categories || [];
    alwaysInclude.forEach((cat: string) => entities.add(cat));

    const extracted = state.context.data_extraction_fields || {};
    const expansionRules = entityBoundaryConfig.expansion_rules || {};

    if (extracted.service?.catalog_match && expansionRules.if_service_catalog_matched) {
      expansionRules.if_service_catalog_matched.add_entities.forEach((e: string) => entities.add(e));
    }

    if (extracted.project?.id && expansionRules.if_project_mentioned) {
      expansionRules.if_project_mentioned.add_entities.forEach((e: string) => entities.add(e));
    }

    const neverInclude = entityBoundaryConfig.never_include_categories || [];
    neverInclude.forEach((cat: string) => entities.delete(cat));

    return Array.from(entities);
  }

  /**
   * Log context updates
   */
  private logContextUpdates(contextUpdates: Partial<DAGContext>): void {
    const updatedFields = Object.keys(contextUpdates).filter(k => k !== 'flags');
    if (updatedFields.length === 0) {
      console.log(`[UnifiedGoalAgent] ℹ️  No context updates from MCP`);
      return;
    }

    console.log(`[UnifiedGoalAgent] 📝 Context updates from MCP: ${updatedFields.join(', ')}`);
    for (const field of updatedFields) {
      console.log(`[UnifiedGoalAgent]    - ${field}: ${contextUpdates[field]}`);
    }
  }

  /**
   * Set auth token for MCP calls
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }
}

/**
 * Create unified goal agent instance
 */
export function createUnifiedGoalAgent(
  config: AgentConfigV3,
  mcpAdapter?: MCPAdapterService,
  authToken?: string
): UnifiedGoalAgent {
  return new UnifiedGoalAgent(config, mcpAdapter, authToken);
}
