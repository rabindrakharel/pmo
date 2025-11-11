# 📅 Booking Calendar System - Complete Integration Guide

> **Unified booking system that integrates events, calendar slots, RSVP tracking, and email notifications**

## 🎯 Overview

The PMO platform implements a comprehensive booking calendar system that ties together:
- **Events** (`d_event`) - What is happening
- **Calendar Slots** (`d_entity_person_calendar`) - Who is available when
- **RSVP Tracking** (`d_entity_event_person_calendar`) - Who is attending
- **Entity Linkages** (`d_entity_id_map`) - Related entities (service, customer, project)
- **Email Notifications** - Calendar invites (.ics files) sent via email/SMS

---

## 📊 Data Model

### Core Tables

```
┌─────────────────────────────────────────────────────────────────┐
│                     BOOKING SYSTEM TABLES                       │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────┐      ┌──────────────────────────────────┐
│      d_event         │      │  d_entity_person_calendar        │
│ (Event Master)       │      │  (Calendar Availability)         │
├──────────────────────┤      ├──────────────────────────────────┤
│ id (uuid)            │◄────┐│ id (uuid)                        │
│ code                 │     ││ person_entity_type (employee/    │
│ name (event title)   │     ││   customer)                      │
│ event_type (onsite/  │     ││ person_entity_id                 │
│   virtual)           │     ││ from_ts (slot start)             │
│ event_platform       │     ││ to_ts (slot end)                 │
│ event_addr (location)│     ││ availability_flag (true/false)   │
│ from_ts, to_ts       │     ││ event_id ──────────────────────┘
│ timezone             │     │  title, appointment_medium
│ event_metadata       │     │  confirmation_sent_flag
└──────────────────────┘     │  reminder_sent_flag
                             └──────────────────────────────────┘
            │
            │
            ▼
┌──────────────────────────────────┐      ┌─────────────────────┐
│ d_entity_event_person_calendar   │      │  d_entity_id_map    │
│ (RSVP Tracking)                  │      │  (Entity Links)     │
├──────────────────────────────────┤      ├─────────────────────┤
│ event_id (→ d_event.id)          │      │ parent_entity_type  │
│ person_entity_type               │      │   = 'event'         │
│ person_entity_id                 │      │ parent_entity_id    │
│ event_rsvp_status (pending/      │      │ child_entity_type   │
│   accepted/declined)             │      │   (service/customer)│
│ from_ts, to_ts                   │      │ child_entity_id     │
└──────────────────────────────────┘      └─────────────────────┘
```

### Relationships

1. **Event ← Calendar Slots**
   - `d_entity_person_calendar.event_id` → `d_event.id`
   - When a booking is made, calendar slots are marked as unavailable and linked to the event

2. **Event ← RSVP Tracking**
   - `d_entity_event_person_calendar.event_id` → `d_event.id`
   - Tracks who is attending the event and their RSVP status

3. **Event ← Entity Linkages**
   - `d_entity_id_map` links event to service, customer, project, etc.
   - Event acts as parent entity

---

## 🔄 End-to-End Booking Flow

### Scenario: Customer Books HVAC Service Appointment

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Customer Requests Booking                              │
└─────────────────────────────────────────────────────────────────┘

Customer Details:
- Name: John Thompson
- Email: john.thompson@email.com
- Phone: 416-555-1234
- Address: 123 Main Street, Toronto

Service Request:
- Service: HVAC Consultation
- Preferred Date: Nov 12, 2025
- Preferred Time: 2:00 PM - 4:00 PM

┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: System Finds Available Employee                        │
└─────────────────────────────────────────────────────────────────┘

API Call:
GET /api/v1/person-calendar/available-by-service?service_category=HVAC

Response:
- Employee: John Miller (HVAC Technician)
- Available Slots: 2:00 PM - 4:00 PM (8 slots × 15 min)

┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: Create Booking via Unified Service                     │
└─────────────────────────────────────────────────────────────────┘

API Call:
POST /api/v1/booking/create

Request Body:
{
  "customerName": "John Thompson",
  "customerEmail": "john.thompson@email.com",
  "customerPhone": "416-555-1234",
  "serviceId": "service-uuid",
  "serviceName": "HVAC Consultation",
  "serviceCategory": "HVAC",
  "eventTitle": "HVAC Consultation - Thompson Residence",
  "eventDescription": "Initial consultation for HVAC system replacement",
  "eventType": "onsite",
  "eventLocation": "123 Main Street, Toronto, ON",
  "eventInstructions": "Ring doorbell at main entrance",
  "startTime": "2025-11-12T14:00:00-05:00",
  "endTime": "2025-11-12T16:00:00-05:00",
  "timezone": "America/Toronto",
  "assignedEmployeeId": "employee-uuid",
  "assignedEmployeeName": "John Miller",
  "urgencyLevel": "normal",
  "specialInstructions": "Customer has two friendly dogs"
}

┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: System Orchestrates Complete Booking                   │
└─────────────────────────────────────────────────────────────────┘

4.1 Create Event in d_event:
    ✅ Generated booking number: BK-2025-001234
    ✅ Created event: EVT-BK-2025-001234
    ✅ Registered in d_entity_instance_id

4.2 Link Attendees (d_entity_event_person_calendar):
    ✅ Customer: pending RSVP
    ✅ Employee: accepted RSVP

4.3 Book Calendar Slots (d_entity_person_calendar):
    ✅ Found 8 slots (2:00-2:15, 2:15-2:30, ..., 3:45-4:00)
    ✅ Marked all as unavailable (availability_flag = false)
    ✅ Linked to event (event_id = event-uuid)

4.4 Link Entities (d_entity_id_map):
    ✅ event → service
    ✅ event → customer

4.5 Send Notifications:
    ✅ Email to customer with .ics calendar invite
    ✅ Email to employee with .ics calendar invite
    ✅ SMS to customer (confirmation)

Response:
{
  "success": true,
  "eventId": "event-uuid",
  "eventCode": "EVT-BK-2025-001234",
  "bookingNumber": "BK-2025-001234",
  "calendarSlotsBooked": 8,
  "attendeesLinked": 2,
  "notificationsSent": {
    "totalSent": 2,
    "totalFailed": 0,
    "details": [...]
  }
}
```

---

## 🔌 API Endpoints

### Unified Booking Service

#### Create Booking
```
POST /api/v1/booking/create

Creates complete booking with:
- Event in d_event
- Attendees in d_entity_event_person_calendar
- Calendar slots booked in d_entity_person_calendar
- Entity linkages in d_entity_id_map
- Email/SMS notifications sent

Request: CreateBookingRequest
Response: BookingConfirmation
```

#### Cancel Booking
```
POST /api/v1/booking/:eventId/cancel

Cancels booking:
- Soft deletes event
- Releases calendar slots (availability_flag = true)
- Updates RSVP status to 'cancelled'
- Sends cancellation emails

Request: { cancellationReason?: string }
Response: { success: boolean }
```

#### Reschedule Booking
```
POST /api/v1/booking/:eventId/reschedule

Reschedules booking:
- Updates event times
- Releases old calendar slots
- Books new calendar slots
- Sends reschedule notifications

Request: { newStartTime: Date, newEndTime: Date, rescheduleReason?: string }
Response: { success: boolean, calendarSlotsUpdated: number }
```

### Enriched Calendar API

#### Get Enriched Calendar
```
GET /api/v1/person-calendar/enriched

Returns calendar slots with FULL event details:
- Calendar slot data (d_entity_person_calendar)
- Event details (d_event) - name, description, location, platform
- Person details (employee/customer name, email)
- Attendees list with RSVP status

Query Params:
- person_entity_type: 'employee' | 'customer'
- person_entity_id: uuid
- from_ts: timestamptz
- to_ts: timestamptz
- availability_flag: boolean
- page, limit: pagination

Response: {
  data: [
    {
      // Calendar slot fields
      id, person_entity_type, person_entity_id,
      from_ts, to_ts, availability_flag, title,

      // Event fields (when event_id is present)
      event_code, event_name, event_description,
      event_type, event_platform_provider_name,
      event_addr, event_instructions, event_metadata,

      // Person fields
      person_name, person_email,

      // Attendees list
      attendees: [
        {
          person_entity_type, person_entity_id,
          event_rsvp_status, person_name, person_email
        }
      ]
    }
  ],
  pagination: { ... }
}
```

### Event API

```
GET /api/v1/event - List all events
GET /api/v1/event/:id - Get event by ID
POST /api/v1/event - Create event
PATCH /api/v1/event/:id - Update event
DELETE /api/v1/event/:id - Soft delete event
GET /api/v1/event/:id/attendees - Get event attendees
```

### Person Calendar API

```
GET /api/v1/person-calendar - List calendar slots
GET /api/v1/person-calendar/:id - Get slot by ID
GET /api/v1/person-calendar/available - Get available slots
GET /api/v1/person-calendar/available-by-service - Find by service category
POST /api/v1/person-calendar/book - Book multiple slots
POST /api/v1/person-calendar/cancel - Cancel booking
```

### Event-Person-Calendar API (RSVP)

```
GET /api/v1/event-person-calendar - List RSVPs
GET /api/v1/person/:personId/events - Get all events for a person
POST /api/v1/event-person-calendar - Create RSVP
PATCH /api/v1/event-person-calendar/:id/rsvp - Update RSVP status
```

---

## 📧 Email & Calendar Invites

### Email Service (`apps/api/src/modules/email/email.service.ts`)

The email service supports:
- **SMTP Configuration** - Gmail, Outlook, AWS SES, etc.
- **.ics Calendar Invites** - Compatible with Outlook, Gmail, iCloud
- **Multi-Attendee Invites** - Send to customer + employees
- **Meeting URLs** - Virtual meeting links embedded

### Calendar Invite (.ics) Format

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Huron Home Services//PMO Platform//EN
METHOD:REQUEST
BEGIN:VEVENT
UID:event-uuid@huronhome.ca
DTSTART:20251112T190000Z
DTEND:20251112T210000Z
SUMMARY:HVAC Consultation - Thompson Residence
DESCRIPTION:Initial consultation for HVAC system replacement
LOCATION:123 Main Street, Toronto, ON
ORGANIZER;CN=Huron Home Services:MAILTO:solutions@cohuron.com
ATTENDEE;CN=John Thompson;RSVP=TRUE:MAILTO:john.thompson@email.com
ATTENDEE;CN=John Miller;RSVP=TRUE:MAILTO:john.miller@huronhome.ca
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR
```

### Email Functions

```typescript
// Send calendar invite to employee
await sendEventInviteToEmployee({
  employeeId: 'uuid',
  eventId: 'uuid',
  eventTitle: 'HVAC Consultation',
  startTime: new Date(),
  endTime: new Date(),
  organizerName: 'Huron Home Services',
  organizerEmail: 'solutions@cohuron.com',
  meetingUrl: 'https://zoom.us/j/...'
});

// Send calendar invite to customer
await sendEventInviteToCustomer({
  customerId: 'uuid',
  eventId: 'uuid',
  eventTitle: 'HVAC Consultation',
  eventLocation: '123 Main Street',
  ...
});

// Send to multiple attendees
await sendEventInvitesToAttendees({
  eventId: 'uuid',
  customerId: 'uuid',
  attendeeIds: ['emp1-uuid', 'emp2-uuid'],
  ...
});
```

---

## 🎨 Frontend Integration

### CalendarView Component

**Location:** `apps/web/src/components/shared/ui/CalendarView.tsx`

**Features:**
- Week-based calendar grid (Mon-Fri, 9am-8pm)
- Multi-select person filter (employees, customers)
- Color-coded availability (green=available, red=booked)
- Drag-and-drop to create events
- Drag-and-drop to reschedule events
- Click to view event details
- Searchable person list

**Usage:**
```tsx
import { CalendarView } from '@/components/shared/ui/CalendarView';

<CalendarView
  config={personCalendarConfig}
  data={calendarSlots}
  onSlotClick={handleSlotClick}
/>
```

### Fetching Enriched Calendar Data

```typescript
// Fetch calendar with full event details
const response = await fetch(
  `/api/v1/person-calendar/enriched?from_ts=${startDate}&to_ts=${endDate}`,
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }
);

const { data } = await response.json();

// data includes:
// - Calendar slots
// - Full event details (name, description, location, platform)
// - Person details (name, email)
// - Attendees with RSVP status
```

---

## 🧪 Testing End-to-End

### 1. Test Booking Creation

```bash
# Using the test-api.sh tool
./tools/test-api.sh POST /api/v1/booking/create '{
  "customerName": "Test Customer",
  "customerEmail": "test@example.com",
  "customerPhone": "416-555-0000",
  "serviceId": "service-uuid",
  "serviceName": "Test Service",
  "eventTitle": "Test Booking",
  "eventType": "onsite",
  "eventLocation": "123 Test St",
  "startTime": "2025-11-12T14:00:00-05:00",
  "endTime": "2025-11-12T16:00:00-05:00",
  "assignedEmployeeId": "employee-uuid",
  "assignedEmployeeName": "Test Employee"
}'
```

### 2. Verify Database

```sql
-- Check event was created
SELECT * FROM app.d_event
WHERE code LIKE 'EVT-BK-%'
ORDER BY created_ts DESC
LIMIT 1;

-- Check calendar slots were booked
SELECT * FROM app.d_entity_person_calendar
WHERE event_id = 'your-event-uuid'
AND availability_flag = false;

-- Check RSVP entries were created
SELECT * FROM app.d_entity_event_person_calendar
WHERE event_id = 'your-event-uuid';

-- Check entity linkages
SELECT * FROM app.d_entity_id_map
WHERE parent_entity_type = 'event'
AND parent_entity_id = 'your-event-uuid';
```

### 3. Check Email Sent

```bash
# Check API logs for email sending
./tools/logs-api.sh 50 | grep "Email sent successfully"
```

### 4. Test Enriched Calendar API

```bash
./tools/test-api.sh GET "/api/v1/person-calendar/enriched?person_entity_type=employee&from_ts=2025-11-12T00:00:00Z&to_ts=2025-11-13T00:00:00Z"
```

---

## 🔧 Configuration

### Environment Variables

```env
# SMTP Configuration (for email/calendar invites)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASS=your-app-password
SMTP_FROM=solutions@cohuron.com
```

### Email Service Setup

1. **Gmail:** Create app password in Google Account settings
2. **Outlook:** Use SMTP settings for Outlook.com
3. **AWS SES:** Configure AWS credentials and verified domain

---

## 📋 Key Takeaways

### How It All Works Together

1. **Event (`d_event`)** - The booking itself
   - What: HVAC Consultation
   - When: Nov 12, 2pm-4pm
   - Where: 123 Main Street or Zoom URL

2. **Calendar Slots (`d_entity_person_calendar`)** - Employee availability
   - 15-minute slots from 9am-8pm
   - Marked as available/unavailable
   - Linked to event via `event_id`

3. **RSVP (`d_entity_event_person_calendar`)** - Who's attending
   - Customer: pending RSVP
   - Employee: accepted RSVP
   - Tracks attendance per person

4. **Entity Links (`d_entity_id_map`)** - Related entities
   - event → service
   - event → customer
   - event → project (if applicable)

5. **Notifications** - Calendar invites
   - Email with .ics attachment
   - SMS confirmation (optional)
   - Compatible with all major calendars

### Best Practices

✅ **Always use the unified booking service** (`/api/v1/booking/create`)
✅ **Use enriched calendar API** for frontend displays
✅ **Pre-seed calendar slots** for employees (9am-8pm, 15-min increments)
✅ **Send notifications** after booking confirmation
✅ **Track RSVP status** for attendance management
✅ **Link related entities** via `d_entity_id_map`

---

## 📚 Related Documentation

- [Event Design](./XXXIV_d_event.ddl) - Event table DDL
- [Person Calendar](./XXXV_d_entity_person_calendar.ddl) - Calendar table DDL
- [Event RSVP](./XXXVI_d_entity_event_person_calendar.ddl) - RSVP table DDL
- [Email Service](../apps/api/src/modules/email/email.service.ts) - Email implementation
- [Booking Service](../apps/api/src/modules/booking/booking.service.ts) - Booking orchestration
- [Calendar View](../apps/web/src/components/shared/ui/CalendarView.tsx) - UI component

---

**Version:** 1.0.0
**Last Updated:** 2025-11-11
**Status:** ✅ Production Ready
