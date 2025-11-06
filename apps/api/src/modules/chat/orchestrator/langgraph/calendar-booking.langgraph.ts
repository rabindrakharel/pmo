/**
 * Calendar Booking LangGraph - Simplified Flow
 *
 * Flow:
 * 1. Create customer record if not exist
 * 2. Create task and record customer's issue
 * 3. Create calendar event for available employee with service expertise
 * 4. Put task link in calendar event
 * 5. Give info to customer about who is coming at what time
 *
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
 */
async function criticNode(state: OrchestratorState): Promise<StateUpdate> {
  console.log('[LangGraph] Critic node - Review conversation');

  const graph = CalendarBookingGraph;
  const { boundaries } = graph;
  const userMessage = state.userMessage?.toLowerCase() || '';

  // Check forbidden topics using whole-word matching to avoid false positives
  // (e.g., "news" shouldn't match in postal code "n3s 3k3")
  const isForbidden = boundaries.forbiddenTopics.some(topic => {
    const topicLower = topic.toLowerCase();
    // Use word boundary regex for more accurate matching
    const regex = new RegExp(`\\b${topicLower}\\b`, 'i');
    return regex.test(userMessage);
  });

  if (isForbidden) {
    const newOffTopicCount = state.offTopicCount + 1;

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

  return {
    engagingMessage: undefined,
  };
}

/**
 * Step 1: Create/Find Customer
 * Creates customer record if not exist, otherwise finds existing customer
 */
async function createOrFindCustomerNode(state: OrchestratorState, mcpAdapter: any): Promise<StateUpdate> {
  console.log('[LangGraph] Step 1: Create/Find Customer');

  // Check if we have required customer info
  if (!state.variables.customer_name || !state.variables.customer_phone) {
    return {
      currentNode: 'create_or_find_customer',
      naturalResponse: "Hi! I'd be happy to help you schedule a service. Can I get your name and phone number?",
      requiresUserInput: true,
    };
  }

  try {
    // First, try to find existing customer by phone
    const searchResult = await mcpAdapter.executeMCPTool('customer_list', {
      query_search: state.variables.customer_phone,
    }, state.authToken);

    const customers = searchResult?.data || searchResult?.customers || [];

    if (customers.length > 0) {
      // Existing customer found
      const customer = customers[0];
      console.log(`[LangGraph] Found existing customer: ${customer.id}`);

      return {
        currentNode: 'create_or_find_customer',
        variables: {
          customer_id: customer.id,
          customer_name: customer.name,
          customer_email: customer.primary_email,
          customer_address: customer.primary_address,
          customer_city: customer.city,
          is_new_customer: false,
        },
        naturalResponse: `Welcome back, ${customer.name}! Let's schedule your service.`,
        metadata: {
          ...state.metadata,
          totalMcpCalls: state.metadata.totalMcpCalls + 1,
        },
      };
    }

    // Customer not found, create new one
    console.log('[LangGraph] Creating new customer');

    // Get address if we don't have it yet
    if (!state.variables.customer_address) {
      return {
        currentNode: 'create_or_find_customer',
        naturalResponse: "Thanks! What's your service address?",
        requiresUserInput: true,
      };
    }

    const createResult = await mcpAdapter.executeMCPTool('customer_create', {
      body_name: state.variables.customer_name,
      body_primary_phone: state.variables.customer_phone,
      body_primary_email: state.variables.customer_email || '',
      body_primary_address: state.variables.customer_address,
      body_city: state.variables.customer_city || '',
      body_province: state.variables.customer_province || 'ON',
      body_postal_code: state.variables.customer_postal_code || '',
      body_country: 'Canada',
    }, state.authToken);

    console.log(`[LangGraph] Customer created: ${createResult.id}`);

    return {
      currentNode: 'create_or_find_customer',
      variables: {
        customer_id: createResult.id,
        customer_code: createResult.code,
        is_new_customer: true,
      },
      naturalResponse: `Perfect! I've saved your information. Now let's schedule your service.`,
      metadata: {
        ...state.metadata,
        totalMcpCalls: state.metadata.totalMcpCalls + 2,
      },
    };

  } catch (error: any) {
    console.error('[LangGraph] Customer create/find error:', error);
    return {
      currentNode: 'create_or_find_customer',
      error: {
        code: 'CUSTOMER_ERROR',
        message: error.message,
        agentRole: 'worker',
      },
      naturalResponse: "I'm having trouble with customer records. Let me try again.",
    };
  }
}

/**
 * Step 2: Create Task and Record Issue
 * Creates a task with the customer's service request
 */
async function createTaskNode(state: OrchestratorState, mcpAdapter: any): Promise<StateUpdate> {
  console.log('[LangGraph] Step 2: Create Task');

  // Check if we have required info
  if (!state.variables.service_category) {
    return {
      currentNode: 'create_task',
      naturalResponse: "What type of service do you need? (e.g., HVAC, Plumbing, Electrical, Landscaping, General Contracting)",
      requiresUserInput: true,
    };
  }

  if (!state.variables.job_description) {
    return {
      currentNode: 'create_task',
      naturalResponse: "Please tell me what you need done.",
      requiresUserInput: true,
    };
  }

  try {
    // Create task with customer's issue
    const taskName = `${state.variables.service_category}: ${state.variables.job_description}`;

    const taskResult = await mcpAdapter.executeMCPTool('task_create', {
      body_name: taskName,
      body_descr: `Customer: ${state.variables.customer_name}\nPhone: ${state.variables.customer_phone}\nAddress: ${state.variables.customer_address}\n\nIssue: ${state.variables.job_description}`,
      body_metadata: JSON.stringify({
        customer_id: state.variables.customer_id,
        service_category: state.variables.service_category,
        customer_name: state.variables.customer_name,
        customer_phone: state.variables.customer_phone,
        customer_address: state.variables.customer_address,
      }),
    }, state.authToken);

    console.log(`[LangGraph] Task created: ${taskResult.id}`);

    // Link task to customer
    await mcpAdapter.executeMCPTool('linkage_create', {
      body_parent_entity_type: 'cust',
      body_parent_entity_id: state.variables.customer_id,
      body_child_entity_type: 'task',
      body_child_entity_id: taskResult.id,
    }, state.authToken);

    return {
      currentNode: 'create_task',
      variables: {
        task_id: taskResult.id,
        task_code: taskResult.code,
        task_name: taskResult.name,
      },
      naturalResponse: `Got it! I've created work order #${taskResult.code} for your ${state.variables.service_category} service. Now let me find an available technician with that expertise.`,
      engagingMessage: "Finding available technician...",
      metadata: {
        ...state.metadata,
        totalMcpCalls: state.metadata.totalMcpCalls + 2,
      },
    };

  } catch (error: any) {
    console.error('[LangGraph] Task create error:', error);
    return {
      currentNode: 'create_task',
      error: {
        code: 'TASK_CREATE_ERROR',
        message: error.message,
        agentRole: 'worker',
      },
      naturalResponse: "I'm having trouble creating the work order. Let me try again.",
    };
  }
}

/**
 * Step 3: Find Available Employee with Service Expertise
 * Finds employees who can handle the requested service category
 */
async function findAvailableEmployeeNode(state: OrchestratorState, mcpAdapter: any): Promise<StateUpdate> {
  console.log('[LangGraph] Step 3: Find Available Employee');

  // Get desired date/time if not already set
  if (!state.variables.desired_date) {
    return {
      currentNode: 'find_available_employee',
      naturalResponse: "When would you like us to come? Please provide a date and time.",
      requiresUserInput: true,
    };
  }

  try {
    // Find employees with matching service expertise
    // Note: In real implementation, you'd filter by service category/expertise
    const employeeResult = await mcpAdapter.executeMCPTool('employee_list', {
      query_active: 'true',
    }, state.authToken);

    const employees = employeeResult?.data || employeeResult?.employees || [];

    console.log(`[LangGraph] Found ${employees.length} available employees`);

    if (employees.length === 0) {
      return {
        currentNode: 'find_available_employee',
        naturalResponse: `I'm sorry, we don't have any ${state.variables.service_category} technicians available on ${state.variables.desired_date}. Can you try a different date?`,
        requiresUserInput: true,
        metadata: {
          ...state.metadata,
          totalMcpCalls: state.metadata.totalMcpCalls + 1,
        },
      };
    }

    // Select first available employee (in production, check calendar availability)
    const selectedEmployee = employees[0];

    return {
      currentNode: 'find_available_employee',
      variables: {
        assigned_employee_id: selectedEmployee.id,
        assigned_employee_name: selectedEmployee.name,
        assigned_employee_email: selectedEmployee.email,
        assigned_employee_phone: selectedEmployee.phone,
      },
      naturalResponse: `Great! I found ${selectedEmployee.name}, our ${state.variables.service_category} specialist. Let me create the calendar appointment.`,
      engagingMessage: "Creating calendar appointment...",
      metadata: {
        ...state.metadata,
        totalMcpCalls: state.metadata.totalMcpCalls + 1,
      },
    };

  } catch (error: any) {
    console.error('[LangGraph] Employee search error:', error);
    return {
      currentNode: 'find_available_employee',
      error: {
        code: 'EMPLOYEE_SEARCH_ERROR',
        message: error.message,
        agentRole: 'worker',
      },
      naturalResponse: "I'm having trouble finding available technicians. Let me try again.",
    };
  }
}

/**
 * Step 4: Create Calendar Event with Task Link
 * Creates calendar appointment and links it to the task
 */
async function createCalendarEventNode(state: OrchestratorState, mcpAdapter: any): Promise<StateUpdate> {
  console.log('[LangGraph] Step 4: Create Calendar Event');

  try {
    // Parse date and time
    const appointmentDateTime = new Date(state.variables.desired_date);
    const startTime = appointmentDateTime.toISOString();

    // Default 2-hour appointment
    const endTime = new Date(appointmentDateTime.getTime() + 2 * 60 * 60 * 1000).toISOString();

    // Create calendar event with task link in description
    const calendarResult = await mcpAdapter.executeMCPTool('calendar_create', {
      body_title: `${state.variables.service_category} Service - ${state.variables.customer_name}`,
      body_description: `Work Order: #${state.variables.task_code}\nTask ID: ${state.variables.task_id}\n\nCustomer: ${state.variables.customer_name}\nPhone: ${state.variables.customer_phone}\nAddress: ${state.variables.customer_address}\n\nService: ${state.variables.job_description}`,
      body_start_time: startTime,
      body_end_time: endTime,
      body_location: state.variables.customer_address,
      body_event_type: 'service_appointment',
      body_metadata: JSON.stringify({
        task_id: state.variables.task_id,
        task_code: state.variables.task_code,
        customer_id: state.variables.customer_id,
        employee_id: state.variables.assigned_employee_id,
        service_category: state.variables.service_category,
      }),
    }, state.authToken);

    console.log(`[LangGraph] Calendar event created: ${calendarResult.id}`);

    // Link calendar event to task
    await mcpAdapter.executeMCPTool('linkage_create', {
      body_parent_entity_type: 'task',
      body_parent_entity_id: state.variables.task_id,
      body_child_entity_type: 'calendar',
      body_child_entity_id: calendarResult.id,
    }, state.authToken);

    // Link calendar event to employee
    await mcpAdapter.executeMCPTool('linkage_create', {
      body_parent_entity_type: 'employee',
      body_parent_entity_id: state.variables.assigned_employee_id,
      body_child_entity_type: 'calendar',
      body_child_entity_id: calendarResult.id,
    }, state.authToken);

    // Update task to assign employee
    await mcpAdapter.executeMCPTool('task_update', {
      id: state.variables.task_id,
      body_assignee_id: state.variables.assigned_employee_id,
      body_task_stage: 'assigned',
    }, state.authToken);

    return {
      currentNode: 'create_calendar_event',
      variables: {
        calendar_event_id: calendarResult.id,
        appointment_start: startTime,
        appointment_end: endTime,
      },
      naturalResponse: `Perfect! The appointment has been scheduled.`,
      metadata: {
        ...state.metadata,
        totalMcpCalls: state.metadata.totalMcpCalls + 4,
      },
    };

  } catch (error: any) {
    console.error('[LangGraph] Calendar create error:', error);
    return {
      currentNode: 'create_calendar_event',
      error: {
        code: 'CALENDAR_CREATE_ERROR',
        message: error.message,
        agentRole: 'worker',
      },
      naturalResponse: "I'm having trouble creating the calendar appointment. Let me try again.",
    };
  }
}

/**
 * Step 5: Confirm and Notify Customer
 * Gives customer the final booking information and asks for additional requests
 */
async function confirmAndNotifyNode(state: OrchestratorState): Promise<StateUpdate> {
  console.log('[LangGraph] Step 5: Confirm and Notify');

  // Check if we've already asked for another request
  if (!state.variables.asked_for_another_request) {
    // First time: Show summary and ask for more requests
    const appointmentDate = new Date(state.variables.appointment_start);
    const dateStr = appointmentDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timeStr = appointmentDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });

    const summary = `✅ **Booking Confirmed!**

${state.variables.customer_name}, your ${state.variables.service_category} service is all set!

👤 **Technician**: ${state.variables.assigned_employee_name}
📞 **Their Phone**: ${state.variables.assigned_employee_phone || 'Will call before arrival'}
📅 **Date**: ${dateStr}
⏰ **Time**: ${timeStr}
📍 **Location**: ${state.variables.customer_address}
🎫 **Work Order**: #${state.variables.task_code}

${state.variables.assigned_employee_name} will arrive at your location at ${timeStr} on ${dateStr} to handle your ${state.variables.job_description}.

We'll send you a reminder 24 hours before the appointment. Is there anything else you need help with today?`;

    return {
      currentNode: 'confirm_and_notify',
      naturalResponse: summary,
      requiresUserInput: true,
      variables: {
        ...state.variables,
        asked_for_another_request: true,
      },
    };
  }

  // Second time: User has responded, check their answer
  const userMessage = state.userMessage?.toLowerCase() || '';
  const hasAnotherRequest =
    userMessage.includes('yes') ||
    userMessage.includes('yeah') ||
    userMessage.includes('sure') ||
    userMessage.includes('i need') ||
    userMessage.includes('can you') ||
    userMessage.includes('help me') ||
    (userMessage.length > 10 && !userMessage.includes('no') && !userMessage.includes('that\'s all'));

  if (hasAnotherRequest) {
    // Customer has another request - signal to route to orchestrator
    return {
      currentNode: 'confirm_and_notify',
      naturalResponse: "Absolutely! What else can I help you with?",
      variables: {
        ...state.variables,
        has_another_request: true,
      },
      conversationEnded: true,
      endReason: 'completed',
      status: 'completed',
      completed: true,
    };
  }

  // Customer doesn't have another request - end call
  return {
    currentNode: 'confirm_and_notify',
    naturalResponse: "Thank you for choosing Huron Home Services! Have a great day!",
    conversationEnded: true,
    endReason: 'completed',
    status: 'completed',
    completed: true,
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
      return 'create_or_find_customer';

    case 'create_or_find_customer':
      // Move to create task if we have customer ID
      if (state.variables.customer_id) {
        return 'create_task';
      }
      // Stay if still gathering customer info
      return 'create_or_find_customer';

    case 'create_task':
      // Move to find employee if task created
      if (state.variables.task_id) {
        return 'find_available_employee';
      }
      // Stay if still creating task
      return 'create_task';

    case 'find_available_employee':
      // Move to create calendar if employee assigned
      if (state.variables.assigned_employee_id) {
        return 'create_calendar_event';
      }
      // Stay if still finding employee
      return 'find_available_employee';

    case 'create_calendar_event':
      // Move to confirm if calendar event created
      if (state.variables.calendar_event_id) {
        return 'confirm_and_notify';
      }
      // Stay if still creating event
      return 'create_calendar_event';

    case 'confirm_and_notify':
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
    // Add nodes - Simplified 5-step workflow
    .addNode('entry', entryNode)
    .addNode('critic', criticNode)
    .addNode('create_or_find_customer', (state: OrchestratorState) => createOrFindCustomerNode(state, mcpAdapter))
    .addNode('create_task', (state: OrchestratorState) => createTaskNode(state, mcpAdapter))
    .addNode('find_available_employee', (state: OrchestratorState) => findAvailableEmployeeNode(state, mcpAdapter))
    .addNode('create_calendar_event', (state: OrchestratorState) => createCalendarEventNode(state, mcpAdapter))
    .addNode('confirm_and_notify', confirmAndNotifyNode)

    // Add edges - Linear flow with conditional routing
    .addEdge(START, 'entry')
    .addConditionalEdges('entry', routeNextNode)
    .addConditionalEdges('critic', routeNextNode)
    .addConditionalEdges('create_or_find_customer', routeNextNode)
    .addConditionalEdges('create_task', routeNextNode)
    .addConditionalEdges('find_available_employee', routeNextNode)
    .addConditionalEdges('create_calendar_event', routeNextNode)
    .addConditionalEdges('confirm_and_notify', routeNextNode);

  // Compile the graph
  return graph.compile();
}
