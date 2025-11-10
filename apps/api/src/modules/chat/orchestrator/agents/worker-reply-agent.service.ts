/**
 * Worker Reply Agent - Goal-Oriented with ReAct Pattern
 *
 * ⚠️ DEPRECATED: This agent is part of the legacy v3.0 multi-agent architecture.
 * Use UnifiedGoalAgent (v4.0+) instead for better performance and streaming support.
 *
 * This agent is kept for backward compatibility only. To use it, set
 * use_unified_agent: false in your goal configuration.
 *
 * Responsibilities:
 * - Observe: Current goal, context, conversation history
 * - Think: Determine what to say to progress toward goal
 * - Act: Generate natural customer-facing response
 * - Uses agent profile for consistent identity/behavior
 *
 * @module orchestrator/agents/worker-reply-agent
 * @version 3.0.0
 * @deprecated Use UnifiedGoalAgent instead
 */

import { getOpenAIService } from '../services/openai.service.js';
import type { AgentContextState } from './agent-context.service.js';
import type { AgentConfigV3, ConversationGoal, AgentProfile } from '../config/agent-config.schema.js';
import { replacePlaceholders } from '../utils/json-path-resolver.js';

/**
 * Worker Reply Agent Result
 */
export interface WorkerReplyResult {
  response: string;
  thought?: string; // ReAct pattern: agent's reasoning
}

/**
 * Worker Reply Agent Service
 * Uses ReAct pattern with persistent agent identity
 */
export class WorkerReplyAgent {
  private config: AgentConfigV3;
  private agentProfile: AgentProfile;

  constructor(config: AgentConfigV3, agentProfileId: string = 'conversational_agent') {
    this.config = config;

    // Get agent profile from config
    const profile = config.agent_profiles[agentProfileId];
    if (!profile) {
      throw new Error(`Agent profile not found: ${agentProfileId}`);
    }
    this.agentProfile = profile;

    console.log(`[WorkerReplyAgent] 🎭 Initialized with profile: ${this.agentProfile.identity}`);
  }

  /**
   * Execute goal: Generate customer response using ReAct pattern
   *
   * ReAct Steps:
   * 1. OBSERVE: Current goal, context, conversation
   * 2. THINK: What needs to be done to progress toward goal
   * 3. ACT: Generate response to customer
   */
  async executeGoal(
    goalId: string,
    state: AgentContextState,
    userMessage?: string
  ): Promise<WorkerReplyResult> {
    console.log(`\n🗣️  [WorkerReplyAgent] Executing goal: ${goalId}`);

    // Get goal configuration
    const goal = this.config.goals.find(g => g.goal_id === goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    // OBSERVE: Gather relevant context
    const observation = this.observe(goal, state, userMessage);

    // THINK + ACT: Generate response (combined for efficiency)
    const systemPrompt = this.buildReActPrompt(goal, observation, state.context);
    const userPrompt = this.buildUserPrompt(userMessage, goal);

    console.log(`[WorkerReplyAgent] Goal: ${goal.description}`);
    console.log(`[WorkerReplyAgent] Agent Identity: ${this.agentProfile.identity}`);

    // Call LLM to generate response
    const openaiService = getOpenAIService();
    const result = await openaiService.callAgent({
      agentType: 'worker_reply',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      sessionId: state.sessionId,
    });

    const response = result.content || '';

    console.log(`[WorkerReplyAgent] ✅ Generated response (${response.length} chars)`);

    return {
      response,
    };
  }

  /**
   * Execute goal and STREAM response (token by token)
   * Same as executeGoal but yields tokens as they arrive
   */
  async *executeGoalStream(
    goalId: string,
    state: AgentContextState,
    userMessage?: string
  ): AsyncGenerator<{ token: string; done: boolean; response?: string }> {
    console.log(`\n🌊 [WorkerReplyAgent] Streaming goal: ${goalId}`);

    // Get goal configuration
    const goal = this.config.goals.find(g => g.goal_id === goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    // OBSERVE: Gather relevant context
    const observation = this.observe(goal, state, userMessage);

    // THINK + ACT: Generate response (streaming)
    const systemPrompt = this.buildReActPrompt(goal, observation, state.context);
    const userPrompt = this.buildUserPrompt(userMessage, goal);

    console.log(`[WorkerReplyAgent] Goal: ${goal.description}`);
    console.log(`[WorkerReplyAgent] Agent Identity: ${this.agentProfile.identity}`);
    console.log(`[WorkerReplyAgent] Streaming: ENABLED`);

    // Call LLM with streaming
    const openaiService = getOpenAIService();
    let fullResponse = '';

    try {
      for await (const chunk of openaiService.callAgentStream({
        agentType: 'worker_reply',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        sessionId: state.sessionId,
      })) {
        if (chunk.done) {
          // Final chunk - yield completion
          console.log(`[WorkerReplyAgent] ✅ Streaming complete (${fullResponse.length} chars)`);
          yield {
            token: '',
            done: true,
            response: fullResponse,
          };
        } else {
          // Token chunk - yield to client
          fullResponse += chunk.token;
          yield {
            token: chunk.token,
            done: false,
          };
        }
      }
    } catch (error: any) {
      console.error(`[WorkerReplyAgent] ❌ Streaming error: ${error.message}`);
      throw error;
    }
  }

  /**
   * OBSERVE: Gather relevant context for decision-making
   */
  private observe(goal: ConversationGoal, state: AgentContextState, userMessage?: string) {
    // Recent conversation (last 3 exchanges for context)
    const recentConversation = (state.context.summary_of_conversation_on_each_step_until_now || []).slice(-3);

    // Success criteria (what we need to accomplish)
    const successCriteria = goal.success_criteria;

    // Current context fields (using nested structure)
    const extractionFields = state.context.data_extraction_fields || {};
    const contextData = {
      customer: {
        name: extractionFields.customer?.name || '(unknown)',
        phone: extractionFields.customer?.phone || '(unknown)',
        email: extractionFields.customer?.email || '(unknown)',
        address_street: extractionFields.customer?.address_street || '(unknown)',
        address_city: extractionFields.customer?.address_city || '(unknown)',
        address_state: extractionFields.customer?.address_state || '(unknown)',
        address_zipcode: extractionFields.customer?.address_zipcode || '(unknown)',
        id: extractionFields.customer?.id || '(unknown)',
      },
      service: {
        request: extractionFields.service?.primary_request || '(not stated)',
        matching_catalog: extractionFields.service?.catalog_match || '(not matched)',
      },
      operations: {
        solution_plan: extractionFields.operations?.solution_plan || '(no plan)',
        task_id: extractionFields.operations?.task_id || '(not created)',
        appointment: extractionFields.operations?.appointment_details || '(not scheduled)',
      },
      next_action: state.context.next_course_of_action || '(no guidance)',
    };

    return {
      currentMessage: userMessage,
      recentConversation,
      successCriteria,
      contextData,
      conversationTactics: goal.conversation_tactics || [],
    };
  }

  /**
   * BUILD REACT PROMPT: Combines THINK and ACT stages
   * Uses declarative agent profile and goal configuration
   * Supports placeholder replacement from session memory (e.g., {{customer.name}})
   * ✅ FIX #5: Now supports sequential field collection
   */
  private buildReActPrompt(goal: ConversationGoal, observation: any, context: any): string {
    // Get conversation tactics from config
    const tactics = observation.conversationTactics
      .map((tacticId: string) => {
        const tactic = this.config.conversation_tactics[tacticId];
        return tactic ? `- ${tactic.description}` : '';
      })
      .filter(Boolean)
      .join('\n');

    // Build session memory data section (mandatory vs optional fields)
    const sessionMemoryData = this.buildSessionMemoryDataSection(goal, context);

    // Replace placeholders in system prompt and goal description with actual session values
    let systemPromptWithValues = replacePlaceholders(this.agentProfile.system_prompt, context);

    // Replace {{SESSION_MEMORY_DATA}} with formatted session memory
    systemPromptWithValues = systemPromptWithValues.replace(
      '{{SESSION_MEMORY_DATA}}',
      sessionMemoryData
    );

    const goalDescriptionWithValues = replacePlaceholders(goal.description, context);

    // ✅ FIX #5: Determine next field to collect based on field_collection_order
    const fieldCollectionOrder = (goal.success_criteria as any).field_collection_order;
    let sequentialFieldGuidance = '';

    if (fieldCollectionOrder && Array.isArray(fieldCollectionOrder)) {
      // Find the first empty field in the collection order
      const dataFields = context.data_extraction_fields || {};
      let nextFieldToCollect: string | null = null;
      const collectedFields: string[] = [];
      const remainingFields: string[] = [];

      for (const fieldPath of fieldCollectionOrder) {
        const [category, field] = fieldPath.split('.');
        const value = dataFields[category]?.[field];
        const isPopulated = value && value !== '' && value !== '(unknown)' && value !== '(not set)';

        if (isPopulated) {
          collectedFields.push(fieldPath);
        } else if (!nextFieldToCollect) {
          nextFieldToCollect = fieldPath; // First empty field
          remainingFields.push(fieldPath);
        } else {
          remainingFields.push(fieldPath);
        }
      }

      if (nextFieldToCollect) {
        sequentialFieldGuidance = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 SEQUENTIAL FIELD COLLECTION (Follow this order):

✅ Already Collected: ${collectedFields.length > 0 ? collectedFields.join(', ') : '(none yet)'}

🎯 NEXT FIELD TO COLLECT: **${nextFieldToCollect}**

⏭️ After this: ${remainingFields.slice(1).join(', ') || '(none - this is the last field)'}

⚠️ CRITICAL RULE: ONLY ask for the NEXT FIELD (${nextFieldToCollect}). Do NOT jump ahead to ask for fields that come later in the sequence. Follow the order to maintain natural conversation flow.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      } else {
        sequentialFieldGuidance = `\n✅ All fields in collection order have been collected.\n`;
      }
    }

    return `# AGENT IDENTITY
${systemPromptWithValues}

# CURRENT GOAL
**Objective:** ${goalDescriptionWithValues}

**Success Criteria (what we need to complete THIS goal):**
${goal.success_criteria.mandatory_fields.map(f => `- ${f}`).join('\n')}

⚠️ **IMPORTANT:** ONLY focus on the fields listed above. Do NOT ask for other information yet (it will be collected in future goals).
${sequentialFieldGuidance}

**Conversation Tactics to Use:**
${tactics}

# REACT: OBSERVE → THINK → ACT

## 1. OBSERVE (Current Situation)

**Recent Conversation (last 3 exchanges):**
${observation.recentConversation.map((ex: any, i: number) =>
  `[${i + 1}] Customer: "${ex.customer}"\n    Agent: "${ex.agent}"`
).join('\n\n')}

**Current Context:**
\`\`\`json
${JSON.stringify(observation.contextData, null, 2)}
\`\`\`

**Guidance from System:** ${observation.contextData.next_action}

${observation.currentMessage ? `
**🔴 CURRENT CUSTOMER MESSAGE (MOST IMPORTANT):**
"${observation.currentMessage}"
` : ''}

## 2. THINK (Reasoning)

Based on observations:
- What is the customer trying to accomplish?
- What MANDATORY FIELDS (from success criteria) do we still need?
- If sequential collection is enabled: What is the NEXT field to collect? (Don't skip ahead!)
- Which conversation tactic best fits this situation?
- Have we already asked this question? (check recent conversation!)
- ⚠️ CRITICAL: Don't ask for fields NOT in success criteria - other goals will handle them
- ⚠️ CRITICAL: If sequential collection is shown above, ONLY ask for the NEXT field, not fields that come later
- 🔍 INCOMPLETE UTTERANCE CHECK: Is the customer's message incomplete? (Examples: "The name is", "My phone is", "It's" without completing the sentence)

## 3. ACT (Generate Response)

**Response Guidelines:**
- Be natural, empathetic, and conversational
- Use appropriate tactic from the list above
- Address the CURRENT message first
- NEVER repeat questions from recent conversation
- Keep response to 1-2 sentences
- ONLY ask for fields in success criteria (ignore other empty fields you see in context)
- Focus on progressing toward goal: ${goalDescriptionWithValues}

**🚨 INCOMPLETE UTTERANCE DETECTION:**

If the customer's message ends with incomplete phrasing like:
- "The name is" / "My name is" (without the actual name)
- "The phone number is" / "My phone is" (without the number)
- "The address is" / "I live at" (without the address)
- "It's" / "That's" (without completing the thought)
- Any sentence fragment that signals the customer is about to provide information but hasn't yet

→ DO NOT acknowledge or thank them for providing the information
→ DO NOT extract anything (there's nothing to extract yet)
→ Instead: Wait silently (respond with "I'm listening" or similar) or gently prompt them to continue ("Yes, please go ahead")

**Example - WRONG response to incomplete utterance:**
Customer: "The name is"
Agent: "Thank you for sharing your name!" ❌ WRONG - customer hasn't provided name yet

**Example - CORRECT response to incomplete utterance:**
Customer: "The name is"
Agent: "Yes, I'm listening. Please go ahead." ✅ CORRECT - waiting for customer to complete

**Example - COMPLETE utterance (normal response):**
Customer: "The name is John Smith"
Agent: "Thank you, John! May I also get your phone number?" ✅ CORRECT - customer provided complete information

Generate your response now:`;
  }

  /**
   * Build user prompt (simple task instruction)
   */
  private buildUserPrompt(userMessage?: string, goal?: ConversationGoal): string {
    if (userMessage) {
      return `Customer just said: "${userMessage}"\n\nRespond appropriately to help achieve goal: ${goal?.description}`;
    }
    return `Generate appropriate response to progress toward goal: ${goal?.description}`;
  }

  /**
   * Build session memory data section showing collected fields
   * Separates MANDATORY fields (from goal) vs OPTIONAL/Good-to-have fields
   * This prevents the agent from asking for information that's already been collected
   */
  private buildSessionMemoryDataSection(goal: ConversationGoal, context: any): string {
    const dataFields = context.data_extraction_fields || {};
    const mandatoryFields = goal.success_criteria?.mandatory_fields || [];

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
}

/**
 * Create worker reply agent instance
 */
export function createWorkerReplyAgent(
  config: AgentConfigV3,
  agentProfileId: string = 'conversational_agent'
): WorkerReplyAgent {
  return new WorkerReplyAgent(config, agentProfileId);
}
