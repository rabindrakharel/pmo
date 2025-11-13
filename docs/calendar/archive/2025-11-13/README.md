# Calendar System Documentation

**Status:** ✅ Production-Ready
**Version:** 2.0.0
**Last Updated:** 2025-11-12
**Current Implementation:** Unified Booking Service with AWS SES/SNS Integration

Multi-person availability and booking management system for PMO platform with full event creation, calendar blocking, and notifications.

---

## 📚 Documentation Files

### Primary Documentation

**[PERSON_CALENDAR_SYSTEM.md](./PERSON_CALENDAR_SYSTEM.md)** - **⭐ Complete unified person-calendar system**
- Orchestrates Event, Calendar, and Message entities
- Semantic model: Event + Person = Calendar
- RBAC-based event ownership (permission[5])
- Email/SMS calendar invites via AWS SES/SNS
- Enriched calendar API with full event details
- Testing & deployment guide

**[CALENDAR_SYSTEM.md](./CALENDAR_SYSTEM.md)** - Calendar UI & availability tracking
- Architecture & design patterns
- Database/API/UI mapping
- User interaction flows
- Developer guide & critical considerations

**[CALENDAR_EVENT_INTEGRATION.md](./CALENDAR_EVENT_INTEGRATION.md)** - Calendar-Event integration
- How events wrap within calendar view
- RBAC ownership model
- Event pane UI/UX guidelines
- Data model separation

**[CALENDAR_IMPLEMENTATION_SUMMARY.md](./CALENDAR_IMPLEMENTATION_SUMMARY.md)** - Latest implementation
- November 2025-11-12 implementation details
- Unified booking service integration
- CalendarEventModal with tabs (Create New/Attach Existing)
- AWS SES/SNS messaging integration
- Multi-table update orchestration

---

## 🚀 Quick Start

**Access Calendar:**
```
http://localhost:5173/calendar
```

**Entity Code:** `person_calendar`

**API Endpoints:**
- `/api/v1/person-calendar/create` - **Unified booking service** (recommended)
- `/api/v1/person-calendar/enriched` - Calendar with full event details
- `/api/v1/person-calendar/:eventId/cancel` - Cancel person-calendar
- `/api/v1/person-calendar/:eventId/reschedule` - Reschedule person-calendar
- `/api/v1/person-calendar` - Standard calendar CRUD (legacy)
- `/api/v1/event` - Event entity CRUD

**Database Tables:**
- `d_event` - Event details (what/when/where)
- `d_entity_person_calendar` - Availability slots + event link
- `d_entity_event_person_calendar` - RSVP tracking (attendance)
- `d_entity_id_map` - Entity relationships (event → service, customer)
- `entity_id_rbac_map` - Event ownership (permission[5])

---

## 🎯 Key Features

### Calendar View
- ✅ Week-based calendar grid (Mon-Fri, 9 AM - 8 PM)
- ✅ Multi-person filtering (employees & customers)
- ✅ 15-minute time slot granularity
- ✅ Color-coded availability visualization
- ✅ Overlaid schedules for multiple people
- ✅ Table and Calendar view modes
- ✅ Drag-and-drop event creation/rescheduling

### Event Creation - Two Modes

#### 1. Create New Event (Unified Booking Service)
- **Full event fields from d_event table:**
  - Event name, description
  - Event type: onsite/virtual
  - Platform/venue: Zoom, Teams, Google Meet, Office, Customer Location, etc.
  - Location address OR meeting URL
  - Special instructions (access codes, parking, preparation)
  - Time slot (from_ts, to_ts, timezone)
  - Multi-select employees and attendees

- **Automatic multi-table updates:**
  1. Event in `d_event` (what/when/where)
  2. Attendees with RSVP in `d_entity_event_person_calendar`
  3. Calendar slots booked in `d_entity_person_calendar` (availability → booked)
  4. Entity relationships in `d_entity_id_map` (event → service, customer)
  5. Event ownership in `entity_id_rbac_map` (assigned employee gets permission[5])
  6. Email/SMS notifications via messaging service (AWS SES/SNS)

#### 2. Attach Existing Event
- Select from existing events in `d_event`
- Preview event details (name, type, platform, time, description)
- Create calendar slot linked to existing event via `event_id`
- Reuse event across multiple people/time slots

### Unified Person-Calendar Service (Orchestration)
- ✅ **One API call** creates complete person-calendar booking
- ✅ **Email Calendar Invites** (.ics via AWS SES):
  - Compatible with Outlook, Gmail, iCloud, Apple Calendar
  - Automatic calendar blocking for all attendees
  - MIME multipart with base64-encoded attachments
  - Includes meeting details, location, attendees, RSVP tracking
  - Supports both onsite and virtual meetings

- ✅ **SMS Notifications** (via AWS SNS):
  - E.164 phone format (+14165551234)
  - Concise appointment confirmations
  - Booking reference numbers
  - Phone numbers from person entity records

- ✅ **Enriched Calendar API**:
  - Returns calendar slots with full event details in one query
  - Person information (name, email, entity type)
  - Attendees list with RSVP status
  - Eliminates N+1 query problems

---

## 🏗️ Architecture

**Pattern:** Universal Entity System + DRY Principles + Unified Booking Service
**Views:** Table (data grid) | Calendar (week grid)
**Default View:** Calendar

**Components:**
- `CalendarView.tsx` - Week-based calendar grid component
- `CalendarEventModal.tsx` - Tabbed modal (Create New/Attach Existing)
- `EntityMainPage.tsx` - Universal page with view switcher
- `FilteredDataTable.tsx` - Standard table view

**Services (apps/api/src/modules/person-calendar/):**
- `person-calendar-service.routes.ts` - Unified person-calendar orchestration
- `person-calendar.service.ts` - Core orchestration logic
- `messaging.service.ts` - Email/SMS notifications (AWS SES/SNS)
- `calendar-enriched.routes.ts` - Enriched calendar data API
- `routes.ts` - Standard calendar CRUD (legacy)

**Semantic Model:**
```
Event (d_event) + Person (employee/customer) = Calendar

Calendar = {
  d_entity_person_calendar:          Availability slots + event link
  d_entity_event_person_calendar:    RSVP tracking
}

Ownership → entity_id_rbac_map (permission[5])
Relationships → d_entity_id_map
Messages → Messaging service (AWS SES/SNS)
```

---

## 📖 For Developers

### Create Complete Booking (Unified Service - Recommended)

```typescript
// POST /api/v1/person-calendar/create
// Creates event + calendar + RSVP + sends notifications
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
  "specialInstructions": "Customer has two friendly dogs",
  "eventPlatformProvider": "office"
}
```

**Response:**
```json
{
  "success": true,
  "eventId": "event-uuid",
  "eventCode": "EVT-BK-2025-001234",
  "bookingNumber": "BK-2025-001234",
  "calendarSlotsBooked": 8,
  "attendeesLinked": 2,
  "notificationsSent": {
    "totalSent": 2,
    "totalFailed": 0
  }
}
```

### Get Enriched Calendar Data (Recommended)

```typescript
// GET /api/v1/person-calendar/enriched
// Returns calendar slots with FULL event details + attendees
const response = await fetch(
  '/api/v1/person-calendar/enriched?from_ts=2025-11-12T00:00:00Z&to_ts=2025-11-13T00:00:00Z',
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }
);

const { data } = await response.json();
// data includes: calendar slots, event details, person info, attendees
```

### Manual Calendar Slot Operations (Legacy)

**Adding Calendar Slots:**
```typescript
// POST /api/v1/person-calendar
{
  "person_entity_type": "employee",
  "person_entity_id": "uuid",
  "from_ts": "2025-11-05T09:00:00-05:00",
  "to_ts": "2025-11-05T09:15:00-05:00",
  "availability_flag": true
}
```

**Attaching to Existing Event:**
```typescript
// POST /api/v1/person-calendar
{
  "person_entity_type": "employee",
  "person_entity_id": "uuid",
  "from_ts": "2025-11-05T09:00:00-05:00",
  "to_ts": "2025-11-05T09:15:00-05:00",
  "availability_flag": false,
  "event_id": "existing-event-uuid"
}
```

---

## 📊 Data Model

```
┌─────────────────────────────────────────────────────────────────┐
│                     CALENDAR SYSTEM TABLES                       │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────┐      ┌──────────────────────────────────┐
│      d_event         │      │  d_entity_person_calendar        │
│ (Event Master)       │      │  (Calendar Availability)         │
├──────────────────────┤      ├──────────────────────────────────┤
│ id (uuid)            │◄────┐│ id (uuid)                        │
│ name (event title)   │     ││ person_entity_type               │
│ event_type (onsite/  │     ││ person_entity_id                 │
│   virtual)           │     ││ from_ts (slot start)             │
│ event_platform       │     ││ to_ts (slot end)                 │
│ event_addr           │     ││ availability_flag (true/false)   │
│ event_instructions   │     ││ event_id ──────────────────────┘
│ from_ts, to_ts       │     │  title, appointment_medium
│ event_metadata       │     │  confirmation_sent_flag
└──────────────────────┘     │  reminder_sent_flag
            │                └──────────────────────────────────┘
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
│   accepted/declined)             │      │ child_entity_id     │
└──────────────────────────────────┘      └─────────────────────┘

            │
            ▼
┌──────────────────────────────────┐
│  entity_id_rbac_map              │
│  (Ownership & Permissions)       │
├──────────────────────────────────┤
│ empid                            │
│ entity = 'event'                 │
│ entity_id                        │
│ permission = [0,1,2,3,4,5]       │
│   5 = Owner (full control)       │
└──────────────────────────────────┘
```

---

## 🔌 API Endpoints

### Unified Person-Calendar Service (Recommended)
```
POST   /api/v1/person-calendar/create           # Create complete booking
POST   /api/v1/person-calendar/:eventId/cancel   # Cancel booking
POST   /api/v1/person-calendar/:eventId/reschedule # Reschedule booking
```

### Enriched Calendar (Recommended)
```
GET    /api/v1/person-calendar/enriched  # Calendar with full event details
GET    /api/v1/person-calendar/enriched/:id # Single slot with details
```

### Standard Calendar (Legacy)
```
GET    /api/v1/person-calendar              # List all slots
GET    /api/v1/person-calendar/:id          # Get slot by ID
POST   /api/v1/person-calendar              # Create new slot
PATCH  /api/v1/person-calendar/:id          # Update slot
DELETE /api/v1/person-calendar/:id          # Delete slot
```

### Event Entity
```
GET    /api/v1/event                    # List all events
GET    /api/v1/event/:id                # Get event details
POST   /api/v1/event                    # Create event
PATCH  /api/v1/event/:id                # Update event
DELETE /api/v1/event/:id                # Delete event
GET    /api/v1/event/:id/attendees      # Get event attendees
```

---

## 🔗 Related Documentation

- **[📅 Person-Calendar System](./PERSON_CALENDAR_SYSTEM.md)** - **⭐ START HERE for new implementations**
- **[Calendar System Architecture](./CALENDAR_SYSTEM.md)** - UI/UX patterns and components
- **[Calendar-Event Integration](./CALENDAR_EVENT_INTEGRATION.md)** - Event wrapping in calendar
- **[Implementation Summary](./CALENDAR_IMPLEMENTATION_SUMMARY.md)** - Latest changes (Nov 2025-11-12)
- [Universal Entity System](../entity_design_pattern/universal_entity_system.md)
- [UI/UX Architecture](../entity_ui_ux_route_api.md)
- [View Modes](../component_Kanban_System.md)
- [API Factory](../entity_ui_ux_route_api.md#api-layer-31-modules)

---

**Version:** 2.0.0 (Updated with unified booking system & AWS messaging integration)
**Status:** Production-Ready ✅
**Last Updated:** 2025-11-12
