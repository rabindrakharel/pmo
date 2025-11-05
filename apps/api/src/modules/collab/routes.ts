import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { setupCollabConnection, startHeartbeat, getActiveUsers } from './wiki-collab-handler.js';
import { logger } from '@/lib/logger.js';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

/**
 * Collaborative Editing Routes
 *
 * Provides WebSocket endpoints for real-time collaborative editing
 * and REST endpoints for presence information.
 */

export async function collabRoutes(fastify: FastifyInstance) {
  // Start heartbeat for detecting dead connections
  startHeartbeat();

  /**
   * WebSocket endpoint for collaborative wiki editing
   * URL: ws://localhost:4000/api/v1/collab/wiki/:wikiId
   *
   * Authentication: JWT token in query parameter
   * Example: ws://localhost:4000/api/v1/collab/wiki/123?token=jwt_token_here
   */
  fastify.get('/api/v1/collab/wiki/:wikiId', {
    websocket: true,
  }, async (connection, request) => {
    try {
      const { wikiId } = request.params as any;
      const token = (request.query as any).token;

      // Verify JWT token
      if (!token) {
        logger.warn('WebSocket connection rejected: No token provided');
        connection.socket.close(1008, 'Authentication required');
        return;
      }

      let decoded: any;
      try {
        decoded = fastify.jwt.verify(token);
      } catch (error) {
        logger.warn('WebSocket connection rejected: Invalid token');
        connection.socket.close(1008, 'Invalid authentication token');
        return;
      }

      const userId = decoded.sub;
      const userName = decoded.name || decoded.email || 'Unknown User';

      // Verify user has access to this wiki
      const accessCheck = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.empid = ${userId}
          AND rbac.entity = 'wiki'
          AND (rbac.entity_id = ${wikiId} OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 1 = ANY(rbac.permission)
      `);

      if (accessCheck.length === 0) {
        logger.warn(`User ${userId} denied access to wiki ${wikiId}`);
        connection.socket.close(1008, 'Insufficient permissions');
        return;
      }

      // Setup collaborative editing connection
      setupCollabConnection(
        connection.socket as any,
        wikiId,
        userId,
        userName
      );

      logger.info(`Collaborative editing session started for wiki ${wikiId} by user ${userName}`);
    } catch (error) {
      logger.error('Error setting up collaborative connection:', error);
      connection.socket.close(1011, 'Internal server error');
    }
  });

  /**
   * Get list of active users currently editing a wiki page
   * GET /api/v1/collab/wiki/:wikiId/users
   */
  fastify.get('/api/v1/collab/wiki/:wikiId/users', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        wikiId: Type.String({ format: 'uuid' })
      }),
      response: {
        200: Type.Object({
          users: Type.Array(Type.Object({
            clientId: Type.Number(),
            id: Type.String(),
            name: Type.String(),
            color: Type.String(),
            cursor: Type.Optional(Type.Any()),
            selection: Type.Optional(Type.Any()),
          }))
        })
      }
    }
  }, async (request, reply) => {
    const { wikiId } = request.params as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // Verify user has access to this wiki
    const accessCheck = await db.execute(sql`
      SELECT 1 FROM app.entity_id_rbac_map rbac
      WHERE rbac.empid = ${userId}
        AND rbac.entity = 'wiki'
        AND (rbac.entity_id = ${wikiId} OR rbac.entity_id = 'all')
        AND rbac.active_flag = true
        AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
        AND 0 = ANY(rbac.permission)
    `);

    if (accessCheck.length === 0) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    const users = getActiveUsers(wikiId);

    return { users };
  });
}
