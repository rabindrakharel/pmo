import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { eq, and, isNull, desc, asc, sql } from 'drizzle-orm';

const FormSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  formGlobalLink: Type.Optional(Type.String()),
  projectSpecific: Type.Optional(Type.Boolean()),
  projectId: Type.Optional(Type.String()),
  taskSpecific: Type.Optional(Type.Boolean()),
  taskId: Type.Optional(Type.String()),
  locationSpecific: Type.Optional(Type.Boolean()),
  locationId: Type.Optional(Type.String()),
  businessSpecific: Type.Optional(Type.Boolean()),
  businessId: Type.Optional(Type.String()),
  hrSpecific: Type.Optional(Type.Boolean()),
  hrId: Type.Optional(Type.String()),
  worksiteSpecific: Type.Optional(Type.Boolean()),
  worksiteId: Type.Optional(Type.String()),
  version: Type.Optional(Type.Number()),
  active: Type.Boolean(),
  fromTs: Type.String(),
  toTs: Type.Optional(Type.String()),
  created: Type.String(),
  updated: Type.String(),
  tags: Type.Optional(Type.Array(Type.String())),
  schema: Type.Optional(Type.Any()),
  attr: Type.Optional(Type.Any()),
});

const CreateFormSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  formGlobalLink: Type.Optional(Type.String()),
  projectSpecific: Type.Optional(Type.Boolean()),
  projectId: Type.Optional(Type.String()),
  taskSpecific: Type.Optional(Type.Boolean()),
  taskId: Type.Optional(Type.String()),
  locationSpecific: Type.Optional(Type.Boolean()),
  locationId: Type.Optional(Type.String()),
  businessSpecific: Type.Optional(Type.Boolean()),
  businessId: Type.Optional(Type.String()),
  hrSpecific: Type.Optional(Type.Boolean()),
  hrId: Type.Optional(Type.String()),
  worksiteSpecific: Type.Optional(Type.Boolean()),
  worksiteId: Type.Optional(Type.String()),
  version: Type.Optional(Type.Number()),
  active: Type.Optional(Type.Boolean()),
  fromTs: Type.Optional(Type.String({ format: 'date-time' })),
  tags: Type.Optional(Type.Array(Type.String())),
  schema: Type.Optional(Type.Any()),
  attr: Type.Optional(Type.Any()),
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
        projectSpecific: Type.Optional(Type.Boolean()),
        taskSpecific: Type.Optional(Type.Boolean()),
        locationSpecific: Type.Optional(Type.Boolean()),
        businessSpecific: Type.Optional(Type.Boolean()),
        hrSpecific: Type.Optional(Type.Boolean()),
        worksiteSpecific: Type.Optional(Type.Boolean()),
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
      projectSpecific,
      taskSpecific,
      locationSpecific,
      businessSpecific,
      hrSpecific,
      worksiteSpecific,
      limit = 50, 
      offset = 0 
    } = request.query as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };

    try {
      // Build query conditions
      const conditions = [];
      
      if (version !== undefined) {
        conditions.push(sql`version = ${version}`);
      }
      
      if (active !== undefined) {
        conditions.push(sql`active = ${active}`);
      }
      
      if (projectSpecific !== undefined) {
        conditions.push(sql`project_specific = ${projectSpecific}`);
      }
      
      if (taskSpecific !== undefined) {
        conditions.push(sql`task_specific = ${taskSpecific}`);
      }
      
      if (locationSpecific !== undefined) {
        conditions.push(sql`location_specific = ${locationSpecific}`);
      }
      
      if (businessSpecific !== undefined) {
        conditions.push(sql`business_specific = ${businessSpecific}`);
      }
      
      if (hrSpecific !== undefined) {
        conditions.push(sql`hr_specific = ${hrSpecific}`);
      }
      
      if (worksiteSpecific !== undefined) {
        conditions.push(sql`worksite_specific = ${worksiteSpecific}`);
      }

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total 
        FROM app.ops_formlog_head 
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      // Get paginated results
      const forms = await db.execute(sql`
        SELECT 
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
          attr
        FROM app.ops_formlog_head 
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY name ASC, version DESC
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
      return reply.status(401).send({ error: 'Invalid token' });
    };

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
          attr
        FROM app.ops_formlog_head 
        WHERE id = ${id} AND active = true
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
      return reply.status(401).send({ error: 'Invalid token' });
    };

    try {
      // Check for unique name and version combination
      const existingForm = await db.execute(sql`
        SELECT id FROM app.ops_formlog_head 
        WHERE name = ${data.name} AND version = ${data.version || 1} AND active = true
      `);
      if (existingForm.length > 0) {
        return reply.status(400).send({ error: 'Form with this name and version already exists' });
      }

      const fromTs = data.fromTs || new Date().toISOString();
      
      const result = await db.execute(sql`
        INSERT INTO app.ops_formlog_head (
          name, "descr", form_global_link,
          project_specific, project_id,
          task_specific, task_id,
          location_specific, location_id,
          business_specific, business_id,
          hr_specific, hr_id,
          worksite_specific, worksite_id,
          version, active, from_ts, tags, schema, attr
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
          ${JSON.stringify(data.attr || {})}
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
          attr
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
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };

    try {
      // Check if form exists
      const existing = await db.execute(sql`
        SELECT id FROM app.ops_formlog_head WHERE id = ${id} AND active = true
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Form not found' });
      }

      // Check for unique name and version combination on update
      if (data.name && data.version) {
        const existingNameVersion = await db.execute(sql`
          SELECT id FROM app.ops_formlog_head 
          WHERE name = ${data.name} AND version = ${data.version} AND active = true AND id != ${id}
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
      
      if (data.formGlobalLink !== undefined) {
        updateFields.push(sql`form_global_link = ${data.formGlobalLink}`);
      }
      
      if (data.projectSpecific !== undefined) {
        updateFields.push(sql`project_specific = ${data.projectSpecific}`);
      }
      if (data.projectId !== undefined) {
        updateFields.push(sql`project_id = ${data.projectId}`);
      }
      
      if (data.taskSpecific !== undefined) {
        updateFields.push(sql`task_specific = ${data.taskSpecific}`);
      }
      if (data.taskId !== undefined) {
        updateFields.push(sql`task_id = ${data.taskId}`);
      }
      
      if (data.locationSpecific !== undefined) {
        updateFields.push(sql`location_specific = ${data.locationSpecific}`);
      }
      if (data.locationId !== undefined) {
        updateFields.push(sql`location_id = ${data.locationId}`);
      }
      
      if (data.businessSpecific !== undefined) {
        updateFields.push(sql`business_specific = ${data.businessSpecific}`);
      }
      if (data.businessId !== undefined) {
        updateFields.push(sql`business_id = ${data.businessId}`);
      }
      
      if (data.hrSpecific !== undefined) {
        updateFields.push(sql`hr_specific = ${data.hrSpecific}`);
      }
      if (data.hrId !== undefined) {
        updateFields.push(sql`hr_id = ${data.hrId}`);
      }
      
      if (data.worksiteSpecific !== undefined) {
        updateFields.push(sql`worksite_specific = ${data.worksiteSpecific}`);
      }
      if (data.worksiteId !== undefined) {
        updateFields.push(sql`worksite_id = ${data.worksiteId}`);
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
        updateFields.push(sql`active = ${data.active}`);
      }

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.ops_formlog_head 
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
          attr
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
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };

    try {
      // Check if form exists
      const existing = await db.execute(sql`
        SELECT id FROM app.ops_formlog_head WHERE id = ${id} AND active = true
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Form not found' });
      }

      // Check if form has submitted records
      const submittedRecords = await db.execute(sql`
        SELECT COUNT(*) as count FROM app.ops_formlog_records WHERE head_id = ${id} AND active = true
      `);
      
      if (Number(submittedRecords[0]?.count || 0) > 0) {
        return reply.status(400).send({ error: 'Cannot delete form that has submitted records' });
      }

      // Soft delete
      await db.execute(sql`
        UPDATE app.ops_formlog_head 
        SET active = false, to_ts = NOW(), updated = NOW()
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
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };

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
          attr
        FROM app.ops_formlog_head 
        WHERE id = ${id} AND active = true
      `);

      if (form.length === 0) {
        return reply.status(404).send({ error: 'Form not found' });
      }

      // Get total count of records
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total 
        FROM app.ops_formlog_records 
        WHERE head_id = ${id} AND active = true
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
        WHERE head_id = ${id} AND active = true
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
