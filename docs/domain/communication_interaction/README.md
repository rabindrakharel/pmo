# Communication & Interaction Domain

> **Purpose**: Omnichannel customer communication with message templates, multi-channel delivery (EMAIL/SMS/PUSH), and complete interaction history tracking. Foundation for customer engagement and experience analytics.

## Domain Overview

The Communication & Interaction Domain manages all customer-facing communications across multiple channels (email, SMS, push notifications) and tracks complete interaction history (calls, chats, emails, videos). It provides a template-driven messaging system with variable substitution, delivery tracking, and comprehensive interaction logging for customer journey mapping and sentiment analysis.

### Business Value

- **Omnichannel Messaging** via EMAIL, SMS, and PUSH notifications
- **Template Management** with reusable message templates and variable substitution
- **Delivery Tracking** with open rates, click tracking, and delivery status
- **Interaction History** capturing all customer touchpoints across channels
- **Sentiment Analysis** and AI-powered interaction insights
- **Customer Journey Mapping** with complete communication audit trail
- **Compliance & Audit** with timestamped interaction records

## Entities

| Entity | DDL File | Table | Purpose |
|--------|----------|-------|---------|
| **Message Schema** | XLII_d_message_schema.ddl | `d_message_schema` | Reusable message templates for EMAIL, SMS, and PUSH with rich formatting and variable placeholders |
| **Message Data** | XLIII_f_message_data.ddl | `f_message_data` | Actual sent/scheduled messages with delivery status, tracking metrics, and personalized content |
| **Interaction** | XXXIII_f_interaction.ddl | `f_customer_interaction` | Customer interaction events (calls, chats, emails, videos) with S3 content storage and AI analysis |

## Entity Relationships

```
┌──────────────────────────────────────────────────────────────────────┐
│           COMMUNICATION & INTERACTION DOMAIN                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────┐                                             │
│  │  Message Schema    │ (Template Repository)                       │
│  │ (d_message_schema) │                                             │
│  │                    │                                             │
│  │ Template Types:    │                                             │
│  │ • EMAIL blocks     │                                             │
│  │ • SMS text         │                                             │
│  │ • PUSH payload     │                                             │
│  │                    │                                             │
│  │ Variables:         │                                             │
│  │ • {{firstName}}    │                                             │
│  │ • {{orderNumber}}  │                                             │
│  │ • {{date}}         │                                             │
│  └────────────────────┘                                             │
│           │                                                          │
│           │ instantiated as                                          │
│           ▼                                                          │
│  ┌────────────────────┐          sent to       ┌──────────────┐    │
│  │   Message Data     │─────────────────────►  │   Customer   │    │
│  │ (f_message_data)   │                        │  (d_client)  │    │
│  │                    │                        │              │    │
│  │ • Recipient        │                        │from Customer │    │
│  │ • Sent timestamp   │                        │360 Domain    │    │
│  │ • Delivery status  │                        └──────────────┘    │
│  │ • Tracking metrics │                               │            │
│  │                    │                               │ has        │
│  │ Channels:          │                               ▼            │
│  │ • EMAIL            │                        ┌──────────────┐    │
│  │ • SMS              │                        │  Interaction │    │
│  │ • PUSH             │                        │(f_customer_  │    │
│  └────────────────────┘                        │ interaction) │    │
│           │                                     │              │    │
│           │ triggers                            │ Types:       │    │
│           │                                     │ • Voice Call │    │
│           ▼                                     │ • Chat       │    │
│  ┌────────────────────┐                        │ • Email      │    │
│  │   Interaction      │◄───────────────────────┤ • Video      │    │
│  │  (logged event)    │                        │ • SMS        │    │
│  │                    │                        │              │    │
│  │ Message sent       │                        │ Content:     │    │
│  │ logged as          │                        │ • S3 storage │    │
│  │ interaction        │                        │ • Transcript │    │
│  └────────────────────┘                        │ • Sentiment  │    │
│                                                 │ • Summary    │    │
│                                                 └──────────────┘    │
│                                                        │            │
│                                                        │ references │
│                                                        ▼            │
│  ┌────────────────────┐                        ┌──────────────┐    │
│  │     Employee       │◄───────────────────────┤   Project    │    │
│  │  (employee)      │                        │ (project)  │    │
│  │                    │                        │              │    │
│  │from Customer 360   │                        │from Operations│   │
│  │Domain              │                        │ Domain       │    │
│  └────────────────────┘                        └──────────────┘    │
│         ▲                                                           │
│         │                                                           │
│         │ interaction participants                                 │
│         │                                                           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │        Polymorphic Person Entity References (JSONB)          │  │
│  │                                                               │  │
│  │  interaction_person_entities: [                              │  │
│  │    {"person_entity_type": "customer", "person_entity_id": ...}│ │
│  │    {"person_entity_type": "employee", "person_entity_id": ...}│ │
│  │  ]                                                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Relationship Rules

1. **Message Schema → Message Data**: One-to-many
   - Each template (schema) can be instantiated into many message instances
   - Template defines structure, message data adds personalized content
   - Template ID tracked in message data for reporting

2. **Message Data → Customer**: Many-to-one
   - Each message sent to one recipient (customer/employee)
   - Recipient stored as email/phone/device token
   - Customer denormalized for performance

3. **Message Data → Interaction**: One-to-one (optional)
   - Sending a message can create an interaction record
   - Interaction logs the communication event
   - Bidirectional reference for audit trail

4. **Interaction → Customer**: Many-to-one
   - Each interaction involves at least one customer
   - Multiple participants stored in JSONB array
   - Polymorphic references (customer, employee, client)

5. **Interaction → Employee**: Many-to-many
   - Interactions can involve multiple employees (call transfers, chat handoffs)
   - Employee who handled interaction tracked
   - Manager escalations preserved

6. **Interaction → Project/Task**: Many-to-one (optional)
   - Interactions can relate to specific project or task
   - Interaction can indicate intention to create entity (quote, task)
   - Links customer communication to operational context

## Business Semantics

### Message Delivery Channels

**EMAIL**:
- Rich HTML templates with visual block editor
- Subject line, sender name, reply-to customization
- Inline images, attachments, CTAs (call-to-action buttons)
- Open tracking, click tracking, bounce handling
- Unsubscribe management

**SMS**:
- Plain text messages with 160-character GSM-7 segments
- Variable substitution ({{firstName}}, {{date}}, etc.)
- Cost tracking per segment
- Delivery confirmation via carrier status
- Two-way messaging support (replies)

**PUSH Notifications**:
- Mobile app push notifications (iOS/Android)
- Title, body, icon, badge, sound
- Rich media (images, videos)
- Action buttons (Reply, Dismiss, View)
- Deep linking to app screens

### Message Schema Structure

**EMAIL Template** (JSONB):
```json
{
  "blocks": [
    {
      "id": "block-1",
      "type": "text",
      "content": "Hello {{firstName}},",
      "styles": {"fontSize": "16px", "color": "#333"}
    },
    {
      "id": "block-2",
      "type": "text",
      "content": "Your order {{orderNumber}} has been shipped!",
      "styles": {"fontSize": "18px", "fontWeight": "bold"}
    },
    {
      "id": "block-3",
      "type": "button",
      "content": "Track Order",
      "properties": {
        "url": "https://huronhome.ca/orders/{{orderNumber}}",
        "backgroundColor": "#007bff",
        "textColor": "#fff"
      }
    }
  ],
  "globalStyles": {
    "backgroundColor": "#f8f9fa",
    "fontFamily": "Arial, sans-serif",
    "maxWidth": "600px"
  }
}
```

**SMS Template** (JSONB):
```json
{
  "message": "Hi {{firstName}}, reminder: Your {{serviceType}} appointment is on {{date}} at {{time}}. Address: {{address}}. Reply CONFIRM or CANCEL.",
  "maxLength": 160,
  "encoding": "GSM-7",
  "variables": ["firstName", "serviceType", "date", "time", "address"],
  "characterCount": 145,
  "segmentCount": 1
}
```

**PUSH Template** (JSONB):
```json
{
  "title": "New Message",
  "body": "{{senderName}}: {{messagePreview}}",
  "icon": "https://huronhome.ca/icon.png",
  "badge": 1,
  "sound": "default",
  "clickAction": "OPEN_CONVERSATION",
  "data": {
    "conversationId": "{{conversationId}}",
    "senderId": "{{senderId}}"
  },
  "actions": [
    {"action": "reply", "title": "Reply"},
    {"action": "dismiss", "title": "Dismiss"}
  ]
}
```

### Interaction Types

**Voice Call** (`interaction_type: 'voice_call'`):
- Inbound/outbound phone calls
- Call duration, wait time, hold time tracking
- Call recording stored in S3 (MP3/WAV)
- Speech-to-text transcript
- Sentiment analysis on transcript

**Chat** (`interaction_type: 'chat'`):
- Live chat on website or mobile app
- Real-time text conversations
- Message-by-message logging
- Agent response time tracking
- Chat session duration

**Email** (`interaction_type: 'email'`):
- Customer email inquiries
- Email thread tracking
- Attachment support
- Response time SLA tracking
- Auto-categorization by topic

**Video Call** (`interaction_type: 'video_call'`):
- Video consultations (Zoom, Teams, etc.)
- Recording stored in S3 (MP4)
- Meeting duration and participants
- Transcript from video
- Screen sharing records

**SMS** (`interaction_type: 'sms'`):
- Text message conversations
- Two-way SMS threads
- Delivery and read receipts
- Opt-in/opt-out management

**Social Media** (`interaction_type: 'social_media'`):
- Facebook Messenger, WhatsApp, Twitter DM
- Platform-specific metadata
- Public vs. private messages
- Social media profile linking

**In-Person** (`interaction_type: 'in_person'`):
- Store visit, on-site consultation
- Manual entry by employee
- Location and duration tracking
- Notes and follow-up actions

### Interaction Lifecycle

```
Interaction Initiated → Captured → Analyzed → Archived
        │                  │           │          │
        ▼                  ▼           ▼          ▼
  Customer contacts    Content       AI          S3 Storage
  via channel          stored in S3  Analysis    long-term
  (call, chat, etc.)   Metadata      (sentiment, retention
                       in database   summary,
                                     transcript)
```

### Sentiment Analysis

Interactions with text/transcript analyzed for sentiment:

- **Positive**: Customer satisfied, happy tone
- **Neutral**: Informational, factual conversation
- **Negative**: Customer frustrated, complaint
- **Sentiment Score**: -1.0 (very negative) to +1.0 (very positive)

AI models analyze:
- Word choice and tone
- Emotion indicators
- Escalation triggers
- Resolution effectiveness

## Data Patterns

### Message Numbering

**Message Schema** (template codes):
```
MSG-SCHEMA-{CATEGORY}-{SEQUENCE}

Examples:
- MSG-SCHEMA-APPT-001 (Appointment reminder)
- MSG-SCHEMA-ORDER-001 (Order confirmation)
- MSG-SCHEMA-WELCOME-001 (Welcome email)
```

**Message Data** (sent message IDs):
```
MSG-{YEAR}-{SEQUENCE}

Examples:
- MSG-2025-00001
- MSG-2025-12345
```

**Interaction** (interaction IDs):
```
INT-{YEAR}-{SEQUENCE}

Examples:
- INT-2025-00001 (Voice call)
- INT-2025-00456 (Chat session)
- INT-2025-12345 (Email)
```

### Variable Substitution

Common variables used in templates:

- `{{firstName}}`, `{{lastName}}`, `{{fullName}}`
- `{{email}}`, `{{phone}}`
- `{{orderNumber}}`, `{{invoiceNumber}}`
- `{{date}}`, `{{time}}`, `{{datetime}}`
- `{{address}}`, `{{city}}`, `{{province}}`
- `{{employeeName}}`, `{{employeePhone}}`
- `{{projectName}}`, `{{taskName}}`
- `{{amount}}`, `{{total}}`, `{{balance}}`

Variables replaced at send time with actual customer data.

### Content Storage Model

Interactions use S3 for large content (similar to Artifact pattern):

```
S3 URI: s3://pmo-interactions/2025/01/INT-2025-00123-call.mp3

Fields:
- content_object_bucket: "pmo-interactions"
- content_object_key: "2025/01/INT-2025-00123-call.mp3"
- content_url: "s3://pmo-interactions/2025/01/INT-2025-00123-call.mp3"
- content_format: "mp3"
- content_size_bytes: 2458761
- content_mime_type: "audio/mpeg"
```

Small text content stored inline in `content_text` field (< 10KB).

### Chunked Interactions

Long interactions (e.g., multi-hour support calls) can be chunked:

```
Interaction #1:
- parent_interaction_id: NULL
- chunk_number: 1
- total_chunks: 3
- is_primary_chunk: true

Interaction #2:
- parent_interaction_id: <ID of Interaction #1>
- chunk_number: 2
- total_chunks: 3
- is_primary_chunk: false

Interaction #3:
- parent_interaction_id: <ID of Interaction #1>
- chunk_number: 3
- total_chunks: 3
- is_primary_chunk: false
```

Enables efficient storage and retrieval of large interactions.

### Polymorphic Person References

Interactions support multiple participant types via JSONB:

```json
{
  "interaction_person_entities": [
    {
      "person_entity_type": "customer",
      "person_entity_id": "uuid-customer-123",
      "role": "caller"
    },
    {
      "person_entity_type": "employee",
      "person_entity_id": "uuid-employee-456",
      "role": "agent"
    },
    {
      "person_entity_type": "employee",
      "person_entity_id": "uuid-employee-789",
      "role": "supervisor"
    }
  ]
}
```

Allows flexible participant tracking without rigid foreign keys.

## Use Cases

### UC-1: Send Appointment Reminder SMS

**Actors**: System, Customer

**Flow**:
1. System runs daily job to check upcoming appointments
2. Finds appointment for tomorrow: HVAC maintenance at 2:00 PM
3. System loads SMS template "MSG-SCHEMA-APPT-001"
4. Template: "Hi {{firstName}}, reminder: Your {{serviceType}} appointment is on {{date}} at {{time}}. Address: {{address}}. Reply CONFIRM or CANCEL."
5. System substitutes variables:
   - firstName: "John"
   - serviceType: "HVAC Maintenance"
   - date: "Nov 15, 2025"
   - time: "2:00 PM"
   - address: "123 Main St, London, ON"
6. Final message: "Hi John, reminder: Your HVAC Maintenance appointment is on Nov 15, 2025 at 2:00 PM. Address: 123 Main St, London, ON. Reply CONFIRM or CANCEL."
7. System creates Message Data record:
   - message_schema_id: <template ID>
   - recipient: "+1-416-555-1234"
   - status: "sent"
   - sent_ts: now()
8. SMS sent via Twilio API
9. Delivery status updated: "delivered"
10. Customer receives SMS on mobile phone
11. Customer replies "CONFIRM"
12. System creates Interaction record:
    - interaction_type: "sms"
    - channel: "twilio"
    - content_text: "CONFIRM"
    - direction: "inbound"
13. Appointment status updated to "confirmed"

**Entities Touched**: Message Schema, Message Data, Customer, Interaction, Event (Service Delivery)

### UC-2: Customer Support Call Tracking

**Actors**: Customer, Support Agent, System

**Flow**:
1. Customer calls support hotline: 1-800-HURON-HELP
2. IVR system captures:
   - Caller ID: +1-416-555-7890
   - Call time: 2025-01-10 14:30:00
   - Menu selection: "Technical Support"
3. Call routed to Agent (Emily Thompson)
4. System creates Interaction record:
   - interaction_number: INT-2025-00567
   - interaction_type: "voice_call"
   - interaction_subtype: "inbound"
   - channel: "phone"
   - interaction_ts: 2025-01-10 14:30:00
   - interaction_person_entities: [
       {"person_entity_type": "customer", "person_entity_id": "...", "role": "caller"},
       {"person_entity_type": "employee", "person_entity_id": "...", "role": "agent"}
     ]
5. Agent answers call, discusses issue (furnace not heating)
6. Call recorded to S3: s3://pmo-interactions/2025/01/INT-2025-00567-call.mp3
7. Call duration: 8 minutes 45 seconds (525 seconds)
8. Agent creates Task from call: "Furnace repair - Customer John Smith"
9. Interaction updated:
   - duration_seconds: 525
   - interaction_intention_entity: "task"
   - metadata: {"task_id": "uuid-task-123"}
10. Call ends, post-call work: 2 minutes (logging notes)
11. System updates Interaction:
    - after_call_work_seconds: 120
12. AI speech-to-text processes recording:
    - transcript_text: "Hello, this is Emily..."
    - transcript_confidence_score: 92.5
13. AI sentiment analysis:
    - sentiment_label: "Negative" (customer frustrated)
    - sentiment_score: -0.65
    - sentiment_keywords: ["not working", "freezing", "urgently"]
14. Manager reviews call quality for training
15. Interaction visible in Customer 360 history

**Entities Touched**: Interaction, Customer, Employee, Task (Operations), S3 Content

### UC-3: Email Campaign with Tracking

**Actors**: Marketing Manager, System, Customers

**Flow**:
1. Marketing Manager creates EMAIL template "New Service Promotion"
2. Template includes:
   - Subject: "Save 20% on {{serviceType}} This Month!"
   - Body: blocks with text, image, CTA button
   - CTA: "Book Now" → https://huronhome.ca/promo
3. Template saved as Message Schema: MSG-SCHEMA-PROMO-001
4. Manager selects customer segment: "Active HVAC customers in Ontario"
5. System generates 1,500 Message Data records (one per customer)
6. For each customer:
   - Load template
   - Substitute variables (firstName, serviceType)
   - Generate unique tracking pixel URL
   - Add UTM parameters to CTA link
7. Emails sent via SendGrid API in batches
8. Message Data status: "sent" (1,500 emails)
9. Customer "Jane Doe" receives email at 10:00 AM
10. Jane opens email at 10:15 AM
11. Tracking pixel loaded → Message Data updated:
    - opened: true
    - opened_at: 2025-01-10 10:15:00
12. Jane clicks "Book Now" button at 10:17 AM
13. Link click tracked → Message Data updated:
    - clicked: true
    - clicked_at: 2025-01-10 10:17:00
14. Interaction record created:
    - interaction_type: "email"
    - interaction_subtype: "outbound"
    - channel: "sendgrid"
    - content_text: <email HTML>
15. Campaign report generated:
    - Sent: 1,500
    - Delivered: 1,485 (98.5%)
    - Opened: 612 (41.2%)
    - Clicked: 187 (12.6%)
    - Bounced: 15 (1%)
16. ROI tracked: 45 customers booked service ($67,500 revenue)

**Entities Touched**: Message Schema, Message Data (1,500), Customer (1,500), Interaction (1,500)

## Technical Architecture

### Key Tables

```sql
-- Message Schema (d_message_schema)
CREATE TABLE app.d_message_schema (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,               -- 'MSG-SCHEMA-APPT-001'
    name text NOT NULL,
    subject text,                                    -- Email subject line
    message_delivery_method varchar(20) NOT NULL,   -- 'EMAIL', 'SMS', 'PUSH'

    -- Template content (JSONB)
    template_schema jsonb DEFAULT '{}'::jsonb,       -- Blocks/structure

    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);

-- Message Data (f_message_data)
CREATE TABLE app.f_message_data (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_number varchar(50) NOT NULL UNIQUE,     -- 'MSG-2025-00001'

    -- Template reference
    message_schema_id uuid,                          -- Links to d_message_schema

    -- Recipient
    recipient text NOT NULL,                         -- Email/phone/device token
    recipient_name text,
    message_delivery_method varchar(20) NOT NULL,   -- 'EMAIL', 'SMS', 'PUSH'

    -- Content (personalized)
    content_data jsonb DEFAULT '{}'::jsonb,          -- Variables + final content

    -- Delivery tracking
    status varchar(50) DEFAULT 'pending',            -- 'pending', 'sent', 'delivered', 'failed'
    sent_ts timestamptz,
    delivered_ts timestamptz,
    opened_ts timestamptz,
    clicked_ts timestamptz,
    failed_reason text,

    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

-- Interaction (f_customer_interaction)
CREATE TABLE app.f_customer_interaction (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    interaction_number varchar(50) NOT NULL UNIQUE, -- 'INT-2025-00001'

    -- Type & Channel
    interaction_type varchar(50) NOT NULL,           -- 'voice_call', 'chat', 'email', etc.
    interaction_subtype varchar(50),                 -- 'inbound', 'outbound'
    channel varchar(50) NOT NULL,                    -- 'phone', 'live_chat', etc.

    -- Participants (polymorphic JSONB)
    interaction_person_entities jsonb DEFAULT '[]'::jsonb,

    -- Timestamp & Duration
    interaction_ts timestamptz,
    duration_seconds integer,
    wait_time_seconds integer,
    talk_time_seconds integer,

    -- Content (S3 storage)
    content_format varchar(50),                      -- 'mp3', 'mp4', 'txt', etc.
    content_size_bytes bigint,
    content_object_bucket text,
    content_object_key text,
    content_url text,

    -- Inline content (small text)
    content_text text,
    content_summary text,

    -- Transcript (for voice/video)
    transcript_text text,
    transcript_confidence_score decimal(5,2),

    -- Sentiment analysis
    sentiment_label varchar(50),                     -- 'Positive', 'Neutral', 'Negative'
    sentiment_score decimal(5,2),                    -- -1.0 to +1.0
    sentiment_keywords text[],

    -- Intention
    interaction_intention_entity varchar(50),        -- 'task', 'quote', etc.

    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);
```

### API Endpoints

```
# Message Schema (Templates)
GET    /api/v1/message-schema           # List templates
GET    /api/v1/message-schema/:id       # Get template
POST   /api/v1/message-schema           # Create template
PUT    /api/v1/message-schema/:id       # Update template
DELETE /api/v1/message-schema/:id       # Soft delete template

# Message Data (Sent Messages)
GET    /api/v1/message-data             # List sent messages
GET    /api/v1/message-data/:id         # Get message detail
POST   /api/v1/message-data             # Send message
POST   /api/v1/message-data/bulk        # Send bulk messages (campaigns)
GET    /api/v1/message-data/:id/track   # Get tracking metrics

# Interactions
GET    /api/v1/interaction              # List interactions
GET    /api/v1/interaction/:id          # Get interaction detail
POST   /api/v1/interaction              # Create interaction
PATCH  /api/v1/interaction/:id          # Update interaction
GET    /api/v1/interaction/:id/content  # Download S3 content
GET    /api/v1/interaction/:id/transcript # Get transcript

# Analytics
GET    /api/v1/interaction/analytics/sentiment  # Sentiment trends
GET    /api/v1/message-data/analytics/campaign  # Campaign performance
```

## Integration Points

### Upstream Dependencies

- **Customer 360 Domain**: Customer, Employee (message recipients, interaction participants)
- **Operations Domain**: Project, Task (interaction context)
- **Service Delivery Domain**: Event (appointment reminders)
- **Order & Fulfillment Domain**: Order, Invoice (order confirmations, payment reminders)

### Downstream Dependencies

- **None** - Communication & Interaction is a terminal domain

### External Integrations

- **Twilio**: SMS/voice call delivery
- **SendGrid/Mailgun**: Email delivery and tracking
- **Firebase Cloud Messaging (FCM)**: Push notifications (Android)
- **Apple Push Notification Service (APNS)**: Push notifications (iOS)
- **AWS Transcribe**: Speech-to-text for call transcripts
- **AWS Comprehend**: Sentiment analysis for interactions

## Data Volume & Performance

### Expected Data Volumes

- Message Schemas: 50 - 500 templates
- Message Data: 100,000 - 1,000,000 per year
- Interactions: 50,000 - 500,000 per year

### Indexing Strategy

```sql
-- Message Schema indexes
CREATE INDEX idx_msg_schema_method ON app.d_message_schema(message_delivery_method);
CREATE INDEX idx_msg_schema_active ON app.d_message_schema(active_flag);

-- Message Data indexes
CREATE INDEX idx_msg_data_schema ON app.f_message_data(message_schema_id);
CREATE INDEX idx_msg_data_recipient ON app.f_message_data(recipient);
CREATE INDEX idx_msg_data_status ON app.f_message_data(status);
CREATE INDEX idx_msg_data_sent ON app.f_message_data(sent_ts);

-- Interaction indexes
CREATE INDEX idx_interaction_type ON app.f_customer_interaction(interaction_type);
CREATE INDEX idx_interaction_channel ON app.f_customer_interaction(channel);
CREATE INDEX idx_interaction_ts ON app.f_customer_interaction(interaction_ts);
CREATE INDEX idx_interaction_sentiment ON app.f_customer_interaction(sentiment_label);
CREATE INDEXCREATE INDEX idx_interaction_person_entities ON app.f_customer_interaction USING GIN(interaction_person_entities);
```

## Future Enhancements

1. **Two-Way Messaging**: Real-time SMS/chat conversations with threading
2. **WhatsApp Business**: WhatsApp Business API integration
3. **RCS Messaging**: Rich Communication Services for Android
4. **Voice Biometrics**: Customer identification via voice print
5. **Video Analytics**: AI analysis of video call body language
6. **Live Transcription**: Real-time call transcription for agents
7. **Chatbot Integration**: AI chatbot for automated responses
8. **Call Routing**: Intelligent call routing based on customer history
9. **Interaction Scoring**: AI-powered interaction quality scoring
10. **Multi-Language**: Template translation and multi-language support

---

**Domain Owner**: Marketing & Customer Success Teams
**Last Updated**: 2025-11-13
**Related Domains**: Customer 360, Operations, Service Delivery, Order & Fulfillment
