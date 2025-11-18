# Messaging Service - Complete Guide

**Version:** 2.0.0
**Last Updated:** 2025-11-12
**Status:** Production Ready

## Overview

The **Messaging Service** is a universal notification platform that delivers messages via:
- **Email** (AWS SES) - Marketing emails and notifications
- **SMS** (AWS SNS) - Text notifications and reminders
- **Push Notifications** (Firebase FCM - Future)
- **Calendar Invites** (.ics files) - Handled by Person-Calendar system (separate from messaging)

### Key Features

✅ **Multi-Provider Architecture** - Clean provider abstraction (SNS, SES, FCM)
✅ **Automatic Delivery** - Messages send immediately via AWS on creation
✅ **Status Tracking** - Real-time delivery status (pending → sent → delivered/failed)
✅ **Retry Logic** - Automatic retry for failed messages with configurable limits
✅ **Template System** - JSONB-based templates with variable interpolation (internal use)
✅ **Entity Integration** - Messages tracked as entities with RBAC support
✅ **MCP Tools** - AI chat can send messages automatically

### Architecture Distinction

**Two Separate Systems:**

1. **Marketing/Notification Messages** (this document)
   - Stored in `f_message_data` (fact table)
   - Templates in `d_message_schema` (internal storage, not user-facing)
   - Use case: Appointment reminders, marketing campaigns, notifications
   - Delivery: AWS SES (Email), AWS SNS (SMS)

2. **Calendar Invites (.ics files)** (see Person-Calendar System docs)
   - Stored in `d_entity_person_calendar` + `d_entity_event_person_calendar`
   - Use case: Meeting invitations, event RSVP
   - Delivery: Direct email with .ics attachment
   - **Not stored in message_schema** - Generated on-the-fly

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (Fastify)                      │
│  POST /api/v1/message-data → Send Message                  │
│  POST /api/v1/message-data/:id/retry → Retry Failed        │
│  GET /api/v1/message-data → List Messages                  │
│  (message-schema endpoints internal only, no UI)           │
└──────────────────┬────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│         MessageDataService (service.ts)                     │
│  • sendMessage() - Create record + deliver to AWS           │
│  • retryMessage() - Retry failed delivery                   │
│  • deliverMessage() - Route to provider                     │
│  • renderEmailBody() - Template interpolation               │
└──────────────────┬────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│      MessageDeliveryService (delivery.service.ts)           │
│  • sendSMS() - Route to SNS                                 │
│  • sendEmail() - Route to SES                               │
│  • sendPush() - Route to FCM (future)                       │
│  • validateRecipient() - Format validation                  │
└──────────────────┬────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┬──────────────┐
        ▼                     ▼              ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ SNSProvider  │   │ SESProvider  │   │ FCMProvider  │
│ (SMS)        │   │ (Email)      │   │ (Push)       │
│              │   │              │   │  [Future]    │
└──────┬───────┘   └──────┬───────┘   └──────────────┘
       │                  │
       ▼                  ▼
┌──────────────┐   ┌──────────────┐
│   AWS SNS    │   │   AWS SES    │
│ (SMS Delivery│   │(Email Delivery│
└──────────────┘   └──────────────┘
```

---

## Database Schema

### Tables

**1. d_message_schema (Templates - Internal Use Only)**

> ⚠️ **NOT A USER-FACING ENTITY**
> Templates are managed internally via API only. No frontend UI exists.
> Removed from `d_entity` table (active_flag=false).

```sql
-- Email/SMS/Push templates with JSONB schema
id                      uuid PRIMARY KEY
code                    varchar(50) UNIQUE
name                    varchar(200)
message_delivery_method varchar(20)  -- EMAIL | SMS | PUSH
status                  varchar(20)  -- draft | published | archived
subject                 varchar(500) -- Email only
template_schema         jsonb        -- Template structure
from_name, from_email   varchar      -- Email sender
sms_sender_id           varchar(20)  -- SMS sender
push_priority, push_ttl int          -- Push config
from_ts, to_ts          timestamptz  -- SCD Type 2 temporal
active_flag             boolean
created_ts, updated_ts  timestamptz
version                 int
```

**Purpose:** Store reusable marketing email/SMS templates with variable placeholders.

**Access:** Internal API only (`/api/v1/message-schema`), no frontend routes.

**Examples:**
- Appointment reminder SMS template
- Welcome email template
- Password reset email template

**2. f_message_data (Sent Messages - User-Facing Entity)**

> ✅ **USER-FACING ENTITY**
> Registered in `d_entity` as `message` entity.
> Frontend UI: `/message` (list), `/message/:id` (details)

```sql
-- Actual sent/scheduled messages (fact table)
id                      uuid PRIMARY KEY
message_schema_id       uuid         -- Optional link to template
code                    varchar(50)
name                    varchar(200)
message_delivery_method varchar(20)  -- EMAIL | SMS | PUSH
status                  varchar(20)  -- pending | sent | delivered | failed | scheduled
template_schema         jsonb        -- Copy of template used
content_data            jsonb        -- Personalized variables + delivery metadata
recipient_email         varchar(255)
recipient_phone         varchar(50)
recipient_device_token  varchar(500)
recipient_name          varchar(200)
recipient_entity_id     uuid         -- Link to customer/employee
scheduled_ts            timestamptz  -- When to send (future)
sent_ts                 timestamptz  -- When sent to AWS
delivered_ts            timestamptz  -- When delivered by AWS
error_code              varchar(50)
error_message           text
retry_count             int DEFAULT 0
max_retries             int DEFAULT 3
from_ts, to_ts          timestamptz  -- SCD Type 2 temporal
active_flag             boolean
created_ts, updated_ts  timestamptz
metadata                jsonb        -- Additional context
```

**Purpose:** Track all sent/scheduled messages with delivery status.

**Access:**
- API: `/api/v1/message-data`
- Frontend: `/message` (entity route)
- RBAC: Requires `message` entity permissions

---

## API Endpoints

### Send Message (POST /api/v1/message-data)

**Request:**
```json
{
  "message_schema_id": "b2222222-2222-2222-2222-222222222222",
  "content_data": {
    "recipient": "+14165551234",
    "recipientName": "John Doe",
    "variables": {
      "firstName": "John",
      "serviceType": "HVAC",
      "date": "Nov 15",
      "time": "2:00 PM"
    }
  },
  "recipient_phone": "+14165551234",
  "recipient_name": "John Doe",
  "metadata": {
    "event_id": "evt-uuid-123"
  }
}
```

**Response:**
```json
{
  "id": "msg-uuid-456",
  "code": "SMS_APT001",
  "status": "sent",
  "delivery_status": "sent",
  "provider_message_id": "sns-message-id-abc123",
  "sent_ts": "2025-11-12T20:30:00Z"
}
```

**Status Codes:**
- `201` - Message sent successfully
- `403` - Insufficient RBAC permissions
- `404` - Message schema not found
- `500` - Delivery failed (check error_message)

### Retry Failed Message (POST /api/v1/message-data/:id/retry)

**Response:**
```json
{
  "success": true,
  "message": "Message retry successful",
  "delivery_status": "sent",
  "provider_message_id": "sns-new-message-id"
}
```

### List Messages (GET /api/v1/message-data)

**Query Params:**
```
?message_delivery_method=SMS
&status=sent
&recipient_phone=+14165551234
&page=1
&limit=20
```

**Response:**
```json
{
  "data": [
    {
      "id": "msg-uuid",
      "name": "SMS Appointment Reminder",
      "message_delivery_method": "SMS",
      "status": "delivered",
      "recipient_phone": "+14165551234",
      "recipient_name": "John Smith",
      "sent_ts": "2025-11-10T14:30:00Z",
      "delivered_ts": "2025-11-10T14:30:05Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

---

## Usage Examples

### 1. Send SMS Appointment Reminder

```bash
./tools/test-api.sh POST /api/v1/message-data '{
  "message_schema_id": "b2222222-2222-2222-2222-222222222222",
  "content_data": {
    "recipient": "+14165551234",
    "variables": {
      "firstName": "John",
      "serviceType": "Plumbing",
      "date": "Nov 15, 2025",
      "time": "2:00 PM",
      "address": "123 Main St"
    }
  },
  "recipient_phone": "+14165551234",
  "recipient_name": "John Smith"
}'
```

**Interpolated SMS:**
```
Hi John, this is a reminder that your Plumbing appointment is
scheduled for Nov 15, 2025 at 2:00 PM. Location: 123 Main St.
Reply CONFIRM to confirm or CANCEL to reschedule.
- Huron Home Services
```

### 2. Send Email Confirmation

```bash
./tools/test-api.sh POST /api/v1/message-data '{
  "message_schema_id": "a1111111-1111-1111-1111-111111111111",
  "content_data": {
    "recipient": "customer@example.com",
    "variables": {
      "firstName": "Jane",
      "customerName": "Jane Smith"
    }
  },
  "recipient_email": "customer@example.com",
  "recipient_name": "Jane Smith"
}'
```

### 3. Retry Failed Message

```bash
./tools/test-api.sh POST /api/v1/message-data/msg-uuid-456/retry
```

### 4. List Sent Messages

```bash
./tools/test-api.sh GET /api/v1/message-data?status=sent&message_delivery_method=SMS
```

---

## Message Schema vs Calendar Invites

### When to Use Message Schema (f_message_data)

✅ **Appointment reminders** (SMS/Email)
✅ **Marketing campaigns** (Email)
✅ **Password reset emails**
✅ **Welcome emails**
✅ **Notifications** (SMS/Email/Push)
✅ **Two-factor authentication codes** (SMS)

**Example:** Send SMS reminder 1 day before appointment.

### When to Use Person-Calendar System

✅ **Meeting invitations** (.ics files)
✅ **Event RSVP tracking**
✅ **Calendar slot booking**
✅ **Availability management**
✅ **Event-person associations**

**Example:** Send calendar invite for team meeting with RSVP.

**Key Difference:**
- **Message System**: One-way communication (send and track delivery)
- **Calendar System**: Interactive events (RSVP, availability, calendar integration)

**See:** `/docs/PERSON_CALENDAR_SYSTEM.md` for calendar invite details.

---

## MCP Tools for AI Chat

The messaging service provides two function tools for OpenAI-based AI chat:

### sendSMSMessage

```typescript
{
  name: 'sendSMSMessage',
  parameters: {
    phone: string,      // E.164 format: +14165551234
    message: string,    // SMS content (≤160 chars)
    event_id?: string,  // Optional event UUID
    priority?: 'standard' | 'high'
  }
}
```

**AI Usage Example:**
```
Customer: "Can you confirm my appointment for tomorrow?"
AI: "Let me send you a confirmation via SMS."
AI calls: sendSMSMessage({
  phone: "+14165551234",
  message: "Your HVAC appointment is confirmed for Nov 15 at 2PM. - Huron",
  priority: "high"
})
```

### sendEmailMessage

```typescript
{
  name: 'sendEmailMessage',
  parameters: {
    email: string,
    subject: string,
    message: string,    // Plain text with \n for breaks
    event_id?: string,
    priority?: 'standard' | 'high'
  }
}
```

---

## Configuration

### Environment Variables

```bash
# AWS Configuration (uses IAM role from EC2, no credentials needed)
AWS_REGION=us-east-1
AWS_SES_FROM_EMAIL=noreply@cohuron.com
AWS_SES_FROM_NAME=Cohuron PMO
AWS_SES_CONFIGURATION_SET=cohuron-email-tracking
AWS_SNS_SENDER_ID=Cohuron
```

### IAM Permissions Required

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sns:Publish",
        "sns:PublishBatch"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## Frontend Integration

### Entity Configuration

Messages are registered as entities in `entityConfig.ts`:

```typescript
// Message Schema - REMOVED from frontend (internal use only)
// Templates managed via internal API: /api/v1/message-schema
// No UI routes, not in d_entity.active_flag = false

// Message (Sent Messages) - USER-FACING ENTITY
message: {
  name: 'message',
  displayName: 'Message',
  pluralName: 'Messages',
  apiEndpoint: '/api/v1/message-data',
  columns: [], // Auto-generated (v4.0)
  fields: [
    { key: 'name', label: 'Message Name', type: 'text' },
    { key: 'code', label: 'Message Code', type: 'text' },
    { key: 'message_delivery_method', label: 'Delivery Method', type: 'select' },
    { key: 'status', label: 'Status', type: 'select' },
    { key: 'recipient_name', label: 'Recipient Name', type: 'text' },
    { key: 'recipient_email', label: 'Recipient Email', type: 'text' },
    { key: 'recipient_phone', label: 'Recipient Phone', type: 'text' },
    { key: 'scheduled_ts', label: 'Scheduled Time', type: 'timestamp' },
    { key: 'sent_ts', label: 'Sent Time', type: 'timestamp' },
    { key: 'delivered_ts', label: 'Delivered Time', type: 'timestamp' },
    { key: 'error_message', label: 'Error Message', type: 'textarea' },
    { key: 'retry_count', label: 'Retry Count', type: 'number' }
  ],
  supportedViews: ['table'],
  defaultView: 'table'
}
```

### Navigation

- `/message` - List sent messages (entity route)
- `/message/:id` - Message delivery status details
- ~~`/message-schema`~~ - **REMOVED** (internal use only, no UI)

---

## Cost Estimation

### AWS SNS (SMS)
- **US/Canada:** ~$0.00645 per SMS
- **100 SMS/day:** ~$19/month
- **1000 SMS/day:** ~$194/month

### AWS SES (Email)
- **First 62,000 emails/month:** FREE (when sent from EC2)
- **After that:** $0.10 per 1,000 emails

**Recommendation:** Use email-first strategy (free), reserve SMS for critical notifications.

---

## Monitoring

### CloudWatch Metrics

**SNS:**
- `NumberOfMessagesSent`
- `NumberOfNotificationsFailed`

**SES:**
- `Send`
- `Bounce`
- `Complaint`
- `Reject`

### Delivery Status Tracking

All messages tracked in `f_message_data`:
```sql
-- Check delivery success rate
SELECT
  message_delivery_method,
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY message_delivery_method), 2) as percentage
FROM app.f_message_data
WHERE active_flag = true
GROUP BY message_delivery_method, status
ORDER BY message_delivery_method, status;
```

**Example Output:**
```
 message_delivery_method | status    | count | percentage
-------------------------+-----------+-------+------------
 EMAIL                   | delivered |   150 |      98.68
 EMAIL                   | failed    |     2 |       1.32
 SMS                     | delivered |    85 |      94.44
 SMS                     | failed    |     5 |       5.56
```

---

## Troubleshooting

### SMS Not Sending

1. **Check phone format:** Must be E.164 (+14165551234)
2. **Verify IAM permissions:** EC2 role needs SNS:Publish
3. **Check AWS SNS sandbox:** May need production access
4. **Review error_message in f_message_data table**
5. **Check retry_count < max_retries**

### Email Not Sending

1. **Verify domain in SES:** Domain must be verified
2. **Check SES sandbox mode:** May be limited to verified emails
3. **DKIM configured:** Prevents spoofing
4. **Review bounce/complaint rates in CloudWatch**
5. **Check from_email matches verified SES identity**

### Failed Retry

1. **Check retry_count < max_retries**
2. **Verify message status === 'failed'**
3. **Check provider error codes**
4. **Review AWS service health dashboard**

---

## Security Considerations

✅ **IAM Roles** - EC2 instance role, no hardcoded credentials
✅ **RBAC** - Message entity permissions required (`entity_rbac`)
✅ **Rate Limiting** - Recommended via Fastify plugin
✅ **Phone/Email Validation** - Built into providers
✅ **DKIM** - Email authenticity configured
✅ **Audit Logging** - All messages logged in database with timestamps
✅ **Template Isolation** - Message schemas not exposed to frontend

---

## Future Enhancements

### Phase 2
- Push notifications via Firebase Cloud Messaging
- HTML email support (rich templates with images)
- Email attachments
- SMS two-way communication (webhook)
- Scheduled message sending (cron jobs)

### Phase 3
- Recurring messages (daily/weekly reminders)
- User notification preferences (opt-in/opt-out)
- A/B testing for message templates
- Message analytics dashboard

### Phase 4
- WhatsApp Business API integration
- Slack notifications
- In-app notifications
- SMS delivery confirmations (webhook)
- Multi-language template support

---

## Quick Reference

### Send SMS
```bash
POST /api/v1/message-data
{
  "message_schema_id": "sms-template-uuid",
  "content_data": {
    "recipient": "+14165551234",
    "variables": {...}
  },
  "recipient_phone": "+14165551234"
}
```

### Send Email
```bash
POST /api/v1/message-data
{
  "message_schema_id": "email-template-uuid",
  "content_data": {
    "recipient": "user@example.com",
    "variables": {...}
  },
  "recipient_email": "user@example.com"
}
```

### Retry Failed
```bash
POST /api/v1/message-data/:id/retry
```

### List Messages
```bash
GET /api/v1/message-data?status=sent&message_delivery_method=SMS
```

### Query by Recipient
```bash
GET /api/v1/message-data?recipient_phone=+14165551234
```

---

## Entity System Integration

### RBAC Permissions

Messages follow standard entity RBAC pattern via `entity_rbac` table:

```sql
-- Grant full message permissions to employee (including Owner)
INSERT INTO app.entity_rbac (empid, entity, entity_id, permission)
VALUES (
  '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',  -- Employee ID
  'message',                                 -- Entity type
  'all',                                     -- All messages
  ARRAY[0,1,2,3,4,5]                        -- View, Edit, Share, Delete, Create, Owner
);

-- Grant view-only permissions
INSERT INTO app.entity_rbac (empid, entity, entity_id, permission)
VALUES (
  'employee-uuid',
  'message',
  'all',
  ARRAY[0]  -- View only
);

-- Grant ownership of specific message (creator)
INSERT INTO app.entity_rbac (empid, entity, entity_id, permission)
VALUES (
  'creator-employee-uuid',
  'message',
  'msg-uuid-123',  -- Specific message ID
  ARRAY[0,1,2,3,4,5]  -- Full control including Owner
);
```

**Permission Array (Standard Entity RBAC):**
- `[0]` = **View**: Can see sent messages
- `[1]` = **Edit**: Can retry failed messages, update metadata
- `[2]` = **Share**: Can share message details with others
- `[3]` = **Delete**: Can soft-delete messages
- `[4]` = **Create**: Can send new messages
- `[5]` = **Owner**: Full control including permission management (typically message creator)

### Entity Relationships

Messages can be linked to other entities via `entity_instance_link`:

```sql
-- Link message to project
INSERT INTO app.entity_instance_link (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
VALUES ('project', 'project-uuid', 'message', 'message-uuid');

-- Link message to customer
INSERT INTO app.entity_instance_link (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
VALUES ('customer', 'customer-uuid', 'message', 'message-uuid');
```

**Use Cases:**
- Track all messages sent for a project
- View message history for a customer
- Link appointment reminders to tasks

---

## Support

**Documentation:** `/docs/message/MESSAGING_SERVICE.md`
**API Docs:** `http://localhost:4000/docs`
**Test Script:** `./tools/test-api.sh`
**Database Import:** `./tools/db-import.sh`

**Related Docs:**
- Entity System: `/docs/entity_design_pattern/universal_entity_system.md`
- Person-Calendar System: `/docs/PERSON_CALENDAR_SYSTEM.md` (for .ics invites)
- AWS Infrastructure: `/docs/infra_docs/INFRASTRUCTURE_DESIGN.md`
- Message Schema DDL: `/db/XLII_d_message_schema.ddl`
- Message Data DDL: `/db/XLIII_f_message_data.ddl`

---

**Last Updated:** 2025-11-12
**Version:** 2.0.0
**Status:** ✅ Production Ready

**Key Changes in v2.0:**
- Clarified message_schema is internal-only (not user-facing entity)
- Separated marketing messages from calendar invites (.ics)
- Updated entity configuration (message_schema removed from frontend)
- Added RBAC and entity relationship examples
- Enhanced troubleshooting section
