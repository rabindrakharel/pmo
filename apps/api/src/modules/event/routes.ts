/**
 * Event API Routes
 * Manages events/meetings/appointments as universal parent entities
 * @module event/routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { client, db } from '../../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { paginateQuery, getPaginationParams } from '../../lib/pagination.js';
// ✅ Entity Infrastructure Service - Centralized infrastructure management
import { getEntityInfrastructure, Permission } from '../../services/entity-infrastructure.service.js';
// ✨ Universal auto-filter builder - zero-config query filtering
import { buildAutoFilters } from '../../lib/universal-filter-builder.js';
// ✅ Delete factory for cascading soft deletes
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';
// ✅ Child entity factory for parent-child relationships
import { createChildEntityEndpointsFromMetadata } from '../../lib/child-entity-route-factory.js';

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_CODE = 'event';
const TABLE_ALIAS = 'e';

/**
 * Event creation request
 */
interface CreateEventRequest {
  code: string;
  name: string;
  descr?: string;
  event_action_entity_type: 'service' | 'product' | 'project' | 'task' | 'quote';
  event_action_entity_id: string;
  organizer_employee_id?: string; // Defaults to current user if not provided
  event_type: 'onsite' | 'virtual';
  event_platform_provider_name: string; // 'zoom', 'teams', 'google_meet', 'physical_hall', 'office', etc.
  venue_type?: string; // 'conference_room', 'office', 'warehouse', 'customer_site', 'remote', etc.
  event_addr?: string; // Physical address OR meeting URL
  event_instructions?: string;
  from_ts: string; // ISO timestamp (event start time)
  to_ts: string; // ISO timestamp (event end time)
  timezone?: string; // Default: 'America/Toronto'
  event_metadata?: Record<string, any>;
  // Optional: Attendees to automatically create event-person mappings
  attendees?: Array<{
    person_entity_type: 'employee' | 'client' | 'customer';
    person_id: string;
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
  // ═══════════════════════════════════════════════════════════════
  // ✅ ENTITY INFRASTRUCTURE SERVICE - Initialize service instance
  // ═══════════════════════════════════════════════════════════════
  const entityInfra = getEntityInfrastructure(db);

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
      search?: string;
      page?: number;
      limit?: number;
    };
  }>('/api/v1/event', async (request, reply) => {
    try {
      const { from_ts, to_ts } = request.query;
      const { page, limit, offset } = getPaginationParams(request.query);

      // ✨ UNIVERSAL AUTO-FILTER SYSTEM
      // Automatically builds filters from ANY query parameter based on field naming conventions
      // Supports: ?event_type=X, ?event_platform_provider_name=Y, ?search=keyword, etc.
      const conditions: any[] = [];

      // Build auto-filters for standard fields
      const queryFilters: any = {};
      Object.keys(request.query).forEach(key => {
        if (!['page', 'limit', 'offset', 'from_ts', 'to_ts'].includes(key)) {
          queryFilters[key] = (request.query as any)[key];
        }
      });

      // Note: buildAutoFilters expects SQL[] for drizzle-orm, but we're using postgres.js client
      // For now, we'll manually build filters compatible with postgres.js
      let whereConditions = client`WHERE active_flag = true`;

      // Auto-filter: event_type
      if (queryFilters.event_type) {
        whereConditions = client`${whereConditions} AND event_type = ${queryFilters.event_type}`;
      }

      // Auto-filter: event_platform_provider_name
      if (queryFilters.event_platform_provider_name) {
        whereConditions = client`${whereConditions} AND event_platform_provider_name = ${queryFilters.event_platform_provider_name}`;
      }

      // Auto-filter: search (searches across name, code, descr)
      if (queryFilters.search) {
        whereConditions = client`${whereConditions} AND (
          name ILIKE ${'%' + queryFilters.search + '%'}
          OR code ILIKE ${'%' + queryFilters.search + '%'}
          OR descr ILIKE ${'%' + queryFilters.search + '%'}
        )`;
      }

      // Date range filters (custom logic for timestamp comparison)
      if (from_ts) {
        whereConditions = client`${whereConditions} AND from_ts >= ${from_ts}::timestamptz`;
      }

      if (to_ts) {
        whereConditions = client`${whereConditions} AND to_ts <= ${to_ts}::timestamptz`;
      }

      const dataQuery = client`
        SELECT
          e.id::text,
          e.code,
          e.name,
          e.descr,
          e.event_action_entity_type,
          e.event_action_entity_id::text,
          e.organizer_employee_id::text,
          e.event_type,
          e.event_platform_provider_name,
          e.venue_type,
          e.event_addr,
          e.event_instructions,
          e.from_ts::text,
          e.to_ts::text,
          e.timezone,
          e.event_metadata,
          e.active_flag,
          e.created_ts::text,
          e.updated_ts::text,
          e.version,
          -- Get organizer details
          (
            SELECT jsonb_build_object(
              'employee_id', emp.id::text,
              'name', emp.name,
              'email', emp.email
            )
            FROM app.employee emp
            WHERE emp.id = e.organizer_employee_id
          ) as organizer
        FROM app.event e
        ${whereConditions}
        ORDER BY e.from_ts DESC, e.created_ts DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      const countQuery = client`
        SELECT COUNT(*) as total
        FROM app.event
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
   * GET /api/v1/event/enriched
   * Get all events with full organizer and attendee details
   */
  fastify.get<{
    Querystring: {
      from_ts?: string;
      to_ts?: string;
      person_id?: string;
      person_type?: string;
      page?: number;
      limit?: number;
    };
  }>('/api/v1/event/enriched', async (request, reply) => {
    try {
      const { from_ts, to_ts, person_id, person_type } = request.query;
      const { page, limit, offset } = getPaginationParams(request.query);

      // Build conditions for filtering
      let whereConditions = client`WHERE e.active_flag = true`;

      if (from_ts) {
        whereConditions = client`${whereConditions} AND e.from_ts >= ${from_ts}::timestamptz`;
      }

      if (to_ts) {
        whereConditions = client`${whereConditions} AND e.to_ts <= ${to_ts}::timestamptz`;
      }

      // Filter by person involvement (either as organizer or attendee)
      let personFilter = client``;
      if (person_id && person_type) {
        if (person_type === 'employee') {
          personFilter = client`
            AND (
              e.organizer_employee_id = ${person_id}::uuid
              OR EXISTS (
                SELECT 1 FROM app.entity_event_person_calendar epc
                WHERE epc.event_id = e.id
                  AND epc.person_id = ${person_id}::uuid
                  AND epc.person_entity_type = ${person_type}
                  AND epc.active_flag = true
              )
            )
          `;
        } else {
          personFilter = client`
            AND EXISTS (
              SELECT 1 FROM app.entity_event_person_calendar epc
              WHERE epc.event_id = e.id
                AND epc.person_id = ${person_id}::uuid
                AND epc.person_entity_type = ${person_type}
                AND epc.active_flag = true
            )
          `;
        }
      }

      // Main query with organizer details
      const eventsQuery = client`
        SELECT
          e.id::text,
          e.code,
          e.name,
          e.descr,
          e.event_action_entity_type,
          e.event_action_entity_id::text,
          e.organizer_employee_id::text,
          e.event_type,
          e.event_platform_provider_name,
          e.venue_type,
          e.event_addr,
          e.event_instructions,
          e.from_ts::text,
          e.to_ts::text,
          e.timezone,
          e.event_metadata,
          -- Get organizer details
          (
            SELECT jsonb_build_object(
              'employee_id', emp.id::text,
              'name', emp.name,
              'email', emp.email
            )
            FROM app.employee emp
            WHERE emp.id = e.organizer_employee_id
          ) as organizer
        FROM app.event e
        ${whereConditions}
        ${personFilter}
        ORDER BY e.from_ts ASC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      const eventsResult = await eventsQuery;

      // Get attendees for all events
      const eventIds = eventsResult.map(e => e.id);
      let attendeesResult = [];

      if (eventIds.length > 0) {
        const attendeesQuery = client`
          SELECT
            epc.event_id::text,
            epc.person_entity_type,
            epc.person_id::text,
            epc.event_rsvp_status,
            CASE
              WHEN epc.person_entity_type = 'employee' THEN emp.name
              WHEN epc.person_entity_type = 'customer' THEN cust.name
            END as person_name,
            CASE
              WHEN epc.person_entity_type = 'employee' THEN emp.email
              WHEN epc.person_entity_type = 'customer' THEN cust.metadata->>'email'
            END as person_email
          FROM app.entity_event_person_calendar epc
          LEFT JOIN app.employee emp ON epc.person_id = emp.id AND epc.person_entity_type = 'employee'
          LEFT JOIN app.d_cust cust ON epc.person_id = cust.id AND epc.person_entity_type = 'customer'
          WHERE epc.event_id = ANY(${eventIds}::uuid[])
            AND epc.active_flag = true
          ORDER BY epc.person_entity_type, epc.event_rsvp_status
        `;
        attendeesResult = await attendeesQuery;
      }

      // Group attendees by event
      const attendeesByEvent = attendeesResult.reduce((acc: any, attendee: any) => {
        if (!acc[attendee.event_id]) {
          acc[attendee.event_id] = [];
        }
        acc[attendee.event_id].push(attendee);
        return acc;
      }, {});

      // Combine events with attendees
      const enrichedEvents = eventsResult.map(event => ({
        ...event,
        attendees: attendeesByEvent[event.id] || []
      }));

      // Count query
      const countQuery = client`
        SELECT COUNT(*) as total
        FROM app.event e
        ${whereConditions}
        ${personFilter}
      `;

      const countResult = await countQuery;
      const total = parseInt(countResult[0].total);

      reply.code(200).send({
        data: enrichedEvents,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching enriched events:', error);
      reply.code(500).send({ error: 'Failed to fetch enriched events' });
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
          event_action_entity_type,
          event_action_entity_id::text,
          organizer_employee_id::text,
          event_type,
          event_platform_provider_name,
          venue_type,
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
        FROM app.event
        WHERE id = ${id}::uuid AND active_flag = true
      `;

      const eventResult = await eventQuery;

      if (eventResult.length === 0) {
        return reply.code(404).send({ error: 'Event not found' });
      }

      const event = eventResult[0];

      // Get linked people (attendees) from entity_event_person_calendar
      const attendeesQuery = client`
        SELECT
          id::text,
          code,
          name,
          person_entity_type,
          person_id::text,
          event_rsvp_status,
          from_ts::text,
          to_ts::text,
          timezone
        FROM app.entity_event_person_calendar
        WHERE event_id = ${id}::uuid AND active_flag = true
        ORDER BY person_entity_type, event_rsvp_status
      `;

      const attendeesResult = await attendeesQuery;

      // Get linked entities from entity_instance_link
      const linkedEntitiesQuery = client`
        SELECT
          child_entity_type,
          child_entity_id,
          relationship_type
        FROM app.entity_instance_link
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
      const creatorEmpId = request.user?.sub;
      const organizerEmpId = eventData.organizer_employee_id || creatorEmpId;

      // Create event
      const insertQuery = client`
        INSERT INTO app.d_event (
          id,
          code,
          name,
          descr,
          event_action_entity_type,
          event_action_entity_id,
          organizer_employee_id,
          event_type,
          event_platform_provider_name,
          venue_type,
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
          ${eventData.event_action_entity_type},
          ${eventData.event_action_entity_id}::uuid,
          ${organizerEmpId}::uuid,
          ${eventData.event_type},
          ${eventData.event_platform_provider_name},
          ${eventData.venue_type || null},
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
          event_action_entity_type,
          event_action_entity_id::text,
          organizer_employee_id::text,
          event_type,
          event_platform_provider_name,
          venue_type,
          from_ts::text,
          to_ts::text,
          created_ts::text
      `;

      const result = await insertQuery;
      const newEvent = result[0];

      // Register in entity_instance_id
      await client`
        INSERT INTO app.entity_instance (entity_type, entity_id, entity_name, entity_code)
        VALUES ('event', ${newEvent.id}::uuid, ${newEvent.name}, ${newEvent.code})
        ON CONFLICT (entity_type, entity_id) DO UPDATE
        SET entity_name = EXCLUDED.entity_name,
            entity_code = EXCLUDED.entity_code,
            updated_ts = now()
      `;

      console.log(`✅ Created event: ${newEvent.code}`);

      // ═══════════════════════════════════════════════════════════════
      // ✅ ENTITY INFRASTRUCTURE SERVICE - Grant OWNER permission to creator
      // ═══════════════════════════════════════════════════════════════
      if (creatorEmpId) {
        await entityInfra.set_entity_rbac_owner(creatorEmpId, 'event', newEvent.id);
        console.log(`✅ Granted Owner permissions to creator (employee_id: ${creatorEmpId})`);

        // Also add organizer as an attendee with accepted status
        const organizerAttendeeCode = `EPC-${eventData.code}-ORGANIZER-${organizerEmpId.substring(0, 8)}`;
        await client`
          INSERT INTO app.d_entity_event_person_calendar (
            code,
            name,
            person_entity_type,
            person_id,
            event_id,
            event_rsvp_status,
            from_ts,
            to_ts,
            timezone
          ) VALUES (
            ${organizerAttendeeCode},
            ${`${eventData.name} - Organizer`},
            'employee',
            ${organizerEmpId}::uuid,
            ${newEvent.id}::uuid,
            'accepted',
            ${eventData.from_ts}::timestamptz,
            ${eventData.to_ts}::timestamptz,
            ${eventData.timezone || 'America/Toronto'}
          )
          ON CONFLICT DO NOTHING
        `;
        console.log(`✅ Added organizer as attendee with accepted RSVP status`);
      }

      // Create event-person mappings if attendees provided
      let attendees = [];
      if (eventData.attendees && eventData.attendees.length > 0) {
        for (const attendee of eventData.attendees) {
          const attendeeCode = `EPC-${eventData.code}-${attendee.person_entity_type.toUpperCase()}-${attendee.person_id.substring(0, 8)}`;

          const attendeeQuery = client`
            INSERT INTO app.d_entity_event_person_calendar (
              code,
              name,
              person_entity_type,
              person_id,
              event_id,
              event_rsvp_status,
              from_ts,
              to_ts,
              timezone
            ) VALUES (
              ${attendeeCode},
              ${`${eventData.name} - ${attendee.person_entity_type}`},
              ${attendee.person_entity_type},
              ${attendee.person_id}::uuid,
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
            INSERT INTO app.entity_instance (entity_type, entity_id, entity_name, entity_code)
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
   * PUT /api/v1/event/:id
   * Update event details (alias to PATCH for frontend compatibility)
   */
  fastify.put<{
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

  // ✨ DELETE endpoint now handled by factory (see end of file)
  // Factory provides cascading soft delete for event and linked entities

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
        SELECT id FROM app.event
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
          epc.person_id::text,
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
        FROM app.entity_event_person_calendar epc
        LEFT JOIN app.employee emp ON epc.person_entity_type = 'employee' AND epc.person_id = emp.id
        LEFT JOIN app.d_cust cust ON epc.person_entity_type = 'customer' AND epc.person_id = cust.id
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
   * Get all linked entities for a specific event (from entity_instance_link)
   */
  fastify.get<{
    Params: { id: string };
  }>('/api/v1/event/:id/entities', async (request, reply) => {
    try {
      const { id } = request.params;

      // Check if event exists
      const eventCheck = await client`
        SELECT id FROM app.event
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
        FROM app.entity_instance_link
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

  // ============================================================================
  // ✨ FACTORY-GENERATED ENDPOINTS
  // ============================================================================

  // ✨ Factory-generated DELETE endpoint
  // Provides cascading soft delete for event and all linked entities
  createEntityDeleteEndpoint(fastify, ENTITY_CODE);

  // ✨ Factory-generated child entity endpoints
  // Auto-generates endpoints for child entities based on entity metadata
  // Example: GET /api/v1/event/:id/{child_entity}
  await createChildEntityEndpointsFromMetadata(fastify, ENTITY_CODE);

  console.log('✅ Event routes registered');
}

export default eventRoutes;
