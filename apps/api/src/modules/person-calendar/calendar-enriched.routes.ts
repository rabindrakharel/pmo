/**
 * Enriched Calendar API Routes
 * Returns calendar slots with full event details from d_event
 * @module person-calendar/calendar-enriched.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { client } from '../../db/index.js';
import { paginateQuery, getPaginationParams } from '../../lib/pagination.js';

/**
 * Register enriched calendar routes
 */
export async function enrichedCalendarRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/person-calendar/enriched
   * Get calendar slots with enriched event data
   * Returns calendar slots joined with d_event for complete booking information
   */
  fastify.get<{
    Querystring: {
      person_entity_type?: string;
      person_id?: string;
      from_ts?: string;
      to_ts?: string;
      availability_flag?: string;
      page?: number;
      limit?: number;
    };
  }>('/api/v1/person-calendar/enriched', async (request, reply) => {
    try {
      const {
        person_entity_type,
        person_id,
        from_ts,
        to_ts,
        availability_flag
      } = request.query;
      const { page, limit, offset } = getPaginationParams(request.query);

      // Build filters
      const filters = [];

      if (person_entity_type) {
        filters.push(client`pc.person_entity_type = ${person_entity_type}`);
      }

      if (person_id) {
        filters.push(client`pc.person_id = ${person_id}::uuid`);
      }

      if (from_ts) {
        filters.push(client`pc.from_ts >= ${from_ts}::timestamptz`);
      }

      if (to_ts) {
        filters.push(client`pc.to_ts <= ${to_ts}::timestamptz`);
      }

      if (availability_flag !== undefined) {
        filters.push(client`pc.availability_flag = ${availability_flag === 'true'}`);
      }

      const whereClause = filters.length > 0
        ? client`AND ${client.unsafe(filters.map((_, i) => `$${i + 1}`).join(' AND '))}`
        : client``;

      // Data query with event join
      const dataQuery = client`
        SELECT
          pc.id::text,
          pc.code,
          pc.name,
          pc.descr,
          pc.person_entity_type,
          pc.person_id::text,
          pc.from_ts::text,
          pc.to_ts::text,
          pc.timezone,
          pc.availability_flag,
          pc.title,
          pc.appointment_medium,
          pc.appointment_addr,
          pc.instructions,
          pc.event_id::text,
          pc.metadata as calendar_metadata,
          pc.reminder_sent_flag,
          pc.reminder_sent_ts::text,
          pc.confirmation_sent_flag,
          pc.confirmation_sent_ts::text,
          pc.active_flag,
          pc.created_ts::text,
          pc.updated_ts::text,
          pc.version,

          -- Event details (when event_id is present)
          e.code as event_code,
          e.name as event_name,
          e.descr as event_description,
          e.event_type,
          e.event_platform_provider_name,
          e.event_addr,
          e.event_instructions,
          e.event_metadata,

          -- Person details (employee or customer)
          CASE
            WHEN pc.person_entity_type = 'employee' THEN emp.first_name || ' ' || emp.last_name
            WHEN pc.person_entity_type = 'customer' THEN cust.name
            ELSE NULL
          END as person_name,
          CASE
            WHEN pc.person_entity_type = 'employee' THEN emp.email
            WHEN pc.person_entity_type = 'customer' THEN cust.primary_email
            ELSE NULL
          END as person_email

        FROM app.d_entity_person_calendar pc
        LEFT JOIN app.d_event e ON e.id = pc.event_id AND e.active_flag = true
        LEFT JOIN app.employee emp ON emp.id = pc.person_id AND pc.person_entity_type = 'employee' AND emp.active_flag = true
        LEFT JOIN app.customer cust ON cust.id = pc.person_id AND pc.person_entity_type = 'customer' AND cust.active_flag = true
        WHERE pc.active_flag = true ${whereClause}
        ORDER BY pc.from_ts ASC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      // Count query
      const countQuery = client`
        SELECT COUNT(*) as total
        FROM app.d_entity_person_calendar pc
        WHERE pc.active_flag = true ${whereClause}
      `;

      // Execute paginated query
      const result = await paginateQuery(dataQuery, countQuery, page, limit);

      // Enrich with attendees for each event
      const enrichedData = await Promise.all(
        result.data.map(async (slot: any) => {
          if (slot.event_id) {
            // Fetch attendees for this event
            const attendeesResult = await client`
              SELECT
                epc.person_entity_type,
                epc.person_id::text,
                epc.event_rsvp_status,
                CASE
                  WHEN epc.person_entity_type = 'employee' THEN emp.first_name || ' ' || emp.last_name
                  WHEN epc.person_entity_type = 'customer' THEN cust.name
                  ELSE NULL
                END as person_name,
                CASE
                  WHEN epc.person_entity_type = 'employee' THEN emp.email
                  WHEN epc.person_entity_type = 'customer' THEN cust.primary_email
                  ELSE NULL
                END as person_email
              FROM app.d_entity_event_person_calendar epc
              LEFT JOIN app.employee emp ON emp.id = epc.person_id AND epc.person_entity_type = 'employee'
              LEFT JOIN app.customer cust ON cust.id = epc.person_id AND epc.person_entity_type = 'customer'
              WHERE epc.event_id = ${slot.event_id}::uuid
                AND epc.active_flag = true
            `;

            return {
              ...slot,
              attendees: attendeesResult.map((a: any) => ({
                person_entity_type: a.person_entity_type,
                person_id: a.person_id,
                event_rsvp_status: a.event_rsvp_status,
                person_name: a.person_name,
                person_email: a.person_email
              }))
            };
          }

          return slot;
        })
      );

      reply.code(200).send({
        ...result,
        data: enrichedData
      });
    } catch (error) {
      console.error('Error fetching enriched calendar:', error);
      reply.code(500).send({ error: 'Failed to fetch enriched calendar' });
    }
  });

  /**
   * GET /api/v1/person-calendar/enriched/:id
   * Get single calendar slot with enriched event data
   */
  fastify.get<{
    Params: { id: string };
  }>('/api/v1/person-calendar/enriched/:id', async (request, reply) => {
    try {
      const { id } = request.params;

      const query = client`
        SELECT
          pc.id::text,
          pc.code,
          pc.name,
          pc.descr,
          pc.person_entity_type,
          pc.person_id::text,
          pc.from_ts::text,
          pc.to_ts::text,
          pc.timezone,
          pc.availability_flag,
          pc.title,
          pc.appointment_medium,
          pc.appointment_addr,
          pc.instructions,
          pc.event_id::text,
          pc.metadata as calendar_metadata,
          pc.reminder_sent_flag,
          pc.reminder_sent_ts::text,
          pc.confirmation_sent_flag,
          pc.confirmation_sent_ts::text,
          pc.active_flag,
          pc.created_ts::text,
          pc.updated_ts::text,
          pc.version,

          -- Event details
          e.code as event_code,
          e.name as event_name,
          e.descr as event_description,
          e.event_type,
          e.event_platform_provider_name,
          e.event_addr,
          e.event_instructions,
          e.event_metadata,

          -- Person details
          CASE
            WHEN pc.person_entity_type = 'employee' THEN emp.first_name || ' ' || emp.last_name
            WHEN pc.person_entity_type = 'customer' THEN cust.name
            ELSE NULL
          END as person_name,
          CASE
            WHEN pc.person_entity_type = 'employee' THEN emp.email
            WHEN pc.person_entity_type = 'customer' THEN cust.primary_email
            ELSE NULL
          END as person_email

        FROM app.d_entity_person_calendar pc
        LEFT JOIN app.d_event e ON e.id = pc.event_id AND e.active_flag = true
        LEFT JOIN app.employee emp ON emp.id = pc.person_id AND pc.person_entity_type = 'employee' AND emp.active_flag = true
        LEFT JOIN app.customer cust ON cust.id = pc.person_id AND pc.person_entity_type = 'customer' AND cust.active_flag = true
        WHERE pc.id = ${id}::uuid AND pc.active_flag = true
      `;

      const result = await query;

      if (result.length === 0) {
        return reply.code(404).send({ error: 'Calendar slot not found' });
      }

      const slot = result[0];

      // Fetch attendees if event exists
      if (slot.event_id) {
        const attendeesResult = await client`
          SELECT
            epc.person_entity_type,
            epc.person_id::text,
            epc.event_rsvp_status,
            CASE
              WHEN epc.person_entity_type = 'employee' THEN emp.first_name || ' ' || emp.last_name
              WHEN epc.person_entity_type = 'customer' THEN cust.name
              ELSE NULL
            END as person_name,
            CASE
              WHEN epc.person_entity_type = 'employee' THEN emp.email
              WHEN epc.person_entity_type = 'customer' THEN cust.primary_email
              ELSE NULL
            END as person_email
          FROM app.d_entity_event_person_calendar epc
          LEFT JOIN app.employee emp ON emp.id = epc.person_id AND epc.person_entity_type = 'employee'
          LEFT JOIN app.customer cust ON cust.id = epc.person_id AND epc.person_entity_type = 'customer'
          WHERE epc.event_id = ${slot.event_id}::uuid
            AND epc.active_flag = true
        `;

        slot.attendees = attendeesResult.map((a: any) => ({
          person_entity_type: a.person_entity_type,
          person_id: a.person_id,
          event_rsvp_status: a.event_rsvp_status,
          person_name: a.person_name,
          person_email: a.person_email
        }));
      }

      reply.code(200).send(slot);
    } catch (error) {
      console.error('Error fetching enriched calendar slot:', error);
      reply.code(500).send({ error: 'Failed to fetch enriched calendar slot' });
    }
  });

  console.log('✅ Enriched calendar routes registered');
}

export default enrichedCalendarRoutes;
