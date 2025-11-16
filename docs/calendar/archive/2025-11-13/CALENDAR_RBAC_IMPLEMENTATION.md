# Calendar System with RBAC-Based Organizers

## Overview

The PMO Calendar System has been enhanced to properly handle event organizers and attendees using the existing RBAC (Role-Based Access Control) system. This implementation provides a clear distinction between organizers and attendees while supporting multiple organizers per event.

## Key Design Decisions

### 1. Organizers via RBAC Permission[5]
- **No organizer_id field**: Events don't have a dedicated organizer field in the database
- **RBAC Permission[5]**: Organizers are tracked via `d_entity_rbac` where permission array contains position [5]
- **Multiple Organizers**: Multiple employees can have organizer status for the same event
- **Full Control**: Organizers have complete control including permission management

### 2. Data Model Structure

#### Events (d_event)
- Stores event details: what, when, where
- `from_ts` and `to_ts` define event time range
- No explicit organizer field - uses RBAC instead

#### Event-Person Mapping (d_entity_event_person_calendar)
- Links people to events with RSVP status
- Tracks both organizers and regular attendees
- RSVP statuses: pending, accepted, declined

#### RBAC Mapping (d_entity_rbac)
- Permission[5] = Organizer status
- Full permissions array: [0,1,2,3,4,5] = [View, Edit, Share, Delete, Create, Owner/Organizer]

## API Implementation

### Event Creation with Organizers

```javascript
POST /api/v1/event
{
  "code": "EVT-MEETING-001",
  "name": "Team Planning Meeting",
  "descr": "Quarterly planning session",
  "event_type": "virtual",
  "event_platform_provider_name": "teams",
  "event_addr": "https://teams.microsoft.com/meeting",
  "from_ts": "2025-11-14T10:00:00Z",
  "to_ts": "2025-11-14T11:00:00Z",
  "additional_organizers": [
    { "empid": "employee-uuid-1" },
    { "empid": "employee-uuid-2" }
  ],
  "attendees": [
    {
      "person_entity_type": "employee",
      "person_entity_id": "employee-uuid-3",
      "event_rsvp_status": "pending"
    }
  ]
}
```

### Enriched Events API

```javascript
GET /api/v1/event/enriched
// Returns events with:
// - organizers: Array of employees with permission[5]
// - attendees: Array from d_entity_event_person_calendar with RSVP status
```

## Business Logic

### Event Creation Flow
1. Create event in `d_event`
2. Grant permission[5] to creator (automatic organizer)
3. Grant permission[5] to additional organizers if specified
4. Add all organizers as attendees with "accepted" RSVP
5. Add regular attendees with specified RSVP status

### Organizer Identification
- Query `d_entity_rbac` where:
  - entity = 'event'
  - entity_id = event.id
  - permission contains [5]

## UI/UX Guidelines

### Event Creation/Edit Modal

The enhanced CalendarEventModal should have three distinct sections:

#### 1. Event Details Section
- Event name, description
- Date/time range
- Location (physical address or virtual meeting URL)
- Event type (onsite/virtual)
- Platform/venue selection

#### 2. Organizer Section
- Primary organizer (defaults to current user)
- Additional organizers (can select multiple employees)
- Organizers automatically get:
  - Permission[5] (full control)
  - Attendee entry with "accepted" RSVP

#### 3. Attendees Section with RSVP
- List of attendees (employees and customers)
- RSVP status for each (pending/accepted/declined)
- Visual indicators:
  - ✓ Accepted (green)
  - ⏳ Pending (yellow)
  - ✗ Declined (red)
- RSVP summary showing counts

## Calendar View Integration

### Routes
- `/calendar` - Main calendar view (defaults to calendar view)
- `/calendar/new` - Create new event
- `/calendar/:id` - View event details

### Display Requirements
- Show organizer(s) with special indicator (crown icon)
- Display attendee count and RSVP status
- Color coding for different event types
- Time slots from event's from_ts/to_ts

## Database Queries

### Get Event Organizers
```sql
SELECT
  r.empid,
  e.name,
  e.email
FROM d_entity_rbac r
JOIN d_employee e ON r.empid = e.id
WHERE r.entity = 'event'
  AND r.entity_id = :event_id
  AND r.permission @> ARRAY[5];
```

### Get Event with Full Details
```sql
SELECT
  e.*,
  (
    SELECT array_agg(
      jsonb_build_object(
        'empid', r.empid::text,
        'name', emp.name,
        'email', emp.email
      )
    )
    FROM d_entity_rbac r
    LEFT JOIN d_employee emp ON r.empid = emp.id
    WHERE r.entity = 'event'
      AND r.entity_id = e.id::text
      AND r.permission @> ARRAY[5]
  ) as organizers
FROM d_event e;
```

## Benefits of RBAC Approach

1. **No Schema Changes**: Uses existing RBAC system
2. **Multiple Organizers**: Supports co-organizers naturally
3. **Permission Consistency**: Aligns with platform-wide permission model
4. **Audit Trail**: RBAC tracks who granted permissions
5. **Flexibility**: Can easily add different permission levels

## Migration Notes

For existing events without RBAC organizers:
1. Events created before this implementation will have null organizers
2. Can retroactively assign organizers via RBAC updates
3. Legacy events still function with attendees only

## Testing Checklist

- [x] Create event with single organizer
- [x] Create event with multiple organizers
- [x] Verify organizers have permission[5]
- [x] Verify organizers appear as accepted attendees
- [x] Test enriched API returns organizers correctly
- [x] Test calendar view displays organizers distinctly
- [x] Verify RSVP status updates work
- [x] Test with both employees and customers as attendees

## Future Enhancements

1. **Co-host Permissions**: Different permission levels for co-organizers
2. **Delegation**: Allow organizers to delegate to others
3. **Recurring Events**: Support for recurring meetings
4. **Meeting Templates**: Save common meeting configurations
5. **Notification System**: Email/SMS invites with .ics attachments

---

**Implementation Date**: November 2025
**Version**: 1.0.0
**Status**: Production Ready