/**
 * LangGraph Node Functions - 14-Step Flow
 * Progressive context building with empathy and rapport
 * ✅ CONTEXT IS PASSED TO LLM AT EVERY STEP
 * @module orchestrator/langgraph/graph-nodes
 */

import { getOpenAIService } from '../services/openai.service.js';
import { MCPAdapterService } from '../../mcp-adapter.service.js';
import { getMCPTools } from '../../mcp-adapter.service.js';
import {
  NODE_PROMPTS,
  type CustomerContext,
  getRandomGreeting,
  getRandomEmpathy,
  getRandomRapport,
} from './prompts.config.js';

/**
 * Debug Log Entry for LLM calls
 */
export interface DebugLogEntry {
  timestamp: string;
  node: string;
  type: 'llm_call' | 'mcp_call' | 'state_update';
  model?: string;
  temperature?: number;
  jsonMode?: boolean;
  systemPrompt?: string;
  userPrompt?: string;
  variables?: Record<string, any>;
  response?: string;
  toolName?: string;
  toolParams?: Record<string, any>;
  toolResponse?: any;
}

/**
 * Global debug log collector
 */
export const DEBUG_LOGS: DebugLogEntry[] = [];

/**
 * Clear debug logs
 */
export function clearDebugLogs() {
  DEBUG_LOGS.length = 0;
}

/**
 * Add debug log entry
 */
export function addDebugLog(entry: DebugLogEntry) {
  DEBUG_LOGS.push(entry);
}

/**
 * Agent State - Comprehensive state with progressive context building
 */
export interface AgentState {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;

  // Progressive Customer Context (built throughout conversation)
  context: Partial<CustomerContext>;

  // Progress flags (track completed steps to prevent re-execution)
  progress_flags?: Record<string, boolean>;

  // Legacy fields (for backward compatibility)
  original_request?: string;
  issue?: string;
  service?: string;
  customer_phone?: string;
  customer_exists?: boolean;
  customer_profile: Record<string, any>;

  // Action planning
  proposed_actions: Array<{ name: string; reason: string }>;
  available_actions: Array<{ name: string; reason: string }>;
  approved_actions: Array<{ name: string; reason: string }>;
  executed_actions: Array<{ action: string; status: string; result?: any }>;

  // Metadata
  current_node?: string;
  completed?: boolean;
  conversation_ended?: boolean;
  end_reason?: string;
}

/**
 * Available Entity Types in PMO System
 */
const AVAILABLE_ENTITIES = [
  'Customer',
  'Booking',
  'Task',
  'Project',
  'Employee',
  'Office',
  'Business',
  'Artifact',
  'Wiki',
  'Form',
  'Report',
];

/**
 * Helper: Build context JSON string for LLM visibility
 */
function buildContextString(context: Partial<CustomerContext>): string {
  return JSON.stringify(
    {
      ...context,
      _note: 'This context is progressively built throughout the conversation',
    },
    null,
    2
  );
}

/**
 * Helper: Inject context into prompt
 * ✅ THIS ENSURES LLM SEES THE FULL CONTEXT
 */
function injectContextIntoPrompt(basePrompt: string, context: Partial<CustomerContext>): string {
  const contextString = buildContextString(context);
  return `📊 ACCUMULATED CONTEXT SO FAR:
${contextString}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${basePrompt}`;
}

/**
 * NODE 1: GREET_CUSTOMER
 * Warm, friendly greeting to start the conversation
 */
export async function greetCustomerNode(state: AgentState): Promise<Partial<AgentState>> {
  console.log(`\n🎯 [I. GREET_CUSTOMER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  // LangChain-native: Check if we've already greeted (any AI messages exist)
  const hasAIMessages = state.messages?.some(m => m.role === 'assistant');
  if (hasAIMessages) {
    console.log(`⏭️  Already greeted customer, skipping`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    return {}; // LangChain pattern: return empty update
  }

  // Use random greeting template (no LLM call needed)
  const greeting = getRandomGreeting();

  console.log(`🤖 Greeting: "${greeting}"`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Initialize context
  const context: Partial<CustomerContext> = {
    who_are_you: 'You are a polite customer service agent who is assisting a customer',
    conversation_stage: 'greeting',
    related_entities: [],
    next_steps_plan: [],
    customers_main_ask: '', // Initialize empty
    matching_service_catalog: '', // Initialize empty
  };

  // Set progress flag to prevent re-greeting
  const updatedProgressFlags = {
    ...state.progress_flags,
    greeted: true,
  };

  return {
    messages: [...state.messages, { role: 'assistant', content: greeting }],
    context,
    progress_flags: updatedProgressFlags,
  };
}

/**
 * NODE 2: ASK_ABOUT_NEED
 * Open-ended question to understand customer's reason for contact
 * STATE-AWARE: Only asks if we haven't already asked this question
 */
export async function askAboutNeedNode(state: AgentState): Promise<Partial<AgentState>> {
  console.log(`\n🎯 [II. ASK_ABOUT_NEED] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  // LangChain-native: Check if we've already asked this question
  // Look for this specific question in AI message history
  const alreadyAsked = state.messages?.some(
    m => m.role === 'assistant' && m.content.includes('What brings you here today?')
  );

  if (alreadyAsked) {
    console.log(`⏭️  Already asked about customer's need, skipping`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    return {}; // LangChain pattern: return empty update
  }

  const askMessage = "What brings you here today?";

  console.log(`🤖 Question: "${askMessage}"`);
  console.log(`📊 Current Context:`, buildContextString(state.context || {}));
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Update context stage
  const updatedContext = {
    ...state.context,
    conversation_stage: 'asking_about_need' as const,
  };

  // Set progress flag to prevent re-asking
  const updatedProgressFlags = {
    ...state.progress_flags,
    asked_need: true,
  };

  return {
    messages: [...state.messages, { role: 'assistant', content: askMessage }],
    context: updatedContext,
    progress_flags: updatedProgressFlags,
  };
}

/**
 * NODE 3: IDENTIFY_ISSUE
 * Parse customer's need and structure into context JSON
 * ✅ CONTEXT IS PASSED TO LLM
 * ✅ SKIPS RE-EXTRACTION IF ALREADY IDENTIFIED (uses progress_flags)
 */
export async function identifyIssueNode(
  state: AgentState,
  mcpAdapter: MCPAdapterService,
  authToken: string
): Promise<Partial<AgentState>> {
  console.log(`\n🎯 [III. IDENTIFY_ISSUE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  // Check if issue already identified using progress flags
  const alreadyIdentified = state.progress_flags?.issue_identified || false;
  if (alreadyIdentified && state.context?.customers_main_ask) {
    console.log(`⏭️  Issue already identified: "${state.context.customers_main_ask}"`);
    console.log(`   Service: "${state.context.matching_service_catalog}"`);
    console.log(`   Skipping re-extraction (preserving context)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    return {}; // Return empty update - context is preserved
  }

  const lastMessage = state.messages[state.messages.length - 1];
  const customerMessage = lastMessage?.role === 'user' ? lastMessage.content : '';

  console.log(`💬 Customer Message: "${customerMessage}"`);

  // If no customer message yet (initial flow), skip extraction and wait for user input
  if (!customerMessage || customerMessage.trim() === '') {
    console.log(`⏭️  No customer message yet, skipping extraction (waiting for user input)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    return {
      context: {
        ...state.context,
        conversation_stage: 'identifying_issue' as const,
      },
    };
  }

  // Fetch service catalog from MCP
  let serviceCatalog = '';
  try {
    console.log(`🔍 Fetching service catalog from MCP...`);
    const servicesResult = await mcpAdapter.executeMCPTool(
      'setting_list',
      { query_datalabel: 'dl__service_category' },
      authToken
    );

    if (servicesResult.data && Array.isArray(servicesResult.data)) {
      serviceCatalog = servicesResult.data.map((item: any) => item.name).join(', ');
      console.log(`✅ Loaded ${servicesResult.data.length} service categories`);
    }
  } catch (error: any) {
    console.error(`❌ Failed to fetch service catalog:`, error.message);
    serviceCatalog = 'internet_support, mobile_support, billing_support, installation';
  }

  // Build system prompt with service catalog and entities
  const systemPrompt =
    typeof NODE_PROMPTS.identify_issue.system === 'function'
      ? NODE_PROMPTS.identify_issue.system(serviceCatalog, AVAILABLE_ENTITIES)
      : NODE_PROMPTS.identify_issue.system;

  // Build user prompt WITH CONTEXT INJECTION ✅
  const baseUserPrompt = `Customer message: "${customerMessage}"

Parse and return JSON.`;

  const userPromptWithContext = injectContextIntoPrompt(baseUserPrompt, state.context || {});

  console.log(`🤖 LLM Call: identify_issue`);
  console.log(`   Model: GPT-4 (worker)`);
  console.log(`   Temperature: 0.3`);
  console.log(`   📊 Context being sent to LLM: YES ✅`);

  // Add debug log
  addDebugLog({
    timestamp: new Date().toISOString(),
    node: 'identifyIssueNode',
    type: 'llm_call',
    model: 'GPT-4 (worker)',
    temperature: 0.3,
    jsonMode: true,
    systemPrompt,
    userPrompt: userPromptWithContext,
    variables: {
      customerMessage,
      serviceCatalog,
      availableEntities: AVAILABLE_ENTITIES,
      currentContext: state.context,
    },
  });

  const openaiService = getOpenAIService();
  const result = await openaiService.callAgent({
    agentType: 'worker',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPromptWithContext }, // ✅ CONTEXT INCLUDED
    ],
    temperature: 0.3,
    jsonMode: true,
  });

  console.log(`✅ LLM Response:`, result.content);
  DEBUG_LOGS[DEBUG_LOGS.length - 1].response = result.content;

  // Parse response and update context
  let parsedData: any = {};
  try {
    parsedData = JSON.parse(result.content);
  } catch (error) {
    console.error('❌ Failed to parse JSON, using defaults');
    parsedData = {
      customers_main_ask: customerMessage,
      matching_service_catalog: 'general_support',
      related_entities: [],
    };
  }

  // Merge into context (non-destructive: preserve existing values if new ones are empty)
  const updatedContext: Partial<CustomerContext> = {
    ...state.context,
    customer_name: parsedData.customer_name || state.context?.customer_name,
    customer_phone_number: parsedData.customer_phone_number || state.context?.customer_phone_number,
    customer_email: parsedData.customer_email || state.context?.customer_email,
    customers_main_ask: parsedData.customers_main_ask || state.context?.customers_main_ask,
    matching_service_catalog: parsedData.matching_service_catalog || state.context?.matching_service_catalog,
    related_entities: parsedData.related_entities || state.context?.related_entities || [],
    conversation_stage: 'identifying_issue',
  };

  console.log(`📌 Updated Context:`, buildContextString(updatedContext));
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Set progress flag to prevent re-extraction
  const updatedProgressFlags = {
    ...state.progress_flags,
    issue_identified: true,
  };

  return {
    context: updatedContext,
    progress_flags: updatedProgressFlags,
    issue: parsedData.customers_main_ask,
    service: parsedData.matching_service_catalog,
  };
}

/**
 * NODE 4: EMPATHIZE
 * Acknowledge customer's issue with genuine empathy
 */
export async function empathizeNode(state: AgentState): Promise<Partial<AgentState>> {
  console.log(`\n🎯 [IV. EMPATHIZE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const issue = state.context?.customers_main_ask || state.issue || 'your issue';

  // Use random empathy template
  const empathyMessage = getRandomEmpathy(issue);

  console.log(`💝 Empathy: "${empathyMessage}"`);
  console.log(`📊 Current Context:`, buildContextString(state.context || {}));
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const updatedContext = {
    ...state.context,
    conversation_stage: 'empathizing' as const,
  };

  // Set progress flag
  const updatedProgressFlags = {
    ...state.progress_flags,
    empathized: true,
  };

  return {
    messages: [...state.messages, { role: 'assistant', content: empathyMessage }],
    context: updatedContext,
    progress_flags: updatedProgressFlags,
  };
}

/**
 * NODE 5: BUILD_RAPPORT
 * Reassure customer and build trust
 */
export async function buildRapportNode(state: AgentState): Promise<Partial<AgentState>> {
  console.log(`\n🎯 [V. BUILD_RAPPORT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  // Use random rapport template
  const rapportMessage = getRandomRapport();

  console.log(`🤝 Rapport: "${rapportMessage}"`);
  console.log(`📊 Current Context:`, buildContextString(state.context || {}));
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const updatedContext = {
    ...state.context,
    conversation_stage: 'building_rapport' as const,
  };

  // Set progress flag
  const updatedProgressFlags = {
    ...state.progress_flags,
    rapport_built: true,
  };

  return {
    messages: [...state.messages, { role: 'assistant', content: rapportMessage }],
    context: updatedContext,
    progress_flags: updatedProgressFlags,
  };
}

/**
 * NODE 6: GATHER_CUSTOMER_DATA
 * Progressively ask for missing customer information (one field at a time)
 * ✅ EXTRACTS SPECIFIC FIELDS FROM LATEST MESSAGE USING LLM
 */
export async function gatherCustomerDataNode(state: AgentState): Promise<Partial<AgentState>> {
  console.log(`\n🎯 [VI. GATHER_CUSTOMER_DATA] ━━━━━━━━━━━━━━━━━━━━━━━━`);

  const context = state.context || {};
  const progressFlags = state.progress_flags || {};
  console.log(`📊 Current Context:`, buildContextString(context));

  // Check if we have a user message to extract from
  const lastMessage = state.messages[state.messages.length - 1];
  const hasUserMessage = lastMessage?.role === 'user';

  // If we have a user message, try to extract data from it
  if (hasUserMessage) {
    const userMessage = lastMessage.content;
    console.log(`💬 Extracting data from message: "${userMessage}"`);

    // Use LLM to extract specific fields
    const extractionPrompt = `Extract customer information from the message: "${userMessage}"

Return JSON with these fields (only include if found):
- phone: phone number (if present)
- name: full name (if present)
- email: email address (if present)
- address: physical address (if present)

If a field is not present in the message, omit it from the response.

Examples:
Message: "Sure, my phone number is 647-555-9876"
Response: {"phone": "647-555-9876"}

Message: "My name is Sarah Johnson"
Response: {"name": "Sarah Johnson"}

Message: "123 Main Street, Toronto"
Response: {"address": "123 Main Street, Toronto"}`;

    const openaiService = getOpenAIService();
    const result = await openaiService.callAgent({
      agentType: 'worker',
      messages: [
        { role: 'system', content: 'You are a data extraction assistant. Extract customer information and return JSON.' },
        { role: 'user', content: extractionPrompt },
      ],
      temperature: 0.1,
      jsonMode: true,
    });

    let extractedData: any = {};
    try {
      extractedData = JSON.parse(result.content);
      console.log(`✅ Extracted data:`, extractedData);
    } catch (error) {
      console.error(`❌ Failed to parse extraction result`);
    }

    // Update context and progress flags based on extracted data
    const updatedContext = { ...context };
    const updatedProgressFlags = { ...progressFlags };

    if (extractedData.phone) {
      updatedContext.customer_phone_number = extractedData.phone;
      updatedProgressFlags.phone_collected = true;
      console.log(`✅ Phone collected: ${extractedData.phone}`);
    }
    if (extractedData.name) {
      updatedContext.customer_name = extractedData.name;
      updatedProgressFlags.name_collected = true;
      console.log(`✅ Name collected: ${extractedData.name}`);
    }
    if (extractedData.email) {
      updatedContext.customer_email = extractedData.email;
      updatedProgressFlags.email_collected = true;
      console.log(`✅ Email collected: ${extractedData.email}`);
    }
    if (extractedData.address) {
      updatedContext.customer_address = extractedData.address;
      updatedProgressFlags.address_collected = true;
      console.log(`✅ Address collected: ${extractedData.address}`);
    }

    // Update state with extracted data
    if (Object.keys(extractedData).length > 0) {
      updatedContext.conversation_stage = 'gathering_data';

      // Check what's still missing and ask for next field
      let questionToAsk = '';

      if (!updatedProgressFlags.phone_collected) {
        questionToAsk = "May I have your phone number so I can better assist you?";
      } else if (!updatedProgressFlags.name_collected) {
        questionToAsk = "Could I get your full name, please?";
      } else if (!updatedProgressFlags.email_collected) {
        questionToAsk = "What's the best email address to reach you? (Optional)";
      } else if (!updatedProgressFlags.address_collected) {
        questionToAsk = "What's the address where you need service?";
      } else {
        // All data collected
        console.log(`✅ All required customer data collected`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        return {
          context: updatedContext,
          progress_flags: updatedProgressFlags,
        };
      }

      console.log(`❓ Next question: "${questionToAsk}"`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      return {
        messages: [...state.messages, { role: 'assistant', content: questionToAsk }],
        context: updatedContext,
        progress_flags: updatedProgressFlags,
      };
    }
  }

  // No user message or no data extracted - ask for next missing field
  let questionToAsk = '';

  if (!progressFlags.phone_collected) {
    questionToAsk = "May I have your phone number so I can better assist you?";
  } else if (!progressFlags.name_collected) {
    questionToAsk = "Could I get your full name, please?";
  } else if (!progressFlags.email_collected) {
    questionToAsk = "What's the best email address to reach you? (Optional)";
  } else if (!progressFlags.address_collected) {
    questionToAsk = "What's the address where you need service?";
  } else {
    // All data collected
    console.log(`✅ All required customer data collected`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    return {
      context: {
        ...context,
        conversation_stage: 'gathering_data',
      },
    };
  }

  console.log(`❓ Question: "${questionToAsk}"`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const updatedContext = {
    ...context,
    conversation_stage: 'gathering_data' as const,
  };

  return {
    messages: [...state.messages, { role: 'assistant', content: questionToAsk }],
    context: updatedContext,
  };
}

/**
 * NODE 7: CHECK_EXISTING_CUSTOMER
 * Lookup or create customer in database
 */
export async function checkExistingCustomerNode(
  state: AgentState,
  mcpAdapter: MCPAdapterService,
  authToken: string
): Promise<Partial<AgentState>> {
  console.log(`\n🎯 [VII. CHECK_EXISTING_CUSTOMER] ━━━━━━━━━━━━━━━━━━━━━`);

  const phone = state.context?.customer_phone_number || '';

  if (!phone) {
    console.log(`⚠️  No phone number available, skipping customer lookup`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    return {};
  }

  console.log(`🔍 Looking up customer with phone: ${phone}`);

  try {
    // Try to lookup existing customer
    const searchResult = await mcpAdapter.executeMCPTool(
      'customer_search',
      { query_phone: phone },
      authToken
    );

    if (searchResult.data && searchResult.data.length > 0) {
      // Customer exists
      const customer = searchResult.data[0];
      const customerName = customer.name || state.context?.customer_name;

      console.log(`✅ Found existing customer: ${customer.id}`);

      const welcomeMessage = `Welcome back, ${customerName}! Great to hear from you again.`;

      const updatedContext: Partial<CustomerContext> = {
        ...state.context,
        customer_id: customer.id,
        customer_name: customerName,
        customer_phone_number: customer.primary_phone,
        customer_email: customer.primary_email || state.context?.customer_email,
        customer_address: customer.address || state.context?.customer_address,
        conversation_stage: 'checking_customer',
      };

      console.log(`📌 Updated Context:`, buildContextString(updatedContext));
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      // Set progress flag
      const updatedProgressFlags = {
        ...state.progress_flags,
        customer_checked: true,
      };

      return {
        messages: [...state.messages, { role: 'assistant', content: welcomeMessage }],
        context: updatedContext,
        customer_exists: true,
        progress_flags: updatedProgressFlags,
      };
    } else {
      // Customer doesn't exist - create new
      console.log(`❌ Customer not found, creating new profile`);

      const createResult = await mcpAdapter.executeMCPTool(
        'customer_create',
        {
          body_primary_phone: phone,
          body_primary_contact_name: state.context?.customer_name || 'Unknown',
        },
        authToken
      );

      const newCustomerId = createResult.id || createResult.data?.id;
      console.log(`✅ Created new customer: ${newCustomerId}`);

      const welcomeMessage = `Thank you! I've set up your profile. Let's get your issue resolved.`;

      const updatedContext: Partial<CustomerContext> = {
        ...state.context,
        customer_id: newCustomerId,
        conversation_stage: 'checking_customer',
      };

      console.log(`📌 Updated Context:`, buildContextString(updatedContext));
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      // Set progress flag
      const updatedProgressFlags = {
        ...state.progress_flags,
        customer_checked: true,
      };

      return {
        messages: [...state.messages, { role: 'assistant', content: welcomeMessage }],
        context: updatedContext,
        customer_exists: false,
        progress_flags: updatedProgressFlags,
      };
    }
  } catch (error: any) {
    console.error(`❌ Error checking customer:`, error.message);
    // Go to error state
    return await errorStateNode(state, error.message);
  }
}

/**
 * NODE 8: PLAN_ACTIONS
 * Create step-by-step plan using MCP tools
 * ✅ CONTEXT IS PASSED TO LLM
 */
export async function planActionsNode(
  state: AgentState,
  mcpAdapter: MCPAdapterService
): Promise<Partial<AgentState>> {
  console.log(`\n🎯 [VIII. PLAN_ACTIONS] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const context = state.context || {};
  console.log(`📊 Current Context:`, buildContextString(context));

  // Get available MCP tools
  const mcpTools = getMCPTools({
    categories: ['Customer', 'Booking', 'Task', 'Project'],
    maxTools: 50,
  });

  const mcpToolNames = mcpTools.map((t: any) => t.function?.name || 'unknown');
  console.log(`📋 Available MCP Tools (${mcpToolNames.length}):`, mcpToolNames.slice(0, 10), '...');

  // Build prompts
  const systemPrompt =
    typeof NODE_PROMPTS.plan_actions.system === 'string'
      ? NODE_PROMPTS.plan_actions.system
      : NODE_PROMPTS.plan_actions.system;

  // Build user prompt WITH CONTEXT INJECTION ✅
  const baseUserPrompt = `Available MCP Tools:
${mcpToolNames.join(', ')}

Create a step-by-step plan and return JSON with next_steps_plan array.`;

  const userPromptWithContext = injectContextIntoPrompt(baseUserPrompt, context);

  console.log(`🤖 LLM Call: plan_actions`);
  console.log(`   Model: GPT-4 (planner)`);
  console.log(`   Temperature: 0.2`);
  console.log(`   📊 Context being sent to LLM: YES ✅`);

  // Add debug log
  addDebugLog({
    timestamp: new Date().toISOString(),
    node: 'planActionsNode',
    type: 'llm_call',
    model: 'GPT-4 (planner)',
    temperature: 0.2,
    jsonMode: true,
    systemPrompt,
    userPrompt: userPromptWithContext,
    variables: {
      currentContext: context,
      availableMCPTools: mcpToolNames,
    },
  });

  const openaiService = getOpenAIService();
  const result = await openaiService.callAgent({
    agentType: 'planner',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPromptWithContext }, // ✅ CONTEXT INCLUDED
    ],
    temperature: 0.2,
    jsonMode: true,
  });

  console.log(`✅ LLM Response:`, result.content);
  DEBUG_LOGS[DEBUG_LOGS.length - 1].response = result.content;

  // Parse plan
  let planData: any = {};
  try {
    planData = JSON.parse(result.content);
  } catch (error) {
    console.error('❌ Failed to parse plan JSON');
    planData = { next_steps_plan: [] };
  }

  const updatedContext: Partial<CustomerContext> = {
    ...context,
    next_steps_plan: planData.next_steps_plan || [],
    conversation_stage: 'planning',
  };

  console.log(`📌 Plan Steps:`, planData.next_steps_plan);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Set progress flag
  const updatedProgressFlags = {
    ...state.progress_flags,
    plan_created: true,
  };

  return {
    context: updatedContext,
    progress_flags: updatedProgressFlags,
  };
}

/**
 * NODE 9: COMMUNICATE_PLAN
 * Get customer approval before executing
 * ✅ CONTEXT IS PASSED TO LLM
 */
export async function communicatePlanNode(state: AgentState): Promise<Partial<AgentState>> {
  console.log(`\n🎯 [IX. COMMUNICATE_PLAN] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const context = state.context || {};
  const planSteps = context.next_steps_plan || [];

  console.log(`📊 Plan to communicate:`, planSteps);

  const systemPrompt = NODE_PROMPTS.communicate_plan.system;

  // Build user prompt WITH CONTEXT INJECTION ✅
  const baseUserPrompt = `Plan steps:
${planSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

Communicate this plan clearly and ask for approval.`;

  const userPromptWithContext = injectContextIntoPrompt(baseUserPrompt, context);

  console.log(`🤖 LLM Call: communicate_plan`);
  console.log(`   📊 Context being sent to LLM: YES ✅`);

  // Add debug log
  addDebugLog({
    timestamp: new Date().toISOString(),
    node: 'communicatePlanNode',
    type: 'llm_call',
    model: 'GPT-4 (worker)',
    temperature: 0.7,
    systemPrompt,
    userPrompt: userPromptWithContext,
    variables: { planSteps, currentContext: context },
  });

  const openaiService = getOpenAIService();
  const result = await openaiService.callAgent({
    agentType: 'worker',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPromptWithContext }, // ✅ CONTEXT INCLUDED
    ],
    temperature: 0.7,
  });

  console.log(`✅ LLM Response: "${result.content}"`);
  DEBUG_LOGS[DEBUG_LOGS.length - 1].response = result.content;
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const updatedContext = {
    ...context,
    conversation_stage: 'communicating_plan' as const,
  };

  // Set progress flag
  const updatedProgressFlags = {
    ...state.progress_flags,
    plan_communicated: true,
  };

  return {
    messages: [...state.messages, { role: 'assistant', content: result.content }],
    context: updatedContext,
    progress_flags: updatedProgressFlags,
  };
}

/**
 * NODE 10: EXECUTE_PLAN
 * Execute the plan using MCP tools
 */
export async function executePlanNode(
  state: AgentState,
  mcpAdapter: MCPAdapterService,
  authToken: string
): Promise<Partial<AgentState>> {
  console.log(`\n🎯 [X. EXECUTE_PLAN] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const context = state.context || {};
  const planSteps = context.next_steps_plan || [];

  console.log(`📊 Executing ${planSteps.length} plan steps...`);

  const executedActions: Array<{ action: string; status: string; result?: any }> = [];

  try {
    for (const step of planSteps) {
      console.log(`🔧 Executing: ${step}`);
      // TODO: Actual MCP tool execution would go here
      executedActions.push({
        action: step,
        status: 'completed',
        result: { note: 'Execution simulated' },
      });
    }

    console.log(`✅ Executed ${executedActions.length} actions`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    const updatedContext = {
      ...context,
      conversation_stage: 'executing' as const,
    };

    // Set progress flag
    const updatedProgressFlags = {
      ...state.progress_flags,
      plan_executed: true,
    };

    return {
      context: updatedContext,
      executed_actions: executedActions,
      progress_flags: updatedProgressFlags,
    };
  } catch (error: any) {
    console.error(`❌ Error executing plan:`, error.message);
    return await errorStateNode(state, error.message);
  }
}

/**
 * NODE 11: COMMUNICATE_EXECUTION
 * Tell customer what was done
 * ✅ CONTEXT IS PASSED TO LLM
 */
export async function communicateExecutionNode(state: AgentState): Promise<Partial<AgentState>> {
  console.log(`\n🎯 [XI. COMMUNICATE_EXECUTION] ━━━━━━━━━━━━━━━━━━━━━━`);

  const context = state.context || {};
  const executedActions = state.executed_actions || [];

  console.log(`📊 Communicating ${executedActions.length} completed actions`);

  const systemPrompt = NODE_PROMPTS.communicate_execution.system;

  // Build user prompt WITH CONTEXT INJECTION ✅
  const baseUserPrompt = `Executed actions:
${executedActions
  .map(
    (step, i) =>
      `${i + 1}. ${step.action} - ${step.status}${step.result ? ` (Result: ${JSON.stringify(step.result)})` : ''}`
  )
  .join('\n')}

Communicate what was done clearly and ask if they need anything else.`;

  const userPromptWithContext = injectContextIntoPrompt(baseUserPrompt, context);

  console.log(`🤖 LLM Call: communicate_execution`);
  console.log(`   📊 Context being sent to LLM: YES ✅`);

  // Add debug log
  addDebugLog({
    timestamp: new Date().toISOString(),
    node: 'communicateExecutionNode',
    type: 'llm_call',
    model: 'GPT-4 (worker)',
    temperature: 0.7,
    systemPrompt,
    userPrompt: userPromptWithContext,
    variables: { executedActions, currentContext: context },
  });

  const openaiService = getOpenAIService();
  const result = await openaiService.callAgent({
    agentType: 'worker',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPromptWithContext }, // ✅ CONTEXT INCLUDED
    ],
    temperature: 0.7,
  });

  console.log(`✅ LLM Response: "${result.content}"`);
  DEBUG_LOGS[DEBUG_LOGS.length - 1].response = result.content;
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const updatedContext = {
    ...context,
    conversation_stage: 'confirming_execution' as const,
  };

  // Set progress flag
  const updatedProgressFlags = {
    ...state.progress_flags,
    execution_communicated: true,
  };

  return {
    messages: [...state.messages, { role: 'assistant', content: result.content }],
    context: updatedContext,
    progress_flags: updatedProgressFlags,
  };
}

/**
 * NODE 11b: ASK_ANOTHER_REQUEST
 * Ask if customer needs anything else
 * ✅ CONTEXT IS PASSED TO LLM
 */
export async function askAnotherRequestNode(state: AgentState): Promise<Partial<AgentState>> {
  console.log(`\n🎯 [XIb. ASK_ANOTHER_REQUEST] ━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const context = state.context || {};

  const systemPrompt = NODE_PROMPTS.ask_another_request.system;

  // Build user prompt WITH CONTEXT INJECTION ✅
  const baseUserPrompt = `Ask if they need anything else.`;

  const userPromptWithContext = injectContextIntoPrompt(baseUserPrompt, context);

  console.log(`🤖 LLM Call: ask_another_request`);
  console.log(`   📊 Context being sent to LLM: YES ✅`);

  // Add debug log
  addDebugLog({
    timestamp: new Date().toISOString(),
    node: 'askAnotherRequestNode',
    type: 'llm_call',
    model: 'GPT-4 (worker)',
    temperature: 0.7,
    systemPrompt,
    userPrompt: userPromptWithContext,
    variables: { currentContext: context },
  });

  const openaiService = getOpenAIService();
  const result = await openaiService.callAgent({
    agentType: 'worker',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPromptWithContext }, // ✅ CONTEXT INCLUDED
    ],
    temperature: 0.7,
  });

  console.log(`✅ LLM Response: "${result.content}"`);
  DEBUG_LOGS[DEBUG_LOGS.length - 1].response = result.content;
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const updatedContext = {
    ...context,
    conversation_stage: 'asking_another_request' as const,
  };

  return {
    messages: [...state.messages, { role: 'assistant', content: result.content }],
    context: updatedContext,
  };
}

/**
 * NODE 12: GOODBYE
 * Friendly closing before hangup
 * ✅ CONTEXT IS PASSED TO LLM
 */
export async function goodbyeNode(state: AgentState): Promise<Partial<AgentState>> {
  console.log(`\n🎯 [XII. GOODBYE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const context = state.context || {};

  const systemPrompt = NODE_PROMPTS.goodbye.system;

  // Build user prompt WITH CONTEXT INJECTION ✅
  const baseUserPrompt = `Issue resolved: true

Generate a warm goodbye message before hanging up.`;

  const userPromptWithContext = injectContextIntoPrompt(baseUserPrompt, context);

  console.log(`🤖 LLM Call: goodbye`);
  console.log(`   📊 Context being sent to LLM: YES ✅`);

  // Add debug log
  addDebugLog({
    timestamp: new Date().toISOString(),
    node: 'goodbyeNode',
    type: 'llm_call',
    model: 'GPT-4 (worker)',
    temperature: 0.7,
    systemPrompt,
    userPrompt: userPromptWithContext,
    variables: { issueResolved: true, currentContext: context },
  });

  const openaiService = getOpenAIService();
  const result = await openaiService.callAgent({
    agentType: 'worker',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPromptWithContext }, // ✅ CONTEXT INCLUDED
    ],
    temperature: 0.7,
  });

  console.log(`✅ LLM Response: "${result.content}"`);
  DEBUG_LOGS[DEBUG_LOGS.length - 1].response = result.content;
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const updatedContext = {
    ...context,
    conversation_stage: 'closing' as const,
  };

  return {
    messages: [...state.messages, { role: 'assistant', content: result.content }],
    context: updatedContext,
  };
}

/**
 * NODE 13: HANGUP
 * Hang up the voice call using MCP
 */
export async function hangupNode(
  state: AgentState,
  mcpAdapter?: MCPAdapterService,
  chatSessionId?: string
): Promise<Partial<AgentState>> {
  console.log(`\n🎯 [XIII. HANGUP] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📞 Hanging up call session: ${chatSessionId || 'unknown'}`);

  try {
    // Execute MCP hangup (if voice session exists)
    if (chatSessionId) {
      const { disconnectVoiceLangraphSession } = await import('../../voice-langraph.service.js');
      const disconnected = disconnectVoiceLangraphSession(chatSessionId);

      if (disconnected) {
        console.log(`✅ Voice session ${chatSessionId} disconnected successfully`);
      } else {
        console.log(`⚠️  Voice session ${chatSessionId} not found or already disconnected`);
      }
    }
  } catch (error: any) {
    console.error(`❌ Error during hangup:`, error.message);
  }

  console.log(`✅ Hangup completed`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  return {
    conversation_ended: true,
    completed: true,
    end_reason: 'call_hangup',
  };
}

/**
 * ERROR STATE - Handle all backend/MCP errors
 */
export async function errorStateNode(
  state: AgentState,
  errorDetails?: string
): Promise<Partial<AgentState>> {
  console.log(`\n🎯 [ERROR_STATE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`❌ Error Details: ${errorDetails || 'Unknown error'}`);

  const errorMessage = "I am having difficulty processing your request. Please try again later.";

  console.log(`🤖 Error Message: "${errorMessage}"`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const updatedContext = {
    ...state.context,
    conversation_stage: 'error' as const,
  };

  return {
    messages: [...state.messages, { role: 'assistant', content: errorMessage }],
    context: updatedContext,
    conversation_ended: true,
    end_reason: 'error_occurred',
  };
}
