/**
 * ============================================================================
 * REPORTS ROUTES MODULE - Universal Entity Pattern with Unified Data Gate
 * ============================================================================
 *
 * SEMANTICS & PURPOSE:
 * This module implements CRUD operations and metadata endpoints for the Reports
 * entity following the PMO platform's Universal Entity System architecture.
 *
 * Reports are configuration objects that define data sources, queries, refresh
 * schedules, and visualization settings. Actual report data/results are stored
 * in d_report_data; this entity tracks metadata and configuration.
 *
 * ============================================================================
 * DESIGN PATTERNS & ARCHITECTURE
 * ============================================================================
 *
 * 1. UNIFIED DATA GATE PATTERN (Security & Filtering)
 * 2. CREATE-LINK-EDIT PATTERN (Parent-Child Relationships)
 * 3. FACTORY PATTERN (Child Entity Endpoints)
 * 4. UNIVERSAL AUTO-FILTER PATTERN (Zero-Config Filtering)
 * 5. MODULE-LEVEL CONSTANTS (DRY Principle)
 *
 * See: apps/api/src/modules/project/routes.ts for detailed pattern documentation
 *
 * ============================================================================
 * DATA MODEL
 * ============================================================================
 *
 * Primary Table: app.d_reports
 *   • Core fields: id, code, name, descr, metadata
 *   • Report definition: report_type, report_category, data_source_config, query_definition
 *   • Visualization: chart_type, visualization_config
 *   • Scheduling: refresh_frequency, auto_refresh_enabled_flag, email_subscribers
 *   • Performance: last_execution_ts, execution_duration_ms, last_error_message
 *   • Temporal: from_ts, to_ts, active_flag, created_ts, updated_ts, version
 *
 * Child Table: app.d_report_data
 *   • Stores report execution results
 *   • Links to parent via report_id
 *
 * Relationships (via d_entity_id_map):
 *   • Parent entities: Can be linked to project, task, business, office
 *   • Child entities: report_data (1:many relationship)
 *
 * ============================================================================
 * ENDPOINT CATALOG
 * ============================================================================
 *
 * CORE CRUD:
 *   GET    /api/v1/reports                   - List reports (with RBAC + optional parent filter)
 *   GET    /api/v1/reports/:id               - Get single report (RBAC checked)
 *   POST   /api/v1/reports                   - Create report (with optional parent linking)
 *   PATCH  /api/v1/reports/:id               - Update report (RBAC checked)
 *   DELETE /api/v1/reports/:id               - Soft delete report (factory endpoint)
 *
 * CHILD ENTITIES (Factory-Generated):
 *   GET    /api/v1/reports/:id/report_data   - List report execution data
 *
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql, SQL } from 'drizzle-orm';
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';
import { createChildEntityEndpointsFromMetadata } from '../../lib/child-entity-route-factory.js';
import { unified_data_gate, Permission, ALL_ENTITIES_ID } from '../../lib/unified-data-gate.js';
import { createLinkage } from '../../services/linkage.service.js';
import { buildAutoFilters } from '../../lib/universal-filter-builder.js';

// Schema based on d_reports table structure
const ReportSchema = Type.Object({
  id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  // Report definition
  report_type: Type.Optional(Type.String()),
  report_category: Type.Optional(Type.String()),
  // Data source configuration
  data_source_config: Type.Optional(Type.Any()),
  query_definition: Type.Optional(Type.Any()),
  refresh_frequency: Type.Optional(Type.String()),
  // Visualization settings
  chart_type: Type.Optional(Type.String()),
  visualization_config: Type.Optional(Type.Any()),
  // Access and scheduling
  public_flag: Type.Optional(Type.Boolean()),
  auto_refresh_enabled_flag: Type.Optional(Type.Boolean()),
  email_subscribers: Type.Optional(Type.Array(Type.String())),
  // Performance tracking
  last_execution_ts: Type.Optional(Type.String()),
  execution_duration_ms: Type.Optional(Type.Number()),
  last_error_message: Type.Optional(Type.String()),
  // Relationships
  primary_entity_type: Type.Optional(Type.String()),
  primary_entity_id: Type.Optional(Type.String()),
  // Temporal fields
  from_ts: Type.Optional(Type.String()),
  to_ts: Type.Optional(Type.String()),
  active_flag: Type.Optional(Type.Boolean()),
  created_ts: Type.Optional(Type.String()),
  updated_ts: Type.Optional(Type.String()),
  version: Type.Optional(Type.Number()),
});

const CreateReportSchema = Type.Object({
  code: Type.Optional(Type.String({ minLength: 1 })),
  name: Type.Optional(Type.String({ minLength: 1 })),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  report_type: Type.Optional(Type.String()),
  report_category: Type.Optional(Type.String()),
  data_source_config: Type.Optional(Type.Any()),
  query_definition: Type.Optional(Type.Any()),
  refresh_frequency: Type.Optional(Type.String()),
  chart_type: Type.Optional(Type.String()),
  visualization_config: Type.Optional(Type.Any()),
  public_flag: Type.Optional(Type.Boolean()),
  auto_refresh_enabled_flag: Type.Optional(Type.Boolean()),
  email_subscribers: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  primary_entity_type: Type.Optional(Type.String()),
  primary_entity_id: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
  active_flag: Type.Optional(Type.Boolean()),
});

const UpdateReportSchema = Type.Partial(CreateReportSchema);

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_TYPE = 'reports';
const TABLE_ALIAS = 'e';

export async function reportsRoutes(fastify: FastifyInstance) {
  // ============================================================================
  // LIST REPORTS
  // ============================================================================
  fastify.get('/api/v1/reports', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        report_type: Type.Optional(Type.String()),
        report_category: Type.Optional(Type.String()),
        public_flag: Type.Optional(Type.Boolean()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        page: Type.Optional(Type.Number({ minimum: 1 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(ReportSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
        }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { limit = 20, offset: queryOffset, page } = request.query as any;
    const offset = page ? (page - 1) * limit : (queryOffset !== undefined ? queryOffset : 0);

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Build WHERE conditions array
      const conditions: SQL[] = [];

      // GATE 1: RBAC - Apply security filtering
      const rbacCondition = await unified_data_gate.rbac_gate.getWhereCondition(
        userId,
        ENTITY_TYPE,
        Permission.VIEW,
        TABLE_ALIAS
      );
      conditions.push(rbacCondition);

      // ✨ UNIVERSAL AUTO-FILTER SYSTEM
      const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query as any, {
        overrides: {
          active: { column: 'active_flag', type: 'boolean' }
        }
      });
      conditions.push(...autoFilters);

      // Build WHERE clause
      const whereClause = conditions.length > 0
        ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
        : sql``;

      // Count query
      const countQuery = sql`
        SELECT COUNT(DISTINCT ${sql.raw(TABLE_ALIAS)}.id) as total
        FROM app.d_${sql.raw(ENTITY_TYPE)} ${sql.raw(TABLE_ALIAS)}
        ${whereClause}
      `;

      // Data query
      const dataQuery = sql`
        SELECT ${sql.raw(TABLE_ALIAS)}.*
        FROM app.d_${sql.raw(ENTITY_TYPE)} ${sql.raw(TABLE_ALIAS)}
        ${whereClause}
        ORDER BY ${sql.raw(TABLE_ALIAS)}.name ASC NULLS LAST, ${sql.raw(TABLE_ALIAS)}.created_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const [countResult, dataResult] = await Promise.all([
        db.execute(countQuery),
        db.execute(dataQuery)
      ]);

      const total = Number(countResult[0]?.total || 0);

      return {
        data: dataResult,
        total,
        limit,
        offset,
      };
    } catch (error) {
      fastify.log.error('Error fetching reports:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // GET SINGLE REPORT
  // ============================================================================
  fastify.get('/api/v1/reports/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      response: {
        200: ReportSchema,
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // RBAC check: Can user view this report?
      const hasPermission = await unified_data_gate.rbac_gate.checkPermission(
        db,
        userId,
        ENTITY_TYPE,
        id,
        Permission.VIEW
      );

      if (!hasPermission) {
        return reply.status(403).send({ error: 'Forbidden: Insufficient permissions' });
      }

      const result = await db.execute(sql`
        SELECT *
        FROM app.d_${sql.raw(ENTITY_TYPE)}
        WHERE id = ${id} AND active_flag = true
      `);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Report not found' });
      }

      return result[0];
    } catch (error) {
      fastify.log.error('Error fetching report:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // CREATE REPORT
  // ============================================================================
  fastify.post('/api/v1/reports', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateReportSchema,
      querystring: Type.Object({
        parent_type: Type.Optional(Type.String()),
        parent_id: Type.Optional(Type.String({ format: 'uuid' })),
      }),
      response: {
        201: ReportSchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const data = request.body as any;
    const { parent_type, parent_id } = request.query as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // RBAC check: Can user create reports?
      const canCreate = await unified_data_gate.rbac_gate.checkPermission(
        db,
        userId,
        ENTITY_TYPE,
        ALL_ENTITIES_ID,
        Permission.CREATE
      );

      if (!canCreate) {
        return reply.status(403).send({ error: 'Forbidden: Insufficient permissions to create reports' });
      }

      // If linking to parent, check parent edit permission
      if (parent_type && parent_id) {
        const canEditParent = await unified_data_gate.rbac_gate.checkPermission(
          db,
          userId,
          parent_type,
          parent_id,
          Permission.EDIT
        );

        if (!canEditParent) {
          return reply.status(403).send({ error: `Forbidden: Cannot link report to ${parent_type}` });
        }
      }

      // Create report
      const result = await db.execute(sql`
        INSERT INTO app.d_reports (
          code, name, descr, metadata, report_type,
          report_category, data_source_config, query_definition,
          refresh_frequency, chart_type, visualization_config,
          public_flag, auto_refresh_enabled_flag, email_subscribers,
          primary_entity_type, primary_entity_id, active_flag
        )
        VALUES (
          ${data.code || 'REP-' + Date.now()},
          ${data.name || 'Untitled Report'},
          ${data.descr || null},
          ${JSON.stringify(data.metadata || {})}::jsonb,
          ${data.report_type || 'dashboard'},
          ${data.report_category || null},
          ${JSON.stringify(data.data_source_config || {})}::jsonb,
          ${JSON.stringify(data.query_definition || {})}::jsonb,
          ${data.refresh_frequency || 'daily'},
          ${data.chart_type || null},
          ${JSON.stringify(data.visualization_config || {})}::jsonb,
          ${data.public_flag !== undefined ? data.public_flag : false},
          ${data.auto_refresh_enabled_flag !== undefined ? data.auto_refresh_enabled_flag : true},
          ${data.email_subscribers ? sql`ARRAY[${sql.join(data.email_subscribers.map((id: string) => sql`${id}::uuid`), sql`, `)}]` : sql`'{}'::uuid[]`},
          ${data.primary_entity_type || null},
          ${data.primary_entity_id || null},
          ${data.active_flag !== undefined ? data.active_flag : true}
        )
        RETURNING *
      `);

      const newReport = result[0];

      // Link to parent if provided
      if (parent_type && parent_id && newReport?.id) {
        await createLinkage(db, {
          parent_entity_type: parent_type,
          parent_entity_id: parent_id,
          child_entity_type: ENTITY_TYPE,
          child_entity_id: newReport.id,
        });
      }

      // Grant DELETE permission to creator
      await db.execute(sql`
        INSERT INTO app.entity_id_rbac_map (
          person_entity_name, person_entity_id, entity, entity_id, permission
        )
        VALUES (
          'employee',
          ${userId}::uuid,
          ${ENTITY_TYPE},
          ${newReport.id}::text,
          ARRAY[${Permission.DELETE}]::integer[]
        )
        ON CONFLICT (person_entity_name, person_entity_id, entity, entity_id)
        DO UPDATE SET permission = EXCLUDED.permission
      `);

      reply.status(201);
      return newReport;
    } catch (error) {
      fastify.log.error('Error creating report:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // UPDATE REPORT
  // ============================================================================
  fastify.patch('/api/v1/reports/:id', {
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
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // RBAC check: Can user edit this report?
      const hasPermission = await unified_data_gate.rbac_gate.checkPermission(
        db,
        userId,
        ENTITY_TYPE,
        id,
        Permission.EDIT
      );

      if (!hasPermission) {
        return reply.status(403).send({ error: 'Forbidden: Insufficient permissions to edit report' });
      }

      // Check if report exists
      const existing = await db.execute(sql`
        SELECT id FROM app.d_reports WHERE id = ${id} AND active_flag = true
      `);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Report not found' });
      }

      // Build update fields
      const updateFields: SQL[] = [];

      if (data.code !== undefined) updateFields.push(sql`code = ${data.code}`);
      if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
      if (data.descr !== undefined) updateFields.push(sql`descr = ${data.descr}`);
      if (data.metadata !== undefined) updateFields.push(sql`metadata = ${JSON.stringify(data.metadata)}::jsonb`);
      if (data.report_type !== undefined) updateFields.push(sql`report_type = ${data.report_type}`);
      if (data.report_category !== undefined) updateFields.push(sql`report_category = ${data.report_category}`);
      if (data.data_source_config !== undefined) updateFields.push(sql`data_source_config = ${JSON.stringify(data.data_source_config)}::jsonb`);
      if (data.query_definition !== undefined) updateFields.push(sql`query_definition = ${JSON.stringify(data.query_definition)}::jsonb`);
      if (data.refresh_frequency !== undefined) updateFields.push(sql`refresh_frequency = ${data.refresh_frequency}`);
      if (data.chart_type !== undefined) updateFields.push(sql`chart_type = ${data.chart_type}`);
      if (data.visualization_config !== undefined) updateFields.push(sql`visualization_config = ${JSON.stringify(data.visualization_config)}::jsonb`);
      if (data.public_flag !== undefined) updateFields.push(sql`public_flag = ${data.public_flag}`);
      if (data.auto_refresh_enabled_flag !== undefined) updateFields.push(sql`auto_refresh_enabled_flag = ${data.auto_refresh_enabled_flag}`);
      if (data.email_subscribers !== undefined) {
        updateFields.push(sql`email_subscribers = ${data.email_subscribers.length > 0 ? sql`ARRAY[${sql.join(data.email_subscribers.map((id: string) => sql`${id}::uuid`), sql`, `)}]` : sql`'{}'::uuid[]`}`);
      }
      if (data.primary_entity_type !== undefined) updateFields.push(sql`primary_entity_type = ${data.primary_entity_type}`);
      if (data.primary_entity_id !== undefined) updateFields.push(sql`primary_entity_id = ${data.primary_entity_id}`);
      if (data.active_flag !== undefined) updateFields.push(sql`active_flag = ${data.active_flag}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      // Add version increment and updated_ts
      updateFields.push(sql`version = version + 1`);
      updateFields.push(sql`updated_ts = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.d_reports
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      return result[0];
    } catch (error) {
      fastify.log.error('Error updating report:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // UPDATE REPORT (PUT - alias to PATCH for frontend compatibility)
  // ============================================================================
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
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // RBAC check: Can user edit this report?
      const hasPermission = await unified_data_gate.rbac_gate.checkPermission(
        db,
        userId,
        ENTITY_TYPE,
        id,
        Permission.EDIT
      );

      if (!hasPermission) {
        return reply.status(403).send({ error: 'Forbidden: Insufficient permissions to edit report' });
      }

      // Check if report exists
      const existing = await db.execute(sql`
        SELECT id FROM app.d_reports WHERE id = ${id} AND active_flag = true
      `);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Report not found' });
      }

      // Build update fields
      const updateFields: SQL[] = [];

      if (data.code !== undefined) updateFields.push(sql`code = ${data.code}`);
      if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
      if (data.descr !== undefined) updateFields.push(sql`descr = ${data.descr}`);
      if (data.metadata !== undefined) updateFields.push(sql`metadata = ${JSON.stringify(data.metadata)}::jsonb`);
      if (data.report_type !== undefined) updateFields.push(sql`report_type = ${data.report_type}`);
      if (data.report_category !== undefined) updateFields.push(sql`report_category = ${data.report_category}`);
      if (data.data_source_config !== undefined) updateFields.push(sql`data_source_config = ${JSON.stringify(data.data_source_config)}::jsonb`);
      if (data.query_definition !== undefined) updateFields.push(sql`query_definition = ${JSON.stringify(data.query_definition)}::jsonb`);
      if (data.refresh_frequency !== undefined) updateFields.push(sql`refresh_frequency = ${data.refresh_frequency}`);
      if (data.chart_type !== undefined) updateFields.push(sql`chart_type = ${data.chart_type}`);
      if (data.visualization_config !== undefined) updateFields.push(sql`visualization_config = ${JSON.stringify(data.visualization_config)}::jsonb`);
      if (data.public_flag !== undefined) updateFields.push(sql`public_flag = ${data.public_flag}`);
      if (data.auto_refresh_enabled_flag !== undefined) updateFields.push(sql`auto_refresh_enabled_flag = ${data.auto_refresh_enabled_flag}`);
      if (data.email_subscribers !== undefined) {
        updateFields.push(sql`email_subscribers = ${data.email_subscribers.length > 0 ? sql`ARRAY[${sql.join(data.email_subscribers.map((id: string) => sql`${id}::uuid`), sql`, `)}]` : sql`'{}'::uuid[]`}`);
      }
      if (data.primary_entity_type !== undefined) updateFields.push(sql`primary_entity_type = ${data.primary_entity_type}`);
      if (data.primary_entity_id !== undefined) updateFields.push(sql`primary_entity_id = ${data.primary_entity_id}`);
      if (data.active_flag !== undefined) updateFields.push(sql`active_flag = ${data.active_flag}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      // Add version increment and updated_ts
      updateFields.push(sql`version = version + 1`);
      updateFields.push(sql`updated_ts = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.d_reports
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      return result[0];
    } catch (error) {
      fastify.log.error('Error updating report:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // DELETE ENDPOINT (Factory-Generated)
  // ============================================================================
  createEntityDeleteEndpoint(fastify, ENTITY_TYPE);

  // ============================================================================
  // CHILD ENTITY ENDPOINTS (Factory-Generated)
  // ============================================================================
  // Auto-generates: GET /api/v1/reports/:id/{child_entity}
  createChildEntityEndpointsFromMetadata(fastify, ENTITY_TYPE);
}
