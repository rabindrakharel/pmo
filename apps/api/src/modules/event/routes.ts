/**
 * ============================================================================
 * EVENT ROUTES MODULE - Universal Entity Pattern with Factory
 * ============================================================================
 *
 * REFACTORED: Uses Universal CRUD Factory for GET (list), GET (single), and UPDATE endpoints.
 * Custom endpoints remain for specialized event functionality.
 *
 * ENDPOINTS:
 *   GET    /api/v1/event              - List events (FACTORY)
 *   GET    /api/v1/event/:id          - Get single event (FACTORY)
 *   POST   /api/v1/event              - Create event (CUSTOM)
 *   PATCH  /api/v1/event/:id          - Update event (FACTORY)
 *   PUT    /api/v1/event/:id          - Update event alias (FACTORY)
 *   DELETE /api/v1/event/:id          - Delete event (DELETE FACTORY)
 *   GET    /api/v1/event/enriched     - Enriched events (CUSTOM)
 *   GET    /api/v1/event/:id/attendees - Event attendees (CUSTOM)
 *   GET    /api/v1/event/:id/entities - Event linked entities (CUSTOM)
 *   GET    /api/v1/event/:id/{child}  - Child entities (CHILD FACTORY)
 *
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { client, db } from '../../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { getPaginationParams } from '../../lib/pagination.js';

// ✅ Entity Infrastructure Service - Centralized infrastructure management
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '../../services/entity-infrastructure.service.js';

// ✨ Universal Entity CRUD Factory - consolidated endpoint generation
import { createUniversalEntityRoutes } from '../../lib/universal-entity-crud-factory.js';

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_CODE = 'event';

/**
 * Event creation request
 */
interface CreateEventRequest {
  code: string;
  name: string;
  descr?: string;
  event_action_entity_type: 'service' | 'product' | 'project' | 'task' | 'quote';
  event_action_entity_id: string;
  organizer__employee_id?: string; // Defaults to current user if not provided
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

  // ════════════════════════════════════════════════════════════════════════════
  // UNIVERSAL CRUD ENDPOINTS (FACTORY)
  // ════════════════════════════════════════════════════════════════════════════
  // Creates:
  // - GET /api/v1/event         - List with RBAC, pagination, auto-filters, metadata
  // - GET /api/v1/event/:id     - Single entity with RBAC, ref_data_entityInstance
  // - PATCH /api/v1/event/:id   - Update with RBAC, registry sync
  // - PUT /api/v1/event/:id     - Update alias
  //
  // Features:
  // - content=metadata support for metadata-only responses
  // - ref_data_entityInstance for entity reference resolution
  // - Universal auto-filters from query parameters
  // - Parent-child filtering via entity_instance_link
  // ════════════════════════════════════════════════════════════════════════════

  createUniversalEntityRoutes(fastify, {
    entityCode: ENTITY_CODE,
    tableName: 'event',
    tableAlias: 'e',
    searchFields: ['name', 'code', 'descr', 'event_type', 'event_platform_provider_name']
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
  }>('/api/v1/event/enriched', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.code(401).send({ error: 'User not authenticated' });
    }

    try {
      const { from_ts, to_ts, person_id, person_type } = request.query;
      const { page, limit, offset } = getPaginationParams(request.query);

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC filtering
      // Only return events user has VIEW permission for
      // ═══════════════════════════════════════════════════════════════
      const rbacWhereClause = await entityInfra.get_entity_rbac_where_condition(
        userId, ENTITY_CODE, Permission.VIEW, 'e'
      );

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
              e.organizer__employee_id = ${person_id}::uuid
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
          e.organizer__employee_id::text,
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
            WHERE emp.id = e.organizer__employee_id
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
          LEFT JOIN app.cust cust ON epc.person_id = cust.id AND epc.person_entity_type = 'customer'
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

  // NOTE: GET /api/v1/event/:id now handled by Universal CRUD Factory
  // For detailed view with attendees and linked entities, use specific endpoints:
  // - GET /api/v1/event/:id/attendees
  // - GET /api/v1/event/:id/entities

  /**
   * POST /api/v1/event
   * Create a new event and optionally link attendees
   */
  fastify.post<{
    Body: CreateEventRequest;
  }>('/api/v1/event', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.code(401).send({ error: 'User not authenticated' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK
      // Check: Can user CREATE events?
      // ═══════════════════════════════════════════════════════════════
      const canCreate = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, ALL_ENTITIES_ID, Permission.CREATE);
      if (!canCreate) {
        return reply.code(403).send({ error: 'No permission to create events' });
      }

      const eventData = request.body;
      const eventId = uuidv4();
      const creatorEmpId = userId;
      const organizerEmpId = eventData.organizer__employee_id || creatorEmpId;

      // Create event
      const insertQuery = client`
        INSERT INTO app.d_event (
          id,
          code,
          name,
          descr,
          event_action_entity_type,
          event_action_entity_id,
          organizer__employee_id,
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
          organizer__employee_id::text,
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

  // NOTE: PATCH/PUT /api/v1/event/:id now handled by Universal CRUD Factory

  /**
   * GET /api/v1/event/:id/attendees
   * Get all attendees for a specific event
   */
  fastify.get<{
    Params: { id: string };
  }>('/api/v1/event/:id/attendees', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.code(401).send({ error: 'User not authenticated' });
    }

    try {
      const { id } = request.params;

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK
      // Check: Can user VIEW this event?
      // ═══════════════════════════════════════════════════════════════
      const canView = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, id, Permission.VIEW);
      if (!canView) {
        return reply.code(403).send({ error: 'No permission to view this event' });
      }

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
        LEFT JOIN app.cust cust ON epc.person_entity_type = 'customer' AND epc.person_id = cust.id
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
  }>('/api/v1/event/:id/entities', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.code(401).send({ error: 'User not authenticated' });
    }

    try {
      const { id } = request.params;

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK
      // Check: Can user VIEW this event?
      // ═══════════════════════════════════════════════════════════════
      const canView = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, id, Permission.VIEW);
      if (!canView) {
        return reply.code(403).send({ error: 'No permission to view this event' });
      }

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

  // DELETE endpoint is automatically created by createUniversalEntityRoutes above

  console.log('✅ Event routes registered');
}

export default eventRoutes;
