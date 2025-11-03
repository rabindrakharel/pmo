import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

// Schema for workflow instance summary
const WorkflowInstanceSchema = Type.Object({
  id: Type.String(),
  workflow_instance_id: Type.String(),
  workflow_template_id: Type.String(),
  workflow_template_code: Type.Optional(Type.String()),
  workflow_template_name: Type.Optional(Type.String()),
  industry_sector: Type.Optional(Type.String()),
  customer_entity_id: Type.Optional(Type.String()),
  current_state_name: Type.Optional(Type.String()),
  current_state_id: Type.Optional(Type.Number()),
  created_ts: Type.Optional(Type.String()),
  updated_ts: Type.Optional(Type.String()),
});

// Schema for workflow graph node
const WorkflowGraphNodeSchema = Type.Object({
  id: Type.Number(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  parent_ids: Type.Any(), // Can be null, number, or array of numbers
  child_ids: Type.Any(), // Can be null, number, or array of numbers
  entity_name: Type.String(),
  terminal_flag: Type.Boolean(),
});

// Schema for workflow state entity data
const WorkflowStateEntitySchema = Type.Object({
  id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  entity_name: Type.String(),
  entity_id: Type.String(),
  state_id: Type.Number(),
  state_name: Type.String(),
  entity_created_ts: Type.Optional(Type.String()),
  entity_updated_ts: Type.Optional(Type.String()),
  current_state_flag: Type.Optional(Type.Boolean()),
  terminal_state_flag: Type.Optional(Type.Boolean()),
});

export async function workflowRoutes(fastify: FastifyInstance) {
  // List workflow instances
  fastify.get('/api/v1/workflow', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        customer_entity_id: Type.Optional(Type.String()),
        workflow_template_id: Type.Optional(Type.String()),
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
      active, search, customer_entity_id, workflow_template_id, limit = 50, offset = 0
    } = request.query as any;

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Build base query - get distinct workflow instances
      const conditions = [];

      if (active !== undefined) {
        conditions.push(sql`w.active_flag = ${active}`);
      }

      if (customer_entity_id) {
        conditions.push(sql`w.customer_entity_id = ${customer_entity_id}`);
      }

      if (workflow_template_id) {
        conditions.push(sql`w.workflow_template_id = ${workflow_template_id}::uuid`);
      }

      if (search) {
        conditions.push(sql`(
          w.workflow_instance_id ILIKE ${`%${search}%`} OR
          wh.name ILIKE ${`%${search}%`} OR
          wh.code ILIKE ${`%${search}%`}
        )`);
      }

      // Get total count
      const countQuery = sql`
        SELECT COUNT(DISTINCT w.workflow_instance_id) as total
        FROM app.d_industry_workflow_graph_data w
        LEFT JOIN app.d_industry_workflow_graph_head wh ON w.workflow_template_id = wh.id
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `;
      const countResult = await db.execute(countQuery);
      const total = Number(countResult[0]?.total || 0);

      // Get workflow instances with current state
      const workflowsQuery = sql`
        SELECT DISTINCT ON (w.workflow_instance_id)
          w.workflow_instance_id,
          w.workflow_template_id::text,
          wh.code as workflow_template_code,
          wh.name as workflow_template_name,
          wh.industry_sector,
          w.customer_entity_id,
          w.state_name as current_state_name,
          w.state_id as current_state_id,
          w.created_ts,
          w.updated_ts
        FROM app.d_industry_workflow_graph_data w
        LEFT JOIN app.d_industry_workflow_graph_head wh ON w.workflow_template_id = wh.id
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY w.workflow_instance_id, w.updated_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      const workflows = await db.execute(workflowsQuery);

      // Map workflow_instance_id to id for EntityMainPage compatibility
      const workflowsWithId = workflows.map((w: any) => {
        return {
          id: w.workflow_instance_id,
          workflow_instance_id: w.workflow_instance_id,
          workflow_template_id: w.workflow_template_id,
          workflow_template_code: w.workflow_template_code,
          workflow_template_name: w.workflow_template_name,
          industry_sector: w.industry_sector,
          customer_entity_id: w.customer_entity_id,
          current_state_name: w.current_state_name,
          current_state_id: w.current_state_id,
          created_ts: w.created_ts,
          updated_ts: w.updated_ts
        };
      });

      return {
        data: workflowsWithId,
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

  // Get single workflow instance details
  fastify.get('/api/v1/workflow/:instance_id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        instance_id: Type.String(),
      }),
      response: {
        200: Type.Object({
          workflow_instance_id: Type.String(),
          workflow_template_id: Type.String(),
          workflow_template_code: Type.Optional(Type.String()),
          workflow_template_name: Type.Optional(Type.String()),
          industry_sector: Type.Optional(Type.String()),
          customer_entity_id: Type.Optional(Type.String()),
          states: Type.Array(WorkflowStateEntitySchema),
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
      // Get workflow instance details
      const workflowQuery = sql`
        SELECT DISTINCT
          w.workflow_instance_id,
          w.workflow_template_id::text,
          wh.code as workflow_template_code,
          wh.name as workflow_template_name,
          wh.industry_sector,
          w.customer_entity_id
        FROM app.d_industry_workflow_graph_data w
        LEFT JOIN app.d_industry_workflow_graph_head wh ON w.workflow_template_id = wh.id
        WHERE w.workflow_instance_id = ${instance_id}
          AND w.active_flag = true
        LIMIT 1
      `;
      const workflowResult = await db.execute(workflowQuery);

      if (workflowResult.length === 0) {
        return reply.status(404).send({ error: 'Workflow instance not found' });
      }

      const workflow = workflowResult[0];

      // Get all states for this workflow instance
      const statesQuery = sql`
        SELECT
          id::text,
          code,
          name,
          descr,
          metadata,
          entity_name,
          entity_id,
          state_id,
          state_name,
          entity_created_ts,
          entity_updated_ts,
          current_state_flag,
          terminal_state_flag
        FROM app.d_industry_workflow_graph_data
        WHERE workflow_instance_id = ${instance_id}
          AND active_flag = true
        ORDER BY updated_ts ASC
      `;
      const states = await db.execute(statesQuery);

      return {
        ...workflow,
        states,
      };
    } catch (error) {
      fastify.log.error('Error fetching workflow instance:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get workflow graph template for instance
  fastify.get('/api/v1/workflow/:instance_id/graph', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        instance_id: Type.String(),
      }),
      response: {
        200: Type.Object({
          workflow_template_id: Type.String(),
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
          wh.id::text as workflow_template_id,
          wh.code as workflow_template_code,
          wh.name as workflow_template_name,
          wh.workflow_graph,
          wh.industry_sector
        FROM app.d_industry_workflow_graph_data w
        INNER JOIN app.d_industry_workflow_graph_head wh ON w.workflow_template_id = wh.id
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

  // Get entity data for specific state in workflow instance
  fastify.get('/api/v1/workflow/:instance_id/state/:state_id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        instance_id: Type.String(),
        state_id: Type.Number(),
      }),
      response: {
        200: WorkflowStateEntitySchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { instance_id, state_id } = request.params as { instance_id: string; state_id: number };

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Get entity data for this state
      const stateQuery = sql`
        SELECT
          id::text,
          code,
          name,
          descr,
          metadata,
          entity_name,
          entity_id,
          state_id,
          state_name,
          entity_created_ts,
          entity_updated_ts,
          current_state_flag,
          terminal_state_flag
        FROM app.d_industry_workflow_graph_data
        WHERE workflow_instance_id = ${instance_id}
          AND state_id = ${state_id}
          AND active_flag = true
        LIMIT 1
      `;
      const result = await db.execute(stateQuery);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'State not found in workflow instance' });
      }

      return result[0];
    } catch (error) {
      fastify.log.error('Error fetching workflow state entity:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
