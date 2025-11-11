# Calendar System Documentation

Multi-person availability and booking management system for PMO platform.

---

## 📚 Documentation Files

### Primary Documentation

**[BOOKING_CALENDAR_SYSTEM.md](../../BOOKING_CALENDAR_SYSTEM.md)** - **⭐ NEW: Complete unified booking system**
- Unified person-calendar service (event + calendar + RSVP + notifications)
- End-to-end booking workflows
- Email/SMS calendar invites (.ics files)
- Enriched calendar API
- Testing & deployment

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

---

## 🚀 Quick Start

**Access Calendar:**
```
http://localhost:5173/calendar
```

**Entity Code:** `calendar` (person-calendar entity)
**API Endpoints:**
- `/api/v1/person-calendar` - Calendar slots (availability)
- `/api/v1/person-calendar/enriched` - Calendar with full event details
- `/api/v1/booking/create` - Unified booking service
- `/api/v1/event` - Event entity

**Database Tables:**
- `d_entity_person_calendar` - Calendar availability slots
- `d_event` - Event details
- `d_entity_event_person_calendar` - Event RSVP tracking
- `d_entity_id_map` - Entity linkages

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

### Unified Booking System (NEW)
- ✅ **One API call** creates complete booking:
  - Event in `d_event`
  - Attendees with RSVP in `d_entity_event_person_calendar`
  - Calendar slots booked in `d_entity_person_calendar`
  - Entity linkages in `d_entity_id_map`
  - Email/SMS notifications with .ics calendar invites

- ✅ **Email Calendar Invites**:
  - Compatible with Outlook, Gmail, iCloud
  - Automatic calendar blocking
  - Includes meeting details, location, attendees
  - Supports onsite and virtual meetings

- ✅ **Enriched Calendar API**:
  - Returns calendar slots with full event details
  - Person information (name, email)
  - Attendees list with RSVP status
  - No need for multiple API calls

---

## 🏗️ Architecture

**Pattern:** Universal Entity System + DRY Principles + Unified Booking Service
**Views:** Table (data grid) | Calendar (week grid)
**Default View:** Calendar

**Components:**
- `CalendarView.tsx` - Week-based calendar grid component
- `EntityMainPage.tsx` - Universal page with view switcher
- `FilteredDataTable.tsx` - Standard table view

**Services:**
- `person-calendar-service.routes.ts` - **NEW: Unified booking orchestration**
- `calendar-enriched.routes.ts` - **NEW: Enriched calendar data**
- `booking.service.ts` - **NEW: Complete booking workflow**
- `email.service.ts` - Email + .ics calendar invite generation

---

## 📖 For Developers

### Create Complete Booking (NEW - Recommended)

```typescript
// POST /api/v1/booking/create
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
  "specialInstructions": "Customer has two friendly dogs"
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

### Get Enriched Calendar Data (NEW - Recommended)

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

**Booking Slots:**
```typescript
// PATCH /api/v1/person-calendar/:id
{
  "availability_flag": false,
  "title": "Client Meeting",
  "appointment_medium": "onsite",
  "event_id": "event-uuid"
}
```

---

## 🔗 Related Documentation

- **[📅 Booking Calendar System](../../BOOKING_CALENDAR_SYSTEM.md)** - **⭐ START HERE for new implementations**
- [Universal Entity System](../entity_design_pattern/universal_entity_system.md)
- [UI/UX Architecture](../entity_ui_ux_route_api.md)
- [View Modes](../component_Kanban_System.md)
- [API Factory](../entity_ui_ux_route_api.md#api-layer-31-modules)

---

## 📊 Data Model

```
┌─────────────────────────────────────────────────────────────────┐
│                     BOOKING SYSTEM TABLES                       │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────┐      ┌──────────────────────────────────┐
│      d_event         │      │  d_entity_person_calendar        │
│ (Event Master)       │      │  (Calendar Availability)         │
├──────────────────────┤      ├──────────────────────────────────┤
│ id (uuid)            │◄────┐│ id (uuid)                        │
│ name (event title)   │     ││ person_entity_type               │
│ event_type (onsite/  │     ││ person_entity_id                 │
│   virtual)           │     ││ from_ts (slot start)             │
│ from_ts, to_ts       │     ││ to_ts (slot end)                 │
│ event_addr           │     ││ availability_flag (true/false)   │
└──────────────────────┘     ││ event_id ──────────────────────┘
            │                │  title, appointment_medium
            │                │  confirmation_sent_flag
            ▼                └──────────────────────────────────┘
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
```

---

## 🔌 API Endpoints

### Unified Booking Service (NEW - Recommended)
```
POST   /api/v1/booking/create           # Create complete booking
POST   /api/v1/booking/:eventId/cancel   # Cancel booking
POST   /api/v1/booking/:eventId/reschedule # Reschedule booking
```

### Enriched Calendar (NEW - Recommended)
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
GET    /api/v1/person-calendar/available    # Query available slots
POST   /api/v1/person-calendar/book         # Book multiple slots
POST   /api/v1/person-calendar/cancel       # Cancel booking
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

**Version:** 2.0.0 (Updated with unified booking system)
**Status:** Production-Ready ✅
**Last Updated:** 2025-11-11
