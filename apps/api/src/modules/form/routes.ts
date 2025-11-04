import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

// Response schema matching minimalistic database structure
const FormSchema = Type.Object({
  id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  internal_url: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  shared_url: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  form_type: Type.String(),
  form_schema: Type.Any(),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  active_flag: Type.Boolean(),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  version: Type.Number(),
});

// Create schema
const CreateFormSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1 })),
  descr: Type.Optional(Type.String()),
  internal_url: Type.Optional(Type.String()),
  shared_url: Type.Optional(Type.String()),
  form_type: Type.Optional(Type.String()),
  form_schema: Type.Optional(Type.Any()),
  version: Type.Optional(Type.Number()),
  active_flag: Type.Optional(Type.Boolean()),
});

const UpdateFormSchema = Type.Partial(CreateFormSchema);

export async function formRoutes(fastify: FastifyInstance) {
  // List forms with RBAC filtering - Shows only latest version by default
  fastify.get('/api/v1/form', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active_flag: Type.Optional(Type.Boolean()),
        form_type: Type.Optional(Type.String()),
        search: Type.Optional(Type.String()),
        page: Type.Optional(Type.Number({ minimum: 1 })),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        show_all_versions: Type.Optional(Type.Boolean()),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(FormSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
        }),
        403: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const {
        active_flag = true,
        form_type,
        search,
        page = 1,
        limit = 20,
        show_all_versions = false,
      } = request.query as any;

      const offset = (page - 1) * limit;

      // Build WHERE conditions
      const conditions: any[] = [
        // RBAC check - user must have view permission (0) on form entity
        sql`(
          EXISTS (
            SELECT 1 FROM app.entity_id_rbac_map rbac
            WHERE rbac.empid = ${userId}
              AND rbac.entity = 'form'
              AND (rbac.entity_id = f.id::text OR rbac.entity_id = 'all')
              AND rbac.active_flag = true
              AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
              AND 0 = ANY(rbac.permission)
          )
        )`
      ];

      if (active_flag !== undefined) {
        conditions.push(sql`f.active_flag = ${active_flag}`);
      }

      if (form_type) {
        conditions.push(sql`f.form_type = ${form_type}`);
      }

      if (search) {
        conditions.push(sql`(
          f.name ILIKE ${`%${search}%`} OR
          f.descr ILIKE ${`%${search}%`}
        )`);
      }

      if (show_all_versions) {
        // Show all versions - simple query
        const countResult = await db.execute(sql`
          SELECT COUNT(*) as total
          FROM app.d_form_head f
          ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        `);
        const total = Number(countResult[0]?.total || 0);

        const forms = await db.execute(sql`
          SELECT
            f.id,
            f.slug,
            f.code,
            f.name,
            f.descr,
            f.internal_url,
            f.shared_url,
            f.form_type,
            f.form_schema,
            f.from_ts,
            f.to_ts,
            f.active_flag,
            f.created_ts,
            f.updated_ts,
            f.version
          FROM app.d_form_head f
          ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
          ORDER BY f.slug ASC, f.version DESC
          LIMIT ${limit} OFFSET ${offset}
        `);

        return { data: forms, total, limit, offset };
      } else {
        // Show only latest version (highest version per slug/code group)
        // Use DISTINCT ON to get one row per slug with max version
        const countResult = await db.execute(sql`
          SELECT COUNT(*) as total
          FROM (
            SELECT DISTINCT ON (f.slug) f.id
            FROM app.d_form_head f
            ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
            ORDER BY f.slug, f.version DESC
          ) subq
        `);
        const total = Number(countResult[0]?.total || 0);

        const forms = await db.execute(sql`
          SELECT DISTINCT ON (f.slug)
            f.id,
            f.slug,
            f.code,
            f.name,
            f.descr,
            f.internal_url,
            f.shared_url,
            f.form_type,
            f.form_schema,
            f.from_ts,
            f.to_ts,
            f.active_flag,
            f.created_ts,
            f.updated_ts,
            f.version
          FROM app.d_form_head f
          ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
          ORDER BY f.slug, f.version DESC
          LIMIT ${limit} OFFSET ${offset}
        `);

        return { data: forms, total, limit, offset };
      }
    } catch (error) {
      fastify.log.error('Error fetching forms: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get all versions of a form by slug
  fastify.get('/api/v1/form/versions/:slug', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
      }),
      response: {
        200: Type.Object({
          data: Type.Array(FormSchema),
          latestVersion: Type.Number(),
        }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { slug } = request.params as { slug: string };

      const forms = await db.execute(sql`
        SELECT
          f.id,
          f.slug,
          f.code,
          f.name,
          f.descr,
          f.internal_url,
          f.shared_url,
          f.form_type,
          f.form_schema,
          f.from_ts,
          f.to_ts,
          f.active_flag,
          f.created_ts,
          f.updated_ts,
          f.version
        FROM app.d_form_head f
        WHERE f.slug = ${slug}
          AND (
            EXISTS (
              SELECT 1 FROM app.entity_id_rbac_map rbac
              WHERE rbac.empid = ${userId}
                AND rbac.entity = 'form'
                AND (rbac.entity_id = f.id::text OR rbac.entity_id = 'all')
                AND rbac.active_flag = true
                AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
                AND 0 = ANY(rbac.permission)
            )
          )
        ORDER BY f.version DESC
      `);

      if (forms.length === 0) {
        return reply.status(404).send({ error: 'Form not found or access denied' });
      }

      const latestVersion = Math.max(...forms.map((f: any) => f.version));

      return {
        data: forms,
        latestVersion,
      };
    } catch (error) {
      fastify.log.error('Error fetching form versions: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single form by ID
  fastify.get('/api/v1/form/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      response: {
        200: FormSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as { id: string };

      const forms = await db.execute(sql`
        SELECT
          f.id,
          f.slug,
          f.code,
          f.name,
          f.descr,
          f.internal_url,
          f.shared_url,
          f.form_type,
          f.form_schema,
          f.from_ts,
          f.to_ts,
          f.active_flag,
          f.created_ts,
          f.updated_ts,
          f.version
        FROM app.d_form_head f
        WHERE f.id = ${id}
          AND (
            EXISTS (
              SELECT 1 FROM app.entity_id_rbac_map rbac
              WHERE rbac.empid = ${userId}
                AND rbac.entity = 'form'
                AND (rbac.entity_id = f.id::text OR rbac.entity_id = 'all')
                AND rbac.active_flag = true
                AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
                AND 0 = ANY(rbac.permission)
            )
          )
      `);

      if (forms.length === 0) {
        return reply.status(404).send({ error: 'Form not found or access denied' });
      }

      return forms[0];
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
        // Removed schema validation - let Fastify serialize naturally
        403: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const data = request.body as any;

      // Auto-generate required fields if missing
      if (!data.name) data.name = 'Untitled';

      // Check create permission (permission 4 on 'all')
      const hasPermission = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.empid = ${userId}
          AND rbac.entity = 'form'
          AND rbac.entity_id = 'all'
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 4 = ANY(rbac.permission)
        LIMIT 1
      `);

      if (hasPermission.length === 0) {
        return reply.status(403).send({ error: 'No permission to create forms' });
      }

      // Auto-generate slug and code
      const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now();
      const code = 'FORM-' + Date.now();

      // Generate URLs for the form
      const internalUrl = data.internal_url || `/form/${slug}`;
      const sharedUrl = data.shared_url || `/form/${Math.random().toString(36).substring(2, 10)}`;

      // Insert form with minimalistic schema
      const result = await db.execute(sql`
        INSERT INTO app.d_form_head (
          slug,
          code,
          name,
          descr,
          internal_url,
          shared_url,
          form_type,
          form_schema,
          active_flag,
          version
        )
        VALUES (
          ${slug},
          ${code},
          ${data.name},
          ${data.descr || null},
          ${internalUrl},
          ${sharedUrl},
          ${data.form_type || 'multi_step'},
          ${JSON.stringify(data.form_schema || {steps: []})},
          ${data.active_flag !== false},
          ${data.version || 1}
        )
        RETURNING
          id,
          slug,
          code,
          name,
          descr,
          internal_url,
          shared_url,
          form_type,
          form_schema,
          from_ts,
          to_ts,
          active_flag,
          created_ts,
          updated_ts,
          version
      `);

      const created = result[0];

      // Register in d_entity_instance_id for global entity operations
      await db.execute(sql`
        INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
        VALUES ('form', ${created.id}::uuid, ${created.name}, ${created.code})
        ON CONFLICT (entity_type, entity_id) DO UPDATE
        SET entity_name = EXCLUDED.entity_name,
            entity_code = EXCLUDED.entity_code,
            updated_ts = NOW()
      `);

      // Auto-grant creator full permissions (0=view, 1=edit, 2=share, 3=delete, 4=create)
      await db.execute(sql`
        INSERT INTO app.entity_id_rbac_map (
          empid,
          entity,
          entity_id,
          permission,
          active_flag,
          granted_ts
        )
        VALUES (
          ${userId},
          'form',
          ${created.id}::text,
          ARRAY[0, 1, 2, 3],
          true,
          NOW()
        )
      `);

      return reply.status(201).send(created);
    } catch (error) {
      fastify.log.error('Error creating form: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update form - Creates new version if schema changes
  fastify.put('/api/v1/form/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      body: UpdateFormSchema,
      response: {
        200: FormSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as { id: string };
      const data = request.body as any;

      // Check edit permission (permission 1)
      const hasPermission = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.empid = ${userId}
          AND rbac.entity = 'form'
          AND (rbac.entity_id = ${id}::text OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 1 = ANY(rbac.permission)
        LIMIT 1
      `);

      if (hasPermission.length === 0) {
        return reply.status(403).send({ error: 'No permission to edit this form' });
      }

      // Get current form data
      const currentForm = await db.execute(sql`
        SELECT id, code, name, descr, form_type, form_schema, internal_url, shared_url, active_flag, version
        FROM app.d_form_head
        WHERE id = ${id}
      `);

      if (currentForm.length === 0) {
        return reply.status(404).send({ error: 'Form not found' });
      }

      const current = currentForm[0] as any;

      // Detect if meaningful changes occurred (schema changes trigger versioning)
      const schemaChanged = data.form_schema !== undefined &&
        JSON.stringify(data.form_schema) !== JSON.stringify(current.form_schema);

      const hasSubstantiveChanges = schemaChanged;

      if (hasSubstantiveChanges) {
        // IN-PLACE VERSION UPDATE: Keep same ID, increment version
        const newVersion = (current.version || 1) + 1;

        const result = await db.execute(sql`
          UPDATE app.d_form_head
          SET
            name = ${data.name !== undefined ? data.name : current.name},
            descr = ${data.descr !== undefined ? data.descr : current.descr},
            form_type = ${data.form_type !== undefined ? data.form_type : current.form_type},
            form_schema = ${JSON.stringify(data.form_schema)},
            version = ${newVersion},
            updated_ts = NOW()
          WHERE id = ${id}
          RETURNING
            id,
            slug,
            code,
            name,
            descr,
            internal_url,
            shared_url,
            form_type,
            form_schema,
            from_ts,
            to_ts,
            active_flag,
            created_ts,
            updated_ts,
            version
        `);

        fastify.log.info(`Updated form to version ${newVersion}: ${id}`);

        return result[0];
      } else {
        // IN-PLACE UPDATE: No schema changes, just update metadata
        const updateFields: any[] = [];

        if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
        if (data.descr !== undefined) updateFields.push(sql`descr = ${data.descr}`);
        if (data.form_type !== undefined) updateFields.push(sql`form_type = ${data.form_type}`);
        if (data.active_flag !== undefined) updateFields.push(sql`active_flag = ${data.active_flag}`);

        // Always update timestamp
        updateFields.push(sql`updated_ts = NOW()`);

        if (updateFields.length === 1) {
          return reply.status(400).send({ error: 'No fields to update' });
        }

        const result = await db.execute(sql`
          UPDATE app.d_form_head
          SET ${sql.join(updateFields, sql`, `)}
          WHERE id = ${id}
          RETURNING
            id,
            slug,
            code,
            name,
            descr,
            internal_url,
            shared_url,
            form_type,
            form_schema,
            from_ts,
            to_ts,
            active_flag,
            created_ts,
            updated_ts,
            version
        `);

        if (result.length === 0) {
          return reply.status(404).send({ error: 'Form not found' });
        }

        return result[0];
      }
    } catch (error) {
      fastify.log.error('Error updating form: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single form submission by ID
  fastify.get('/api/v1/form/:id/data/:submissionId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String(),
        submissionId: Type.String(),
      }),
    },
  }, async (request, reply) => {
    try {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id, submissionId } = request.params as { id: string; submissionId: string };

      fastify.log.info(`GET /form/${id}/data/${submissionId} - User: ${userId}`);

      // Check view permission on form
      const hasPermission = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.empid = ${userId}::uuid
          AND rbac.entity = 'form'
          AND (rbac.entity_id = ${id}::text OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 0 = ANY(rbac.permission)
        LIMIT 1
      `);

      fastify.log.info(`Permission check returned ${hasPermission.length} results`);

      if (hasPermission.length === 0) {
        fastify.log.warn(`No permission for user ${userId} to view form ${id}`);
        return reply.status(403).send({ error: 'No permission to view this form' });
      }

      // Get specific submission
      fastify.log.info(`Fetching submission: formId=${id}, submissionId=${submissionId}`);

      const formData = await db.execute(sql`
        SELECT
          fd.id::text,
          fd.form_id::text,
          fd.submission_data,
          fd.submission_status,
          fd.stage,
          fd.submitted_by_empid::text,
          fd.submission_ip_address,
          fd.submission_user_agent,
          fd.approval_status,
          fd.approved_by_empid::text,
          fd.approval_notes,
          fd.approved_ts,
          fd.created_ts,
          fd.updated_ts
        FROM app.d_form_data fd
        WHERE fd.form_id = ${id}::uuid
          AND fd.id = ${submissionId}::uuid
        LIMIT 1
      `);

      fastify.log.info(`Query returned ${formData.length} results`);
      if (formData.length > 0) {
        fastify.log.info(`Submission found with ID: ${formData[0].id}`);
      }

      if (formData.length === 0) {
        fastify.log.warn(`Submission not found: formId=${id}, submissionId=${submissionId}`);
        return reply.status(404).send({ error: 'Submission not found' });
      }

      const result = formData[0] as any;

      // Parse JSONB fields if they're strings
      if (result.submission_data && typeof result.submission_data === 'string') {
        try {
          result.submission_data = JSON.parse(result.submission_data);
        } catch (e) {
          fastify.log.warn('Failed to parse submission_data JSON');
        }
      }

      fastify.log.info(`Returning submission data with ${Object.keys(result).length} fields`);
      fastify.log.info(`Result keys: ${Object.keys(result).join(', ')}`);
      fastify.log.info(`submission_data type: ${typeof result.submission_data}`);

      // Explicitly return with reply.send to ensure proper serialization
      return reply.status(200).send(result);
    } catch (error) {
      fastify.log.error('Error fetching form submission: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get form data (submissions)
  fastify.get('/api/v1/form/:id/data', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      querystring: Type.Object({
        page: Type.Optional(Type.Number({ minimum: 1 })),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        status: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(Type.Any()),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
        }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as { id: string };
      const { page = 1, limit = 20, status } = request.query as any;
      const offset = (page - 1) * limit;

      // Check view permission on form
      const hasPermission = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.empid = ${userId}
          AND rbac.entity = 'form'
          AND (rbac.entity_id = ${id}::text OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 0 = ANY(rbac.permission)
        LIMIT 1
      `);

      if (hasPermission.length === 0) {
        return reply.status(403).send({ error: 'No permission to view this form' });
      }

      // Build WHERE conditions
      const conditions: any[] = [sql`fd.form_id = ${id}`];

      if (status) {
        conditions.push(sql`fd.submission_status = ${status}`);
      }

      // Count total
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_form_data fd
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      // Get paginated results
      const formData = await db.execute(sql`
        SELECT
          fd.id,
          fd.form_id,
          fd.submission_data,
          fd.submission_status,
          fd.stage,
          fd.submitted_by_empid,
          fd.submission_ip_address,
          fd.submission_user_agent,
          fd.approval_status,
          fd.approved_by_empid,
          fd.approval_notes,
          fd.approved_ts,
          fd.created_ts,
          fd.updated_ts
        FROM app.d_form_data fd
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY fd.created_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return {
        data: formData,
        total,
        limit,
        offset,
      };
    } catch (error) {
      fastify.log.error('Error fetching form data: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update form submission
  fastify.put('/api/v1/form/:id/data/:submissionId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String(),
        submissionId: Type.String(),
      }),
      body: Type.Object({
        submissionData: Type.Any(),
        submissionStatus: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          id: Type.String(),
          message: Type.String()
        }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id, submissionId } = request.params as { id: string; submissionId: string };
      const data = request.body as any;

      // Check edit permission on form (permission 1)
      const hasPermission = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.empid = ${userId}
          AND rbac.entity = 'form'
          AND (rbac.entity_id = ${id}::text OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 1 = ANY(rbac.permission)
        LIMIT 1
      `);

      if (hasPermission.length === 0) {
        return reply.status(403).send({ error: 'No permission to edit this form submission' });
      }

      // Verify submission exists
      const existingSubmission = await db.execute(sql`
        SELECT id FROM app.d_form_data
        WHERE id = ${submissionId} AND form_id = ${id}
        LIMIT 1
      `);

      if (existingSubmission.length === 0) {
        return reply.status(404).send({ error: 'Submission not found' });
      }

      // Update submission
      await db.execute(sql`
        UPDATE app.d_form_data
        SET
          submission_data = ${JSON.stringify(data.submissionData || {})},
          submission_status = ${data.submissionStatus || 'submitted'},
          updated_ts = NOW()
        WHERE id = ${submissionId}
          AND form_id = ${id}
      `);

      return reply.status(200).send({
        id: submissionId,
        message: 'Form submission updated successfully'
      });
    } catch (error) {
      fastify.log.error('Error updating form submission: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Submit form (authenticated)
  fastify.post('/api/v1/form/:id/submit', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      body: Type.Object({
        submissionData: Type.Any(),
        submissionStatus: Type.Optional(Type.String()),
      }),
      response: {
        201: Type.Object({
          id: Type.String(),
          message: Type.String()
        }),
        404: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as { id: string };
      const data = request.body as any;

      // Check view permission on form
      const hasPermission = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.empid = ${userId}
          AND rbac.entity = 'form'
          AND (rbac.entity_id = ${id}::text OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 0 = ANY(rbac.permission)
        LIMIT 1
      `);

      if (hasPermission.length === 0) {
        return reply.status(403).send({ error: 'No permission to submit this form' });
      }

      // Verify form exists and is active
      const forms = await db.execute(sql`
        SELECT id FROM app.d_form_head
        WHERE id = ${id} AND active_flag = true
      `);

      if (forms.length === 0) {
        return reply.status(404).send({ error: 'Form not found or not active' });
      }

      // Create submission with user ID
      const result = await db.execute(sql`
        INSERT INTO app.d_form_data (
          form_id,
          submission_data,
          submission_status,
          submitted_by_empid,
          submission_ip_address,
          submission_user_agent,
          stage
        )
        VALUES (
          ${id},
          ${JSON.stringify(data.submissionData || {})},
          ${data.submissionStatus || 'submitted'},
          ${userId}::uuid,
          ${request.ip || null},
          ${request.headers['user-agent'] || null},
          'saved'
        )
        RETURNING id
      `);

      return reply.status(201).send({
        id: result[0].id,
        message: 'Form submitted successfully'
      });
    } catch (error) {
      fastify.log.error('Error submitting form: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // PUBLIC ENDPOINTS - No authentication required

  // Get public form (no auth required)
  fastify.get('/api/v1/public/form/:id', {
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      response: {
        200: FormSchema,
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const forms = await db.execute(sql`
        SELECT
          f.id,
          f.slug,
          f.code,
          f.name,
          f.descr,
          f.internal_url,
          f.shared_url,
          f.form_type,
          f.form_schema,
          f.from_ts,
          f.to_ts,
          f.active_flag,
          f.created_ts,
          f.updated_ts,
          f.version
        FROM app.d_form_head f
        WHERE f.id = ${id}
          AND f.active_flag = true
      `);

      if (forms.length === 0) {
        return reply.status(404).send({ error: 'Form not found or not publicly accessible' });
      }

      return forms[0];
    } catch (error) {
      fastify.log.error('Error fetching public form: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Submit public form (no auth required)
  fastify.post('/api/v1/public/form/:id/submit', {
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      body: Type.Object({
        submissionData: Type.Any(),
        submissionStatus: Type.Optional(Type.String()),
      }),
      response: {
        201: Type.Object({
          id: Type.String(),
          message: Type.String()
        }),
        404: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = request.body as any;

      // Verify form exists and is active
      const forms = await db.execute(sql`
        SELECT id FROM app.d_form_head
        WHERE id = ${id} AND active_flag = true
      `);

      if (forms.length === 0) {
        return reply.status(404).send({ error: 'Form not found or not publicly accessible' });
      }

      // Create anonymous submission
      const result = await db.execute(sql`
        INSERT INTO app.d_form_data (
          form_id,
          submission_data,
          submission_status,
          submitted_by_empid,
          submission_ip_address,
          submission_user_agent,
          stage
        )
        VALUES (
          ${id},
          ${JSON.stringify(data.submissionData || {})},
          ${data.submissionStatus || 'submitted'},
          '00000000-0000-0000-0000-000000000000'::uuid,
          ${request.ip || null},
          ${request.headers['user-agent'] || null},
          'saved'
        )
        RETURNING id
      `);

      return reply.status(201).send({
        id: result[0].id,
        message: 'Form submitted successfully'
      });
    } catch (error) {
      fastify.log.error('Error submitting public form: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Soft delete form
  fastify.delete('/api/v1/form/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      response: {
        200: Type.Object({ message: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as { id: string };

      // Check delete permission (permission 3)
      const hasPermission = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.empid = ${userId}
          AND rbac.entity = 'form'
          AND (rbac.entity_id = ${id}::text OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 3 = ANY(rbac.permission)
        LIMIT 1
      `);

      if (hasPermission.length === 0) {
        return reply.status(403).send({ error: 'No permission to delete this form' });
      }

      // Soft delete - set active_flag = false and to_ts = NOW()
      const result = await db.execute(sql`
        UPDATE app.d_form_head
        SET active_flag = false, to_ts = NOW(), updated_ts = NOW()
        WHERE id = ${id} AND active_flag = true
        RETURNING id
      `);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Form not found or already deleted' });
      }

      return { message: 'Form deleted successfully' };
    } catch (error) {
      fastify.log.error('Error deleting form: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
