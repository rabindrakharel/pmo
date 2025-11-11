-- =====================================================
-- MESSAGE DATA FACT TABLE (f_message_data)
-- Stores actual sent/scheduled messages based on templates
-- =====================================================
--
-- BUSINESS PURPOSE:
-- Stores individual message instances (sent or scheduled) across all channels:
-- - EMAIL: Actual emails sent to customers with personalized content
-- - SMS: Text messages sent to customers with variable substitution
-- - PUSH: Push notifications delivered to customer devices
--
-- RELATIONSHIP:
-- f_message_data.message_schema_id → d_message_schema.id (template reference)
--
-- API SEMANTICS & LIFECYCLE:
--
-- 1. SEND MESSAGE (Create Message Instance)
--    • Endpoint: POST /api/v1/message-data
--    • Body: {message_schema_id, recipient, content_data: {...}}
--    • Returns: {id: "new-uuid", status: "sent"}
--    • Database: INSERT with sent_ts=now(), status='sent'
--
-- 2. SCHEDULE MESSAGE (Create Future Message)
--    • Endpoint: POST /api/v1/message-data
--    • Body: {message_schema_id, recipient, scheduled_ts, content_data: {...}}
--    • Returns: {id: "new-uuid", status: "scheduled"}
--    • Database: INSERT with scheduled_ts, status='scheduled'
--
-- 3. GET MESSAGE STATUS
--    • Endpoint: GET /api/v1/message-data/{id}
--    • Database: SELECT * FROM f_message_data WHERE id=$1
--    • Returns: Message with delivery status, timestamps, error logs
--
-- 4. LIST MESSAGES
--    • Endpoint: GET /api/v1/message-data
--    • Filters: status, message_delivery_method, recipient, date_range
--    • Database: SELECT * FROM f_message_data WHERE ... ORDER BY sent_ts DESC
--
-- =====================================================
-- CONTENT_DATA FORMAT BY DELIVERY METHOD
-- =====================================================
--
-- 1. EMAIL CONTENT_DATA (JSONB):
-- {
--   "recipient": "customer@example.com",
--   "recipientName": "John Smith",
--   "variables": {
--     "firstName": "John",
--     "customerName": "John Smith",
--     "orderNumber": "ORD-12345"
--   },
--   "attachments": [
--     {"name": "invoice.pdf", "url": "https://s3.../invoice.pdf"}
--   ],
--   "tracking": {
--     "opened": true,
--     "openedAt": "2025-11-10T14:30:00Z",
--     "clicked": true,
--     "clickedAt": "2025-11-10T14:32:00Z",
--     "clickedLinks": ["https://huronhome.ca/services"]
--   }
-- }
--
-- 2. SMS CONTENT_DATA (JSONB):
-- {
--   "recipient": "+1-416-555-1234",
--   "recipientName": "John Smith",
--   "variables": {
--     "firstName": "John",
--     "date": "Nov 15, 2025",
--     "time": "2:00 PM",
--     "address": "123 Main St"
--   },
--   "finalMessage": "Hi John, this is a reminder that your Plumbing appointment is scheduled for Nov 15, 2025 at 2:00 PM. Location: 123 Main St. Reply CONFIRM to confirm or CANCEL to reschedule. - Huron Home Services",
--   "segmentCount": 1,
--   "characterCount": 158,
--   "cost": 0.0075,
--   "delivery": {
--     "delivered": true,
--     "deliveredAt": "2025-11-10T14:30:05Z",
--     "carrierStatus": "delivered",
--     "errorCode": null
--   }
-- }
--
-- 3. PUSH CONTENT_DATA (JSONB):
-- {
--   "recipient": "device-token-abc123",
--   "recipientName": "John Smith",
--   "devicePlatform": "ios",
--   "variables": {
--     "senderName": "Sarah Thompson",
--     "messagePreview": "Hi John, your appointment has been confirmed",
--     "unreadCount": 3,
--     "conversationId": "conv-789",
--     "senderId": "emp-456",
--     "timestamp": "2025-11-10T14:30:00Z"
--   },
--   "finalPayload": {
--     "notification": {
--       "title": "New Message from Sarah Thompson",
--       "body": "Hi John, your appointment has been confirmed"
--     },
--     "data": {
--       "action": "open_conversation",
--       "conversationId": "conv-789"
--     }
--   },
--   "delivery": {
--     "delivered": true,
--     "deliveredAt": "2025-11-10T14:30:02Z",
--     "opened": true,
--     "openedAt": "2025-11-10T14:35:00Z",
--     "action": "reply"
--   }
-- }
--
-- =====================================================

CREATE TABLE app.f_message_data (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Reference to template
    message_schema_id uuid REFERENCES app.d_message_schema(id),

    -- Message identification (copied from template for query performance)
    code varchar(50),
    name varchar(200) NOT NULL,
    subject varchar(500),
    descr text,

    -- Delivery Method (copied from template)
    message_delivery_method varchar(50) NOT NULL CHECK (message_delivery_method IN ('EMAIL', 'SMS', 'PUSH')),

    -- Message Status
    status varchar(50) DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'sent', 'delivered', 'failed', 'bounced', 'unsubscribed')),

    -- Template Schema (copied from template at send time - frozen snapshot)
    template_schema jsonb DEFAULT '{}'::jsonb,

    -- Personalized Content Data (variables, recipients, delivery tracking)
    content_data jsonb DEFAULT '{}'::jsonb,

    -- Email-specific fields (copied from template)
    preview_text varchar(500),
    from_name varchar(200),
    from_email varchar(200),
    reply_to_email varchar(200),

    -- SMS-specific fields
    sms_sender_id varchar(20),

    -- PUSH-specific fields
    push_priority varchar(20),
    push_ttl integer,

    -- Recipient information (normalized for queries)
    recipient_email varchar(500),
    recipient_phone varchar(50),
    recipient_device_token text,
    recipient_name varchar(200),
    recipient_entity_id uuid, -- Link to customer/employee entity

    -- Scheduling & Timing
    scheduled_ts timestamptz, -- When to send (null = send immediately)
    sent_ts timestamptz, -- When actually sent
    delivered_ts timestamptz, -- When delivered/opened

    -- Error tracking
    error_code varchar(100),
    error_message text,
    retry_count integer DEFAULT 0,
    max_retries integer DEFAULT 3,

    -- Temporal Tracking
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),

    -- Metadata
    metadata jsonb DEFAULT '{}'::jsonb
);

-- Index for querying by template
CREATE INDEX idx_f_message_data_schema_id ON app.f_message_data(message_schema_id);

-- Index for querying by status
CREATE INDEX idx_f_message_data_status ON app.f_message_data(status);

-- Index for querying by delivery method
CREATE INDEX idx_f_message_data_delivery_method ON app.f_message_data(message_delivery_method);

-- Index for querying by recipient
CREATE INDEX idx_f_message_data_recipient_email ON app.f_message_data(recipient_email);
CREATE INDEX idx_f_message_data_recipient_phone ON app.f_message_data(recipient_phone);
CREATE INDEX idx_f_message_data_recipient_entity ON app.f_message_data(recipient_entity_id);

-- Index for querying by sent timestamp
CREATE INDEX idx_f_message_data_sent_ts ON app.f_message_data(sent_ts DESC);

-- Index for querying scheduled messages
CREATE INDEX idx_f_message_data_scheduled ON app.f_message_data(scheduled_ts) WHERE status = 'scheduled';

-- =====================================================
-- SAMPLE DATA - Message Data (Sent Messages)
-- =====================================================

-- EMAIL: Welcome email sent to a customer
INSERT INTO app.f_message_data (
    id,
    message_schema_id,
    code,
    name,
    subject,
    message_delivery_method,
    status,
    template_schema,
    content_data,
    from_name,
    from_email,
    reply_to_email,
    recipient_email,
    recipient_name,
    sent_ts,
    delivered_ts
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    'a1111111-1111-1111-1111-111111111111',
    'EMAIL_WEL001',
    'Welcome Email - New Customer',
    'Welcome to Huron Home Services!',
    'EMAIL',
    'delivered',
    '{"blocks": [{"id": "block-1", "type": "text", "content": "<h1>Welcome to Huron Home Services!</h1>"}], "globalStyles": {"backgroundColor": "#ffffff"}}'::jsonb,
    '{
        "recipient": "john.smith@example.com",
        "recipientName": "John Smith",
        "variables": {
            "firstName": "John",
            "customerName": "John Smith"
        },
        "tracking": {
            "opened": true,
            "openedAt": "2025-11-10T14:30:00Z",
            "clicked": false
        }
    }'::jsonb,
    'Huron Home Services',
    'info@huronhome.ca',
    'info@huronhome.ca',
    'john.smith@example.com',
    'John Smith',
    '2025-11-10T14:00:00Z',
    '2025-11-10T14:30:00Z'
) ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    content_data = EXCLUDED.content_data,
    updated_ts = now();

-- SMS: Appointment reminder sent to a customer
INSERT INTO app.f_message_data (
    id,
    message_schema_id,
    code,
    name,
    subject,
    message_delivery_method,
    status,
    template_schema,
    content_data,
    sms_sender_id,
    recipient_phone,
    recipient_name,
    sent_ts,
    delivered_ts
) VALUES (
    '22222222-2222-2222-2222-222222222222',
    'b2222222-2222-2222-2222-222222222222',
    'SMS_APT001',
    'SMS Appointment Reminder',
    'Appointment Reminder',
    'SMS',
    'delivered',
    '{"message": "Hi {{firstName}}, this is a reminder that your {{serviceType}} appointment is scheduled for {{date}} at {{time}}."}'::jsonb,
    '{
        "recipient": "+1-416-555-1234",
        "recipientName": "John Smith",
        "variables": {
            "firstName": "John",
            "serviceType": "Plumbing",
            "date": "Nov 15, 2025",
            "time": "2:00 PM",
            "address": "123 Main St, Toronto"
        },
        "finalMessage": "Hi John, this is a reminder that your Plumbing appointment is scheduled for Nov 15, 2025 at 2:00 PM. Location: 123 Main St, Toronto. Reply CONFIRM to confirm or CANCEL to reschedule. - Huron Home Services",
        "segmentCount": 1,
        "characterCount": 158,
        "cost": 0.0075,
        "delivery": {
            "delivered": true,
            "deliveredAt": "2025-11-10T14:30:05Z",
            "carrierStatus": "delivered",
            "errorCode": null
        }
    }'::jsonb,
    'HURON',
    '+1-416-555-1234',
    'John Smith',
    '2025-11-10T14:30:00Z',
    '2025-11-10T14:30:05Z'
) ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    content_data = EXCLUDED.content_data,
    updated_ts = now();

-- PUSH: Notification sent to customer's device
INSERT INTO app.f_message_data (
    id,
    message_schema_id,
    code,
    name,
    subject,
    message_delivery_method,
    status,
    template_schema,
    content_data,
    push_priority,
    recipient_device_token,
    recipient_name,
    sent_ts,
    delivered_ts
) VALUES (
    '33333333-3333-3333-3333-333333333333',
    'd4444444-4444-4444-4444-444444444444',
    'PUSH_MSG001',
    'Push New Message Notification',
    'New Message',
    'PUSH',
    'delivered',
    '{"title": "New Message from {{senderName}}", "body": "{{messagePreview}}"}'::jsonb,
    '{
        "recipient": "device-token-abc123xyz",
        "recipientName": "John Smith",
        "devicePlatform": "ios",
        "variables": {
            "senderName": "Sarah Thompson",
            "messagePreview": "Hi John, your appointment has been confirmed for tomorrow at 2 PM.",
            "unreadCount": 3,
            "conversationId": "conv-789",
            "senderId": "emp-456",
            "timestamp": "2025-11-10T14:30:00Z"
        },
        "finalPayload": {
            "notification": {
                "title": "New Message from Sarah Thompson",
                "body": "Hi John, your appointment has been confirmed for tomorrow at 2 PM."
            },
            "data": {
                "action": "open_conversation",
                "conversationId": "conv-789",
                "senderId": "emp-456"
            }
        },
        "delivery": {
            "delivered": true,
            "deliveredAt": "2025-11-10T14:30:02Z",
            "opened": true,
            "openedAt": "2025-11-10T14:35:00Z",
            "action": "reply"
        }
    }'::jsonb,
    'high',
    'device-token-abc123xyz',
    'John Smith',
    '2025-11-10T14:30:00Z',
    '2025-11-10T14:30:02Z'
) ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    content_data = EXCLUDED.content_data,
    updated_ts = now();

-- SCHEDULED SMS: Future appointment reminder
INSERT INTO app.f_message_data (
    id,
    message_schema_id,
    code,
    name,
    subject,
    message_delivery_method,
    status,
    template_schema,
    content_data,
    sms_sender_id,
    recipient_phone,
    recipient_name,
    scheduled_ts
) VALUES (
    '44444444-4444-4444-4444-444444444444',
    'b2222222-2222-2222-2222-222222222222',
    'SMS_APT001',
    'SMS Appointment Reminder',
    'Appointment Reminder',
    'SMS',
    'scheduled',
    '{"message": "Hi {{firstName}}, this is a reminder that your {{serviceType}} appointment is scheduled for {{date}} at {{time}}."}'::jsonb,
    '{
        "recipient": "+1-416-555-9999",
        "recipientName": "Jane Doe",
        "variables": {
            "firstName": "Jane",
            "serviceType": "HVAC",
            "date": "Nov 20, 2025",
            "time": "10:00 AM",
            "address": "456 Oak Ave, Toronto"
        }
    }'::jsonb,
    'HURON',
    '+1-416-555-9999',
    'Jane Doe',
    '2025-11-19T09:00:00Z'
) ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    content_data = EXCLUDED.content_data,
    updated_ts = now();
