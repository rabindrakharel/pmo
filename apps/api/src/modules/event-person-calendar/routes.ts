/**
 * Event-Person-Calendar API Routes
 * Manages event-person mappings with RSVP tracking
 * @module event-person-calendar/routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { client, db } from '../../db/index.js';
import type {
  CreateEventPersonCalendarRequest,
  UpdateEventPersonCalendarRequest
} from './types.js';
import { paginateQuery, getPaginationParams } from '../../lib/pagination.js';

/**
 * Register event-person-calendar routes
 */
export async function eventPersonCalendarRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/event-person-calendar
   * Get all event-person mappings with optional filters
   */
  fastify.get<{
    Querystring: {
      event_id?: string;
      person_entity_type?: string;
      person_id?: string;
      event_rsvp_status?: string;
      page?: number;
      limit?: number;
    };
  }>('/api/v1/event-person-calendar', async (request, reply) => {
    try {
      const { event_id, person_entity_type, person_id, event_rsvp_status } = request.query;
      const { page, limit, offset } = getPaginationParams(request.query);

      let whereConditions = client`WHERE active_flag = true`;

      if (event_id) {
        whereConditions = client`${whereConditions} AND event_id = ${event_id}::uuid`;
      }

      if (person_entity_type) {
        whereConditions = client`${whereConditions} AND person_entity_type = ${person_entity_type}`;
      }

      if (person_id) {
        whereConditions = client`${whereConditions} AND person_id = ${person_id}::uuid`;
      }

      if (event_rsvp_status) {
        whereConditions = client`${whereConditions} AND event_rsvp_status = ${event_rsvp_status}`;
      }

      const dataQuery = client`
        SELECT
          id::text,
          code,
          name,
          descr,
          person_entity_type,
          person_id::text,
          event_id::text,
          event_rsvp_status,
          from_ts::text,
          to_ts::text,
          timezone,
          metadata,
          active_flag,
          created_ts::text,
          updated_ts::text,
          version
        FROM app.entity_event_person_calendar
        ${whereConditions}
        ORDER BY from_ts ASC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      const countQuery = client`
        SELECT COUNT(*) as total
        FROM app.entity_event_person_calendar
        ${whereConditions}
      `;

      const result = await paginateQuery(dataQuery, countQuery, page, limit);
      reply.code(200).send(result);
    } catch (error) {
      console.error('Error fetching event-person mappings:', error);
      reply.code(500).send({ error: 'Failed to fetch event-person mappings' });
    }
  });

  /**
   * GET /api/v1/event-person-calendar/:id
   * Get event-person mapping by ID
   */
  fastify.get<{
    Params: { id: string };
  }>('/api/v1/event-person-calendar/:id', async (request, reply) => {
    try {
      const { id } = request.params;

      const query = client`
        SELECT
          id::text,
          code,
          name,
          descr,
          person_entity_type,
          person_id::text,
          event_id::text,
          event_rsvp_status,
          from_ts::text,
          to_ts::text,
          timezone,
          metadata,
          active_flag,
          created_ts::text,
          updated_ts::text,
          version
        FROM app.entity_event_person_calendar
        WHERE id = ${id}::uuid AND active_flag = true
      `;

      const result = await query;

      if (result.length === 0) {
        return reply.code(404).send({ error: 'Event-person mapping not found' });
      }

      reply.code(200).send(result[0]);
    } catch (error) {
      console.error('Error fetching event-person mapping:', error);
      reply.code(500).send({ error: 'Failed to fetch event-person mapping' });
    }
  });

  /**
   * GET /api/v1/person/:personId/events
   * Get all events for a specific person
   */
  fastify.get<{
    Params: { personId: string };
    Querystring: {
      person_entity_type?: string;
      event_rsvp_status?: string;
      from_ts?: string;
    };
  }>('/api/v1/person/:personId/events', async (request, reply) => {
    try {
      const { personId } = request.params;
      const { person_entity_type, event_rsvp_status, from_ts } = request.query;

      let whereConditions = client`
        WHERE epc.person_id = ${personId}::uuid
          AND epc.active_flag = true
          AND e.active_flag = true
      `;

      if (person_entity_type) {
        whereConditions = client`${whereConditions} AND epc.person_entity_type = ${person_entity_type}`;
      }

      if (event_rsvp_status) {
        whereConditions = client`${whereConditions} AND epc.event_rsvp_status = ${event_rsvp_status}`;
      }

      if (from_ts) {
        whereConditions = client`${whereConditions} AND e.from_ts >= ${from_ts}::timestamptz`;
      }

      const query = client`
        SELECT
          e.id::text as event_id,
          e.code as event_code,
          e.name as event_name,
          e.descr as event_descr,
          e.event_type,
          e.event_platform_provider_name,
          e.event_addr,
          e.event_instructions,
          e.from_ts::text as event_from_ts,
          e.to_ts::text as event_to_ts,
          e.timezone as event_timezone,
          epc.id::text as mapping_id,
          epc.event_rsvp_status,
          epc.from_ts::text as person_from_ts,
          epc.to_ts::text as person_to_ts
        FROM app.entity_event_person_calendar epc
        JOIN app.event e ON e.id = epc.event_id
        ${whereConditions}
        ORDER BY e.from_ts ASC
      `;

      const events = await query;

      reply.code(200).send({
        person_id: personId,
        total_events: events.length,
        events
      });
    } catch (error) {
      console.error('Error fetching person events:', error);
      reply.code(500).send({ error: 'Failed to fetch person events' });
    }
  });

  /**
   * POST /api/v1/event-person-calendar
   * Create a new event-person mapping (invite person to event)
   */
  fastify.post<{
    Body: CreateEventPersonCalendarRequest;
  }>('/api/v1/event-person-calendar', async (request, reply) => {
    try {
      const mapping = request.body;

      const insertQuery = client`
        INSERT INTO app.entity_event_person_calendar (
          code,
          name,
          descr,
          person_entity_type,
          person_id,
          event_id,
          event_rsvp_status,
          from_ts,
          to_ts,
          timezone,
          metadata
        ) VALUES (
          ${mapping.code},
          ${mapping.name || null},
          ${mapping.descr || null},
          ${mapping.person_entity_type},
          ${mapping.person_id}::uuid,
          ${mapping.event_id}::uuid,
          ${mapping.event_rsvp_status || 'pending'},
          ${mapping.from_ts}::timestamptz,
          ${mapping.to_ts}::timestamptz,
          ${mapping.timezone || 'America/Toronto'},
          ${mapping.metadata ? JSON.stringify(mapping.metadata) : '{}'}::jsonb
        )
        RETURNING
          id::text,
          code,
          person_entity_type,
          person_id::text,
          event_id::text,
          event_rsvp_status,
          created_ts::text
      `;

      const result = await insertQuery;
      const newMapping = result[0];

      // Register in entity_instance registry (using correct column names)
      await client`
        INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
        VALUES ('event_person_calendar', ${newMapping.id}::uuid, ${mapping.name || mapping.code}, ${mapping.code})
        ON CONFLICT (entity_code, entity_instance_id) DO UPDATE
        SET entity_instance_name = EXCLUDED.entity_instance_name,
            code = EXCLUDED.code,
            updated_ts = now()
      `;

      console.log(`✅ Created event-person mapping: ${newMapping.code}`);

      reply.code(201).send(newMapping);
    } catch (error) {
      console.error('Error creating event-person mapping:', error);
      reply.code(500).send({ error: 'Failed to create event-person mapping' });
    }
  });

  /**
   * PATCH /api/v1/event-person-calendar/:id
   * Update event-person mapping (typically to change RSVP status)
   */
  fastify.patch<{
    Params: { id: string };
    Body: UpdateEventPersonCalendarRequest;
  }>('/api/v1/event-person-calendar/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const updates = request.body;

      const updateQuery = client`
        UPDATE app.entity_event_person_calendar
        SET
          name = COALESCE(${updates.name !== undefined ? updates.name : null}, name),
          descr = COALESCE(${updates.descr !== undefined ? updates.descr : null}, descr),
          event_rsvp_status = COALESCE(${updates.event_rsvp_status || null}, event_rsvp_status),
          from_ts = COALESCE(${updates.from_ts ? `${updates.from_ts}::timestamptz` : null}, from_ts),
          to_ts = COALESCE(${updates.to_ts ? `${updates.to_ts}::timestamptz` : null}, to_ts),
          timezone = COALESCE(${updates.timezone || null}, timezone),
          metadata = COALESCE(${updates.metadata ? JSON.stringify(updates.metadata) : null}::jsonb, metadata),
          updated_ts = now(),
          version = version + 1
        WHERE id = ${id}::uuid AND active_flag = true
        RETURNING
          id::text,
          code,
          event_rsvp_status,
          updated_ts::text
      `;

      const result = await updateQuery;

      if (result.length === 0) {
        return reply.code(404).send({ error: 'Event-person mapping not found' });
      }

      console.log(`✅ Updated event-person mapping: ${result[0].code} (RSVP: ${result[0].event_rsvp_status})`);

      reply.code(200).send(result[0]);
    } catch (error) {
      console.error('Error updating event-person mapping:', error);
      reply.code(500).send({ error: 'Failed to update event-person mapping' });
    }
  });

  /**
   * PATCH /api/v1/event-person-calendar/:id/rsvp
   * Update RSVP status for an event-person mapping
   */
  fastify.patch<{
    Params: { id: string };
    Body: {
      event_rsvp_status: 'pending' | 'accepted' | 'declined';
    };
  }>('/api/v1/event-person-calendar/:id/rsvp', async (request, reply) => {
    try {
      const { id } = request.params;
      const { event_rsvp_status } = request.body;

      if (!['pending', 'accepted', 'declined'].includes(event_rsvp_status)) {
        return reply.code(400).send({
          error: 'Invalid RSVP status. Must be one of: pending, accepted, declined'
        });
      }

      const updateQuery = client`
        UPDATE app.entity_event_person_calendar
        SET
          event_rsvp_status = ${event_rsvp_status},
          updated_ts = now(),
          version = version + 1
        WHERE id = ${id}::uuid AND active_flag = true
        RETURNING
          id::text,
          code,
          person_entity_type,
          person_id::text,
          event_id::text,
          event_rsvp_status,
          updated_ts::text
      `;

      const result = await updateQuery;

      if (result.length === 0) {
        return reply.code(404).send({ error: 'Event-person mapping not found' });
      }

      console.log(`✅ Updated RSVP status: ${result[0].code} → ${event_rsvp_status}`);

      reply.code(200).send({
        success: true,
        ...result[0]
      });
    } catch (error) {
      console.error('Error updating RSVP status:', error);
      reply.code(500).send({ error: 'Failed to update RSVP status' });
    }
  });

  /**
   * DELETE /api/v1/event-person-calendar/:id
   * Soft delete event-person mapping (remove person from event)
   */
  fastify.delete<{
    Params: { id: string };
  }>('/api/v1/event-person-calendar/:id', async (request, reply) => {
    try {
      const { id } = request.params;

      const deleteQuery = client`
        UPDATE app.entity_event_person_calendar
        SET
          active_flag = false,
          updated_ts = now()
        WHERE id = ${id}::uuid AND active_flag = true
        RETURNING id::text, code
      `;

      const result = await deleteQuery;

      if (result.length === 0) {
        return reply.code(404).send({ error: 'Event-person mapping not found' });
      }

      console.log(`✅ Deleted event-person mapping: ${result[0].code}`);

      reply.code(200).send({
        success: true,
        message: 'Event-person mapping deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting event-person mapping:', error);
      reply.code(500).send({ error: 'Failed to delete event-person mapping' });
    }
  });

  console.log('✅ Event-Person-Calendar routes registered');
}

export default eventPersonCalendarRoutes;
