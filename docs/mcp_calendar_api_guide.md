# Person Calendar API - MCP Tool Reference

> **Complete guide to using the Person Calendar API via MCP (Model Context Protocol)**

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [MCP Tools](#mcp-tools)
- [API Endpoints](#api-endpoints)
- [Usage Examples](#usage-examples)
- [Common Patterns](#common-patterns)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

---

## Overview

The **Person Calendar API** manages calendar slots and bookings for employees and customers in the PMO platform. It supports:

- ✅ **Availability Management** - Create and manage time slots
- ✅ **Booking System** - Book appointments and mark slots as unavailable
- ✅ **Multi-Person Support** - Handle employee and customer calendars
- ✅ **Filtering** - Filter by person, date range, availability status
- ✅ **Metadata** - Store additional booking information (attendees, location, etc.)

### Key Concepts

1. **Calendar Slot** = A time period for a specific person
2. **Availability Flag** = `true` (available) or `false` (booked)
3. **Person Entity** = Employee or Customer the slot belongs to
4. **Booking** = Converting an available slot to booked status

---

## Architecture

### Database Schema

```sql
CREATE TABLE app.d_entity_person_calendar (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    code varchar(50) NOT NULL,
    name varchar(255) NOT NULL,
    descr text,

    -- Person Identification
    person_entity_type varchar(50) NOT NULL,  -- 'employee' | 'customer'
    person_entity_id uuid NOT NULL,

    -- Time Slot
    from_ts timestamptz NOT NULL,
    to_ts timestamptz NOT NULL,
    timezone varchar(50) DEFAULT 'America/Toronto',

    -- Availability
    availability_flag boolean DEFAULT true,

    -- Booking Details (populated when booked)
    title varchar(255),
    appointment_medium varchar(50),  -- 'onsite' | 'virtual'
    appointment_addr text,
    instructions text,
    event_id uuid,

    -- Metadata
    metadata jsonb DEFAULT '{}'::jsonb,

    -- Notification Tracking
    reminder_sent_flag boolean DEFAULT false,
    reminder_sent_ts timestamptz,
    confirmation_sent_flag boolean DEFAULT false,
    confirmation_sent_ts timestamptz,

    -- System Fields
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version int4 DEFAULT 1
);
```

### Data Model

```typescript
interface PersonCalendar {
  id: string;
  code: string;
  name: string;
  descr?: string;

  // Person
  person_entity_type: 'employee' | 'client' | 'customer';
  person_entity_id: string;

  // Time
  from_ts: string;  // ISO 8601 timestamp
  to_ts: string;
  timezone: string;

  // Availability
  availability_flag: boolean;

  // Booking (when booked)
  title?: string;
  appointment_medium?: 'onsite' | 'virtual';
  appointment_addr?: string;
  instructions?: string;
  event_id?: string;

  // Metadata
  metadata?: {
    employee_ids?: string[];   // Assigned employees
    attendee_ids?: string[];    // Other attendees
    // ... any custom fields
  };

  // System
  active_flag: boolean;
  created_ts: string;
  updated_ts: string;
  version: number;
}
```

---

## MCP Tools

All calendar endpoints are exposed as MCP tools through the PMO MCP Server.

### Tool Naming Convention

All calendar tools follow the pattern: `person_calendar_<action>`

### Available Tools

| Tool Name | Method | Description |
|-----------|--------|-------------|
| `person_calendar_list` | GET | List all calendar slots with filtering |
| `person_calendar_get` | GET | Get single slot by ID |
| `person_calendar_get_available` | GET | Get only available slots |
| `person_calendar_get_booked` | GET | Get only booked slots |
| `person_calendar_create` | POST | Create new calendar slot |
| `person_calendar_update` | PATCH | Update slot details |
| `person_calendar_book` | POST | Book a time slot |
| `person_calendar_delete` | DELETE | Soft delete a slot |

---

## API Endpoints

### 1. List All Calendar Slots

**MCP Tool:** `person_calendar_list`

```typescript
// GET /api/v1/person-calendar
{
  availability_flag?: 'true' | 'false',  // Filter by availability
  page?: number,                          // Page number (default: 1)
  limit?: number                          // Results per page (default: 20, max: 100)
}
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "code": "EMP-CAL-1234567890",
      "name": "Calendar Slot",
      "person_entity_type": "employee",
      "person_entity_id": "employee-uuid",
      "from_ts": "2025-11-15T09:00:00Z",
      "to_ts": "2025-11-15T10:00:00Z",
      "timezone": "America/Toronto",
      "availability_flag": true,
      "title": null,
      "metadata": {}
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

**Use Cases:**
- View all calendar slots across all people
- Filter to show only available or booked slots
- Paginate through large result sets

---

### 2. Get Single Calendar Slot

**MCP Tool:** `person_calendar_get`

```typescript
// GET /api/v1/person-calendar/:id
{
  id: string  // Calendar slot UUID
}
```

**Response:**
```json
{
  "id": "uuid",
  "code": "EMP-CAL-1234567890",
  "name": "Team Meeting",
  "person_entity_type": "employee",
  "person_entity_id": "employee-uuid",
  "from_ts": "2025-11-15T14:00:00Z",
  "to_ts": "2025-11-15T15:00:00Z",
  "availability_flag": false,
  "title": "Project Kickoff Meeting",
  "appointment_medium": "onsite",
  "appointment_addr": "Conference Room A",
  "instructions": "Bring project documents",
  "metadata": {
    "employee_ids": ["uuid1", "uuid2"],
    "attendee_ids": ["customer-uuid1"]
  }
}
```

**Use Cases:**
- Get full details of a specific calendar slot
- Check booking information before modification
- Retrieve metadata for display

---

### 3. Get Available Slots

**MCP Tool:** `person_calendar_get_available`

```typescript
// GET /api/v1/person-calendar/available
{
  person_entity_type?: 'employee' | 'customer',  // Filter by person type
  person_entity_id?: string,                     // Filter by specific person
  from_ts?: string,                              // Start of date range
  to_ts?: string                                 // End of date range
}
```

**Response:**
```json
[
  {
    "id": "uuid",
    "code": "EMP-CAL-1234567890",
    "name": "Calendar Slot",
    "person_entity_type": "employee",
    "person_entity_id": "employee-uuid",
    "from_ts": "2025-11-15T09:00:00Z",
    "to_ts": "2025-11-15T10:00:00Z",
    "timezone": "America/Toronto",
    "availability_flag": true
  }
]
```

**Use Cases:**
- Find open time slots for booking
- Check employee availability for scheduling
- Display available appointment times to customers

**Special Endpoint:**
```typescript
// GET /api/v1/person-calendar/available-by-service
{
  service_category: string,  // Required: department/service category
  limit?: number             // Default: 1 - number of slots to return
}
```

**Response:**
```json
{
  "service_category": "plumbing",
  "slots_found": 3,
  "slots": [
    {
      "id": "uuid",
      "from_ts": "2025-11-15T09:00:00Z",
      "to_ts": "2025-11-15T10:00:00Z",
      "employee_id": "uuid",
      "employee_name": "John Smith",
      "department": "plumbing",
      "job_title": "Plumber",
      "employee_email": "john@example.com",
      "employee_phone": "+1234567890"
    }
  ]
}
```

**Use Cases:**
- Find available slots by service category (plumbing, electrical, etc.)
- Match customer requests to qualified employees
- Smart scheduling based on service type

---

### 4. Get Booked Slots

**MCP Tool:** `person_calendar_get_booked`

```typescript
// GET /api/v1/person-calendar/booked
{
  person_entity_type?: 'employee' | 'customer',
  person_entity_id?: string,
  from_ts?: string
}
```

**Response:** Same format as available slots, but with `availability_flag: false`

**Use Cases:**
- View all bookings for a person
- Check scheduled appointments
- Generate booking reports

---

### 5. Create Calendar Slot

**MCP Tool:** `person_calendar_create`

```typescript
// POST /api/v1/person-calendar
{
  code: string,                              // Unique code (e.g., "EMP-CAL-1234567890")
  name: string,                              // Display name
  descr?: string,                            // Description
  person_entity_type: 'employee' | 'customer',
  person_entity_id: string,                  // Person UUID
  from_ts: string,                           // ISO 8601 timestamp
  to_ts: string,                             // ISO 8601 timestamp
  timezone?: string,                         // Default: 'America/Toronto'
  availability_flag?: boolean,               // Default: true
  title?: string,                            // Booking title (for pre-booked slots)
  appointment_medium?: 'onsite' | 'virtual',
  appointment_addr?: string,
  instructions?: string,
  event_id?: string,                         // Link to external event
  metadata?: {
    employee_ids?: string[],
    attendee_ids?: string[],
    // ... custom fields
  }
}
```

**Response:**
```json
{
  "id": "uuid",
  "code": "EMP-CAL-1234567890",
  "name": "Calendar Slot",
  "from_ts": "2025-11-15T09:00:00Z",
  "to_ts": "2025-11-15T10:00:00Z",
  "created_ts": "2025-11-10T12:00:00Z"
}
```

**Use Cases:**
- Add new time slots to employee calendars
- Create availability windows
- Pre-book appointments during creation

**Code Generation Pattern:**
```typescript
// Generate unique code
const code = `${person_entity_type.toUpperCase().slice(0, 3)}-CAL-${Date.now()}`;
// Examples:
// - EMP-CAL-1699632000000
// - CUS-CAL-1699632000000
```

---

### 6. Update Calendar Slot

**MCP Tool:** `person_calendar_update`

```typescript
// PATCH /api/v1/person-calendar/:id
{
  name?: string,
  descr?: string,
  from_ts?: string,                      // Reschedule start time
  to_ts?: string,                        // Reschedule end time
  availability_flag?: boolean,           // Change availability
  title?: string,
  appointment_medium?: 'onsite' | 'virtual',
  appointment_addr?: string,
  instructions?: string,
  event_id?: string,
  metadata?: Record<string, any>,
  reminder_sent_flag?: boolean,
  confirmation_sent_flag?: boolean
}
```

**Response:**
```json
{
  "id": "uuid",
  "code": "EMP-CAL-1234567890",
  "name": "Updated Name",
  "availability_flag": false,
  "title": "New Booking Title",
  "updated_ts": "2025-11-10T12:30:00Z"
}
```

**Use Cases:**
- Reschedule appointments (change from_ts/to_ts)
- Update booking details
- Mark reminders/confirmations as sent
- Change availability status

**Special Behavior:**
- `COALESCE` pattern: Only updates fields that are provided
- Automatic timestamp setting for reminder/confirmation sent flags
- Version increment on every update

---

### 7. Book a Time Slot

**MCP Tool:** `person_calendar_book`

```typescript
// POST /api/v1/person-calendar/book
{
  slot_ids: string[],                    // Array of slot UUIDs to book
  title: string,                          // Booking title (required)
  event_id?: string,
  appointment_medium?: 'onsite' | 'virtual',
  appointment_addr?: string,
  instructions?: string,
  metadata?: {
    employee_ids?: string[],
    attendee_ids?: string[],
    // ... custom fields
  }
}
```

**Response:**
```json
{
  "success": true,
  "booked_slots": 2,
  "slots": [
    {
      "id": "uuid1",
      "code": "EMP-CAL-1234567890",
      "name": "Calendar Slot",
      "title": "Customer Consultation",
      "event_id": "event-uuid",
      "from_ts": "2025-11-15T09:00:00Z",
      "to_ts": "2025-11-15T10:00:00Z"
    },
    {
      "id": "uuid2",
      "code": "EMP-CAL-1234567891",
      "name": "Calendar Slot",
      "title": "Customer Consultation",
      "event_id": "event-uuid",
      "from_ts": "2025-11-15T10:00:00Z",
      "to_ts": "2025-11-15T11:00:00Z"
    }
  ]
}
```

**Use Cases:**
- Book multiple consecutive slots at once
- Convert available slots to booked appointments
- Add booking metadata (attendees, location, etc.)

**Constraints:**
- Only slots with `availability_flag = true` can be booked
- Only `active_flag = true` slots are bookable
- Atomic operation - all slots are booked or none are

**Errors:**
```json
{
  "error": "No available slots found to book"
}
// HTTP 404 if no slots match the criteria
```

---

### 8. Cancel Booking

**Endpoint:** `POST /api/v1/person-calendar/cancel` (No MCP tool yet - can be added)

```typescript
{
  slot_ids: string[]  // Array of slot UUIDs to cancel
}
```

**Response:**
```json
{
  "success": true,
  "cancelled_slots": 2,
  "slots": [
    {
      "id": "uuid1",
      "code": "EMP-CAL-1234567890",
      "name": "Calendar Slot",
      "from_ts": "2025-11-15T09:00:00Z",
      "to_ts": "2025-11-15T10:00:00Z"
    }
  ]
}
```

**Use Cases:**
- Cancel appointments
- Free up booked slots for rebooking
- Clear booking metadata

**Side Effects:**
- Sets `availability_flag = true`
- Clears: `title`, `event_id`, `appointment_medium`, `appointment_addr`, `instructions`
- Resets `metadata` to empty object `{}`

---

### 9. Delete Calendar Slot

**MCP Tool:** `person_calendar_delete`

```typescript
// DELETE /api/v1/person-calendar/:id
{
  id: string  // Calendar slot UUID
}
```

**Response:**
```json
{
  "success": true,
  "message": "Calendar slot deleted successfully"
}
```

**Use Cases:**
- Remove slots from calendar
- Clean up old/obsolete time slots

**Note:** This is a **soft delete** - sets `active_flag = false` instead of removing the record.

---

## Usage Examples

### Example 1: Create Employee Availability

```typescript
// Create 10 available slots for an employee (9 AM - 7 PM, 1-hour slots)
const employeeId = "employee-uuid";
const date = "2025-11-15";

for (let hour = 9; hour < 19; hour++) {
  await person_calendar_create({
    code: `EMP-CAL-${Date.now()}-${hour}`,
    name: `${hour}:00 Slot`,
    person_entity_type: "employee",
    person_entity_id: employeeId,
    from_ts: `${date}T${hour.toString().padStart(2, '0')}:00:00Z`,
    to_ts: `${date}T${(hour + 1).toString().padStart(2, '0')}:00:00Z`,
    timezone: "America/Toronto",
    availability_flag: true
  });
}
```

### Example 2: Find and Book Appointment

```typescript
// 1. Find available slots for an employee on a specific day
const availableSlots = await person_calendar_get_available({
  person_entity_type: "employee",
  person_entity_id: "employee-uuid",
  from_ts: "2025-11-15T00:00:00Z",
  to_ts: "2025-11-15T23:59:59Z"
});

// 2. Book the first available slot
if (availableSlots.length > 0) {
  const slot = availableSlots[0];
  await person_calendar_book({
    slot_ids: [slot.id],
    title: "Customer Consultation",
    appointment_medium: "virtual",
    appointment_addr: "https://zoom.us/j/123456789",
    instructions: "Please have your account information ready",
    metadata: {
      customer_id: "customer-uuid",
      attendee_ids: ["customer-uuid"],
      booking_source: "web_portal"
    }
  });
}
```

### Example 3: Check Employee Schedule

```typescript
// Get all booked appointments for an employee this week
const bookedSlots = await person_calendar_get_booked({
  person_entity_type: "employee",
  person_entity_id: "employee-uuid",
  from_ts: "2025-11-11T00:00:00Z"  // From today onwards
});

// Group by date
const schedule = bookedSlots.reduce((acc, slot) => {
  const date = slot.from_ts.split('T')[0];
  if (!acc[date]) acc[date] = [];
  acc[date].push({
    time: new Date(slot.from_ts).toLocaleTimeString(),
    title: slot.title,
    location: slot.appointment_addr
  });
  return acc;
}, {});

console.log("This week's schedule:", schedule);
```

### Example 4: Reschedule Appointment

```typescript
// Move an appointment to a different time
const slotId = "slot-uuid";
const newStartTime = "2025-11-16T14:00:00Z";
const newEndTime = "2025-11-16T15:00:00Z";

await person_calendar_update({
  id: slotId,
  from_ts: newStartTime,
  to_ts: newEndTime
});
```

### Example 5: Smart Service Booking

```typescript
// Find available plumber and book appointment
const plumberSlots = await fetch('/api/v1/person-calendar/available-by-service', {
  method: 'GET',
  params: {
    service_category: 'plumbing',
    limit: 5  // Get 5 available slots
  }
});

// Book the first available plumber
if (plumberSlots.slots.length > 0) {
  const slot = plumberSlots.slots[0];
  await person_calendar_book({
    slot_ids: [slot.id],
    title: "Leak Repair - Kitchen Sink",
    appointment_medium: "onsite",
    appointment_addr: "123 Main St, Toronto, ON",
    instructions: "Ring doorbell twice",
    metadata: {
      service_category: "plumbing",
      customer_id: "customer-uuid",
      priority: "high"
    }
  });
}
```

---

## Common Patterns

### Pattern 1: Bulk Availability Creation

Create recurring availability for multiple weeks:

```typescript
async function createWeeklyAvailability(
  employeeId: string,
  startDate: Date,
  weeks: number,
  dailySlots: { startHour: number; endHour: number; slotDuration: number }
) {
  const slots = [];

  for (let week = 0; week < weeks; week++) {
    for (let day = 0; day < 5; day++) {  // Monday to Friday
      const date = new Date(startDate);
      date.setDate(date.getDate() + (week * 7) + day);

      for (let hour = dailySlots.startHour; hour < dailySlots.endHour; hour += dailySlots.slotDuration) {
        const from = new Date(date);
        from.setHours(hour, 0, 0, 0);

        const to = new Date(from);
        to.setHours(hour + dailySlots.slotDuration, 0, 0, 0);

        slots.push({
          code: `EMP-CAL-${Date.now()}-${week}-${day}-${hour}`,
          name: `${from.toLocaleTimeString()} Slot`,
          person_entity_type: "employee",
          person_entity_id: employeeId,
          from_ts: from.toISOString(),
          to_ts: to.toISOString(),
          timezone: "America/Toronto",
          availability_flag: true
        });
      }
    }
  }

  // Batch create
  for (const slot of slots) {
    await person_calendar_create(slot);
  }
}

// Usage: Create 4 weeks of 1-hour slots from 9 AM to 5 PM
await createWeeklyAvailability(
  "employee-uuid",
  new Date("2025-11-11"),
  4,
  { startHour: 9, endHour: 17, slotDuration: 1 }
);
```

### Pattern 2: Conflict Detection

Check for booking conflicts before creating/updating:

```typescript
async function hasConflict(personId: string, fromTs: string, toTs: string): Promise<boolean> {
  const existingSlots = await person_calendar_get_booked({
    person_entity_id: personId,
    from_ts: fromTs
  });

  return existingSlots.some(slot => {
    const slotStart = new Date(slot.from_ts);
    const slotEnd = new Date(slot.to_ts);
    const newStart = new Date(fromTs);
    const newEnd = new Date(toTs);

    // Check for overlap
    return (newStart < slotEnd && newEnd > slotStart);
  });
}

// Usage
const conflict = await hasConflict(
  "employee-uuid",
  "2025-11-15T09:00:00Z",
  "2025-11-15T10:00:00Z"
);

if (conflict) {
  console.log("⚠️  Time slot already booked");
}
```

### Pattern 3: Multi-Person Booking

Book a meeting with multiple people:

```typescript
async function bookTeamMeeting(
  participantIds: string[],
  title: string,
  fromTs: string,
  toTs: string,
  location: string
) {
  const bookingResults = [];

  for (const personId of participantIds) {
    // Find available slot
    const availableSlots = await person_calendar_get_available({
      person_entity_id: personId,
      from_ts: fromTs,
      to_ts: toTs
    });

    if (availableSlots.length > 0) {
      // Book the slot
      const result = await person_calendar_book({
        slot_ids: [availableSlots[0].id],
        title,
        appointment_medium: "onsite",
        appointment_addr: location,
        metadata: {
          attendee_ids: participantIds,
          meeting_type: "team_meeting"
        }
      });

      bookingResults.push({ personId, success: true, result });
    } else {
      bookingResults.push({ personId, success: false, reason: "No available slot" });
    }
  }

  return bookingResults;
}

// Usage
const results = await bookTeamMeeting(
  ["employee-uuid-1", "employee-uuid-2", "employee-uuid-3"],
  "Sprint Planning Meeting",
  "2025-11-15T14:00:00Z",
  "2025-11-15T16:00:00Z",
  "Conference Room A"
);
```

---

## Error Handling

### Common Errors

| Error | HTTP Code | Cause | Solution |
|-------|-----------|-------|----------|
| `Calendar slot not found` | 404 | Invalid slot ID | Verify the slot exists and is active |
| `No available slots found to book` | 404 | Slots already booked or inactive | Check availability first |
| `Failed to create calendar slot` | 500 | Database error or validation failure | Check required fields |
| `Authentication failed` | 401 | Invalid or missing JWT token | Authenticate first |
| `Insufficient permissions` | 403 | User lacks calendar permissions | Check RBAC settings |

### Error Response Format

```json
{
  "error": "Error message",
  "status": 404,
  "details": {
    "field": "Additional context"
  }
}
```

### Retry Strategy

```typescript
async function retryCalendarOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      if (attempt === maxRetries) throw error;

      // Only retry on transient errors
      if (error.status === 500 || error.status === 503) {
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      } else {
        throw error;  // Don't retry client errors (4xx)
      }
    }
  }

  throw new Error('Max retries exceeded');
}

// Usage
const slot = await retryCalendarOperation(() =>
  person_calendar_create({
    code: "EMP-CAL-123",
    name: "Slot",
    person_entity_type: "employee",
    person_entity_id: "uuid",
    from_ts: "2025-11-15T09:00:00Z",
    to_ts: "2025-11-15T10:00:00Z"
  })
);
```

---

## Best Practices

### 1. Always Use Timezone-Aware Timestamps

```typescript
// ✅ GOOD: ISO 8601 with timezone
from_ts: "2025-11-15T09:00:00Z"           // UTC
from_ts: "2025-11-15T09:00:00-05:00"      // EST

// ❌ BAD: No timezone
from_ts: "2025-11-15T09:00:00"
```

### 2. Generate Unique Codes

```typescript
// ✅ GOOD: Unique code with timestamp
const code = `${person_entity_type.toUpperCase().slice(0, 3)}-CAL-${Date.now()}`;

// ❌ BAD: Sequential numbers (collision risk in distributed systems)
const code = `EMP-CAL-${counter++}`;
```

### 3. Check Availability Before Booking

```typescript
// ✅ GOOD: Check availability first
const availableSlots = await person_calendar_get_available({
  person_entity_id: "uuid",
  from_ts: "2025-11-15T09:00:00Z",
  to_ts: "2025-11-15T10:00:00Z"
});

if (availableSlots.length > 0) {
  await person_calendar_book({ slot_ids: [availableSlots[0].id], title: "Meeting" });
}

// ❌ BAD: Assume slot exists and is available
await person_calendar_book({ slot_ids: ["unknown-uuid"], title: "Meeting" });
```

### 4. Use Metadata for Custom Fields

```typescript
// ✅ GOOD: Store custom data in metadata
metadata: {
  customer_id: "uuid",
  service_type: "consultation",
  estimated_duration: 60,
  requires_preparation: true,
  follow_up_required: false,
  tags: ["vip", "urgent"]
}

// ❌ BAD: Try to add custom columns (not supported)
custom_field_1: "value"  // Will be ignored
```

### 5. Handle Pagination

```typescript
// ✅ GOOD: Paginate large result sets
async function getAllSlots(filters: any) {
  const allSlots = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await person_calendar_list({
      ...filters,
      page,
      limit: 100
    });

    allSlots.push(...response.data);
    hasMore = page < response.pagination.total_pages;
    page++;
  }

  return allSlots;
}

// ❌ BAD: Request all records at once (performance issues)
const allSlots = await person_calendar_list({ limit: 10000 });
```

### 6. Soft Delete Only

```typescript
// ✅ GOOD: Use soft delete
await person_calendar_delete({ id: "uuid" });
// Sets active_flag = false, record still in database

// ℹ️  NOTE: Hard delete not supported
// Records are never physically deleted for audit purposes
```

### 7. Update Incrementally

```typescript
// ✅ GOOD: Update only changed fields
await person_calendar_update({
  id: "uuid",
  title: "Updated Title"  // Only update title
});

// ❌ BAD: Send entire object (unnecessary data transfer)
await person_calendar_update({
  id: "uuid",
  name: "...",
  descr: "...",
  person_entity_type: "...",
  // ... all 20 fields
  title: "Updated Title"
});
```

---

## API Testing

### Using test-api.sh

```bash
# List all calendar slots
./tools/test-api.sh GET /api/v1/person-calendar

# Get available slots
./tools/test-api.sh GET '/api/v1/person-calendar/available?person_entity_id=uuid'

# Create slot
./tools/test-api.sh POST /api/v1/person-calendar '{
  "code": "EMP-CAL-123",
  "name": "Test Slot",
  "person_entity_type": "employee",
  "person_entity_id": "uuid",
  "from_ts": "2025-11-15T09:00:00Z",
  "to_ts": "2025-11-15T10:00:00Z"
}'

# Book slot
./tools/test-api.sh POST /api/v1/person-calendar/book '{
  "slot_ids": ["uuid"],
  "title": "Customer Meeting"
}'

# Update slot
./tools/test-api.sh PATCH /api/v1/person-calendar/uuid '{
  "title": "Updated Title"
}'

# Delete slot
./tools/test-api.sh DELETE /api/v1/person-calendar/uuid
```

### Using MCP Client

```typescript
// Assuming MCP client is connected to pmo-api-server

// Authenticate first
await mcpClient.callTool('pmo_authenticate', {
  email: 'james.miller@huronhome.ca',
  password: 'password123'
});

// List slots
const slots = await mcpClient.callTool('person_calendar_list', {
  availability_flag: 'true',
  page: 1,
  limit: 20
});

// Get available slots by service
const plumberSlots = await mcpClient.callTool('person_calendar_get_available', {
  person_entity_type: 'employee',
  from_ts: '2025-11-15T00:00:00Z',
  to_ts: '2025-11-15T23:59:59Z'
});

// Create slot
const newSlot = await mcpClient.callTool('person_calendar_create', {
  body: JSON.stringify({
    code: 'EMP-CAL-123',
    name: 'Test Slot',
    person_entity_type: 'employee',
    person_entity_id: 'employee-uuid',
    from_ts: '2025-11-15T09:00:00Z',
    to_ts: '2025-11-15T10:00:00Z'
  })
});
```

---

## Integration with Frontend

### Calendar View Component

The `/home/user/pmo/apps/web/src/components/shared/ui/CalendarView.tsx` component integrates with this API:

**Key Features:**
1. **Person Filtering** - Multi-select sidebar to filter by employees/customers
2. **Shows Booked Events Only** - Only displays `availability_flag = false` slots
3. **Empty Until Selection** - Starts with no calendar data until user selects people
4. **Union of Events** - Shows combined bookings for all selected people

**API Calls:**
```typescript
// Fetch all calendar data
const response = await fetch('/api/v1/person-calendar?page=1&limit=1000', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Client-side filtering by selected people
const filteredData = data.filter(slot =>
  selectedPersonIds.has(slot.person_entity_id) &&
  slot.availability_flag === false  // Only booked events
);
```

**Updated Behavior (2025-11-10):**
- ✅ No auto-selection on load
- ✅ Filter to booked events only (`availability_flag = false`)
- ✅ Empty state with selection prompt
- ✅ Multi-person selection shows union of all bookings
- ✅ Color-coded by person type (blue=employee, purple=customer)

---

## Related Documentation

- **[AI Chat System](./ai_chat/AI_CHAT_SYSTEM.md)** - Calendar booking via AI assistant
- **[Database Model](./datamodel/datamodel.md)** - Full schema documentation
- **[Entity Options API](./ENTITY_OPTIONS_API.md)** - Dropdown options for forms
- **[MCP Server](../apps/mcp-server/README.md)** - Model Context Protocol setup

---

## Changelog

### 2025-11-10
- ✅ Updated CalendarView to show booked events only
- ✅ Removed auto-selection of people on load
- ✅ Improved empty state messaging
- ✅ Created comprehensive MCP tool documentation

### Earlier
- Calendar API routes implemented
- MCP tools exposed for all endpoints
- Available-by-service endpoint added
- Booking and cancellation endpoints added

---

## Support

For issues or questions:
- Check API logs: `./tools/logs-api.sh`
- Test endpoints: `./tools/test-api.sh`
- Review database: `psql -d pmo -c "SELECT * FROM app.d_entity_person_calendar LIMIT 10"`

---

**Version:** 1.0
**Last Updated:** 2025-11-10
**Author:** PMO Platform Team
