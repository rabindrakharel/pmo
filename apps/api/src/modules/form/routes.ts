import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { eq, and, isNull, desc, asc, sql } from 'drizzle-orm';

const FormSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  form_code: Type.Optional(Type.String()),
  form_global_link: Type.Optional(Type.String()),
  project_specific: Type.Optional(Type.Boolean()),
  project_id: Type.Optional(Type.String()),
  biz_specific: Type.Optional(Type.Boolean()),
  biz_id: Type.Optional(Type.String()),
  hr_specific: Type.Optional(Type.Boolean()),
  hr_id: Type.Optional(Type.String()),
  worksite_specific: Type.Optional(Type.Boolean()),
  worksite_id: Type.Optional(Type.String()),
  version: Type.Optional(Type.Number()),
  active: Type.Boolean(),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  created: Type.String(),
  updated: Type.String(),
  tags: Type.Optional(Type.Array(Type.String())),
  schema: Type.Optional(Type.Any()),
  attr: Type.Optional(Type.Any()),
  is_public: Type.Optional(Type.Boolean()),
  requires_authentication: Type.Optional(Type.Boolean()),
});

const CreateFormSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  form_code: Type.Optional(Type.String()),
  form_global_link: Type.Optional(Type.String()),
  project_specific: Type.Optional(Type.Boolean()),
  project_id: Type.Optional(Type.String()),
  biz_specific: Type.Optional(Type.Boolean()),
  biz_id: Type.Optional(Type.String()),
  hr_specific: Type.Optional(Type.Boolean()),
  hr_id: Type.Optional(Type.String()),
  worksite_specific: Type.Optional(Type.Boolean()),
  worksite_id: Type.Optional(Type.String()),
  version: Type.Optional(Type.Number()),
  active: Type.Optional(Type.Boolean()),
  from_ts: Type.Optional(Type.String({ format: 'date-time' })),
  tags: Type.Optional(Type.Array(Type.String())),
  schema: Type.Optional(Type.Any()),
  attr: Type.Optional(Type.Any()),
  is_public: Type.Optional(Type.Boolean()),
  requires_authentication: Type.Optional(Type.Boolean()),
});

const UpdateFormSchema = Type.Partial(CreateFormSchema);

export async function formRoutes(fastify: FastifyInstance) {
  // List forms with filtering
  fastify.get('/api/v1/form', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        version: Type.Optional(Type.Number()),
        active: Type.Optional(Type.Boolean()),
        project_specific: Type.Optional(Type.Boolean()),
        biz_specific: Type.Optional(Type.Boolean()),
        hr_specific: Type.Optional(Type.Boolean()),
        worksite_specific: Type.Optional(Type.Boolean()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(FormSchema),
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
      version, 
      active, 
      project_specific,
      biz_specific,
      hr_specific,
      worksite_specific,
      limit = 50, 
      offset = 0 
    } = request.query as any;

    try {
      // Build query conditions
      const conditions = [];
      
      if (version !== undefined) {
        conditions.push(sql`version = ${version}`);
      }
      
      if (active !== undefined) {
        conditions.push(sql`active_flag = ${active}`);
      }
      
      if (project_specific !== undefined) {
        conditions.push(sql`project_specific = ${project_specific}`);
      }
      
      if (biz_specific !== undefined) {
        conditions.push(sql`biz_specific = ${biz_specific}`);
      }
      
      if (hr_specific !== undefined) {
        conditions.push(sql`hr_specific = ${hr_specific}`);
      }
      
      if (worksite_specific !== undefined) {
        conditions.push(sql`worksite_specific = ${worksite_specific}`);
      }

      // Direct RBAC filtering - only show forms user has access to
      const employeeId = (request as any).user?.sub;
      if (!employeeId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      const rbacConditions = [
        sql`(
          EXISTS (
            SELECT 1 FROM app.entity_id_rbac_map rbac
            WHERE rbac.empid = ${employeeId}
              AND rbac.entity = 'form'
              AND (rbac.entity_id = f.id::text OR rbac.entity_id = 'all')
              AND rbac.active_flag = true
              AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
              AND 0 = ANY(rbac.permission)
          )
        )`
      ];

      // Add RBAC filtering to conditions
      conditions.push(...rbacConditions);

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_form_head f
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      // Get paginated results
      const forms = await db.execute(sql`
        SELECT
          f.id,
          f.name,
          f."descr",
          f.form_code,
          form_global_link,
          project_specific,
          project_id,
          biz_specific,
          biz_id,
          hr_specific,
          hr_id,
          worksite_specific,
          worksite_id,
          version,
          active,
          from_ts,
          to_ts,
          created,
          updated,
          tags,
          schema,
          attr,
          is_public,
          requires_authentication,
          form_type,
          is_template,
          is_draft,
          form_builder_schema,
          form_builder_state,
          step_configuration,
          validation_rules,
          submission_config,
          workflow_config,
          access_config,
          metadata,
          version_metadata
        FROM app.d_form_head f
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY f.name ASC, f.version DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return {
        data: forms,
        total,
        limit,
        offset,
      };
    } catch (error) {
      fastify.log.error('Error fetching forms: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single form
  fastify.get('/api/v1/form/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: FormSchema,
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

    // Direct RBAC check for form access
    const formAccess = await db.execute(sql`
      SELECT 1 FROM app.entity_id_rbac_map rbac
      WHERE rbac.empid = ${userId}
        AND rbac.entity = 'form'
        AND (rbac.entity_id = ${id} OR rbac.entity_id = 'all')
        AND rbac.active_flag = true
        AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
        AND 0 = ANY(rbac.permission)
    `);

    if (formAccess.length === 0) {
      return reply.status(403).send({ error: 'Insufficient permissions to view this form' });
    }

    try {
      const form = await db.execute(sql`
        SELECT
          id,
          name,
          "descr",
          form_global_link as "formGlobalLink",
          project_specific as "projectSpecific",
          project_id as "projectId",
          task_specific as "taskSpecific",
          task_id as "taskId",
          biz_specific as "businessSpecific",
          biz_id as "businessId",
          hr_specific as "hrSpecific",
          hr_id as "hrId",
          worksite_specific as "worksiteSpecific",
          worksite_id as "worksiteId",
          version,
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated,
          tags,
          schema,
          attr,
          form_type as "formType",
          is_template as "isTemplate",
          is_draft as "isDraft",
          form_builder_schema as "formBuilderSchema",
          form_builder_state as "formBuilderState",
          step_configuration as "stepConfiguration",
          validation_rules as "validationRules",
          submission_config as "submissionConfig",
          workflow_config as "workflowConfig",
          access_config as "accessConfig",
          metadata,
          version_metadata as "versionMetadata"
        FROM app.d_form_head
        WHERE id = ${id} AND active_flag = true
      `);

      if (form.length === 0) {
        return reply.status(404).send({ error: 'Form not found' });
      }

      return form[0];
    } catch (error) {
      fastify.log.error('Error fetching form: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create form
  fastify.post('/api/v1/form', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateFormSchema,
      response: {
        201: FormSchema,
        403: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const data = request.body as any;

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // Direct RBAC check for form create permission
    const formCreateAccess = await db.execute(sql`
      SELECT 1 FROM app.entity_id_rbac_map rbac
      WHERE rbac.empid = ${userId}
        AND rbac.entity = 'form'
        AND rbac.entity_id = 'all'
        AND rbac.active_flag = true
        AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
        AND 4 = ANY(rbac.permission)
    `);

    if (formCreateAccess.length === 0) {
      return reply.status(403).send({ error: 'Insufficient permissions to create forms' });
    }

    try {
      // Check for unique name and version combination
      const existingForm = await db.execute(sql`
        SELECT id FROM app.d_form_head 
        WHERE name = ${data.name} AND version = ${data.version || 1} AND active_flag = true
      `);
      if (existingForm.length > 0) {
        return reply.status(400).send({ error: 'Form with this name and version already exists' });
      }

      const fromTs = data.fromTs || new Date().toISOString();
      
      const result = await db.execute(sql`
        INSERT INTO app.d_form_head (
          name, "descr", form_global_link,
          project_specific, project_id,
          task_specific, task_id,
          location_specific, location_id,
          business_specific, business_id,
          hr_specific, hr_id,
          worksite_specific, worksite_id,
          version, active, from_ts, tags, schema, attr,
          form_type, is_template, is_draft,
          form_builder_schema, form_builder_state, step_configuration,
          validation_rules, submission_config, workflow_config,
          access_config, metadata, version_metadata
        )
        VALUES (
          ${data.name},
          ${data.descr || null},
          ${data.formGlobalLink || null},
          ${data.projectSpecific !== undefined ? data.projectSpecific : false}, ${data.projectId || null},
          ${data.taskSpecific !== undefined ? data.taskSpecific : false}, ${data.taskId || null},
          ${data.locationSpecific !== undefined ? data.locationSpecific : false}, ${data.locationId || null},
          ${data.businessSpecific !== undefined ? data.businessSpecific : false}, ${data.businessId || null},
          ${data.hrSpecific !== undefined ? data.hrSpecific : false}, ${data.hrId || null},
          ${data.worksiteSpecific !== undefined ? data.worksiteSpecific : false}, ${data.worksiteId || null},
          ${data.version || 1},
          ${data.active !== false},
          ${fromTs},
          ${JSON.stringify(data.tags || [])},
          ${JSON.stringify(data.schema || {})},
          ${JSON.stringify(data.attr || {})},
          ${data.formType || 'multi_step'},
          ${data.isTemplate !== undefined ? data.isTemplate : false},
          ${data.isDraft !== undefined ? data.isDraft : false},
          ${JSON.stringify(data.formBuilderSchema || {steps: []})},
          ${JSON.stringify(data.formBuilderState || {currentStepIndex: 0, activeFieldId: null, lastModified: null, modifiedBy: userId, fieldSequence: []})},
          ${JSON.stringify(data.stepConfiguration || {totalSteps: 1, allowStepSkipping: false, showStepProgress: true, saveProgressOnStepChange: true, validateOnStepChange: true, stepTransition: 'slide', currentStepIndex: 0})},
          ${JSON.stringify(data.validationRules || {requiredFields: [], customValidators: [], globalRules: []})},
          ${JSON.stringify(data.submissionConfig || {allowDraft: true, autoSaveInterval: 30000, requireAuthentication: true, allowAnonymous: false, confirmationMessage: 'Thank you for your submission!', redirectUrl: null, emailNotifications: {enabled: false, recipients: [], template: null, ccClient: false}})},
          ${JSON.stringify(data.workflowConfig || {requiresApproval: false, approvers: [], approvalStages: []})},
          ${JSON.stringify(data.accessConfig || {visibility: 'private', allowedRoles: [], allowedUsers: [], expiresAt: null})},
          ${JSON.stringify(data.metadata || {category: null, department: null, estimatedCompletionTime: null, completionRate: 0, averageCompletionTime: 0, totalSubmissions: 0, createdBy: userId, createdByName: null, tags: []})},
          ${JSON.stringify(data.versionMetadata || {version: 1, previousVersionId: null, changeLog: []})}
        )
        RETURNING
          id,
          name,
          "descr",
          form_global_link as "formGlobalLink",
          project_specific as "projectSpecific",
          project_id as "projectId",
          task_specific as "taskSpecific",
          task_id as "taskId",
          location_specific as "locationSpecific",
          location_id as "locationId",
          business_specific as "businessSpecific",
          business_id as "businessId",
          hr_specific as "hrSpecific",
          hr_id as "hrId",
          worksite_specific as "worksiteSpecific",
          worksite_id as "worksiteId",
          version,
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated,
          tags,
          schema,
          attr,
          form_type as "formType",
          is_template as "isTemplate",
          is_draft as "isDraft",
          form_builder_schema as "formBuilderSchema",
          form_builder_state as "formBuilderState",
          step_configuration as "stepConfiguration",
          validation_rules as "validationRules",
          submission_config as "submissionConfig",
          workflow_config as "workflowConfig",
          access_config as "accessConfig",
          metadata,
          version_metadata as "versionMetadata"
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create form' });
      }

      return reply.status(201).send(result[0]);
    } catch (error) {
      fastify.log.error('Error creating form: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update form
  fastify.put('/api/v1/form/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: UpdateFormSchema,
      response: {
        200: FormSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;

    try {
      // Check if form exists
      const existing = await db.execute(sql`
        SELECT id FROM app.d_form_head WHERE id = ${id} AND active_flag = true
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Form not found' });
      }

      // Check for unique name and version combination on update
      if (data.name && data.version) {
        const existingNameVersion = await db.execute(sql`
          SELECT id FROM app.d_form_head 
          WHERE name = ${data.name} AND version = ${data.version} AND active_flag = true AND id != ${id}
        `);
        if (existingNameVersion.length > 0) {
          return reply.status(400).send({ error: 'Form with this name and version already exists' });
        }
      }

      // Build update fields
      const updateFields = [];
      
      if (data.name !== undefined) {
        updateFields.push(sql`name = ${data.name}`);
      }
      
      if (data.descr !== undefined) {
        updateFields.push(sql`"descr" = ${data.descr}`);
      }
      
      if (data.form_global_link !== undefined) {
        updateFields.push(sql`form_global_link = ${data.form_global_link}`);
      }
      
      if (data.project_specific !== undefined) {
        updateFields.push(sql`project_specific = ${data.project_specific}`);
      }
      if (data.project_id !== undefined) {
        updateFields.push(sql`project_id = ${data.project_id}`);
      }
      
      if (data.task_specific !== undefined) {
        updateFields.push(sql`task_specific = ${data.task_specific}`);
      }
      if (data.task_id !== undefined) {
        updateFields.push(sql`task_id = ${data.task_id}`);
      }
      
      if (data.biz_specific !== undefined) {
        updateFields.push(sql`biz_specific = ${data.biz_specific}`);
      }
      if (data.biz_id !== undefined) {
        updateFields.push(sql`biz_id = ${data.biz_id}`);
      }
      
      if (data.hr_specific !== undefined) {
        updateFields.push(sql`hr_specific = ${data.hr_specific}`);
      }
      if (data.hr_id !== undefined) {
        updateFields.push(sql`hr_id = ${data.hr_id}`);
      }
      
      if (data.worksite_specific !== undefined) {
        updateFields.push(sql`worksite_specific = ${data.worksite_specific}`);
      }
      if (data.worksite_id !== undefined) {
        updateFields.push(sql`worksite_id = ${data.worksite_id}`);
      }
      
      if (data.version !== undefined) {
        updateFields.push(sql`version = ${data.version}`);
      }
      
      if (data.tags !== undefined) {
        updateFields.push(sql`tags = ${JSON.stringify(data.tags)}`);
      }
      
      if (data.schema !== undefined) {
        updateFields.push(sql`schema = ${JSON.stringify(data.schema)}`);
      }
      
      if (data.attr !== undefined) {
        updateFields.push(sql`attr = ${JSON.stringify(data.attr)}`);
      }
      
      if (data.active !== undefined) {
        updateFields.push(sql`active_flag = ${data.active}`);
      }

      // Form builder metadata fields
      if (data.formType !== undefined) {
        updateFields.push(sql`form_type = ${data.formType}`);
      }

      if (data.isTemplate !== undefined) {
        updateFields.push(sql`is_template = ${data.isTemplate}`);
      }

      if (data.isDraft !== undefined) {
        updateFields.push(sql`is_draft = ${data.isDraft}`);
      }

      if (data.formBuilderSchema !== undefined) {
        updateFields.push(sql`form_builder_schema = ${JSON.stringify(data.formBuilderSchema)}`);
      }

      if (data.formBuilderState !== undefined) {
        updateFields.push(sql`form_builder_state = ${JSON.stringify(data.formBuilderState)}`);
      }

      if (data.stepConfiguration !== undefined) {
        updateFields.push(sql`step_configuration = ${JSON.stringify(data.stepConfiguration)}`);
      }

      if (data.validationRules !== undefined) {
        updateFields.push(sql`validation_rules = ${JSON.stringify(data.validationRules)}`);
      }

      if (data.submissionConfig !== undefined) {
        updateFields.push(sql`submission_config = ${JSON.stringify(data.submissionConfig)}`);
      }

      if (data.workflowConfig !== undefined) {
        updateFields.push(sql`workflow_config = ${JSON.stringify(data.workflowConfig)}`);
      }

      if (data.accessConfig !== undefined) {
        updateFields.push(sql`access_config = ${JSON.stringify(data.accessConfig)}`);
      }

      if (data.metadata !== undefined) {
        updateFields.push(sql`metadata = ${JSON.stringify(data.metadata)}`);
      }

      if (data.versionMetadata !== undefined) {
        updateFields.push(sql`version_metadata = ${JSON.stringify(data.versionMetadata)}`);
      }

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.d_form_head 
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING
          id,
          name,
          "descr",
          form_global_link as "formGlobalLink",
          project_specific as "projectSpecific",
          project_id as "projectId",
          task_specific as "taskSpecific",
          task_id as "taskId",
          location_specific as "locationSpecific",
          location_id as "locationId",
          business_specific as "businessSpecific",
          business_id as "businessId",
          hr_specific as "hrSpecific",
          hr_id as "hrId",
          worksite_specific as "worksiteSpecific",
          worksite_id as "worksiteId",
          version,
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated,
          tags,
          schema,
          attr,
          form_type as "formType",
          is_template as "isTemplate",
          is_draft as "isDraft",
          form_builder_schema as "formBuilderSchema",
          form_builder_state as "formBuilderState",
          step_configuration as "stepConfiguration",
          validation_rules as "validationRules",
          submission_config as "submissionConfig",
          workflow_config as "workflowConfig",
          access_config as "accessConfig",
          metadata,
          version_metadata as "versionMetadata"
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update form' });
      }

      return result[0];
    } catch (error) {
      fastify.log.error('Error updating form: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete form (soft delete)
  fastify.delete('/api/v1/form/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        204: Type.Null(),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      // Check if form exists
      const existing = await db.execute(sql`
        SELECT id FROM app.d_form_head WHERE id = ${id} AND active_flag = true
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Form not found' });
      }

      // Check if form has submitted records
      const submittedRecords = await db.execute(sql`
        SELECT COUNT(*) as count FROM app.ops_formlog_records WHERE head_id = ${id} AND active_flag = true
      `);
      
      if (Number(submittedRecords[0]?.count || 0) > 0) {
        return reply.status(400).send({ error: 'Cannot delete form that has submitted records' });
      }

      // Soft delete
      await db.execute(sql`
        UPDATE app.d_form_head 
        SET active_flag = false, to_ts = NOW(), updated = NOW()
        WHERE id = ${id}
      `);

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting form: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get form records/submissions
  fastify.get('/api/v1/form/:id/records', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      querystring: Type.Object({
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          form: FormSchema,
          records: Type.Array(Type.Object({
            id: Type.String(),
            name: Type.String(),
            descr: Type.Optional(Type.String()),
            data: Type.Any(),
            created: Type.String(),
            updated: Type.String(),
          })),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
        }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { limit = 50, offset = 0 } = request.query as any;

    try {
      // Get form
      const form = await db.execute(sql`
        SELECT 
          id,
          name,
          "descr",
          form_global_link as "formGlobalLink",
          project_specific as "projectSpecific",
          project_id as "projectId",
          task_specific as "taskSpecific",
          task_id as "taskId",
          biz_specific as "businessSpecific",
          biz_id as "businessId",
          hr_specific as "hrSpecific",
          hr_id as "hrId",
          worksite_specific as "worksiteSpecific",
          worksite_id as "worksiteId",
          version,
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated,
          tags,
          schema,
          attr
        FROM app.d_form_head 
        WHERE id = ${id} AND active_flag = true
      `);

      if (form.length === 0) {
        return reply.status(404).send({ error: 'Form not found' });
      }

      // Get total count of records
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total 
        FROM app.ops_formlog_records 
        WHERE head_id = ${id} AND active_flag = true
      `);
      const total = Number(countResult[0]?.total || 0);

      // Get form records
      const records = await db.execute(sql`
        SELECT 
          id,
          name,
          "descr",
          data,
          created,
          updated
        FROM app.ops_formlog_records 
        WHERE head_id = ${id} AND active_flag = true
        ORDER BY created DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return {
        form: form[0],
        records,
        total,
        limit,
        offset,
      };
    } catch (error) {
      fastify.log.error('Error fetching form records: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
