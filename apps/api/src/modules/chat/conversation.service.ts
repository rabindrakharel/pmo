/**
 * Conversation Service
 * Manages chat sessions and stores interactions in database
 * @module chat/conversation.service
 */

import { client, db } from '../../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage, ChatSession } from './types.js';

/**
 * Create a new chat session
 */
export async function createSession(args: {
  customer_id?: string;
  customer_email?: string;
  customer_name?: string;
  referrer_url?: string;
  metadata?: Record<string, any>;
}): Promise<{
  session_id: string;
  interaction_number: string;
}> {
  // Retry up to 5 times in case of duplicate key errors
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const sessionId = uuidv4();
      const interactionNumber = await generateInteractionNumber();

      // Get customer info if customer_id provided
      let customerName = args.customer_name;
      let customerType = 'residential';

      if (args.customer_id) {
        const custResult = await client`
          SELECT name, cust_type FROM app.d_cust
          WHERE id = ${args.customer_id}::uuid AND active_flag = true
        `;
        if (custResult.length > 0) {
          customerName = custResult[0].name;
          customerType = custResult[0].cust_type;
        }
      }

      // Insert into f_customer_interaction
      await client`
        INSERT INTO app.f_customer_interaction (
          id,
          interaction_number,
          interaction_type,
          interaction_subtype,
          channel,
          interaction_ts,
          interaction_person_entities,
          content_text,
          source_system,
          metadata
        ) VALUES (
          ${sessionId}::uuid,
          ${interactionNumber},
          'chat',
          'inbound',
          'live_chat',
          now(),
          ${JSON.stringify(args.customer_id ? [{ person_entity_type: 'customer', person_id: args.customer_id }] : [])}::jsonb,
          '',
          'ai_chat_widget',
          ${JSON.stringify({
            ...args.metadata || {},
            customer_name: customerName || 'Anonymous',
            customer_type: customerType,
            resolution_status: 'open',
            active_flag: true,
            browser_user_agent: args.metadata?.user_agent || null,
            referrer_url: args.referrer_url || null,
            customer_email: args.customer_email || null
          })}::jsonb
        )
        RETURNING id::text
      `;

      console.log(`✅ Created chat session: ${sessionId}`);

      return {
        session_id: sessionId,
        interaction_number: interactionNumber
      };
    } catch (error: any) {
      // If it's a duplicate key error, retry with a new number
      if (error.code === '23505' && error.constraint_name === 'f_customer_interaction_interaction_number_key') {
        console.log(`⚠️ Duplicate interaction number on attempt ${attempt + 1}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1))); // Exponential backoff
        continue;
      }

      // For other errors, throw immediately
      console.error('Error creating session:', error);
      throw new Error('Failed to create chat session');
    }
  }

  // If we exhausted all retries
  throw new Error('Failed to create chat session after multiple attempts');
}

/**
 * Get session by ID
 */
export async function getSession(sessionId: string): Promise<ChatSession | null> {
  try {
    const result = await client`
      SELECT
        id::text as session_id,
        interaction_type,
        content_text as conversation_history,
        source_system as model_used,
        metadata,
        interaction_person_entities,
        created_ts::text,
        updated_ts::text
      FROM app.f_customer_interaction
      WHERE id = ${sessionId}::uuid
    `;

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    const conversationHistory = row.conversation_history
      ? (typeof row.conversation_history === 'string' ? JSON.parse(row.conversation_history) : row.conversation_history)
      : [];

    // Extract customer info from metadata and interaction_person_entities
    const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
    const personEntities = typeof row.interaction_person_entities === 'string' ? JSON.parse(row.interaction_person_entities) : (row.interaction_person_entities || []);

    // Find customer entity from person_entities
    const customerEntity = personEntities.find((e: any) => e.person_entity_type === 'customer');
    const customerId = customerEntity?.person_id;

    return {
      session_id: row.session_id,
      customer_id: customerId,
      customer_email: metadata?.customer_email,
      customer_name: metadata?.customer_name || 'Anonymous',
      interaction_type: row.interaction_type,
      conversation_history: conversationHistory,
      model_used: row.model_used || 'gpt-4',
      total_tokens: metadata?.total_tokens || 0,
      total_cost_cents: metadata?.total_cost_cents || 0,
      created_ts: row.created_ts,
      updated_ts: row.updated_ts
    };
  } catch (error) {
    console.error('Error getting session:', error);
    throw new Error('Failed to get session');
  }
}

/**
 * Update session with new messages and metadata
 */
export async function updateSession(
  sessionId: string,
  conversationHistory: ChatMessage[],
  metadata: {
    total_tokens?: number;
    total_cost_cents?: number;
    model_used?: string;
    function_calls?: string[];
  }
): Promise<void> {
  try {
    // Build conversation text summary
    const conversationText = conversationHistory
      .map(msg => `[${msg.role}]: ${msg.content}`)
      .join('\n\n');

    // Extract last user message for sentiment analysis (simple heuristic)
    const lastUserMessage = conversationHistory
      .filter(m => m.role === 'user')
      .slice(-1)[0];

    let sentimentScore = 0;
    let sentimentLabel = 'neutral';

    if (lastUserMessage) {
      const content = lastUserMessage.content.toLowerCase();
      if (content.includes('thank') || content.includes('great') || content.includes('perfect')) {
        sentimentScore = 80;
        sentimentLabel = 'positive';
      } else if (content.includes('problem') || content.includes('issue') || content.includes('complaint')) {
        sentimentScore = -30;
        sentimentLabel = 'negative';
      }
    }

    // Update interaction record
    const updateQuery = client`
      UPDATE app.f_customer_interaction
      SET
        content_text = ${JSON.stringify(conversationHistory)},
        content_summary = ${conversationText.substring(0, 500)},
        sentiment_score = ${sentimentScore},
        sentiment_label = ${sentimentLabel},
        metadata = metadata || ${JSON.stringify(metadata)}::jsonb,
        updated_ts = now(),
        duration_seconds = EXTRACT(EPOCH FROM (now() - created_ts))::integer
      WHERE id = ${sessionId}::uuid
    `;

    await updateQuery;

  } catch (error) {
    console.error('Error updating session:', error);
    throw new Error('Failed to update session');
  }
}

/**
 * Get conversation history for a session
 */
export async function getConversationHistory(sessionId: string): Promise<ChatMessage[]> {
  const session = await getSession(sessionId);
  return session?.conversation_history || [];
}

/**
 * Close a session (mark as resolved/closed)
 */
export async function closeSession(
  sessionId: string,
  resolution: 'resolved' | 'abandoned' | 'escalated'
): Promise<void> {
  try {
    await client`
      UPDATE app.f_customer_interaction
      SET
        metadata = metadata || ${JSON.stringify({ resolution_status: resolution })}::jsonb,
        updated_ts = now()
      WHERE id = ${sessionId}::uuid
    `;
  } catch (error) {
    console.error('Error closing session:', error);
    throw new Error('Failed to close session');
  }
}

/**
 * Generate unique interaction number
 * Format: INT-YYYY-NNNNN
 * Uses a retry loop to handle race conditions
 */
async function generateInteractionNumber(): Promise<string> {
  const year = new Date().getFullYear();

  // Get the highest number used this year
  const result = await client`
    SELECT interaction_number
    FROM app.f_customer_interaction
    WHERE interaction_number LIKE ${`INT-${year}-%`}
    ORDER BY interaction_number DESC
    LIMIT 1
  `;

  let nextNumber = 1;
  if (result.length > 0) {
    const lastNumber = result[0].interaction_number;
    const match = lastNumber.match(/INT-\d{4}-(\d{5})/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  const interactionNumber = `INT-${year}-${nextNumber.toString().padStart(5, '0')}`;

  // Try up to 10 times in case of race conditions
  for (let attempt = 0; attempt < 10; attempt++) {
    const checkNumber = `INT-${year}-${(nextNumber + attempt).toString().padStart(5, '0')}`;

    // Check if this number already exists
    const existingCheck = await client`
      SELECT 1
      FROM app.f_customer_interaction
      WHERE interaction_number = ${checkNumber}
      LIMIT 1
    `;

    if (existingCheck.length === 0) {
      return checkNumber; // Found a unique number
    }
  }

  // Fallback to timestamp-based if all sequential attempts fail
  return `INT-${year}-${Date.now().toString().slice(-5)}`;
}

/**
 * Get recent interactions (for analytics)
 */
export async function getRecentInteractions(limit: number = 50): Promise<any[]> {
  try {
    const result = await client`
      SELECT
        id::text,
        interaction_number,
        interaction_ts,
        metadata->>'customer_name' as customer_name,
        sentiment_label,
        metadata->>'resolution_status' as resolution_status,
        duration_seconds
      FROM app.f_customer_interaction
      WHERE interaction_type = 'chat'
        AND source_system = 'ai_chat_widget'
        AND metadata->>'active_flag' = 'true'
      ORDER BY interaction_ts DESC
      LIMIT ${limit}
    `;

    return result;
  } catch (error) {
    console.error('Error getting recent interactions:', error);
    throw new Error('Failed to get recent interactions');
  }
}
