/**
 * MCP Tools for Context Database Interaction
 *
 * Provides tools for agents to read and write session context data via LowDB
 */

import { getContextDbService } from '../services/context-db.service.js';
import type { AgentContextState } from '../agents/types.js';

/**
 * Get session context from LowDB
 */
export async function getContextFromDb(sessionId: string): Promise<any> {
  const contextDb = getContextDbService();

  console.log(`[MCP:ContextDB] 📖 Reading session ${sessionId.substring(0, 8)}... from DB`);

  const session = await contextDb.getSession(sessionId);

  if (!session) {
    console.log(`[MCP:ContextDB] ⚠️  Session ${sessionId.substring(0, 8)}... not found in DB`);
    return null;
  }

  console.log(`[MCP:ContextDB] ✅ Retrieved session data (${session.messages.length} messages, ${session.context.node_traversed.length} nodes)`);

  return session;
}

/**
 * Save session context to LowDB
 */
export async function saveContextToDb(
  sessionData: any,
  action: string = 'update'
): Promise<void> {
  const contextDb = getContextDbService();

  const shortId = sessionData.sessionId.substring(0, 8);
  console.log(`[MCP:ContextDB] 💾 Saving session ${shortId}... to DB (${action})`);

  await contextDb.saveSession({
    ...sessionData,
    action,
  });

  console.log(`[MCP:ContextDB] ✅ Session ${shortId}... saved successfully`);
}

/**
 * Update specific context fields in LowDB
 */
export async function updateContextInDb(
  sessionId: string,
  updates: Partial<any>,
  action: string = 'partial_update'
): Promise<void> {
  const contextDb = getContextDbService();

  const shortId = sessionId.substring(0, 8);
  console.log(`[MCP:ContextDB] 🔄 Updating session ${shortId}... in DB`);

  await contextDb.updateSession(sessionId, updates, action);

  console.log(`[MCP:ContextDB] ✅ Session ${shortId}... updated successfully`);
}

/**
 * Get only context object (lightweight)
 */
export async function getContextDataFromDb(sessionId: string): Promise<any | null> {
  const contextDb = getContextDbService();

  console.log(`[MCP:ContextDB] 📖 Reading context data for session ${sessionId.substring(0, 8)}...`);

  const session = await contextDb.getSession(sessionId);

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
  const contextDb = getContextDbService();

  const shortId = sessionId.substring(0, 8);
  console.log(`[MCP:ContextDB] 🔄 Updating data_extraction_fields for session ${shortId}...`);

  // Get current session
  const session = await contextDb.getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  // Merge data_extraction_fields
  const updatedFields = {
    ...session.context.data_extraction_fields,
    ...fields,
  };

  await contextDb.updateSession(
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
  console.log(`[MCP:ContextDB] ✅ Updated fields: ${updatedFieldNames.join(', ')}`);
}

/**
 * Append conversation exchange to indexed summary
 */
export async function appendConversationToDb(
  sessionId: string,
  customer: string,
  agent: string
): Promise<void> {
  const contextDb = getContextDbService();

  const shortId = sessionId.substring(0, 8);

  // Get current session
  const session = await contextDb.getSession(sessionId);
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
    console.log(`[MCP:ContextDB] ⚠️  Skipping duplicate conversation entry for session ${shortId}...`);
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

  await contextDb.updateSession(
    sessionId,
    {
      context: {
        ...session.context,
        summary_of_conversation_on_each_step_until_now: updatedSummary,
      },
    },
    'conversation_append'
  );

  console.log(`[MCP:ContextDB] 💬 Appended conversation exchange #${nextIndex} for session ${shortId}...`);
}

/**
 * Append node to traversal path
 */
export async function appendNodeTraversalToDb(
  sessionId: string,
  nodeName: string
): Promise<void> {
  const contextDb = getContextDbService();

  const shortId = sessionId.substring(0, 8);

  // Get current session
  const session = await contextDb.getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const currentPath = session.context.node_traversed || [];
  const updatedPath = [...currentPath, nodeName];

  await contextDb.updateSession(
    sessionId,
    {
      context: {
        ...session.context,
        node_traversed: updatedPath,
      },
    },
    `node_traversal:${nodeName}`
  );

  console.log(`[MCP:ContextDB] 🗺️  Appended node ${nodeName} to path for session ${shortId}... (total: ${updatedPath.length})`);
}

/**
 * MCP Tool Definitions for OpenAI Function Calling
 */
export const contextDbMcpTools = [
  {
    type: 'function' as const,
    function: {
      name: 'get_session_context',
      description: 'Retrieve complete session context data from the database including messages, context fields, and navigation history',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'The session ID to retrieve context for',
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
      description: 'Update specific data extraction fields (customer_name, phone, email, etc.) in the session context',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'The session ID to update',
          },
          fields: {
            type: 'object',
            description: 'Object containing field names and values to update',
            properties: {
              customer_name: { type: 'string' },
              customer_phone_number: { type: 'string' },
              customer_email: { type: 'string' },
              customers_main_ask: { type: 'string' },
              matching_service_catalog_to_solve_customers_issue: { type: 'string' },
              related_entities_for_customers_ask: { type: 'string' },
              task_id: { type: 'string' },
              appointment_details: { type: 'string' },
              project_id: { type: 'string' },
              assigned_employee_id: { type: 'string' },
              assigned_employee_name: { type: 'string' },
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
      name: 'update_session_context',
      description: 'Update session context fields (next_course_of_action, next_node_to_go_to, currentNode, etc.)',
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
export async function executeContextDbMcpTool(
  toolName: string,
  args: any
): Promise<any> {
  console.log(`[MCP:ContextDB] 🔧 Executing tool: ${toolName}`);
  console.log(`[MCP:ContextDB] 📝 Arguments:`, JSON.stringify(args, null, 2));

  try {
    switch (toolName) {
      case 'get_session_context':
        return await getContextFromDb(args.sessionId);

      case 'get_context_data':
        return await getContextDataFromDb(args.sessionId);

      case 'update_data_extraction_fields':
        await updateDataExtractionFields(args.sessionId, args.fields);
        return { success: true, fieldsUpdated: Object.keys(args.fields) };

      case 'update_session_context':
        await updateContextInDb(args.sessionId, args.updates, args.action);
        return { success: true };

      default:
        throw new Error(`Unknown MCP tool: ${toolName}`);
    }
  } catch (error: any) {
    console.error(`[MCP:ContextDB] ❌ Error executing tool ${toolName}:`, error.message);
    throw error;
  }
}
