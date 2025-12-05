/**
 * Person Calendar Service
 * Orchestrates the complete person-calendar booking flow by bringing together
 * three independent but interrelated entities: Event, Calendar, and Message
 *
 * SEMANTIC MODEL:
 * - Event (app.event): Independent entity with event details (what/when/where)
 * - Person (employee/customer): Independent entities (who)
 * - Calendar: Construct where Event + Person come together via:
 *   * app.person_calendar: Person availability slots + event link
 *   * app.entity_event_person_calendar: RSVP tracking (who's attending what)
 * - Message: Independent entity sent via messaging service (email/SMS)
 * - Ownership: Event owner stored in entity_rbac (permission[5])
 * - Relationships: Event relationships in entity_instance_link (event → service, customer)
 *
 * ORCHESTRATION FLOW:
 * 1. Create event in app.event (event details: from_ts, to_ts, location, etc.)
 * 2. Link attendees in app.entity_event_person_calendar (RSVP tracking)
 * 3. Book calendar slots in app.person_calendar (mark unavailable, link event_id)
 * 4. Link entities in entity_instance_link (event → service, customer, project)
 * 5. Grant event ownership in entity_rbac (assigned employee gets permission[5])
 * 6. Send email/SMS notifications via messaging service (calendar invites)
 *
 * DATABASE TABLES (DDL is source of truth - NO d_ prefix):
 * - app.event               (NOT app.d_event)
 * - app.person_calendar     (NOT app.d_person_calendar)
 * - app.entity_event_person_calendar (NOT app.d_entity_event_person_calendar)
 *
 * @module person-calendar/person-calendar.service
 */

import { client, db } from '../../db/index.js';
import { PersonCalendarMessagingService } from './messaging.service.js';
import { getEntityInfrastructure, Permission } from '../../services/entity-infrastructure.service.js';

/**
 * Person calendar booking request from customer or agent
 */
export interface CreatePersonCalendarRequest {
  // Customer details
  customerId?: string; // customer.id (optional - may be new customer)
  customerName: string;
  customerEmail?: string;
  customerPhone: string;

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
 * Person calendar confirmation response
 */
export interface PersonCalendarConfirmation {
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
    FROM app.event
    WHERE DATE(created_ts) = CURRENT_DATE
  `;

  const count = parseInt(result[0]?.count || '0', 10);
  const paddedCount = (count + 1).toString().padStart(6, '0');

  return `BK-${year}-${paddedCount}`;
}

/**
 * Create a complete person-calendar booking with event, calendar, RSVP, and notifications
 */
export async function createPersonCalendar(request: CreatePersonCalendarRequest): Promise<PersonCalendarConfirmation> {
  const {
    customerId,
    customerName,
    customerEmail,
    customerPhone,
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
      INSERT INTO app.event (
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

    // Register in entity_instance registry (using correct column names)
    await client`
      INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
      VALUES ('event', ${eventId}::uuid, ${event.name}, ${event.code})
      ON CONFLICT (entity_code, entity_instance_id) DO UPDATE
      SET entity_instance_name = EXCLUDED.entity_instance_name,
          code = EXCLUDED.code,
          updated_ts = now()
    `;

    // ===============================================
    // STEP 2: Link Attendees (RSVP Tracking)
    // ===============================================

    const attendees: Array<{ person_entity_type: string; person_id: string; rsvp_status: string }> = [];

    // Add customer (if customerId provided)
    if (customerId) {
      attendees.push({
        person_entity_type: 'customer',
        person_id: customerId,
        rsvp_status: 'pending'
      });
    }

    // Add assigned employee
    attendees.push({
      person_entity_type: 'employee',
      person_id: assignedEmployeeId,
      rsvp_status: 'accepted'
    });

    // Insert attendees into d_entity_event_person_calendar
    let attendeeIndex = 0;
    for (const attendee of attendees) {
      attendeeIndex++;
      const attendeeCode = `${eventCode}-ATT-${attendeeIndex.toString().padStart(2, '0')}`;

      await client`
        INSERT INTO app.entity_event_person_calendar (
          code, person_entity_type, person_id, event_id,
          event_rsvp_status, from_ts, to_ts
        ) VALUES (
          ${attendeeCode},
          ${attendee.person_entity_type},
          ${attendee.person_id}::uuid,
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
      FROM app.person_calendar
      WHERE person_entity_type = 'employee'
        AND person_id = ${assignedEmployeeId}::uuid
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
        UPDATE app.person_calendar
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
    // STEP 4: Link Entities (entity_instance_link)
    // ===============================================

    const entityLinks = [];

    // Link event → customer
    if (customerId) {
      entityLinks.push({
        parent_entity_code: 'event',
        parent_entity_id: eventId,
        child_entity_code: 'customer',
        child_entity_id: customerId
      });
    }

    // Link event → project (if applicable)
    if (projectId) {
      entityLinks.push({
        parent_entity_code: 'event',
        parent_entity_id: eventId,
        child_entity_code: 'project',
        child_entity_id: projectId
      });
    }

    // Insert entity linkages (using correct column names)
    for (const link of entityLinks) {
      await client`
        INSERT INTO app.entity_instance_link (
          entity_code, entity_instance_id,
          child_entity_code, child_entity_instance_id
        ) VALUES (
          ${link.parent_entity_code},
          ${link.parent_entity_id}::uuid,
          ${link.child_entity_code},
          ${link.child_entity_id}::uuid
        )
      `;
    }

    console.log(`✅ Created ${entityLinks.length} entity linkages`);

    // ===============================================
    // STEP 5: Grant Event Ownership (RBAC)
    // ===============================================

    // Grant the assigned employee OWNER permission for this event
    const entityInfra = getEntityInfrastructure(db);
    await entityInfra.set_entity_rbac_owner(assignedEmployeeId, 'event', eventId);

    console.log(`✅ Granted event ownership to employee ${assignedEmployeeName}`);

    // ===============================================
    // STEP 6: Send Notifications (Email + SMS with Calendar Invite)
    // ===============================================

    const messagingService = new PersonCalendarMessagingService();
    const notificationResults = {
      totalSent: 0,
      totalFailed: 0,
      results: [] as Array<{ id: string; success: boolean; error?: string }>
    };

    // Send notification to customer (if email/phone provided)
    if (customerEmail || customerPhone) {
      const customerResult = await messagingService.sendPersonCalendarNotification({
        recipientEmail: customerEmail || '',
        recipientName: customerName,
        recipientPhone: customerPhone || '',
        eventId: eventId,
        eventTitle: eventTitle,
        eventDescription: eventDescription,
        eventLocation: eventLocation,
        startTime: startTime,
        endTime: endTime,
        timezone: timezone,
        organizerName: organizerName,
        organizerEmail: organizerEmail,
        meetingUrl: eventType === 'virtual' ? eventLocation : undefined,
        instructions: eventInstructions || specialInstructions,
        bookingNumber: bookingNumber,
        serviceCategory: serviceCategory
      });

      if (customerResult.success) {
        notificationResults.totalSent++;
        notificationResults.results.push({
          id: customerId || 'customer',
          success: true
        });
      } else {
        notificationResults.totalFailed++;
        notificationResults.results.push({
          id: customerId || 'customer',
          success: false,
          error: customerResult.error
        });
      }

      console.log(`✅ Customer notification: Email=${customerResult.emailSent}, SMS=${customerResult.smsSent}`);
    }

    // Send notification to assigned employee
    // First, get employee email
    const employeeResult = await client`
      SELECT first_name, last_name, email, phone
      FROM app.employee
      WHERE id = ${assignedEmployeeId}::uuid AND active_flag = true
    `;

    if (employeeResult.length > 0) {
      const employee = employeeResult[0];
      const employeeEmail = employee.email;
      const employeePhone = employee.phone;
      const employeeName = `${employee.first_name} ${employee.last_name}`;

      if (employeeEmail || employeePhone) {
        const empResult = await messagingService.sendPersonCalendarNotification({
          recipientEmail: employeeEmail || '',
          recipientName: employeeName,
          recipientPhone: employeePhone || '',
          eventId: eventId,
          eventTitle: eventTitle,
          eventDescription: eventDescription,
          eventLocation: eventLocation,
          startTime: startTime,
          endTime: endTime,
          timezone: timezone,
          organizerName: organizerName,
          organizerEmail: organizerEmail,
          meetingUrl: eventType === 'virtual' ? eventLocation : undefined,
          instructions: eventInstructions || specialInstructions,
          bookingNumber: bookingNumber,
          serviceCategory: serviceCategory
        });

        if (empResult.success) {
          notificationResults.totalSent++;
          notificationResults.results.push({
            id: assignedEmployeeId,
            success: true
          });
        } else {
          notificationResults.totalFailed++;
          notificationResults.results.push({
            id: assignedEmployeeId,
            success: false,
            error: empResult.error
          });
        }

        console.log(`✅ Employee notification: Email=${empResult.emailSent}, SMS=${empResult.smsSent}`);
      }
    }

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
 * Cancel a person-calendar booking (soft delete event, release calendar slots, send cancellation notices)
 */
export async function cancelPersonCalendar(eventId: string, cancellationReason?: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Get event details before deletion
    const eventResult = await client`
      SELECT
        name, event_metadata, from_ts
      FROM app.event
      WHERE id = ${eventId}::uuid AND active_flag = true
    `;

    if (eventResult.length === 0) {
      return { success: false, error: 'Event not found' };
    }

    const event = eventResult[0];
    const metadata = event.event_metadata || {};
    const bookingNumber = metadata.booking_number;

    // Get attendees before cancellation
    const attendeesResult = await client`
      SELECT
        epc.person_entity_type,
        epc.person_id::text,
        CASE
          WHEN epc.person_entity_type = 'employee' THEN emp.first_name || ' ' || emp.last_name
          WHEN epc.person_entity_type = 'customer' THEN cust.name
          ELSE NULL
        END as person_name,
        CASE
          WHEN epc.person_entity_type = 'employee' THEN emp.email
          WHEN epc.person_entity_type = 'customer' THEN cust.primary_email
          ELSE NULL
        END as person_email,
        CASE
          WHEN epc.person_entity_type = 'employee' THEN emp.phone
          WHEN epc.person_entity_type = 'customer' THEN cust.primary_phone
          ELSE NULL
        END as person_phone
      FROM app.entity_event_person_calendar epc
      LEFT JOIN app.employee emp ON emp.id = epc.person_id AND epc.person_entity_type = 'employee'
      LEFT JOIN app.customer cust ON cust.id = epc.person_id AND epc.person_entity_type = 'customer'
      WHERE epc.event_id = ${eventId}::uuid AND epc.active_flag = true
    `;

    // Soft delete event
    await client`
      UPDATE app.event
      SET active_flag = false, to_ts = now(), updated_ts = now()
      WHERE id = ${eventId}::uuid
    `;

    // Release calendar slots
    await client`
      UPDATE app.person_calendar
      SET availability_flag = true, event_id = NULL, updated_ts = now()
      WHERE event_id = ${eventId}::uuid AND active_flag = true
    `;

    // Delete entity linkages (entity_instance_link is hard delete, no active_flag)
    await client`
      DELETE FROM app.entity_instance_link
      WHERE entity_code = 'event' AND entity_instance_id = ${eventId}::uuid
    `;

    // Update RSVP status to cancelled
    await client`
      UPDATE app.entity_event_person_calendar
      SET event_rsvp_status = 'cancelled', updated_ts = now()
      WHERE event_id = ${eventId}::uuid AND active_flag = true
    `;

    // Send cancellation notifications to all attendees
    const messagingService = new PersonCalendarMessagingService();
    for (const attendee of attendeesResult) {
      if (attendee.person_email || attendee.person_phone) {
        await messagingService.sendCancellationNotification({
          recipientEmail: attendee.person_email || undefined,
          recipientPhone: attendee.person_phone || undefined,
          recipientName: attendee.person_name,
          eventTitle: event.name,
          originalStartTime: new Date(event.from_ts),
          cancellationReason,
          bookingNumber
        });

        console.log(`✅ Sent cancellation notification to ${attendee.person_name}`);
      }
    }

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
 * Reschedule a person-calendar booking (update event times, move calendar slots, send update notices)
 */
export async function reschedulePersonCalendar(args: {
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
      FROM app.event
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
      UPDATE app.person_calendar
      SET availability_flag = true, event_id = NULL, updated_ts = now()
      WHERE event_id = ${eventId}::uuid AND active_flag = true
    `;

    // Update event times
    await client`
      UPDATE app.event
      SET
        from_ts = ${newStartTime.toISOString()}::timestamptz,
        to_ts = ${newEndTime.toISOString()}::timestamptz,
        updated_ts = now()
      WHERE id = ${eventId}::uuid
    `;

    // Book new calendar slots
    const newSlotsResult = await client`
      SELECT id::text
      FROM app.person_calendar
      WHERE person_entity_type = 'employee'
        AND person_id = ${assignedEmployeeId}::uuid
        AND availability_flag = true
        AND from_ts >= ${newStartTime.toISOString()}::timestamptz
        AND to_ts <= ${newEndTime.toISOString()}::timestamptz
        AND active_flag = true
    `;

    const newSlotIds = newSlotsResult.map((row: any) => row.id);

    if (newSlotIds.length > 0) {
      await client`
        UPDATE app.person_calendar
        SET
          availability_flag = false,
          event_id = ${eventId}::uuid,
          updated_ts = now()
        WHERE id = ANY(${newSlotIds}::uuid[])
      `;
    }

    // Update RSVP times
    await client`
      UPDATE app.entity_event_person_calendar
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
