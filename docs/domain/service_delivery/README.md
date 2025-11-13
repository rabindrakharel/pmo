# Service Delivery Domain

> **Purpose**: Field services, installation, repair, and on-site work management. Handles service catalog, worksite scheduling, resource calendars, and booking confirmation.

## Domain Overview

Service Delivery manages the **field service execution** layer, bridging operational planning (Operations domain) with actual customer-facing service delivery. It maintains the service catalog, person availability calendars, and event-person booking confirmations for scheduling and dispatch.

### Business Value

- **Service Catalog Management** with SKUs, pricing, and SLAs
- **Resource Scheduling** via person calendars (availability slots)
- **Booking Confirmation** tracking (RSVP/attendance)
- **Capacity Planning** based on available time slots
- **Mobile Workforce** support for field technicians

## Entities

| Entity | DDL File | Table | Purpose |
|--------|----------|-------|---------|
| **Service** | X_d_service.ddl | `d_service` | Service catalog with pricing, duration, and requirements |
| **Person Calendar** | XXXV_d_entity_person_calendar.ddl | `d_entity_person_calendar` | Availability slots for employees/resources |
| **Event-Person Calendar** | XXXVI_d_entity_event_person_calendar.ddl | `d_entity_event_person_calendar` | Booking confirmations and RSVP tracking |

## Entity Relationships

```
┌──────────────────────────────────────────────────────────────┐
│              SERVICE DELIVERY DOMAIN                          │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─────────────────┐                                          │
│  │    Service      │                                          │
│  │  (d_service)    │                                          │
│  │                 │                                          │
│  │ • name          │──┐                                       │
│  │ • sku           │  │ used in                               │
│  │ • price_amt     │  │                                       │
│  │ • duration_min  │  │                                       │
│  │ • sla_hours     │  │                                       │
│  └─────────────────┘  │                                       │
│                       │                                       │
│                       ▼                                       │
│  ┌─────────────────┐                 ┌──────────────────┐   │
│  │   Work Order    │ (Operations)    │     Event       │   │
│  │(fact_work_order)│                 │   (d_event)     │   │
│  │                 │                 │                  │   │
│  │ • service_id    │                 │ Event & Calendar │   │
│  │ • technician_id │──────┐          └──────────────────┘   │
│  └─────────────────┘      │               │                  │
│                           │               │ who              │
│                           │ who           ▼                  │
│                           │          ┌──────────────────┐   │
│                           │          │Event-Person Cal  │   │
│                           │          │(d_entity_event_  │   │
│                           │          │ person_calendar) │   │
│                           │          │                  │   │
│                           │          │ • event_id       │   │
│                           │          │ • person_id      │   │
│                           │          │ • rsvp_status    │   │
│                           │          │ • attended       │   │
│                           │          └──────────────────┘   │
│                           │               ▲                  │
│                           │               │ references       │
│                           │               │                  │
│                           │          ┌──────────────────┐   │
│                           └─────────►│ Person Calendar  │   │
│                                      │(d_entity_person_ │   │
│                                      │   calendar)      │   │
│                                      │                  │   │
│                                      │ • person_id      │   │
│                                      │ • slot_start_ts  │   │
│                                      │ • slot_end_ts    │   │
│                                      │ • is_available   │   │
│                                      └──────────────────┘   │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Relationship Rules

1. **Service → Work Order**: One-to-many (services can be booked many times)
2. **Person Calendar → Employee**: Many-to-one (each employee has many time slots)
3. **Event → Event-Person Calendar**: One-to-many (each event has attendees)
4. **Person Calendar → Event-Person Calendar**: Booking consumes available slots

## Business Semantics

### Service Catalog Structure

```
Service Categories
  ├─ HVAC
  │   ├─ Installation
  │   ├─ Repair
  │   └─ Maintenance
  ├─ Plumbing
  │   ├─ Emergency
  │   └─ Scheduled
  └─ Electrical
```

Each service has:
- **SKU**: Unique service identifier
- **Base Price**: Default pricing (can override per customer)
- **Duration**: Expected time to complete
- **SLA**: Service Level Agreement (e.g., respond within 4 hours)
- **Required Skills**: Employee must have certifications

### Person Calendar Availability

Employee calendars track **availability slots**:

```
Monday, Nov 13, 2025
  08:00 - 12:00  Available (4 hours)
  12:00 - 13:00  Lunch Break (unavailable)
  13:00 - 17:00  Booked (Event ID 567)
  17:00 - 18:00  Available (1 hour)
```

Slots are:
- **Granular**: 15-minute increments
- **Recurring**: Can repeat daily/weekly
- **Override-able**: Vacations, sick days

### RSVP & Attendance Tracking

Event-Person Calendar tracks:
- **RSVP Status**: Pending, Accepted, Declined, Tentative
- **Attendance**: Did person actually show up?
- **Check-in Time**: When they arrived
- **Check-out Time**: When they left

Use cases:
- Training sessions (track attendance)
- Customer meetings (confirm availability)
- Field service calls (dispatch confirmation)

## Data Patterns

### Service Pricing Matrix

Services can have **dynamic pricing**:

```sql
-- Base price in d_service
price_amt: $150

-- Customer-specific override (stored in JSONB)
pricing_overrides: {
  "customer_12345": {"price": 120, "reason": "Volume discount"},
  "customer_67890": {"price": 180, "reason": "After-hours premium"}
}
```

### Calendar Slot Booking Algorithm

**Check Availability**:
```sql
SELECT * FROM d_entity_person_calendar
WHERE person_id = 42
  AND is_available = true
  AND slot_start_ts >= '2025-11-13 08:00'
  AND slot_end_ts <= '2025-11-13 17:00'
  AND NOT EXISTS (
    SELECT 1 FROM d_entity_event_person_calendar
    WHERE person_id = 42
      AND event_id IS NOT NULL
      AND rsvp_status IN ('Accepted', 'Tentative')
  );
```

**Book Slot**:
```sql
INSERT INTO d_entity_event_person_calendar (
  event_id, person_id, rsvp_status, attended
) VALUES (
  567, 42, 'Accepted', false
);
```

## Use Cases

### UC-1: Customer Requests Service

**Actors**: Customer, Dispatcher, Technician

**Flow**:
1. Customer calls: "Need HVAC repair"
2. Dispatcher queries Service catalog: "HVAC Repair"
3. Service SKU = "HVAC-REPAIR-001", Duration = 2 hours
4. Check Technician availability (Person Calendar)
5. Find slot: Nov 13, 14:00 - 16:00
6. Create Event (Event & Calendar domain)
7. Link Event → Event-Person Calendar (RSVP = Accepted)
8. Create Work Order (Operations domain)
9. Technician receives notification
10. Service delivered, WO marked complete

**Entities**: Service, Person Calendar, Event-Person Calendar, Work Order

### UC-2: Training Session Scheduling

**Actors**: HR Manager, Employees

**Flow**:
1. HR creates Event: "Safety Training"
2. Invite 20 employees
3. Create Event-Person Calendar for each (RSVP = Pending)
4. Employees accept/decline via portal
5. On training day, instructor marks attendance
6. RSVP statuses: 18 Accepted, 2 Declined
7. Attendance: 16 attended, 2 no-shows

**Entities**: Event (Event & Calendar), Event-Person Calendar

### UC-3: Recurring Availability Slots

**Actors**: Employee, System

**Flow**:
1. Employee sets recurring availability:
   - Mon-Fri, 08:00 - 17:00
   - Lunch break: 12:00 - 13:00
2. System creates 260 records (52 weeks × 5 days)
3. Employee requests vacation: Dec 20-30
4. System marks those slots `is_available = false`
5. Dispatcher only sees available slots when booking

**Entities**: Person Calendar

## Technical Architecture

### Key Tables

```sql
-- Service (d_service)
CREATE TABLE app.d_service (
    service_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    price_amt NUMERIC(10,2),
    duration_minutes INT4,
    sla_hours INT4,
    required_skills TEXT[], -- array of skill codes
    is_active BOOLEAN DEFAULT true,
    created_ts TIMESTAMPTZ DEFAULT now()
);

-- Person Calendar (d_entity_person_calendar)
CREATE TABLE app.d_entity_person_calendar (
    calendar_id SERIAL PRIMARY KEY,
    person_id INT4 NOT NULL, -- employee_id
    slot_start_ts TIMESTAMPTZ NOT NULL,
    slot_end_ts TIMESTAMPTZ NOT NULL,
    is_available BOOLEAN DEFAULT true,
    recurrence_rule TEXT, -- iCal RRULE format
    notes TEXT,
    created_ts TIMESTAMPTZ DEFAULT now()
);

-- Event-Person Calendar (d_entity_event_person_calendar)
CREATE TABLE app.d_entity_event_person_calendar (
    event_person_id SERIAL PRIMARY KEY,
    event_id INT4 NOT NULL,
    person_id INT4 NOT NULL,
    rsvp_status VARCHAR(50), -- Pending, Accepted, Declined, Tentative
    attended BOOLEAN,
    check_in_ts TIMESTAMPTZ,
    check_out_ts TIMESTAMPTZ,
    notes TEXT,
    created_ts TIMESTAMPTZ DEFAULT now()
);
```

### API Endpoints

```
# Services
GET    /api/v1/service              # List services
GET    /api/v1/service/:id          # Get service details
POST   /api/v1/service              # Create service
PATCH  /api/v1/service/:id          # Update service
DELETE /api/v1/service/:id          # Deactivate service

# Person Calendar
GET    /api/v1/calendar             # List person calendars
GET    /api/v1/calendar/availability/:person_id?start=2025-11-13&end=2025-11-20
POST   /api/v1/calendar             # Create calendar slot
DELETE /api/v1/calendar/:id         # Remove slot

# Event-Person Calendar
GET    /api/v1/event/:event_id/attendees  # Get all attendees
POST   /api/v1/event/:event_id/rsvp       # RSVP to event
PATCH  /api/v1/event/:event_id/attendance # Mark attendance
```

## Integration Points

### Upstream Dependencies

- **Customer 360**: Services delivered to Customers, Employees as resources
- **Operations**: Work Orders execute Service SKUs

### Downstream Dependencies

- **Event & Calendar**: Events schedule service delivery
- **Financial Management**: Service pricing drives Revenue
- **Communication & Interaction**: Send booking confirmations

## Data Volume & Performance

### Expected Volumes

- Services: 50 - 500 service SKUs
- Person Calendar slots: 500,000 - 5,000,000 slots
- Event-Person Calendar: 100,000 - 1,000,000 bookings/year

### Indexing

```sql
CREATE INDEX idx_service_sku ON app.d_service(sku);
CREATE INDEX idx_calendar_person ON app.d_entity_person_calendar(person_id, slot_start_ts, slot_end_ts);
CREATE INDEX idx_event_person ON app.d_entity_event_person_calendar(event_id, person_id);
```

## Future Enhancements

1. **AI-Powered Scheduling**: Auto-suggest optimal time slots
2. **Mobile Check-in**: QR code-based attendance
3. **Skill-Based Routing**: Auto-assign based on certifications
4. **SLA Monitoring**: Alert on SLA breaches
5. **Calendar Sync**: Integrate with Google/Outlook calendars

---

**Domain Owner**: Service Operations Team
**Last Updated**: 2025-11-13
**Related Domains**: Operations, Event & Calendar, Customer 360
