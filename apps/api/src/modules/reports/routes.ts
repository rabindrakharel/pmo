import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import {
  getUniversalColumnMetadata,
  filterUniversalColumns,
  getColumnsByMetadata
} from '../../lib/universal-schema-metadata.js';

// Schema based on d_reports table structure
const ReportSchema = Type.Object({
  id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Object({})),

  // Report definition
  report_type: Type.String(),
  report_category: Type.Optional(Type.String()),

  // Data source configuration
  data_source_config: Type.Optional(Type.Object({})),
  query_definition: Type.Optional(Type.Object({})),
  refresh_frequency: Type.String(),

  // Visualization settings
  chart_type: Type.Optional(Type.String()),
  visualization_config: Type.Optional(Type.Object({})),

  // Access and scheduling
  is_public: Type.Boolean(),
  auto_refresh_enabled: Type.Boolean(),
  email_subscribers: Type.Optional(Type.Array(Type.String())),

  // Performance tracking
  last_execution_time: Type.Optional(Type.String()),
  execution_duration_ms: Type.Optional(Type.Number()),
  last_error_message: Type.Optional(Type.String()),

  // Relationships
  primary_entity_type: Type.Optional(Type.String()),
  primary_entity_id: Type.Optional(Type.String()),

  // Temporal fields
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  active_flag: Type.Boolean(),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  version: Type.Number(),
});

const CreateReportSchema = Type.Object({
  code: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Object({})),
  report_type: Type.String(),
  report_category: Type.Optional(Type.String()),
  data_source_config: Type.Optional(Type.Object({})),
  query_definition: Type.Optional(Type.Object({})),
  refresh_frequency: Type.Optional(Type.String()),
  chart_type: Type.Optional(Type.String()),
  visualization_config: Type.Optional(Type.Object({})),
  is_public: Type.Optional(Type.Boolean()),
  auto_refresh_enabled: Type.Optional(Type.Boolean()),
  email_subscribers: Type.Optional(Type.Array(Type.String())),
  primary_entity_type: Type.Optional(Type.String()),
  primary_entity_id: Type.Optional(Type.String()),
});

const UpdateReportSchema = Type.Partial(CreateReportSchema);

// Report data schema
const ReportDataSchema = Type.Object({
  id: Type.String(),
  report_id: Type.String(),
  execution_timestamp: Type.String(),
  report_data: Type.Object({}),
  data_snapshot_size: Type.Optional(Type.Number()),
  stage: Type.String(),
  executed_by_empid: Type.Optional(Type.String()),
  execution_trigger: Type.String(),
  data_freshness_hours: Type.Optional(Type.Number()),
  data_completeness_percent: Type.Optional(Type.Number()),
  data_accuracy_score: Type.Optional(Type.Number()),
  query_execution_time_ms: Type.Optional(Type.Number()),
  data_processing_time_ms: Type.Optional(Type.Number()),
  created_ts: Type.String(),
  updated_ts: Type.String(),
});

const CreateReportDataSchema = Type.Object({
  report_data: Type.Object({}),
  stage: Type.Optional(Type.String()),
  execution_trigger: Type.Optional(Type.String()),
  data_freshness_hours: Type.Optional(Type.Number()),
  data_completeness_percent: Type.Optional(Type.Number()),
  data_accuracy_score: Type.Optional(Type.Number()),
  query_execution_time_ms: Type.Optional(Type.Number()),
  data_processing_time_ms: Type.Optional(Type.Number()),
});

export async function reportsRoutes(fastify: FastifyInstance) {
  // List reports
  fastify.get('/api/v1/reports', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        report_type: Type.Optional(Type.String()),
        report_category: Type.Optional(Type.String()),
        is_public: Type.Optional(Type.Boolean()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        page: Type.Optional(Type.Number({ minimum: 1 })),
        search: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(ReportSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
        }),
        401: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const {
        active = true,
        report_type,
        report_category,
        is_public,
        limit = 20,
        offset: queryOffset,
        page,
        search
      } = request.query as any;
      const offset = page ? (page - 1) * limit : (queryOffset !== undefined ? queryOffset : 0);

      // Build where conditions
      const conditions = [];
      if (active !== undefined) {
        conditions.push(sql`active_flag = ${active}`);
      }
      if (report_type) {
        conditions.push(sql`report_type = ${report_type}`);
      }
      if (report_category) {
        conditions.push(sql`report_category = ${report_category}`);
      }
      if (is_public !== undefined) {
        conditions.push(sql`public_flag = ${is_public}`);
      }
      if (search) {
        conditions.push(sql`(name ILIKE ${'%' + search + '%'} OR descr ILIKE ${'%' + search + '%'})`);
      }

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_reports
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      const reports = await db.execute(sql`
        SELECT
          id, code, name, "descr", metadata, report_type,
          report_category, data_source_config, query_definition,
          refresh_frequency, chart_type, visualization_config,
          public_flag as is_public, auto_refresh_enabled_flag as auto_refresh_enabled, email_subscribers,
          last_execution_ts as last_execution_time, execution_duration_ms, last_error_message,
          primary_entity_type, primary_entity_id, from_ts, to_ts,
          active_flag, created_ts, updated_ts, version
        FROM app.d_reports
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY name ASC NULLS LAST, created_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return {
        data: reports,
        total,
        limit,
        offset,
      };
    } catch (error) {
      fastify.log.error('Error fetching reports:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single report
  fastify.get('/api/v1/reports/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      response: {
        200: ReportSchema,
        404: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const report = await db.execute(sql`
        SELECT
          id, code, name, "descr", metadata, report_type,
          report_category, data_source_config, query_definition,
          refresh_frequency, chart_type, visualization_config,
          public_flag as is_public, auto_refresh_enabled_flag as auto_refresh_enabled, email_subscribers,
          last_execution_ts as last_execution_time, execution_duration_ms, last_error_message,
          primary_entity_type, primary_entity_id, from_ts, to_ts,
          active_flag, created_ts, updated_ts, version
        FROM app.d_reports
        WHERE id = ${id}
      `);

      if (report.length === 0) {
        return reply.status(404).send({ error: 'Report not found' });
      }

      return report[0];
    } catch (error) {
      fastify.log.error('Error fetching report:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create report
  fastify.post('/api/v1/reports', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateReportSchema,
      response: {
        201: ReportSchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const data = request.body as any;

    try {
      const result = await db.execute(sql`
        INSERT INTO app.d_reports (
          code, name, "descr", metadata, report_type,
          report_category, data_source_config, query_definition,
          refresh_frequency, chart_type, visualization_config,
          public_flag, auto_refresh_enabled_flag, email_subscribers,
          primary_entity_type, primary_entity_id
        )
        VALUES (
          ${data.code},
          ${data.name},
          ${data.descr || null},
          ${JSON.stringify(data.metadata || {})}::jsonb,
          ${data.report_type || 'dashboard'},
          ${data.report_category || null},
          ${JSON.stringify(data.data_source_config || {})}::jsonb,
          ${JSON.stringify(data.query_definition || {})}::jsonb,
          ${data.refresh_frequency || 'daily'},
          ${data.chart_type || null},
          ${JSON.stringify(data.visualization_config || {})}::jsonb,
          ${data.is_public || false},
          ${data.auto_refresh_enabled !== false},
          ${data.email_subscribers ? `{${data.email_subscribers.join(',')}}` : '{}'},
          ${data.primary_entity_type || null},
          ${data.primary_entity_id || null}
        )
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create report' });
      }

      reply.status(201);
      return result[0];
    } catch (error) {
      fastify.log.error('Error creating report:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update report
  fastify.put('/api/v1/reports/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      body: UpdateReportSchema,
      response: {
        200: ReportSchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;

    try {
      // Check if report exists
      const existing = await db.execute(sql`
        SELECT id FROM app.d_reports WHERE id = ${id}
      `);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Report not found' });
      }

      // Build update fields
      const updateFields = [];
      if (data.code !== undefined) updateFields.push(sql`code = ${data.code}`);
      if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
      if (data.descr !== undefined) updateFields.push(sql`"descr" = ${data.descr}`);
      if (data.metadata !== undefined) updateFields.push(sql`metadata = ${JSON.stringify(data.metadata)}::jsonb`);
      if (data.report_type !== undefined) updateFields.push(sql`report_type = ${data.report_type}`);
      if (data.report_category !== undefined) updateFields.push(sql`report_category = ${data.report_category}`);
      if (data.data_source_config !== undefined) updateFields.push(sql`data_source_config = ${JSON.stringify(data.data_source_config)}::jsonb`);
      if (data.query_definition !== undefined) updateFields.push(sql`query_definition = ${JSON.stringify(data.query_definition)}::jsonb`);
      if (data.refresh_frequency !== undefined) updateFields.push(sql`refresh_frequency = ${data.refresh_frequency}`);
      if (data.chart_type !== undefined) updateFields.push(sql`chart_type = ${data.chart_type}`);
      if (data.visualization_config !== undefined) updateFields.push(sql`visualization_config = ${JSON.stringify(data.visualization_config)}`);
      if (data.is_public !== undefined) updateFields.push(sql`is_public = ${data.is_public}`);
      if (data.auto_refresh_enabled !== undefined) updateFields.push(sql`auto_refresh_enabled = ${data.auto_refresh_enabled}`);
      if (data.email_subscribers !== undefined) updateFields.push(sql`email_subscribers = ${data.email_subscribers ? `{${data.email_subscribers.join(',')}}` : '{}'}`);
      if (data.primary_entity_type !== undefined) updateFields.push(sql`primary_entity_type = ${data.primary_entity_type}`);
      if (data.primary_entity_id !== undefined) updateFields.push(sql`primary_entity_id = ${data.primary_entity_id}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_ts = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.d_reports
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update report' });
      }

      return result[0];
    } catch (error) {
      fastify.log.error('Error updating report:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete (soft delete) report
  fastify.delete('/api/v1/reports/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      response: {
        204: Type.Object({}),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      // Check if report exists
      const existing = await db.execute(sql`
        SELECT id FROM app.d_reports WHERE id = ${id}
      `);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Report not found' });
      }

      // Soft delete (using SCD Type 2 pattern)
      await db.execute(sql`
        UPDATE app.d_reports
        SET active_flag = false, to_ts = NOW(), updated_ts = NOW()
        WHERE id = ${id}
      `);

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting report:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get report data/executions
  fastify.get('/api/v1/reports/:id/data', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      querystring: Type.Object({
        stage: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(ReportDataSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
        }),
        404: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { stage, limit = 20, offset = 0 } = request.query as any;

    try {
      // Check if report exists
      const reportExists = await db.execute(sql`
        SELECT id FROM app.d_reports WHERE id = ${id}
      `);

      if (reportExists.length === 0) {
        return reply.status(404).send({ error: 'Report not found' });
      }

      // Build where conditions
      const conditions = [sql`report_id = ${id}`];
      if (stage) {
        conditions.push(sql`stage = ${stage}`);
      }

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_report_data
        WHERE ${sql.join(conditions, sql` AND `)}
      `);
      const total = Number(countResult[0]?.total || 0);

      const reportData = await db.execute(sql`
        SELECT
          id, report_id, execution_timestamp, report_data, data_snapshot_size,
          stage, executed_by_empid, execution_trigger, data_freshness_hours,
          data_completeness_percent, data_accuracy_score, query_execution_time_ms,
          data_processing_time_ms, created_ts, updated_ts
        FROM app.d_report_data
        WHERE ${sql.join(conditions, sql` AND `)}
        ORDER BY execution_timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return {
        data: reportData,
        total,
        limit,
        offset,
      };
    } catch (error) {
      fastify.log.error('Error fetching report data:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create report data/execution
  fastify.post('/api/v1/reports/:id/data', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      body: CreateReportDataSchema,
      response: {
        201: ReportDataSchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const employeeId = (request as any).user?.sub;

    try {
      // Check if report exists
      const reportExists = await db.execute(sql`
        SELECT id FROM app.d_reports WHERE id = ${id}
      `);

      if (reportExists.length === 0) {
        return reply.status(404).send({ error: 'Report not found' });
      }

      const result = await db.execute(sql`
        INSERT INTO app.d_report_data (
          report_id, report_data, data_snapshot_size, stage, executed_by_empid,
          execution_trigger, data_freshness_hours, data_completeness_percent,
          data_accuracy_score, query_execution_time_ms, data_processing_time_ms
        )
        VALUES (
          ${id},
          ${JSON.stringify(data.report_data)},
          ${JSON.stringify(data.report_data).length},
          ${data.stage || 'saved'},
          ${employeeId || null},
          ${data.execution_trigger || 'manual'},
          ${data.data_freshness_hours || null},
          ${data.data_completeness_percent || null},
          ${data.data_accuracy_score || null},
          ${data.query_execution_time_ms || null},
          ${data.data_processing_time_ms || null}
        )
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create report data' });
      }

      reply.status(201);
      return result[0];
    } catch (error) {
      fastify.log.error('Error creating report data:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}