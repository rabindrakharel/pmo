/**
 * Calendar Booking LangGraph
 * LangGraph implementation of the CalendarBooking workflow
 * @module orchestrator/langgraph/calendar-booking
 */

import { StateGraph, END, START } from '@langchain/langgraph';
import { OrchestratorStateAnnotation, type OrchestratorState, type StateUpdate } from '../types/langgraph-state.types.js';
import type { IntentGraph } from '../types/intent-graph.types.js';
import { CalendarBookingGraph } from '../intent-graphs/calendar-booking.graph.js';

/**
 * Get the intent graph definition
 */
export function getIntentGraph(): IntentGraph {
  return CalendarBookingGraph;
}

/**
 * Entry node: Initialize session and authenticate
 */
async function entryNode(state: OrchestratorState): Promise<StateUpdate> {
  console.log('[LangGraph] Entry node - Initialize session');

  return {
    currentNode: 'entry',
    status: 'active',
    turnCount: state.turnCount + 1,
    messages: [{
      role: 'system',
      content: 'Calendar booking workflow started',
      timestamp: new Date(),
    }],
    metadata: {
      ...state.metadata,
      lastUpdateTime: new Date(),
      totalAgentCalls: state.metadata.totalAgentCalls + 1,
    },
  };
}

/**
 * Critic Node: Review conversation for boundaries
 * Checks for off-topic conversations and enforces rules
 */
async function criticNode(state: OrchestratorState): Promise<StateUpdate> {
  console.log('[LangGraph] Critic node - Review conversation');

  const graph = CalendarBookingGraph;
  const { boundaries } = graph;
  const userMessage = state.userMessage?.toLowerCase() || '';

  // Check forbidden topics
  const isForbidden = boundaries.forbiddenTopics.some(topic =>
    userMessage.includes(topic.toLowerCase())
  );

  if (isForbidden) {
    const newOffTopicCount = state.offTopicCount + 1;

    // After 2 off-topic attempts, end conversation
    if (newOffTopicCount >= 2) {
      return {
        offTopicCount: newOffTopicCount,
        conversationEnded: true,
        endReason: 'off_topic',
        naturalResponse: "I'm specifically designed to help with our home services bookings. For other questions, please visit our website or contact our general support line.",
        completed: true,
        status: 'failed',
      };
    }

    return {
      offTopicCount: newOffTopicCount,
      naturalResponse: "I'm specifically here to help you book a service appointment. Can we get back to scheduling your service?",
      requiresUserInput: true,
    };
  }

  // Check max turns
  if (state.turnCount > (boundaries.maxTurns || 20)) {
    return {
      conversationEnded: true,
      endReason: 'max_turns',
      naturalResponse: "I notice we've been chatting for a while. Let me transfer you to a human specialist who can better assist you.",
      completed: true,
      status: 'failed',
    };
  }

  // Conversation is within boundaries
  return {
    engagingMessage: undefined, // Clear any previous engaging message
  };
}

/**
 * Node 1: Identify Customer
 */
async function identifyCustomerNode(state: OrchestratorState, mcpAdapter: any): Promise<StateUpdate> {
  console.log('[LangGraph] Identify Customer node');

  const graphNode = CalendarBookingGraph.nodes.identify_customer;

  // Check if we already have customer_name and customer_phone
  if (!state.variables.customer_name || !state.variables.customer_phone) {
    return {
      currentNode: 'identify_customer',
      naturalResponse: "Hi! I'd be happy to help you schedule a service. Can I get your name and phone number?",
      requiresUserInput: true,
      engagingMessage: undefined,
    };
  }

  // Search for existing customer by phone
  try {
    const mcpResult = await mcpAdapter.executeMCPTool('customer_list', {
      phone: state.variables.customer_phone,
    }, state.authToken);

    const customers = mcpResult?.customers || [];

    // Log agent action
    const agentAction = {
      agentRole: 'worker' as const,
      action: 'mcp_call',
      nodeContext: 'identify_customer',
      success: true,
      mcpTool: 'customer_list',
      mcpArgs: { phone: state.variables.customer_phone },
      mcpResult,
      timestamp: new Date(),
    };

    if (customers.length > 0) {
      // Existing customer found
      const customer = customers[0];
      return {
        currentNode: 'identify_customer',
        variables: {
          customer_id: customer.id,
          customer_name: customer.name,
          customer_email: customer.primary_email,
          customer_address: customer.primary_address,
          customer_city: customer.city,
          is_new_customer: false,
        },
        agentActions: [agentAction],
        metadata: {
          ...state.metadata,
          totalMcpCalls: state.metadata.totalMcpCalls + 1,
        },
      };
    } else {
      // New customer
      return {
        currentNode: 'identify_customer',
        variables: {
          is_new_customer: true,
        },
        agentActions: [agentAction],
        metadata: {
          ...state.metadata,
          totalMcpCalls: state.metadata.totalMcpCalls + 1,
        },
      };
    }
  } catch (error: any) {
    return {
      currentNode: 'identify_customer',
      error: {
        code: 'MCP_CALL_FAILED',
        message: error.message,
        agentRole: 'worker',
      },
      naturalResponse: "I'm having trouble accessing our customer database. Let me try again.",
      requiresUserInput: false,
    };
  }
}

/**
 * Node 2: Welcome Existing Customer
 */
async function welcomeExistingNode(state: OrchestratorState): Promise<StateUpdate> {
  console.log('[LangGraph] Welcome Existing Customer node');

  const customerName = state.variables.customer_name;
  const customerAddress = state.variables.customer_address || 'your address';

  return {
    currentNode: 'welcome_existing',
    naturalResponse: `Welcome back, ${customerName}! I see you're in our system at ${customerAddress}. Let's schedule your service!`,
    requiresUserInput: false,
  };
}

/**
 * Node 3: Create Customer
 */
async function createCustomerNode(state: OrchestratorState, mcpAdapter: any): Promise<StateUpdate> {
  console.log('[LangGraph] Create Customer node');

  // Check if we have all required info
  if (!state.variables.customer_address || !state.variables.customer_city) {
    return {
      currentNode: 'create_customer',
      naturalResponse: "Thanks! What's the service address and city where you need the work done?",
      requiresUserInput: true,
    };
  }

  // Create customer via MCP
  try {
    const mcpResult = await mcpAdapter.executeMCPTool('customer_create', {
      body_name: state.variables.customer_name,
      body_primary_phone: state.variables.customer_phone,
      body_primary_email: state.variables.customer_email,
      body_primary_address: state.variables.customer_address,
      body_city: state.variables.customer_city,
      body_postal_code: state.variables.customer_postal_code,
      body_province: 'ON',
      body_country: 'Canada',
    }, state.authToken);

    const agentAction = {
      agentRole: 'worker' as const,
      action: 'mcp_call',
      nodeContext: 'create_customer',
      success: true,
      mcpTool: 'customer_create',
      mcpArgs: { name: state.variables.customer_name },
      mcpResult,
      timestamp: new Date(),
    };

    return {
      currentNode: 'create_customer',
      variables: {
        customer_id: mcpResult.id,
        customer_code: mcpResult.code,
      },
      agentActions: [agentAction],
      naturalResponse: "Perfect! I've got your information saved. Now let's schedule your service.",
      metadata: {
        ...state.metadata,
        totalMcpCalls: state.metadata.totalMcpCalls + 1,
      },
    };
  } catch (error: any) {
    return {
      currentNode: 'create_customer',
      error: {
        code: 'CUSTOMER_CREATE_FAILED',
        message: error.message,
        agentRole: 'worker',
      },
      naturalResponse: "I'm having trouble creating your profile. Let me try again.",
    };
  }
}

/**
 * Node 4: Gather Booking Requirements
 */
async function gatherBookingRequirementsNode(state: OrchestratorState): Promise<StateUpdate> {
  console.log('[LangGraph] Gather Booking Requirements node');

  // Check if we have all required info
  if (!state.variables.service_category || !state.variables.desired_date || !state.variables.job_description) {
    return {
      currentNode: 'gather_booking_requirements',
      naturalResponse: "What service do you need? (HVAC, Plumbing, Electrical, Landscaping, or General Contracting) And when would you like us to come? Please also briefly describe what you need done.",
      requiresUserInput: true,
    };
  }

  // Validate date is in the future
  const desiredDate = new Date(state.variables.desired_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (desiredDate < today) {
    return {
      currentNode: 'gather_booking_requirements',
      naturalResponse: "The date you provided is in the past. Can you provide a future date?",
      requiresUserInput: true,
    };
  }

  return {
    currentNode: 'gather_booking_requirements',
    naturalResponse: `Got it! Let me check our ${state.variables.service_category} availability for ${state.variables.desired_date}.`,
    engagingMessage: "Checking technician availability...",
  };
}

/**
 * Node 5: Find Available Slots
 */
async function findAvailableSlotsNode(state: OrchestratorState, mcpAdapter: any): Promise<StateUpdate> {
  console.log('[LangGraph] Find Available Slots node');

  try {
    const mcpResult = await mcpAdapter.executeMCPTool('employee_list', {
      query_department: state.variables.service_category,
      query_status: 'active',
    }, state.authToken);

    const employees = mcpResult?.employees || [];

    const agentAction = {
      agentRole: 'worker' as const,
      action: 'mcp_call',
      nodeContext: 'find_available_slots',
      success: true,
      mcpTool: 'employee_list',
      mcpArgs: { department: state.variables.service_category },
      mcpResult,
      timestamp: new Date(),
    };

    if (employees.length > 0) {
      return {
        currentNode: 'find_available_slots',
        variables: {
          available_employees: employees,
        },
        agentActions: [agentAction],
        naturalResponse: `Great news! We have ${employees.length} technician${employees.length > 1 ? 's' : ''} available for ${state.variables.service_category}.`,
        metadata: {
          ...state.metadata,
          totalMcpCalls: state.metadata.totalMcpCalls + 1,
        },
      };
    } else {
      return {
        currentNode: 'find_available_slots',
        variables: {
          available_employees: [],
        },
        agentActions: [agentAction],
        naturalResponse: `I'm sorry, we don't have ${state.variables.service_category} technicians available on ${state.variables.desired_date}. Can you try another date?`,
        requiresUserInput: true,
        metadata: {
          ...state.metadata,
          totalMcpCalls: state.metadata.totalMcpCalls + 1,
        },
      };
    }
  } catch (error: any) {
    return {
      currentNode: 'find_available_slots',
      error: {
        code: 'AVAILABILITY_CHECK_FAILED',
        message: error.message,
        agentRole: 'worker',
      },
      naturalResponse: "I'm having trouble checking availability. Let me try again.",
    };
  }
}

/**
 * Node 6: Propose Options
 */
async function proposeOptionsNode(state: OrchestratorState): Promise<StateUpdate> {
  console.log('[LangGraph] Propose Options node');

  const employees = state.variables.available_employees || [];
  if (employees.length === 0) {
    return {
      currentNode: 'propose_options',
      naturalResponse: "No technicians available. Let's try a different date.",
      requiresUserInput: true,
    };
  }

  if (!state.variables.selected_time) {
    const technicianName = employees[0].name;
    return {
      currentNode: 'propose_options',
      naturalResponse: `I can schedule you with ${technicianName} on ${state.variables.desired_date}. What time works best? We have morning (9 AM) or afternoon (2 PM) available.`,
      requiresUserInput: true,
    };
  }

  // User selected time, assign first available employee
  return {
    currentNode: 'propose_options',
    variables: {
      selected_employee_id: employees[0].id,
    },
    naturalResponse: `Perfect! I'll book you for ${state.variables.selected_time} on ${state.variables.desired_date} with ${employees[0].name}.`,
  };
}

/**
 * Node 7: Create Booking
 */
async function createBookingNode(state: OrchestratorState, mcpAdapter: any): Promise<StateUpdate> {
  console.log('[LangGraph] Create Booking node');

  try {
    // Create task
    const taskResult = await mcpAdapter.executeMCPTool('task_create', {
      body_name: state.variables.job_description,
      body_descr: state.variables.job_description,
      body_task_category: state.variables.service_category,
      body_task_priority: 'medium',
      body_task_stage: 'new',
    }, state.authToken);

    // Create linkage
    await mcpAdapter.executeMCPTool('linkage_create', {
      body_parent_entity_type: 'customer',
      body_parent_entity_id: state.variables.customer_id,
      body_child_entity_type: 'task',
      body_child_entity_id: taskResult.id,
      body_linkage_type: 'customer_task',
    }, state.authToken);

    const agentAction = {
      agentRole: 'worker' as const,
      action: 'mcp_call',
      nodeContext: 'create_booking',
      success: true,
      mcpTool: 'task_create',
      mcpArgs: { name: state.variables.job_description },
      mcpResult: taskResult,
      timestamp: new Date(),
    };

    return {
      currentNode: 'create_booking',
      variables: {
        task_id: taskResult.id,
        task_code: taskResult.code,
        task_name: taskResult.name,
      },
      agentActions: [agentAction],
      naturalResponse: "Excellent! Your booking has been created successfully.",
      metadata: {
        ...state.metadata,
        totalMcpCalls: state.metadata.totalMcpCalls + 2,
      },
    };
  } catch (error: any) {
    return {
      currentNode: 'create_booking',
      error: {
        code: 'BOOKING_CREATE_FAILED',
        message: error.message,
        agentRole: 'worker',
      },
      naturalResponse: "I'm having trouble creating the booking. Let me try again.",
    };
  }
}

/**
 * Node 8: Confirm and Summarize
 */
async function confirmAndSummarizeNode(state: OrchestratorState): Promise<StateUpdate> {
  console.log('[LangGraph] Confirm and Summarize node');

  const summary = `Perfect! You're all set, ${state.variables.customer_name}.

📅 **Booking Confirmed**
- **Service**: ${state.variables.service_category}
- **Date**: ${state.variables.desired_date} at ${state.variables.selected_time}
- **Location**: ${state.variables.customer_address}
- **Booking #**: ${state.variables.task_code}

We'll send a reminder to ${state.variables.customer_email || state.variables.customer_phone}. Is there anything else you need help with?`;

  return {
    currentNode: 'confirm_and_summarize',
    naturalResponse: summary,
    completed: true,
    conversationEnded: true,
    endReason: 'completed',
    status: 'completed',
  };
}

/**
 * Routing function: Determine next node based on current state
 */
function routeNextNode(state: OrchestratorState): string {
  const currentNode = state.currentNode;

  // If conversation ended, go to END
  if (state.conversationEnded || state.completed) {
    return END;
  }

  // Error state - stay on current node for retry
  if (state.error) {
    return currentNode;
  }

  // Requires user input - stay on current node
  if (state.requiresUserInput) {
    return currentNode;
  }

  // Route based on current node
  switch (currentNode) {
    case 'entry':
      return 'critic';

    case 'critic':
      return 'identify_customer';

    case 'identify_customer':
      // Existing customer vs new customer
      if (state.variables.customer_id) {
        return 'welcome_existing';
      } else {
        return 'create_customer';
      }

    case 'welcome_existing':
      return 'gather_booking_requirements';

    case 'create_customer':
      if (state.variables.customer_id) {
        return 'gather_booking_requirements';
      }
      // Stay on create_customer if not completed
      return 'create_customer';

    case 'gather_booking_requirements':
      return 'find_available_slots';

    case 'find_available_slots':
      if (state.variables.available_employees?.length > 0) {
        return 'propose_options';
      } else {
        // No availability, go back to gather requirements
        return 'gather_booking_requirements';
      }

    case 'propose_options':
      if (state.variables.selected_time && state.variables.selected_employee_id) {
        return 'create_booking';
      }
      return 'propose_options';

    case 'create_booking':
      if (state.variables.task_id) {
        return 'confirm_and_summarize';
      }
      return 'create_booking';

    case 'confirm_and_summarize':
      return END;

    default:
      console.warn(`[LangGraph] Unknown node: ${currentNode}`);
      return END;
  }
}

/**
 * Create and compile the LangGraph StateGraph
 */
export function createCalendarBookingGraph(mcpAdapter: any) {
  // Create graph with state annotation
  const graph = new StateGraph(OrchestratorStateAnnotation)
    // Add nodes
    .addNode('entry', entryNode)
    .addNode('critic', criticNode)
    .addNode('identify_customer', (state: OrchestratorState) => identifyCustomerNode(state, mcpAdapter))
    .addNode('welcome_existing', welcomeExistingNode)
    .addNode('create_customer', (state: OrchestratorState) => createCustomerNode(state, mcpAdapter))
    .addNode('gather_booking_requirements', gatherBookingRequirementsNode)
    .addNode('find_available_slots', (state: OrchestratorState) => findAvailableSlotsNode(state, mcpAdapter))
    .addNode('propose_options', proposeOptionsNode)
    .addNode('create_booking', (state: OrchestratorState) => createBookingNode(state, mcpAdapter))
    .addNode('confirm_and_summarize', confirmAndSummarizeNode)

    // Add edges
    .addEdge(START, 'entry')
    .addConditionalEdges('entry', routeNextNode)
    .addConditionalEdges('critic', routeNextNode)
    .addConditionalEdges('identify_customer', routeNextNode)
    .addConditionalEdges('welcome_existing', routeNextNode)
    .addConditionalEdges('create_customer', routeNextNode)
    .addConditionalEdges('gather_booking_requirements', routeNextNode)
    .addConditionalEdges('find_available_slots', routeNextNode)
    .addConditionalEdges('propose_options', routeNextNode)
    .addConditionalEdges('create_booking', routeNextNode)
    .addConditionalEdges('confirm_and_summarize', routeNextNode);

  // Compile the graph
  return graph.compile();
}
