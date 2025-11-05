-- =====================================================
-- Customer Interaction Fact Table (f_customer_interaction)
-- =====================================================
--
-- SEMANTICS:
-- Transaction-level fact table capturing all customer interaction events across multiple channels and formats.
-- Records voice calls, chat messages, emails, images, videos, and documents with chunks stored in S3.
-- Grain: One row per interaction event or interaction chunk (for multi-part interactions).
--
-- BUSINESS CONTEXT:
-- - Records complete customer communication history across all channels
-- - Supports omnichannel customer experience analytics and sentiment analysis
-- - Enables contact center performance tracking and quality assurance
-- - Foundation for customer journey mapping and touchpoint optimization
-- - Provides audit trail for compliance and dispute resolution
-- - Enables AI/ML analysis of customer interactions for insights
--
-- RELATIONSHIPS:
-- - Links to d_cust (customer dimension)
-- - Links to d_employee (agent/representative who handled interaction)
-- - Links to d_project (if interaction relates to specific project)
-- - Links to d_task (if interaction relates to specific task)
-- - Self-referencing for multi-chunk interactions (parent_interaction_id)
--
-- STORAGE MODEL:
-- - Metadata stored in database (similar to d_artifact)
-- - Actual content (voice, video, images, large text) stored in S3/MinIO
-- - Support for chunked interactions (e.g., long conversations split into segments)
-- - Presigned URLs for secure content access
--
-- METRICS:
-- - Interaction count, duration, response time, resolution time
-- - Customer satisfaction scores, sentiment analysis results
-- - Agent performance metrics, first contact resolution rates
-- - Channel preference analytics, peak interaction times
-- - Content size, storage costs, retention compliance
--
-- =====================================================

DROP TABLE IF EXISTS app.f_customer_interaction CASCADE;

CREATE TABLE app.f_customer_interaction (
    -- Primary Key
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Interaction Identification
    interaction_number varchar(50) NOT NULL UNIQUE,      -- Human-readable ID (e.g., INT-2025-00123)
    interaction_type varchar(50) NOT NULL,                -- 'voice_call', 'chat', 'email', 'sms', 'video_call', 'social_media', 'in_person'
    interaction_subtype varchar(50),                      -- 'inbound', 'outbound', 'follow_up', 'escalation'
    channel varchar(50) NOT NULL,                         -- 'phone', 'live_chat', 'whatsapp', 'email', 'facebook', 'twitter', 'zoom', 'in_store'

    -- Chunking Support (for multi-part interactions)
    chunk_number integer DEFAULT 1,                       -- Sequence number for chunked content
    total_chunks integer DEFAULT 1,                       -- Total chunks in this interaction
    parent_interaction_id uuid,                           -- References parent if this is a chunk
    is_primary_chunk boolean DEFAULT true,                -- True for main/first chunk

    -- Date/Time Dimensions
    interaction_date date NOT NULL,                       -- Date of interaction
    interaction_datetime timestamptz NOT NULL DEFAULT now(), -- Precise timestamp
    interaction_year integer,
    interaction_quarter integer,
    interaction_month integer,
    interaction_day_of_week integer,
    interaction_hour integer,

    -- Duration Metrics (in seconds)
    duration_seconds integer,                             -- Total duration of interaction
    wait_time_seconds integer,                            -- Customer wait time before connected
    talk_time_seconds integer,                            -- Active conversation time
    hold_time_seconds integer,                            -- Time customer was on hold
    after_call_work_seconds integer,                      -- Agent work after interaction

    -- Customer Dimension
    customer_id uuid,                                     -- Link to d_cust (NULL allowed for anonymous chat)
    customer_name varchar(255),                           -- Denormalized for performance
    customer_type varchar(50),                            -- 'residential', 'commercial', 'municipal'
    customer_tier varchar(50),                            -- Customer tier for analytics

    -- Employee/Agent Dimension
    agent_id uuid,                                        -- Employee who handled interaction
    agent_name varchar(255),                              -- Denormalized agent name
    team_id uuid,                                         -- Team assignment
    team_name varchar(255),                               -- Denormalized team
    supervisor_id uuid,                                   -- Supervisor for escalations

    -- Related Entity Context
    project_id uuid,                                      -- Link to d_project (if applicable)
    project_name varchar(255),                            -- Denormalized project
    task_id uuid,                                         -- Link to d_task (if applicable)
    task_name varchar(255),                               -- Denormalized task
    business_id uuid,                                     -- Link to d_business
    office_id uuid,                                       -- Link to d_office

    -- Content Storage (S3/MinIO similar to d_artifact)
    content_format varchar(50),                           -- 'mp3', 'wav', 'mp4', 'txt', 'json', 'jpg', 'png', 'pdf', 'html'
    content_size_bytes bigint,                            -- Size of content in bytes
    content_object_bucket text,                           -- S3 bucket name (e.g., 'pmo-interactions')
    content_object_key text,                              -- S3 object key path
    content_url text,                                     -- Full S3 URL (s3://bucket/key)
    content_mime_type varchar(100),                       -- MIME type (e.g., 'audio/mpeg', 'video/mp4')

    -- Inline Content (for small text interactions)
    content_text text,                                    -- Inline text for chat/email/SMS (up to ~10KB)
    content_summary text,                                 -- AI-generated summary of interaction

    -- Transcript Support (for voice/video)
    transcript_text text,                                 -- Speech-to-text transcript
    transcript_confidence_score decimal(5,2),             -- Transcription confidence (0-100)
    transcript_language varchar(10) DEFAULT 'en',         -- Language code (en, fr, es)

    -- Sentiment & Analytics
    sentiment_score decimal(5,2),                         -- Sentiment analysis (-100 to +100)
    sentiment_label varchar(20),                          -- 'positive', 'neutral', 'negative', 'mixed'
    customer_satisfaction_score integer,                  -- CSAT score (1-5 or 1-10)
    net_promoter_score integer,                           -- NPS score (-100 to +100)
    emotion_tags text[],                                  -- AI-detected emotions ['frustrated', 'satisfied', 'confused']

    -- Interaction Classification
    interaction_reason varchar(100),                      -- 'support_request', 'sales_inquiry', 'complaint', 'follow_up', 'information'
    interaction_category varchar(100),                    -- 'billing', 'technical_support', 'scheduling', 'general_inquiry'
    interaction_subcategory varchar(100),                 -- More specific categorization
    priority_level varchar(20) DEFAULT 'normal',          -- 'low', 'normal', 'high', 'urgent', 'critical'

    -- Resolution & Outcome
    resolution_status varchar(50) DEFAULT 'open',         -- 'open', 'pending', 'resolved', 'escalated', 'closed'
    resolution_type varchar(50),                          -- 'resolved_first_contact', 'transferred', 'callback_scheduled', 'unresolved'
    first_contact_resolution boolean DEFAULT false,       -- FCR metric
    escalation_required boolean DEFAULT false,            -- Was escalation needed
    escalation_level integer,                             -- Escalation tier (1, 2, 3)
    follow_up_required boolean DEFAULT false,             -- Does this need follow-up
    follow_up_due_date date,                              -- When follow-up is due

    -- Quality Assurance
    quality_score decimal(5,2),                           -- QA evaluation score (0-100)
    quality_reviewed_by uuid,                             -- Employee who reviewed
    quality_reviewed_at timestamptz,                      -- When reviewed
    compliance_flags text[],                              -- Compliance issues ['gdpr_concern', 'pci_violation']

    -- Technical Metadata
    device_type varchar(50),                              -- 'mobile', 'desktop', 'tablet', 'phone_system', 'kiosk'
    browser_user_agent text,                              -- For web-based interactions
    ip_address inet,                                      -- Source IP address
    geolocation jsonb,                                    -- {"latitude": 43.5890, "longitude": -79.6441, "city": "Oakville"}

    -- Status Flags
    active_flag boolean DEFAULT true,                     -- Record is active
    deleted_flag boolean DEFAULT false,                   -- Soft delete flag
    archived_flag boolean DEFAULT false,                  -- Archived for compliance retention
    recording_available boolean DEFAULT false,            -- Is recording available in S3
    transcript_available boolean DEFAULT false,           -- Is transcript available
    ai_analyzed boolean DEFAULT false,                    -- Has been processed by AI

    -- Privacy & Compliance
    gdpr_compliant boolean DEFAULT true,                  -- GDPR compliance flag
    data_retention_date date,                             -- When data should be purged
    pii_redacted boolean DEFAULT false,                   -- Has PII been redacted
    consent_recorded boolean DEFAULT false,               -- Customer consent for recording
    consent_type varchar(50),                             -- 'explicit', 'implicit', 'legal_basis'

    -- Integration & Source
    source_system varchar(50) DEFAULT 'pmo',              -- 'pmo', 'telephony_system', 'chat_widget', 'email_server', 'crm'
    external_id varchar(255),                             -- ID in source system
    integration_metadata jsonb DEFAULT '{}'::jsonb,       -- Source-specific metadata

    -- Attachments & Related Content
    attachment_count integer DEFAULT 0,                   -- Number of attachments
    attachment_ids uuid[],                                -- Array of artifact IDs
    related_interaction_ids uuid[],                       -- Related interaction IDs

    -- Financial Context
    order_value_cad decimal(12,2),                        -- Order value if sales interaction
    potential_revenue_cad decimal(12,2),                  -- Estimated potential revenue
    cost_to_serve_cad decimal(8,2),                       -- Cost of this interaction

    -- Custom Fields & Metadata
    tags text[],                                          -- Searchable tags ['urgent', 'vip', 'escalated']
    custom_fields jsonb DEFAULT '{}'::jsonb,              -- Flexible custom data
    metadata jsonb DEFAULT '{}'::jsonb,                   -- Additional metadata

    -- Audit Fields
    created_by_employee_id uuid,                          -- Who created this record
    created_ts timestamptz DEFAULT now(),                 -- When created
    updated_ts timestamptz DEFAULT now(),                 -- Last updated
    deleted_ts timestamptz,                               -- When soft deleted
    archived_ts timestamptz                               -- When archived
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_f_cust_interaction_number ON app.f_customer_interaction(interaction_number);
CREATE INDEX idx_f_cust_interaction_date ON app.f_customer_interaction(interaction_date);
CREATE INDEX idx_f_cust_interaction_datetime ON app.f_customer_interaction(interaction_datetime);
CREATE INDEX idx_f_cust_interaction_customer ON app.f_customer_interaction(customer_id);
CREATE INDEX idx_f_cust_interaction_agent ON app.f_customer_interaction(agent_id);
CREATE INDEX idx_f_cust_interaction_type ON app.f_customer_interaction(interaction_type);
CREATE INDEX idx_f_cust_interaction_channel ON app.f_customer_interaction(channel);
CREATE INDEX idx_f_cust_interaction_status ON app.f_customer_interaction(resolution_status);
CREATE INDEX idx_f_cust_interaction_project ON app.f_customer_interaction(project_id);
CREATE INDEX idx_f_cust_interaction_task ON app.f_customer_interaction(task_id);
CREATE INDEX idx_f_cust_interaction_parent ON app.f_customer_interaction(parent_interaction_id);
CREATE INDEX idx_f_cust_interaction_active ON app.f_customer_interaction(active_flag, deleted_flag) WHERE active_flag = true AND deleted_flag = false;

-- GIN indexes for array and JSONB columns
CREATE INDEX idx_f_cust_interaction_tags ON app.f_customer_interaction USING gin(tags);
CREATE INDEX idx_f_cust_interaction_metadata ON app.f_customer_interaction USING gin(metadata);
CREATE INDEX idx_f_cust_interaction_geolocation ON app.f_customer_interaction USING gin(geolocation);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Automatically populate date dimension fields
CREATE OR REPLACE FUNCTION app.populate_f_customer_interaction_date_dims() RETURNS TRIGGER AS $$
BEGIN
    NEW.interaction_date := NEW.interaction_datetime::date;
    NEW.interaction_year := EXTRACT(YEAR FROM NEW.interaction_datetime)::integer;
    NEW.interaction_quarter := EXTRACT(QUARTER FROM NEW.interaction_datetime)::integer;
    NEW.interaction_month := EXTRACT(MONTH FROM NEW.interaction_datetime)::integer;
    NEW.interaction_day_of_week := EXTRACT(DOW FROM NEW.interaction_datetime)::integer;
    NEW.interaction_hour := EXTRACT(HOUR FROM NEW.interaction_datetime)::integer;
    NEW.updated_ts := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER f_customer_interaction_populate_date_dims
    BEFORE INSERT OR UPDATE ON app.f_customer_interaction
    FOR EACH ROW EXECUTE FUNCTION app.populate_f_customer_interaction_date_dims();

-- =====================================================
-- CURATED SEED DATA
-- =====================================================

-- Sample Customer Interactions (Voice Calls)
INSERT INTO app.f_customer_interaction (
    interaction_number,
    interaction_type,
    interaction_subtype,
    channel,
    interaction_datetime,
    duration_seconds,
    wait_time_seconds,
    talk_time_seconds,
    customer_id,
    customer_name,
    customer_type,
    agent_id,
    agent_name,
    content_format,
    content_size_bytes,
    content_object_bucket,
    content_object_key,
    content_url,
    content_mime_type,
    recording_available,
    transcript_available,
    transcript_text,
    sentiment_score,
    sentiment_label,
    customer_satisfaction_score,
    interaction_reason,
    interaction_category,
    resolution_status,
    resolution_type,
    first_contact_resolution,
    tags,
    metadata
) VALUES
-- Call 1: Service inquiry from premium customer
(
    'INT-2025-00001',
    'voice_call',
    'inbound',
    'phone',
    '2025-01-15 09:30:00',
    420, 12, 408,
    (SELECT id FROM app.d_cust WHERE code = 'CL-RES-001'),
    'Thompson Family Residence',
    'residential',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    'James Miller',
    'mp3',
    2450000,
    'pmo-interactions',
    'voice/2025/01/INT-2025-00001.mp3',
    's3://pmo-interactions/voice/2025/01/INT-2025-00001.mp3',
    'audio/mpeg',
    true,
    true,
    'Customer called to inquire about spring landscaping package. Discussed timing, pricing, and added perennial border refresh. Customer expressed satisfaction with previous work. Scheduled site visit for February 15th.',
    85.5,
    'positive',
    5,
    'service_inquiry',
    'scheduling',
    'resolved',
    'resolved_first_contact',
    true,
    ARRAY['high_value', 'spring_service', 'repeat_customer'],
    '{"call_quality": "excellent", "customer_tone": "friendly", "service_requested": "spring_landscaping", "estimated_value": 12500.00, "scheduled_visit": "2025-02-15", "previous_satisfaction": "high"}'::jsonb
),

-- Call 2: Technical support escalation
(
    'INT-2025-00002',
    'voice_call',
    'inbound',
    'phone',
    '2025-01-15 14:20:00',
    680, 45, 635,
    (SELECT id FROM app.d_cust WHERE code = 'CL-COM-002'),
    'Sheridan College',
    'commercial',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    'James Miller',
    'mp3',
    3100000,
    'pmo-interactions',
    'voice/2025/01/INT-2025-00002.mp3',
    's3://pmo-interactions/voice/2025/01/INT-2025-00002.mp3',
    'audio/mpeg',
    true,
    true,
    'Customer reported irrigation system malfunction in Campus Section C. Initial troubleshooting unsuccessful. Escalated to technical team. Emergency service scheduled for next business day. Customer satisfied with response time.',
    -25.3,
    'negative',
    3,
    'technical_support',
    'equipment_malfunction',
    'escalated',
    'escalated',
    false,
    ARRAY['escalated', 'technical_issue', 'irrigation', 'enterprise'],
    '{"issue_type": "irrigation_malfunction", "location": "Campus Section C", "urgency": "high", "escalation_level": 2, "emergency_dispatch": true, "scheduled_repair": "2025-01-16", "impact": "moderate"}'::jsonb
);

-- Chat Interactions
INSERT INTO app.f_customer_interaction (
    interaction_number,
    interaction_type,
    interaction_subtype,
    channel,
    interaction_datetime,
    duration_seconds,
    customer_id,
    customer_name,
    customer_type,
    agent_id,
    agent_name,
    content_text,
    sentiment_score,
    sentiment_label,
    customer_satisfaction_score,
    interaction_reason,
    interaction_category,
    resolution_status,
    resolution_type,
    first_contact_resolution,
    tags,
    metadata
) VALUES
-- Chat 1: Quick billing question
(
    'INT-2025-00003',
    'chat',
    'inbound',
    'live_chat',
    '2025-01-16 10:15:00',
    180,
    (SELECT id FROM app.d_cust WHERE code = 'CL-RES-002'),
    'Martinez Family Home',
    'residential',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    'James Miller',
    E'Customer: Hi, I have a question about my January invoice.\nAgent: Hello! I''d be happy to help. What''s your question?\nCustomer: I see a charge for snow removal but we didn''t have service this month.\nAgent: Let me check... I see the issue. That was a pre-payment for February based on forecast. I''ll send you a revised invoice with clarification.\nCustomer: Oh, that makes sense. Thank you for explaining!\nAgent: You''re welcome! Anything else I can help with?\nCustomer: No, that''s all. Thanks!',
    72.0,
    'positive',
    5,
    'billing_inquiry',
    'billing',
    'resolved',
    'resolved_first_contact',
    true,
    ARRAY['billing', 'clarification', 'quick_resolution'],
    '{"chat_platform": "website_widget", "response_time_avg_seconds": 8, "customer_messages": 4, "agent_messages": 4, "resolution_time_seconds": 180}'::jsonb
),

-- Chat 2: Sales inquiry from new prospect
(
    'INT-2025-00004',
    'chat',
    'inbound',
    'live_chat',
    '2025-01-16 15:45:00',
    420,
    (SELECT id FROM app.d_cust WHERE code = 'CL-RES-004'),
    'Wilson Townhouse',
    'residential',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    'James Miller',
    E'Customer: I''m interested in landscaping services for a small townhouse yard.\nAgent: Great! I can help you with that. What type of services are you looking for?\nCustomer: I need seasonal cleanup and some simple plant maintenance. Nothing too elaborate.\nAgent: Perfect. For a townhouse, we offer our Silver package which includes bi-weekly maintenance and seasonal cleanups.\nCustomer: What''s the pricing?\nAgent: For a property your size, it would be around $500/month during growing season. I can schedule a free consultation to give you an exact quote.\nCustomer: That sounds good. Can we do next week?\nAgent: Absolutely! I have availability on Wednesday or Friday. Which works better?\nCustomer: Wednesday works. Morning if possible.\nAgent: Perfect! I''ll schedule you for Wednesday at 10 AM. You''ll receive a confirmation email shortly.\nCustomer: Thank you!',
    90.5,
    'positive',
    5,
    'sales_inquiry',
    'new_customer',
    'resolved',
    'consultation_scheduled',
    true,
    ARRAY['sales', 'new_customer', 'consultation_booked', 'townhouse'],
    '{"chat_platform": "website_widget", "service_interest": "landscaping", "package_discussed": "silver", "consultation_scheduled": "2025-01-22 10:00:00", "estimated_value": 6000.00, "property_type": "townhouse"}'::jsonb
);

-- Email Interactions
INSERT INTO app.f_customer_interaction (
    interaction_number,
    interaction_type,
    interaction_subtype,
    channel,
    interaction_datetime,
    customer_id,
    customer_name,
    customer_type,
    agent_id,
    agent_name,
    content_format,
    content_size_bytes,
    content_object_bucket,
    content_object_key,
    content_url,
    content_text,
    content_summary,
    sentiment_score,
    sentiment_label,
    interaction_reason,
    interaction_category,
    resolution_status,
    follow_up_required,
    tags,
    metadata
) VALUES
-- Email 1: Service feedback with photos
(
    'INT-2025-00005',
    'email',
    'outbound',
    'email',
    '2025-01-17 11:30:00',
    (SELECT id FROM app.d_cust WHERE code = 'CL-RES-003'),
    'The Chen Estate',
    'residential',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    'James Miller',
    'html',
    125000,
    'pmo-interactions',
    'email/2025/01/INT-2025-00005.html',
    's3://pmo-interactions/email/2025/01/INT-2025-00005.html',
    'Subject: Winter Garden Maintenance Completed

Dear Mr. Chen,

We have completed the winter maintenance service at your property as scheduled. Our team:
- Pruned ornamental trees and shrubs
- Applied winter protection to sensitive plants
- Cleared leaf debris from Japanese garden elements
- Inspected and serviced the irrigation system for spring

Attached are before/after photos of the completed work. Your garden is now prepared for the winter season and positioned for a beautiful spring bloom.

Please let me know if you have any questions or concerns.

Best regards,
James Miller
Huron Home Services',
    'Email sent to premium customer confirming completion of winter garden maintenance with before/after photos attached. All scheduled work completed including pruning, winter protection, debris clearing, and irrigation inspection.',
    NULL,
    NULL,
    'follow_up',
    'service_confirmation',
    'closed',
    false,
    ARRAY['service_complete', 'premium_customer', 'photo_documentation'],
    '{"email_type": "service_completion", "attachments": 4, "attachment_types": ["jpg", "jpg", "jpg", "pdf"], "service_completed": "winter_maintenance", "customer_tier": "gold", "auto_generated": false}'::jsonb
);

-- SMS Interactions
INSERT INTO app.f_customer_interaction (
    interaction_number,
    interaction_type,
    interaction_subtype,
    channel,
    interaction_datetime,
    customer_id,
    customer_name,
    customer_type,
    content_text,
    sentiment_score,
    sentiment_label,
    interaction_reason,
    interaction_category,
    resolution_status,
    tags,
    metadata
) VALUES
-- SMS 1: Appointment reminder
(
    'INT-2025-00006',
    'sms',
    'outbound',
    'sms',
    '2025-01-20 08:00:00',
    (SELECT id FROM app.d_cust WHERE code = 'CL-RES-001'),
    'Thompson Family Residence',
    'residential',
    'Hi Robert, this is James from Huron Home Services. Reminder: we have your site visit scheduled for tomorrow (Jan 21) at 2 PM to discuss your spring landscaping. Reply YES to confirm or CALL to reschedule. Thanks!',
    NULL,
    NULL,
    'appointment_reminder',
    'scheduling',
    'sent',
    ARRAY['automated', 'reminder', 'appointment'],
    '{"sms_type": "appointment_reminder", "appointment_date": "2025-01-21", "appointment_time": "14:00", "requires_confirmation": true, "automated": true}'::jsonb
);

-- Video Call Interactions
INSERT INTO app.f_customer_interaction (
    interaction_number,
    interaction_type,
    interaction_subtype,
    channel,
    interaction_datetime,
    duration_seconds,
    customer_id,
    customer_name,
    customer_type,
    agent_id,
    agent_name,
    content_format,
    content_size_bytes,
    content_object_bucket,
    content_object_key,
    content_url,
    content_mime_type,
    recording_available,
    content_summary,
    sentiment_score,
    sentiment_label,
    customer_satisfaction_score,
    interaction_reason,
    interaction_category,
    resolution_status,
    resolution_type,
    tags,
    metadata
) VALUES
-- Video call 1: Virtual consultation with commercial client
(
    'INT-2025-00007',
    'video_call',
    'scheduled',
    'zoom',
    '2025-01-18 14:00:00',
    1800,
    (SELECT id FROM app.d_cust WHERE code = 'CL-COM-001'),
    'Square One Shopping Centre',
    'commercial',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    'James Miller',
    'mp4',
    85000000,
    'pmo-interactions',
    'video/2025/01/INT-2025-00007.mp4',
    's3://pmo-interactions/video/2025/01/INT-2025-00007.mp4',
    'video/mp4',
    true,
    'Virtual consultation with Square One property management to review 2025 seasonal decoration plans. Presented 3D renderings of proposed installations. Discussed timeline, budget, and logistics. Client approved proposal with minor modifications to lighting scheme. Next steps: finalize contract and schedule installation crew.',
    92.0,
    'positive',
    5,
    'sales_consultation',
    'project_planning',
    'resolved',
    'proposal_approved',
    ARRAY['video_call', 'enterprise', 'proposal', 'approved', '3d_presentation'],
    '{"video_platform": "zoom", "participants": 4, "client_participants": ["Jennifer Walsh", "David Kim"], "presentation_slides": 15, "3d_models_shown": 3, "proposal_value": 120000.00, "decision": "approved_with_modifications", "next_meeting": "2025-02-01"}'::jsonb
);

-- Social Media Interactions
INSERT INTO app.f_customer_interaction (
    interaction_number,
    interaction_type,
    interaction_subtype,
    channel,
    interaction_datetime,
    customer_name,
    content_text,
    sentiment_score,
    sentiment_label,
    interaction_reason,
    interaction_category,
    resolution_status,
    tags,
    metadata
) VALUES
-- Social media 1: Public praise on Twitter
(
    'INT-2025-00008',
    'social_media',
    'inbound',
    'twitter',
    '2025-01-19 16:45:00',
    'Martinez Family Home',
    '@HuronHomeServices just transformed our front yard! The team was professional, on time, and the results are amazing. Highly recommend! #landscaping #Oakville',
    95.0,
    'positive',
    'testimonial',
    'customer_feedback',
    'acknowledged',
    ARRAY['social_media', 'positive_review', 'testimonial', 'public'],
    '{"platform": "twitter", "post_type": "tweet", "likes": 24, "retweets": 8, "replies": 3, "reach": 1250, "engagement_rate": 2.8, "sentiment": "very_positive", "response_posted": true, "response_time_minutes": 15}'::jsonb
);

-- Multi-chunk interaction example (long conversation split into parts)
INSERT INTO app.f_customer_interaction (
    interaction_number,
    interaction_type,
    interaction_subtype,
    channel,
    chunk_number,
    total_chunks,
    is_primary_chunk,
    interaction_datetime,
    duration_seconds,
    customer_id,
    customer_name,
    customer_type,
    agent_id,
    agent_name,
    content_format,
    content_size_bytes,
    content_object_bucket,
    content_object_key,
    content_url,
    content_mime_type,
    recording_available,
    transcript_text,
    sentiment_score,
    sentiment_label,
    interaction_reason,
    interaction_category,
    resolution_status,
    tags,
    metadata
) VALUES
-- Chunk 1 of 3: Initial contact and problem description
(
    'INT-2025-00009',
    'voice_call',
    'inbound',
    'phone',
    1,
    3,
    true,
    '2025-01-21 09:00:00',
    1200,
    (SELECT id FROM app.d_cust WHERE code = 'CL-COM-007'),
    'Amica Senior Living',
    'commercial',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    'James Miller',
    'mp3',
    5500000,
    'pmo-interactions',
    'voice/2025/01/INT-2025-00009-chunk1.mp3',
    's3://pmo-interactions/voice/2025/01/INT-2025-00009-chunk1.mp3',
    'audio/mpeg',
    true,
    'Part 1 of 3: Customer called regarding safety concerns with icy walkways. Discussed immediate salt application and long-term drainage solutions. Gathering property details and reviewing service agreement terms.',
    -15.0,
    'negative',
    'complaint',
    'safety_concern',
    'in_progress',
    ARRAY['multi_part', 'safety', 'urgent', 'part_1'],
    '{"call_segment": "initial_contact", "total_call_time": 3600, "issue": "ice_safety", "urgency": "high", "immediate_action": "dispatched_salt_crew"}'::jsonb
),

-- Chunk 2 of 3: Solution discussion and pricing
(
    'INT-2025-00009',
    'voice_call',
    'inbound',
    'phone',
    2,
    3,
    false,
    '2025-01-21 09:20:00',
    1200,
    (SELECT id FROM app.d_cust WHERE code = 'CL-COM-007'),
    'Amica Senior Living',
    'commercial',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    'James Miller',
    'mp3',
    5500000,
    'pmo-interactions',
    'voice/2025/01/INT-2025-00009-chunk2.mp3',
    's3://pmo-interactions/voice/2025/01/INT-2025-00009-chunk2.mp3',
    'audio/mpeg',
    true,
    'Part 2 of 3: Presented drainage improvement options with cost estimates. Discussed timeline for permanent solution. Customer expressed concern about budget constraints but acknowledged necessity for senior safety.',
    10.0,
    'neutral',
    'complaint',
    'safety_concern',
    'in_progress',
    ARRAY['multi_part', 'safety', 'urgent', 'part_2'],
    '{"call_segment": "solution_discussion", "options_presented": 3, "cost_range": "8000-15000", "budget_concern": true, "safety_priority": "highest"}'::jsonb
),

-- Chunk 3 of 3: Resolution and follow-up plan
(
    'INT-2025-00009',
    'voice_call',
    'inbound',
    'phone',
    3,
    3,
    false,
    '2025-01-21 09:40:00',
    1200,
    (SELECT id FROM app.d_cust WHERE code = 'CL-COM-007'),
    'Amica Senior Living',
    'commercial',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    'James Miller',
    'mp3',
    5500000,
    'pmo-interactions',
    'voice/2025/01/INT-2025-00009-chunk3.mp3',
    's3://pmo-interactions/voice/2025/01/INT-2025-00009-chunk3.mp3',
    'audio/mpeg',
    true,
    'Part 3 of 3: Agreed on phased approach - immediate salt/sand service plus drainage fix in spring. Customer satisfied with compromise solution. Emergency crew dispatched within 2 hours. Follow-up site visit scheduled.',
    75.0,
    'positive',
    'complaint',
    'safety_concern',
    'resolved',
    ARRAY['multi_part', 'safety', 'urgent', 'part_3', 'resolved'],
    '{"call_segment": "resolution", "solution": "phased_approach", "immediate_action_completed": true, "spring_project_scheduled": "2025-04-15", "customer_satisfaction": "improved", "follow_up_visit": "2025-01-25"}'::jsonb
);

-- =====================================================
-- UPDATE parent_interaction_id for chunks
-- =====================================================
DO $$
DECLARE
    parent_id uuid;
BEGIN
    SELECT id INTO parent_id FROM app.f_customer_interaction
    WHERE interaction_number = 'INT-2025-00009' AND chunk_number = 1;

    UPDATE app.f_customer_interaction
    SET parent_interaction_id = parent_id
    WHERE interaction_number = 'INT-2025-00009' AND chunk_number > 1;
END $$;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE app.f_customer_interaction IS 'Customer interaction fact table capturing omnichannel customer communications with S3 storage for multimedia content';
COMMENT ON COLUMN app.f_customer_interaction.chunk_number IS 'Sequence number for multi-part interactions (e.g., long calls split into segments)';
COMMENT ON COLUMN app.f_customer_interaction.parent_interaction_id IS 'Links to primary chunk for multi-part interactions';
COMMENT ON COLUMN app.f_customer_interaction.content_object_key IS 'S3 object key path for voice, video, or image content storage';
COMMENT ON COLUMN app.f_customer_interaction.transcript_text IS 'Speech-to-text transcript for voice/video interactions';
COMMENT ON COLUMN app.f_customer_interaction.sentiment_score IS 'AI-generated sentiment score ranging from -100 (very negative) to +100 (very positive)';
COMMENT ON COLUMN app.f_customer_interaction.first_contact_resolution IS 'FCR metric - was issue resolved in first interaction';
COMMENT ON COLUMN app.f_customer_interaction.data_retention_date IS 'Compliance-based date when interaction data should be purged';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Show interaction summary by type and channel
SELECT
    interaction_type,
    channel,
    COUNT(*) as interaction_count,
    AVG(duration_seconds) as avg_duration_seconds,
    SUM(CASE WHEN first_contact_resolution THEN 1 ELSE 0 END) as fcr_count,
    AVG(customer_satisfaction_score) as avg_csat,
    AVG(sentiment_score) as avg_sentiment
FROM app.f_customer_interaction
WHERE active_flag = true AND deleted_flag = false
GROUP BY interaction_type, channel
ORDER BY interaction_count DESC;

-- Show content storage summary
SELECT
    content_format,
    COUNT(*) as file_count,
    SUM(content_size_bytes) as total_size_bytes,
    AVG(content_size_bytes) as avg_size_bytes,
    MAX(content_size_bytes) as max_size_bytes
FROM app.f_customer_interaction
WHERE content_object_key IS NOT NULL
GROUP BY content_format
ORDER BY total_size_bytes DESC;

-- Show multi-chunk interactions
SELECT
    interaction_number,
    chunk_number,
    total_chunks,
    duration_seconds,
    resolution_status,
    LENGTH(transcript_text) as transcript_length
FROM app.f_customer_interaction
WHERE total_chunks > 1
ORDER BY interaction_number, chunk_number;
