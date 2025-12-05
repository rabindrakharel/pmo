# PMO Calendar & Event Management System
**Version**: 5.0 | **Updated**: 2025-12-05 | **Status**: Production

---

## Executive Summary

The PMO Calendar & Event Management System implements an **Event Sourcing-inspired architecture** where events serve as the central organizing entity linking people, time, and business actions. This design follows industry patterns from leaders like Calendly, Cal.com, and Google Calendar while maintaining the PMO's universal entity infrastructure.

### Key Design Decisions

| Decision | Rationale | Industry Precedent |
|----------|-----------|-------------------|
| Event as First-Class Entity | Events can link to ANY business entity via polymorphic relationships | Salesforce Activities, HubSpot Meetings |
| Separate Availability from Booking | `person_calendar` (availability) vs `event` (booking) | Cal.com, Calendly slot architecture |
| RSVP as Junction Table | `entity_event_person_calendar` tracks who + status | Google Calendar, Outlook invitations |
| No Foreign Keys | Polymorphic design with entity codes | Microservices pattern, domain separation |

---

## 1. Business Flow

### 1.1 Core Business Semantics

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        BUSINESS DOMAIN MODEL                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  EVENT answers: "What meeting/appointment is happening?"                │
│  ├── WHAT: event_action_entity (service, project, task, quote, product)│
│  ├── WHEN: from_ts / to_ts / timezone                                  │
│  ├── WHERE: event_type (onsite/virtual) + event_addr                   │
│  ├── WHO ORGANIZED: organizer__employee_id                              │
│  └── WHO ATTENDS: entity_event_person_calendar (RSVP tracking)         │
│                                                                         │
│  PERSON_CALENDAR answers: "When is this person available?"              │
│  ├── WHO: person_entity_type + person_id                                │
│  ├── WHEN: 15-minute slots (9am-8pm)                                    │
│  ├── STATUS: availability_flag (true=open, false=booked)                │
│  └── LINKED TO: event_id (when booked)                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Business Use Cases

| Use Case | Action Entity | Typical Flow |
|----------|---------------|--------------|
| **Service Appointment** | `service` | Customer requests → Find available slots → Create event → Book slots → Send invite |
| **Project Meeting** | `project` | PM schedules → Add team members → Set virtual/onsite → Track RSVPs |
| **Task Discussion** | `task` | Assignee schedules → Link to task → Add stakeholders |
| **Quote Review** | `quote` | Sales schedules → Add customer + approvers → Present quote |
| **Product Demo** | `product` | Sales schedules → Add prospects → Demo product |
| **Emergency Call** | `service` | Urgent request → Find first available → Immediate booking |

### 1.3 RSVP Status Flow

```
                    ┌──────────────┐
                    │   PENDING    │ ← Initial state when invited
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            │            ▼
       ┌──────────┐        │     ┌──────────┐
       │ ACCEPTED │        │     │ DECLINED │
       └────┬─────┘        │     └──────────┘
            │              │
            │              │ (if event cancelled)
            │              │
            ▼              ▼
       ┌──────────────────────┐
       │     CANCELLED        │
       └──────────────────────┘
```

---

## 2. Data Model

### 2.1 Database Tables (DDL is Source of Truth)

> **CRITICAL**: Tables do NOT use the `d_` prefix. The actual table names are:

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `app.event` | Event/meeting records | `id`, `code`, `name`, `event_action_entity_type`, `event_action_entity_id`, `organizer__employee_id`, `from_ts`, `to_ts`, `event_type`, `event_addr` |
| `app.person_calendar` | Availability slots (15-min) | `id`, `person_entity_type`, `person_id`, `from_ts`, `to_ts`, `availability_flag`, `event_id` |
| `app.entity_event_person_calendar` | Event-person RSVP mapping | `id`, `event_id`, `person_entity_type`, `person_id`, `event_rsvp_status` |

### 2.2 Entity-Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA ARCHITECTURE                                 │
└─────────────────────────────────────────────────────────────────────────────┘

                        ┌─────────────────────┐
                        │    ACTION ENTITIES  │
                        │ (service, project,  │
                        │  task, quote, prod) │
                        └──────────┬──────────┘
                                   │ event_action_entity_id
                                   │
┌──────────────┐                   ▼                    ┌──────────────┐
│  ORGANIZER   │─────────────▶ ┌──────────┐ ◀──────────│   PEOPLE     │
│  (employee)  │               │  EVENT   │            │  (emp/cust)  │
│              │  organizer__  │          │            │              │
│              │  employee_id  │ id       │            │              │
└──────────────┘               │ code     │            └──────────────┘
                               │ name     │                   │
                               │ from_ts  │                   │
                               │ to_ts    │                   │
                               │ event_   │                   │
                               │   type   │                   │
                               └────┬─────┘                   │
                                    │                         │
                    ┌───────────────┼───────────────┐         │
                    │               │               │         │
                    ▼               ▼               ▼         │
           ┌───────────────┐ ┌───────────────┐ ┌───────────────────────┐
           │entity_instance│ │entity_instance│ │entity_event_person_   │
           │    (registry) │ │    _link      │ │    calendar (RSVP)    │
           └───────────────┘ │  (linkages)   │ │                       │
                             └───────────────┘ │ • event_id            │
                                               │ • person_entity_type  │
                                               │ • person_id           │
                                               │ • event_rsvp_status   │
                                               └───────────┬───────────┘
                                                           │
                                                           │ (person lookup)
                                                           ▼
                                               ┌───────────────────────┐
                                               │    PERSON_CALENDAR    │
                                               │    (availability)     │
                                               │                       │
                                               │ • person_id           │
                                               │ • availability_flag   │
                                               │ • event_id (when      │
                                               │   booked)             │
                                               └───────────────────────┘
```

### 2.3 Table Schemas

#### app.event
```sql
CREATE TABLE app.event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) UNIQUE,
  name varchar(200) NOT NULL,
  descr text,

  -- What this event is about (polymorphic)
  event_action_entity_type varchar(100),  -- 'service', 'project', 'task', 'quote', 'product'
  event_action_entity_id uuid,

  -- Who organized it
  organizer__employee_id uuid,

  -- Logistics
  event_type varchar(100),                -- 'onsite', 'virtual'
  event_platform_provider_name varchar(50), -- 'zoom', 'teams', 'office', etc.
  venue_type varchar(100),                -- 'customer_site', 'office', 'remote'
  event_addr text,                        -- Physical address OR meeting URL
  event_instructions text,                -- Access codes, parking, notes

  -- Timing
  from_ts timestamptz NOT NULL,
  to_ts timestamptz NOT NULL,
  timezone varchar(50) DEFAULT 'America/Toronto',

  -- Extensibility
  event_metadata jsonb DEFAULT '{}',

  -- Audit
  active_flag boolean DEFAULT true,
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now(),
  version integer DEFAULT 1
);
```

#### app.entity_event_person_calendar
```sql
CREATE TABLE app.entity_event_person_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50),
  name varchar(200),

  -- Event reference
  event_id uuid NOT NULL,

  -- Person reference (polymorphic)
  person_entity_type varchar(50) NOT NULL,  -- 'employee', 'customer'
  person_id uuid NOT NULL,

  -- RSVP tracking
  event_rsvp_status varchar(50) DEFAULT 'pending',  -- 'pending', 'accepted', 'declined'

  -- Time commitment
  from_ts timestamptz NOT NULL,
  to_ts timestamptz NOT NULL,
  timezone varchar(50) DEFAULT 'America/Toronto',

  -- Audit
  metadata jsonb DEFAULT '{}',
  active_flag boolean DEFAULT true,
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now(),
  version integer DEFAULT 1
);
```

#### app.person_calendar
```sql
CREATE TABLE app.person_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) UNIQUE,
  name varchar(200),

  -- Person reference
  person_entity_type varchar(50),  -- 'employee', 'customer'
  person_id uuid,

  -- Time slot (15-minute intervals, 9am-8pm)
  from_ts timestamptz,
  to_ts timestamptz,
  timezone varchar(50) DEFAULT 'America/Toronto',

  -- Availability tracking
  availability_flag boolean DEFAULT true,  -- true=available, false=booked

  -- Booking details (populated when booked)
  title varchar(200),
  event_id uuid,  -- Link to app.event when booked

  -- Audit
  active_flag boolean DEFAULT true,
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now(),
  version integer DEFAULT 1
);
```

---

## 3. Logical Flow

### 3.1 Event Creation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EVENT CREATION SEQUENCE                             │
└─────────────────────────────────────────────────────────────────────────────┘

  USER                     API                      DATABASE
   │                        │                          │
   │ POST /api/v1/event     │                          │
   │ {name, from_ts, ...    │                          │
   │  attendees: [...]}     │                          │
   │───────────────────────▶│                          │
   │                        │                          │
   │                        │ 1. RBAC Check (CREATE)   │
   │                        │──────────────────────────▶│
   │                        │                          │
   │                        │ 2. INSERT app.event      │
   │                        │──────────────────────────▶│
   │                        │                          │
   │                        │ 3. INSERT entity_instance│
   │                        │    (registry)            │
   │                        │──────────────────────────▶│
   │                        │                          │
   │                        │ 4. INSERT entity_rbac    │
   │                        │    (owner permission)    │
   │                        │──────────────────────────▶│
   │                        │                          │
   │                        │ 5. INSERT entity_event_  │
   │                        │    person_calendar       │
   │                        │    (organizer + attendees)
   │                        │──────────────────────────▶│
   │                        │                          │
   │◀────────────────────────│  Return created event    │
   │   201 Created          │                          │
   │                        │                          │
```

### 3.2 Booking Flow (Person Calendar Service)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BOOKING ORCHESTRATION                               │
└─────────────────────────────────────────────────────────────────────────────┘

  STEP 1: CREATE EVENT                    STEP 2: LINK ATTENDEES
  ────────────────────                    ──────────────────────
  INSERT INTO app.event (...)             INSERT INTO app.entity_event_person_calendar
  RETURNING id                            (event_id, person_id, rsvp_status='pending')
         │                                         │
         ▼                                         ▼
  ┌─────────────────┐                    ┌─────────────────┐
  │  app.event      │                    │  RSVP Junction  │
  │  (event record) │                    │  (attendees)    │
  └────────┬────────┘                    └────────┬────────┘
           │                                      │
           │                                      │
           ▼                                      ▼
  STEP 3: BOOK CALENDAR SLOTS            STEP 4: LINK ENTITIES
  ───────────────────────────            ─────────────────────
  UPDATE app.person_calendar             INSERT INTO entity_instance_link
  SET availability_flag = false,         (event → customer, service, project)
      event_id = new_event_id
  WHERE from_ts/to_ts matches
         │                                         │
         ▼                                         ▼
  ┌─────────────────┐                    ┌─────────────────┐
  │ Calendar slots  │                    │ Entity linkages │
  │ now BOOKED      │                    │ established     │
  └────────┬────────┘                    └────────┬────────┘
           │                                      │
           └──────────────┬───────────────────────┘
                          │
                          ▼
  STEP 5: GRANT OWNERSHIP                STEP 6: SEND NOTIFICATIONS
  ───────────────────────                ────────────────────────────
  INSERT INTO entity_rbac                PersonCalendarMessagingService
  (person_id, entity_code='event',       → sendPersonCalendarNotification()
   entity_instance_id, permission=5)     → Email with .ics attachment
         │                               → SMS confirmation
         ▼                                         │
  ┌─────────────────┐                              ▼
  │ Owner permission│                    ┌─────────────────┐
  │ granted         │                    │ Invitations     │
  └─────────────────┘                    │ delivered       │
                                         └─────────────────┘
```

### 3.3 Availability Query Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FIND AVAILABLE SLOTS                                     │
└─────────────────────────────────────────────────────────────────────────────┘

  Customer: "I need an HVAC appointment on Tuesday afternoon"
                    │
                    ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ SELECT id, from_ts, to_ts                                   │
  │ FROM app.person_calendar                                    │
  │ WHERE person_entity_type = 'employee'                       │
  │   AND availability_flag = true        ← Only open slots     │
  │   AND from_ts >= '2025-12-10 13:00'   ← Tuesday 1pm        │
  │   AND to_ts <= '2025-12-10 18:00'     ← Until 6pm          │
  │   AND person_id IN (                                        │
  │     SELECT id FROM app.employee                             │
  │     WHERE department = 'HVAC'         ← HVAC technicians   │
  │   )                                                         │
  │ ORDER BY from_ts                                            │
  └─────────────────────────────────────────────────────────────┘
                    │
                    ▼
  Returns: Available 15-minute slots for HVAC techs on Tuesday PM

  Customer selects: 2:00 PM - 3:00 PM with James Miller
                    │
                    ▼
  Booking Flow Executes (see 3.2 above)
```

---

## 4. API Layer

### 4.1 Endpoints Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API ENDPOINTS                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  EVENT MANAGEMENT                                                           │
│  ────────────────                                                           │
│  GET    /api/v1/event                    List events (RBAC + filters)       │
│  GET    /api/v1/event/:id                Get single event                   │
│  GET    /api/v1/event/enriched           Events with organizer + attendees  │
│  GET    /api/v1/event/:id/attendees      Get event attendees                │
│  GET    /api/v1/event/:id/entities       Get linked entities                │
│  POST   /api/v1/event                    Create event + attendees           │
│  PATCH  /api/v1/event/:id                Update event                       │
│  DELETE /api/v1/event/:id                Soft delete event                  │
│                                                                             │
│  PERSON CALENDAR (AVAILABILITY)                                             │
│  ──────────────────────────────                                             │
│  GET    /api/v1/person-calendar          List calendar slots                │
│  GET    /api/v1/person-calendar/enriched Slots with event details           │
│  POST   /api/v1/person-calendar/create   Create booking (orchestrated)      │
│                                                                             │
│  EVENT-PERSON MAPPING (RSVP)                                                │
│  ───────────────────────────                                                │
│  GET    /api/v1/event-person-calendar    List mappings                      │
│  POST   /api/v1/event-person-calendar    Invite person to event             │
│  PATCH  /api/v1/event-person-calendar/:id/rsvp  Update RSVP status          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Request/Response Examples

#### Create Event with Attendees
```json
// POST /api/v1/event
{
  "code": "EVT-HVAC-2025-001",
  "name": "HVAC System Consultation",
  "event_action_entity_type": "service",
  "event_action_entity_id": "93106ffb-402e-43a7-8b26-5287e37a1b0e",
  "organizer__employee_id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
  "event_type": "onsite",
  "event_platform_provider_name": "office",
  "venue_type": "customer_site",
  "event_addr": "123 Main Street, Toronto",
  "event_instructions": "Ring doorbell. Park in visitor lot.",
  "from_ts": "2025-12-10T14:00:00Z",
  "to_ts": "2025-12-10T16:00:00Z",
  "timezone": "America/Toronto",
  "attendees": [
    {
      "person_entity_type": "employee",
      "person_id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
      "event_rsvp_status": "accepted"
    },
    {
      "person_entity_type": "customer",
      "person_id": "abc12345-def6-7890-ghij-klmnopqrstuv",
      "event_rsvp_status": "pending"
    }
  ]
}
```

#### Enriched Event Response
```json
// GET /api/v1/event/enriched
{
  "data": [
    {
      "id": "uuid",
      "code": "EVT-HVAC-2025-001",
      "name": "HVAC System Consultation",
      "event_type": "onsite",
      "event_platform_provider_name": "office",
      "from_ts": "2025-12-10T14:00:00Z",
      "to_ts": "2025-12-10T16:00:00Z",
      "organizer": {
        "employee_id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
        "name": "James Miller",
        "email": "james.miller@huronhome.ca"
      },
      "attendees": [
        {
          "person_entity_type": "employee",
          "person_id": "8260b1b0-...",
          "person_name": "James Miller",
          "person_email": "james.miller@huronhome.ca",
          "event_rsvp_status": "accepted"
        },
        {
          "person_entity_type": "customer",
          "person_id": "abc12345-...",
          "person_name": "John Thompson",
          "person_email": "john@example.com",
          "event_rsvp_status": "pending"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

## 5. UI Components

### 5.1 Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        UI COMPONENT TREE                                    │
└─────────────────────────────────────────────────────────────────────────────┘

  EntityListOfInstancesPage (person-calendar)
  │
  ├── ViewSwitcher
  │   ├── Table View
  │   ├── Kanban View
  │   └── Calendar View ← Default for person-calendar
  │
  └── CalendarView.tsx
      │
      ├── Month/Week/Day Navigation
      │
      ├── Event Cards (colored by type)
      │   └── onClick → CalendarEventModal (view/edit)
      │
      └── Empty Slot Click
          └── CalendarEventModal (create)
              │
              ├── Event Details Section
              │   ├── Name input
              │   ├── Date/Time pickers
              │   ├── On-site/Virtual toggle
              │   └── Platform chips
              │
              ├── Organizers Section
              │   └── SearchableMultiSelect (employees)
              │
              └── Attendees Section
                  └── SearchableMultiSelect (employees + customers)
```

### 5.2 CalendarEventModal (v2.0)

**Design System**: Futuristic, elegant (inspired by Linear, Vercel, Apple)

- **Glassmorphism**: `backdrop-blur-sm`, `bg-dark-100/50`
- **Micro-animations**: Fade + scale on open/close, chevron rotation
- **Collapsible Sections**: Accordion pattern with smooth transitions
- **Toggle Buttons**: On-site/Virtual with checkmark indicator
- **Platform Chips**: Zoom, Teams, Meet, Office, etc.
- **Multi-select**: Organizers and Attendees with search

---

## 6. Integration Points

### 6.1 RBAC Integration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PERMISSION MODEL                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Permission Levels:                                                         │
│  ─────────────────                                                          │
│  0 = VIEW      Read event details                                           │
│  1 = EDIT      Modify event                                                 │
│  2 = SHARE     Share with others                                            │
│  3 = DELETE    Soft delete event                                            │
│  4 = CREATE    Create new events (type-level)                               │
│  5 = OWNER     Full control (implies all)                                   │
│                                                                             │
│  Automatic Grants:                                                          │
│  ────────────────                                                           │
│  • Event creator → OWNER (5) for that event                                 │
│  • Organizer → OWNER (5) if different from creator                          │
│  • Attendees → VIEW (0) for their events                                    │
│                                                                             │
│  RBAC Enforcement:                                                          │
│  ─────────────────                                                          │
│  • LIST: Only events user has VIEW permission for                           │
│  • GET:  Check VIEW permission for specific event                           │
│  • POST: Check CREATE permission (type-level)                               │
│  • PATCH: Check EDIT permission                                             │
│  • DELETE: Check DELETE permission                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Entity Infrastructure Integration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ENTITY INFRASTRUCTURE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Entity Registration (entity_instance):                                     │
│  ──────────────────────────────────────                                     │
│  • Every event registered with entity_code='event'                          │
│  • Enables universal search, linking, RBAC                                  │
│                                                                             │
│  Entity Linkages (entity_instance_link):                                    │
│  ───────────────────────────────────────                                    │
│  event → service    (what service this appointment is for)                  │
│  event → customer   (which customer is involved)                            │
│  event → project    (which project this meeting is about)                   │
│  event → task       (which task is being discussed)                         │
│                                                                             │
│  NOTE: Attendee tracking is via entity_event_person_calendar,               │
│        NOT entity_instance_link (separate RSVP semantics)                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Testing & Debugging

### 7.1 API Testing

```bash
# List events
./tools/test-api.sh GET /api/v1/event

# Get enriched events (with organizer + attendees)
./tools/test-api.sh GET /api/v1/event/enriched

# Get single event
./tools/test-api.sh GET /api/v1/event/{uuid}

# Get event attendees
./tools/test-api.sh GET /api/v1/event/{uuid}/attendees

# List calendar slots
./tools/test-api.sh GET /api/v1/person-calendar

# Get enriched calendar (slots + event details)
./tools/test-api.sh GET /api/v1/person-calendar/enriched
```

### 7.2 Common SQL Queries

```sql
-- Get upcoming events
SELECT code, name, event_type, from_ts, to_ts
FROM app.event
WHERE active_flag = true AND from_ts >= now()
ORDER BY from_ts;

-- Get attendees for an event
SELECT
  epc.person_entity_type,
  epc.event_rsvp_status,
  CASE
    WHEN epc.person_entity_type = 'employee' THEN e.name
    WHEN epc.person_entity_type = 'customer' THEN c.name
  END as person_name
FROM app.entity_event_person_calendar epc
LEFT JOIN app.employee e ON epc.person_id = e.id AND epc.person_entity_type = 'employee'
LEFT JOIN app.customer c ON epc.person_id = c.id AND epc.person_entity_type = 'customer'
WHERE epc.event_id = 'uuid' AND epc.active_flag = true;

-- Find available slots for an employee
SELECT id, from_ts, to_ts
FROM app.person_calendar
WHERE person_entity_type = 'employee'
  AND person_id = 'employee-uuid'
  AND availability_flag = true
  AND from_ts >= now()
ORDER BY from_ts;

-- RSVP summary for an event
SELECT
  event_rsvp_status,
  COUNT(*) as count
FROM app.entity_event_person_calendar
WHERE event_id = 'uuid' AND active_flag = true
GROUP BY event_rsvp_status;
```

---

## 8. Architecture Decisions

### 8.1 Why Three Tables?

| Pattern | Alternative | Our Choice | Rationale |
|---------|-------------|------------|-----------|
| Single Monolithic Table | ❌ | Separate `event`, `person_calendar`, `entity_event_person_calendar` | Separation of concerns: Event (what), Availability (when free), RSVP (who attends) |
| Foreign Keys | ❌ | Polymorphic with entity codes | Microservices-ready, no circular dependencies |
| RSVP in Event Table | ❌ | Junction table | Many-to-many with metadata (status, time commitment) |

### 8.2 Why Polymorphic Person References?

```
PROBLEM: Attendees can be employees OR customers
─────────────────────────────────────────────────

Option A: Separate columns (employee_id, customer_id)
  ❌ NULL columns, awkward queries, not extensible

Option B: Separate junction tables
  ❌ Duplicated logic, harder to query "all attendees"

Option C: Polymorphic (person_entity_type + person_id) ✅
  ✓ Single table, extensible to new person types
  ✓ Query: WHERE person_entity_type = 'employee' AND person_id = ?
  ✓ Industry pattern: Salesforce, HubSpot, most modern CRMs
```

### 8.3 Why Pre-seeded Availability Slots?

```
PROBLEM: How to model employee availability?
────────────────────────────────────────────

Option A: Calculate on-the-fly from existing events
  ❌ Slow queries, complex inverse logic

Option B: Store "blocked time" only
  ❌ Harder to visualize "open" time

Option C: Pre-seed 15-minute slots, mark as booked ✅
  ✓ Fast availability queries (WHERE availability_flag = true)
  ✓ Visual calendar representation
  ✓ Industry pattern: Calendly, Cal.com slot architecture
  ✓ Trade-off: More storage, but faster reads
```

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 5.0 | 2025-12-05 | Added business flow, data flow, logical flow diagrams; Architecture decisions; Industry patterns |
| 4.0 | 2025-12-05 | Fixed table names (removed `d_` prefix); Consolidated README |
| 3.0 | 2025-11-27 | Added organizer__employee_id, RSVP tracking |
| 2.0 | 2025-11-20 | Three-table architecture (event, person_calendar, event_person_calendar) |
| 1.0 | 2025-11-15 | Initial calendar system |

---

**Maintained By**: PMO Development Team
**Documentation Status**: Production
