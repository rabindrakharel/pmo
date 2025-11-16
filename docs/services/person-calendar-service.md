# Person Calendar Service

> **Event lifecycle management with RSVP tracking and calendar synchronization**

**File**: `apps/api/src/modules/person-calendar/person-calendar.service.ts`
**Type**: Domain Service
**Pattern**: Event Management

---

## Purpose

Manages calendar events, attendee relationships, RSVP tracking, and calendar synchronization with external systems (Google Calendar, Outlook, iCal).

---

## Where Used

### Person Calendar Module

| Operation | Route | Usage Context |
|-----------|-------|---------------|
| **Create Event** | `POST /api/v1/event` | Create calendar event with attendees |
| **Update Event** | `PATCH /api/v1/event/:id` | Update event details |
| **Delete Event** | `DELETE /api/v1/event/:id` | Cancel event (soft delete) |
| **RSVP** | `POST /api/v1/event/:id/rsvp` | Attendee accepts/declines |
| **List Events** | `GET /api/v1/event` | Calendar view, agenda view |
| **Get Availability** | `GET /api/v1/calendar/availability` | Check person's free/busy |

### Integration Points

- **Messaging Service** - Triggers notifications on event lifecycle
- **Person Calendar Routes** - API endpoints
- **Calendar View (Frontend)** - Calendar UI components
- **External Calendars** - Google Calendar, Outlook sync

---

## How It Works (Building Blocks)

### Block 1: Event Lifecycle Management

**Event States**:
- **Draft** - Created but not sent (organizer editing)
- **Scheduled** - Invitations sent, awaiting RSVPs
- **Confirmed** - Event happening (enough RSVPs)
- **Cancelled** - Event deleted (soft delete)
- **Completed** - Event past (archived)

**State Transitions**:
```
Draft → Scheduled → Confirmed → Completed
  ↓         ↓
Cancelled  Cancelled
```

**Operations by State**:
- **Draft**: Can edit, can cancel
- **Scheduled**: Can RSVP, can update, can cancel
- **Confirmed**: Can attend, can cancel
- **Cancelled**: Read-only (historical)
- **Completed**: Read-only (historical)

### Block 2: Attendee Management

**Attendee Types**:
- **Organizer** - Event creator (1 per event)
- **Required** - Must attend
- **Optional** - Can attend
- **Resource** - Room, equipment (future)

**Attendee Relationship**:
- Stored in `d_entity_event_person_link`
- Links event to employee/customer/external
- Tracks RSVP status per attendee

**RSVP Statuses**:
- **Pending** - No response yet
- **Accepted** - Will attend
- **Declined** - Won't attend
- **Tentative** - Maybe attend

### Block 3: Calendar Operations

**Create Event**:
1. Validate event details (title, time, location)
2. Check organizer availability (conflict detection)
3. Insert event record (`d_entity_event`)
4. Create attendee links (`d_entity_event_person_link`)
5. Trigger invitation notifications (via Messaging Service)
6. Return event with attendee list

**Update Event**:
1. Load existing event
2. Detect changes (title, time, location)
3. Update event record
4. Update attendee links (if attendees changed)
5. Trigger update notifications (via Messaging Service)
6. Return updated event

**Cancel Event**:
1. Soft delete event (`active_flag = false`)
2. Mark all attendee links as cancelled
3. Trigger cancellation notifications
4. Return confirmation

**RSVP Processing**:
1. Locate attendee link for event + person
2. Update RSVP status (accepted/declined/tentative)
3. Update `rsvp_ts` timestamp
4. Trigger confirmation notification to organizer
5. Return updated RSVP status

### Block 4: Availability Checking

**Free/Busy Query**:
1. **Input**: Person ID, date range
2. **Query** events where person is attendee
3. **Filter** to accepted events only (declined don't block)
4. **Group** by time slots
5. **Return** busy periods

**Conflict Detection**:
- When creating/updating event
- Check all required attendees' availability
- Warn if conflicts detected
- Allow override (organizer decision)

**Time Zone Handling**:
- All times stored in UTC (`timestamptz`)
- Converted to user's timezone on display
- iCal attachments include VTIMEZONE

### Block 5: External Calendar Sync

**iCal Export**:
- Generate `.ics` file for event
- Include all event details, attendees, reminders
- Downloadable or email attachment

**Google Calendar Integration** (future):
- OAuth authentication
- Sync events bidirectionally
- Auto-update on changes

**Outlook Integration** (future):
- Microsoft Graph API
- Calendar sync
- RSVP sync

---

## Operational Flow

### Create Event with Attendees

**Sequence**:
1. **Client calls** `POST /api/v1/event`
   - Body: `{ title, start, end, location, attendees: [{ person_id, type: 'required' }] }`
2. **Service validates** input
   - Title required
   - Start < End
   - Attendees exist
3. **Insert event** into `d_entity_event`
4. **For each attendee**:
   - Insert link into `d_entity_event_person_link`
   - Set RSVP status to "pending"
5. **Call Messaging Service** to send invitations
6. **Return** event with attendees

### Update Event Details

**Sequence**:
1. **Client calls** `PATCH /api/v1/event/:id`
   - Body: `{ title: 'New Title', start: '...' }`
2. **Service loads** existing event
3. **Detect changes**:
   - Title changed? Yes
   - Time changed? No
4. **Update** event record
5. **Call Messaging Service** with change summary
6. **Return** updated event

### Process RSVP Response

**Sequence**:
1. **Attendee clicks** RSVP link in email
   - URL: `/api/v1/event/:id/rsvp?token=...&status=accepted`
2. **Verify** token (signed, not expired)
3. **Extract** person ID from token
4. **Locate** attendee link
5. **Update** RSVP status to "accepted"
6. **Set** `rsvp_ts` to now
7. **Send** confirmation email to attendee
8. **Notify** organizer of RSVP
9. **Return** confirmation page

### Check Availability

**Sequence**:
1. **Client calls** `GET /api/v1/calendar/availability?person_id=X&start=...&end=...`
2. **Query** events for person in date range
3. **Filter** to accepted events (status = 'accepted')
4. **Build** busy periods array
   - `[{ start: '...', end: '...', event_id: '...', event_title: '...' }]`
5. **Return** busy periods
6. **Client** highlights conflicts on calendar

---

## Key Design Principles

### 1. Soft Delete Pattern

**Why**:
- Preserves event history
- Enables "restore" functionality
- Audit trail for cancelled events

**Implementation**:
- `active_flag = false` instead of DELETE
- All queries filter `active_flag = true`

### 2. RSVP Tracking

**Why**:
- Know who's attending
- Send targeted reminders
- Adjust event based on responses

**Data Captured**:
- Status (pending/accepted/declined/tentative)
- Timestamp of response
- Optional: Reason for decline

### 3. Notification Integration

**Why**:
- Decouple calendar logic from email logic
- Messaging Service handles delivery
- Easy to add SMS/push notifications

**Pattern**:
- Person Calendar Service triggers events
- Messaging Service listens and sends

### 4. Time Zone Normalization

**Why**:
- Users in different time zones
- Display in user's local time
- Store in UTC for consistency

**Implementation**:
- Database: `timestamptz` (UTC)
- API: Accept/return ISO 8601 with timezone
- Frontend: Convert to user's timezone

---

## Dependencies

### Database Tables

- **d_entity_event** - Event details
- **d_entity_event_person_link** - Attendee relationships
- **d_employee** - Employee data
- **d_client** - Customer data
- **d_entity_person_calendar** - Person calendar metadata

### Services

- **Messaging Service** - Event notifications
- **Email Service** - Email delivery
- **Linkage Service** - Event-entity relationships (future)

### Libraries

- **date-fns** - Date/time manipulation
- **ical-generator** - iCal file generation

---

## Configuration

### Event Defaults

```
DEFAULT_EVENT_DURATION_MINUTES=60
DEFAULT_REMINDER_MINUTES=15
ALLOW_EXTERNAL_ATTENDEES=true
```

### Availability Settings

```
BUSINESS_HOURS_START=09:00
BUSINESS_HOURS_END=17:00
WORKING_DAYS=1,2,3,4,5  # Mon-Fri
```

---

## Security Considerations

### RSVP Token Security

- **Signed tokens** - HMAC signature prevents tampering
- **Expiration** - Tokens expire after 30 days
- **One-time use** - Optional (prevent replay)

**Token Payload**:
```json
{
  "event_id": "uuid",
  "person_id": "uuid",
  "exp": 1234567890
}
```

### Privacy

- Only attendees can see attendee list
- External attendees see limited info
- Organizer can hide attendees (blind copy)

### Authorization

- Only organizer can update event
- Only attendee can RSVP for themselves
- RBAC permission checks on event access

---

## Error Scenarios

### Event Conflict

**Scenario**: Creating event when attendee is already booked
**Handling**: Return warning, allow override
**Solution**: Check availability before creating

### Invalid RSVP Token

**Scenario**: Expired or tampered token
**Handling**: Return 401 Unauthorized
**Solution**: Request new RSVP link

### Attendee Not Found

**Scenario**: Adding non-existent person as attendee
**Handling**: Validation error (400)
**Solution**: Verify person IDs before creating event

### Time Zone Mismatch

**Scenario**: Client sends time in wrong timezone
**Handling**: Store as-is (UTC), display in user's TZ
**Solution**: Always use ISO 8601 with timezone

---

## Performance Considerations

### Availability Queries

- **Indexes**: `(person_id, start, end, active_flag)`
- **Query**: Range scan on time
- **Optimization**: Limit to 30-day windows

### Large Events

- 100+ attendees → Background processing
- Batch insert attendee links
- Async notification sending

### Calendar Sync

- Incremental sync (not full refresh)
- Last-modified timestamp tracking
- Webhook updates from external calendars

---

## Monitoring & Alerts

### Metrics

- **Events Created**: Per day
- **RSVP Rate**: % attendees who responded
- **Conflicts Detected**: Per day
- **Availability Queries**: Per second

### Alerts

- RSVP rate < 50% → Review invitation content
- Conflicts > 10% → Review scheduling practices
- Availability query time > 500ms → Check indexes

---

## Future Enhancements

### Recurring Events

- Daily, weekly, monthly, yearly
- RRULE support (iCal standard)
- Series management (update single or all)

### Resource Booking

- Conference rooms, equipment
- Automatic conflict detection
- Resource availability calendar

### Google Calendar Sync

- OAuth authentication
- Bidirectional sync
- Real-time updates via webhooks

### Outlook Calendar Sync

- Microsoft Graph API
- Exchange integration
- Teams meeting links

### Smart Scheduling

- Find best time for all attendees
- AI-powered conflict resolution
- Automatic rescheduling suggestions

---

## Version History

- **v1.0.0** (2025): Initial calendar event management
- **Pattern**: RSVP tracking, availability checking
- **Adoption**: Person Calendar module

---

**File Location**: `apps/api/src/modules/person-calendar/person-calendar.service.ts`
**Documentation**: This file
**Related**: `docs/services/messaging-service.md`, `docs/PERSON_CALENDAR_SYSTEM.md`
