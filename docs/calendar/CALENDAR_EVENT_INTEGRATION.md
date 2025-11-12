# Calendar-Event Integration Architecture

**Status:** Production-Ready
**Version:** 2.0.0
**Last Updated:** 2025-11-12
**Related Entities:** `calendar`, `event`, `event_person_calendar`
**Calendar UI Route:** `/calendar`
**Event API Endpoint:** `/api/v1/event`

---

## 1. Overview & Business Context

### Purpose

The Calendar-Event Integration provides a **unified calendar interface** where the calendar view wraps and displays event entities. This architecture enables:

- **Calendar as Container**: Calendar view serves as the UI wrapper for event entity management
- **Event as Data Entity**: Events are separate entities with their own backend API and full CRUD operations
- **In-Place Event Editing**: Meeting organizers can view and edit event details directly within the calendar view
- **Separation of Concerns**:
  - `d_entity_person_calendar` → General availability tracking (time slots when people are available)
  - `d_event` → Specific events/meetings/appointments (WHAT, WHEN, WHERE)
  - `d_entity_event_person_calendar` → Event RSVP tracking (WHO is invited, acceptance status)

### Business Value

- **Centralized Event Management**: All event operations accessible from familiar calendar interface
- **Context-Aware Editing**: Edit event details without navigating away from calendar view
- **RBAC-Based Ownership**: Event creators automatically receive full Owner permissions via entity_id_rbac_map
- **Universal Parent Entity**: Events can link to any entity (service, customer, task, project, etc.)

---

## 2. Architecture Layers

### System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    CALENDAR VIEW (/calendar)                      │
│                    (UI Container/Wrapper)                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                   CALENDAR GRID                            │  │
│  │  (Shows time slots, week navigation, date headers)         │  │
│  │                                                             │  │
│  │   Monday    Tuesday    Wednesday    Thursday    Friday     │  │
│  │  ┌──────┐  ┌──────┐    ┌──────┐    ┌──────┐   ┌──────┐   │  │
│  │  │ 9:00 │  │ 9:00 │    │ 9:00 │    │ 9:00 │   │ 9:00 │   │  │
│  │  ├──────┤  ├──────┤    ├──────┤    ├──────┤   ├──────┤   │  │
│  │  │ 9:15 │  │ 9:15 │    │ 9:15 │    │ 9:15 │   │ 9:15 │   │  │
│  │  └──────┘  └──────┘    └──────┘    └──────┘   └──────┘   │  │
│  │      ▲                                                      │  │
│  │      │                                                      │  │
│  │      └─── Click slot opens Event Pane ───────────┐         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    EVENT PANE                              │  │
│  │           (Separate entity editing interface)              │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │                                                             │  │
│  │  Event Name: [HVAC Consultation - Thompson Residence]      │  │
│  │  Description: [Initial consultation for HVAC system...]    │  │
│  │                                                             │  │
│  │  Event Type: ● Onsite  ○ Virtual                          │  │
│  │  Platform: [Office ▼]  (zoom, teams, google_meet, etc.)   │  │
│  │                                                             │  │
│  │  Address/URL: [123 Main Street, Toronto, ON M4W 1N4]      │  │
│  │  Instructions: [Ring doorbell at main entrance. Park...]   │  │
│  │                                                             │  │
│  │  Time Slot:                                                │  │
│  │    From: [2025-11-10 14:00] Timezone: [America/Toronto]   │  │
│  │    To:   [2025-11-10 16:00]                               │  │
│  │                                                             │  │
│  │  Attendees: (from d_entity_event_person_calendar)          │  │
│  │    ✓ John Smith (employee) - Accepted                     │  │
│  │    ✓ Sarah Thompson (customer) - Pending                  │  │
│  │    + Add Attendee                                          │  │
│  │                                                             │  │
│  │  Linked Entities: (from d_entity_id_map)                  │  │
│  │    🔧 Service: HVAC System Replacement                     │  │
│  │    📁 Project: Thompson Residence - HVAC                   │  │
│  │    👤 Customer: Sarah Thompson                             │  │
│  │    + Add Entity Link                                       │  │
│  │                                                             │  │
│  │  [Save Changes]  [Cancel]  [Delete Event]                 │  │
│  │                                                             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘

          ▲                                        ▲
          │                                        │
          │                                        │
   ┌──────────────┐                         ┌──────────────┐
   │   Frontend   │                         │   Frontend   │
   │  Calendar    │                         │    Event     │
   │  Component   │                         │   Component  │
   └──────────────┘                         └──────────────┘
          │                                        │
          │                                        │
          ▼                                        ▼
   ┌──────────────┐                         ┌──────────────┐
   │     API      │                         │     API      │
   │ /api/v1/     │                         │ /api/v1/     │
   │ person-      │                         │   event      │
   │ calendar     │                         │              │
   └──────────────┘                         └──────────────┘
          │                                        │
          │                                        │
          ▼                                        ▼
   ┌──────────────┐                         ┌──────────────┐
   │   Database   │                         │   Database   │
   │ d_entity_    │                         │   d_event    │
   │ person_      │                         │              │
   │ calendar     │                         │ d_entity_    │
   │ (availability│                         │ event_person_│
   │  tracking)   │                         │ calendar     │
   │              │                         │ (RSVP)       │
   │              │                         │              │
   │              │                         │ d_entity_id_ │
   │              │                         │ map          │
   │              │                         │ (linkages)   │
   │              │                         │              │
   │              │                         │ entity_id_   │
   │              │                         │ rbac_map     │
   │              │                         │ (ownership)  │
   └──────────────┘                         └──────────────┘
```

---

## 3. Data Model Separation

### Three Distinct Concerns

#### 1. **General Availability** (`d_entity_person_calendar`)
- **Purpose:** Track when people (employees/customers) are generally available or blocked
- **Granularity:** 15-minute time slots
- **Time Range:** 9 AM - 8 PM (configurable)
- **Use Case:** "Mark John as unavailable every Friday afternoon"
- **API Endpoint:** `/api/v1/person-calendar`

**Fields:**
```sql
id, code, name
person_entity_type, person_entity_id  -- 'employee' | 'customer'
from_ts, to_ts, timezone
event_id (optional) -- Links to specific event if slot is for event
metadata
```

#### 2. **Event Details** (`d_event`)
- **Purpose:** Define WHAT is happening, WHEN it happens, and WHERE it happens
- **Universal Parent:** Can link to ANY entity via d_entity_id_map
- **Time-Bound:** Every event has from_ts/to_ts
- **RBAC-Based Ownership:** Creator automatically receives Owner permission [5]
- **API Endpoint:** `/api/v1/event`

**Fields:**
```sql
id, code, name, descr
event_type                        -- 'onsite' | 'virtual'
event_platform_provider_name      -- 'zoom', 'teams', 'google_meet', 'physical_hall', 'office'
event_addr                        -- Physical address OR meeting URL
event_instructions                -- Access codes, parking info, preparation notes
from_ts, to_ts, timezone          -- Event time slot
event_metadata                    -- Additional context (JSONB)
```

**RBAC Ownership:**
- Event creator automatically receives permission array `[0,1,2,3,4,5]`
  - `[0]` = View
  - `[1]` = Edit
  - `[2]` = Share
  - `[3]` = Delete
  - `[4]` = Create
  - `[5]` = Owner (full control including permission management)
- Ownership tracked in `entity_id_rbac_map` table
- No owner column in `d_event` table - ownership determined by RBAC query

#### 3. **Event RSVP Tracking** (`d_entity_event_person_calendar`)
- **Purpose:** Track WHO is invited to event and their response status
- **RSVP Status:** 'pending', 'accepted', 'declined'
- **Person Types:** employee, client, customer
- **API Endpoint:** `/api/v1/event-person-calendar`

**Fields:**
```sql
id, code, name, descr
event_id                          -- Links to d_event.id
person_entity_type, person_entity_id
event_rsvp_status                 -- 'pending' | 'accepted' | 'declined'
from_ts, to_ts, timezone          -- Time commitment for this person
metadata
```

---

## 4. Data Flow: Creating Event from Calendar

### User Workflow

```
1. USER NAVIGATES TO /calendar
   ↓
2. USER CLICKS ON TIME SLOT (e.g., Monday 2:00 PM)
   ↓
3. EVENT PANE OPENS (modal or sidebar)
   ├─▶ Pre-filled: from_ts = Monday 2:00 PM
   ├─▶ Pre-filled: to_ts = Monday 3:00 PM (default 1 hour)
   └─▶ Pre-filled: timezone = 'America/Toronto'
   ↓
4. USER FILLS EVENT DETAILS
   ├─▶ Event Name: "HVAC Consultation"
   ├─▶ Event Type: Onsite ✓
   ├─▶ Platform: Office
   ├─▶ Address: "123 Main Street, Toronto"
   ├─▶ Instructions: "Ring doorbell at entrance"
   └─▶ Attendees: Add John Smith (employee), Sarah Thompson (customer)
   ↓
5. USER CLICKS "SAVE"
   ↓
6. FRONTEND SENDS: POST /api/v1/event
   Body: {
     code: "EVT-HVAC-001",
     name: "HVAC Consultation",
     event_type: "onsite",
     event_platform_provider_name: "office",
     event_addr: "123 Main Street, Toronto",
     event_instructions: "Ring doorbell at entrance",
     from_ts: "2025-11-10T14:00:00-05:00",
     to_ts: "2025-11-10T15:00:00-05:00",
     timezone: "America/Toronto",
     attendees: [
       {person_entity_type: "employee", person_entity_id: "john-uuid", event_rsvp_status: "pending"},
       {person_entity_type: "customer", person_entity_id: "sarah-uuid", event_rsvp_status: "pending"}
     ]
   }
   ↓
7. BACKEND PROCESSING (apps/api/src/modules/event/routes.ts)
   ├─▶ Step 1: Create event in d_event table
   ├─▶ Step 2: Register in d_entity_instance_id
   ├─▶ Step 3: Grant Owner permissions to creator (empid from JWT)
   │   └─▶ INSERT INTO entity_id_rbac_map (empid, entity, entity_id, permission)
   │       VALUES (creatorEmpId, 'event', newEventId, ARRAY[0,1,2,3,4,5])
   ├─▶ Step 4: Create event-person RSVP entries in d_entity_event_person_calendar
   └─▶ Step 5: (Optional) Create entity linkages in d_entity_id_map
   ↓
8. BACKEND RETURNS: 201 Created
   {
     id: "evt-uuid",
     code: "EVT-HVAC-001",
     name: "HVAC Consultation",
     from_ts: "2025-11-10T14:00:00-05:00",
     to_ts: "2025-11-10T15:00:00-05:00",
     attendees: [
       {id: "epc-uuid-1", person_entity_type: "employee", event_rsvp_status: "pending"},
       {id: "epc-uuid-2", person_entity_type: "customer", event_rsvp_status: "pending"}
     ]
   }
   ↓
9. FRONTEND UPDATES
   ├─▶ Close event pane
   ├─▶ Refetch calendar data
   └─▶ Show event on calendar grid (visual block at Monday 2:00-3:00 PM)
```

---

## 5. Data Flow: Editing Event from Calendar

### User Workflow

```
1. USER CLICKS ON EXISTING EVENT IN CALENDAR
   (e.g., "HVAC Consultation" at Monday 2:00 PM)
   ↓
2. EVENT PANE OPENS WITH EXISTING DATA
   ├─▶ GET /api/v1/event/{eventId}
   ├─▶ Loads event details, attendees, linked entities
   └─▶ Displays all fields pre-populated
   ↓
3. USER EDITS EVENT DETAILS
   ├─▶ Change event type: Onsite → Virtual
   ├─▶ Change platform: Office → Zoom
   ├─▶ Update address: Add Zoom meeting URL
   ├─▶ Update time: 2:00-3:00 PM → 3:00-4:00 PM
   ├─▶ Add/remove attendees
   └─▶ Add entity links (e.g., link to project, service)
   ↓
4. USER CLICKS "SAVE CHANGES"
   ↓
5. FRONTEND SENDS: PATCH /api/v1/event/{eventId}
   Body: {
     event_type: "virtual",
     event_platform_provider_name: "zoom",
     event_addr: "https://zoom.us/j/meeting-123",
     from_ts: "2025-11-10T15:00:00-05:00",
     to_ts: "2025-11-10T16:00:00-05:00"
   }
   ↓
6. BACKEND PROCESSING
   ├─▶ Check RBAC permissions (requires Edit [1] or Owner [5])
   ├─▶ Update d_event table
   └─▶ Return updated event details
   ↓
7. FRONTEND UPDATES
   ├─▶ Close event pane
   ├─▶ Refetch calendar data
   └─▶ Update event display on calendar grid
```

---

## 6. RBAC Ownership Model

### Permission Grant on Event Creation

When an event is created, the API automatically grants full permissions to the creator:

**Code Implementation** (`apps/api/src/modules/event/routes.ts`):
```typescript
// Extract creator's employee ID from JWT token
const creatorEmpId = request.user?.sub;

if (creatorEmpId) {
  // Grant full Owner permissions to event creator
  await client`
    INSERT INTO app.entity_id_rbac_map (
      empid,
      entity,
      entity_id,
      permission,
      granted_by_empid
    ) VALUES (
      ${creatorEmpId}::uuid,
      'event',
      ${newEvent.id},
      ARRAY[0,1,2,3,4,5],  -- Full permissions including Owner
      ${creatorEmpId}::uuid
    )
  `;
}
```

### Permission Array Model

| Position | Permission | Description |
|----------|------------|-------------|
| `[0]` | View | Read access to event data |
| `[1]` | Edit | Modify existing event |
| `[2]` | Share | Share event with others |
| `[3]` | Delete | Soft delete event |
| `[4]` | Create | Create new events (requires entity_id='all') |
| `[5]` | **Owner** | **Full control including permission management** |

### Finding Event Owner

To find who created/owns an event:

```sql
-- Query to find event owner
SELECT empid
FROM app.entity_id_rbac_map
WHERE entity = 'event'
  AND entity_id = :event_id
  AND permission @> ARRAY[5]  -- Check for Owner permission
  AND active_flag = true;
```

**Important Notes:**
- **No owner column** in `d_event` table
- Ownership is **RBAC-based** via `entity_id_rbac_map`
- Same pattern applies to all entities (task, project, calendar, etc.)
- Creator automatically becomes Owner on creation

---

## 7. UI/UX Guidelines

### Calendar View Requirements

1. **Event Pane Visibility**
   - Event pane MUST be visible within calendar view (modal, sidebar, or panel)
   - Do NOT navigate away from calendar when editing event
   - Keep calendar grid visible while event pane is open (if space allows)

2. **Event Creation**
   - Click empty time slot → Open event pane with pre-filled time
   - Quick create: Minimal fields (name, type, platform)
   - Advanced create: All fields (attendees, entity links, instructions)

3. **Event Editing**
   - Click existing event → Open event pane with loaded data
   - In-place editing: No page navigation
   - Real-time updates: Calendar refreshes after save

4. **Visual Indicators**
   - Color-code events by status, type, or owner
   - Show event duration as visual blocks on calendar grid
   - Indicate RSVP status with icons (✓ accepted, ✗ declined, ⏱ pending)

5. **Permission-Based UI**
   - Show "Edit" button only if user has Edit [1] or Owner [5] permission
   - Show "Delete" button only if user has Delete [3] or Owner [5] permission
   - Disable fields if user lacks Edit permission

### Event Pane Components

**Required Sections:**
1. **Basic Info**: Name, description
2. **Type & Platform**: Event type (onsite/virtual), platform dropdown
3. **Location**: Address/URL, instructions
4. **Time Slot**: from_ts, to_ts, timezone
5. **Attendees**: List from `d_entity_event_person_calendar` with RSVP status
6. **Linked Entities**: List from `d_entity_id_map` (services, tasks, projects, etc.)
7. **Actions**: Save, Cancel, Delete

---

## 8. API Endpoints

### Event Entity (`/api/v1/event`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/v1/event` | List all events with filters |
| `GET` | `/api/v1/event/:id` | Get event details with attendees and linked entities |
| `POST` | `/api/v1/event` | Create new event (auto-grants Owner permission to creator) |
| `PATCH` | `/api/v1/event/:id` | Update event details |
| `DELETE` | `/api/v1/event/:id` | Soft delete event and linked data |
| `GET` | `/api/v1/event/:id/attendees` | Get all attendees for event |
| `GET` | `/api/v1/event/:id/entities` | Get all linked entities for event |

### Event-Person RSVP (`/api/v1/event-person-calendar`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/v1/event-person-calendar` | List all event-person mappings |
| `GET` | `/api/v1/event-person-calendar/:id` | Get specific mapping |
| `POST` | `/api/v1/event-person-calendar` | Create new mapping (invite person) |
| `PATCH` | `/api/v1/event-person-calendar/:id` | Update mapping |
| `PATCH` | `/api/v1/event-person-calendar/:id/rsvp` | Update RSVP status only |
| `DELETE` | `/api/v1/event-person-calendar/:id` | Remove person from event |
| `GET` | `/api/v1/person/:personId/events` | Get all events for person |

---

## 9. Implementation Checklist

### Frontend Tasks

- [ ] **Calendar View Component**
  - [ ] Add event pane component (modal/sidebar)
  - [ ] Integrate event API calls (create, read, update, delete)
  - [ ] Handle time slot click → open event pane with pre-filled time
  - [ ] Handle existing event click → load and display event data
  - [ ] Implement permission-based UI (show/hide Edit, Delete based on RBAC)

- [ ] **Event Pane Component**
  - [ ] Event type selector (onsite/virtual)
  - [ ] Platform dropdown (zoom, teams, google_meet, office, etc.)
  - [ ] Address/URL input with dynamic label (Address vs Meeting URL)
  - [ ] Instructions textarea
  - [ ] Time slot pickers (from_ts, to_ts, timezone)
  - [ ] Attendees section (add, remove, view RSVP status)
  - [ ] Linked entities section (add, remove entity links)
  - [ ] Save, Cancel, Delete actions

- [ ] **State Management**
  - [ ] Manage event pane open/close state
  - [ ] Handle optimistic updates on event save
  - [ ] Refetch calendar data after event operations

### Backend Tasks (Completed ✓)

- [x] **Event API Module**
  - [x] POST /api/v1/event - Create event with RBAC ownership grant
  - [x] PATCH /api/v1/event/:id - Update event details
  - [x] DELETE /api/v1/event/:id - Soft delete with cascading cleanup
  - [x] GET /api/v1/event/:id - Fetch event with attendees and entities

- [x] **Event-Person-Calendar API Module**
  - [x] POST /api/v1/event-person-calendar - Invite person to event
  - [x] PATCH /api/v1/event-person-calendar/:id/rsvp - Update RSVP status
  - [x] GET /api/v1/person/:personId/events - Get person's events

- [x] **RBAC Integration**
  - [x] Auto-grant Owner permission [5] to event creator
  - [x] Permission array [0,1,2,3,4,5] in entity_id_rbac_map

### Database Tasks (Completed ✓)

- [x] **Event Table** (`d_event.ddl`)
  - [x] event_type, event_platform_provider_name, event_addr, event_instructions
  - [x] from_ts, to_ts, timezone
  - [x] RBAC-based ownership documentation

- [x] **Event-Person-Calendar Table** (`d_entity_event_person_calendar.ddl`)
  - [x] event_id, person_entity_type, person_entity_id
  - [x] event_rsvp_status (pending/accepted/declined)

- [x] **RBAC Table** (`entity_id_rbac_map.ddl`)
  - [x] Permission [5] = Owner documented

---

## 10. Example Use Case

### Scenario: HVAC Consultation Appointment

**Actors:**
- **Event Creator/Owner:** James Miller (employee, empid: 8260b1b0-...)
- **Customer:** Sarah Thompson (customer)
- **Assigned Technician:** John Smith (employee)

**Workflow:**

1. **James navigates to /calendar**
2. **Clicks Monday 2:00 PM slot**
3. **Event pane opens, James fills:**
   - Name: "HVAC Consultation - Thompson Residence"
   - Type: Onsite
   - Platform: Office
   - Address: "123 Main Street, Toronto, ON M4W 1N4"
   - Instructions: "Ring doorbell at main entrance. Customer has two dogs."
   - Time: 2:00 PM - 4:00 PM
   - Attendees: John Smith (employee), Sarah Thompson (customer)

4. **Clicks "Save"**

5. **Backend creates:**
   - Event in `d_event` (id: evt-001)
   - RBAC entry: James gets [0,1,2,3,4,5] on evt-001
   - Event-person mappings:
     - John Smith → evt-001, status: pending
     - Sarah Thompson → evt-001, status: pending

6. **Calendar updates:**
   - Event appears as visual block Mon 2:00-4:00 PM
   - Shows "HVAC Consultation" with attendee icons

7. **Later, James needs to change time:**
   - Clicks event → Event pane opens
   - Changes time to 3:00-5:00 PM
   - Clicks "Save Changes"
   - PATCH /api/v1/event/evt-001 updates event
   - Calendar refreshes, shows new time

8. **John accepts invitation:**
   - PATCH /api/v1/event-person-calendar/{john-mapping-id}/rsvp
   - Body: { event_rsvp_status: "accepted" }
   - Calendar shows ✓ icon next to John's name

---

## 11. Key Takeaways

### Critical Architecture Principles

1. **Calendar wraps event entity** - Calendar is UI container, event is data entity
2. **No owner column in d_event** - Ownership is RBAC-based via entity_id_rbac_map
3. **Separation of concerns:**
   - `d_entity_person_calendar` = General availability tracking
   - `d_event` = Event details (WHAT, WHEN, WHERE)
   - `d_entity_event_person_calendar` = Event RSVP tracking (WHO)
   - `d_entity_id_map` = Entity linkages (event → service, task, project, etc.)
4. **In-place editing** - Edit events without leaving calendar view
5. **Auto-grant Owner permission** - Creator gets [0,1,2,3,4,5] on event creation
6. **Event as universal parent** - Can link to ANY entity via d_entity_id_map

### Best Practices

- Always check RBAC permissions before showing Edit/Delete UI
- Pre-fill time slot when creating event from calendar
- Show clear visual distinction between availability slots and actual events
- Use optimistic updates for better UX
- Refetch calendar data after event operations to ensure consistency

---

**Last Updated:** 2025-11-10
**Author:** PMO Platform Team
**Related Docs:**
- `/docs/calendar/CALENDAR_SYSTEM.md` - Availability tracking system
- `/db/45_d_event.ddl` - Event entity DDL
- `/db/44_d_entity_event_person_calendar.ddl` - Event RSVP DDL
- `/db/34_d_entity_id_rbac_map.ddl` - RBAC permission system
- `/apps/api/src/modules/event/routes.ts` - Event API implementation
