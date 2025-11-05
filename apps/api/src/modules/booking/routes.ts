/**
 * Booking API Routes
 * @module booking/routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { client, db } from '../../db/index.js';
import type { Booking, CreateBookingRequest, UpdateBookingRequest } from './types.js';

/**
 * Register booking routes
 */
export async function bookingRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/booking
   * Get all active bookings
   */
  fastify.get('/api/v1/booking', async (request, reply) => {
    try {
      const query = client`
        SELECT
          id::text,
          code,
          name,
          descr,
          booking_number,
          booking_source,
          customer_id::text,
          customer_name,
          customer_email,
          customer_phone,
          customer_address,
          customer_city,
          customer_province,
          customer_postal_code,
          service_id::text,
          service_name,
          service_category,
          requested_date::text,
          requested_time_start::text,
          requested_time_end::text,
          scheduled_ts::text,
          assigned_employee_id::text,
          assigned_employee_name,
          booking_status,
          estimated_cost_amt,
          quoted_cost_amt,
          final_cost_amt,
          urgency_level,
          special_instructions,
          confirmed_ts::text,
          cancelled_ts::text,
          cancellation_reason,
          customer_rating,
          customer_feedback,
          metadata,
          active_flag,
          created_ts::text,
          updated_ts::text
        FROM app.d_booking
        WHERE active_flag = true
        ORDER BY created_ts DESC
      `;

      const result = await query;
      reply.code(200).send(result.rows);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      reply.code(500).send({ error: 'Failed to fetch bookings' });
    }
  });

  /**
   * GET /api/v1/booking/:id
   * Get booking by ID
   */
  fastify.get<{
    Params: { id: string };
  }>('/api/v1/booking/:id', async (request, reply) => {
    try {
      const { id } = request.params;

      const query = client`
        SELECT
          id::text,
          code,
          name,
          descr,
          booking_number,
          booking_source,
          customer_id::text,
          customer_name,
          customer_email,
          customer_phone,
          customer_address,
          customer_city,
          customer_province,
          customer_postal_code,
          service_id::text,
          service_name,
          service_category,
          requested_date::text,
          requested_time_start::text,
          requested_time_end::text,
          scheduled_ts::text,
          actual_start_ts::text,
          actual_end_ts::text,
          assigned_employee_id::text,
          assigned_employee_name,
          assigned_team_id::text,
          booking_status,
          estimated_cost_amt,
          quoted_cost_amt,
          final_cost_amt,
          deposit_amt,
          deposit_paid_flag,
          urgency_level,
          special_instructions,
          property_access_instructions,
          parking_instructions,
          pet_information,
          confirmed_ts::text,
          confirmed_by_employee_id::text,
          assigned_ts::text,
          assigned_by_employee_id::text,
          started_ts::text,
          completed_ts::text,
          cancelled_ts::text,
          cancellation_reason,
          cancelled_by_employee_id::text,
          calendar_event_id::text,
          interaction_session_id::text,
          project_id::text,
          confirmation_email_sent_flag,
          confirmation_sms_sent_flag,
          reminder_sent_flag,
          follow_up_required_flag,
          follow_up_completed_flag,
          follow_up_notes,
          customer_rating,
          customer_feedback,
          would_recommend_flag,
          weather_conditions,
          weather_impact_flag,
          rescheduled_flag,
          rescheduled_from_date::text,
          reschedule_reason,
          metadata,
          active_flag,
          from_ts::text,
          to_ts::text,
          created_ts::text,
          updated_ts::text,
          version
        FROM app.d_booking
        WHERE id = ${id}::uuid AND active_flag = true
      `;

      const result = await query;

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Booking not found' });
      }

      reply.code(200).send(result.rows[0]);
    } catch (error) {
      console.error('Error fetching booking:', error);
      reply.code(500).send({ error: 'Failed to fetch booking' });
    }
  });

  /**
   * POST /api/v1/booking
   * Create a new booking
   */
  fastify.post<{
    Body: CreateBookingRequest;
  }>('/api/v1/booking', async (request, reply) => {
    try {
      const booking = request.body;

      const insertQuery = client`
        INSERT INTO app.d_booking (
          code,
          name,
          descr,
          booking_number,
          booking_source,
          customer_id,
          customer_name,
          customer_email,
          customer_phone,
          customer_address,
          customer_city,
          customer_province,
          customer_postal_code,
          service_id,
          service_name,
          service_category,
          requested_date,
          requested_time_start,
          requested_time_end,
          assigned_employee_id,
          special_instructions,
          urgency_level,
          property_access_instructions,
          parking_instructions,
          pet_information,
          estimated_cost_amt
        ) VALUES (
          ${booking.code},
          ${booking.name},
          ${booking.descr || null},
          ${booking.booking_number},
          ${booking.booking_source || 'web_form'},
          ${booking.customer_id ? client`${booking.customer_id}::uuid` : client`NULL`},
          ${booking.customer_name},
          ${booking.customer_email || null},
          ${booking.customer_phone},
          ${booking.customer_address || null},
          ${booking.customer_city || null},
          ${booking.customer_province || 'ON'},
          ${booking.customer_postal_code || null},
          ${booking.service_id}::uuid,
          ${booking.service_name},
          ${booking.service_category || null},
          ${booking.requested_date}::date,
          ${booking.requested_time_start ? client`${booking.requested_time_start}::time` : client`NULL`},
          ${booking.requested_time_end ? client`${booking.requested_time_end}::time` : client`NULL`},
          ${booking.assigned_employee_id ? client`${booking.assigned_employee_id}::uuid` : client`NULL`},
          ${booking.special_instructions || null},
          ${booking.urgency_level || 'normal'},
          ${booking.property_access_instructions || null},
          ${booking.parking_instructions || null},
          ${booking.pet_information || null},
          ${booking.estimated_cost_amt || null}
        )
        RETURNING id::text, code, name, booking_number, created_ts::text
      `;

      const result = await insertQuery;
      const newBooking = result.rows[0];

      // Register in entity_instance_id
      await client`
        INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
        VALUES ('booking', ${newBooking.id}::uuid, ${newBooking.name}, ${newBooking.code})
        ON CONFLICT (entity_type, entity_id) DO UPDATE
        SET entity_name = EXCLUDED.entity_name,
            entity_code = EXCLUDED.entity_code,
            updated_ts = now()
      `;

      console.log(`✅ Created booking: ${newBooking.booking_number}`);

      reply.code(201).send(newBooking);
    } catch (error) {
      console.error('Error creating booking:', error);
      reply.code(500).send({ error: 'Failed to create booking' });
    }
  });

  /**
   * PATCH /api/v1/booking/:id
   * Update booking
   */
  fastify.patch<{
    Params: { id: string };
    Body: UpdateBookingRequest;
  }>('/api/v1/booking/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const updates = request.body;

      const updateQuery = client`
        UPDATE app.d_booking
        SET
          name = COALESCE(${updates.name || null}, name),
          descr = COALESCE(${updates.descr || null}, descr),
          booking_status = COALESCE(${updates.booking_status || null}, booking_status),
          assigned_employee_id = COALESCE(${updates.assigned_employee_id ? client`${updates.assigned_employee_id}::uuid` : client`NULL`}, assigned_employee_id),
          assigned_employee_name = COALESCE(${updates.assigned_employee_name || null}, assigned_employee_name),
          scheduled_ts = COALESCE(${updates.scheduled_ts ? client`${updates.scheduled_ts}::timestamptz` : client`NULL`}, scheduled_ts),
          confirmed_ts = COALESCE(${updates.confirmed_ts ? client`${updates.confirmed_ts}::timestamptz` : client`NULL`}, confirmed_ts),
          special_instructions = COALESCE(${updates.special_instructions || null}, special_instructions),
          customer_rating = COALESCE(${updates.customer_rating || null}, customer_rating),
          customer_feedback = COALESCE(${updates.customer_feedback || null}, customer_feedback),
          cancellation_reason = COALESCE(${updates.cancellation_reason || null}, cancellation_reason),
          cancelled_ts = CASE WHEN ${updates.booking_status} = 'cancelled' THEN now() ELSE cancelled_ts END,
          updated_ts = now(),
          version = version + 1
        WHERE id = ${id}::uuid AND active_flag = true
        RETURNING id::text, code, name, booking_number, booking_status, updated_ts::text
      `;

      const result = await updateQuery;

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Booking not found' });
      }

      console.log(`✅ Updated booking: ${result.rows[0].booking_number}`);

      reply.code(200).send(result.rows[0]);
    } catch (error) {
      console.error('Error updating booking:', error);
      reply.code(500).send({ error: 'Failed to update booking' });
    }
  });

  /**
   * DELETE /api/v1/booking/:id
   * Soft delete booking
   */
  fastify.delete<{
    Params: { id: string };
  }>('/api/v1/booking/:id', async (request, reply) => {
    try {
      const { id } = request.params;

      const deleteQuery = client`
        UPDATE app.d_booking
        SET
          active_flag = false,
          to_ts = now(),
          updated_ts = now()
        WHERE id = ${id}::uuid AND active_flag = true
        RETURNING id::text, booking_number
      `;

      const result = await deleteQuery;

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Booking not found' });
      }

      console.log(`✅ Deleted booking: ${result.rows[0].booking_number}`);

      reply.code(200).send({ success: true, message: 'Booking deleted successfully' });
    } catch (error) {
      console.error('Error deleting booking:', error);
      reply.code(500).send({ error: 'Failed to delete booking' });
    }
  });

  /**
   * GET /api/v1/booking/search/:bookingNumber
   * Search booking by booking number
   */
  fastify.get<{
    Params: { bookingNumber: string };
  }>('/api/v1/booking/search/:bookingNumber', async (request, reply) => {
    try {
      const { bookingNumber } = request.params;

      const query = client`
        SELECT
          id::text,
          code,
          name,
          booking_number,
          booking_status,
          customer_name,
          service_name,
          requested_date::text,
          requested_time_start::text,
          assigned_employee_name,
          created_ts::text
        FROM app.d_booking
        WHERE booking_number = ${bookingNumber}
          AND active_flag = true
      `;

      const result = await query;

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Booking not found' });
      }

      reply.code(200).send(result.rows[0]);
    } catch (error) {
      console.error('Error searching booking:', error);
      reply.code(500).send({ error: 'Failed to search booking' });
    }
  });

  console.log('✅ Booking routes registered');
}

export default bookingRoutes;
