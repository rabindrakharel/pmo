-- =====================================================
-- EMAIL TEMPLATE (d_email_template) - MARKETING
-- =====================================================
--
-- SEMANTICS:
-- • Visual email templates for marketing campaigns
-- • Block-based builder: text, images, forms, buttons, dividers
-- • Reusable layouts with JSONB schema
--
-- OPERATIONS:
-- • CREATE: POST /api/v1/email-template, INSERT with version=1
-- • UPDATE: PUT /api/v1/email-template/{id}, version++, in-place
-- • DELETE: active_flag=false, to_ts=now()
-- • LIST: GET /api/v1/email-template, RBAC filtered
--
-- KEY FIELDS:
-- • id: uuid PRIMARY KEY
-- • name, subject: varchar
-- • template_schema: jsonb ({"blocks": [{"type", "content", "styles"}]})
-- • template_type: varchar (marketing, transactional, notification)
--
-- RELATIONSHIPS:
-- • RBAC: entity_id_rbac_map
--
-- =====================================================
--   ],
--   "globalStyles": {
--     "backgroundColor": "#ffffff",
--     "fontFamily": "Arial, sans-serif",
--     "maxWidth": "600px"
--   }
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

CREATE TABLE app.d_email_template (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(100),
    code varchar(50),
    name varchar(200) NOT NULL,
    subject varchar(500) NOT NULL,
    descr text,
    -- Template Status
    status varchar(50) DEFAULT 'draft', -- draft, published, archived

    -- Visual Email Template Schema (JSONB)
    -- Structure: {"blocks": [{"id":"block-1","type":"text","content":"...","styles":{...}}]}
    template_schema jsonb DEFAULT '{"blocks": [], "globalStyles": {"backgroundColor": "#ffffff", "fontFamily": "Arial, sans-serif", "maxWidth": "600px"}}'::jsonb,

    -- Email Settings
    preview_text varchar(500), -- Email preview text
    from_name varchar(200),
    from_email varchar(200),
    reply_to_email varchar(200),

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
-- SAMPLE DATA - Email Templates
-- =====================================================

-- Welcome Email Template
INSERT INTO app.d_email_template (
    id,
    code,
    name,
    subject,
    descr,
    status,
    template_schema,
    preview_text,
    from_name,
    from_email,
    version,
    active_flag
) VALUES (
    'a1111111-1111-1111-1111-111111111111',
    'WEL001',
    'Welcome Email - New Customer',
    'Welcome to Huron Home Services!',
    'Welcome email template for new customers',
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
    1,
    true
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    subject = EXCLUDED.subject,
    descr = EXCLUDED.descr,
    template_schema = EXCLUDED.template_schema,
    updated_ts = now();

-- Customer Feedback Email Template
INSERT INTO app.d_email_template (
    id,
    code,
    name,
    subject,
    descr,
    status,
    template_schema,
    preview_text,
    from_name,
    from_email,
    version,
    active_flag
) VALUES (
    'b2222222-2222-2222-2222-222222222222',
    'FBK001',
    'Customer Feedback Request',
    'We value your feedback!',
    'Email template for collecting customer feedback with embedded form',
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
    1,
    true
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    subject = EXCLUDED.subject,
    descr = EXCLUDED.descr,
    template_schema = EXCLUDED.template_schema,
    updated_ts = now();
