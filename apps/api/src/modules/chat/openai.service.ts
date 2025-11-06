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
const SYSTEM_PROMPT = `Huron Home Services AI. Brief, supportive responses.

SEQUENCE:
1. "Name and phone?"
2. After getting name and phone → search_customer({phone}) → Customer | null
3. If customer found → use customer_id
   If null → create_customer({name!, phone!}) → use customer_id
4. "We're helping right away! What's the issue?"
5. {Empathize}: "That sounds {frustrating/concerning/difficult}. You're in good hands." OR "We'll help right away. You're in good hands."
6. Ask missing fields → update_customer({customer_id!, ...fields}) after EACH answer
7. create_task({customer_id!, title!, description!, service_category!, priority?, scheduled_date?})
8. get_employee_availability({service_category!, requested_date!}) → "Available: 9AM, 2PM, 4PM"

TOOL SIGNATURES:
search_customer({phone?, address?, email?}) → {id, code, name, primary_email, primary_phone, primary_address, city, province} | null
create_customer({name!, phone!, email?, address?, city?, province?}) → {id, code, name, primary_email, primary_phone, primary_address}
update_customer({customer_id!, name?, phone?, email?, address?, city?, province?}) → {id, code, name, primary_email, primary_phone, primary_address, city}
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
    description: 'Update existing customer information',
    parameters: {
      type: 'object',
      properties: {
        customer_id: {
          type: 'string',
          description: 'Customer UUID from search_customer'
        },
        name: {
          type: 'string',
          description: 'Updated name'
        },
        phone: {
          type: 'string',
          description: 'Updated phone'
        },
        email: {
          type: 'string',
          description: 'Updated email'
        },
        address: {
          type: 'string',
          description: 'Updated full address'
        },
        city: {
          type: 'string',
          description: 'Updated city'
        },
        province: {
          type: 'string',
          description: 'Updated province'
        }
      },
      required: ['customer_id']
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
  return `Hi! Phone or address?`;
}
