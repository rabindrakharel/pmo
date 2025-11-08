import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { getContextDbService } from './orchestrator/services/context-db.service.js';

/**
 * Context Database API Routes
 *
 * RESTful API for managing session context data stored in LowDB
 */
export async function contextDbRoutes(fastify: FastifyInstance) {
  const contextDb = getContextDbService();

  // Ensure DB is initialized
  await contextDb.initialize();

  /**
   * GET /api/v1/context-db/stats
   * Get database statistics
   */
  fastify.get(
    '/stats',
    {
      schema: {
        description: 'Get context database statistics',
        tags: ['Context DB'],
        response: {
          200: Type.Object({
            totalSessions: Type.Number(),
            activeSessions: Type.Number(),
            completedSessions: Type.Number(),
            totalMessages: Type.Number(),
            dbSizeBytes: Type.Number(),
            dbPath: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      const stats = await contextDb.getStats();
      return {
        ...stats,
        dbPath: contextDb.getDbPath(),
      };
    }
  );

  /**
   * GET /api/v1/context-db/sessions
   * Get all sessions or filter by userId
   */
  fastify.get(
    '/sessions',
    {
      schema: {
        description: 'Get all sessions or filter by userId',
        tags: ['Context DB'],
        querystring: Type.Object({
          userId: Type.Optional(Type.String()),
          active: Type.Optional(Type.Boolean()),
        }),
      },
    },
    async (request, reply) => {
      const { userId, active } = request.query as any;

      let sessions;
      if (userId) {
        sessions = await contextDb.getSessionsByUser(userId);
      } else if (active) {
        sessions = await contextDb.getActiveSessions();
      } else {
        sessions = await contextDb.getAllSessions();
      }

      return {
        count: sessions.length,
        sessions,
      };
    }
  );

  /**
   * GET /api/v1/context-db/sessions/:sessionId
   * Get specific session by ID
   */
  fastify.get(
    '/sessions/:sessionId',
    {
      schema: {
        description: 'Get session context data by session ID',
        tags: ['Context DB'],
        params: Type.Object({
          sessionId: Type.String(),
        }),
        response: {
          404: Type.Object({
            error: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params as any;

      const session = await contextDb.getSession(sessionId);
      if (!session) {
        reply.code(404);
        return { error: `Session ${sessionId} not found` };
      }

      return session;
    }
  );

  /**
   * PUT /api/v1/context-db/sessions/:sessionId
   * Update specific session context fields
   */
  fastify.put(
    '/sessions/:sessionId',
    {
      schema: {
        description: 'Update session context fields (partial update)',
        tags: ['Context DB'],
        params: Type.Object({
          sessionId: Type.String(),
        }),
        body: Type.Object({
          action: Type.Optional(Type.String()),
          context: Type.Optional(
            Type.Object({
              data_extraction_fields: Type.Optional(Type.Any()),
              next_course_of_action: Type.Optional(Type.String()),
              next_node_to_go_to: Type.Optional(Type.String()),
              node_traversed: Type.Optional(Type.Array(Type.String())),
              summary_of_conversation_on_each_step_until_now: Type.Optional(Type.Any()),
              flags: Type.Optional(Type.Any()),
            })
          ),
          currentNode: Type.Optional(Type.String()),
          completed: Type.Optional(Type.Boolean()),
          conversationEnded: Type.Optional(Type.Boolean()),
          endReason: Type.Optional(Type.String()),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            sessionId: Type.String(),
          }),
          404: Type.Object({
            error: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params as any;
      const updates = request.body as any;

      try {
        await contextDb.updateSession(sessionId, updates, updates.action || 'api_update');

        return {
          success: true,
          sessionId,
        };
      } catch (error: any) {
        reply.code(404);
        return { error: error.message };
      }
    }
  );

  /**
   * DELETE /api/v1/context-db/sessions/:sessionId
   * Delete session
   */
  fastify.delete(
    '/sessions/:sessionId',
    {
      schema: {
        description: 'Delete session from context database',
        tags: ['Context DB'],
        params: Type.Object({
          sessionId: Type.String(),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            sessionId: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params as any;

      await contextDb.deleteSession(sessionId);

      return {
        success: true,
        sessionId,
      };
    }
  );

  /**
   * GET /api/v1/context-db/sessions/:sessionId/export
   * Export session as JSON
   */
  fastify.get(
    '/sessions/:sessionId/export',
    {
      schema: {
        description: 'Export session as JSON string',
        tags: ['Context DB'],
        params: Type.Object({
          sessionId: Type.String(),
        }),
        response: {
          404: Type.Object({
            error: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params as any;

      try {
        const jsonString = await contextDb.exportSession(sessionId);

        reply.type('application/json');
        return jsonString;
      } catch (error: any) {
        reply.code(404);
        return { error: error.message };
      }
    }
  );

  /**
   * POST /api/v1/context-db/compact
   * Compact database (remove old sessions)
   */
  fastify.post(
    '/compact',
    {
      schema: {
        description: 'Remove old completed sessions from database',
        tags: ['Context DB'],
        body: Type.Object({
          olderThanDays: Type.Optional(Type.Number({ default: 7 })),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            removedCount: Type.Number(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { olderThanDays = 7 } = request.body as any;

      const removedCount = await contextDb.compact(olderThanDays);

      return {
        success: true,
        removedCount,
      };
    }
  );

  /**
   * DELETE /api/v1/context-db/clear
   * Clear all sessions (admin only, dangerous)
   */
  fastify.delete(
    '/clear',
    {
      schema: {
        description: 'Clear all sessions from database (use with caution)',
        tags: ['Context DB'],
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            message: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      await contextDb.clearAll();

      return {
        success: true,
        message: 'All sessions cleared',
      };
    }
  );

  /**
   * GET /api/v1/context-db/sessions/:sessionId/context
   * Get only context object (lightweight)
   */
  fastify.get(
    '/sessions/:sessionId/context',
    {
      schema: {
        description: 'Get only context object for session',
        tags: ['Context DB'],
        params: Type.Object({
          sessionId: Type.String(),
        }),
        response: {
          404: Type.Object({
            error: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params as any;

      const session = await contextDb.getSession(sessionId);
      if (!session) {
        reply.code(404);
        return { error: `Session ${sessionId} not found` };
      }

      return session.context;
    }
  );

  /**
   * GET /api/v1/context-db/sessions/:sessionId/messages
   * Get only messages array (lightweight)
   */
  fastify.get(
    '/sessions/:sessionId/messages',
    {
      schema: {
        description: 'Get only messages array for session',
        tags: ['Context DB'],
        params: Type.Object({
          sessionId: Type.String(),
        }),
        response: {
          404: Type.Object({
            error: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params as any;

      const session = await contextDb.getSession(sessionId);
      if (!session) {
        reply.code(404);
        return { error: `Session ${sessionId} not found` };
      }

      return {
        count: session.messages.length,
        messages: session.messages,
      };
    }
  );
}
