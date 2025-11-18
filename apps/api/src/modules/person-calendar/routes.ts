/**
 * Person Calendar API Routes
 * Universal calendar/booking system for employees and customers
 * @module person-calendar/routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { client, db } from '../../db/index.js';
import type { PersonCalendar, CreatePersonCalendarRequest, UpdatePersonCalendarRequest } from './types.js';
import { paginateQuery, getPaginationParams } from '../../lib/pagination.js';

/**
 * Register person calendar routes
 */
export async function personCalendarRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/person-calendar
   * Get all active calendar slots with optional availability filter
   */
  fastify.get<{
    Querystring: { availability_flag?: string; page?: number; limit?: number };
  }>('/api/v1/person-calendar', async (request, reply) => {
    try {
      const { availability_flag } = request.query;
      const { page, limit, offset } = getPaginationParams(request.query);

      // Build base WHERE clause
      const availabilityFilter = availability_flag !== undefined
        ? client`AND availability_flag = ${availability_flag === 'true'}`
        : client``;

      // Data query with pagination
      const dataQuery = client`
        SELECT
          id::text,
          code,
          name,
          descr,
          person_entity_type,
          person_id::text,
          from_ts::text,
          to_ts::text,
          timezone,
          availability_flag,
          title,
          appointment_medium,
          appointment_addr,
          instructions,
          event_id::text,
          metadata,
          reminder_sent_flag,
          reminder_sent_ts::text,
          confirmation_sent_flag,
          confirmation_sent_ts::text,
          active_flag,
          created_ts::text,
          updated_ts::text,
          version
        FROM app.d_entity_person_calendar
        WHERE active_flag = true ${availabilityFilter}
        ORDER BY from_ts ASC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      // Count query for total records
      const countQuery = client`
        SELECT COUNT(*) as total
        FROM app.d_entity_person_calendar
        WHERE active_flag = true ${availabilityFilter}
      `;

      // Execute paginated query
      const result = await paginateQuery(dataQuery, countQuery, page, limit);
      reply.code(200).send(result);
    } catch (error) {
      console.error('Error fetching person calendar:', error);
      reply.code(500).send({ error: 'Failed to fetch person calendar' });
    }
  });

  /**
   * GET /api/v1/person-calendar/:id
   * Get calendar slot by ID
   */
  fastify.get<{
    Params: { id: string };
  }>('/api/v1/person-calendar/:id', async (request, reply) => {
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
          from_ts::text,
          to_ts::text,
          timezone,
          availability_flag,
          title,
          appointment_medium,
          appointment_addr,
          instructions,
          event_id::text,
          metadata,
          reminder_sent_flag,
          reminder_sent_ts::text,
          confirmation_sent_flag,
          confirmation_sent_ts::text,
          active_flag,
          created_ts::text,
          updated_ts::text,
          version
        FROM app.d_entity_person_calendar
        WHERE id = ${id}::uuid AND active_flag = true
      `;

      const result = await query;

      if (result.length === 0) {
        return reply.code(404).send({ error: 'Calendar slot not found' });
      }

      reply.code(200).send(result[0]);
    } catch (error) {
      console.error('Error fetching calendar slot:', error);
      reply.code(500).send({ error: 'Failed to fetch calendar slot' });
    }
  });

  /**
   * GET /api/v1/person-calendar/available
   * Get available slots for a given time range
   * Query params: person_entity_type, person_id, from_ts, to_ts
   */
  fastify.get('/api/v1/person-calendar/available', async (request: FastifyRequest<{
    Querystring: {
      person_entity_type?: string;
      person_id?: string;
      from_ts?: string;
      to_ts?: string;
    };
  }>, reply) => {
    try {
      const { person_entity_type, person_id, from_ts, to_ts } = request.query;

      let whereConditions = client`WHERE active_flag = true AND availability_flag = true`;

      if (person_entity_type) {
        whereConditions = client`${whereConditions} AND person_entity_type = ${person_entity_type}`;
      }

      if (person_id) {
        whereConditions = client`${whereConditions} AND person_id = ${person_id}::uuid`;
      }

      if (from_ts) {
        whereConditions = client`${whereConditions} AND from_ts >= ${from_ts}::timestamptz`;
      }

      if (to_ts) {
        whereConditions = client`${whereConditions} AND to_ts <= ${to_ts}::timestamptz`;
      }

      const query = client`
        SELECT
          id::text,
          code,
          name,
          person_entity_type,
          person_id::text,
          from_ts::text,
          to_ts::text,
          timezone,
          availability_flag,
          created_ts::text
        FROM app.d_entity_person_calendar
        ${whereConditions}
        ORDER BY from_ts ASC
      `;

      const result = await query;
      reply.code(200).send(result);
    } catch (error) {
      console.error('Error fetching available slots:', error);
      reply.code(500).send({ error: 'Failed to fetch available slots' });
    }
  });

  /**
   * GET /api/v1/person-calendar/available-by-service
   * Get available employee slots filtered by service category (department)
   * Query params: service_category (required), limit (default: 1)
   */
  fastify.get('/api/v1/person-calendar/available-by-service', async (request: FastifyRequest<{
    Querystring: {
      service_category: string;
      limit?: number;
    };
  }>, reply) => {
    try {
      const { service_category, limit = 1 } = request.query;

      if (!service_category) {
        return reply.code(400).send({ error: 'service_category parameter is required' });
      }

      const rows = await client`
        SELECT
          c.id::text,
          c.code,
          c.name,
          c.from_ts::text,
          c.to_ts::text,
          c.timezone,
          c.availability_flag,
          e.id::text as employee_id,
          e.name as employee_name,
          e.department,
          e.title as job_title,
          e.email as employee_email,
          e.phone as employee_phone
        FROM app.d_entity_person_calendar c
        JOIN app.d_employee e ON c.person_id = e.id
        WHERE c.person_entity_type = 'employee'
          AND c.availability_flag = true
          AND c.active_flag = true
          AND e.active_flag = true
          AND c.from_ts >= now()
          AND e.department = ${service_category}
        ORDER BY c.from_ts ASC
        LIMIT ${limit}
      `;

      reply.code(200).send({
        service_category,
        slots_found: rows.length,
        slots: rows
      });
    } catch (error) {
      console.error('Error fetching available slots by service:', error);
      reply.code(500).send({ error: 'Failed to fetch available slots by service' });
    }
  });

  /**
   * GET /api/v1/person-calendar/booked
   * Get booked slots for a given person
   * Query params: person_entity_type, person_id, from_ts
   */
  fastify.get('/api/v1/person-calendar/booked', async (request: FastifyRequest<{
    Querystring: {
      person_entity_type?: string;
      person_id?: string;
      from_ts?: string;
    };
  }>, reply) => {
    try {
      const { person_entity_type, person_id, from_ts } = request.query;

      let whereConditions = client`WHERE active_flag = true AND availability_flag = false`;

      if (person_entity_type) {
        whereConditions = client`${whereConditions} AND person_entity_type = ${person_entity_type}`;
      }

      if (person_id) {
        whereConditions = client`${whereConditions} AND person_id = ${person_id}::uuid`;
      }

      if (from_ts) {
        whereConditions = client`${whereConditions} AND from_ts >= ${from_ts}::timestamptz`;
      }

      const query = client`
        SELECT
          id::text,
          code,
          name,
          person_entity_type,
          person_id::text,
          from_ts::text,
          to_ts::text,
          timezone,
          availability_flag,
          title,
          appointment_medium,
          appointment_addr,
          instructions,
          event_id::text,
          metadata,
          created_ts::text
        FROM app.d_entity_person_calendar
        ${whereConditions}
        ORDER BY from_ts ASC
      `;

      const result = await query;
      reply.code(200).send(result);
    } catch (error) {
      console.error('Error fetching booked slots:', error);
      reply.code(500).send({ error: 'Failed to fetch booked slots' });
    }
  });

  /**
   * POST /api/v1/person-calendar
   * Create a new calendar slot
   */
  fastify.post<{
    Body: CreatePersonCalendarRequest;
  }>('/api/v1/person-calendar', async (request, reply) => {
    try {
      const slot = request.body;

      const insertQuery = client`
        INSERT INTO app.d_entity_person_calendar (
          code,
          name,
          descr,
          person_entity_type,
          person_id,
          from_ts,
          to_ts,
          timezone,
          availability_flag,
          title,
          appointment_medium,
          appointment_addr,
          instructions,
          event_id,
          metadata
        ) VALUES (
          ${slot.code},
          ${slot.name},
          ${slot.descr || null},
          ${slot.person_entity_type},
          ${slot.person_id}::uuid,
          ${slot.from_ts}::timestamptz,
          ${slot.to_ts}::timestamptz,
          ${slot.timezone || 'America/Toronto'},
          ${slot.availability_flag !== undefined ? slot.availability_flag : true},
          ${slot.title || null},
          ${slot.appointment_medium || null},
          ${slot.appointment_addr || null},
          ${slot.instructions || null},
          ${slot.event_id || null},
          ${slot.metadata ? JSON.stringify(slot.metadata) : '{}'}::jsonb
        )
        RETURNING id::text, code, name, from_ts::text, to_ts::text, created_ts::text
      `;

      const result = await insertQuery;
      const newSlot = result[0];

      // Register in entity_instance_id
      await client`
        INSERT INTO app.d_entity_instance_registry (entity_type, entity_id, entity_name, entity_code)
        VALUES ('person_calendar', ${newSlot.id}::uuid, ${newSlot.name}, ${newSlot.code})
        ON CONFLICT (entity_type, entity_id) DO UPDATE
        SET entity_name = EXCLUDED.entity_name,
            entity_code = EXCLUDED.entity_code,
            updated_ts = now()
      `;

      console.log(`✅ Created calendar slot: ${newSlot.code}`);

      reply.code(201).send(newSlot);
    } catch (error) {
      console.error('Error creating calendar slot:', error);
      reply.code(500).send({ error: 'Failed to create calendar slot' });
    }
  });

  /**
   * PATCH /api/v1/person-calendar/:id
   * Update calendar slot (e.g., book it, cancel it, update details)
   */
  fastify.patch<{
    Params: { id: string };
    Body: UpdatePersonCalendarRequest;
  }>('/api/v1/person-calendar/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const updates = request.body;

      const updateQuery = client`
        UPDATE app.d_entity_person_calendar
        SET
          name = COALESCE(${updates.name !== undefined ? updates.name : null}, name),
          descr = COALESCE(${updates.descr !== undefined ? updates.descr : null}, descr),
          availability_flag = COALESCE(${updates.availability_flag !== undefined ? updates.availability_flag : null}, availability_flag),
          title = COALESCE(${updates.title !== undefined ? updates.title : null}, title),
          appointment_medium = COALESCE(${updates.appointment_medium !== undefined ? updates.appointment_medium : null}, appointment_medium),
          appointment_addr = COALESCE(${updates.appointment_addr !== undefined ? updates.appointment_addr : null}, appointment_addr),
          instructions = COALESCE(${updates.instructions !== undefined ? updates.instructions : null}, instructions),
          event_id = COALESCE(${updates.event_id !== undefined ? updates.event_id : null}, event_id),
          metadata = COALESCE(${updates.metadata ? JSON.stringify(updates.metadata) : null}::jsonb, metadata),
          reminder_sent_flag = COALESCE(${updates.reminder_sent_flag !== undefined ? updates.reminder_sent_flag : null}, reminder_sent_flag),
          reminder_sent_ts = CASE WHEN ${updates.reminder_sent_flag !== undefined ? updates.reminder_sent_flag : false} = true THEN now() ELSE reminder_sent_ts END,
          confirmation_sent_flag = COALESCE(${updates.confirmation_sent_flag !== undefined ? updates.confirmation_sent_flag : null}, confirmation_sent_flag),
          confirmation_sent_ts = CASE WHEN ${updates.confirmation_sent_flag !== undefined ? updates.confirmation_sent_flag : false} = true THEN now() ELSE confirmation_sent_ts END,
          updated_ts = now(),
          version = version + 1
        WHERE id = ${id}::uuid AND active_flag = true
        RETURNING id::text, code, name, availability_flag, title, event_id::text, updated_ts::text
      `;

      const result = await updateQuery;

      if (result.length === 0) {
        return reply.code(404).send({ error: 'Calendar slot not found' });
      }

      console.log(`✅ Updated calendar slot: ${result[0].code}`);

      reply.code(200).send(result[0]);
    } catch (error) {
      console.error('Error updating calendar slot:', error);
      reply.code(500).send({ error: 'Failed to update calendar slot' });
    }
  });

  /**
   * POST /api/v1/person-calendar/book
   * Book a time slot (mark as unavailable and populate booking details)
   */
  fastify.post<{
    Body: {
      slot_ids: string[];
      title: string;
      event_id?: string;
      appointment_medium?: string;
      appointment_addr?: string;
      instructions?: string;
      metadata?: Record<string, any>;
    };
  }>('/api/v1/person-calendar/book', async (request, reply) => {
    try {
      const { slot_ids, title, event_id, appointment_medium, appointment_addr, instructions, metadata } = request.body;

      const bookQuery = client`
        UPDATE app.d_entity_person_calendar
        SET
          availability_flag = false,
          title = ${title},
          event_id = ${event_id || null},
          appointment_medium = ${appointment_medium || null},
          appointment_addr = ${appointment_addr || null},
          instructions = ${instructions || null},
          metadata = ${metadata ? JSON.stringify(metadata) : '{}'}::jsonb,
          updated_ts = now(),
          version = version + 1
        WHERE id = ANY(${slot_ids.map(id => id)}::uuid[])
          AND active_flag = true
          AND availability_flag = true
        RETURNING id::text, code, name, title, event_id::text, from_ts::text, to_ts::text
      `;

      const result = await bookQuery;

      if (result.length === 0) {
        return reply.code(404).send({ error: 'No available slots found to book' });
      }

      console.log(`✅ Booked ${result.length} calendar slots: ${title}`);

      reply.code(200).send({
        success: true,
        booked_slots: result.length,
        slots: result
      });
    } catch (error) {
      console.error('Error booking slots:', error);
      reply.code(500).send({ error: 'Failed to book slots' });
    }
  });

  /**
   * POST /api/v1/person-calendar/cancel
   * Cancel a booking (mark as available and clear booking details)
   */
  fastify.post<{
    Body: {
      slot_ids: string[];
    };
  }>('/api/v1/person-calendar/cancel', async (request, reply) => {
    try {
      const { slot_ids } = request.body;

      const cancelQuery = client`
        UPDATE app.d_entity_person_calendar
        SET
          availability_flag = true,
          title = NULL,
          event_id = NULL,
          appointment_medium = NULL,
          appointment_addr = NULL,
          instructions = NULL,
          metadata = '{}'::jsonb,
          updated_ts = now(),
          version = version + 1
        WHERE id = ANY(${slot_ids.map(id => id)}::uuid[])
          AND active_flag = true
          AND availability_flag = false
        RETURNING id::text, code, name, from_ts::text, to_ts::text
      `;

      const result = await cancelQuery;

      if (result.length === 0) {
        return reply.code(404).send({ error: 'No booked slots found to cancel' });
      }

      console.log(`✅ Cancelled ${result.length} calendar slots`);

      reply.code(200).send({
        success: true,
        cancelled_slots: result.length,
        slots: result
      });
    } catch (error) {
      console.error('Error cancelling slots:', error);
      reply.code(500).send({ error: 'Failed to cancel slots' });
    }
  });

  /**
   * DELETE /api/v1/person-calendar/:id
   * Soft delete calendar slot
   */
  fastify.delete<{
    Params: { id: string };
  }>('/api/v1/person-calendar/:id', async (request, reply) => {
    try {
      const { id } = request.params;

      const deleteQuery = client`
        UPDATE app.d_entity_person_calendar
        SET
          active_flag = false,
          updated_ts = now()
        WHERE id = ${id}::uuid AND active_flag = true
        RETURNING id::text, code
      `;

      const result = await deleteQuery;

      if (result.length === 0) {
        return reply.code(404).send({ error: 'Calendar slot not found' });
      }

      console.log(`✅ Deleted calendar slot: ${result[0].code}`);

      reply.code(200).send({ success: true, message: 'Calendar slot deleted successfully' });
    } catch (error) {
      console.error('Error deleting calendar slot:', error);
      reply.code(500).send({ error: 'Failed to delete calendar slot' });
    }
  });

  console.log('✅ Person Calendar routes registered');
}

export default personCalendarRoutes;
