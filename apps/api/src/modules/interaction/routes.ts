/**
 * Customer Interaction API Routes
 * Handles omnichannel customer interactions with S3 storage support
 * @module interaction/routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import type { Interaction, CreateInteractionRequest, UpdateInteractionRequest } from './types.js';

// Schema definitions
const InteractionSchema = Type.Object({
  id: Type.String(),
  interaction_number: Type.String(),
  interaction_type: Type.String(),
  interaction_subtype: Type.Optional(Type.String()),
  channel: Type.String(),
  chunk_number: Type.Optional(Type.Number()),
  total_chunks: Type.Optional(Type.Number()),
  parent_interaction_id: Type.Optional(Type.String()),
  is_primary_chunk: Type.Optional(Type.Boolean()),
  interaction_ts: Type.Optional(Type.String()),
  duration_seconds: Type.Optional(Type.Number()),
  interaction_person_entities: Type.Optional(Type.Any()),
  interaction_intention_entity: Type.Optional(Type.String()),
  content_format: Type.Optional(Type.String()),
  content_text: Type.Optional(Type.String()),
  content_summary: Type.Optional(Type.String()),
  transcript_text: Type.Optional(Type.String()),
  sentiment_score: Type.Optional(Type.Number()),
  sentiment_label: Type.Optional(Type.String()),
  customer_satisfaction_score: Type.Optional(Type.Number()),
  emotion_tags: Type.Optional(Type.Any()),
  interaction_reason: Type.Optional(Type.String()),
  interaction_category: Type.Optional(Type.String()),
  priority_level: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  created_ts: Type.String(),
  updated_ts: Type.String()});

const CreateInteractionSchema = Type.Object({
  interaction_number: Type.String({ minLength: 1 }),
  interaction_type: Type.String({ minLength: 1 }),
  channel: Type.String({ minLength: 1 }),
  interaction_subtype: Type.Optional(Type.String()),
  interaction_ts: Type.Optional(Type.String()),
  duration_seconds: Type.Optional(Type.Number()),
  interaction_person_entities: Type.Optional(Type.Any()),
  interaction_intention_entity: Type.Optional(Type.String()),
  content_format: Type.Optional(Type.String()),
  content_text: Type.Optional(Type.String()),
  content_summary: Type.Optional(Type.String()),
  transcript_text: Type.Optional(Type.String()),
  sentiment_score: Type.Optional(Type.Number()),
  sentiment_label: Type.Optional(Type.String()),
  customer_satisfaction_score: Type.Optional(Type.Number()),
  emotion_tags: Type.Optional(Type.Any()),
  interaction_reason: Type.Optional(Type.String()),
  interaction_category: Type.Optional(Type.String()),
  priority_level: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any())});

const UpdateInteractionSchema = Type.Partial(CreateInteractionSchema);

/**
 * Register interaction routes
 */
export async function interactionRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/interaction
   * List all interactions with filtering
   */
  fastify.get('/api/v1/interaction', {
    schema: {
      querystring: Type.Object({
        interaction_type: Type.Optional(Type.String()),
        channel: Type.Optional(Type.String()),
        sentiment_label: Type.Optional(Type.String()),
        priority_level: Type.Optional(Type.String()),
        from_date: Type.Optional(Type.String()),
        to_date: Type.Optional(Type.String()),
        search: Type.Optional(Type.String()),
        page: Type.Optional(Type.Number({ minimum: 1 })),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 }))})}}, async (request, reply) => {
    const {
      interaction_type,
      channel,
      sentiment_label,
      priority_level,
      from_date,
      to_date,
      search,
      page,
      limit = 20,
      offset
    } = request.query as any;

    const actualOffset = page !== undefined ? (page - 1) * limit : (offset || 0);

    try {
      const conditions = [sql`deleted_ts IS NULL`];

      if (interaction_type) {
        conditions.push(sql`interaction_type = ${interaction_type}`);
      }

      if (channel) {
        conditions.push(sql`channel = ${channel}`);
      }

      if (sentiment_label) {
        conditions.push(sql`sentiment_label = ${sentiment_label}`);
      }

      if (priority_level) {
        conditions.push(sql`priority_level = ${priority_level}`);
      }

      if (from_date) {
        conditions.push(sql`interaction_ts >= ${from_date}::timestamptz`);
      }

      if (to_date) {
        conditions.push(sql`interaction_ts <= ${to_date}::timestamptz`);
      }

      if (search) {
        conditions.push(sql`(
          interaction_number ILIKE ${`%${search}%`} OR
          content_text ILIKE ${`%${search}%`} OR
          transcript_text ILIKE ${`%${search}%`} OR
          content_summary ILIKE ${`%${search}%`}
        )`);
      }

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.f_customer_interaction
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      const interactions = await db.execute(sql`
        SELECT
          id,
          interaction_number,
          interaction_type,
          interaction_subtype,
          channel,
          chunk_number,
          total_chunks,
          parent_interaction_id,
          is_primary_chunk,
          interaction_ts,
          duration_seconds,
          wait_time_seconds,
          talk_time_seconds,
          hold_time_seconds,
          after_call_work_seconds,
          interaction_person_entities,
          interaction_intention_entity,
          content_format,
          content_size_bytes,
          content_object_bucket,
          content_object_key,
          content_url,
          content_mime_type,
          content_text,
          content_summary,
          transcript_text,
          transcript_confidence_score,
          transcript_language,
          sentiment_score,
          sentiment_label,
          customer_satisfaction_score,
          net_promoter_score,
          emotion_tags,
          interaction_reason,
          interaction_category,
          interaction_subcategory,
          priority_level,
          consent_recorded,
          consent_type,
          source_system,
          attachment_count,
          attachment_ids,
          related_interaction_ids,
          metadata,
          created_by_employee_id,
          created_ts,
          updated_ts,
          deleted_ts,
          archived_ts
        FROM app.f_customer_interaction
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY interaction_ts DESC NULLS LAST, created_ts DESC
        LIMIT ${limit} OFFSET ${actualOffset}
      `);

      return {
        data: interactions,
        total,
        limit,
        offset: actualOffset,
        page: page || Math.floor(actualOffset / limit) + 1};
    } catch (error) {
      fastify.log.error('Error fetching interactions:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * GET /api/v1/interaction/:id
   * Get single interaction by ID
   */
  fastify.get<{
    Params: { id: string };
  }>('/api/v1/interaction/:id', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })}),
      response: {
        200: InteractionSchema,
        404: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    try {
      const { id } = request.params;

      const result = await db.execute(sql`
        SELECT
          id,
          interaction_number,
          interaction_type,
          interaction_subtype,
          channel,
          chunk_number,
          total_chunks,
          parent_interaction_id,
          is_primary_chunk,
          interaction_ts,
          duration_seconds,
          wait_time_seconds,
          talk_time_seconds,
          hold_time_seconds,
          after_call_work_seconds,
          interaction_person_entities,
          interaction_intention_entity,
          content_format,
          content_size_bytes,
          content_object_bucket,
          content_object_key,
          content_url,
          content_mime_type,
          content_text,
          content_summary,
          transcript_text,
          transcript_confidence_score,
          transcript_language,
          sentiment_score,
          sentiment_label,
          customer_satisfaction_score,
          net_promoter_score,
          emotion_tags,
          interaction_reason,
          interaction_category,
          interaction_subcategory,
          priority_level,
          consent_recorded,
          consent_type,
          source_system,
          attachment_count,
          attachment_ids,
          related_interaction_ids,
          metadata,
          created_by_employee_id,
          created_ts,
          updated_ts,
          deleted_ts,
          archived_ts
        FROM app.f_customer_interaction
        WHERE id = ${id}::uuid AND deleted_ts IS NULL
      `);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Interaction not found' });
      }

      return result[0];
    } catch (error) {
      fastify.log.error('Error fetching interaction:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * POST /api/v1/interaction
   * Create new interaction
   */
  fastify.post<{
    Body: CreateInteractionRequest;
  }>('/api/v1/interaction', {
    schema: {
      body: CreateInteractionSchema,
      response: {
        201: InteractionSchema}}}, async (request, reply) => {
    try {
      const interaction = request.body;

      const result = await db.execute(sql`
        INSERT INTO app.f_customer_interaction (
          interaction_number,
          interaction_type,
          interaction_subtype,
          channel,
          interaction_ts,
          duration_seconds,
          interaction_person_entities,
          interaction_intention_entity,
          content_format,
          content_text,
          content_summary,
          transcript_text,
          sentiment_score,
          sentiment_label,
          customer_satisfaction_score,
          emotion_tags,
          interaction_reason,
          interaction_category,
          priority_level,
          metadata,
          created_by_employee_id
        ) VALUES (
          ${interaction.interaction_number},
          ${interaction.interaction_type},
          ${interaction.interaction_subtype || null},
          ${interaction.channel},
          ${interaction.interaction_ts ? sql`${interaction.interaction_ts}::timestamptz` : sql`now()`},
          ${interaction.duration_seconds || null},
          ${interaction.interaction_person_entities ? sql`${JSON.stringify(interaction.interaction_person_entities)}::jsonb` : sql`'[]'::jsonb`},
          ${interaction.interaction_intention_entity || null},
          ${interaction.content_format || null},
          ${interaction.content_text || null},
          ${interaction.content_summary || null},
          ${interaction.transcript_text || null},
          ${interaction.sentiment_score || null},
          ${interaction.sentiment_label || null},
          ${interaction.customer_satisfaction_score || null},
          ${interaction.emotion_tags ? sql`ARRAY[${sql.join(interaction.emotion_tags.map((t: string) => sql`${t}`), sql`, `)}]::text[]` : sql`NULL`},
          ${interaction.interaction_reason || null},
          ${interaction.interaction_category || null},
          ${interaction.priority_level || 'normal'},
          ${interaction.metadata ? sql`${JSON.stringify(interaction.metadata)}::jsonb` : sql`'{}'::jsonb`},
          ${(request as any).user?.sub || null}
        )
        RETURNING
          id,
          interaction_number,
          interaction_type,
          channel,
          interaction_ts,
          created_ts,
          updated_ts
      `);

      const newInteraction = result[0];

      // Register in entity_instance_id
      await db.execute(sql`
        INSERT INTO app.d_entity_instance_registry (entity_type, entity_id, entity_name, entity_code)
        VALUES ('interaction', ${newInteraction.id}::uuid, ${interaction.interaction_number}, ${interaction.interaction_number})
        ON CONFLICT (entity_type, entity_id) DO UPDATE
        SET entity_name = EXCLUDED.entity_name,
            entity_code = EXCLUDED.entity_code,
            updated_ts = now()
      `);

      console.log(`✅ Created interaction: ${newInteraction.interaction_number}`);

      return reply.status(201).send(newInteraction);
    } catch (error) {
      fastify.log.error('Error creating interaction:', error);
      return reply.status(500).send({
        error: 'Failed to create interaction',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * PATCH /api/v1/interaction/:id
   * Update existing interaction
   */
  fastify.patch<{
    Params: { id: string };
    Body: UpdateInteractionRequest;
  }>('/api/v1/interaction/:id', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })}),
      body: UpdateInteractionSchema,
      response: {
        200: InteractionSchema,
        404: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    try {
      const { id } = request.params;
      const updates = request.body;

      // Build dynamic update query
      const updateFields = [];

      if (updates.interaction_subtype !== undefined) {
        updateFields.push(sql`interaction_subtype = ${updates.interaction_subtype}`);
      }
      if (updates.interaction_intention_entity !== undefined) {
        updateFields.push(sql`interaction_intention_entity = ${updates.interaction_intention_entity}`);
      }
      if (updates.content_summary !== undefined) {
        updateFields.push(sql`content_summary = ${updates.content_summary}`);
      }
      if (updates.transcript_text !== undefined) {
        updateFields.push(sql`transcript_text = ${updates.transcript_text}`);
      }
      if (updates.sentiment_score !== undefined) {
        updateFields.push(sql`sentiment_score = ${updates.sentiment_score}`);
      }
      if (updates.sentiment_label !== undefined) {
        updateFields.push(sql`sentiment_label = ${updates.sentiment_label}`);
      }
      if (updates.customer_satisfaction_score !== undefined) {
        updateFields.push(sql`customer_satisfaction_score = ${updates.customer_satisfaction_score}`);
      }
      if (updates.emotion_tags !== undefined) {
        updateFields.push(sql`emotion_tags = ARRAY[${sql.join(updates.emotion_tags.map((t: string) => sql`${t}`), sql`, `)}]::text[]`);
      }
      if (updates.interaction_reason !== undefined) {
        updateFields.push(sql`interaction_reason = ${updates.interaction_reason}`);
      }
      if (updates.interaction_category !== undefined) {
        updateFields.push(sql`interaction_category = ${updates.interaction_category}`);
      }
      if (updates.priority_level !== undefined) {
        updateFields.push(sql`priority_level = ${updates.priority_level}`);
      }
      if (updates.metadata !== undefined) {
        updateFields.push(sql`metadata = ${JSON.stringify(updates.metadata)}::jsonb`);
      }

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_ts = now()`);

      const result = await db.execute(sql`
        UPDATE app.f_customer_interaction
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}::uuid AND deleted_ts IS NULL
        RETURNING
          id,
          interaction_number,
          interaction_type,
          channel,
          sentiment_label,
          priority_level,
          updated_ts
      `);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Interaction not found' });
      }

      console.log(`✅ Updated interaction: ${result[0].interaction_number}`);

      return result[0];
    } catch (error) {
      fastify.log.error('Error updating interaction:', error);
      return reply.status(500).send({
        error: 'Failed to update interaction',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * DELETE /api/v1/interaction/:id
   * Soft delete interaction
   */
  fastify.delete<{
    Params: { id: string };
  }>('/api/v1/interaction/:id', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })}),
      response: {
        200: Type.Object({ success: Type.Boolean(), message: Type.String() }),
        404: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    try {
      const { id } = request.params;

      const result = await db.execute(sql`
        UPDATE app.f_customer_interaction
        SET deleted_ts = now(), updated_ts = now()
        WHERE id = ${id}::uuid AND deleted_ts IS NULL
        RETURNING id, interaction_number
      `);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Interaction not found' });
      }

      console.log(`✅ Deleted interaction: ${result[0].interaction_number}`);

      return { success: true, message: 'Interaction deleted successfully' };
    } catch (error) {
      fastify.log.error('Error deleting interaction:', error);
      return reply.status(500).send({
        error: 'Failed to delete interaction',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  console.log('✅ Interaction routes registered');
}

export default interactionRoutes;
