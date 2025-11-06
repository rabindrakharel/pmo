/**
 * Orchestrator API Routes
 * HTTP endpoints for multi-agent orchestration
 * @module orchestrator/routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { orchestratorService } from './orchestrator.service.js';
import type { OrchestratedMessageRequest, OrchestratedMessageResponse } from './orchestrator.service.js';
import { voiceOrchestratorRoutes } from './voice-orchestrator.routes.js';

/**
 * Register orchestrator routes
 */
export async function orchestratorRoutes(fastify: FastifyInstance) {
  // Register voice routes
  await voiceOrchestratorRoutes(fastify);
  /**
   * POST /api/v1/chat/orchestrator/message
   * Send a message through the multi-agent orchestrator
   */
  fastify.post<{
    Body: {
      session_id?: string;
      message: string;
      chat_session_id?: string;
      user_id?: string;
      tenant_id?: string;
    };
    Reply: OrchestratedMessageResponse | { error: string };
  }>('/orchestrator/message', async (request, reply) => {
    try {
      const { session_id, message, chat_session_id, user_id, tenant_id } = request.body;

      if (!message) {
        return reply.code(400).send({ error: 'message is required' });
      }

      // Extract auth token from headers
      const authToken = request.headers.authorization?.replace('Bearer ', '');

      // Process message through orchestrator
      const result = await orchestratorService.processMessage({
        sessionId: session_id,
        message,
        authToken,
        chatSessionId: chat_session_id,
        userId: user_id,
        tenantId: tenant_id
      });

      reply.code(200).send(result);

      console.log(`✅ Orchestrator message processed: ${result.sessionId} (intent: ${result.intent}, node: ${result.currentNode})`);
    } catch (error) {
      console.error('Error processing orchestrated message:', error);
      reply.code(500).send({
        error: 'Failed to process message',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/v1/chat/orchestrator/session/:sessionId/status
   * Get detailed session status including state and logs
   */
  fastify.get<{
    Params: { sessionId: string };
  }>('/orchestrator/session/:sessionId/status', async (request, reply) => {
    try {
      const { sessionId } = request.params;

      const status = await orchestratorService.getSessionStatus(sessionId);

      reply.code(200).send({
        session: status.session,
        state: status.state,
        logs: status.logs,
        total_logs: status.logs.length
      });
    } catch (error) {
      console.error('Error getting session status:', error);
      reply.code(500).send({
        error: 'Failed to get session status',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/v1/chat/orchestrator/intents
   * Get list of available intents
   */
  fastify.get('/orchestrator/intents', async (request, reply) => {
    const { getAvailableIntents, getIntentGraph } = await import('./intent-graphs/index.js');

    const intents = getAvailableIntents();
    const intentDetails = intents.map(name => {
      const graph = getIntentGraph(name);
      return {
        name,
        description: graph?.description,
        version: graph?.version,
        requiredPermissions: graph?.requiredPermissions
      };
    });

    reply.code(200).send({
      count: intents.length,
      intents: intentDetails
    });
  });

  /**
   * GET /api/v1/chat/orchestrator/intent/:intentName/graph
   * Get intent graph definition (for debugging/visualization)
   */
  fastify.get<{
    Params: { intentName: string };
  }>('/orchestrator/intent/:intentName/graph', async (request, reply) => {
    try {
      const { intentName } = request.params;
      const { getIntentGraph } = await import('./intent-graphs/index.js');

      const graph = getIntentGraph(intentName);
      if (!graph) {
        return reply.code(404).send({ error: 'Intent not found' });
      }

      reply.code(200).send({
        graph: {
          name: graph.name,
          description: graph.description,
          version: graph.version,
          startNode: graph.startNode,
          nodes: Object.keys(graph.nodes).map(key => ({
            id: key,
            name: graph.nodes[key].name,
            description: graph.nodes[key].description,
            agentRoles: graph.nodes[key].agentRoles,
            requiredState: graph.nodes[key].requiredState,
            producesState: graph.nodes[key].producesState,
            transitionsTo: graph.nodes[key].transitions.map(t => t.toNode)
          })),
          boundaries: graph.boundaries
        }
      });
    } catch (error) {
      console.error('Error getting intent graph:', error);
      reply.code(500).send({
        error: 'Failed to get intent graph',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  console.log('✅ Orchestrator routes registered');
}

export default orchestratorRoutes;
