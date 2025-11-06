/**
 * Event API Routes
 * Manages events/meetings/appointments with calendar invite email support
 * @module event/routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { client, db } from '../../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import {
  sendEventInvitesToAttendees,
  sendEventInviteToEmployee,
  sendEventInviteToCustomer
} from '../email/email.service.js';
import { paginateQuery, getPaginationParams } from '../../lib/pagination.js';

/**
 * Event creation request
 */
interface CreateEventRequest {
  code: string;
  name: string;
  descr?: string;
  event_entity_action?: string;
  event_medium: 'onsite' | 'virtual';
  event_addr?: string;
  event_instructions?: string;
  event_metadata?: {
    project_id?: string;
    task_id?: string;
    customer_id?: string;
    attendee_ids?: string[];
    [key: string]: any;
  };
  // Calendar slot details
  start_time?: string; // ISO timestamp
  end_time?: string; // ISO timestamp
  timezone?: string;
  // Email notification options
  send_invites?: boolean; // Default: true
  organizer_name?: string;
  organizer_email?: string;
}

/**
 * Event update request
 */
interface UpdateEventRequest {
  name?: string;
  descr?: string;
  event_entity_action?: string;
  event_medium?: 'onsite' | 'virtual';
  event_addr?: string;
  event_instructions?: string;
  event_metadata?: Record<string, any>;
  reminder_sent_flag?: boolean;
  confirmation_sent_flag?: boolean;
}

/**
 * Register event routes
 */
export async function eventRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/event
   * Get all active events
   */
  fastify.get<{
    Querystring: {
      event_medium?: string;
      event_entity_action?: string;
      page?: number;
      limit?: number;
    };
  }>('/api/v1/event', async (request, reply) => {
    try {
      const { event_medium, event_entity_action } = request.query;
      const { page, limit, offset } = getPaginationParams(request.query);

      let whereConditions = client`WHERE active_flag = true`;

      if (event_medium) {
        whereConditions = client`${whereConditions} AND event_medium = ${event_medium}`;
      }

      if (event_entity_action) {
        whereConditions = client`${whereConditions} AND event_entity_action = ${event_entity_action}`;
      }

      const dataQuery = client`
        SELECT
          id::text,
          code,
          name,
          descr,
          metadata,
          event_entity_action,
          event_medium,
          event_addr,
          event_instructions,
          event_metadata,
          reminder_sent_flag,
          reminder_sent_ts::text,
          confirmation_sent_flag,
          confirmation_sent_ts::text,
          active_flag,
          created_ts::text,
          updated_ts::text,
          version
        FROM app.d_event
        ${whereConditions}
        ORDER BY created_ts DESC
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
   * Get event by ID with linked calendar slots
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
          metadata,
          event_entity_action,
          event_medium,
          event_addr,
          event_instructions,
          event_metadata,
          reminder_sent_flag,
          reminder_sent_ts::text,
          confirmation_sent_flag,
          confirmation_sent_ts::text,
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

      // Get linked calendar slots
      const slotsQuery = client`
        SELECT
          id::text,
          code,
          person_entity_type,
          person_entity_id::text,
          from_ts::text,
          to_ts::text,
          timezone,
          availability_flag,
          title,
          appointment_medium,
          appointment_addr
        FROM app.d_entity_person_calendar
        WHERE event_id = ${id}::uuid AND active_flag = true
        ORDER BY from_ts ASC
      `;

      const slotsResult = await slotsQuery;

      reply.code(200).send({
        ...event,
        calendar_slots: slotsResult
      });
    } catch (error) {
      console.error('Error fetching event:', error);
      reply.code(500).send({ error: 'Failed to fetch event' });
    }
  });

  /**
   * POST /api/v1/event
   * Create a new event and optionally send calendar invites
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
          event_entity_action,
          event_medium,
          event_addr,
          event_instructions,
          event_metadata
        ) VALUES (
          ${eventId}::uuid,
          ${eventData.code},
          ${eventData.name},
          ${eventData.descr || null},
          ${eventData.event_entity_action || null},
          ${eventData.event_medium},
          ${eventData.event_addr || null},
          ${eventData.event_instructions || null},
          ${eventData.event_metadata ? JSON.stringify(eventData.event_metadata) : '{}'}::jsonb
        )
        RETURNING
          id::text,
          code,
          name,
          event_medium,
          event_addr,
          event_metadata,
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

      // Create calendar slots if start_time and end_time provided
      let calendarSlots = [];
      if (eventData.start_time && eventData.end_time) {
        const startTime = new Date(eventData.start_time);
        const endTime = new Date(eventData.end_time);

        // Create calendar slots for attendees if provided
        const attendeeIds = eventData.event_metadata?.attendee_ids || [];
        const customerId = eventData.event_metadata?.customer_id;

        for (const attendeeId of attendeeIds) {
          const slotCode = `CAL-${eventData.code}-${attendeeId.substring(0, 8)}`;

          const slotQuery = client`
            INSERT INTO app.d_entity_person_calendar (
              code,
              name,
              person_entity_type,
              person_entity_id,
              from_ts,
              to_ts,
              timezone,
              availability_flag,
              title,
              appointment_medium,
              appointment_addr,
              event_id,
              metadata
            ) VALUES (
              ${slotCode},
              ${eventData.name},
              'employee',
              ${attendeeId}::uuid,
              ${eventData.start_time}::timestamptz,
              ${eventData.end_time}::timestamptz,
              ${eventData.timezone || 'America/Toronto'},
              false,
              ${eventData.name},
              ${eventData.event_medium},
              ${eventData.event_addr || null},
              ${newEvent.id}::uuid,
              ${eventData.event_metadata ? JSON.stringify(eventData.event_metadata) : '{}'}::jsonb
            )
            RETURNING id::text, code
          `;

          const slotResult = await slotQuery;
          calendarSlots.push(slotResult[0]);
        }

        // Create calendar slot for customer if provided
        if (customerId) {
          const custSlotCode = `CAL-${eventData.code}-CUST`;

          const custSlotQuery = client`
            INSERT INTO app.d_entity_person_calendar (
              code,
              name,
              person_entity_type,
              person_entity_id,
              from_ts,
              to_ts,
              timezone,
              availability_flag,
              title,
              appointment_medium,
              appointment_addr,
              event_id,
              metadata
            ) VALUES (
              ${custSlotCode},
              ${eventData.name},
              'customer',
              ${customerId}::uuid,
              ${eventData.start_time}::timestamptz,
              ${eventData.end_time}::timestamptz,
              ${eventData.timezone || 'America/Toronto'},
              false,
              ${eventData.name},
              ${eventData.event_medium},
              ${eventData.event_addr || null},
              ${newEvent.id}::uuid,
              ${eventData.event_metadata ? JSON.stringify(eventData.event_metadata) : '{}'}::jsonb
            )
            RETURNING id::text, code
          `;

          const custSlotResult = await custSlotQuery;
          calendarSlots.push(custSlotResult[0]);
        }

        console.log(`✅ Created ${calendarSlots.length} calendar slots for event ${newEvent.code}`);
      }

      // Send calendar invites if requested (default: true)
      const sendInvites = eventData.send_invites !== false;
      let inviteResults = { totalSent: 0, totalFailed: 0, results: [] };

      if (sendInvites && eventData.start_time && eventData.end_time) {
        const organizerName = eventData.organizer_name || 'Huron Home Services';
        const organizerEmail = eventData.organizer_email || 'noreply@huronhome.ca';

        inviteResults = await sendEventInvitesToAttendees({
          eventId: newEvent.id,
          eventTitle: eventData.name,
          eventDescription: eventData.descr,
          eventLocation: eventData.event_addr,
          startTime: new Date(eventData.start_time),
          endTime: new Date(eventData.end_time),
          organizerName,
          organizerEmail,
          meetingUrl: eventData.event_medium === 'virtual' ? eventData.event_addr : undefined,
          attendeeIds: eventData.event_metadata?.attendee_ids,
          customerId: eventData.event_metadata?.customer_id
        });

        // Update confirmation_sent_flag if at least one invite was sent
        if (inviteResults.totalSent > 0) {
          await client`
            UPDATE app.d_event
            SET
              confirmation_sent_flag = true,
              confirmation_sent_ts = now()
            WHERE id = ${newEvent.id}::uuid
          `;
        }

        console.log(`✅ Sent ${inviteResults.totalSent} calendar invites for event ${newEvent.code}`);
      }

      reply.code(201).send({
        ...newEvent,
        calendar_slots: calendarSlots,
        invite_results: sendInvites ? inviteResults : null
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
          event_entity_action = COALESCE(${updates.event_entity_action || null}, event_entity_action),
          event_medium = COALESCE(${updates.event_medium || null}, event_medium),
          event_addr = COALESCE(${updates.event_addr || null}, event_addr),
          event_instructions = COALESCE(${updates.event_instructions || null}, event_instructions),
          event_metadata = COALESCE(${updates.event_metadata ? JSON.stringify(updates.event_metadata) : null}::jsonb, event_metadata),
          reminder_sent_flag = COALESCE(${updates.reminder_sent_flag !== undefined ? updates.reminder_sent_flag : null}, reminder_sent_flag),
          reminder_sent_ts = CASE WHEN ${updates.reminder_sent_flag} = true THEN now() ELSE reminder_sent_ts END,
          confirmation_sent_flag = COALESCE(${updates.confirmation_sent_flag !== undefined ? updates.confirmation_sent_flag : null}, confirmation_sent_flag),
          confirmation_sent_ts = CASE WHEN ${updates.confirmation_sent_flag} = true THEN now() ELSE confirmation_sent_ts END,
          updated_ts = now(),
          version = version + 1
        WHERE id = ${id}::uuid AND active_flag = true
        RETURNING
          id::text,
          code,
          name,
          event_medium,
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
   * Soft delete event and cancel linked calendar slots
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

      // Also mark linked calendar slots as cancelled (available)
      await client`
        UPDATE app.d_entity_person_calendar
        SET
          availability_flag = true,
          event_id = NULL,
          updated_ts = now()
        WHERE event_id = ${id}::uuid AND active_flag = true
      `;

      console.log(`✅ Deleted event and cancelled calendar slots: ${result[0].code}`);

      reply.code(200).send({
        success: true,
        message: 'Event deleted and calendar slots cancelled successfully',
        event: result[0]
      });
    } catch (error) {
      console.error('Error deleting event:', error);
      reply.code(500).send({ error: 'Failed to delete event' });
    }
  });

  /**
   * POST /api/v1/event/:id/send-invites
   * Manually send/resend calendar invites for an event
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      organizer_name?: string;
      organizer_email?: string;
    };
  }>('/api/v1/event/:id/send-invites', async (request, reply) => {
    try {
      const { id } = request.params;
      const { organizer_name, organizer_email } = request.body;

      // Get event details
      const eventQuery = client`
        SELECT
          id::text,
          code,
          name,
          descr,
          event_medium,
          event_addr,
          event_metadata
        FROM app.d_event
        WHERE id = ${id}::uuid AND active_flag = true
      `;

      const eventResult = await eventQuery;

      if (eventResult.length === 0) {
        return reply.code(404).send({ error: 'Event not found' });
      }

      const event = eventResult[0];

      // Get calendar slots to determine start/end time
      const slotsQuery = client`
        SELECT
          MIN(from_ts) as start_time,
          MAX(to_ts) as end_time
        FROM app.d_entity_person_calendar
        WHERE event_id = ${id}::uuid AND active_flag = true
      `;

      const slotsResult = await slotsQuery;

      if (!slotsResult[0]?.start_time || !slotsResult[0]?.end_time) {
        return reply.code(400).send({ error: 'Event has no calendar slots with time information' });
      }

      const startTime = new Date(slotsResult[0].start_time);
      const endTime = new Date(slotsResult[0].end_time);

      // Send invites
      const inviteResults = await sendEventInvitesToAttendees({
        eventId: event.id,
        eventTitle: event.name,
        eventDescription: event.descr,
        eventLocation: event.event_addr,
        startTime,
        endTime,
        organizerName: organizer_name || 'Huron Home Services',
        organizerEmail: organizer_email || 'noreply@huronhome.ca',
        meetingUrl: event.event_medium === 'virtual' ? event.event_addr : undefined,
        attendeeIds: event.event_metadata?.attendee_ids,
        customerId: event.event_metadata?.customer_id
      });

      // Update confirmation_sent_flag
      if (inviteResults.totalSent > 0) {
        await client`
          UPDATE app.d_event
          SET
            confirmation_sent_flag = true,
            confirmation_sent_ts = now()
          WHERE id = ${id}::uuid
        `;
      }

      console.log(`✅ Sent ${inviteResults.totalSent} calendar invites for event ${event.code}`);

      reply.code(200).send({
        success: true,
        event_code: event.code,
        ...inviteResults
      });
    } catch (error) {
      console.error('Error sending event invites:', error);
      reply.code(500).send({ error: 'Failed to send event invites' });
    }
  });

  console.log('✅ Event routes registered');
}

export default eventRoutes;
