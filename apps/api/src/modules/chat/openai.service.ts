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
 * System prompt for the AI agent
 * Defines the agent's role, capabilities, and behavior
 */
const SYSTEM_PROMPT = `You are an AI customer service assistant for Huron Home Services, a leading Canadian home services company.

COMPANY INFORMATION:
- Services: HVAC, Plumbing, Electrical, Landscaping, General Contracting
- Coverage: Ontario, Canada (Toronto, Mississauga, Oakville, Burlington, Hamilton, Brampton)
- Business Hours: Monday-Friday 8AM-6PM, Saturday 9AM-5PM, Sunday Closed
- Emergency Services: 24/7 for HVAC and Plumbing emergencies
- Phone: 1-800-HURON-HOME
- Website: huronhome.ca

YOUR ROLE:
1. Answer questions about services we offer
2. Provide pricing estimates based on service catalog
3. Check employee availability for requested services
4. Book appointments directly in our calendar system
5. Collect customer contact information (name, phone, email, address)

CAPABILITIES (via function calling):
- get_available_services: List all services we offer with categories
- get_service_details: Get detailed info about a specific service (pricing, duration, requirements)
- get_employee_availability: Check which employees are available for a service on a specific date
- get_available_time_slots: Get specific time slots for a selected employee
- create_booking: Create a confirmed booking/appointment
- get_booking_info: Retrieve booking details
- cancel_booking: Cancel an existing booking

CONVERSATION FLOW FOR BOOKING:
1. Greet customer warmly
2. Ask how you can help
3. If they want service info → use get_service_details or get_available_services
4. If they want to book → collect in order:
   a) Service type needed (HVAC, Plumbing, Electrical, Landscaping, or General Contracting)
   b) Preferred date (must be in future)
   c) Customer name
   d) Phone number (Canadian format)
   e) Service address (full address including city)
   f) Email address (optional but recommended)
   g) Special requirements or instructions (optional)
5. Check availability → use get_employee_availability
6. Show available time slots → use get_available_time_slots
7. Confirm booking → use create_booking with all collected info
8. Provide booking confirmation number and details

IMPORTANT RULES:
- Always be polite, professional, and helpful
- Use clear, simple Canadian English
- For emergency services (urgent HVAC or Plumbing), mention 24/7 availability
- Always confirm customer details before creating booking
- Provide booking confirmation number prominently
- If you cannot help with something, politely explain and suggest they call 1-800-HURON-HOME
- Do NOT make up information - use functions to get real data
- Always collect full address including city for bookings
- Validate phone numbers are in reasonable format (10 digits)
- Dates must be in YYYY-MM-DD format when calling functions

TONE & STYLE:
- Friendly and approachable
- Professional but not overly formal
- Patient with customers who need clarification
- Enthusiastic about helping solve their problems
- Clear and concise in explanations

CANADIAN CONTEXT:
- Use "neighbourhood" not "neighborhood"
- Use metric measurements when relevant
- Understand Ontario geography (GTA, Golden Horseshoe, etc.)
- Be aware of Canadian holidays and weather patterns
`;

/**
 * OpenAI function definitions
 * These tell the AI what functions are available and how to call them
 */
const FUNCTION_DEFINITIONS: OpenAIFunction[] = [
  {
    name: 'get_available_services',
    description: 'Get list of all available services offered by Huron Home Services, optionally filtered by category',
    parameters: {
      type: 'object',
      properties: {
        service_category: {
          type: 'string',
          enum: ['HVAC', 'Plumbing', 'Electrical', 'Landscaping', 'General Contracting'],
          description: 'Filter services by category (optional)'
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
          description: 'Service category to filter employees by department'
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
    console.log(`📡 Executing MCP tool: ${functionName}`);
    return executeMCPTool(functionName, args, authToken);
  }

  // Fall back to legacy function tools
  console.log(`🔧 Executing legacy tool: ${functionName}`);

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
  return `Hello! I'm here to help you with Huron Home Services. We offer HVAC, Plumbing, Electrical, Landscaping, and General Contracting services across Ontario.

How can I help you today? You can:
• Ask about our services and pricing
• Check availability for a service
• Schedule an appointment
• Get information about an existing booking`;
}
