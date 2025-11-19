# Calendar System - Multi-Person Availability & Booking Management

**Status:** Production-Ready
**Version:** 2.0.0
**Last Updated:** 2025-11-12
**Entity Code:** `calendar`
**API Endpoint:** `/api/v1/person-calendar`
**Database Table:** `d_entity_person_calendar`

---

## 1. Semantics & Business Context

### Purpose
The Calendar System provides **multi-person availability and booking management** for employees and customers. It enables:

- **Availability Tracking**: 15-minute time slot granularity (9 AM - 8 PM)
- **Multi-Person View**: Overlaid calendar display for multiple people simultaneously
- **Booking Management**: Mark slots as available/booked with event details
- **Person Filtering**: Checkbox-based filtering by employees and customers

### Business Value
- **Scheduling Efficiency**: Pre-seeded availability slots eliminate manual availability checks
- **Resource Management**: View multiple team members' schedules in one view
- **Customer Booking**: Track customer appointment slots and availability
- **Conflict Prevention**: Visual color-coding prevents double-booking

### Entity Type
**Entity Code:** `calendar`
**Display Name:** Calendar
**Plural:** Calendars
**Icon:** Calendar (📅)
**Display Order:** 135

---

## 2. Architecture & DRY Design Patterns

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CALENDAR SYSTEM                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐      ┌──────────────┐      ┌───────────┐ │
│  │   Database   │─────▶│  API Layer   │─────▶│  Frontend │ │
│  │              │      │              │      │           │ │
│  │ d_entity_    │      │ /api/v1/     │      │ Calendar  │ │
│  │ person_      │      │ person-      │      │ View      │ │
│  │ calendar     │      │ calendar     │      │ Component │ │
│  └──────────────┘      └──────────────┘      └───────────┘ │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                    CONFIGURATION LAYER                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐      ┌──────────────┐      ┌───────────┐ │
│  │  d_entity    │      │ entityConfig │      │    App    │ │
│  │  (registry)  │─────▶│   .calendar  │─────▶│  Routes   │ │
│  │              │      │              │      │           │ │
│  │ code:        │      │ apiEndpoint  │      │ /calendar │ │
│  │ 'calendar'   │      │ columns      │      │ /calendar │ │
│  │              │      │ fields       │      │   /:id    │ │
│  └──────────────┘      └──────────────┘      └───────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow: User Views Calendar

```
1. USER NAVIGATES TO /calendar
   ↓
2. EntityMainPage (entityType="calendar")
   ↓
3. VIEW SWITCHER: Table | Calendar
   ↓
4. CALENDAR VIEW SELECTED (default)
   ↓
5. CalendarView Component Loads
   ├─▶ Fetch Employees: GET /api/v1/employee?page=1&limit=100
   ├─▶ Fetch Customers: GET /api/v1/cust?page=1&limit=100
   └─▶ Fetch Calendar: GET /api/v1/person-calendar (via APIFactory)
   ↓
6. RENDER CALENDAR GRID
   ├─▶ Sidebar: Person filter (checkboxes)
   ├─▶ Week Navigation: Previous | Today | Next
   ├─▶ Calendar Grid: Mon-Fri, 9 AM - 8 PM
   └─▶ Color-coded slots: Green (available), Blue (employee), Purple (customer)
   ↓
7. USER INTERACTION
   ├─▶ Select/deselect people (filters calendar data)
   ├─▶ Navigate weeks (updates date range)
   └─▶ Click slot (opens detail view)
```

### DRY Principles Applied

#### 1. **Universal Entity System**
```typescript
// Single entity type handles all calendar operations
entityConfigs.calendar = {
  name: 'calendar',
  apiEndpoint: '/api/v1/person-calendar',
  supportedViews: ['table', 'calendar'],
  defaultView: 'calendar'
}
```

#### 2. **Reusable CalendarView Component**
- **One Component**: Handles all calendar rendering
- **Config-Driven**: Uses `EntityConfig` for metadata
- **Generic Filtering**: Multi-select person filtering (any person type)
- **No Hardcoded Data**: All data from API responses

#### 3. **Standard API Pattern**
```typescript
// Follows same pattern as all 50+ other entity APIs
export const calendarApi = {
  async list(params) { /* ... */ },
  async get(id) { /* ... */ },
  async create(data) { /* ... */ },
  async update(id, data) { /* ... */ },
  async delete(id) { /* ... */ }
};
```

#### 4. **Icon System Integration**
```typescript
// Icons come from d_entity table (DRY)
d_entity.ui_icon → iconMapping.ts → Lucide Component
```

---

## 3. Database, API & UI/UX Mapping

### Database Layer

**Table:** `app.d_entity_person_calendar`

**Key Fields:**
```sql
-- Identity
id uuid PRIMARY KEY
code varchar(50) UNIQUE

-- Person Reference (Polymorphic)
person_entity_type varchar(50)  -- 'employee' | 'customer'
person_entity_id uuid            -- FK to employee.id OR cust.id

-- Time Slot
from_ts timestamptz              -- Slot start time
to_ts timestamptz                -- Slot end time
timezone varchar(50)             -- Default: 'America/Toronto'

-- Availability
availability_flag boolean        -- true=available, false=booked

-- Booking Details (when booked)
title varchar(200)
appointment_medium varchar(50)   -- 'onsite' | 'virtual'
appointment_addr text
instructions text
event_id uuid                    -- Link to d_event

-- Metadata
metadata jsonb                   -- Flexible data storage
```

**Indexes:**
```sql
idx_person_calendar_person         -- (person_entity_type, person_entity_id)
idx_person_calendar_availability   -- (availability_flag, from_ts, to_ts)
idx_person_calendar_time_range     -- (from_ts, to_ts)
```

### API Layer

**Base Endpoint:** `/api/v1/person-calendar`

**Standard CRUD Operations:**
```
GET    /api/v1/person-calendar              # List all slots
GET    /api/v1/person-calendar/:id          # Get slot by ID
POST   /api/v1/person-calendar              # Create new slot
PATCH  /api/v1/person-calendar/:id          # Update slot
DELETE /api/v1/person-calendar/:id          # Delete slot
```

**Specialized Endpoints:**
```
GET /api/v1/person-calendar/available
  ?person_entity_type=employee
  &person_entity_id={uuid}
  &from_ts={timestamp}
  &to_ts={timestamp}

GET /api/v1/person-calendar/booked
  ?person_entity_type=employee
  &person_entity_id={uuid}

POST /api/v1/person-calendar/book
  Body: { slot_ids, title, appointment_medium, ... }

POST /api/v1/person-calendar/cancel
  Body: { slot_ids }
```

**API Response Format:**
```json
{
  "data": [
    {
      "id": "uuid",
      "code": "EMP-CAL-20251105-0900-8260b1b0",
      "name": "Available Slot - 2025-11-05 09:00",
      "person_entity_type": "employee",
      "person_entity_id": "8260b1b0-...",
      "from_ts": "2025-11-05T09:00:00-05:00",
      "to_ts": "2025-11-05T09:15:00-05:00",
      "availability_flag": true,
      "title": null
    }
  ],
  "total": 220
}
```

### UI/UX Layer

**Route:** `/calendar`

**Component:** `CalendarView.tsx` (via `EntityMainPage`)

**UI Structure:**
```
┌─────────────────────────────────────────────────────────────┐
│                        CALENDAR VIEW                         │
├──────────────┬──────────────────────────────────────────────┤
│              │                                               │
│  SIDEBAR     │              CALENDAR GRID                    │
│  (Filters)   │                                               │
│              │  ┌─────────────────────────────────────────┐  │
│ ☑ Employees  │  │ Mon  Tue  Wed  Thu  Fri                 │  │
│   ☑ James    │  ├─────────────────────────────────────────┤  │
│   ☑ Sarah    │  │ 9:00                                    │  │
│   ☐ Michael  │  │ 9:15  [Available] [Booked: Meeting]    │  │
│              │  │ 9:30  [Available] [Available]           │  │
│ ☐ Customers  │  │ ...                                     │  │
│   ☐ John     │  │ 8:00                                    │  │
│              │  └─────────────────────────────────────────┘  │
│              │                                               │
│  [Collapse]  │  Previous | Today | Next                      │
│              │                                               │
└──────────────┴──────────────────────────────────────────────┘
```

**Color Coding:**
- 🟢 **Green** - Available slot (`availability_flag: true`)
- 🔵 **Blue** - Employee booking (`person_entity_type: 'employee'`, booked)
- 🟣 **Purple** - Customer booking (`person_entity_type: 'customer'`, booked)

**View Modes:**
- **Table View** - Standard data table with all columns
- **Calendar View** - Week-based grid (default)

---

## 4. DRY Principles & Entity Relationships

### Entity Registration Flow

```
1. DATABASE REGISTRATION
   ├─▶ d_entity (entity type metadata)
   │   └─▶ code: 'calendar'
   │   └─▶ name: 'Calendar'
   │   └─▶ ui_icon: 'Calendar'
   │   └─▶ display_order: 135
   │
   └─▶ d_entity_person_calendar (data table)
       └─▶ Stores actual calendar slots

2. API REGISTRATION
   ├─▶ api.ts
   │   └─▶ export const calendarApi = { ... }
   │   └─▶ APIFactory.register('calendar', calendarApi)
   │
   └─▶ person-calendar/routes.ts
       └─▶ Fastify routes for CRUD + specialized endpoints

3. FRONTEND REGISTRATION
   ├─▶ entityConfig.ts
   │   └─▶ calendar: { name, apiEndpoint, columns, fields, views }
   │
   ├─▶ App.tsx
   │   └─▶ coreEntities.push('calendar')
   │   └─▶ Auto-generates routes: /calendar, /calendar/:id, /calendar/new
   │
   └─▶ iconMapping.ts
       └─▶ 'Calendar': Calendar (Lucide icon)
```

### Polymorphic Person Reference

**Pattern:** One calendar table supports multiple person types

```
person_entity_type + person_entity_id → POLYMORPHIC FK
  ├─▶ 'employee' → employee.id
  └─▶ 'customer' → cust.id

NO FOREIGN KEYS (PMO pattern)
Relationships tracked via:
  ├─▶ d_entity_instance_registry (entity instance registry)
  └─▶ d_entity_instance_link (parent-child relationships)
```

### Event Linkage

**Pattern:** Calendar slots link to events for full details

```
d_entity_person_calendar.event_id → d_event.id
  └─▶ One event can span multiple calendar slots
  └─▶ Event defines WHAT, calendar defines WHEN and WHO
```

---

## 5. Central Configuration & Middleware

### Entity Configuration

**File:** `apps/web/src/lib/entityConfig.ts`

**Calendar Config:**
```typescript
calendar: {
  name: 'calendar',
  displayName: 'Calendar',
  pluralName: 'Calendars',
  apiEndpoint: '/api/v1/person-calendar',

  columns: [
    'name',
    'person_entity_type',
    'from_ts',
    'to_ts',
    'availability_flag',
    'title',
    'appointment_medium'
  ],

  fields: [
    { key: 'code', label: 'Code', type: 'text', required: true },
    { key: 'person_entity_type', label: 'Person Type', type: 'select' },
    { key: 'from_ts', label: 'Start Time', type: 'date' },
    { key: 'availability_flag', label: 'Available', type: 'select' }
    // ... more fields
  ],

  supportedViews: ['table', 'calendar'],
  defaultView: 'calendar'
}
```

### API Factory Registration

**File:** `apps/web/src/lib/api.ts`

**Registration Pattern:**
```typescript
// 1. Define API
export const calendarApi = {
  async list(params) { /* ... */ },
  async get(id) { /* ... */ },
  async create(data) { /* ... */ },
  async update(id, data) { /* ... */ },
  async delete(id) { /* ... */ }
};

// 2. Register in factory
APIFactory.register('calendar', calendarApi);

// 3. Usage in components
const api = APIFactory.getAPI('calendar');
const response = await api.list({ page: 1 });
```

### Route Configuration

**File:** `apps/web/src/App.tsx`

**Auto-Generated Routes:**
```typescript
const coreEntities = [
  'biz', 'office', 'project', 'task',
  'employee', 'calendar', // ← Added
  // ... more entities
];

// Routes generated automatically:
// /calendar        → EntityMainPage (list/calendar view)
// /calendar/:id    → EntityDetailPage (detail view)
// /calendar/new    → EntityCreatePage (create form)
```

### Icon Mapping

**File:** `apps/web/src/lib/iconMapping.ts`

**Mapping Pattern:**
```typescript
import { Calendar } from 'lucide-react';

const iconMap = {
  'Calendar': Calendar,  // ← Added
  // ... other icons
};

// Database → Frontend flow:
// d_entity.ui_icon: 'Calendar' → iconMap['Calendar'] → <Calendar />
```

### ViewSwitcher Integration

**File:** `apps/web/src/components/shared/view/ViewSwitcher.tsx`

**View Mode Configuration:**
```typescript
const viewIcons = {
  table: List,
  kanban: Kanban,
  grid: Grid,
  calendar: Calendar,  // ← Added
  graph: GitBranch
};

const viewLabels = {
  table: 'Table',
  calendar: 'Calendar'  // ← Added
};
```

---

## 6. User Interaction Flow Examples

### Flow 1: View Team Availability

```
1. User clicks "Calendars" in sidebar
   ↓
2. Navigates to /calendar
   ↓
3. CalendarView loads with default view (calendar grid)
   ↓
4. System auto-selects first 3 employees
   ↓
5. Calendar displays:
   ├─▶ Week grid (Mon-Fri, 9 AM - 8 PM)
   ├─▶ Color-coded slots for selected employees
   └─▶ Overlaid view showing all selected people's schedules
   ↓
6. User interactions:
   ├─▶ Check/uncheck employees → Grid updates instantly
   ├─▶ Click "Previous Week" → Loads previous week's data
   ├─▶ Click slot → Opens detail modal (if implemented)
   └─▶ Switch to "Table" view → Shows data table
```

### Flow 2: Book Appointment

```
1. User navigates to calendar
   ↓
2. Selects employee from sidebar
   ↓
3. Finds available (green) slot at desired time
   ↓
4. Clicks slot → Opens detail view
   ↓
5. [Future: Booking Modal]
   ├─▶ Enter appointment title
   ├─▶ Select medium (onsite/virtual)
   ├─▶ Add instructions
   └─▶ Submit booking
   ↓
6. System updates:
   ├─▶ PATCH /api/v1/person-calendar/:id
   ├─▶ { availability_flag: false, title: "...", ... }
   └─▶ Slot turns blue (employee) or purple (customer)
```

### Flow 3: Multi-Person Comparison

```
1. User selects 5 employees from sidebar
   ↓
2. Calendar shows overlaid schedules
   ↓
3. User identifies:
   ├─▶ Time slots where all 5 are available (all green)
   ├─▶ Conflicts (multiple colored slots in same time)
   └─▶ Individual availability patterns
   ↓
4. User switches weeks:
   ├─▶ Clicks "Next Week"
   ├─▶ All 5 employees' schedules update for next week
   └─▶ Pattern analysis continues
```

### Flow 4: Switch Between Views

```
1. User on calendar view
   ↓
2. Clicks "Table" in ViewSwitcher
   ↓
3. System switches to FilteredDataTable
   ├─▶ Shows all calendar slots as table rows
   ├─▶ Columns: name, person type, times, availability, title
   ├─▶ Full sorting/filtering capabilities
   └─▶ Inline editing enabled
   ↓
4. User clicks "Calendar" → Returns to grid view
```

---

## 7. Critical Considerations When Building

### For Backend Developers

**API Endpoint Naming:**
```typescript
// ✅ CORRECT: Use existing endpoint
apiEndpoint: '/api/v1/person-calendar'

// ❌ WRONG: Don't create new endpoint
apiEndpoint: '/api/v1/calendar'  // Already used by /api/v1/person-calendar
```

**Response Format:**
```typescript
// MUST return paginated format
{
  data: [...],      // Array of calendar slots
  total: 220,       // Total count
  page: 1,          // Current page
  limit: 100        // Page size
}
```

**Polymorphic Person Reference:**
```sql
-- Store person type AND ID
person_entity_type IN ('employee', 'customer')  -- NO 'client'!
person_entity_id → employee.id OR cust.id

-- NOT d_client.id (doesn't exist)
```

### For Frontend Developers

**Entity Config Registration:**
```typescript
// 1. Add to entityConfig.ts
calendar: {
  name: 'calendar',                    // MUST match route
  apiEndpoint: '/api/v1/person-calendar',
  supportedViews: ['table', 'calendar'],
  defaultView: 'calendar'              // Auto-shows calendar grid
}

// 2. Add to App.tsx coreEntities
const coreEntities = [..., 'calendar'];

// 3. Register in APIFactory
APIFactory.register('calendar', calendarApi);

// 4. Add icon mapping
iconMap['Calendar'] = Calendar;
```

**ViewMode Type:**
```typescript
// MUST update ViewMode type
export type ViewMode = 'table' | 'kanban' | 'grid' | 'calendar' | 'graph';
                                                      ↑ Added
```

**CalendarView Component:**
```typescript
// Component expects specific props
<CalendarView
  config={entityConfig}     // From getEntityConfig('calendar')
  data={calendarSlots}      // Array from API
  onSlotClick={handleClick} // Click handler
/>

// Data format (from API):
{
  person_entity_id: string,
  person_entity_type: 'employee' | 'customer',
  from_ts: string (ISO timestamp),
  to_ts: string (ISO timestamp),
  availability_flag: boolean
}
```

### Database Developers

**Slot Generation:**
```sql
-- Use helper function for consistent slot creation
SELECT app.generate_calendar_slots(
  'employee',                    -- person_entity_type
  '{employee-uuid}'::uuid,       -- person_entity_id
  CURRENT_DATE,                  -- start_date
  CURRENT_DATE + interval '4 days', -- end_date
  'America/Toronto'              -- timezone
);

-- Generates 44 slots/day × 5 days = 220 slots
-- 9:00, 9:15, 9:30, ..., 19:45 (15-min intervals)
```

**Booking Slots:**
```sql
-- ALWAYS update multiple fields together
UPDATE app.d_entity_person_calendar
SET
  availability_flag = false,    -- Mark as booked
  title = 'Meeting Title',      -- Add title
  appointment_medium = 'onsite', -- Set medium
  event_id = '{event-uuid}'     -- Link to event
WHERE id = '{slot-uuid}';
```

**Time Zone Handling:**
```sql
-- ALWAYS use timestamptz (not timestamp)
from_ts timestamptz  -- ✅ Timezone-aware
from_ts timestamp    -- ❌ No timezone info
```

### Common Pitfalls

1. **Wrong API Endpoint**
   ```typescript
   // ❌ WRONG
   apiEndpoint: '/api/v1/calendar'

   // ✅ CORRECT
   apiEndpoint: '/api/v1/person-calendar'
   ```

2. **Missing API Registration**
   ```typescript
   // Must register BEFORE using
   APIFactory.register('calendar', calendarApi);

   // Otherwise: "API not found for entity type: calendar"
   ```

3. **Icon Not Mapped**
   ```typescript
   // Database has ui_icon: 'Calendar'
   // MUST add to iconMapping.ts:
   import { Calendar } from 'lucide-react';
   iconMap['Calendar'] = Calendar;
   ```

4. **Wrong Person Type**
   ```typescript
   // ❌ WRONG: 'client' doesn't exist in this system
   person_entity_type: 'client'

   // ✅ CORRECT: Use 'employee' or 'customer'
   person_entity_type: 'employee' | 'customer'
   ```

5. **ViewMode Not Updated**
   ```typescript
   // Must update type definition
   export type ViewMode = 'table' | 'kanban' | 'grid' | 'calendar';
   //                                                    ↑ Add this
   ```

### Performance Considerations

**Data Fetching:**
```typescript
// ✅ GOOD: Fetch only visible week
GET /api/v1/person-calendar?from_ts=2025-11-04&to_ts=2025-11-08

// ❌ BAD: Fetch all slots
GET /api/v1/person-calendar  // Returns thousands of slots
```

**Person Filtering:**
```typescript
// Frontend filtering (current implementation)
// ✅ Simple, works for <100 people
const filtered = data.filter(slot => selectedIds.has(slot.person_entity_id));

// Backend filtering (future optimization)
// ✅ Better for >100 people
GET /api/v1/person-calendar?person_entity_id={id1,id2,id3}
```

**Slot Grouping:**
```typescript
// ✅ Group by date+time ONCE (useMemo)
const slotsByDateTime = useMemo(() => {
  // Expensive grouping logic
}, [filteredData]);

// ❌ Don't group in render loop
slots.map(slot => groupByDateTime(slot))  // Recalculates every render
```

---

## Quick Reference

### Files Modified/Created

**Database:**
- `db/30_d_entity.ddl` - Added calendar entity registration

**Backend:**
- `apps/api/src/modules/person-calendar/routes.ts` - Existing routes (no changes)
- `apps/api/src/modules/person-calendar/types.ts` - Existing types (no changes)

**Frontend:**
- `apps/web/src/lib/entityConfig.ts` - Added `calendar` config
- `apps/web/src/lib/api.ts` - Added `calendarApi` + registration
- `apps/web/src/lib/iconMapping.ts` - Added `Calendar` icon
- `apps/web/src/App.tsx` - Added `calendar` to core entities
- `apps/web/src/components/shared/view/ViewSwitcher.tsx` - Added calendar view mode
- `apps/web/src/components/shared/ui/CalendarView.tsx` - **NEW** Calendar component
- `apps/web/src/pages/shared/EntityMainPage.tsx` - Added calendar view rendering

### Entity Metadata

| Property | Value |
|----------|-------|
| Code | `calendar` |
| Display Name | Calendar |
| Plural | Calendars |
| Icon | Calendar (📅) |
| API Endpoint | `/api/v1/person-calendar` |
| Database Table | `d_entity_person_calendar` |
| Supported Views | Table, Calendar |
| Default View | Calendar |
| Display Order | 135 |

### API Endpoints Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/person-calendar` | List all slots |
| GET | `/api/v1/person-calendar/:id` | Get slot details |
| POST | `/api/v1/person-calendar` | Create slot |
| PATCH | `/api/v1/person-calendar/:id` | Update slot |
| DELETE | `/api/v1/person-calendar/:id` | Delete slot |
| GET | `/api/v1/person-calendar/available` | Query available slots |
| GET | `/api/v1/person-calendar/booked` | Query booked slots |
| POST | `/api/v1/person-calendar/book` | Book multiple slots |
| POST | `/api/v1/person-calendar/cancel` | Cancel booking |

### Event API Endpoints (Email Invites)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/event` | Create event with automatic calendar invites |
| GET | `/api/v1/event` | List all events |
| GET | `/api/v1/event/:id` | Get event with calendar slots |
| PATCH | `/api/v1/event/:id` | Update event details |
| DELETE | `/api/v1/event/:id` | Delete event and cancel slots |
| POST | `/api/v1/event/:id/send-invites` | Manually resend calendar invites |

---

## 8. Calendar Event Email Invites

### Overview

The PMO platform supports automatic calendar event email invites with full compatibility for **Outlook**, **Gmail**, and **iCloud**. When a calendar event is created for an employee or customer, the system automatically sends them an email with a `.ics` calendar attachment that will block their calendar.

### Features

- ✅ Automatic calendar invite generation in iCalendar (.ics) format
- ✅ Compatible with Outlook, Gmail, and iCloud
- ✅ Blocks recipient calendars automatically
- ✅ Handles cases where email doesn't exist (stores name only)
- ✅ Supports both onsite and virtual meetings
- ✅ Multiple attendees supported
- ✅ Customer and employee support
- ✅ Configurable SMTP settings

### Architecture Components

**1. Email Service** (`apps/api/src/modules/email/email.service.ts`)
- Handles email sending via nodemailer
- Generates iCalendar (.ics) attachments using ical-generator
- Supports multiple attendees
- Gracefully handles missing emails

**2. Event API Routes** (`apps/api/src/modules/event/routes.ts`)
- CRUD operations for events
- Automatic calendar invite sending on event creation
- Manual resend capability

**3. Database Integration**
- `d_event` - Event master records
- `d_entity_person_calendar` - Calendar slots linked to events via `event_id`
- `employee` - Employee records with email
- `cust` - Customer records with email

### Create Event with Calendar Invites

**POST /api/v1/event**

```json
{
  "code": "EVT-MEETING-001",
  "name": "Project Kickoff Meeting",
  "descr": "Initial planning meeting for HVAC project",
  "event_entity_action": "project_kickoff",
  "event_medium": "virtual",
  "event_addr": "https://zoom.us/j/123456789",
  "event_instructions": "Please join 5 minutes early",
  "event_metadata": {
    "project_id": "uuid-here",
    "customer_id": "uuid-here",
    "attendee_ids": ["employee-uuid-1", "employee-uuid-2"]
  },
  "start_time": "2025-11-10T14:00:00-05:00",
  "end_time": "2025-11-10T15:00:00-05:00",
  "timezone": "America/Toronto",
  "send_invites": true,
  "organizer_name": "Huron Home Services",
  "organizer_email": "solutions@cohuron.com"
}
```

**Response:**
```json
{
  "id": "event-uuid",
  "code": "EVT-MEETING-001",
  "name": "Project Kickoff Meeting",
  "event_medium": "virtual",
  "event_addr": "https://zoom.us/j/123456789",
  "event_metadata": {...},
  "created_ts": "2025-11-06T10:30:00Z",
  "calendar_slots": [
    {"id": "slot-uuid-1", "code": "CAL-EVT-MEETING-001-emp1"},
    {"id": "slot-uuid-2", "code": "CAL-EVT-MEETING-001-emp2"}
  ],
  "invite_results": {
    "totalSent": 3,
    "totalFailed": 0,
    "results": [
      {"id": "customer-uuid", "success": true},
      {"id": "employee-uuid-1", "success": true},
      {"id": "employee-uuid-2", "success": true}
    ]
  }
}
```

### Email Behavior

**When Email Exists:**
- ✅ Calendar invite is sent with `.ics` attachment
- ✅ Email includes HTML and plain text versions
- ✅ Event details are embedded in the email body
- ✅ Calendar invitation is attached both as alternative content type and file attachment
- ✅ Recipient's calendar is automatically blocked

**When Email Doesn't Exist:**
- ⚠️ Event is still created with the person's name
- ⚠️ No email is sent (logged as warning)
- ⚠️ Calendar slot is still created
- ✅ `invite_results` shows `success: false` with reason

**Email Content:**
- **Subject:** `Calendar Invite: [Event Name]`
- **Body:** Event title, date/time, location, description, instructions
- **Attachments:** `invite.ics` - iCalendar file (compatible with all major calendar apps)

### SMTP Configuration

Configure in `.env` file:

```bash
# Email/SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=solutions@cohuron.com
SMTP_PASS=your-gmail-app-password
SMTP_FROM=solutions@cohuron.com
```

**Gmail Setup:**
1. Enable 2-factor authentication on your Google account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the App Password in `SMTP_PASS`

**Outlook Setup:**
1. Use your Microsoft account email in `SMTP_USER`
2. Use your account password in `SMTP_PASS`
3. If using 2FA, generate an app password

**Local Testing:**
```bash
# Run MailHog for local email testing
docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog
# Access web UI at http://localhost:8025
```

### Database Schema - Events

**d_event Table:**
```sql
CREATE TABLE app.d_event (
  id uuid PRIMARY KEY,
  code varchar(50) UNIQUE NOT NULL,
  name varchar(200) NOT NULL,
  descr text,
  event_entity_action varchar(100),
  event_medium varchar(50) NOT NULL, -- 'onsite' or 'virtual'
  event_addr text, -- Physical address or meeting URL
  event_instructions text,
  event_metadata jsonb, -- project_id, task_id, customer_id, attendee_ids
  reminder_sent_flag boolean,
  reminder_sent_ts timestamptz,
  confirmation_sent_flag boolean,
  confirmation_sent_ts timestamptz,
  active_flag boolean,
  created_ts timestamptz,
  updated_ts timestamptz,
  version integer
);
```

**Event-Calendar Linkage:**
- Calendar slots link to events via `event_id` field in `d_entity_person_calendar`
- One event can have multiple calendar slots (multiple attendees)
- Deleting an event cancels all linked calendar slots

### Usage Examples

**Example 1: Create Onsite Meeting**
```bash
curl -X POST http://localhost:4000/api/v1/event \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "code": "EVT-ONSITE-001",
    "name": "HVAC System Inspection",
    "descr": "Annual HVAC inspection for commercial building",
    "event_entity_action": "hvac_inspection",
    "event_medium": "onsite",
    "event_addr": "123 Main Street, Toronto, ON M5V 2T6",
    "event_instructions": "Park in visitor parking. Ring buzzer 101.",
    "event_metadata": {
      "customer_id": "cust-uuid-here",
      "attendee_ids": ["tech-uuid-1", "tech-uuid-2"]
    },
    "start_time": "2025-11-15T09:00:00-05:00",
    "end_time": "2025-11-15T11:00:00-05:00",
    "timezone": "America/Toronto",
    "send_invites": true,
    "organizer_name": "Huron Home Services",
    "organizer_email": "solutions@cohuron.com"
  }'
```

**Example 2: Manually Resend Invites**
```bash
curl -X POST http://localhost:4000/api/v1/event/event-uuid-here/send-invites \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "organizer_name": "Huron Home Services",
    "organizer_email": "solutions@cohuron.com"
  }'
```

### Troubleshooting

**Emails Not Sending:**
1. Check SMTP credentials in `.env`
2. Verify SMTP server is accessible
3. Check API logs for error messages
4. For Gmail, ensure App Password is used (not regular password)

**Calendar Invites Not Appearing:**
1. Check recipient's spam/junk folder
2. Verify `.ics` attachment is present in email
3. Some email clients may block calendar invites by default
4. Try different email clients (Outlook, Gmail, Apple Mail)

**Missing Attendee Emails:**
- System will skip sending to attendees without email addresses
- Check `invite_results` in API response for details
- Review API logs for warnings about missing emails

### Future Enhancements

- [ ] Reminder emails (24 hours before event)
- [ ] Event cancellation emails
- [ ] Event update/rescheduling notifications
- [ ] Calendar invite responses (RSVP tracking)
- [ ] Recurring events support
- [ ] Timezone conversion for international events
- [ ] Email template customization
- [ ] Batch event creation

---

**Document Version:** 1.0.1
**Architecture Pattern:** Universal Entity System + DRY Principles
**Status:** Production-Ready ✅
**Last Updated:** 2025-11-06
