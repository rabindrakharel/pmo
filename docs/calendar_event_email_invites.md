# Calendar Event Email Invites

## Overview

The PMO platform now supports automatic calendar event email invites with full compatibility for **Outlook**, **Gmail**, and **iCloud**. When a calendar event is created for an employee or customer, the system automatically sends them an email with a `.ics` calendar attachment that will block their calendar.

## Features

- ✅ Automatic calendar invite generation in iCalendar (.ics) format
- ✅ Compatible with Outlook, Gmail, and iCloud
- ✅ Blocks recipient calendars automatically
- ✅ Handles cases where email doesn't exist (stores name only)
- ✅ Supports both onsite and virtual meetings
- ✅ Multiple attendees supported
- ✅ Customer and employee support
- ✅ Configurable SMTP settings

## Architecture

### Components

1. **Email Service** (`apps/api/src/modules/email/email.service.ts`)
   - Handles email sending via nodemailer
   - Generates iCalendar (.ics) attachments using ical-generator
   - Supports multiple attendees
   - Gracefully handles missing emails

2. **Event API Routes** (`apps/api/src/modules/event/routes.ts`)
   - CRUD operations for events
   - Automatic calendar invite sending on event creation
   - Manual resend capability

3. **Database Tables**
   - `d_event` - Event master records
   - `d_entity_person_calendar` - Calendar slots linked to events
   - `d_employee` - Employee records with email
   - `d_cust` - Customer records with email

## API Endpoints

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
  "organizer_email": "scheduling@huronhome.ca"
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
    {
      "id": "slot-uuid-1",
      "code": "CAL-EVT-MEETING-001-emp-uuid-1"
    },
    {
      "id": "slot-uuid-2",
      "code": "CAL-EVT-MEETING-001-emp-uuid-2"
    }
  ],
  "invite_results": {
    "totalSent": 3,
    "totalFailed": 0,
    "results": [
      {
        "id": "customer-uuid",
        "success": true
      },
      {
        "id": "employee-uuid-1",
        "success": true
      },
      {
        "id": "employee-uuid-2",
        "success": true
      }
    ]
  }
}
```

### Resend Calendar Invites

**POST /api/v1/event/:id/send-invites**

```json
{
  "organizer_name": "Huron Home Services",
  "organizer_email": "scheduling@huronhome.ca"
}
```

### Get Event with Calendar Slots

**GET /api/v1/event/:id**

Returns event details with all linked calendar slots.

### List All Events

**GET /api/v1/event**

Query parameters:
- `event_medium` - Filter by 'onsite' or 'virtual'
- `event_entity_action` - Filter by action type

### Update Event

**PATCH /api/v1/event/:id**

Update event details (does not automatically resend invites).

### Delete Event

**DELETE /api/v1/event/:id**

Soft deletes the event and cancels all linked calendar slots.

## Email Behavior

### When Email Exists

- ✅ Calendar invite is sent with `.ics` attachment
- ✅ Email includes HTML and plain text versions
- ✅ Event details are embedded in the email body
- ✅ Calendar invitation is attached both as alternative content type and file attachment
- ✅ Recipient's calendar is automatically blocked

### When Email Doesn't Exist

- ⚠️ Event is still created with the person's name
- ⚠️ No email is sent (logged as warning)
- ⚠️ Calendar slot is still created
- ✅ `invite_results` shows `success: false` with reason

### Email Content

**Subject:** `Calendar Invite: [Event Name]`

**Body includes:**
- Event title
- Date and time (formatted for recipient's timezone)
- Location (physical address or meeting URL)
- Description
- Instructions

**Attachments:**
- `invite.ics` - iCalendar file (compatible with all major calendar apps)

## Configuration

### SMTP Settings

Configure in `.env` file:

```bash
# Email/SMTP Configuration
# Used for sending calendar invites and notifications
# For Gmail: smtp.gmail.com, port 587, secure=false (or port 465, secure=true)
# For Outlook: smtp-mail.outlook.com, port 587, secure=false
# For local testing: MailHog (localhost:1025) or Mailpit
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@huronhome.ca
```

### Gmail Setup

1. Enable 2-factor authentication on your Google account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the App Password in `SMTP_PASS`

### Outlook Setup

1. Use your Microsoft account email in `SMTP_USER`
2. Use your account password in `SMTP_PASS`
3. If using 2FA, generate an app password

### Local Testing

For local development, use MailHog or Mailpit:

```bash
# Run MailHog
docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog

# Access web UI at http://localhost:8025
```

## Database Schema

### d_event Table

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

### d_entity_person_calendar Table

```sql
CREATE TABLE app.d_entity_person_calendar (
  id uuid PRIMARY KEY,
  code varchar(50) UNIQUE NOT NULL,
  person_entity_type varchar(50), -- 'employee', 'client', 'customer'
  person_entity_id uuid,
  from_ts timestamptz,
  to_ts timestamptz,
  timezone varchar(50),
  availability_flag boolean,
  title varchar(200),
  appointment_medium varchar(50),
  appointment_addr text,
  event_id uuid, -- Links to d_event.id
  metadata jsonb,
  reminder_sent_flag boolean,
  confirmation_sent_flag boolean,
  active_flag boolean,
  created_ts timestamptz,
  updated_ts timestamptz
);
```

## Usage Examples

### Example 1: Create Onsite Meeting

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
    "organizer_email": "service@huronhome.ca"
  }'
```

### Example 2: Create Virtual Meeting

```bash
curl -X POST http://localhost:4000/api/v1/event \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "code": "EVT-VIRTUAL-001",
    "name": "Project Review Meeting",
    "descr": "Weekly project status review",
    "event_entity_action": "project_review",
    "event_medium": "virtual",
    "event_addr": "https://zoom.us/j/987654321",
    "event_instructions": "Meeting password: 1234",
    "event_metadata": {
      "project_id": "proj-uuid-here",
      "customer_id": "cust-uuid-here",
      "attendee_ids": ["pm-uuid", "lead-uuid"]
    },
    "start_time": "2025-11-12T14:00:00-05:00",
    "end_time": "2025-11-12T15:00:00-05:00",
    "timezone": "America/Toronto",
    "send_invites": true
  }'
```

### Example 3: Manually Resend Invites

```bash
curl -X POST http://localhost:4000/api/v1/event/event-uuid-here/send-invites \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "organizer_name": "Huron Home Services",
    "organizer_email": "scheduling@huronhome.ca"
  }'
```

## Troubleshooting

### Emails Not Sending

1. Check SMTP credentials in `.env`
2. Verify SMTP server is accessible
3. Check API logs for error messages
4. For Gmail, ensure App Password is used (not regular password)

### Calendar Invites Not Appearing

1. Check recipient's spam/junk folder
2. Verify `.ics` attachment is present in email
3. Some email clients may block calendar invites by default
4. Try different email clients (Outlook, Gmail, Apple Mail)

### Missing Attendee Emails

- System will skip sending to attendees without email addresses
- Check `invite_results` in API response for details
- Review API logs for warnings about missing emails

## Future Enhancements

- [ ] Reminder emails (24 hours before event)
- [ ] Event cancellation emails
- [ ] Event update/rescheduling notifications
- [ ] Calendar invite responses (RSVP tracking)
- [ ] Recurring events support
- [ ] Timezone conversion for international events
- [ ] Email template customization
- [ ] Batch event creation

## Related Documentation

- [Person Calendar API](../apps/api/src/modules/person-calendar/routes.ts) - Calendar slot management
- [Booking API](../apps/api/src/modules/booking/routes.ts) - Service appointment booking
- [Email Template System](./email_template.md) - Custom email templates
- [SMTP Configuration](../.env.example) - Environment setup

## Support

For issues or questions:
1. Check API logs: `./tools/logs-api.sh`
2. Review database: Check `d_event` and `d_entity_person_calendar` tables
3. Test email: Use MailHog locally to verify email generation
4. Verify SMTP: Test SMTP credentials independently

---

**Last Updated:** 2025-11-06
**Version:** 1.0
**Status:** Production Ready
