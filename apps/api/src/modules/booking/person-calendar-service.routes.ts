/**
 * Person Calendar Service API Routes
 * Unified person-calendar API with event/calendar/notification orchestration
 * @module booking/person-calendar-service.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createBooking, cancelBooking, rescheduleBooking, type CreateBookingRequest } from './booking.service.js';

/**
 * Register person-calendar service routes
 */
export async function personCalendarServiceRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/booking/create
   * Create a complete booking with event, calendar, RSVP, and notifications
   */
  fastify.post<{
    Body: CreateBookingRequest;
  }>('/api/v1/booking/create', async (request, reply) => {
    try {
      const bookingRequest = request.body;

      // Validate required fields
      if (!bookingRequest.customerName) {
        return reply.code(400).send({ error: 'customerName is required' });
      }
      if (!bookingRequest.customerPhone) {
        return reply.code(400).send({ error: 'customerPhone is required' });
      }
      if (!bookingRequest.serviceId) {
        return reply.code(400).send({ error: 'serviceId is required' });
      }
      if (!bookingRequest.serviceName) {
        return reply.code(400).send({ error: 'serviceName is required' });
      }
      if (!bookingRequest.eventTitle) {
        return reply.code(400).send({ error: 'eventTitle is required' });
      }
      if (!bookingRequest.eventType) {
        return reply.code(400).send({ error: 'eventType is required' });
      }
      if (!bookingRequest.eventLocation) {
        return reply.code(400).send({ error: 'eventLocation is required' });
      }
      if (!bookingRequest.startTime) {
        return reply.code(400).send({ error: 'startTime is required' });
      }
      if (!bookingRequest.endTime) {
        return reply.code(400).send({ error: 'endTime is required' });
      }
      if (!bookingRequest.assignedEmployeeId) {
        return reply.code(400).send({ error: 'assignedEmployeeId is required' });
      }
      if (!bookingRequest.assignedEmployeeName) {
        return reply.code(400).send({ error: 'assignedEmployeeName is required' });
      }

      // Convert string dates to Date objects if needed
      const startTime = typeof bookingRequest.startTime === 'string'
        ? new Date(bookingRequest.startTime)
        : bookingRequest.startTime;

      const endTime = typeof bookingRequest.endTime === 'string'
        ? new Date(bookingRequest.endTime)
        : bookingRequest.endTime;

      const result = await createBooking({
        ...bookingRequest,
        startTime,
        endTime
      });

      if (!result.success) {
        return reply.code(500).send({
          error: 'Failed to create booking',
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
      console.error('Error creating booking:', error);
      reply.code(500).send({
        error: 'Failed to create booking',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/v1/booking/:eventId/cancel
   * Cancel a booking (soft delete event, release calendar slots)
   */
  fastify.post<{
    Params: { eventId: string };
    Body: { cancellationReason?: string };
  }>('/api/v1/booking/:eventId/cancel', async (request, reply) => {
    try {
      const { eventId } = request.params;
      const { cancellationReason } = request.body;

      const result = await cancelBooking(eventId, cancellationReason);

      if (!result.success) {
        return reply.code(500).send({
          error: 'Failed to cancel booking',
          details: result.error
        });
      }

      reply.code(200).send({
        success: true,
        message: 'Booking cancelled successfully',
        eventId: eventId
      });
    } catch (error) {
      console.error('Error cancelling booking:', error);
      reply.code(500).send({
        error: 'Failed to cancel booking',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/v1/booking/:eventId/reschedule
   * Reschedule a booking (update event times, move calendar slots)
   */
  fastify.post<{
    Params: { eventId: string };
    Body: {
      newStartTime: string | Date;
      newEndTime: string | Date;
      rescheduleReason?: string;
    };
  }>('/api/v1/booking/:eventId/reschedule', async (request, reply) => {
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

      const result = await rescheduleBooking({
        eventId,
        newStartTime: startTime,
        newEndTime: endTime,
        rescheduleReason
      });

      if (!result.success) {
        return reply.code(500).send({
          error: 'Failed to reschedule booking',
          details: result.error
        });
      }

      reply.code(200).send({
        success: true,
        message: 'Booking rescheduled successfully',
        eventId: eventId,
        calendarSlotsUpdated: result.calendarSlotsUpdated
      });
    } catch (error) {
      console.error('Error rescheduling booking:', error);
      reply.code(500).send({
        error: 'Failed to reschedule booking',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  console.log('✅ Person-calendar service routes registered');
}

export default personCalendarServiceRoutes;
