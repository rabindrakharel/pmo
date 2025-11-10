/**
 * Event API Routes
 * Manages events/meetings/appointments as universal parent entities
 * @module event/routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { client, db } from '../../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { paginateQuery, getPaginationParams } from '../../lib/pagination.js';

/**
 * Event creation request
 */
interface CreateEventRequest {
  code: string;
  name: string;
  descr?: string;
  event_type: 'onsite' | 'virtual';
  event_platform_provider_name: string; // 'zoom', 'teams', 'google_meet', 'physical_hall', 'office', etc.
  event_addr?: string; // Physical address OR meeting URL
  event_instructions?: string;
  from_ts: string; // ISO timestamp (event start time)
  to_ts: string; // ISO timestamp (event end time)
  timezone?: string; // Default: 'America/Toronto'
  event_metadata?: Record<string, any>;
  // Optional: Attendees to automatically create event-person mappings
  attendees?: Array<{
    person_entity_type: 'employee' | 'client' | 'customer';
    person_entity_id: string;
    event_rsvp_status?: 'pending' | 'accepted' | 'declined';
  }>;
}

/**
 * Event update request
 */
interface UpdateEventRequest {
  name?: string;
  descr?: string;
  event_type?: 'onsite' | 'virtual';
  event_platform_provider_name?: string;
  event_addr?: string;
  event_instructions?: string;
  from_ts?: string;
  to_ts?: string;
  timezone?: string;
  event_metadata?: Record<string, any>;
}

/**
 * Register event routes
 */
export async function eventRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/event
   * Get all active events with optional filters
   */
  fastify.get<{
    Querystring: {
      event_type?: string;
      event_platform_provider_name?: string;
      from_ts?: string;
      to_ts?: string;
      page?: number;
      limit?: number;
    };
  }>('/api/v1/event', async (request, reply) => {
    try {
      const { event_type, event_platform_provider_name, from_ts, to_ts } = request.query;
      const { page, limit, offset } = getPaginationParams(request.query);

      let whereConditions = client`WHERE active_flag = true`;

      if (event_type) {
        whereConditions = client`${whereConditions} AND event_type = ${event_type}`;
      }

      if (event_platform_provider_name) {
        whereConditions = client`${whereConditions} AND event_platform_provider_name = ${event_platform_provider_name}`;
      }

      if (from_ts) {
        whereConditions = client`${whereConditions} AND from_ts >= ${from_ts}::timestamptz`;
      }

      if (to_ts) {
        whereConditions = client`${whereConditions} AND to_ts <= ${to_ts}::timestamptz`;
      }

      const dataQuery = client`
        SELECT
          id::text,
          code,
          name,
          descr,
          event_type,
          event_platform_provider_name,
          event_addr,
          event_instructions,
          from_ts::text,
          to_ts::text,
          timezone,
          event_metadata,
          active_flag,
          created_ts::text,
          updated_ts::text,
          version
        FROM app.d_event
        ${whereConditions}
        ORDER BY from_ts DESC, created_ts DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      const countQuery = client`
        SELECT COUNT(*) as total
        FROM app.d_event
        ${whereConditions}
      `;

      const result = await paginateQuery(dataQuery, countQuery, page, limit);
      reply.code(200).send(result);
    } catch (error) {
      console.error('Error fetching events:', error);
      reply.code(500).send({ error: 'Failed to fetch events' });
    }
  });

  /**
   * GET /api/v1/event/:id
   * Get event by ID with linked people (attendees)
   */
  fastify.get<{
    Params: { id: string };
  }>('/api/v1/event/:id', async (request, reply) => {
    try {
      const { id } = request.params;

      // Get event details
      const eventQuery = client`
        SELECT
          id::text,
          code,
          name,
          descr,
          event_type,
          event_platform_provider_name,
          event_addr,
          event_instructions,
          from_ts::text,
          to_ts::text,
          timezone,
          event_metadata,
          active_flag,
          created_ts::text,
          updated_ts::text,
          version
        FROM app.d_event
        WHERE id = ${id}::uuid AND active_flag = true
      `;

      const eventResult = await eventQuery;

      if (eventResult.length === 0) {
        return reply.code(404).send({ error: 'Event not found' });
      }

      const event = eventResult[0];

      // Get linked people (attendees) from d_entity_event_person_calendar
      const attendeesQuery = client`
        SELECT
          id::text,
          code,
          name,
          person_entity_type,
          person_entity_id::text,
          event_rsvp_status,
          from_ts::text,
          to_ts::text,
          timezone
        FROM app.d_entity_event_person_calendar
        WHERE event_id = ${id}::uuid AND active_flag = true
        ORDER BY person_entity_type, event_rsvp_status
      `;

      const attendeesResult = await attendeesQuery;

      // Get linked entities from d_entity_id_map
      const linkedEntitiesQuery = client`
        SELECT
          child_entity_type,
          child_entity_id,
          relationship_type
        FROM app.d_entity_id_map
        WHERE parent_entity_type = 'event'
          AND parent_entity_id = ${id}
          AND active_flag = true
        ORDER BY child_entity_type
      `;

      const linkedEntitiesResult = await linkedEntitiesQuery;

      reply.code(200).send({
        ...event,
        attendees: attendeesResult,
        linked_entities: linkedEntitiesResult
      });
    } catch (error) {
      console.error('Error fetching event:', error);
      reply.code(500).send({ error: 'Failed to fetch event' });
    }
  });

  /**
   * POST /api/v1/event
   * Create a new event and optionally link attendees
   */
  fastify.post<{
    Body: CreateEventRequest;
  }>('/api/v1/event', async (request, reply) => {
    try {
      const eventData = request.body;
      const eventId = uuidv4();

      // Create event
      const insertQuery = client`
        INSERT INTO app.d_event (
          id,
          code,
          name,
          descr,
          event_type,
          event_platform_provider_name,
          event_addr,
          event_instructions,
          from_ts,
          to_ts,
          timezone,
          event_metadata
        ) VALUES (
          ${eventId}::uuid,
          ${eventData.code},
          ${eventData.name},
          ${eventData.descr || null},
          ${eventData.event_type},
          ${eventData.event_platform_provider_name},
          ${eventData.event_addr || null},
          ${eventData.event_instructions || null},
          ${eventData.from_ts}::timestamptz,
          ${eventData.to_ts}::timestamptz,
          ${eventData.timezone || 'America/Toronto'},
          ${eventData.event_metadata ? JSON.stringify(eventData.event_metadata) : '{}'}::jsonb
        )
        RETURNING
          id::text,
          code,
          name,
          event_type,
          event_platform_provider_name,
          from_ts::text,
          to_ts::text,
          created_ts::text
      `;

      const result = await insertQuery;
      const newEvent = result[0];

      // Register in entity_instance_id
      await client`
        INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
        VALUES ('event', ${newEvent.id}::uuid, ${newEvent.name}, ${newEvent.code})
        ON CONFLICT (entity_type, entity_id) DO UPDATE
        SET entity_name = EXCLUDED.entity_name,
            entity_code = EXCLUDED.entity_code,
            updated_ts = now()
      `;

      console.log(`✅ Created event: ${newEvent.code}`);

      // Create event-person mappings if attendees provided
      let attendees = [];
      if (eventData.attendees && eventData.attendees.length > 0) {
        for (const attendee of eventData.attendees) {
          const attendeeCode = `EPC-${eventData.code}-${attendee.person_entity_type.toUpperCase()}-${attendee.person_entity_id.substring(0, 8)}`;

          const attendeeQuery = client`
            INSERT INTO app.d_entity_event_person_calendar (
              code,
              name,
              person_entity_type,
              person_entity_id,
              event_id,
              event_rsvp_status,
              from_ts,
              to_ts,
              timezone
            ) VALUES (
              ${attendeeCode},
              ${`${eventData.name} - ${attendee.person_entity_type}`},
              ${attendee.person_entity_type},
              ${attendee.person_entity_id}::uuid,
              ${newEvent.id}::uuid,
              ${attendee.event_rsvp_status || 'pending'},
              ${eventData.from_ts}::timestamptz,
              ${eventData.to_ts}::timestamptz,
              ${eventData.timezone || 'America/Toronto'}
            )
            RETURNING id::text, code, person_entity_type, event_rsvp_status
          `;

          const attendeeResult = await attendeeQuery;
          attendees.push(attendeeResult[0]);

          // Register in entity_instance_id
          await client`
            INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
            VALUES ('event_person_calendar', ${attendeeResult[0].id}::uuid, ${attendeeCode}, ${attendeeCode})
            ON CONFLICT (entity_type, entity_id) DO UPDATE
            SET entity_name = EXCLUDED.entity_name,
                entity_code = EXCLUDED.entity_code,
                updated_ts = now()
          `;
        }

        console.log(`✅ Created ${attendees.length} event-person mappings for event ${newEvent.code}`);
      }

      reply.code(201).send({
        ...newEvent,
        attendees
      });
    } catch (error) {
      console.error('Error creating event:', error);
      reply.code(500).send({ error: 'Failed to create event' });
    }
  });

  /**
   * PATCH /api/v1/event/:id
   * Update event details
   */
  fastify.patch<{
    Params: { id: string };
    Body: UpdateEventRequest;
  }>('/api/v1/event/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const updates = request.body;

      const updateQuery = client`
        UPDATE app.d_event
        SET
          name = COALESCE(${updates.name || null}, name),
          descr = COALESCE(${updates.descr || null}, descr),
          event_type = COALESCE(${updates.event_type || null}, event_type),
          event_platform_provider_name = COALESCE(${updates.event_platform_provider_name || null}, event_platform_provider_name),
          event_addr = COALESCE(${updates.event_addr || null}, event_addr),
          event_instructions = COALESCE(${updates.event_instructions || null}, event_instructions),
          from_ts = COALESCE(${updates.from_ts ? `${updates.from_ts}::timestamptz` : null}, from_ts),
          to_ts = COALESCE(${updates.to_ts ? `${updates.to_ts}::timestamptz` : null}, to_ts),
          timezone = COALESCE(${updates.timezone || null}, timezone),
          event_metadata = COALESCE(${updates.event_metadata ? JSON.stringify(updates.event_metadata) : null}::jsonb, event_metadata),
          updated_ts = now(),
          version = version + 1
        WHERE id = ${id}::uuid AND active_flag = true
        RETURNING
          id::text,
          code,
          name,
          event_type,
          from_ts::text,
          to_ts::text,
          updated_ts::text
      `;

      const result = await updateQuery;

      if (result.length === 0) {
        return reply.code(404).send({ error: 'Event not found' });
      }

      console.log(`✅ Updated event: ${result[0].code}`);

      reply.code(200).send(result[0]);
    } catch (error) {
      console.error('Error updating event:', error);
      reply.code(500).send({ error: 'Failed to update event' });
    }
  });

  /**
   * DELETE /api/v1/event/:id
   * Soft delete event and linked event-person mappings
   */
  fastify.delete<{
    Params: { id: string };
  }>('/api/v1/event/:id', async (request, reply) => {
    try {
      const { id } = request.params;

      // Soft delete event
      const deleteQuery = client`
        UPDATE app.d_event
        SET
          active_flag = false,
          updated_ts = now()
        WHERE id = ${id}::uuid AND active_flag = true
        RETURNING id::text, code, name
      `;

      const result = await deleteQuery;

      if (result.length === 0) {
        return reply.code(404).send({ error: 'Event not found' });
      }

      // Also soft delete linked event-person mappings
      await client`
        UPDATE app.d_entity_event_person_calendar
        SET
          active_flag = false,
          updated_ts = now()
        WHERE event_id = ${id}::uuid AND active_flag = true
      `;

      // Soft delete entity linkages in d_entity_id_map
      await client`
        UPDATE app.d_entity_id_map
        SET
          active_flag = false,
          to_ts = now(),
          updated_ts = now()
        WHERE parent_entity_type = 'event'
          AND parent_entity_id = ${id}
          AND active_flag = true
      `;

      console.log(`✅ Deleted event and linked data: ${result[0].code}`);

      reply.code(200).send({
        success: true,
        message: 'Event deleted successfully',
        event: result[0]
      });
    } catch (error) {
      console.error('Error deleting event:', error);
      reply.code(500).send({ error: 'Failed to delete event' });
    }
  });

  /**
   * GET /api/v1/event/:id/attendees
   * Get all attendees for a specific event
   */
  fastify.get<{
    Params: { id: string };
  }>('/api/v1/event/:id/attendees', async (request, reply) => {
    try {
      const { id } = request.params;

      // Check if event exists
      const eventCheck = await client`
        SELECT id FROM app.d_event
        WHERE id = ${id}::uuid AND active_flag = true
      `;

      if (eventCheck.length === 0) {
        return reply.code(404).send({ error: 'Event not found' });
      }

      // Get attendees with enriched person details
      const attendeesQuery = client`
        SELECT
          epc.id::text,
          epc.code,
          epc.person_entity_type,
          epc.person_entity_id::text,
          epc.event_rsvp_status,
          epc.from_ts::text,
          epc.to_ts::text,
          epc.timezone,
          CASE
            WHEN epc.person_entity_type = 'employee' THEN emp.name
            WHEN epc.person_entity_type = 'customer' THEN cust.name
            WHEN epc.person_entity_type = 'client' THEN NULL -- Add client name if d_client exists
          END as person_name,
          CASE
            WHEN epc.person_entity_type = 'employee' THEN emp.email
            WHEN epc.person_entity_type = 'customer' THEN cust.email
            WHEN epc.person_entity_type = 'client' THEN NULL
          END as person_email
        FROM app.d_entity_event_person_calendar epc
        LEFT JOIN app.d_employee emp ON epc.person_entity_type = 'employee' AND epc.person_entity_id = emp.id
        LEFT JOIN app.d_cust cust ON epc.person_entity_type = 'customer' AND epc.person_entity_id = cust.id
        WHERE epc.event_id = ${id}::uuid AND epc.active_flag = true
        ORDER BY epc.event_rsvp_status, epc.person_entity_type
      `;

      const attendees = await attendeesQuery;

      reply.code(200).send({
        event_id: id,
        total_attendees: attendees.length,
        rsvp_summary: {
          accepted: attendees.filter(a => a.event_rsvp_status === 'accepted').length,
          declined: attendees.filter(a => a.event_rsvp_status === 'declined').length,
          pending: attendees.filter(a => a.event_rsvp_status === 'pending').length
        },
        attendees
      });
    } catch (error) {
      console.error('Error fetching event attendees:', error);
      reply.code(500).send({ error: 'Failed to fetch event attendees' });
    }
  });

  /**
   * GET /api/v1/event/:id/entities
   * Get all linked entities for a specific event (from d_entity_id_map)
   */
  fastify.get<{
    Params: { id: string };
  }>('/api/v1/event/:id/entities', async (request, reply) => {
    try {
      const { id } = request.params;

      // Check if event exists
      const eventCheck = await client`
        SELECT id FROM app.d_event
        WHERE id = ${id}::uuid AND active_flag = true
      `;

      if (eventCheck.length === 0) {
        return reply.code(404).send({ error: 'Event not found' });
      }

      // Get linked entities
      const entitiesQuery = client`
        SELECT
          child_entity_type,
          child_entity_id,
          relationship_type,
          from_ts::text,
          to_ts::text
        FROM app.d_entity_id_map
        WHERE parent_entity_type = 'event'
          AND parent_entity_id = ${id}
          AND active_flag = true
        ORDER BY child_entity_type, relationship_type
      `;

      const entities = await entitiesQuery;

      reply.code(200).send({
        event_id: id,
        total_linked_entities: entities.length,
        linked_entities: entities
      });
    } catch (error) {
      console.error('Error fetching event entities:', error);
      reply.code(500).send({ error: 'Failed to fetch event entities' });
    }
  });

  console.log('✅ Event routes registered');
}

export default eventRoutes;
