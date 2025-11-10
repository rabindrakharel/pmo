/**
 * MCP Tools for Session Memory Data Interaction
 *
 * Provides tools for agents to read and write session memory data via LowDB
 *
 * Access Pattern:
 * - Agents READ freely via MCP tools (get_session_memory_data, get_context_data)
 * - Agents WRITE only via sessionMemoryDataService API (through MCP update tools)
 * - Service ensures atomic operations and prevents race conditions
 */

import { getSessionMemoryDataService } from '../services/session-memory-data.service.js';
import type { AgentContextState } from '../agents/agent-context.service.js';

/**
 * Get session memory data from LowDB
 */
export async function getSessionMemoryData(sessionId: string): Promise<any> {
  const sessionMemoryDataService = getSessionMemoryDataService();

  console.log(`[MCP:SessionMemoryData] 📖 Reading session ${sessionId.substring(0, 8)}... from DB`);

  const session = await sessionMemoryDataService.getSession(sessionId);

  if (!session) {
    console.log(`[MCP:SessionMemoryData] ⚠️  Session ${sessionId.substring(0, 8)}... not found in DB`);
    return null;
  }

  console.log(`[MCP:SessionMemoryData] ✅ Retrieved session data (${session.messages.length} messages, ${session.context.node_traversed.length} nodes)`);

  return session;
}

/**
 * Save session memory data to LowDB
 */
export async function saveSessionMemoryData(
  sessionData: any,
  action: string = 'update'
): Promise<void> {
  const sessionMemoryDataService = getSessionMemoryDataService();

  const shortId = sessionData.sessionId.substring(0, 8);
  console.log(`[MCP:SessionMemoryData] 💾 Saving session ${shortId}... to DB (${action})`);

  await sessionMemoryDataService.saveSession({
    ...sessionData,
    action,
  });

  console.log(`[MCP:SessionMemoryData] ✅ Session ${shortId}... saved successfully`);
}

/**
 * Update specific session memory data fields in LowDB
 */
export async function updateSessionMemoryData(
  sessionId: string,
  updates: Partial<any>,
  action: string = 'partial_update'
): Promise<void> {
  const sessionMemoryDataService = getSessionMemoryDataService();

  const shortId = sessionId.substring(0, 8);
  console.log(`[MCP:SessionMemoryData] 🔄 Updating session ${shortId}... in DB`);

  await sessionMemoryDataService.updateSession(sessionId, updates, action);

  console.log(`[MCP:SessionMemoryData] ✅ Session ${shortId}... updated successfully`);
}

/**
 * Get only context object (lightweight)
 */
export async function getContextData(sessionId: string): Promise<any | null> {
  const sessionMemoryDataService = getSessionMemoryDataService();

  console.log(`[MCP:SessionMemoryData] 📖 Reading context data for session ${sessionId.substring(0, 8)}...`);

  const session = await sessionMemoryDataService.getSession(sessionId);

  if (!session) {
    return null;
  }

  return session.context;
}

/**
 * Update only data_extraction_fields
 */
export async function updateDataExtractionFields(
  sessionId: string,
  fields: Record<string, any>
): Promise<void> {
  const sessionMemoryDataService = getSessionMemoryDataService();

  const shortId = sessionId.substring(0, 8);
  console.log(`[MCP:SessionMemoryData] 🔄 Updating data_extraction_fields for session ${shortId}...`);

  // Get current session
  const session = await sessionMemoryDataService.getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  // ✅ DEEP MERGE: Merge nested categories (customer, service, operations, etc.)
  const existingFields = session.context.data_extraction_fields || {};
  const updatedFields: any = { ...existingFields };

  for (const [category, categoryData] of Object.entries(fields)) {
    if (typeof categoryData === 'object' && !Array.isArray(categoryData) && categoryData !== null) {
      // Merge nested object (customer, service, operations, etc.)
      updatedFields[category] = {
        ...(existingFields[category] || {}), // Preserve existing fields
        ...categoryData                      // Add/update new fields
      };
    } else {
      // Not a nested object, just assign
      updatedFields[category] = categoryData;
    }
  }

  await sessionMemoryDataService.updateSession(
    sessionId,
    {
      context: {
        ...session.context,
        data_extraction_fields: updatedFields,
      },
    },
    'data_extraction'
  );

  const updatedFieldNames = Object.keys(fields);
  console.log(`[MCP:SessionMemoryData] ✅ Updated fields: ${updatedFieldNames.join(', ')}`);
}

/**
 * Append conversation exchange to indexed summary
 */
export async function appendConversationToMemoryData(
  sessionId: string,
  customer: string,
  agent: string
): Promise<void> {
  const sessionMemoryDataService = getSessionMemoryDataService();

  const shortId = sessionId.substring(0, 8);

  // Get current session
  const session = await sessionMemoryDataService.getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const currentSummary = session.context.summary_of_conversation_on_each_step_until_now || [];
  const nextIndex = currentSummary.length;

  // Check for duplicates
  const isDuplicate = currentSummary.some(
    (entry: any) => entry.customer === customer && entry.agent === agent
  );

  if (isDuplicate) {
    console.log(`[MCP:SessionMemoryData] ⚠️  Skipping duplicate conversation entry for session ${shortId}...`);
    return;
  }

  // Append new exchange
  const updatedSummary = [
    ...currentSummary,
    {
      index: nextIndex,
      customer,
      agent,
    },
  ];

  await sessionMemoryDataService.updateSession(
    sessionId,
    {
      context: {
        ...session.context,
        summary_of_conversation_on_each_step_until_now: updatedSummary,
      },
    },
    'conversation_append'
  );

  console.log(`[MCP:SessionMemoryData] 💬 Appended conversation exchange #${nextIndex} for session ${shortId}...`);
}

/**
 * Append node to traversal path
 */
export async function appendNodeTraversal(
  sessionId: string,
  nodeName: string
): Promise<void> {
  const sessionMemoryDataService = getSessionMemoryDataService();

  const shortId = sessionId.substring(0, 8);

  // Get current session
  const session = await sessionMemoryDataService.getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const currentPath = session.context.node_traversed || [];
  const updatedPath = [...currentPath, nodeName];

  await sessionMemoryDataService.updateSession(
    sessionId,
    {
      context: {
        ...session.context,
        node_traversed: updatedPath,
      },
    },
    `node_traversal:${nodeName}`
  );

  console.log(`[MCP:SessionMemoryData] 🗺️  Appended node ${nodeName} to path for session ${shortId}... (total: ${updatedPath.length})`);
}

/**
 * MCP Tool Definitions for OpenAI Function Calling
 */
export const sessionMemoryDataMcpTools = [
  {
    type: 'function' as const,
    function: {
      name: 'get_session_memory_data',
      description: 'Retrieve complete session memory data from the database including messages, context fields, and navigation history',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'The session ID to retrieve memory data for',
          },
        },
        required: ['sessionId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_context_data',
      description: 'Retrieve only the context object (lightweight) - includes data_extraction_fields, node_traversed, flags, etc.',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'The session ID to retrieve context data for',
          },
        },
        required: ['sessionId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_data_extraction_fields',
      description: 'Update specific data extraction fields (nested structure: customer.*, service.*, operations.*, etc.) in the session memory data',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'The session ID to update',
          },
          fields: {
            type: 'object',
            description: 'Nested object containing field categories and values to update',
            properties: {
              customer: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  phone: { type: 'string' },
                  email: { type: 'string' },
                  id: { type: 'string' },
                },
              },
              service: {
                type: 'object',
                properties: {
                  primary_request: { type: 'string' },
                  catalog_match: { type: 'string' },
                  related_entities: { type: 'string' },
                },
              },
              operations: {
                type: 'object',
                properties: {
                  solution_plan: { type: 'string' },
                  task_id: { type: 'string' },
                  task_name: { type: 'string' },
                  appointment_details: { type: 'string' },
                },
              },
              project: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                },
              },
              assignment: {
                type: 'object',
                properties: {
                  employee_id: { type: 'string' },
                  employee_name: { type: 'string' },
                },
              },
            },
          },
        },
        required: ['sessionId', 'fields'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_session_memory_data',
      description: 'Update session memory data fields (next_course_of_action, next_node_to_go_to, currentNode, etc.)',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'The session ID to update',
          },
          updates: {
            type: 'object',
            description: 'Object containing fields to update',
            properties: {
              currentNode: { type: 'string' },
              completed: { type: 'boolean' },
              conversationEnded: { type: 'boolean' },
              endReason: { type: 'string' },
              context: {
                type: 'object',
                properties: {
                  next_course_of_action: { type: 'string' },
                  next_node_to_go_to: { type: 'string' },
                },
              },
            },
          },
          action: {
            type: 'string',
            description: 'Description of the action being performed',
          },
        },
        required: ['sessionId', 'updates'],
      },
    },
  },
];

/**
 * Execute MCP tool call
 */
export async function executeSessionMemoryDataMcpTool(
  toolName: string,
  args: any
): Promise<any> {
  console.log(`[MCP:SessionMemoryData] 🔧 Executing tool: ${toolName}`);
  console.log(`[MCP:SessionMemoryData] 📝 Arguments:`, JSON.stringify(args, null, 2));

  try {
    switch (toolName) {
      case 'get_session_memory_data':
        return await getSessionMemoryData(args.sessionId);

      case 'get_context_data':
        return await getContextData(args.sessionId);

      case 'update_data_extraction_fields':
        await updateDataExtractionFields(args.sessionId, args.fields);
        return { success: true, fieldsUpdated: Object.keys(args.fields) };

      case 'update_session_memory_data':
        await updateSessionMemoryData(args.sessionId, args.updates, args.action);
        return { success: true };

      default:
        throw new Error(`Unknown MCP tool: ${toolName}`);
    }
  } catch (error: any) {
    console.error(`[MCP:SessionMemoryData] ❌ Error executing tool ${toolName}:`, error.message);
    throw error;
  }
}
