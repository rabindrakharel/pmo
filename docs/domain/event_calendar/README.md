# Event & Calendar Domain

> **Purpose**: Universal event management system for appointments, meetings, and schedules with action entity linkage, organizer tracking, and RSVP management. Foundation for calendar integration and time-based workflows.

## Domain Overview

The Event & Calendar Domain provides comprehensive event and appointment management across all business processes. Events are action-oriented, linking to specific entities (service appointments, project meetings, task discussions, quote reviews), tracking organizers, managing attendees with RSVP status, and supporting both physical and virtual venues.

### Business Value

- **Action-Oriented Events** linked to specific entities (service, project, task, quote, product)
- **Multi-Venue Support** for physical locations, customer sites, and virtual meetings (Zoom, Teams)
- **RSVP Management** with attendee tracking and status updates
- **Organizer Tracking** to identify who created/scheduled events
- **Calendar Integration** with recurring events and timezone support
- **Appointment Scheduling** for customer service bookings
- **Meeting Coordination** for internal team collaboration

## Entities

| Entity | DDL File | Table | Purpose |
|--------|----------|-------|---------|
| **Event** | XXXIV_d_event.ddl | `d_event` | Universal event entity with action linkage, organizer, venue, and timing details |
| **Event Organizer Link** | XXXIV_d_event_organizer_link.ddl | `d_event_organizer_link` | DEPRECATED: Legacy organizer tracking (now in d_event.organizer_employee_id) |

**Note**: Person-Event linkage uses existing tables from Service Delivery domain:
- `d_entity_person_calendar`: Person calendar availability (from Service Delivery)
- `d_entity_event_person_calendar`: Event-person attendee linkage with RSVP (from Service Delivery)

## Entity Relationships

```
┌────────────────────────────────────────────────────────────────────────┐
│                 EVENT & CALENDAR DOMAIN                               │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌───────────────────────┐                                            │
│  │       Event           │ (Action-Oriented Events)                    │
│  │     (d_event)         │                                             │
│  │                       │                                             │
│  │ Core Fields:          │                                             │
│  │ • from_ts, to_ts      │ WHEN                                        │
│  │ • event_addr          │ WHERE                                       │
│  │ • venue_type          │ LOCATION TYPE                               │
│  │ • event_platform      │ PLATFORM (Zoom, Teams)                      │
│  │ • organizer_emp_id    │ WHO organized                               │
│  │                       │                                             │
│  │ Action Entity:        │ WHAT                                        │
│  │ • event_action_entity_code                                         │
│  │ • event_action_entity_id                                           │
│  │                       │                                             │
│  │ Examples:             │                                             │
│  │ • Service Appointment │                                             │
│  │   action_entity = 'service'                                        │
│  │ • Project Meeting     │                                             │
│  │   action_entity = 'project'                                        │
│  │ • Task Discussion     │                                             │
│  │   action_entity = 'task'                                           │
│  │ • Quote Review        │                                             │
│  │   action_entity = 'quote'                                          │
│  └───────────────────────┘                                             │
│           │                                                            │
│           │ links to (action entity)                                   │
│           │                                                            │
│  ┌────────┼──────────────────────────────────────────────────┐        │
│  │        │                                                   │        │
│  │        ▼                   ▼                   ▼           ▼        │
│  │  ┌──────────┐      ┌──────────┐      ┌──────────┐   ┌────────┐   │
│  │  │ Service  │      │ Project  │      │   Task   │   │ Quote  │   │
│  │  │          │      │          │      │          │   │        │   │
│  │  │ Service  │      │Operations│      │Operations│   │Order & │   │
│  │  │ Delivery │      │ Domain   │      │ Domain   │   │Fulfill │   │
│  │  └──────────┘      └──────────┘      └──────────┘   └────────┘   │
│  │                                                                    │
│  └────────────────────────────────────────────────────────────────────┘
│                                                                        │
│           │ organized by                                               │
│           ▼                                                            │
│  ┌───────────────────────┐                                            │
│  │     Employee          │                                             │
│  │   (d_employee)        │                                             │
│  │                       │                                             │
│  │ from Customer 360     │                                             │
│  │ Domain                │                                             │
│  │                       │                                             │
│  │ • event creator       │                                             │
│  │ • scheduler           │                                             │
│  └───────────────────────┘                                             │
│           ▲                                                            │
│           │                                                            │
│           │ has attendees                                              │
│           │                                                            │
│  ┌───────────────────────┐                                            │
│  │ Event Person Calendar │ (Attendee Linkage)                          │
│  │ (d_entity_event_      │                                             │
│  │  person_calendar)     │                                             │
│  │                       │                                             │
│  │ from Service Delivery │                                             │
│  │ Domain                │                                             │
│  │                       │                                             │
│  │ • event_id            │                                             │
│  │ • person_entity_code  │ ('employee', 'cust')                        │
│  │ • person_entity_id    │                                             │
│  │ • event_rsvp_status   │ ('accepted', 'declined', 'tentative')       │
│  │ • reminder_sent_flag  │                                             │
│  └───────────────────────┘                                             │
│           │                                                            │
│           │ links to                                                   │
│           ▼                                                            │
│  ┌───────────────────────┐                                            │
│  │ Person Calendar       │ (Availability)                              │
│  │ (d_entity_person_     │                                             │
│  │  calendar)            │                                             │
│  │                       │                                             │
│  │ from Service Delivery │                                             │
│  │ Domain                │                                             │
│  │                       │                                             │
│  │ • person_entity_code  │                                             │
│  │ • person_entity_id    │                                             │
│  │ • available_from_ts   │                                             │
│  │ • available_to_ts     │                                             │
│  │ • availability_type   │ ('available', 'busy', 'out_of_office')      │
│  └───────────────────────┘                                             │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                 Venue Type Classification                      │   │
│  │                                                                 │   │
│  │  • office: Company office location                             │   │
│  │  • customer_site: On-site at customer location                 │   │
│  │  • warehouse: Warehouse or yard                                │   │
│  │  • remote: Remote/virtual (Zoom, Teams, etc.)                  │   │
│  │  • external: External venue (restaurant, conference center)    │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Relationship Rules

1. **Event → Action Entity**: One-to-one
   - Each event links to ONE primary action entity
   - Action entity defines WHAT the event is about
   - Types: service, project, task, quote, product, etc.

2. **Event → Organizer**: Many-to-one
   - Each event has ONE organizer (employee who created it)
   - Organizer tracked via `organizer_employee_id`
   - System-generated events can have NULL organizer

3. **Event → Attendees**: One-to-many
   - Each event can have multiple attendees
   - Attendees linked via `d_entity_event_person_calendar`
   - Attendees can be employees, customers, or clients
   - Each attendee has RSVP status

4. **Person → Calendar**: One-to-many
   - Each person (employee/customer) has availability calendar
   - Calendar entries define busy/available time blocks
   - Used for scheduling conflict detection

5. **Event → Venue**: One-to-one
   - Each event has one venue type and address
   - Physical venues: office, customer_site, warehouse
   - Virtual venues: remote (with platform provider)

## Business Semantics

### Event Types

Events are categorized by their action entity type:

**Service Appointment** (`event_action_entity_code = 'service'`):
- Customer self-schedules HVAC consultation
- Technician assigned via organizer_employee_id
- Customer location in event_addr
- Example: "HVAC Maintenance - 123 Main St"

**Project Meeting** (`event_action_entity_code = 'project'`):
- Project manager schedules milestone review
- Team members invited as attendees
- Office or remote venue
- Example: "Project Kickoff - HVAC Installation Store #45"

**Task Discussion** (`event_action_entity_code = 'task'`):
- Team lead schedules task planning session
- Assigned employees attend
- Quick sync or detailed planning
- Example: "Task Planning - Equipment Procurement"

**Quote Review** (`event_action_entity_code = 'quote'`):
- Sales rep schedules quote walkthrough with customer
- Customer and approvers attend
- Virtual or on-site
- Example: "Quote Review - $12,500 HVAC Project"

**Product Demo** (`event_action_entity_code = 'product'`):
- Sales schedules product demonstration
- Potential customers attend
- Showroom or virtual
- Example: "Product Demo - Smart Thermostat Line"

### Venue Types

**venue_type** classifies event locations:

- **office**: Company office or branch
  - event_addr: Office address from d_office
  - Example: "Toronto HQ - 123 Business Blvd"

- **customer_site**: On-site at customer location
  - event_addr: Customer worksite address
  - Example: "Customer Site - 456 Residential St"

- **warehouse**: Warehouse or storage yard
  - event_addr: Warehouse location
  - Example: "Central Warehouse - 789 Industrial Rd"

- **remote**: Virtual meeting (Zoom, Teams, Google Meet)
  - event_addr: Meeting URL
  - event_platform_provider_name: 'Zoom', 'Microsoft Teams', 'Google Meet'
  - Example: "https://zoom.us/j/123456789"

- **external**: External venue (restaurant, conference center)
  - event_addr: External venue address
  - Example: "Conference Center - 321 Convention Ave"

### RSVP Statuses

Attendee responses tracked via `event_rsvp_status`:

- **accepted**: Attendee confirmed attendance
- **declined**: Attendee cannot attend
- **tentative**: Attendee may attend (unsure)
- **pending**: No response yet (default)

**RSVP Workflow**:
1. Event created, attendees invited (status: pending)
2. Attendees receive notification/email
3. Attendees respond: Accept, Decline, or Tentative
4. Organizer sees RSVP summary
5. Reminders sent to pending attendees

### Calendar Availability

**availability_type** in `d_entity_person_calendar`:

- **available**: Person is free during this time
- **busy**: Person has conflicting event
- **out_of_office**: Person is on vacation, sick leave, etc.
- **tentative**: Tentative booking (not confirmed)

**Conflict Detection**:
```
When scheduling new event:
1. Check organizer calendar: Is organizer available?
2. Check attendee calendars: Are attendees available?
3. If conflicts detected, show warning
4. Organizer can override or reschedule
```

### Recurring Events

Events support recurrence via metadata:

```json
{
  "recurrence": {
    "type": "weekly",
    "interval": 1,
    "days_of_week": ["Monday", "Wednesday"],
    "end_date": "2025-12-31",
    "occurrences": 24
  }
}
```

**Recurrence Types**:
- **daily**: Repeats every N days
- **weekly**: Repeats on specific days of week
- **monthly**: Repeats on specific day of month
- **yearly**: Repeats annually
- **custom**: Custom pattern defined in metadata

**Handling**:
- Master event created with recurrence metadata
- Individual occurrences generated on demand
- Modifications create exception instances

## Data Patterns

### Event Creation Flow

```
1. User schedules event (e.g., Service Appointment)
2. System creates Event:
   - from_ts = "2025-01-15 14:00:00"
   - to_ts = "2025-01-15 15:00:00"
   - timezone = "America/Toronto"
   - event_action_entity_code = "service"
   - event_action_entity_id = <service_uuid>
   - organizer_employee_id = <technician_uuid>
   - venue_type = "customer_site"
   - event_addr = "123 Main St, London, ON"
3. System creates attendee links:
   - INSERT INTO d_entity_event_person_calendar
     (event_id, person_entity_code, person_entity_id, event_rsvp_status)
     VALUES (<event_id>, 'employee', <tech_uuid>, 'accepted');
   - INSERT INTO d_entity_event_person_calendar
     VALUES (<event_id>, 'cust', <customer_uuid>, 'pending');
4. System updates calendars:
   - INSERT INTO d_entity_person_calendar
     (person_entity_id, available_from_ts, available_to_ts, availability_type)
     VALUES (<tech_uuid>, '2025-01-15 14:00:00', '2025-01-15 15:00:00', 'busy');
5. System sends notifications:
   - Email to customer: "Appointment Scheduled"
   - Calendar invite (ICS file)
   - SMS reminder 1 day before
```

### Calendar Conflict Check

```sql
-- Check if person has conflict for proposed event time
SELECT COUNT(*) AS conflicts
FROM d_entity_event_person_calendar epc
JOIN d_event e ON e.id = epc.event_id
WHERE epc.person_entity_id = $person_id
  AND epc.person_entity_code = $person_type
  AND e.active_flag = true
  AND (
    -- Proposed event overlaps existing event
    (e.from_ts < $proposed_to_ts AND e.to_ts > $proposed_from_ts)
  )
  AND epc.event_rsvp_status != 'declined';  -- Ignore declined events

-- If conflicts > 0, person is busy
```

### Event Query Patterns

```sql
-- Find all events for a service (appointments)
SELECT e.*
FROM d_event e
WHERE e.event_action_entity_code = 'service'
  AND e.event_action_entity_id = $service_id
  AND e.active_flag = true
ORDER BY e.from_ts;

-- Find all events organized by an employee
SELECT e.*
FROM d_event e
WHERE e.organizer_employee_id = $employee_id
  AND e.active_flag = true
ORDER BY e.from_ts DESC;

-- Find all events a person is attending
SELECT e.*, epc.event_rsvp_status
FROM d_event e
JOIN d_entity_event_person_calendar epc ON epc.event_id = e.id
WHERE epc.person_entity_id = $person_id
  AND epc.person_entity_code = 'employee'
  AND e.active_flag = true
ORDER BY e.from_ts;

-- Find upcoming events for today
SELECT e.*
FROM d_event e
WHERE e.from_ts::date = CURRENT_DATE
  AND e.active_flag = true
ORDER BY e.from_ts;
```

## Use Cases

### UC-1: Customer Self-Schedules Service Appointment

**Actors**: Customer, System, Technician

**Flow**:
1. Customer visits website, clicks "Schedule Appointment"
2. Customer selects service: "HVAC Maintenance"
3. System shows available technician time slots
4. System queries technician calendars for availability
5. Customer selects: "Jan 15, 2025 @ 2:00 PM"
6. System creates Event:
   - event_action_entity_code: "service"
   - event_action_entity_id: <HVAC service UUID>
   - from_ts: "2025-01-15 14:00:00"
   - to_ts: "2025-01-15 15:00:00"
   - timezone: "America/Toronto"
   - organizer_employee_id: <assigned technician UUID>
   - venue_type: "customer_site"
   - event_addr: "123 Main St, London, ON"
7. System creates attendee links:
   - Technician: RSVP = 'accepted' (auto-accepted)
   - Customer: RSVP = 'pending'
8. System updates technician calendar: 2-3 PM = 'busy'
9. System sends notifications:
   - Email to customer: "Appointment Confirmed"
   - Calendar invite (ICS)
   - SMS to technician: "New appointment assigned"
10. Day before appointment, system sends reminder SMS to customer
11. Technician arrives on-site, completes service
12. Event status updated to "completed"

**Entities Touched**: Event, Service, Employee (technician), Customer, Person Calendar, Event Person Calendar

### UC-2: Project Manager Schedules Team Meeting

**Actors**: Project Manager, Team Members, System

**Flow**:
1. PM views Project #450 detail page
2. PM clicks "Schedule Meeting"
3. PM fills meeting form:
   - Title: "Project Kickoff - HVAC Installation"
   - Date: Jan 12, 2025
   - Time: 10:00 AM - 11:00 AM
   - Venue: Remote (Zoom)
   - Attendees: 5 team members selected
4. System checks attendee availability:
   - 4 available, 1 has conflict (shows warning)
5. PM proceeds anyway
6. System creates Event:
   - event_action_entity_code: "project"
   - event_action_entity_id: <Project #450 UUID>
   - from_ts: "2025-01-12 10:00:00"
   - to_ts: "2025-01-12 11:00:00"
   - organizer_employee_id: <PM UUID>
   - venue_type: "remote"
   - event_platform_provider_name: "Zoom"
   - event_addr: "https://zoom.us/j/123456789"
7. System creates attendee links (5 team members)
   - All RSVP status: 'pending'
8. System sends meeting invites (email + calendar)
9. Team members respond:
   - 3 accept
   - 1 declines (has conflict)
   - 1 tentative
10. PM sees RSVP summary: 3 accepted, 1 declined, 1 tentative
11. PM reschedules conflicting member or proceeds
12. Meeting day: System sends reminder 30 min before
13. Meeting occurs via Zoom
14. PM marks event as "completed" with meeting notes

**Entities Touched**: Event, Project, Employee (PM + 5 members), Event Person Calendar, Person Calendar

### UC-3: Sales Rep Schedules Quote Review with Customer

**Actors**: Sales Rep, Customer, System

**Flow**:
1. Sales Rep creates Quote for customer
2. Quote amount: $12,500
3. Sales Rep clicks "Schedule Review Meeting"
4. System pre-fills customer info from Quote
5. Sales Rep sets meeting details:
   - Date: Jan 18, 2025
   - Time: 3:00 PM - 4:00 PM
   - Venue: Virtual (Microsoft Teams)
6. System creates Event:
   - event_action_entity_code: "quote"
   - event_action_entity_id: <Quote UUID>
   - from_ts: "2025-01-18 15:00:00"
   - to_ts: "2025-01-18 16:00:00"
   - organizer_employee_id: <Sales Rep UUID>
   - venue_type: "remote"
   - event_platform_provider_name: "Microsoft Teams"
   - event_addr: "https://teams.microsoft.com/l/meetup-join/..."
7. System creates attendees:
   - Sales Rep: RSVP = 'accepted'
   - Customer: RSVP = 'pending'
8. System sends invite to customer email
9. Customer accepts: RSVP status = 'accepted'
10. Meeting occurs, Sales Rep presents Quote details
11. Customer accepts Quote during meeting
12. Quote status → "Accepted"
13. Event marked "completed"
14. Order auto-created from accepted Quote

**Entities Touched**: Event, Quote, Employee (Sales Rep), Customer, Event Person Calendar

## Technical Architecture

### Key Tables

```sql
-- Event
CREATE TABLE app.d_event (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name text NOT NULL,
    descr text,

    -- Timing
    from_ts timestamptz NOT NULL,
    to_ts timestamptz NOT NULL,
    timezone varchar(50) DEFAULT 'America/Toronto',

    -- Action Entity (WHAT)
    event_action_entity_code text,                  -- 'service', 'project', 'task', 'quote'
    event_action_entity_id uuid,                    -- UUID of action entity

    -- Organizer (WHO)
    organizer_employee_id uuid,                     -- Employee who created/scheduled

    -- Venue (WHERE)
    venue_type text,                                -- 'office', 'customer_site', 'remote'
    event_addr text,                                -- Address or virtual URL
    event_platform_provider_name text,              -- 'Zoom', 'Microsoft Teams', etc.

    -- Metadata
    metadata jsonb DEFAULT '{}'::jsonb,             -- Recurrence, custom fields
    event_status text DEFAULT 'scheduled',          -- 'scheduled', 'completed', 'cancelled'

    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);

-- Event Person Calendar (Attendees)
-- NOTE: This table is in Service Delivery domain but used here
CREATE TABLE app.d_entity_event_person_calendar (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL,                         -- FK to d_event
    person_entity_code text NOT NULL,               -- 'employee', 'cust', 'client'
    person_entity_id uuid NOT NULL,                 -- UUID of person
    event_rsvp_status text DEFAULT 'pending',       -- 'accepted', 'declined', 'tentative', 'pending'
    reminder_sent_flag boolean DEFAULT false,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

-- Person Calendar (Availability)
-- NOTE: This table is in Service Delivery domain but used here
CREATE TABLE app.d_entity_person_calendar (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_entity_code text NOT NULL,
    person_entity_id uuid NOT NULL,
    available_from_ts timestamptz NOT NULL,
    available_to_ts timestamptz NOT NULL,
    availability_type text DEFAULT 'available',     -- 'available', 'busy', 'out_of_office', 'tentative'
    notes text,
    created_ts timestamptz DEFAULT now()
);
```

### API Endpoints

```
# Event Management
GET    /api/v1/event                     # List events
GET    /api/v1/event/:id                 # Get event detail
POST   /api/v1/event                     # Create event
PUT    /api/v1/event/:id                 # Update event
DELETE /api/v1/event/:id                 # Cancel event (soft delete)

# Event Attendees
POST   /api/v1/event/:id/attendee        # Add attendee
PUT    /api/v1/event/:id/attendee/:aid   # Update RSVP status
DELETE /api/v1/event/:id/attendee/:aid   # Remove attendee

# Calendar
GET    /api/v1/calendar/person/:id       # Get person's calendar
GET    /api/v1/calendar/availability     # Check availability
POST   /api/v1/calendar/block            # Block time (set busy)

# Queries
GET    /api/v1/event/upcoming            # Upcoming events (next 7 days)
GET    /api/v1/event/today               # Today's events
GET    /api/v1/event/by-entity/:type/:id # Events for entity (service, project)
GET    /api/v1/event/organizer/:id       # Events organized by employee
GET    /api/v1/event/attendee/:id        # Events person is attending
```

## Integration Points

### Upstream Dependencies

- **Customer 360 Domain**: Employee (organizer), Customer (attendees)
- **Operations Domain**: Project, Task (action entities)
- **Order & Fulfillment Domain**: Quote (action entities)
- **Service Delivery Domain**: Service (action entities), Person Calendar
- **Product & Inventory Domain**: Product (action entities for demos)

### Downstream Dependencies

- **Communication & Interaction Domain**: Event notifications, reminders (SMS/email)

## Data Volume & Performance

### Expected Data Volumes

- Events: 50,000 - 500,000 per year
- Event Attendees: 200,000 - 2,000,000 linkages per year
- Calendar Entries: 100,000 - 1,000,000 availability blocks

### Indexing Strategy

```sql
-- Event indexes
CREATE INDEX idx_event_from_ts ON app.d_event(from_ts);
CREATE INDEX idx_event_action_entity ON app.d_event(event_action_entity_code, event_action_entity_id);
CREATE INDEX idx_event_organizer ON app.d_event(organizer_employee_id);
CREATE INDEX idx_event_venue ON app.d_event(venue_type);

-- Event Person Calendar indexes
CREATE INDEX idx_event_person_event ON app.d_entity_event_person_calendar(event_id);
CREATE INDEX idx_event_person_person ON app.d_entity_event_person_calendar(person_entity_code, person_entity_id);
CREATE INDEX idx_event_person_rsvp ON app.d_entity_event_person_calendar(event_rsvp_status);

-- Person Calendar indexes
CREATE INDEX idx_person_cal_person ON app.d_entity_person_calendar(person_entity_code, person_entity_id);
CREATE INDEX idx_person_cal_time ON app.d_entity_person_calendar(available_from_ts, available_to_ts);
```

## Future Enhancements

1. **Calendar Sync**: Two-way sync with Google Calendar, Outlook, Apple Calendar
2. **Smart Scheduling**: AI-suggested meeting times based on attendee availability
3. **Recurring Events**: Full recurrence support with exceptions
4. **Waiting Lists**: Waitlist management for fully booked time slots
5. **Video Integration**: Direct Zoom/Teams integration for instant meetings
6. **Resource Booking**: Book conference rooms, equipment with calendars
7. **Time Zone Intelligence**: Auto-detect and convert time zones
8. **Travel Time**: Auto-block travel time before/after on-site events
9. **Automated Reminders**: Configurable reminder cadence (1 week, 1 day, 1 hour)
10. **Analytics**: Event completion rates, no-show tracking, utilization reports

---

**Domain Owner**: Service Delivery & Operations Teams
**Last Updated**: 2025-11-13
**Related Domains**: Customer 360, Operations, Service Delivery, Order & Fulfillment, Communication & Interaction
