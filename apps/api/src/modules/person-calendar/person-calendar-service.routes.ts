/**
 * Person Calendar Service API Routes
 * Unified person-calendar API with event/calendar/notification orchestration
 * @module booking/person-calendar-service.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createPersonCalendar, cancelPersonCalendar, reschedulePersonCalendar, type CreatePersonCalendarRequest } from './person-calendar.service.js';

/**
 * Register person-calendar service routes
 */
export async function personCalendarServiceRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/person-calendar/create
   * Create a complete person-calendar booking with event, calendar, RSVP, and notifications
   */
  fastify.post<{
    Body: CreatePersonCalendarRequest;
  }>('/api/v1/person-calendar/create', async (request, reply) => {
    try {
      const personCalendarRequest = request.body;

      // Validate required fields
      if (!personCalendarRequest.customerName) {
        return reply.code(400).send({ error: 'customerName is required' });
      }
      if (!personCalendarRequest.customerPhone) {
        return reply.code(400).send({ error: 'customerPhone is required' });
      }
      if (!personCalendarRequest.serviceId) {
        return reply.code(400).send({ error: 'serviceId is required' });
      }
      if (!personCalendarRequest.serviceName) {
        return reply.code(400).send({ error: 'serviceName is required' });
      }
      if (!personCalendarRequest.eventTitle) {
        return reply.code(400).send({ error: 'eventTitle is required' });
      }
      if (!personCalendarRequest.eventType) {
        return reply.code(400).send({ error: 'eventType is required' });
      }
      if (!personCalendarRequest.eventLocation) {
        return reply.code(400).send({ error: 'eventLocation is required' });
      }
      if (!personCalendarRequest.startTime) {
        return reply.code(400).send({ error: 'startTime is required' });
      }
      if (!personCalendarRequest.endTime) {
        return reply.code(400).send({ error: 'endTime is required' });
      }
      if (!personCalendarRequest.assignedEmployeeId) {
        return reply.code(400).send({ error: 'assignedEmployeeId is required' });
      }
      if (!personCalendarRequest.assignedEmployeeName) {
        return reply.code(400).send({ error: 'assignedEmployeeName is required' });
      }

      // Convert string dates to Date objects if needed
      const startTime = typeof personCalendarRequest.startTime === 'string'
        ? new Date(personCalendarRequest.startTime)
        : personCalendarRequest.startTime;

      const endTime = typeof personCalendarRequest.endTime === 'string'
        ? new Date(personCalendarRequest.endTime)
        : personCalendarRequest.endTime;

      const result = await createPersonCalendar({
        ...personCalendarRequest,
        startTime,
        endTime
      });

      if (!result.success) {
        return reply.code(500).send({
          error: 'Failed to create person-calendar',
          details: result.error
        });
      }

      reply.code(201).send({
        success: true,
        data: {
          eventId: result.eventId,
          eventCode: result.eventCode,
          bookingNumber: result.bookingNumber,
          calendarSlotsBooked: result.calendarSlotsBooked,
          attendeesLinked: result.attendeesLinked,
          notificationsSent: result.notificationsSent
        }
      });
    } catch (error) {
      console.error('Error creating person-calendar:', error);
      reply.code(500).send({
        error: 'Failed to create person-calendar',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/v1/person-calendar/:eventId/cancel
   * Cancel a person-calendar (soft delete event, release calendar slots)
   */
  fastify.post<{
    Params: { eventId: string };
    Body: { cancellationReason?: string };
  }>('/api/v1/person-calendar/:eventId/cancel', async (request, reply) => {
    try {
      const { eventId } = request.params;
      const { cancellationReason } = request.body;

      const result = await cancelPersonCalendar(eventId, cancellationReason);

      if (!result.success) {
        return reply.code(500).send({
          error: 'Failed to cancel person-calendar',
          details: result.error
        });
      }

      reply.code(200).send({
        success: true,
        message: 'Person-calendar cancelled successfully',
        eventId: eventId
      });
    } catch (error) {
      console.error('Error cancelling person-calendar:', error);
      reply.code(500).send({
        error: 'Failed to cancel person-calendar',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/v1/person-calendar/:eventId/reschedule
   * Reschedule a person-calendar (update event times, move calendar slots)
   */
  fastify.post<{
    Params: { eventId: string };
    Body: {
      newStartTime: string | Date;
      newEndTime: string | Date;
      rescheduleReason?: string;
    };
  }>('/api/v1/person-calendar/:eventId/reschedule', async (request, reply) => {
    try {
      const { eventId } = request.params;
      const { newStartTime, newEndTime, rescheduleReason } = request.body;

      if (!newStartTime || !newEndTime) {
        return reply.code(400).send({
          error: 'newStartTime and newEndTime are required'
        });
      }

      // Convert string dates to Date objects if needed
      const startTime = typeof newStartTime === 'string'
        ? new Date(newStartTime)
        : newStartTime;

      const endTime = typeof newEndTime === 'string'
        ? new Date(newEndTime)
        : newEndTime;

      const result = await reschedulePersonCalendar({
        eventId,
        newStartTime: startTime,
        newEndTime: endTime,
        rescheduleReason
      });

      if (!result.success) {
        return reply.code(500).send({
          error: 'Failed to reschedule person-calendar',
          details: result.error
        });
      }

      reply.code(200).send({
        success: true,
        message: 'Person-calendar rescheduled successfully',
        eventId: eventId,
        calendarSlotsUpdated: result.calendarSlotsUpdated
      });
    } catch (error) {
      console.error('Error rescheduling person-calendar:', error);
      reply.code(500).send({
        error: 'Failed to reschedule person-calendar',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  console.log('✅ Person-calendar service routes registered');
}

export default personCalendarServiceRoutes;
