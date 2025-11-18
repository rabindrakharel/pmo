-- =====================================================
-- MESSAGE SCHEMA ENTITY (d_message_schema) - TEMPLATE TABLE
-- Universal message template system for EMAIL, SMS, and PUSH notifications
-- =====================================================
--
-- BUSINESS PURPOSE:
-- Stores message templates for multiple delivery channels:
-- - EMAIL: Rich visual templates with blocks (text, images, buttons, forms)
-- - SMS: Plain text templates with character limits and variable interpolation
-- - PUSH: Mobile push notifications with title, body, actions, and images
--
-- API SEMANTICS & LIFECYCLE:
--
-- 1. CREATE NEW TEMPLATE
--    • Endpoint: POST /api/v1/message-schema
--    • Body: {name, subject, message_delivery_method, template_schema: {...}}
--    • Returns: {id: "new-uuid", version: 1}
--    • Database: INSERT with version=1, active_flag=true, created_ts=now()
--
-- 2. UPDATE TEMPLATE (Save/Edit)
--    • Endpoint: PUT /api/v1/message-schema/{id}
--    • Body: {template_schema: {...}, name, subject}
--    • Returns: {id: "same-uuid", version: 2}
--    • Database: UPDATE SET template_schema=$1, version=version+1, updated_ts=now()
--    • SCD Behavior: IN-PLACE UPDATE (version increments)
--
-- 3. SOFT DELETE TEMPLATE
--    • Endpoint: DELETE /api/v1/message-schema/{id}
--    • Database: UPDATE SET active_flag=false, to_ts=now()
--
-- 4. LIST TEMPLATES
--    • Endpoint: GET /api/v1/message-schema
--    • Database: SELECT * FROM d_message_schema WHERE active_flag=true
--    • RBAC: Filtered by entity_rbac (permission 0=view required)
--
-- 5. GET SINGLE TEMPLATE
--    • Endpoint: GET /api/v1/message-schema/{id}
--    • Database: SELECT * FROM d_message_schema WHERE id=$1 AND active_flag=true
--
-- =====================================================
-- TEMPLATE SCHEMA FORMATS BY DELIVERY METHOD
-- =====================================================
--
-- 1. EMAIL TEMPLATE SCHEMA (JSONB):
-- {
--   "blocks": [
--     {
--       "id": "block-1",
--       "type": "text|image|form|button|divider|spacer",
--       "content": "...",
--       "styles": {...},
--       "properties": {...}
--     }
--   ],
--   "globalStyles": {
--     "backgroundColor": "#ffffff",
--     "fontFamily": "Arial, sans-serif",
--     "maxWidth": "600px"
--   }
-- }
--
-- 2. SMS TEMPLATE SCHEMA (JSONB):
-- {
--   "message": "Hello {{firstName}}, your appointment is on {{date}} at {{time}}.",
--   "maxLength": 160,
--   "encoding": "GSM-7|UCS-2",
--   "variables": ["firstName", "date", "time"],
--   "characterCount": 68,
--   "segmentCount": 1
-- }
--
-- 3. PUSH NOTIFICATION SCHEMA (JSONB):
-- {
--   "title": "New Message",
--   "body": "You have a new message from {{sender}}",
--   "icon": "https://example.com/icon.png",
--   "image": "https://example.com/image.png",
--   "badge": 1,
--   "sound": "default",
--   "clickAction": "OPEN_APP",
--   "data": {
--     "action": "open_conversation",
--     "conversationId": "{{conversationId}}"
--   },
--   "actions": [
--     {"action": "reply", "title": "Reply"},
--     {"action": "dismiss", "title": "Dismiss"}
--   ]
-- }
--
-- KEY SCD FIELDS:
-- • id: NEVER changes (stable reference)
-- • version: Increments on template updates
-- • from_ts: Original creation timestamp
-- • updated_ts: Last modification timestamp
-- • to_ts: Soft delete timestamp
-- • active_flag: Soft delete flag
--
-- =====================================================

CREATE TABLE app.message_schema (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50),
    name varchar(200) NOT NULL,
    subject varchar(500),
    descr text,

    -- Delivery Method
    message_delivery_method varchar(50) NOT NULL CHECK (message_delivery_method IN ('EMAIL', 'SMS', 'PUSH')),

    -- Template Status
    status varchar(50) DEFAULT 'draft', -- draft, published, archived

    -- Message Template Schema (JSONB)
    -- Structure varies by message_delivery_method (see examples above)
    template_schema jsonb DEFAULT '{}'::jsonb,

    -- Email-specific Settings (only used when message_delivery_method = 'EMAIL')
    preview_text varchar(500), -- Email preview text
    from_name varchar(200),
    from_email varchar(200),
    reply_to_email varchar(200),

    -- SMS-specific Settings (only used when message_delivery_method = 'SMS')
    sms_sender_id varchar(20), -- Alphanumeric sender ID (e.g., 'HURON')

    -- PUSH-specific Settings (only used when message_delivery_method = 'PUSH')
    push_priority varchar(20), -- high, normal, low
    push_ttl integer, -- Time to live in seconds

    -- Temporal Tracking
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),

    -- In-Place Version Counter
    version integer DEFAULT 1,

    -- Metadata
    metadata jsonb DEFAULT '{}'::jsonb
);

-- =====================================================
-- SAMPLE DATA - Message Templates
-- =====================================================

-- EMAIL TEMPLATE: Welcome Email
INSERT INTO app.d_message_schema (
    id,
    code,
    name,
    subject,
    descr,
    message_delivery_method,
    status,
    template_schema,
    preview_text,
    from_name,
    from_email,
    reply_to_email,
    version,
    active_flag
) VALUES (
    'a1111111-1111-1111-1111-111111111111',
    'EMAIL_WEL001',
    'Welcome Email - New Customer',
    'Welcome to Huron Home Services!',
    'Welcome email template for new customers',
    'EMAIL',
    'published',
    '{
        "blocks": [
            {
                "id": "block-1",
                "type": "text",
                "content": "<h1>Welcome to Huron Home Services!</h1><p>We are excited to have you as our customer.</p>",
                "styles": {
                    "padding": "20px",
                    "textAlign": "center",
                    "backgroundColor": "#f8f9fa"
                }
            },
            {
                "id": "block-2",
                "type": "image",
                "content": "https://via.placeholder.com/600x200",
                "properties": {
                    "alt": "Welcome Banner",
                    "width": "100%"
                },
                "styles": {
                    "padding": "0"
                }
            },
            {
                "id": "block-3",
                "type": "text",
                "content": "<p>Thank you for choosing us for your home services needs. Our team is ready to serve you!</p>",
                "styles": {
                    "padding": "20px",
                    "fontSize": "16px",
                    "lineHeight": "1.6"
                }
            },
            {
                "id": "block-4",
                "type": "button",
                "content": "Get Started",
                "properties": {
                    "href": "https://huronhome.ca/get-started",
                    "target": "_blank"
                },
                "styles": {
                    "backgroundColor": "#007bff",
                    "color": "#ffffff",
                    "padding": "12px 24px",
                    "textAlign": "center",
                    "margin": "20px auto",
                    "borderRadius": "4px",
                    "display": "inline-block"
                }
            }
        ],
        "globalStyles": {
            "backgroundColor": "#ffffff",
            "fontFamily": "Arial, sans-serif",
            "maxWidth": "600px",
            "margin": "0 auto"
        }
    }'::jsonb,
    'Welcome to Huron Home Services - Your home services partner',
    'Huron Home Services',
    'info@huronhome.ca',
    'info@huronhome.ca',
    1,
    true
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    subject = EXCLUDED.subject,
    descr = EXCLUDED.descr,
    template_schema = EXCLUDED.template_schema,
    updated_ts = now();

-- SMS TEMPLATE: Appointment Reminder
INSERT INTO app.d_message_schema (
    id,
    code,
    name,
    subject,
    descr,
    message_delivery_method,
    status,
    template_schema,
    sms_sender_id,
    version,
    active_flag
) VALUES (
    'b2222222-2222-2222-2222-222222222222',
    'SMS_APT001',
    'SMS Appointment Reminder',
    'Appointment Reminder',
    'SMS template for appointment reminders',
    'SMS',
    'published',
    '{
        "message": "Hi {{firstName}}, this is a reminder that your {{serviceType}} appointment is scheduled for {{date}} at {{time}}. Location: {{address}}. Reply CONFIRM to confirm or CANCEL to reschedule. - Huron Home Services",
        "maxLength": 160,
        "encoding": "GSM-7",
        "variables": ["firstName", "serviceType", "date", "time", "address"],
        "characterCount": 158,
        "segmentCount": 1,
        "allowReplies": true,
        "keywordResponses": {
            "CONFIRM": "Thank you! Your appointment is confirmed.",
            "CANCEL": "We will contact you shortly to reschedule."
        }
    }'::jsonb,
    'HURON',
    1,
    true
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    subject = EXCLUDED.subject,
    descr = EXCLUDED.descr,
    template_schema = EXCLUDED.template_schema,
    updated_ts = now();

-- SMS TEMPLATE: Service Completion
INSERT INTO app.d_message_schema (
    id,
    code,
    name,
    subject,
    descr,
    message_delivery_method,
    status,
    template_schema,
    sms_sender_id,
    version,
    active_flag
) VALUES (
    'c3333333-3333-3333-3333-333333333333',
    'SMS_SVC001',
    'SMS Service Completion',
    'Service Completed',
    'SMS template for service completion notification',
    'SMS',
    'published',
    '{
        "message": "Your {{serviceType}} service is complete! Total: ${{amount}}. Rate us: {{surveyLink}}. Questions? Call {{phone}}. Thank you! - Huron",
        "maxLength": 160,
        "encoding": "GSM-7",
        "variables": ["serviceType", "amount", "surveyLink", "phone"],
        "characterCount": 145,
        "segmentCount": 1,
        "allowReplies": false
    }'::jsonb,
    'HURON',
    1,
    true
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    subject = EXCLUDED.subject,
    descr = EXCLUDED.descr,
    template_schema = EXCLUDED.template_schema,
    updated_ts = now();

-- PUSH TEMPLATE: New Message Notification
INSERT INTO app.d_message_schema (
    id,
    code,
    name,
    subject,
    descr,
    message_delivery_method,
    status,
    template_schema,
    push_priority,
    push_ttl,
    version,
    active_flag
) VALUES (
    'd4444444-4444-4444-4444-444444444444',
    'PUSH_MSG001',
    'Push New Message Notification',
    'New Message',
    'Push notification for new messages',
    'PUSH',
    'published',
    '{
        "title": "New Message from {{senderName}}",
        "body": "{{messagePreview}}",
        "icon": "https://huronhome.ca/icons/message-icon.png",
        "badge": "{{unreadCount}}",
        "sound": "default",
        "clickAction": "OPEN_CONVERSATION",
        "data": {
            "action": "open_conversation",
            "conversationId": "{{conversationId}}",
            "senderId": "{{senderId}}",
            "timestamp": "{{timestamp}}"
        },
        "actions": [
            {
                "action": "reply",
                "title": "Reply",
                "icon": "ic_reply"
            },
            {
                "action": "mark_read",
                "title": "Mark as Read",
                "icon": "ic_check"
            }
        ],
        "variables": ["senderName", "messagePreview", "unreadCount", "conversationId", "senderId", "timestamp"]
    }'::jsonb,
    'high',
    86400,
    1,
    true
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    subject = EXCLUDED.subject,
    descr = EXCLUDED.descr,
    template_schema = EXCLUDED.template_schema,
    updated_ts = now();

-- PUSH TEMPLATE: Service Technician En Route
INSERT INTO app.d_message_schema (
    id,
    code,
    name,
    subject,
    descr,
    message_delivery_method,
    status,
    template_schema,
    push_priority,
    push_ttl,
    version,
    active_flag
) VALUES (
    'e5555555-5555-5555-5555-555555555555',
    'PUSH_SVC001',
    'Push Technician En Route',
    'Technician On The Way',
    'Push notification when service technician is en route',
    'PUSH',
    'published',
    '{
        "title": "Your Technician is On The Way!",
        "body": "{{technicianName}} will arrive in {{eta}} minutes for your {{serviceType}} service.",
        "icon": "https://huronhome.ca/icons/truck-icon.png",
        "image": "{{technicianPhotoUrl}}",
        "badge": 1,
        "sound": "default",
        "clickAction": "TRACK_TECHNICIAN",
        "data": {
            "action": "track_technician",
            "technicianId": "{{technicianId}}",
            "appointmentId": "{{appointmentId}}",
            "latitude": "{{latitude}}",
            "longitude": "{{longitude}}"
        },
        "actions": [
            {
                "action": "track_location",
                "title": "Track Location",
                "icon": "ic_location"
            },
            {
                "action": "call_technician",
                "title": "Call",
                "icon": "ic_phone"
            }
        ],
        "variables": ["technicianName", "eta", "serviceType", "technicianPhotoUrl", "technicianId", "appointmentId", "latitude", "longitude"]
    }'::jsonb,
    'high',
    3600,
    1,
    true
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    subject = EXCLUDED.subject,
    descr = EXCLUDED.descr,
    template_schema = EXCLUDED.template_schema,
    updated_ts = now();

-- EMAIL TEMPLATE: Customer Feedback Request
INSERT INTO app.d_message_schema (
    id,
    code,
    name,
    subject,
    descr,
    message_delivery_method,
    status,
    template_schema,
    preview_text,
    from_name,
    from_email,
    reply_to_email,
    version,
    active_flag
) VALUES (
    'f6666666-6666-6666-6666-666666666666',
    'EMAIL_FBK001',
    'Customer Feedback Request',
    'We value your feedback!',
    'Email template for collecting customer feedback with embedded form',
    'EMAIL',
    'draft',
    '{
        "blocks": [
            {
                "id": "block-1",
                "type": "text",
                "content": "<h2>How was your experience?</h2><p>We would love to hear from you!</p>",
                "styles": {
                    "padding": "20px",
                    "textAlign": "center"
                }
            },
            {
                "id": "block-2",
                "type": "form",
                "properties": {
                    "formId": "ee8a6cfd-9d31-4705-b8f3-ad2d5589802c",
                    "formName": "Customer Feedback Form",
                    "embedType": "inline"
                },
                "styles": {
                    "padding": "20px",
                    "backgroundColor": "#f8f9fa"
                }
            },
            {
                "id": "block-3",
                "type": "text",
                "content": "<p>Thank you for taking the time to share your thoughts with us!</p>",
                "styles": {
                    "padding": "20px",
                    "fontSize": "14px",
                    "color": "#666666",
                    "textAlign": "center"
                }
            }
        ],
        "globalStyles": {
            "backgroundColor": "#ffffff",
            "fontFamily": "Arial, sans-serif",
            "maxWidth": "600px",
            "margin": "0 auto"
        }
    }'::jsonb,
    'Share your feedback - Huron Home Services',
    'Huron Home Services',
    'feedback@huronhome.ca',
    'feedback@huronhome.ca',
    1,
    true
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    subject = EXCLUDED.subject,
    descr = EXCLUDED.descr,
    template_schema = EXCLUDED.template_schema,
    updated_ts = now();
