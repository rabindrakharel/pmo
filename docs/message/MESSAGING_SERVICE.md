# Messaging Service - Complete Guide

**Version:** 1.0.0
**Last Updated:** 2025-11-10
**Status:** Production Ready

## Overview

The **Messaging Service** is a universal notification platform that delivers messages via:
- **Email** (AWS SES)
- **SMS** (AWS SNS)
- **Push Notifications** (Firebase FCM - Future)

### Key Features

✅ **Multi-Provider Architecture** - Clean provider abstraction (SNS, SES, FCM)
✅ **Automatic Delivery** - Messages send immediately via AWS on creation
✅ **Status Tracking** - Real-time delivery status (pending → sent → delivered/failed)
✅ **Retry Logic** - Automatic retry for failed messages with configurable limits
✅ **Template System** - JSONB-based templates with variable interpolation
✅ **Entity Integration** - Full entity registry and RBAC support
✅ **MCP Tools** - AI chat can send messages automatically

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (Fastify)                      │
│  POST /api/v1/message-data → Send Message                  │
│  POST /api/v1/message-data/:id/retry → Retry Failed        │
│  GET /api/v1/message-data → List Messages                  │
│  GET /api/v1/message-schema → List Templates               │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│         MessageDataService (service.ts)                     │
│  • sendMessage() - Create record + deliver to AWS           │
│  • retryMessage() - Retry failed delivery                   │
│  • deliverMessage() - Route to provider                     │
│  • renderEmailBody() - Template interpolation               │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│      MessageDeliveryService (delivery.service.ts)           │
│  • sendSMS() - Route to SNS                                 │
│  • sendEmail() - Route to SES                               │
│  • sendPush() - Route to FCM (future)                       │
│  • validateRecipient() - Format validation                  │
└──────────────────┬──────────────────────────────────────────┘
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

**1. d_message_schema (Templates)**
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
```

**2. f_message_data (Sent Messages)**
```sql
-- Actual sent/scheduled messages
id                      uuid PRIMARY KEY
message_schema_id       uuid         -- Link to template
code                    varchar(50)
name                    varchar(200)
message_delivery_method varchar(20)
status                  varchar(20)  -- pending | sent | delivered | failed
content_data            jsonb        -- Personalized variables
recipient_email         varchar(255)
recipient_phone         varchar(50)
recipient_device_token  varchar(500)
recipient_name          varchar(200)
scheduled_ts            timestamptz
sent_ts                 timestamptz
delivered_ts            timestamptz
error_code              varchar(50)
error_message           text
retry_count             int DEFAULT 0
max_retries             int DEFAULT 3
```

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
  "sent_ts": "2025-11-10T20:30:00Z"
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
  }
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
  }
}'
```

### 3. Retry Failed Message

```bash
./tools/test-api.sh POST /api/v1/message-data/msg-uuid-456/retry
```

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
// Message Schema (Templates)
message_schema: {
  name: 'message_schema',
  displayName: 'Message Schema',
  apiEndpoint: '/api/v1/message-schema',
  columns: [...], // Name, Code, Type, Status
  fields: [...]   // Template configuration
}

// Message (Sent Messages)
message: {
  name: 'message',
  displayName: 'Message',
  apiEndpoint: '/api/v1/message-data',
  columns: [...], // Recipient, Type, Status, Timestamps
  fields: [...]   // Message details
}
```

### Navigation

- `/message-schema` - List templates
- `/message-schema/:id` - Template details
- `/message` - List sent messages
- `/message/:id` - Message delivery status

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
GROUP BY message_delivery_method, status
ORDER BY message_delivery_method, status;
```

---

## Troubleshooting

### SMS Not Sending

1. **Check phone format:** Must be E.164 (+14165551234)
2. **Verify IAM permissions:** EC2 role needs SNS:Publish
3. **Check AWS SNS sandbox:** May need production access
4. **Review error_message in database**

### Email Not Sending

1. **Verify domain in SES:** Domain must be verified
2. **Check SES sandbox mode:** May be limited to verified emails
3. **DKIM configured:** Prevents spoofing
4. **Review bounce/complaint rates**

### Failed Retry

1. **Check retry_count < max_retries**
2. **Verify message status === 'failed'**
3. **Check provider error codes**

---

## Security Considerations

✅ **IAM Roles** - EC2 instance role, no hardcoded credentials
✅ **RBAC** - Marketing entity permissions required
✅ **Rate Limiting** - Recommended via Fastify plugin
✅ **Phone/Email Validation** - Built into providers
✅ **DKIM** - Email authenticity configured
✅ **Audit Logging** - All messages logged in database

---

## Future Enhancements

### Phase 2
- Push notifications via Firebase Cloud Messaging
- HTML email support (rich templates)
- Email attachments
- SMS two-way communication (webhook)

### Phase 3
- Message scheduling (cron jobs)
- Recurring messages
- User notification preferences
- A/B testing for message templates

### Phase 4
- WhatsApp integration
- Slack notifications
- In-app notifications
- SMS delivery confirmations

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
  }
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
  }
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

---

## Support

**Documentation:** `/docs/MESSAGING_SERVICE.md`
**API Docs:** `http://localhost:4000/docs`
**Test Script:** `./tools/test-api.sh`
**Database Import:** `./tools/db-import.sh`

**Related Docs:**
- Entity System: `/docs/entity_design_pattern/universal_entity_system.md`
- AWS Infrastructure: `/docs/infra_docs/INFRASTRUCTURE_DESIGN.md`
- Message Schema DDL: `/db/XLII_d_message_schema.ddl`
- Message Data DDL: `/db/XLIII_f_message_data.ddl`

---

**Last Updated:** 2025-11-10
**Version:** 1.0.0
**Status:** ✅ Production Ready
