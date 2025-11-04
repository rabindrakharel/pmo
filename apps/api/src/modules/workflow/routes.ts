import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

// Schema for workflow instance (JSONB structure)
const WorkflowInstanceSchema = Type.Object({
  id: Type.String(),
  workflow_instance_id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  workflow_head_id: Type.String(),
  workflow_template_code: Type.Optional(Type.String()),
  workflow_template_name: Type.Optional(Type.String()),
  industry_sector: Type.Optional(Type.String()),
  workflow_graph_data: Type.Any(), // JSONB array of entities
  current_state_id: Type.Optional(Type.Number()),
  terminal_state_flag: Type.Optional(Type.Boolean()),
  created_ts: Type.Optional(Type.String()),
  updated_ts: Type.Optional(Type.String()),
});

// Schema for workflow graph node (template structure)
const WorkflowGraphNodeSchema = Type.Object({
  id: Type.Number(),
  entity_name: Type.String(), // Entity type only (cust, quote, work_order, task, invoice)
  parent_ids: Type.Any(), // Array of parent node IDs
});

export async function workflowRoutes(fastify: FastifyInstance) {
  // List workflow instances (JSONB structure)
  fastify.get('/api/v1/workflow', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        workflow_head_id: Type.Optional(Type.String()),
        terminal_only: Type.Optional(Type.Boolean()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(WorkflowInstanceSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
        }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const {
      active, search, workflow_head_id, terminal_only, limit = 50, offset = 0
    } = request.query as any;

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Build base query - get workflow instances
      const conditions = [];

      if (active !== undefined) {
        conditions.push(sql`w.active_flag = ${active}`);
      }

      if (workflow_head_id) {
        conditions.push(sql`w.workflow_head_id = ${workflow_head_id}::uuid`);
      }

      if (terminal_only) {
        conditions.push(sql`w.terminal_state_flag = true`);
      }

      if (search) {
        conditions.push(sql`(
          w.workflow_instance_id ILIKE ${`%${search}%`} OR
          w.name ILIKE ${`%${search}%`} OR
          w.code ILIKE ${`%${search}%`} OR
          wh.name ILIKE ${`%${search}%`}
        )`);
      }

      // Get total count
      const countQuery = sql`
        SELECT COUNT(*) as total
        FROM app.d_industry_workflow_graph_data w
        LEFT JOIN app.d_industry_workflow_graph_head wh ON w.workflow_head_id = wh.id
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `;
      const countResult = await db.execute(countQuery);
      const total = Number(countResult[0]?.total || 0);

      // Get workflow instances
      const workflowsQuery = sql`
        SELECT
          w.id::text,
          w.workflow_instance_id,
          w.code,
          w.name,
          w.descr,
          w.workflow_head_id::text,
          wh.code as workflow_template_code,
          wh.name as workflow_template_name,
          wh.industry_sector,
          w.workflow_graph_data,
          w.current_state_id,
          w.terminal_state_flag,
          w.created_ts,
          w.updated_ts
        FROM app.d_industry_workflow_graph_data w
        LEFT JOIN app.d_industry_workflow_graph_head wh ON w.workflow_head_id = wh.id
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY w.created_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      const workflows = await db.execute(workflowsQuery);

      return {
        data: workflows,
        total,
        limit,
        offset,
      };
    } catch (error) {
      fastify.log.error('Error fetching workflow instances:', error as any);
      console.error('Full error details:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single workflow instance by workflow_instance_id
  fastify.get('/api/v1/workflow/:instance_id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        instance_id: Type.String(),
      }),
      response: {
        200: WorkflowInstanceSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { instance_id } = request.params as { instance_id: string };

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Get workflow instance
      const workflowQuery = sql`
        SELECT
          w.id::text,
          w.workflow_instance_id,
          w.code,
          w.name,
          w.descr,
          w.workflow_head_id::text,
          wh.code as workflow_template_code,
          wh.name as workflow_template_name,
          wh.industry_sector,
          w.workflow_graph_data,
          w.current_state_id,
          w.terminal_state_flag,
          w.created_ts,
          w.updated_ts
        FROM app.d_industry_workflow_graph_data w
        LEFT JOIN app.d_industry_workflow_graph_head wh ON w.workflow_head_id = wh.id
        WHERE w.workflow_instance_id = ${instance_id}
          AND w.active_flag = true
        LIMIT 1
      `;
      const result = await db.execute(workflowQuery);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Workflow instance not found' });
      }

      return result[0];
    } catch (error) {
      fastify.log.error('Error fetching workflow instance:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get workflow graph for a workflow instance
  fastify.get('/api/v1/workflow/:instance_id/graph', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        instance_id: Type.String(),
      }),
      response: {
        200: Type.Object({
          workflow_head_id: Type.String(),
          workflow_template_code: Type.String(),
          workflow_template_name: Type.String(),
          workflow_graph: Type.Array(WorkflowGraphNodeSchema),
          industry_sector: Type.String(),
        }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { instance_id } = request.params as { instance_id: string };

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Get workflow template from instance
      const templateQuery = sql`
        SELECT
          wh.id::text as workflow_head_id,
          wh.code as workflow_template_code,
          wh.name as workflow_template_name,
          wh.workflow_graph,
          wh.industry_sector
        FROM app.d_industry_workflow_graph_data w
        INNER JOIN app.d_industry_workflow_graph_head wh ON w.workflow_head_id = wh.id
        WHERE w.workflow_instance_id = ${instance_id}
          AND w.active_flag = true
          AND wh.active_flag = true
        LIMIT 1
      `;
      const result = await db.execute(templateQuery);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Workflow template not found for this instance' });
      }

      return result[0];
    } catch (error) {
      fastify.log.error('Error fetching workflow graph:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get workflow graph template for workflow head ID
  fastify.get('/api/v1/workflow/head/:head_id/graph', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        head_id: Type.String(),
      }),
      response: {
        200: Type.Object({
          workflow_head_id: Type.String(),
          workflow_template_code: Type.String(),
          workflow_template_name: Type.String(),
          workflow_graph: Type.Array(WorkflowGraphNodeSchema),
          industry_sector: Type.String(),
        }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { head_id } = request.params as { head_id: string };

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Get workflow template by ID
      const templateQuery = sql`
        SELECT
          wh.id::text as workflow_head_id,
          wh.code as workflow_template_code,
          wh.name as workflow_template_name,
          wh.workflow_graph,
          wh.industry_sector
        FROM app.d_industry_workflow_graph_head wh
        WHERE wh.id = ${head_id}::uuid
          AND wh.active_flag = true
        LIMIT 1
      `;
      const result = await db.execute(templateQuery);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Workflow template not found' });
      }

      return result[0];
    } catch (error) {
      fastify.log.error('Error fetching workflow graph:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

}
