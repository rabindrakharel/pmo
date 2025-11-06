/**
 * OpenAI Service for AI Chat Widget
 * Handles OpenAI API integration with function calling
 * @module chat/openai.service
 */

import type {
  ChatMessage,
  OpenAIMessage,
  OpenAIFunction,
  OpenAIChatCompletionRequest,
  OpenAIChatCompletionResponse,
  FunctionCallResult
} from './types.js';
import { functionTools } from './functions.service.js';
import { getMCPTools, executeMCPTool, getCustomerServiceTools, API_MANIFEST } from './mcp-adapter.service.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';

/**
 * System prompt - Tool-focused, ultra-concise
 */
const SYSTEM_PROMPT = `You are Huron Home Services' AI chat assistant. You ONLY help with Huron Home Services - nothing else. STRICTLY REFUSE if questions aren't from prospect or existing clients.

COMPANY INFORMATION:
- Services: HVAC, Plumbing, Electrical, Landscaping, General Contracting
- Coverage: Toronto, Mississauga, Oakville, Burlington, Hamilton, Brampton, Vaughan (GTA, Ontario)
- Hours: Mon-Fri 8AM-6PM, Sat 9AM-5PM, Sun Emergency Only
- Emergency: 24/7 for HVAC and Plumbing

STRICT BOUNDARIES - NEVER DEVIATE:
1. Start with "Hi! I'm the assistant for Huron Home Services. How can I help you today?"
2. If asked about ANYTHING outside Huron services (weather, news, general questions, other companies), respond ONLY: "I'm specifically here for Huron Home Services bookings and support. Can I help you with one of our services?"
3. ALWAYS use API tools for real data - never guess
4. Keep responses brief (2-3 sentences max)
5. Ask ONE question at a time
6. NEVER ask for information the customer has ALREADY provided in this conversation

CONVERSATION MEMORY - CRITICAL:
- TRACK ALL INFORMATION: Once customer provides name, phone, address, issue, service type, date, or ANY detail, REMEMBER IT
- NEVER RE-ASK: If customer said "I'm John" and "647-555-1234", DO NOT ask "Can I get your name?" or "What's your phone?" again
- BUILD ON CONTEXT: Use previously provided info to move forward
- REFERENCE MEMORY: "Got it, let me update your address to 123 Main St" (not "What's your address?")
- STORED INFO: After calling create_customer or customer_update, that info is SAVED - don't ask again

INCREMENTAL CUSTOMER DATA COLLECTION (CRITICAL WORKFLOW):
1. START: Get name and phone FIRST (if not already provided)
2. SEARCH: Call search_customer with phone to find existing customer
3. CREATE: If not found, call create_customer with ONLY name and phone
   - IMMEDIATELY extract and SAVE the customer ID from the response
   - This ID is CRITICAL for all subsequent operations
4. UPDATE INCREMENTALLY: As customer provides MORE info (address, email, postal code, etc.), IMMEDIATELY call customer_update with:
   - The saved customer_id
   - ONLY the new field(s) just provided (e.g., {customer_id: "...", address: "123 Main St"})
   - You can update ONE field at a time or multiple fields together
5. USE SAVED ID: When creating bookings/tasks, always link to the customer using the saved customer_id
6. NO RE-ASKING: After updating a field, that field is STORED - never ask for it again

EXAMPLE FLOW:
- Customer: "I'm John, 647-555-1234"
- AI: [Calls create_customer({name: "John", phone: "647-555-1234"})] "Perfect John, I've got your info. What service do you need?"
- Customer: "I need plumbing at 123 Main St, Toronto"
- AI: [Calls customer_update({customer_id: "...", address: "123 Main St", city: "Toronto"})] "Great! You're in good hands. Checking plumber availability..."
- Customer: "My postal code is M5A 1A1"
- AI: [Calls customer_update({customer_id: "...", postal_code: "M5A 1A1"})] "Got it. Looking for available times..."

EMPATHY & REASSURANCE:
- When customer describes issue: "That sounds {frustrating/concerning/difficult}. You're in good hands."
- Always: "We'll help right away. You're in good hands."

ABSOLUTE RULE - REFUSE OFF-TOPIC REQUESTS:
If customer asks ANYTHING not related to Huron Home Services (weather, jokes, general questions, other companies, trivia, advice), you MUST respond:
"I'm specifically here for Huron Home Services bookings and support. Can I help you with HVAC, plumbing, electrical, landscaping, or contracting?"

DO NOT engage with off-topic conversations. DO NOT answer general questions. You are ONLY a Huron Home Services chat assistant.

TOOL SIGNATURES:
search_customer({phone?, address?, email?}) → {id, code, name, primary_email, primary_phone, primary_address, city, province} | null
create_customer({name!, phone!, email?, address?, city?, province?}) → {id, code, name, primary_email, primary_phone, primary_address}
update_customer({customer_id!, name?, phone?, email?, address?, city?, province?, postal_code?, ...any_field?}) → {id, code, name, primary_email, primary_phone, primary_address, city, postal_code}
create_task({customer_id!, title!, description!, service_category!, priority?, scheduled_date?, assigned_employee_id?}) → {id, code, name, descr, task_stage, task_priority}
get_employee_availability({service_category!, requested_date!}) → [{employee_id, employee_name, available_slots: ["09:00", "14:00"]}]
get_available_time_slots({employee_id!, date!}) → [{start_time, end_time, available, employee_name}]

VALID VALUES:
service_category: "HVAC" | "Plumbing" | "Electrical" | "Landscaping" | "General Contracting"
priority: "low" | "medium" | "high" | "critical"

RULES:
- Max 3 words
- Use tools in sequence
- Update customer after EACH field
- Create task BEFORE availability
- Dates: YYYY-MM-DD`;

/**
 * OpenAI function definitions
 * These tell the AI what functions are available and how to call them
 */
const FUNCTION_DEFINITIONS: OpenAIFunction[] = [
  {
    name: 'search_customer',
    description: 'Search for existing customer by phone number, email, or address',
    parameters: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'Customer phone number (10 digits)'
        },
        email: {
          type: 'string',
          description: 'Customer email address'
        },
        address: {
          type: 'string',
          description: 'Customer address (partial match supported)'
        }
      },
      required: []
    }
  },
  {
    name: 'create_customer',
    description: 'Create a new customer record when customer not found',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Customer full name'
        },
        phone: {
          type: 'string',
          description: 'Customer phone number (10 digits)'
        },
        email: {
          type: 'string',
          description: 'Customer email (optional)'
        },
        address: {
          type: 'string',
          description: 'Full street address'
        },
        city: {
          type: 'string',
          description: 'City name'
        },
        province: {
          type: 'string',
          description: 'Province code (default: ON)'
        }
      },
      required: ['name', 'phone']
    }
  },
  {
    name: 'update_customer',
    description: 'Update existing customer information. Can update any field individually or multiple fields at once.',
    parameters: {
      type: 'object',
      properties: {
        customer_id: {
          type: 'string',
          description: 'Customer UUID from search_customer or create_customer'
        },
        name: {
          type: 'string',
          description: 'Updated customer name'
        },
        phone: {
          type: 'string',
          description: 'Updated phone number'
        },
        email: {
          type: 'string',
          description: 'Updated email address'
        },
        address: {
          type: 'string',
          description: 'Updated full street address'
        },
        city: {
          type: 'string',
          description: 'Updated city name'
        },
        province: {
          type: 'string',
          description: 'Updated province (e.g., ON, BC, AB)'
        },
        postal_code: {
          type: 'string',
          description: 'Updated postal code (Canadian format: A1A 1A1)'
        }
      },
      required: ['customer_id'],
      additionalProperties: true
    }
  },
  {
    name: 'create_task',
    description: 'Create a service task for customer issue/problem',
    parameters: {
      type: 'object',
      properties: {
        customer_id: {
          type: 'string',
          description: 'Customer UUID'
        },
        title: {
          type: 'string',
          description: 'Brief task title (e.g., "HVAC system not heating")'
        },
        description: {
          type: 'string',
          description: 'Detailed problem description from customer'
        },
        service_category: {
          type: 'string',
          enum: ['HVAC', 'Plumbing', 'Electrical', 'Landscaping', 'General Contracting'],
          description: 'Service type needed'
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Task priority (default: medium)'
        },
        scheduled_date: {
          type: 'string',
          description: 'Preferred date YYYY-MM-DD'
        },
        assigned_employee_id: {
          type: 'string',
          description: 'Employee UUID if assigned'
        }
      },
      required: ['customer_id', 'title', 'description', 'service_category']
    }
  },
  {
    name: 'get_available_services',
    description: 'Get list of all available services offered by Huron Home Services, optionally filtered by category',
    parameters: {
      type: 'object',
      properties: {
        service_category: {
          type: 'string',
          enum: ['HVAC', 'Plumbing', 'Electrical', 'Landscaping', 'General Contracting'],
          description: 'Filter services by category (optional). Values from dl__service_category settings.'
        }
      },
      required: []
    }
  },
  {
    name: 'get_service_details',
    description: 'Get detailed information about a specific service including pricing, duration, and requirements',
    parameters: {
      type: 'object',
      properties: {
        service_id: {
          type: 'string',
          description: 'UUID of the service from the service catalog'
        }
      },
      required: ['service_id']
    }
  },
  {
    name: 'get_employee_availability',
    description: 'Check which employees are available to perform a service on a specific date',
    parameters: {
      type: 'object',
      properties: {
        service_category: {
          type: 'string',
          enum: ['HVAC', 'Plumbing', 'Electrical', 'Landscaping', 'General Contracting'],
          description: 'Service category to filter employees by department. Values from dl__service_category settings.'
        },
        requested_date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format (e.g., "2025-11-05")'
        }
      },
      required: ['service_category', 'requested_date']
    }
  },
  {
    name: 'get_available_time_slots',
    description: 'Get available time slots for a specific employee on a specific date',
    parameters: {
      type: 'object',
      properties: {
        employee_id: {
          type: 'string',
          description: 'UUID of the employee'
        },
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format'
        }
      },
      required: ['employee_id', 'date']
    }
  },
  {
    name: 'create_booking',
    description: 'Create a service booking/appointment for a customer',
    parameters: {
      type: 'object',
      properties: {
        service_id: {
          type: 'string',
          description: 'UUID of the service to book'
        },
        customer_name: {
          type: 'string',
          description: "Customer's full name"
        },
        customer_phone: {
          type: 'string',
          description: "Customer's phone number (Canadian format)"
        },
        customer_email: {
          type: 'string',
          description: "Customer's email address (optional)"
        },
        customer_address: {
          type: 'string',
          description: 'Full service location address including street, city, province'
        },
        customer_city: {
          type: 'string',
          description: 'City name'
        },
        customer_province: {
          type: 'string',
          description: 'Province code (e.g., ON, BC)'
        },
        customer_postal_code: {
          type: 'string',
          description: 'Postal code (Canadian format)'
        },
        requested_date: {
          type: 'string',
          description: 'Requested service date (YYYY-MM-DD)'
        },
        requested_time_start: {
          type: 'string',
          description: 'Preferred start time (HH:MM, 24-hour format)'
        },
        assigned_employee_id: {
          type: 'string',
          description: 'UUID of the assigned employee (optional)'
        },
        special_instructions: {
          type: 'string',
          description: 'Any special requirements or instructions from customer'
        },
        urgency_level: {
          type: 'string',
          enum: ['low', 'normal', 'high', 'emergency'],
          description: 'Urgency level of the service request'
        }
      },
      required: ['service_id', 'customer_name', 'customer_phone', 'customer_address', 'requested_date', 'requested_time_start']
    }
  },
  {
    name: 'get_booking_info',
    description: 'Get details of an existing booking by booking number',
    parameters: {
      type: 'object',
      properties: {
        booking_number: {
          type: 'string',
          description: 'Booking number (e.g., "BK-2025-000001")'
        }
      },
      required: ['booking_number']
    }
  },
  {
    name: 'cancel_booking',
    description: 'Cancel an existing booking',
    parameters: {
      type: 'object',
      properties: {
        booking_number: {
          type: 'string',
          description: 'Booking number to cancel'
        },
        cancellation_reason: {
          type: 'string',
          description: 'Reason for cancellation'
        }
      },
      required: ['booking_number', 'cancellation_reason']
    }
  }
];

/**
 * Main function to get AI response with function calling
 * @param conversationHistory - Array of previous messages
 * @param options - Configuration options
 * @returns AI response and any function calls made
 */
export async function getAIResponse(
  conversationHistory: ChatMessage[],
  options?: {
    interactionSessionId?: string;
    useMCP?: boolean;
    authToken?: string;
    maxTools?: number;
  }
): Promise<{
  response: string;
  functionCalls: FunctionCallResult[];
  tokensUsed: number;
  modelUsed: string;
}> {
  const { interactionSessionId, useMCP = true, authToken, maxTools = 50 } = options || {};
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  // Determine which tools to use
  const selectedTools = useMCP ? getCustomerServiceTools() : FUNCTION_DEFINITIONS;
  console.log(`🔧 Using ${useMCP ? 'MCP' : 'legacy'} tools (${selectedTools.length} tools available)`);

  try {
    // Convert chat messages to OpenAI format
    const messages: OpenAIMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'function',
        content: msg.content,
        name: msg.name
      }))
    ];

    // Initial AI call with selected tools
    let response = await callOpenAI(messages, selectedTools);
    const functionCalls: FunctionCallResult[] = [];
    let totalTokens = response.usage.total_tokens;

    // Handle function calls (may have multiple iterations)
    let iterations = 0;
    const maxIterations = 5; // Prevent infinite loops

    while (
      response.choices[0].message.tool_calls &&
      response.choices[0].message.tool_calls.length > 0 &&
      iterations < maxIterations
    ) {
      iterations++;
      const toolCall = response.choices[0].message.tool_calls[0]; // Handle first tool call
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments);

      console.log(`🤖 AI calling function: ${functionName}`, functionArgs);

      // Execute the function
      let functionResult: any;
      let success = true;
      let error: string | undefined;

      try {
        functionResult = await executeFunctionCall(
          functionName,
          functionArgs,
          {
            interactionSessionId,
            useMCP,
            authToken
          }
        );
      } catch (err) {
        success = false;
        error = err instanceof Error ? err.message : 'Unknown error';
        functionResult = { error };
        console.error(`❌ Function ${functionName} failed:`, error);
      }

      // Record function call
      functionCalls.push({
        function_name: functionName,
        arguments: functionArgs,
        result: functionResult,
        success,
        error
      });

      // Add tool result to conversation (new tools format)
      messages.push({
        role: 'assistant',
        content: null,
        tool_calls: [toolCall]
      });
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(functionResult)
      });

      // Get next AI response
      response = await callOpenAI(messages);
      totalTokens += response.usage.total_tokens;
    }

    return {
      response: response.choices[0].message.content || '',
      functionCalls,
      tokensUsed: totalTokens,
      modelUsed: response.model
    };
  } catch (error) {
    console.error('Error in getAIResponse:', error);
    throw new Error('Failed to get AI response');
  }
}

/**
 * Call OpenAI Chat Completion API
 */
async function callOpenAI(
  messages: OpenAIMessage[],
  tools?: any[]
): Promise<OpenAIChatCompletionResponse> {
  // Convert tools to proper format if using legacy FUNCTION_DEFINITIONS
  const formattedTools = tools || FUNCTION_DEFINITIONS.map(fn => ({
    type: 'function' as const,
    function: fn
  }));

  const requestBody: OpenAIChatCompletionRequest = {
    model: OPENAI_MODEL,
    messages,
    tools: formattedTools,
    tool_choice: 'auto',
    temperature: 0.7,
    max_tokens: 1000
  };

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI API error:', response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Execute a function call from the AI
 */
async function executeFunctionCall(
  functionName: string,
  args: Record<string, any>,
  options?: {
    interactionSessionId?: string;
    useMCP?: boolean;
    authToken?: string;
  }
): Promise<any> {
  const { interactionSessionId, useMCP = false, authToken } = options || {};

  // Use MCP adapter if enabled
  if (useMCP && authToken) {
    console.log(`📡 Executing MCP tool via PMO API: ${functionName}`, { args: Object.keys(args) });
    return executeMCPTool(functionName, args, authToken);
  }

  // Fall back to legacy function tools
  console.warn(`⚠️ Falling back to legacy tools (no auth token): ${functionName}`);

  // Special handling for create_booking to pass session ID
  if (functionName === 'create_booking') {
    return functionTools.create_booking(args, interactionSessionId);
  }

  // Execute other functions
  const tool = functionTools[functionName as keyof typeof functionTools];
  if (!tool) {
    throw new Error(`Function not found: ${functionName}`);
  }

  return tool(args as any);
}

/**
 * Calculate cost of API usage
 * GPT-4 pricing (approximate):
 * - Input: $0.03 per 1K tokens
 * - Output: $0.06 per 1K tokens
 */
export function calculateCost(tokensUsed: number): number {
  // Rough estimate: average cost per token
  const costPerToken = 0.00004; // $0.04 per 1K tokens
  return Math.round(tokensUsed * costPerToken * 100); // Return in cents
}

/**
 * Generate greeting message for new session
 */
export function generateGreeting(): string {
  return `Hi! I'm the assistant for Huron Home Services. How can I help you today?`;
}
