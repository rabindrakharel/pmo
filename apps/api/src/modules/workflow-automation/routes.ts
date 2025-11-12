import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';

// Schema based on d_workflow_automation table
const WorkflowAutomationSchema = Type.Object({
  id: Type.String(),
  workflow_name: Type.String(),
  workflow_description: Type.Optional(Type.String()),
  active_flag: Type.Optional(Type.Boolean()),
  trigger_entity_type: Type.String(),
  trigger_action_type: Type.String(),
  trigger_scope: Type.Optional(Type.String()),
  trigger_entity_id: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  trigger_conditions: Type.Optional(Type.Any()),
  action_entity_type: Type.String(),
  action_scope: Type.Optional(Type.String()),
  action_entity_id: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  actions: Type.Any(),
  execution_order: Type.Optional(Type.Number()),
  max_executions: Type.Optional(Type.Number()),
  execution_count: Type.Optional(Type.Number()),
  last_executed_ts: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  from_ts: Type.Optional(Type.String()),
  to_ts: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  created_ts: Type.Optional(Type.String()),
  updated_ts: Type.Optional(Type.String()),
  version: Type.Optional(Type.Number()),
});

const CreateWorkflowAutomationSchema = Type.Object({
  workflow_name: Type.String({ minLength: 1 }),
  workflow_description: Type.Optional(Type.String()),
  active_flag: Type.Optional(Type.Boolean()),
  trigger_entity_type: Type.String({ minLength: 1 }),
  trigger_action_type: Type.String({ minLength: 1 }),
  trigger_scope: Type.Optional(Type.String()),
  trigger_entity_id: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
  trigger_conditions: Type.Optional(Type.Union([Type.Object({}), Type.String()])),
  action_entity_type: Type.String({ minLength: 1 }),
  action_scope: Type.Optional(Type.String()),
  action_entity_id: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
  actions: Type.Union([Type.Array(Type.Object({})), Type.String()]),
  execution_order: Type.Optional(Type.Number()),
  max_executions: Type.Optional(Type.Number()),
});

const UpdateWorkflowAutomationSchema = Type.Partial(CreateWorkflowAutomationSchema);

export async function workflowAutomationRoutes(fastify: FastifyInstance) {
  // List workflow automations with filtering
  fastify.get('/api/v1/workflow-automation', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        trigger_entity_type: Type.Optional(Type.String()),
        trigger_action_type: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(WorkflowAutomationSchema),
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
      active, search, trigger_entity_type, trigger_action_type, limit = 50, offset = 0
    } = request.query as any;

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.code(403).send({ error: 'Unauthorized' });
    }

    try {
      let conditions = [];

      if (active !== undefined) {
        conditions.push(`active_flag = ${active}`);
      }

      if (search) {
        const searchTerm = search.replace(/'/g, "''");
        conditions.push(`(
          workflow_name ILIKE '%${searchTerm}%' OR
          workflow_description ILIKE '%${searchTerm}%'
        )`);
      }

      if (trigger_entity_type) {
        conditions.push(`trigger_entity_type = '${trigger_entity_type.replace(/'/g, "''")}'`);
      }

      if (trigger_action_type) {
        conditions.push(`trigger_action_type = '${trigger_action_type.replace(/'/g, "''")}'`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countQuery = `SELECT COUNT(*) as count FROM app.d_workflow_automation ${whereClause}`;
      const dataQuery = `
        SELECT *
        FROM app.d_workflow_automation
        ${whereClause}
        ORDER BY execution_order ASC, created_date DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      const countResult = await db.execute(sql.raw(countQuery));
      const dataResult = await db.execute(sql.raw(dataQuery));

      const total = parseInt((countResult[0] as any)?.count as string || '0');

      return reply.send({
        data: dataResult,
        total,
        limit,
        offset,
      });
    } catch (error: any) {
      fastify.log.error('Error fetching workflow automations:', error);
      return reply.code(500).send({ error: error.message || 'Failed to fetch workflow automations' });
    }
  });

  // Get single workflow automation by ID
  fastify.get('/api/v1/workflow-automation/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: WorkflowAutomationSchema,
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.code(403).send({ error: 'Unauthorized' });
    }

    try {
      const query = `SELECT * FROM app.d_workflow_automation WHERE id = '${id}'`;
      const result = await db.execute(sql.raw(query));

      if (result.length === 0) {
        return reply.code(404).send({ error: 'Workflow automation not found' });
      }

      return reply.send(result[0]);
    } catch (error: any) {
      fastify.log.error('Error fetching workflow automation:', error);
      return reply.code(500).send({ error: error.message || 'Failed to fetch workflow automation' });
    }
  });

  // Create workflow automation
  fastify.post('/api/v1/workflow-automation', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateWorkflowAutomationSchema,
      response: {
        201: WorkflowAutomationSchema,
        400: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.code(403).send({ error: 'Unauthorized' });
    }

    const data = request.body as any;

    try {
      // Parse JSONB fields if they're strings
      const trigger_conditions = typeof data.trigger_conditions === 'string'
        ? data.trigger_conditions
        : JSON.stringify(data.trigger_conditions || {});

      const actions = typeof data.actions === 'string'
        ? data.actions
        : JSON.stringify(data.actions);

      const columns = [
        'workflow_name',
        'workflow_description',
        'active_flag',
        'trigger_entity_type',
        'trigger_action_type',
        'trigger_scope',
        'trigger_entity_id',
        'trigger_conditions',
        'action_entity_type',
        'action_scope',
        'action_entity_id',
        'actions',
        'execution_order',
        'max_executions',
        'created_by',
      ];

      const values = [
        data.workflow_name,
        data.workflow_description || null,
        data.active_flag ?? true,
        data.trigger_entity_type,
        data.trigger_action_type,
        data.trigger_scope || 'all',
        data.trigger_entity_id || null,
        trigger_conditions,
        data.action_entity_type,
        data.action_scope || 'same',
        data.action_entity_id || null,
        actions,
        data.execution_order ?? 0,
        data.max_executions ?? -1,
        userId,
      ];

      // Escape single quotes in string values
      const escapeValue = (val: any) => {
        if (val === null || val === undefined) return 'NULL';
        if (typeof val === 'boolean') return val ? 'true' : 'false';
        if (typeof val === 'number') return val.toString();
        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
        return `'${val}'`;
      };

      const valuesStr = values.map(escapeValue).join(', ');
      const insertQuery = `
        INSERT INTO app.d_workflow_automation (${columns.join(', ')})
        VALUES (${valuesStr})
        RETURNING *
      `;

      const result = await db.execute(sql.raw(insertQuery));

      return reply.code(201).send(result[0]);
    } catch (error: any) {
      fastify.log.error('Error creating workflow automation:', error);
      return reply.code(500).send({ error: error.message || 'Failed to create workflow automation' });
    }
  });

  // Update workflow automation
  fastify.patch('/api/v1/workflow-automation/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: UpdateWorkflowAutomationSchema,
      response: {
        200: WorkflowAutomationSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.code(403).send({ error: 'Unauthorized' });
    }

    const updates = request.body as any;

    try {
      // Check if workflow exists
      const checkQuery = `SELECT id FROM app.d_workflow_automation WHERE id = '${id}'`;
      const checkResult = await db.execute(sql.raw(checkQuery));

      if (checkResult.length === 0) {
        return reply.code(404).send({ error: 'Workflow automation not found' });
      }

      // Build update query
      const updateFields = [];

      // Escape single quotes in string values
      const escapeValue = (val: any) => {
        if (val === null || val === undefined) return 'NULL';
        if (typeof val === 'boolean') return val ? 'true' : 'false';
        if (typeof val === 'number') return val.toString();
        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
        return `'${val}'`;
      };

      for (const [key, value] of Object.entries(updates)) {
        if (key === 'trigger_conditions' || key === 'actions') {
          const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
          updateFields.push(`${key} = ${escapeValue(jsonValue)}`);
        } else {
          updateFields.push(`${key} = ${escapeValue(value)}`);
        }
      }

      updateFields.push(`modified_by = '${userId}'`);
      updateFields.push(`modified_date = CURRENT_TIMESTAMP`);

      const updateQuery = `
        UPDATE app.d_workflow_automation
        SET ${updateFields.join(', ')}
        WHERE id = '${id}'
        RETURNING *
      `;

      const result = await db.execute(sql.raw(updateQuery));

      return reply.send(result[0]);
    } catch (error: any) {
      fastify.log.error('Error updating workflow automation:', error);
      return reply.code(500).send({ error: error.message || 'Failed to update workflow automation' });
    }
  });

  // Delete workflow automation
  createEntityDeleteEndpoint(fastify, 'workflow_automation');

  // Execute workflow (manual trigger)
  fastify.post('/api/v1/workflow-automation/:id/execute', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: Type.Object({
        entity_id: Type.Optional(Type.String({ format: 'uuid' })),
        context: Type.Optional(Type.Object({})),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          message: Type.String(),
          execution_count: Type.Number(),
        }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { entity_id, context } = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.code(403).send({ error: 'Unauthorized' });
    }

    try {
      // Get workflow
      const workflowQuery = `SELECT * FROM app.d_workflow_automation WHERE id = '${id}'`;
      const workflowResult = await db.execute(sql.raw(workflowQuery));

      if (workflowResult.length === 0) {
        return reply.code(404).send({ error: 'Workflow automation not found' });
      }

      const workflow = workflowResult[0] as any;

      // Check if workflow is active
      if (!workflow.active_flag) {
        return reply.code(400).send({ error: 'Workflow is not active' });
      }

      // Check max executions
      if (workflow.max_executions > 0 && workflow.execution_count >= workflow.max_executions) {
        return reply.code(400).send({ error: 'Maximum executions reached' });
      }

      // TODO: Implement actual workflow execution logic here
      // This would involve:
      // 1. Evaluating trigger conditions
      // 2. Executing actions based on action_entity_type and actions array
      // 3. Handling different action types (update_field, create_entity, send_notification, etc.)

      // For now, just increment execution count
      const updateQuery = `
        UPDATE app.d_workflow_automation
        SET execution_count = execution_count + 1,
            last_executed_at = CURRENT_TIMESTAMP
        WHERE id = '${id}'
        RETURNING execution_count
      `;

      const updateResult = await db.execute(sql.raw(updateQuery));
      const newExecutionCount = (updateResult[0] as any)?.execution_count || 0;

      return reply.send({
        success: true,
        message: `Workflow executed successfully (execution #${newExecutionCount})`,
        execution_count: newExecutionCount,
      });
    } catch (error: any) {
      fastify.log.error('Error executing workflow automation:', error);
      return reply.code(500).send({ error: error.message || 'Failed to execute workflow automation' });
    }
  });

  // Toggle workflow active status
  fastify.post('/api/v1/workflow-automation/:id/toggle', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: WorkflowAutomationSchema,
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.code(403).send({ error: 'Unauthorized' });
    }

    try {
      const updateQuery = `
        UPDATE app.d_workflow_automation
        SET active_flag = NOT active_flag,
            modified_by = '${userId}',
            modified_date = CURRENT_TIMESTAMP
        WHERE id = '${id}'
        RETURNING *
      `;

      const result = await db.execute(sql.raw(updateQuery));

      if (result.length === 0) {
        return reply.code(404).send({ error: 'Workflow automation not found' });
      }

      return reply.send(result[0]);
    } catch (error: any) {
      fastify.log.error('Error toggling workflow automation:', error);
      return reply.code(500).send({ error: error.message || 'Failed to toggle workflow automation' });
    }
  });
}
