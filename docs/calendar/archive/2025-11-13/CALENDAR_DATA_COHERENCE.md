# Calendar System Data Coherence Analysis
**Date**: 2025-11-13
**Status**: ⚠️ NEEDS ALIGNMENT

## Executive Summary

The calendar event system has been updated at the **database** and **API** layers to use simplified organizer tracking (`organizer_employee_id`) and action entity tracking (`event_action_entity_type`, `event_action_entity_id`). However, the **frontend UI** has not been updated to reflect these changes.

**Key Issue**: The frontend still uses the old polymorphic organizer pattern and doesn't support the new event action entity fields.

---

## Current State Analysis

### ✅ Database Layer (apps/api/db/XXXIV_d_event.ddl)

**Schema**:
```sql
CREATE TABLE app.d_event (
  id uuid PRIMARY KEY,
  code varchar(50) NOT NULL,
  name varchar(200) NOT NULL,
  descr text,

  -- NEW FIELDS (v3.1)
  event_action_entity_type varchar(100) NOT NULL,  -- 'service', 'product', 'project', 'task', 'quote'
  event_action_entity_id uuid NOT NULL,            -- ID of what the event is about
  organizer_employee_id uuid,                      -- Employee who organized the event
  venue_type varchar(100),                         -- 'conference_room', 'office', 'customer_site', 'remote'

  -- Standard fields
  event_type varchar(100) NOT NULL,                -- 'onsite', 'virtual'
  event_platform_provider_name varchar(50),
  event_addr text,
  event_instructions text,
  from_ts timestamptz NOT NULL,
  to_ts timestamptz NOT NULL,
  timezone varchar(50),
  event_metadata jsonb
);
```

**Pattern**:
- ✅ Uses IDs for all foreign references (`organizer_employee_id`, `event_action_entity_id`)
- ✅ Simple, non-polymorphic organizer (employees only)
- ✅ Direct tracking of what entity the event is about

---

### ✅ API Layer (apps/api/src/modules/event/routes.ts)

**Response Structure**:
```json
{
  "data": [
    {
      "id": "uuid",
      "code": "EVT-HVAC-001",
      "name": "HVAC System Consultation - Thompson Residence",
      "descr": "Initial consultation...",

      // NEW FIELDS - Returned by API
      "event_action_entity_type": "service",
      "event_action_entity_id": "93106ffb-402e-43a7-8b26-5287e37a1b0e",
      "organizer_employee_id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
      "venue_type": "customer_site",

      // ENRICHED DATA - Names for IDs
      "organizer": {
        "empid": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
        "name": "James Miller",
        "email": "james.miller@huronhome.ca"
      },

      "event_type": "onsite",
      "event_platform_provider_name": "office",
      "event_addr": "123 Main Street, Toronto, ON M4W 1N4",
      "from_ts": "2025-11-14T14:00:00Z",
      "to_ts": "2025-11-14T16:00:00Z"
    }
  ]
}
```

**Pattern**:
- ✅ Returns IDs (`organizer_employee_id`, `event_action_entity_id`)
- ✅ Returns enriched `organizer` object with name/email
- ❌ Does NOT enrich `event_action_entity` with name (should return entity name)

**Missing Enhancement**:
```typescript
// API should also return enriched action entity
"event_action_entity": {
  "type": "service",
  "id": "93106ffb-402e-43a7-8b26-5287e37a1b0e",
  "name": "HVAC System Consultation"  // ← MISSING
}
```

---

### ❌ Frontend Layer (apps/web/src/components/shared/ui/)

#### Problem 1: CalendarEventModal.tsx Still Uses Old Structure

**Current Interface** (OUTDATED):
```typescript
export interface CalendarEvent {
  // OLD FIELDS - No longer match API
  organizers?: Array<{              // ❌ Should be single organizer
    empid: string;
    name: string;
    email: string;
  }>;
  additional_organizers?: Array<{   // ❌ No longer needed
    empid: string;
  }>;

  // MISSING NEW FIELDS
  event_action_entity_type?: never;  // ❌ Not present
  event_action_entity_id?: never;    // ❌ Not present
  organizer_employee_id?: never;     // ❌ Not present
  venue_type?: never;                // ❌ Not present
}
```

**Should Be**:
```typescript
export interface CalendarEvent {
  id?: string;
  code?: string;
  name: string;
  descr?: string;

  // NEW FIELDS (match API)
  event_action_entity_type: 'service' | 'product' | 'project' | 'task' | 'quote';
  event_action_entity_id: string;
  organizer_employee_id?: string;   // ID sent to API
  venue_type?: string;

  // ENRICHED DATA (for display only)
  organizer?: {
    empid: string;
    name: string;
    email: string;
  };
  event_action_entity?: {
    type: string;
    id: string;
    name: string;
  };

  // Standard fields
  event_type: 'onsite' | 'virtual';
  event_platform_provider_name: string;
  event_addr?: string;
  event_instructions?: string;
  from_ts: string;
  to_ts: string;
  timezone?: string;
  event_metadata?: Record<string, any>;

  // Attendees
  attendees?: Array<{
    person_entity_id: string;
    person_entity_type: 'employee' | 'customer';
    person_name?: string;
    event_rsvp_status: 'pending' | 'accepted' | 'declined';
  }>;
}
```

#### Problem 2: UI Shows IDs Instead of Names

**Current Display Issues**:
- ❌ `organizer_employee_id` shown as raw UUID to user
- ❌ `event_action_entity_id` shown as raw UUID to user
- ❌ No dropdown to select organizer by name
- ❌ No dropdown to select event action entity by name

---

## Required Pattern: ID ↔ Name Coherence

### Principle

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  FRONTEND   │         │     API     │         │  DATABASE   │
│   (UI/UX)   │         │             │         │             │
└─────────────┘         └─────────────┘         └─────────────┘
      │                       │                       │
      │  Display Names        │  Send IDs             │  Store IDs
      │  ↓                    │  ↓                    │  ↓
      │  "James Miller"  ──→  │  "8260b1b0..."  ──→   │  organizer_employee_id
      │                       │                       │
      │  "HVAC Service"  ──→  │  "93106ffb..."  ──→   │  event_action_entity_id
      │                       │                       │
      │  Receive IDs + Names  │  Return IDs + Names   │
      │  ←──                  │  ←──                  │
      │                       │                       │
```

### Implementation Requirements

#### 1. UI Display (Read Operations)
```typescript
// ✅ CORRECT: Show names to users
<div>
  <label>Organizer</label>
  <p>{event.organizer?.name || 'Not assigned'}</p>  {/* James Miller */}
</div>

<div>
  <label>Event About</label>
  <p>{event.event_action_entity?.name}</p>  {/* HVAC Service */}
</div>

// ❌ WRONG: Don't show raw IDs
<p>{event.organizer_employee_id}</p>  {/* 8260b1b0-5efc-4611-ad33-ee76c0cf7f13 */}
<p>{event.event_action_entity_id}</p>  {/* 93106ffb-402e-43a7-8b26-5287e37a1b0e */}
```

#### 2. UI Forms (Create/Edit Operations)
```typescript
// ✅ CORRECT: Dropdowns show names, submit IDs
<select
  value={formData.organizer_employee_id}
  onChange={(e) => setFormData({ ...formData, organizer_employee_id: e.target.value })}
>
  {employees.map(emp => (
    <option key={emp.id} value={emp.id}>
      {emp.name}  {/* James Miller */}
    </option>
  ))}
</select>

// API receives:
{
  "organizer_employee_id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",  // ID
  "event_action_entity_id": "93106ffb-402e-43a7-8b26-5287e37a1b0e"  // ID
}
```

#### 3. API Enrichment
```typescript
// API should enrich responses with names
const eventQuery = client`
  SELECT
    e.organizer_employee_id::text,
    e.event_action_entity_id::text,
    e.event_action_entity_type,
    -- Enrich organizer
    (
      SELECT jsonb_build_object(
        'empid', emp.id::text,
        'name', emp.name,
        'email', emp.email
      )
      FROM app.d_employee emp
      WHERE emp.id = e.organizer_employee_id
    ) as organizer,
    -- Enrich event action entity
    (
      SELECT jsonb_build_object(
        'type', e.event_action_entity_type,
        'id', entity.id::text,
        'name', entity.name
      )
      FROM ... -- Join based on event_action_entity_type
    ) as event_action_entity
  FROM app.d_event e
`;
```

---

## Action Items

### 🔴 HIGH PRIORITY - Frontend Updates

1. **Update CalendarEventModal Interface** (`/home/rabin/projects/pmo/apps/web/src/components/shared/ui/CalendarEventModal.tsx`)
   - [ ] Add `event_action_entity_type`, `event_action_entity_id` fields
   - [ ] Replace `organizers[]` with single `organizer_employee_id`
   - [ ] Remove `additional_organizers` field
   - [ ] Add `venue_type` field
   - [ ] Add enriched display objects (`organizer`, `event_action_entity`)

2. **Update Form UI**
   - [ ] Add "Event About" dropdown (service/product/project/task/quote)
   - [ ] Add entity selector based on selected type
   - [ ] Add "Organizer" dropdown showing employee names
   - [ ] Add "Venue Type" dropdown
   - [ ] Ensure form submits IDs, not names

3. **Update Display Components**
   - [ ] Show `organizer.name` instead of `organizer_employee_id`
   - [ ] Show `event_action_entity.name` instead of `event_action_entity_id`
   - [ ] Show `venue_type` as readable label

### 🟡 MEDIUM PRIORITY - API Enhancement

4. **Enrich API Responses** (`/home/rabin/projects/pmo/apps/api/src/modules/event/routes.ts`)
   - [ ] Add `event_action_entity` enriched object to all event queries
   - [ ] Query appropriate table based on `event_action_entity_type`
   - [ ] Return `{ type, id, name }` structure

### 🟢 LOW PRIORITY - Documentation

5. **Update Calendar Documentation**
   - [x] Create CALENDAR_DATA_COHERENCE.md (this file)
   - [ ] Update CALENDAR_MODAL_UPDATE.md with new field requirements
   - [ ] Update API documentation with enriched response structure

---

## Example: Complete Flow

### 1. User Creates Event in UI
```typescript
// User sees and selects:
- Event Name: "HVAC System Consultation"
- Event About: "HVAC Service" (from dropdown)  ← Shows name
- Organizer: "James Miller" (from dropdown)    ← Shows name
- Venue: "Customer Site" (from dropdown)       ← Shows name
- Date/Time: 2025-11-14 14:00

// Form submits to API:
POST /api/v1/event
{
  "name": "HVAC System Consultation",
  "event_action_entity_type": "service",
  "event_action_entity_id": "93106ffb-402e-43a7-8b26-5287e37a1b0e",  ← ID
  "organizer_employee_id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",   ← ID
  "venue_type": "customer_site",
  "from_ts": "2025-11-14T14:00:00Z",
  "to_ts": "2025-11-14T16:00:00Z"
}
```

### 2. API Stores and Returns
```typescript
// API stores in database:
INSERT INTO app.d_event (
  name,
  event_action_entity_id,      -- UUID stored
  organizer_employee_id,        -- UUID stored
  venue_type
) VALUES (
  'HVAC System Consultation',
  '93106ffb-402e-43a7-8b26-5287e37a1b0e',
  '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
  'customer_site'
);

// API returns enriched response:
{
  "id": "...",
  "name": "HVAC System Consultation",
  "event_action_entity_type": "service",
  "event_action_entity_id": "93106ffb-402e-43a7-8b26-5287e37a1b0e",
  "organizer_employee_id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
  "venue_type": "customer_site",

  // ENRICHED DATA (for display)
  "organizer": {
    "empid": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
    "name": "James Miller",
    "email": "james.miller@huronhome.ca"
  },
  "event_action_entity": {
    "type": "service",
    "id": "93106ffb-402e-43a7-8b26-5287e37a1b0e",
    "name": "HVAC Service"
  }
}
```

### 3. UI Displays Event
```typescript
// Calendar shows:
<EventCard>
  <h3>HVAC System Consultation</h3>
  <p>Organizer: James Miller</p>           ← Name from organizer.name
  <p>About: HVAC Service</p>               ← Name from event_action_entity.name
  <p>Location: Customer Site</p>           ← Readable venue_type
  <p>Date: Nov 14, 2025 at 2:00 PM</p>
</EventCard>
```

---

## Validation Checklist

- [ ] Database stores only IDs (no names)
- [ ] API returns IDs + enriched name objects
- [ ] Frontend forms show names in dropdowns
- [ ] Frontend forms submit IDs to API
- [ ] Frontend displays show names (not IDs)
- [ ] No raw UUIDs visible to end users
- [ ] All entity references follow {entity}_id → {entity}_name pattern

---

## Status: ⚠️ INCOMPLETE

**Current State**: Database and API are aligned with new schema, but frontend has not been updated.

**Next Step**: Update CalendarEventModal.tsx and CalendarView.tsx to use new field structure and display names instead of IDs.
