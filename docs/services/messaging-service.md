# Messaging Service

> **Calendar event notification orchestration across email, SMS, and push channels**

**File**: `apps/api/src/modules/person-calendar/messaging.service.ts`
**Type**: Communication Service
**Pattern**: Multi-Channel Notification

---

## Purpose

Orchestrates calendar event notifications (invitations, updates, reminders, cancellations) across multiple delivery channels with template rendering and scheduling support.

---

## Where Used

### Person Calendar Module

| Event Type | Trigger | Notification Sent |
|------------|---------|-------------------|
| **Event Created** | New calendar event | Invitation to all attendees |
| **Event Updated** | Event details changed | Update notification |
| **Event Cancelled** | Event deleted | Cancellation notification |
| **Reminder** | X minutes before event | Reminder notification |
| **RSVP Response** | Attendee responds | Confirmation to organizer |

### Integration Points

- **Person Calendar Service** - Event lifecycle triggers
- **Email Service** - Email delivery
- **Delivery Service** - Multi-channel orchestration
- **Message Schema** - Notification templates

---

## How It Works (Building Blocks)

### Block 1: Event-Driven Notification Triggers

**Event Lifecycle**:
1. **Event Created** → Send invitations
2. **Event Updated** → Send update notifications
3. **Event Cancelled** → Send cancellation notifications
4. **Reminder Time** → Send reminder notifications
5. **RSVP Received** → Send confirmation

**Trigger Points**:
- `POST /api/v1/event` → Creates event → Triggers invitations
- `PATCH /api/v1/event/:id` → Updates event → Triggers update notifications
- `DELETE /api/v1/event/:id` → Cancels event → Triggers cancellations
- Scheduled job → Checks upcoming events → Triggers reminders

### Block 2: Notification Template Selection

**Template Types**:
- `calendar_invitation` - New event invitation
- `calendar_update` - Event details changed
- `calendar_cancellation` - Event cancelled
- `calendar_reminder` - Upcoming event reminder
- `calendar_rsvp_confirmation` - RSVP acknowledgment

**Template Loading**:
1. Identify notification type
2. Query `d_message_schema` for template
3. Load HTML and plain text versions
4. Extract variable placeholders

**Template Variables**:
- `{{event_title}}` - Event name
- `{{event_start}}` - Start date/time
- `{{event_end}}` - End date/time
- `{{event_location}}` - Location
- `{{organizer_name}}` - Event organizer
- `{{attendee_name}}` - Recipient name
- `{{rsvp_accept_url}}` - Accept RSVP link
- `{{rsvp_decline_url}}` - Decline RSVP link

### Block 3: Attendee Resolution

**Flow**:
1. **Query event** from `d_entity_event`
2. **Query attendees** from `d_entity_event_person_link`
3. **Resolve person details** from `employee` or `d_client`
4. **Extract email addresses** for notification
5. **Filter** based on RSVP status (optional)

**Attendee Types**:
- **Organizer** - Event creator (always notified)
- **Required Attendees** - Must attend
- **Optional Attendees** - Can attend
- **External Attendees** - Outside organization

### Block 4: Multi-Channel Delivery

**Channel Selection**:
- **Email** - Default channel (all notifications)
- **SMS** - Optional (reminders only)
- **Push** - Optional (mobile app notifications)

**Delivery Priority**:
1. **Immediate** - Invitations, cancellations
2. **Scheduled** - Reminders (X minutes before event)
3. **Batched** - Digest notifications (future)

**Channel Fallback**:
- Email delivery failed → Retry
- SMS delivery failed → Email fallback
- Push delivery failed → Email fallback

### Block 5: Calendar Attachment (iCal)

**iCal Generation**:
1. Create `.ics` file with event details
2. Include VTIMEZONE, VEVENT components
3. Add attendees, organizer, location
4. Set alarm/reminder times
5. Attach to email

**iCal Benefits**:
- One-click "Add to Calendar" in email
- Syncs with Google Calendar, Outlook, Apple Calendar
- Automatic timezone conversion
- Reminder management

**Format**:
```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//PMO Platform//EN
BEGIN:VEVENT
UID:event-uuid
DTSTART:20250120T140000Z
DTEND:20250120T150000Z
SUMMARY:Project Kickoff
LOCATION:Office A
ORGANIZER:mailto:organizer@huronhome.ca
ATTENDEE:mailto:attendee@huronhome.ca
END:VEVENT
END:VCALENDAR
```

---

## Operational Flow

### Send Event Invitation

**Sequence**:
1. **Person Calendar Service** creates event
2. **Messaging Service** triggered
3. **Load template** `calendar_invitation`
4. **Resolve attendees** from event
5. **For each attendee**:
   - Render template with attendee-specific variables
   - Generate iCal attachment
   - Call Email Service with rendered content
6. **Track** delivery status
7. **Return** summary (sent, failed)

**Attendee-Specific Rendering**:
- `{{attendee_name}}` personalized per recipient
- `{{rsvp_accept_url}}` unique per attendee (tracking)
- `{{rsvp_decline_url}}` unique per attendee

### Send Event Update Notification

**Sequence**:
1. **Person Calendar Service** updates event
2. **Detect changes** (title, time, location)
3. **Messaging Service** triggered with change summary
4. **Load template** `calendar_update`
5. **Inject** change details into template
   - "Title changed from X to Y"
   - "Time changed from X to Y"
6. **Send** to all attendees
7. **Attach** updated iCal file

### Send Event Cancellation

**Sequence**:
1. **Person Calendar Service** soft-deletes event
2. **Messaging Service** triggered
3. **Load template** `calendar_cancellation`
4. **Send** to all attendees
5. **Attach** cancellation iCal (STATUS:CANCELLED)
6. **Calendar apps** remove event automatically

### Send Event Reminder

**Sequence** (scheduled job):
1. **Cron job** checks upcoming events
2. **Query** events starting in X minutes
3. **For each event**:
   - Load template `calendar_reminder`
   - Send to organizer and attendees
   - Mark reminder as sent (prevent duplicates)
4. **Track** delivery

**Reminder Timing**:
- 15 minutes before event
- 1 hour before event
- 1 day before event
- Configurable per event

---

## Key Design Principles

### 1. Event-Driven Architecture

**Why**:
- Decouples calendar logic from notification logic
- Scales independently
- Easy to add new notification types

**Implementation**:
- Person Calendar Service emits events
- Messaging Service listens and acts

### 2. Template-Based Notifications

**Why**:
- Consistent branding
- Easy content updates (no code changes)
- Multi-language support (future)

**Template Storage**:
- `d_message_schema` table
- Version control
- A/B testing support

### 3. Multi-Channel Support

**Why**:
- Reach users on preferred channel
- Fallback for delivery failures
- Urgency-based channel selection

**Channels**:
- Email (default)
- SMS (high-priority)
- Push (mobile app)

### 4. iCal Attachment

**Why**:
- Seamless calendar integration
- One-click add to calendar
- Cross-platform support

**Benefits**:
- Auto-syncs with user's calendar
- Timezone handling automatic
- RSVP tracking built-in

---

## Dependencies

### Services

- **Email Service** - Email delivery
- **Delivery Service** - Multi-channel orchestration
- **Person Calendar Service** - Event data

### Database Tables

- **d_entity_event** - Event details
- **d_entity_event_person_link** - Attendee relationships
- **employee** - Employee data
- **d_client** - Customer data
- **d_message_schema** - Notification templates
- **f_message** - Delivery tracking

### Libraries

- **ical-generator** - iCal file creation
- **Handlebars** - Template rendering (or similar)

---

## Configuration

### Notification Settings

```
CALENDAR_REMINDER_ENABLED=true
CALENDAR_REMINDER_DEFAULT_MINUTES=15
CALENDAR_INVITATION_FROM=noreply@huronhome.ca
```

### Template Configuration

- Templates stored in `d_message_schema`
- Template codes: `calendar_invitation`, `calendar_update`, etc.
- HTML and plain text versions required

---

## Security Considerations

### Attendee Privacy

- Only send notifications to confirmed attendees
- Don't leak attendee list to external participants
- RSVP links unique and non-guessable

### RSVP Link Security

- Signed tokens in RSVP URLs
- Expiration time (30 days)
- One-time use tokens (prevent replay)

### Email Spoofing Prevention

- DKIM signing (via SES)
- SPF records configured
- Sender email verified

---

## Error Scenarios

### Attendee Email Missing

**Scenario**: Attendee has no email in system
**Handling**: Skip attendee, log warning
**Solution**: Require email on person records

### Template Not Found

**Scenario**: Message schema missing for notification type
**Handling**: Use fallback template or plain text
**Solution**: Ensure all templates created

### Email Delivery Failed

**Scenario**: Email bounces or SES error
**Handling**: Log failure, retry once
**Solution**: Mark attendee as undeliverable

### iCal Generation Failed

**Scenario**: Invalid event data
**Handling**: Send email without iCal attachment
**Solution**: Validate event data before notification

---

## Performance Considerations

### Batch Processing

- Send notifications in batches (50 per batch)
- Avoid overwhelming SES rate limits
- Use background queue for large events (100+ attendees)

### Async Delivery

- Don't block calendar API response
- Offload to background job queue
- Return immediately after queuing

### Caching

- Cache templates (avoid repeated DB queries)
- Cache attendee lists (event unchanged)
- Invalidate on template/event updates

---

## Monitoring & Alerts

### Metrics

- **Invitations Sent**: Per event, per day
- **Delivery Rate**: % successfully delivered
- **RSVP Rate**: % attendees who responded
- **Reminder Rate**: % reminders sent on time

### Alerts

- Delivery rate < 95% → Investigate email issues
- RSVP rate < 20% → Review invitation content
- Reminder delay > 5 minutes → Check cron job

---

## Future Enhancements

### SMS Notifications

- Integrate Twilio or AWS SNS
- Send SMS reminders for high-priority events
- Opt-in preference per user

### Push Notifications

- Mobile app push notifications
- Real-time event updates
- Silent push for calendar sync

### Smart Reminders

- Machine learning for optimal reminder timing
- User preference learning
- Timezone-aware reminders

### Multi-Language Support

- Detect user's preferred language
- Load locale-specific templates
- Automatic translation

---

## Version History

- **v1.0.0**: Initial calendar notification support
- **Pattern**: Event-driven, template-based
- **Adoption**: Person Calendar module

---

**File Location**: `apps/api/src/modules/person-calendar/messaging.service.ts`
**Documentation**: This file
**Related**: `docs/services/email-service.md`, `docs/PERSON_CALENDAR_SYSTEM.md`
