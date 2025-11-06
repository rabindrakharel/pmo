/**
 * LangGraph Orchestrator Service
 * Main service for executing multi-agent workflows
 * @module orchestrator/langgraph/langgraph-orchestrator
 */

import { v4 as uuidv4 } from 'uuid';
import { StateManager } from '../state/state-manager.service.js';
import { MCPAdapterService } from '../../mcp-adapter.service.js';
import { getOpenAIService } from '../services/openai.service.js';
import { AgentCoordinatorService } from '../agents/agent-coordinator.service.js';
import { WorkflowState } from '../state/state-machine.service.js';

/**
 * LangGraph Orchestrator Service (Multi-Agent)
 */
export class LangGraphOrchestratorService {
  private stateManager: StateManager;
  private mcpAdapter: MCPAdapterService;
  private coordinator: AgentCoordinatorService;

  constructor() {
    this.stateManager = new StateManager();
    this.mcpAdapter = new MCPAdapterService();
    this.coordinator = new AgentCoordinatorService(this.stateManager, this.mcpAdapter);

    console.log('[LangGraphOrchestrator] Initialized multi-agent coordinator');
  }

  /**
   * Process a user message through the multi-agent orchestrator
   */
  async processMessage(args: {
    sessionId?: string;
    message: string;
    chatSessionId?: string;
    userId?: string;
    authToken?: string;
  }): Promise<{
    sessionId: string;
    response: string;
    intent: string;
    currentNode: string;
    requiresUserInput: boolean;
    completed: boolean;
    conversationEnded: boolean;
    endReason?: string;
    engagingMessage?: string;
  }> {
    try {
      let sessionId = args.sessionId;
      let currentState: WorkflowState;
      let variables: Record<string, any> = {};

      if (!sessionId) {
        // New session - create it
        sessionId = uuidv4();
        currentState = WorkflowState.GREETING;

        console.log(`[LangGraphOrchestrator] New session ${sessionId}, starting at GREETING`);

        // Create session in database
        await this.stateManager.createSession({
          session_id: sessionId,
          chat_session_id: args.chatSessionId,
          user_id: args.userId,
          current_intent: 'CalendarBooking',
          current_node: currentState,
          auth_metadata: { authToken: args.authToken },
        });
      } else {
        // Existing session - load state
        const session = await this.stateManager.getSession(sessionId);
        if (!session) {
          throw new Error(`Session ${sessionId} not found`);
        }

        // Get workflow state from session
        const sessionData = session as any;
        currentState = (sessionData.workflow_state || session.current_node || WorkflowState.GREETING) as WorkflowState;

        // Load variables
        const allState = await this.stateManager.getAllState(sessionId);
        variables = Object.keys(allState)
          .filter(key => !key.startsWith('_'))
          .reduce((acc, key) => {
            acc[key] = allState[key];
            return acc;
          }, {} as Record<string, any>);

        console.log(`[LangGraphOrchestrator] Existing session ${sessionId}, state: ${currentState}`);
      }

      // Extract data from user message
      const extractedData = await this.extractDataFromMessage(args.message, variables);
      variables = { ...variables, ...extractedData };

      console.log(`[LangGraphOrchestrator] Variables after extraction:`, variables);

      // Process through agent coordinator
      const result = await this.coordinator.processMessage({
        sessionId,
        currentState,
        userMessage: args.message,
        variables,
        authToken: args.authToken,
        chatSessionId: args.chatSessionId,
      });

      // Save result variables to database
      if (result.variables) {
        const nonEmptyVars = Object.entries(result.variables)
          .filter(([key, value]) => value !== undefined && value !== null && value !== '')
          .reduce((acc, [key, value]) => {
            acc[key] = value;
            return acc;
          }, {} as Record<string, any>);

        if (Object.keys(nonEmptyVars).length > 0) {
          console.log(`[LangGraphOrchestrator] Saving variables to database:`, nonEmptyVars);
          for (const [key, value] of Object.entries(nonEmptyVars)) {
            await this.stateManager.setState(sessionId, key, value, {
              source: 'agent_coordinator',
              node_context: result.nextState,
              validated: true,
            });
          }
        }
      }

      // Update session with new state
      await this.stateManager.updateSession(sessionId, {
        current_node: result.nextState,
        status: result.completed ? 'completed' : 'active',
      });

      // Update workflow_state column (added by 40_orchestrator_agents.ddl)
      try {
        await this.stateManager.setState(sessionId, '_workflow_state', result.nextState, {
          source: 'state_machine',
          validated: true,
        });
      } catch (error) {
        // Column might not exist yet - ignore
      }

      // Automatically disconnect voice session if conversation ended
      if (result.conversationEnded && args.chatSessionId) {
        try {
          const { disconnectVoiceLangraphSession } = await import('../../voice-langraph.service.js');
          const disconnected = disconnectVoiceLangraphSession(args.chatSessionId);

          if (disconnected) {
            console.log(`📞 Voice session ${args.chatSessionId} auto-disconnected (${result.endReason})`);
          }
        } catch (error) {
          console.error('Error disconnecting voice session:', error);
        }

        // Clear session cache
        this.coordinator.clearSessionCache(sessionId);
      }

      // Return response
      return {
        sessionId,
        response: result.naturalResponse,
        intent: 'CalendarBooking',
        currentNode: result.nextState,
        requiresUserInput: result.requiresUserInput,
        completed: result.completed,
        conversationEnded: result.conversationEnded,
        endReason: result.endReason,
        engagingMessage: undefined,
      };
    } catch (error: any) {
      console.error('[LangGraphOrchestrator] Error processing message:', error);
      throw error;
    }
  }

  /**
   * Fetch available service categories from database via MCP
   */
  private async getServiceCategories(): Promise<string[]> {
    try {
      const response = await this.mcpAdapter.callTool({
        toolName: 'setting_list',
        arguments: { query_category: 'dl__service_category' },
        authToken: '',
      });

      if (response.success && response.result) {
        const data = JSON.parse(response.result);
        // Extract service names from metadata array
        if (data.metadata && Array.isArray(data.metadata)) {
          return data.metadata.map((item: any) => item.name);
        }
      }

      // Fallback to hardcoded list if MCP call fails
      return ['HVAC', 'Plumbing', 'Electrical', 'Landscaping', 'General Contracting'];
    } catch (error) {
      console.error('[LangGraphOrchestrator] Error fetching service categories, using fallback:', error);
      return ['HVAC', 'Plumbing', 'Electrical', 'Landscaping', 'General Contracting'];
    }
  }

  /**
   * Extract structured data from user message
   * Uses GPT-3.5 Turbo for better data extraction
   */
  private async extractDataFromMessage(
    message: string,
    existingVariables: Record<string, any>
  ): Promise<Record<string, any>> {
    if (!message || message === '[CALL_STARTED]') {
      return {};
    }

    try {
      // Fetch available service categories dynamically from database
      const serviceCategories = await this.getServiceCategories();
      const serviceCategoryList = serviceCategories.map(s => `"${s}"`).join(', ');

      // Define fields to extract based on booking workflow
      const fieldsToExtract = [
        { key: 'customer_name', type: 'string', description: 'Full name of the customer' },
        { key: 'customer_phone', type: 'string', description: 'Phone number (10 digits, no formatting)' },
        { key: 'customer_email', type: 'string', description: 'Email address' },
        { key: 'customer_address', type: 'string', description: 'Full street address' },
        { key: 'customer_city', type: 'string', description: 'City name' },
        { key: 'service_category', type: 'string', description: `Service type - MUST be one of these exact values: ${serviceCategoryList}` },
        { key: 'job_description', type: 'string', description: 'Description of the service needed or problem to fix' },
        { key: 'desired_date', type: 'date', description: 'Preferred date for service (YYYY-MM-DD format)' },
        { key: 'selected_time', type: 'string', description: 'Preferred time slot (e.g., "9:00 AM", "2:00 PM")' },
      ];

      // Build conversation context
      const conversationContext = Object.keys(existingVariables).length > 0
        ? `Current information collected: ${JSON.stringify(existingVariables)}`
        : 'This is the start of the conversation';

      // Use LLM to extract data
      const openaiService = getOpenAIService();
      const result = await openaiService.extractData({
        userMessage: message,
        fieldsToExtract,
        conversationContext,
      });

      console.log(`[LangGraphOrchestrator] Extracted data:`, result.extractedData);
      console.log(`[LangGraphOrchestrator] Data extraction cost: $${(result.costCents / 100).toFixed(4)}`);

      // Only return newly extracted data (don't overwrite existing values)
      const updates: Record<string, any> = {};
      for (const [key, value] of Object.entries(result.extractedData)) {
        if (value && !existingVariables[key]) {
          updates[key] = value;
        }
      }

      return updates;
    } catch (error: any) {
      console.error('[LangGraphOrchestrator] Error extracting data with LLM, falling back to regex:', error.message);

      // Fallback: Simple regex-based extraction
      const lowerMessage = message.toLowerCase();
      const updates: Record<string, any> = {};

      // Extract phone number
      const phoneMatch = message.match(/(\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\d{10})/);
      if (phoneMatch && !existingVariables.customer_phone) {
        updates.customer_phone = phoneMatch[0].replace(/[-.\s]/g, '');
      }

      // Extract email
      const emailMatch = message.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
      if (emailMatch && !existingVariables.customer_email) {
        updates.customer_email = emailMatch[0];
      }

      // Extract name
      const nameMatch = message.match(/(?:i'?m|my name is|this is|i am)\s+([a-z]+)/i);
      if (nameMatch && !existingVariables.customer_name) {
        updates.customer_name = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1);
      }

      // Service category extraction removed - must come from LLM with MCP-provided values only

      return updates;
    }
  }

  /**
   * Get session status
   */
  async getSessionStatus(sessionId: string): Promise<any> {
    const session = await this.stateManager.getSession(sessionId);
    if (!session) {
      return null;
    }

    const state = await this.stateManager.getAllState(sessionId);
    const logs = await this.stateManager.getAgentLogs(sessionId);

    return {
      session,
      state,
      logs: logs.slice(0, 10), // Last 10 logs
    };
  }

  /**
   * List all available intents
   */
  listIntents(): Array<{ name: string; description: string }> {
    return [
      { name: 'CalendarBooking', description: 'Service appointment booking workflow' },
    ];
  }
}

/**
 * Singleton instance
 */
let instance: LangGraphOrchestratorService | null = null;

export function getLangGraphOrchestratorService(): LangGraphOrchestratorService {
  if (!instance) {
    instance = new LangGraphOrchestratorService();
  }
  return instance;
}
