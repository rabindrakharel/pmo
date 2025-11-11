/**
 * Unified Booking Service
 * Orchestrates the complete booking flow:
 * 1. Create event in d_event
 * 2. Link attendees in d_entity_event_person_calendar (RSVP tracking)
 * 3. Book calendar slots in d_entity_person_calendar (mark unavailable)
 * 4. Link entities in d_entity_id_map (event → service, customer, etc.)
 * 5. Send email/SMS notifications with calendar invites
 * @module booking/booking.service
 */

import { client } from '../../db/index.js';
import { sendEventInvitesToAttendees, sendEventInviteToCustomer, sendEventInviteToEmployee } from '../email/email.service.js';

/**
 * Booking request from customer or agent
 */
export interface CreateBookingRequest {
  // Customer details
  customerId?: string; // d_cust.id (optional - may be new customer)
  customerName: string;
  customerEmail?: string;
  customerPhone: string;

  // Service details
  serviceId: string; // d_service.id
  serviceName: string;
  serviceCategory?: string; // 'HVAC', 'Plumbing', 'Electrical', etc.

  // Event details
  eventTitle: string;
  eventDescription?: string;
  eventType: 'onsite' | 'virtual';
  eventLocation: string; // Physical address OR meeting URL
  eventInstructions?: string; // Access codes, parking, preparation notes

  // Time slot
  startTime: Date;
  endTime: Date;
  timezone?: string; // Default: 'America/Toronto'

  // Assignment
  assignedEmployeeId: string; // d_employee.id
  assignedEmployeeName: string;

  // Additional context
  urgencyLevel?: 'low' | 'normal' | 'high' | 'urgent' | 'emergency';
  specialInstructions?: string;
  projectId?: string; // Optional parent project
  interactionSessionId?: string; // Link to f_customer_interaction

  // Organizer (for calendar invite)
  organizerName?: string; // Defaults to company name
  organizerEmail?: string; // Defaults to SMTP_FROM
}

/**
 * Booking confirmation response
 */
export interface BookingConfirmation {
  success: boolean;
  eventId: string;
  eventCode: string;
  bookingNumber: string; // Human-readable reference (e.g., 'BK-2025-001234')
  calendarSlotsBooked: number;
  attendeesLinked: number;
  notificationsSent: {
    totalSent: number;
    totalFailed: number;
    details: Array<{ id: string; success: boolean; error?: string }>;
  };
  error?: string;
}

/**
 * Generate booking number (BK-YYYY-NNNNNN)
 */
async function generateBookingNumber(): Promise<string> {
  const year = new Date().getFullYear();

  // Get the count of events created today
  const result = await client`
    SELECT COUNT(*) as count
    FROM app.d_event
    WHERE DATE(created_ts) = CURRENT_DATE
  `;

  const count = parseInt(result[0]?.count || '0', 10);
  const paddedCount = (count + 1).toString().padStart(6, '0');

  return `BK-${year}-${paddedCount}`;
}

/**
 * Create a complete booking with event, calendar, RSVP, and notifications
 */
export async function createBooking(request: CreateBookingRequest): Promise<BookingConfirmation> {
  const {
    customerId,
    customerName,
    customerEmail,
    customerPhone,
    serviceId,
    serviceName,
    serviceCategory,
    eventTitle,
    eventDescription,
    eventType,
    eventLocation,
    eventInstructions,
    startTime,
    endTime,
    timezone = 'America/Toronto',
    assignedEmployeeId,
    assignedEmployeeName,
    urgencyLevel = 'normal',
    specialInstructions,
    projectId,
    interactionSessionId,
    organizerName = 'Huron Home Services',
    organizerEmail = process.env.SMTP_FROM || 'solutions@cohuron.com'
  } = request;

  try {
    // ===============================================
    // STEP 1: Create Event in d_event
    // ===============================================

    const bookingNumber = await generateBookingNumber();
    const eventCode = `EVT-${bookingNumber}`;

    const eventResult = await client`
      INSERT INTO app.d_event (
        code, name, descr,
        event_type, event_platform_provider_name, event_addr, event_instructions,
        from_ts, to_ts, timezone,
        event_metadata
      ) VALUES (
        ${eventCode},
        ${eventTitle},
        ${eventDescription || ''},
        ${eventType},
        ${eventType === 'onsite' ? 'office' : 'zoom'},
        ${eventLocation},
        ${eventInstructions || specialInstructions || ''},
        ${startTime.toISOString()}::timestamptz,
        ${endTime.toISOString()}::timestamptz,
        ${timezone},
        ${JSON.stringify({
          booking_number: bookingNumber,
          service_id: serviceId,
          service_name: serviceName,
          service_category: serviceCategory,
          customer_id: customerId,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          urgency_level: urgencyLevel,
          project_id: projectId,
          interaction_session_id: interactionSessionId
        })}::jsonb
      )
      RETURNING id::text, code, name
    `;

    const event = eventResult[0];
    const eventId = event.id;

    console.log(`✅ Created event: ${event.code} (${eventId})`);

    // Register in entity_instance_id
    await client`
      INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
      VALUES ('event', ${eventId}::uuid, ${event.name}, ${event.code})
      ON CONFLICT (entity_type, entity_id) DO UPDATE
      SET entity_name = EXCLUDED.entity_name,
          entity_code = EXCLUDED.entity_code,
          updated_ts = now()
    `;

    // ===============================================
    // STEP 2: Link Attendees (RSVP Tracking)
    // ===============================================

    const attendees: Array<{ person_entity_type: string; person_entity_id: string; rsvp_status: string }> = [];

    // Add customer (if customerId provided)
    if (customerId) {
      attendees.push({
        person_entity_type: 'customer',
        person_entity_id: customerId,
        rsvp_status: 'pending'
      });
    }

    // Add assigned employee
    attendees.push({
      person_entity_type: 'employee',
      person_entity_id: assignedEmployeeId,
      rsvp_status: 'accepted'
    });

    // Insert attendees into d_entity_event_person_calendar
    for (const attendee of attendees) {
      await client`
        INSERT INTO app.d_entity_event_person_calendar (
          person_entity_type, person_entity_id, event_id,
          event_rsvp_status, from_ts, to_ts
        ) VALUES (
          ${attendee.person_entity_type},
          ${attendee.person_entity_id}::uuid,
          ${eventId}::uuid,
          ${attendee.rsvp_status},
          ${startTime.toISOString()}::timestamptz,
          ${endTime.toISOString()}::timestamptz
        )
      `;
    }

    console.log(`✅ Linked ${attendees.length} attendees to event`);

    // ===============================================
    // STEP 3: Book Calendar Slots
    // ===============================================

    // Find calendar slots for assigned employee in the time range
    const calendarSlotsResult = await client`
      SELECT id::text
      FROM app.d_entity_person_calendar
      WHERE person_entity_type = 'employee'
        AND person_entity_id = ${assignedEmployeeId}::uuid
        AND availability_flag = true
        AND from_ts >= ${startTime.toISOString()}::timestamptz
        AND to_ts <= ${endTime.toISOString()}::timestamptz
        AND active_flag = true
    `;

    const slotIds = calendarSlotsResult.map((row: any) => row.id);

    if (slotIds.length === 0) {
      console.warn(`⚠️ No available calendar slots found for employee ${assignedEmployeeName}`);
    } else {
      // Mark slots as booked
      await client`
        UPDATE app.d_entity_person_calendar
        SET
          availability_flag = false,
          event_id = ${eventId}::uuid,
          title = ${eventTitle},
          appointment_medium = ${eventType},
          appointment_addr = ${eventLocation},
          instructions = ${eventInstructions || specialInstructions || ''},
          updated_ts = now()
        WHERE id = ANY(${slotIds}::uuid[])
      `;

      console.log(`✅ Booked ${slotIds.length} calendar slots for employee`);
    }

    // ===============================================
    // STEP 4: Link Entities (d_entity_id_map)
    // ===============================================

    const entityLinks = [];

    // Link event → service
    entityLinks.push({
      parent_entity_type: 'event',
      parent_entity_id: eventId,
      child_entity_type: 'service',
      child_entity_id: serviceId
    });

    // Link event → customer
    if (customerId) {
      entityLinks.push({
        parent_entity_type: 'event',
        parent_entity_id: eventId,
        child_entity_type: 'customer',
        child_entity_id: customerId
      });
    }

    // Link event → project (if applicable)
    if (projectId) {
      entityLinks.push({
        parent_entity_type: 'event',
        parent_entity_id: eventId,
        child_entity_type: 'project',
        child_entity_id: projectId
      });
    }

    // Insert entity linkages
    for (const link of entityLinks) {
      await client`
        INSERT INTO app.d_entity_id_map (
          parent_entity_type, parent_entity_id,
          child_entity_type, child_entity_id
        ) VALUES (
          ${link.parent_entity_type},
          ${link.parent_entity_id}::uuid,
          ${link.child_entity_type},
          ${link.child_entity_id}::uuid
        )
      `;
    }

    console.log(`✅ Created ${entityLinks.length} entity linkages`);

    // ===============================================
    // STEP 5: Send Notifications (Email + Calendar Invite)
    // ===============================================

    const notificationResults = await sendEventInvitesToAttendees({
      eventId: eventId,
      eventTitle: eventTitle,
      eventDescription: eventDescription || specialInstructions,
      eventLocation: eventLocation,
      startTime: startTime,
      endTime: endTime,
      organizerName: organizerName,
      organizerEmail: organizerEmail,
      meetingUrl: eventType === 'virtual' ? eventLocation : undefined,
      attendeeIds: [assignedEmployeeId],
      customerId: customerId
    });

    console.log(`✅ Sent ${notificationResults.totalSent} notifications, ${notificationResults.totalFailed} failed`);

    // ===============================================
    // Return Booking Confirmation
    // ===============================================

    return {
      success: true,
      eventId: eventId,
      eventCode: eventCode,
      bookingNumber: bookingNumber,
      calendarSlotsBooked: slotIds.length,
      attendeesLinked: attendees.length,
      notificationsSent: {
        totalSent: notificationResults.totalSent,
        totalFailed: notificationResults.totalFailed,
        details: notificationResults.results
      }
    };
  } catch (error) {
    console.error('Failed to create booking:', error);
    return {
      success: false,
      eventId: '',
      eventCode: '',
      bookingNumber: '',
      calendarSlotsBooked: 0,
      attendeesLinked: 0,
      notificationsSent: {
        totalSent: 0,
        totalFailed: 0,
        details: []
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Cancel a booking (soft delete event, release calendar slots, send cancellation notices)
 */
export async function cancelBooking(eventId: string, cancellationReason?: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Soft delete event
    await client`
      UPDATE app.d_event
      SET active_flag = false, to_ts = now(), updated_ts = now()
      WHERE id = ${eventId}::uuid
    `;

    // Release calendar slots
    await client`
      UPDATE app.d_entity_person_calendar
      SET availability_flag = true, event_id = NULL, updated_ts = now()
      WHERE event_id = ${eventId}::uuid AND active_flag = true
    `;

    // Soft delete entity linkages
    await client`
      UPDATE app.d_entity_id_map
      SET active_flag = false, to_ts = now(), updated_ts = now()
      WHERE parent_entity_type = 'event' AND parent_entity_id = ${eventId}::uuid
    `;

    // Update RSVP status to cancelled
    await client`
      UPDATE app.d_entity_event_person_calendar
      SET event_rsvp_status = 'cancelled', updated_ts = now()
      WHERE event_id = ${eventId}::uuid AND active_flag = true
    `;

    // TODO: Send cancellation emails with .ics CANCEL method

    console.log(`✅ Cancelled booking: ${eventId}`);

    return { success: true };
  } catch (error) {
    console.error('Failed to cancel booking:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Reschedule a booking (update event times, move calendar slots, send update notices)
 */
export async function rescheduleBooking(args: {
  eventId: string;
  newStartTime: Date;
  newEndTime: Date;
  rescheduleReason?: string;
}): Promise<{
  success: boolean;
  calendarSlotsUpdated: number;
  error?: string;
}> {
  const { eventId, newStartTime, newEndTime, rescheduleReason } = args;

  try {
    // Get event details
    const eventResult = await client`
      SELECT
        id::text, name, descr, event_type, event_addr, event_instructions,
        from_ts, to_ts, event_metadata
      FROM app.d_event
      WHERE id = ${eventId}::uuid AND active_flag = true
    `;

    if (eventResult.length === 0) {
      return { success: false, calendarSlotsUpdated: 0, error: 'Event not found' };
    }

    const event = eventResult[0];

    // Get assigned employee from metadata
    const metadata = event.event_metadata || {};
    const assignedEmployeeId = metadata.employee_id;

    if (!assignedEmployeeId) {
      return { success: false, calendarSlotsUpdated: 0, error: 'No assigned employee' };
    }

    // Release old calendar slots
    await client`
      UPDATE app.d_entity_person_calendar
      SET availability_flag = true, event_id = NULL, updated_ts = now()
      WHERE event_id = ${eventId}::uuid AND active_flag = true
    `;

    // Update event times
    await client`
      UPDATE app.d_event
      SET
        from_ts = ${newStartTime.toISOString()}::timestamptz,
        to_ts = ${newEndTime.toISOString()}::timestamptz,
        updated_ts = now()
      WHERE id = ${eventId}::uuid
    `;

    // Book new calendar slots
    const newSlotsResult = await client`
      SELECT id::text
      FROM app.d_entity_person_calendar
      WHERE person_entity_type = 'employee'
        AND person_entity_id = ${assignedEmployeeId}::uuid
        AND availability_flag = true
        AND from_ts >= ${newStartTime.toISOString()}::timestamptz
        AND to_ts <= ${newEndTime.toISOString()}::timestamptz
        AND active_flag = true
    `;

    const newSlotIds = newSlotsResult.map((row: any) => row.id);

    if (newSlotIds.length > 0) {
      await client`
        UPDATE app.d_entity_person_calendar
        SET
          availability_flag = false,
          event_id = ${eventId}::uuid,
          updated_ts = now()
        WHERE id = ANY(${newSlotIds}::uuid[])
      `;
    }

    // Update RSVP times
    await client`
      UPDATE app.d_entity_event_person_calendar
      SET
        from_ts = ${newStartTime.toISOString()}::timestamptz,
        to_ts = ${newEndTime.toISOString()}::timestamptz,
        updated_ts = now()
      WHERE event_id = ${eventId}::uuid AND active_flag = true
    `;

    // TODO: Send reschedule emails with updated .ics

    console.log(`✅ Rescheduled booking: ${eventId} (${newSlotIds.length} slots booked)`);

    return {
      success: true,
      calendarSlotsUpdated: newSlotIds.length
    };
  } catch (error) {
    console.error('Failed to reschedule booking:', error);
    return {
      success: false,
      calendarSlotsUpdated: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
