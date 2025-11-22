# PMO Calendar & Event Management System
**Version**: 3.1
**Last Updated**: 2025-11-13
**Status**: Production Ready

---

## Table of Contents
1. [Business Overview](#business-overview)
2. [Business Semantics](#business-semantics)
3. [Entity Relationship Model](#entity-relationship-model)
4. [Data Model](#data-model)
5. [API Layer](#api-layer)
6. [UI/UX Layer](#uiux-layer)
7. [Data Flow Architecture](#data-flow-architecture)
8. [System Behavior](#system-behavior)
9. [Integration Points](#integration-points)

---

## Business Overview

### Purpose
The PMO Calendar & Event Management System enables scheduling, tracking, and managing events, meetings, and appointments across the organization. It supports service appointments, project meetings, task discussions, quote reviews, and product demonstrations.

### Key Business Capabilities
- **Event Scheduling**: Create and manage onsite/virtual events
- **Attendee Management**: Track who's involved with RSVP status
- **Organizer Tracking**: Record which employee organized each event
- **Action Entity Linkage**: Connect events to business entities (services, projects, tasks, quotes, products)
- **Availability Management**: Track employee availability for scheduling
- **RBAC Integration**: Permission-based access to events

---

## Business Semantics

### Core Concepts

#### 1. Event (d_event)
**Definition**: A scheduled occurrence at a specific time involving people, related to a business entity.

**Business Purpose**: Events are the primary mechanism for coordinating activities across the organization. Every event answers three critical questions:
1. **WHAT** is the event about? → `event_action_entity_code` + `event_action_entity_id`, complete event metadata is d_event table
2. **WHO** organized it? → `organizer_employee_id`
3. **WHO** is involved? → `d_entity_event_person_calendar` (attendees)

**Event Types**:
- **Service Appointments**: Customer meetings for service delivery (HVAC, plumbing, electrical)
- **Project Meetings**: Reviews, kickoffs, milestone discussions
- **Task Sessions**: Planning, standup, retrospective meetings
- **Quote Reviews**: Sales meetings to discuss quotes with customers
- **Product Demos**: Demonstrations of products to potential customers

**Location Types**:
- **Onsite**: Physical locations (office, customer site, conference hall)
- **Virtual**: Online meetings (Zoom, Teams, Google Meet)

#### 2. Person Calendar (d_entity_event_person_calendar)
**Definition**: The association between people (employees/customers) and events, including their RSVP status.

**Business Purpose**: Tracks attendance and commitment. Enables scheduling conflicts detection and capacity planning.

**RSVP States**:
- `pending`: Invitation sent, awaiting response
- `accepted`: Confirmed attendance
- `declined`: Cannot attend

#### 3. Personal Availability (d_person_calendar)
**Definition**: Employee availability slots for scheduling optimization.

**Business Purpose**: Prevents double-booking and enables smart scheduling suggestions.

---

## Entity Relationship Model

### ER Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                   EVENT MANAGEMENT SYSTEM                       │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐                ┌──────────────────┐
│   d_employee     │                │   d_customer     │
│                  │                │                  │
│ • id (PK)        │                │ • id (PK)        │
│ • name           │                │ • name           │
│ • email          │                │ • email          │
└────────┬─────────┘                └────────┬─────────┘
         │                                   │
         │ organizes                         │ can attend
         │                                   │
         │                          ┌────────▼─────────┐
         │                          │  PERSON ENTITY   │
         │                          │ (employee/cust)  │
         │                          └────────┬─────────┘
         │                                   │
         ▼                                   │ attends
┌──────────────────────────────────────┐    │
│           d_event                    │◄───┤
│                                      │    │
│ • id (PK)                            │    │
│ • code (UNIQUE)                      │    │
│ • name                               │    │
│ • descr                              │    │
│                                      │    │
│ ACTION ENTITY (what it's about):     │    │
│ • event_action_entity_code           │    │
│   ('service','product','project',    │    │
│    'task','quote')                   │    │
│ • event_action_entity_id (UUID)      │    │
│                                      │    │
│ ORGANIZER:                           │    │
│ • organizer_employee_id (FK)  ───────┘    │
│                                      │    │
│ LOGISTICS:                           │    │
│ • event_type (onsite/virtual)        │    │
│ • event_platform_provider_name       │    │
│ • venue_type                         │    │
│ • event_addr                         │    │
│ • event_instructions                 │    │
│                                      │    │
│ TIMING:                              │    │
│ • from_ts                            │    │
│ • to_ts                              │    │
│ • timezone                           │    │
│                                      │    │
│ METADATA:                            │    │
│ • event_metadata (JSONB)             │    │
│ • active_flag                        │    │
│ • created_ts                         │    │
│ • updated_ts                         │    │
│ • version                            │    │
└───────────────┬──────────────────────┘    │
                │                           │
                │ has attendees             │
                │                           │
                ▼                           │
┌───────────────────────────────────────────┴─┐
│  d_entity_event_person_calendar             │
│                                             │
│ • id (PK)                                   │
│ • event_id (FK → d_event)                   │
│ • person_entity_code (employee/customer)    │
│ • person_entity_id (FK → employee/customer) │
│ • event_rsvp_status (pending/accepted/...)  │
│ • from_ts                                   │
│ • to_ts                                     │
│ • active_flag                               │
└─────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│           ACTION ENTITIES (what events are about)            │
└──────────────────────────────────────────────────────────────┘

┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ d_service   │  │ d_product   │  │ d_project   │
│             │  │             │  │             │
│ • id (PK)   │  │ • id (PK)   │  │ • id (PK)   │
│ • name      │  │ • name      │  │ • name      │
└─────────────┘  └─────────────┘  └─────────────┘
       ▲                ▲                ▲
       │                │                │
       └────────────────┴────────────────┘
              Referenced by d_event
           event_action_entity_id

┌─────────────┐  ┌─────────────┐
│  d_task     │  │  d_quote    │
│             │  │             │
│ • id (PK)   │  │ • id (PK)   │
│ • name      │  │ • name      │
└─────────────┘  └─────────────┘
       ▲                ▲
       │                │
       └────────────────┘
         Referenced by d_event
      event_action_entity_id

┌─────────────────────────────────────────────────────────────┐
│              PERSONAL AVAILABILITY TRACKING                 │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐
│ d_employee       │
└────────┬─────────┘
         │ has availability slots
         ▼
┌────────────────────────────────────┐
│   d_person_calendar                │
│                                    │
│ • id (PK)                          │
│ • person_entity_code (employee)    │
│ • person_entity_id (FK)            │
│ • from_ts                          │
│ • to_ts                            │
│ • availability_flag (true=avail)   │
│ • recurring_pattern (JSONB)        │
│ • active_flag                      │
└────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    RBAC INTEGRATION                         │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐
│ d_employee       │
└────────┬─────────┘
         │ has permissions on
         ▼
┌────────────────────────────────────┐
│  entity_rbac                │
│                                    │
│ • empid (FK → d_employee)          │
│ • entity ('event')                 │
│ • entity_id (FK → d_event.id)      │
│ • permission [view,edit,share,     │
│              delete,create,owner]  │
│ • granted_by_empid                 │
└────────────────────────────────────┘
```

### Key Relationships

1. **Event → Organizer**: `d_event.organizer_employee_id` → `d_employee.id`
   - One-to-One: Each event has exactly one organizer
   - Mandatory: Cannot be NULL

2. **Event → Action Entity**: Polymorphic via type discriminator
   - `event_action_entity_code` determines which table to join
   - `event_action_entity_id` is the foreign key
   - Example: type='service', id='uuid' → `d_service.id`

3. **Event → Attendees**: Many-to-Many through `d_entity_event_person_calendar`
   - One event has many attendees
   - One person attends many events
   - Junction table tracks RSVP status

4. **Event → RBAC**: Through `entity_rbac`
   - Organizer automatically gets Owner permission [5]
   - Additional permissions can be granted

---

## Data Model

### Table: d_event

```sql
CREATE TABLE app.d_event (
  -- Identity
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  name varchar(200) NOT NULL,
  descr text,

  -- Action Entity (what the event is about)
  event_action_entity_code varchar(100) NOT NULL,
    -- Values: 'service', 'product', 'project', 'task', 'quote'
  event_action_entity_id uuid NOT NULL,

  -- Organizer
  organizer_employee_id uuid,
    -- FK to d_employee.id

  -- Logistics
  event_type varchar(100) NOT NULL,
    -- Values: 'onsite', 'virtual'
  event_platform_provider_name varchar(50) NOT NULL,
    -- Examples: 'zoom', 'teams', 'google_meet', 'office', 'physical_hall'
  venue_type varchar(100),
    -- Examples: 'conference_room', 'office', 'warehouse', 'customer_site', 'remote'
  event_addr text,
    -- Physical address OR meeting URL
  event_instructions text,
    -- Access codes, parking info, preparation notes

  -- Timing
  from_ts timestamptz NOT NULL,
  to_ts timestamptz NOT NULL,
  timezone varchar(50) DEFAULT 'America/Toronto',

  -- Metadata & Audit
  event_metadata jsonb DEFAULT '{}'::jsonb,
  active_flag boolean DEFAULT true,
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now(),
  version integer DEFAULT 1,

  -- Constraints
  CONSTRAINT chk_event_action_entity_code
    CHECK (event_action_entity_code IN ('service', 'product', 'project', 'task', 'quote'))
);
```

### Table: d_entity_event_person_calendar

```sql
CREATE TABLE app.d_entity_event_person_calendar (
  -- Identity
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL,
  name varchar(200) NOT NULL,

  -- Event Reference
  event_id uuid NOT NULL,
    -- FK to d_event.id

  -- Person Reference (Polymorphic)
  person_entity_code varchar(50) NOT NULL,
    -- Values: 'employee', 'customer', 'client'
  person_entity_id uuid NOT NULL,
    -- FK to d_employee.id OR d_customer.id

  -- RSVP Status
  event_rsvp_status varchar(50) NOT NULL DEFAULT 'pending',
    -- Values: 'pending', 'accepted', 'declined'

  -- Time Slot (for the attendee)
  from_ts timestamptz NOT NULL,
  to_ts timestamptz NOT NULL,
  timezone varchar(50) DEFAULT 'America/Toronto',

  -- Metadata & Audit
  metadata jsonb DEFAULT '{}'::jsonb,
  active_flag boolean DEFAULT true,
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now(),
  version integer DEFAULT 1
);
```

### Table: d_person_calendar

```sql
CREATE TABLE app.d_person_calendar (
  -- Identity
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL,
  name varchar(200) NOT NULL,

  -- Person Reference
  person_entity_code varchar(50) NOT NULL,
    -- Values: 'employee'
  person_entity_id uuid NOT NULL,
    -- FK to d_employee.id

  -- Availability Slot
  from_ts timestamptz NOT NULL,
  to_ts timestamptz NOT NULL,
  timezone varchar(50) DEFAULT 'America/Toronto',
  availability_flag boolean DEFAULT true,
    -- true = available, false = busy/blocked

  -- Recurring Pattern
  recurring_pattern jsonb,
    -- For repeating availability slots

  -- Metadata & Audit
  metadata jsonb DEFAULT '{}'::jsonb,
  active_flag boolean DEFAULT true,
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now(),
  version integer DEFAULT 1
);
```

### Indexes

```sql
-- Event indexes
CREATE INDEX idx_event_organizer ON app.d_event(organizer_employee_id);
CREATE INDEX idx_event_action_entity ON app.d_event(event_action_entity_code, event_action_entity_id);
CREATE INDEX idx_event_time ON app.d_event(from_ts, to_ts);
CREATE INDEX idx_event_active ON app.d_event(active_flag);

-- Event-Person calendar indexes
CREATE INDEX idx_event_person_event ON app.d_entity_event_person_calendar(event_id);
CREATE INDEX idx_event_person_person ON app.d_entity_event_person_calendar(person_entity_code, person_entity_id);
CREATE INDEX idx_event_person_rsvp ON app.d_entity_event_person_calendar(event_rsvp_status);

-- Person calendar indexes
CREATE INDEX idx_person_cal_person ON app.d_person_calendar(person_entity_code, person_entity_id);
CREATE INDEX idx_person_cal_time ON app.d_person_calendar(from_ts, to_ts);
CREATE INDEX idx_person_cal_avail ON app.d_person_calendar(availability_flag);
```

---

## API Layer

### Endpoints

#### 1. GET /api/v1/event
**Purpose**: List all events with pagination and filtering

**Query Parameters**:
- `event_type`: Filter by 'onsite' or 'virtual'
- `event_platform_provider_name`: Filter by platform
- `from_ts`: Events starting after this timestamp
- `to_ts`: Events ending before this timestamp
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 20)

**Response Structure**:
```json
{
  "data": [
    {
      "id": "uuid",
      "code": "EVT-HVAC-001",
      "name": "HVAC System Consultation",
      "descr": "Initial consultation...",

      "event_action_entity_code": "service",
      "event_action_entity_id": "uuid",
      "organizer_employee_id": "uuid",
      "venue_type": "customer_site",

      "event_type": "onsite",
      "event_platform_provider_name": "office",
      "event_addr": "123 Main Street, Toronto",
      "event_instructions": "Ring doorbell...",

      "from_ts": "2025-11-14T14:00:00Z",
      "to_ts": "2025-11-14T16:00:00Z",
      "timezone": "America/Toronto",

      "event_metadata": {},
      "active_flag": true,
      "created_ts": "2025-11-13T19:37:54Z",
      "updated_ts": "2025-11-13T19:37:54Z",
      "version": 1,

      "organizer": {
        "empid": "uuid",
        "name": "James Miller",
        "email": "james.miller@huronhome.ca"
      }
    }
  ],
  "total": 6,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

#### 2. GET /api/v1/event/enriched
**Purpose**: Get events with full organizer and attendee details

**Query Parameters**:
- `from_ts`: Events starting after
- `to_ts`: Events ending before
- `person_id`: Filter by person involvement (organizer or attendee)
- `person_type`: Type of person ('employee', 'customer')
- `page`, `limit`: Pagination

**Response Structure**:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "HVAC System Consultation",

      "organizer": {
        "empid": "uuid",
        "name": "James Miller",
        "email": "james@..."
      },

      "attendees": [
        {
          "person_entity_code": "employee",
          "person_entity_id": "uuid",
          "person_name": "Jane Doe",
          "person_email": "jane@...",
          "event_rsvp_status": "accepted"
        }
      ],

      "..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

#### 3. GET /api/v1/event/:id
**Purpose**: Get single event details with linked entities

**Response Structure**:
```json
{
  "id": "uuid",
  "code": "EVT-HVAC-001",
  "name": "HVAC System Consultation",

  "attendees": [
    {
      "id": "uuid",
      "person_entity_code": "employee",
      "person_entity_id": "uuid",
      "event_rsvp_status": "accepted",
      "from_ts": "...",
      "to_ts": "..."
    }
  ],

  "linked_entities": [
    {
      "child_entity_code": "service",
      "child_entity_id": "uuid",
      "relationship_type": "event_action"
    }
  ]
}
```

#### 4. POST /api/v1/event
**Purpose**: Create new event

**Request Body**:
```json
{
  "code": "EVT-HVAC-001",
  "name": "HVAC System Consultation",
  "descr": "Initial consultation...",

  "event_action_entity_code": "service",
  "event_action_entity_id": "uuid",
  "organizer_employee_id": "uuid",

  "event_type": "onsite",
  "event_platform_provider_name": "office",
  "venue_type": "customer_site",
  "event_addr": "123 Main Street",
  "event_instructions": "Ring doorbell...",

  "from_ts": "2025-11-14T14:00:00Z",
  "to_ts": "2025-11-14T16:00:00Z",
  "timezone": "America/Toronto",

  "attendees": [
    {
      "person_entity_code": "employee",
      "person_entity_id": "uuid",
      "event_rsvp_status": "accepted"
    }
  ]
}
```

**Behavior**:
1. Creates event record in `d_event`
2. Registers in `entity_instance`
3. Grants Owner permission [7] to creator via `entity_rbac`
4. Adds organizer as attendee with `accepted` RSVP
5. Creates attendee records in `d_entity_event_person_calendar`

**Response**: Created event with 201 status

#### 5. PATCH /api/v1/event/:id
**Purpose**: Update event details

**Request Body**: Partial event object (only fields to update)

**Behavior**:
- Updates specified fields
- Increments version
- Updates `updated_ts`

#### 6. DELETE /api/v1/event/:id
**Purpose**: Soft-delete event

**Behavior**:
1. Sets `active_flag = false` on event
2. Soft-deletes linked attendee records
3. Soft-deletes entity linkages in `entity_instance_link`

---

## UI/UX Layer

### Components

#### 1. CalendarView.tsx
**Purpose**: Main calendar interface showing events

**Features**:
- Month/Week/Day views
- Event cards with organizer and time
- Click to view details
- Click empty slot to create event
- Filter by employee/customer
- Color coding by event type

**Data Flow**:
```
1. Component mounts → Fetch events from API
2. User filters → Re-fetch with query params
3. User clicks event → Show CalendarEventModal (view mode)
4. User clicks empty → Show CalendarEventModal (create mode)
```

#### 2. CalendarEventModal.tsx
**Purpose**: Create/Edit event dialog

**Fields**:
```
┌─────────────────────────────────────────────┐
│ Event Information                           │
├─────────────────────────────────────────────┤
│ Event Name: [___________________________]  │
│ Description: [_________________________]   │
│ Start Date: [________] Time: [_______]     │
│ End Date: [________] Time: [_______]       │
│                                             │
│ Event About:                                │
│   Type: [Service ▼]                         │
│   Entity: [HVAC Service ▼]  ← Shows names  │
│                                             │
│ Organizer: [James Miller ▼]  ← Shows names │
│                                             │
│ Location Type:                              │
│   • Onsite  ○ Virtual                       │
│                                             │
│ Platform: [Office ▼]                        │
│ Venue: [Customer Site ▼]                    │
│ Address: [___________________________]      │
│ Instructions: [_______________________]     │
├─────────────────────────────────────────────┤
│ Attendees                                   │
├─────────────────────────────────────────────┤
│ [+ Add Employee] [+ Add Customer]           │
│                                             │
│ ☑ Jane Doe (Accepted)         [Remove]     │
│ ☑ John Smith (Pending)        [Remove]     │
└─────────────────────────────────────────────┘
```

**Form State**:
```typescript
interface EventFormData {
  name: string;
  descr?: string;

  // IDs submitted to API
  event_action_entity_code: 'service' | 'product' | 'project' | 'task' | 'quote';
  event_action_entity_id: string;  // UUID
  organizer_employee_id: string;   // UUID

  event_type: 'onsite' | 'virtual';
  event_platform_provider_name: string;
  venue_type?: string;
  event_addr?: string;
  event_instructions?: string;

  from_ts: string;  // ISO timestamp
  to_ts: string;
  timezone: string;

  attendees: Array<{
    person_entity_code: 'employee' | 'customer';
    person_entity_id: string;  // UUID
    event_rsvp_status: 'pending' | 'accepted' | 'declined';
  }>;
}
```

**Validation Rules**:
- Name: Required, max 200 chars
- Start time: Required, must be in future
- End time: Required, must be after start time
- Event action entity: Required
- Organizer: Defaults to current user if not specified

**Submission Flow**:
```
1. User fills form with names (dropdowns)
2. Form validation
3. Convert names to IDs
4. POST /api/v1/event with IDs
5. API creates event and attendees
6. Modal closes
7. Calendar refreshes
```

#### 3. CalendarEventPopover.tsx
**Purpose**: Quick view popup on hover/click

**Displays**:
- Event name
- Organizer name (not ID)
- Time range
- Location
- RSVP status
- Quick actions (Edit, Delete)

---

## Data Flow Architecture

### Complete Request-Response Cycle

```
┌──────────────────────────────────────────────────────────────────┐
│                    USER CREATES EVENT                            │
└──────────────────────────────────────────────────────────────────┘

1. USER INTERACTION (Browser)
   ├─ User opens CalendarEventModal
   ├─ Selects "Service" from Event Type dropdown
   ├─ Dropdown fetches: GET /api/v1/service → Shows "HVAC Service"
   ├─ User selects "HVAC Service" (stores service_id in state)
   ├─ Selects "James Miller" from Organizer dropdown (stores employee_id)
   └─ Fills in time, location, attendees

2. FORM SUBMISSION (React)
   ├─ Validate form data
   ├─ Transform state to API format:
   │  {
   │    "name": "HVAC Consultation",
   │    "event_action_entity_code": "service",
   │    "event_action_entity_id": "93106ffb...",  ← UUID
   │    "organizer_employee_id": "8260b1b0...",   ← UUID
   │    "from_ts": "2025-11-14T14:00:00Z",
   │    ...
   │  }
   └─ POST /api/v1/event

3. API REQUEST HANDLING (Fastify)
   ├─ Authenticate JWT token
   ├─ Extract user ID from token (request.user.sub)
   ├─ Validate request body against schema
   ├─ Check RBAC permissions (user can create events?)
   └─ Call event creation service

4. DATABASE OPERATIONS (PostgreSQL)
   ├─ BEGIN TRANSACTION
   │
   ├─ INSERT INTO app.d_event
   │  (id, code, name, descr,
   │   event_action_entity_code,
   │   event_action_entity_id,
   │   organizer_employee_id,
   │   event_type, venue_type,
   │   from_ts, to_ts, ...)
   │  VALUES (gen_random_uuid(), ...)
   │  RETURNING id, code, name, ...
   │
   ├─ INSERT INTO app.entity_instance
   │  (entity_code, entity_instance_id, entity_instance_name, code)
   │  VALUES ('event', new_event_id, ...)
   │
   ├─ INSERT INTO app.entity_rbac
   │  (empid, entity, entity_id, permission)
   │  VALUES (creator_id, 'event', new_event_id, ARRAY[0,1,2,3,4,5])
   │  -- Grant Owner [5] permission to creator
   │
   ├─ INSERT INTO app.d_entity_event_person_calendar
   │  (event_id, person_entity_code, person_entity_id, event_rsvp_status, ...)
   │  VALUES (new_event_id, 'employee', organizer_id, 'accepted', ...)
   │  -- Add organizer as accepted attendee
   │
   ├─ FOR EACH additional attendee:
   │  INSERT INTO app.d_entity_event_person_calendar
   │  (event_id, person_entity_code, person_entity_id, event_rsvp_status, ...)
   │  VALUES (new_event_id, attendee_type, attendee_id, 'pending', ...)
   │
   └─ COMMIT TRANSACTION

5. API RESPONSE (Fastify)
   ├─ Query created event with enriched data:
   │  SELECT e.*,
   │    (SELECT jsonb_build_object('empid', emp.id, 'name', emp.name, ...)
   │     FROM d_employee emp WHERE emp.id = e.organizer_employee_id) as organizer
   │  FROM d_event e WHERE e.id = new_event_id
   │
   └─ Return 201 Created with:
      {
        "id": "new_event_id",
        "code": "EVT-HVAC-001",
        "name": "HVAC Consultation",
        "event_action_entity_id": "93106ffb...",
        "organizer_employee_id": "8260b1b0...",
        "organizer": {
          "empid": "8260b1b0...",
          "name": "James Miller",          ← ENRICHED
          "email": "james@huronhome.ca"
        },
        "attendees": [...]
      }

6. UI UPDATE (React)
   ├─ Receive API response
   ├─ Close modal
   ├─ Refresh calendar view: GET /api/v1/event
   ├─ Display new event card showing:
   │  • Event name
   │  • Organizer name (from organizer.name)  ← NOT organizer_employee_id
   │  • Time
   │  • Location
   └─ Success toast notification

┌──────────────────────────────────────────────────────────────────┐
│                     USER VIEWS EVENT                             │
└──────────────────────────────────────────────────────────────────┘

1. USER CLICKS EVENT CARD
   └─ GET /api/v1/event/:id

2. API ENRICHES DATA
   ├─ Query d_event table
   ├─ LEFT JOIN d_employee for organizer details
   ├─ Query d_entity_event_person_calendar for attendees
   ├─ LEFT JOIN d_employee/d_customer for attendee names
   └─ Return enriched response

3. UI DISPLAYS
   ├─ Modal shows event details
   ├─ Organizer: "James Miller" (not UUID)
   ├─ Event About: "HVAC Service" (not UUID)
   ├─ Attendees list with names
   └─ All IDs hidden from user

┌──────────────────────────────────────────────────────────────────┐
│                   ID ↔ NAME TRANSLATION                          │
└──────────────────────────────────────────────────────────────────┘

DATABASE STORES:              API RETURNS:              UI SHOWS:
┌─────────────────┐          ┌──────────────────┐     ┌───────────┐
│ organizer_      │          │ organizer_       │     │ Organizer:│
│ employee_id:    │──────────│ employee_id:     │     │           │
│ "8260b1b0..."   │          │ "8260b1b0..."    │     │ James     │
│                 │          │                  │     │ Miller    │
│                 │          │ organizer: {     │     │           │
│                 │          │   name: "James   │─────│           │
│                 │          │         Miller"  │     │           │
│                 │          │ }                │     │           │
└─────────────────┘          └──────────────────┘     └───────────┘

USER SELECTS:               FORM SUBMITS:           DB RECEIVES:
┌───────────────┐          ┌─────────────────┐    ┌──────────────┐
│ Dropdown:     │          │ {               │    │ INSERT INTO  │
│ ☑ James Miller│──────────│  organizer_     │────│   d_event    │
│ ○ Jane Doe    │          │  employee_id:   │    │ SET          │
│ ○ John Smith  │          │  "8260b1b0..."  │    │ organizer_   │
│               │          │ }               │    │ employee_id  │
│ (Stored ID:   │          │                 │    │ =            │
│ "8260b1b0...")│          │                 │    │ '8260b1b0..' │
└───────────────┘          └─────────────────┘    └──────────────┘
```

---

## System Behavior

### Scenario 1: Customer Self-Schedules Service Appointment

**Business Flow**:
1. Customer visits public booking page
2. Selects service type (HVAC)
3. Chooses available time slot
4. System creates event automatically

**Technical Implementation**:
```javascript
// 1. Public booking page fetches availability
GET /api/v1/person-calendar?person_type=employee&availability_flag=true&from_ts=...

// 2. Customer submits booking
POST /api/v1/event
{
  "event_action_entity_code": "service",
  "event_action_entity_id": "hvac_service_id",
  "organizer_employee_id": "assigned_tech_id",  // System assigns
  "event_type": "onsite",
  "from_ts": "...",
  "to_ts": "...",
  "attendees": [
    {
      "person_entity_code": "customer",
      "person_entity_id": "customer_id",
      "event_rsvp_status": "accepted"
    },
    {
      "person_entity_code": "employee",
      "person_entity_id": "assigned_tech_id",
      "event_rsvp_status": "accepted"
    }
  ]
}

// 3. System creates event
// 4. Marks technician's time as busy in person_calendar
// 5. Sends confirmation emails to customer and tech
```

### Scenario 2: Project Manager Schedules Review Meeting

**Business Flow**:
1. PM opens calendar from project detail page
2. Clicks "Schedule Review" button
3. System pre-fills project information
4. PM selects team members as attendees
5. Creates event

**Technical Implementation**:
```javascript
// 1. Button on project page passes context
navigate('/calendar/create', {
  state: {
    event_action_entity_code: 'project',
    event_action_entity_id: project.id
  }
});

// 2. Modal pre-fills form
<CalendarEventModal
  initialData={{
    event_action_entity_code: 'project',
    event_action_entity_id: project.id,
    organizer_employee_id: currentUser.id
  }}
/>

// 3. PM adds attendees and submits
POST /api/v1/event
{
  "event_action_entity_code": "project",
  "event_action_entity_id": "project_uuid",
  "organizer_employee_id": "pm_uuid",
  "attendees": [
    { "person_entity_code": "employee", "person_entity_id": "dev1_uuid", ... },
    { "person_entity_code": "employee", "person_entity_id": "dev2_uuid", ... }
  ]
}

// 4. System sends calendar invites to attendees
// 5. Attendees can accept/decline via RSVP
```

### Scenario 3: Sales Rep Schedules Quote Review

**Business Flow**:
1. Sales rep opens quote detail page
2. Clicks "Schedule Review with Customer"
3. System suggests times based on availability
4. Rep selects time and invites customer
5. Creates virtual meeting

**Technical Implementation**:
```javascript
// 1. Quote page shows "Schedule Review" button
<button onClick={handleScheduleQuoteReview}>
  Schedule Review with Customer
</button>

// 2. Handler fetches availability
const handleScheduleQuoteReview = async () => {
  const availability = await fetch(
    `/api/v1/person-calendar?person_id=${currentUser.id}&availability_flag=true`
  );

  openModal({
    event_action_entity_code: 'quote',
    event_action_entity_id: quote.id,
    organizer_employee_id: currentUser.id,
    event_type: 'virtual',
    event_platform_provider_name: 'zoom',
    suggested_times: availability.data
  });
};

// 3. Rep creates event
POST /api/v1/event
{
  "event_action_entity_code": "quote",
  "event_action_entity_id": "quote_uuid",
  "organizer_employee_id": "sales_rep_uuid",
  "event_type": "virtual",
  "event_platform_provider_name": "zoom",
  "event_addr": "https://zoom.us/j/meeting-123",
  "attendees": [
    { "person_entity_code": "customer", "person_entity_id": "customer_uuid", ... }
  ]
}

// 4. System generates Zoom link (if integrated)
// 5. Sends email with meeting link to customer
```

### Scenario 4: Employee Views Their Calendar

**Business Flow**:
1. Employee opens calendar page
2. System filters events where employee is organizer OR attendee
3. Shows all relevant events
4. Color codes by RSVP status

**Technical Implementation**:
```javascript
// 1. Fetch events for current user
GET /api/v1/event/enriched?person_id={employee_id}&person_type=employee

// 2. API filters events
SELECT e.*
FROM d_event e
WHERE
  e.organizer_employee_id = '{employee_id}'
  OR EXISTS (
    SELECT 1 FROM entity_event_person_calendar epc
    WHERE epc.event_id = e.id
      AND epc.person_entity_code = 'employee'
      AND epc.person_entity_id = '{employee_id}'
  )

// 3. UI renders events
events.map(event => (
  <EventCard
    color={
      event.organizer_employee_id === currentUser.id
        ? 'blue'  // Organizer
        : getColorByRSVP(event.attendee_rsvp_status)
    }
  />
))
```

### Scenario 5: Scheduling Conflict Detection

**Business Flow**:
1. User tries to create event
2. System checks if attendees are available
3. Shows warning if conflicts detected
4. User can override or adjust time

**Technical Implementation**:
```javascript
// 1. Before creating event, check conflicts
POST /api/v1/event/check-conflicts
{
  "attendees": [
    { "person_entity_id": "employee1_id", "person_entity_code": "employee" }
  ],
  "from_ts": "2025-11-14T14:00:00Z",
  "to_ts": "2025-11-14T16:00:00Z"
}

// 2. API queries existing events
SELECT e.id, e.name, e.from_ts, e.to_ts
FROM d_event e
JOIN d_entity_event_person_calendar epc ON epc.event_id = e.id
WHERE epc.person_entity_id IN ('{employee1_id}')
  AND e.active_flag = true
  AND (
    (e.from_ts, e.to_ts) OVERLAPS ('2025-11-14T14:00:00Z', '2025-11-14T16:00:00Z')
  )

// 3. Returns conflicts
{
  "has_conflicts": true,
  "conflicts": [
    {
      "person_name": "John Doe",
      "event_name": "Project Meeting",
      "from_ts": "2025-11-14T13:00:00Z",
      "to_ts": "2025-11-14T15:00:00Z"
    }
  ]
}

// 4. UI shows warning
<ConflictWarning conflicts={conflicts} />
```

---

## Integration Points

### 1. RBAC System
**Integration**: `entity_rbac`

**Permissions**:
- `0`: View event details
- `1`: Edit event (time, location, attendees)
- `2`: Share event with others
- `3`: Delete event
- `4`: Create new events
- `5`: Owner (all permissions + transfer ownership)

**Behavior**:
- Event creator automatically gets Owner [5] permission
- Owner can grant permissions to other employees
- Organizer field is independent of RBAC (for display only)

### 2. Entity System
**Integration**: `entity`, `entity_instance`, `entity_instance_link`

**Event as Entity**:
- Registered in `entity` with code='event'
- Each event instance in `entity_instance`
- Can be parent/child in `entity_instance_link`

**Action Entity Linkage**:
- Event links to service/product/project/task/quote via `event_action_entity_id`
- Polymorphic design allows any entity type
- No foreign key constraints (uses linker tables)

### 3. Notification System
**Integration**: Future - `d_message` table

**Planned Behavior**:
- Event creation → Email to organizer and attendees
- RSVP change → Notify organizer
- Event update → Notify all attendees
- Reminder → 24h and 1h before event

### 4. Search System
**Integration**: Entity search API

**Searchable Fields**:
- Event name, description
- Organizer name
- Attendee names
- Event action entity name (joined)
- Location/address

---

## Appendix

### Data Validation Rules

```typescript
// Event creation validation
interface EventValidation {
  code: {
    required: true,
    unique: true,
    pattern: /^EVT-[A-Z0-9-]+$/,
    maxLength: 50
  },
  name: {
    required: true,
    minLength: 3,
    maxLength: 200
  },
  event_action_entity_code: {
    required: true,
    enum: ['service', 'product', 'project', 'task', 'quote']
  },
  event_action_entity_id: {
    required: true,
    type: 'uuid',
    exists: true  // Must reference existing entity
  },
  organizer_employee_id: {
    required: false,  // Defaults to current user
    type: 'uuid',
    exists: true  // Must be valid employee
  },
  from_ts: {
    required: true,
    type: 'timestamp',
    futureDate: true  // Must be in future (for new events)
  },
  to_ts: {
    required: true,
    type: 'timestamp',
    afterField: 'from_ts'  // Must be after from_ts
  },
  event_type: {
    required: true,
    enum: ['onsite', 'virtual']
  },
  venue_type: {
    required: false,
    enum: ['conference_room', 'office', 'warehouse', 'customer_site', 'remote', 'outdoor']
  }
}
```

### Query Performance Guidelines

```sql
-- Good: Uses index on organizer_employee_id
SELECT * FROM d_event
WHERE organizer_employee_id = '...'
  AND active_flag = true;

-- Good: Uses composite index on event_action_entity
SELECT * FROM d_event
WHERE event_action_entity_code = 'service'
  AND event_action_entity_id = '...'
  AND active_flag = true;

-- Good: Uses index on time range
SELECT * FROM d_event
WHERE from_ts >= NOW()
  AND to_ts <= NOW() + INTERVAL '7 days'
  AND active_flag = true;

-- Bad: Full table scan (no index on name)
SELECT * FROM d_event
WHERE name LIKE '%consultation%';

-- Better: Use full-text search
SELECT * FROM d_event
WHERE to_tsvector('english', name || ' ' || descr) @@ to_tsquery('consultation')
  AND active_flag = true;
```

### Testing Checklist

- [ ] Create event with all required fields
- [ ] Create event with optional fields
- [ ] Update event details
- [ ] Delete event (soft delete)
- [ ] Add attendees to event
- [ ] Remove attendees from event
- [ ] Change RSVP status
- [ ] Check scheduling conflicts
- [ ] Filter events by organizer
- [ ] Filter events by time range
- [ ] Filter events by action entity type
- [ ] Verify RBAC permissions enforced
- [ ] Verify organizer auto-added as attendee
- [ ] Verify enriched API responses include names
- [ ] Verify UI shows names not IDs

---

**Document Version**: 3.1
**Last Updated**: 2025-11-13
**Maintained By**: PMO Development Team
**Status**: Production Documentation
