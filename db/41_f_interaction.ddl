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
-- - Supports polymorphic person entity references (customers, employees, clients)
-- - Tracks interaction intentions (tasks, projects, quotes to be created)
--
-- RELATIONSHIPS (via JSONB, no foreign keys):
-- - interaction_person_entities → polymorphic array linking to d_cust, d_employee, d_client
-- - metadata can store project_id, task_id references
-- - parent_interaction_id → self-referencing for multi-chunk interactions
-- - attachment_ids → array of artifact IDs for related documents/files
--
-- STORAGE MODEL:
-- - Metadata stored in database (similar to d_artifact)
-- - Actual content (voice, video, images, large text) stored in S3/MinIO
-- - Support for chunked interactions (e.g., long conversations split into segments)
-- - Presigned URLs for secure content access
-- - Person entities stored as JSONB array for flexibility
--
-- KEY FIELDS:
-- - interaction_person_entities: JSONB array of {person_entity_type, person_entity_id}
-- - interaction_intention_entity: varchar(50) indicating what to create next (task, quote, etc.)
-- - interaction_ts: timestamptz for when interaction occurred
-- - chunk_number/total_chunks: for splitting long interactions
-- - content_*: S3 storage references
-- - sentiment_*: AI analysis results
-- - metadata: flexible JSONB for additional context
--
-- METRICS:
-- - Interaction count, duration, response time
-- - Customer satisfaction scores, sentiment analysis results
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
    interaction_ts timestamptz,

    -- Duration Metrics (in seconds)
    duration_seconds integer,                             -- Total duration of interaction
    wait_time_seconds integer,                            -- Customer wait time before connected
    talk_time_seconds integer,                            -- Active conversation time
    hold_time_seconds integer,                            -- Time customer was on hold
    after_call_work_seconds integer,                      -- Agent work after interaction

    -- Person Entities (polymorphic references to employees, clients, customers)
    -- Stored as JSONB array: [{"person_entity_type": "customer", "person_entity_id": "uuid"}, {"person_entity_type": "employee", "person_entity_id": "uuid"}]
    interaction_person_entities jsonb DEFAULT '[]'::jsonb,

    -- Interaction Intention (what entity should be created from this interaction)
    -- Values: 'task', 'project', 'quote', 'opportunity', etc.
    interaction_intention_entity varchar(50),

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


    consent_recorded boolean DEFAULT false,               -- Customer consent for recording
    consent_type varchar(50),                             -- 'explicit', 'implicit', 'legal_basis'

    -- Integration & Source
    source_system varchar(50) DEFAULT 'pmo',              -- 'pmo', 'telephony_system', 'chat_widget', 'email_server', 'crm'

    -- Attachments & Related Content
    attachment_count integer DEFAULT 0,                   -- Number of attachments
    attachment_ids uuid[],                                -- Array of artifact IDs, goes via s3 services 
    related_interaction_ids uuid[],                       -- Related interaction IDs


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
CREATE INDEX idx_f_cust_interaction_ts ON app.f_customer_interaction(interaction_ts);
CREATE INDEX idx_f_cust_interaction_type ON app.f_customer_interaction(interaction_type);
CREATE INDEX idx_f_cust_interaction_channel ON app.f_customer_interaction(channel);
CREATE INDEX idx_f_cust_interaction_parent ON app.f_customer_interaction(parent_interaction_id);
CREATE INDEX idx_f_cust_interaction_sentiment ON app.f_customer_interaction(sentiment_label) WHERE sentiment_label IS NOT NULL;

-- GIN indexes for array and JSONB columns
CREATE INDEX idx_f_cust_interaction_person_entities ON app.f_customer_interaction USING gin(interaction_person_entities);
CREATE INDEX idx_f_cust_interaction_metadata ON app.f_customer_interaction USING gin(metadata);
CREATE INDEX idx_f_cust_interaction_emotion_tags ON app.f_customer_interaction USING gin(emotion_tags);
CREATE INDEX idx_f_cust_interaction_attachment_ids ON app.f_customer_interaction USING gin(attachment_ids);
CREATE INDEX idx_f_cust_interaction_related_ids ON app.f_customer_interaction USING gin(related_interaction_ids);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Automatically update updated_ts timestamp
CREATE OR REPLACE FUNCTION app.update_f_customer_interaction_ts() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_ts := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER f_customer_interaction_update_ts
    BEFORE UPDATE ON app.f_customer_interaction
    FOR EACH ROW EXECUTE FUNCTION app.update_f_customer_interaction_ts();

-- =====================================================
-- CURATED SEED DATA
-- =====================================================

-- Sample Customer Interactions (Voice Calls)
INSERT INTO app.f_customer_interaction (
    interaction_number,
    interaction_type,
    interaction_subtype,
    channel,
    interaction_ts,
    duration_seconds,
    wait_time_seconds,
    talk_time_seconds,
    interaction_person_entities,
    content_format,
    content_size_bytes,
    content_object_bucket,
    content_object_key,
    content_url,
    content_mime_type,
    transcript_text,
    transcript_confidence_score,
    sentiment_score,
    sentiment_label,
    customer_satisfaction_score,
    emotion_tags,
    interaction_reason,
    interaction_category,
    priority_level,
    consent_recorded,
    metadata
) VALUES
-- Call 1: Service inquiry from premium customer
(
    'INT-2025-00001',
    'voice_call',
    'inbound',
    'phone',
    '2025-01-15 09:30:00-05'::timestamptz,
    420, 12, 408,
    jsonb_build_array(
        jsonb_build_object('person_entity_type', 'customer', 'person_entity_id', (SELECT id FROM app.d_cust WHERE code = 'CL-RES-001')),
        jsonb_build_object('person_entity_type', 'employee', 'person_entity_id', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13')
    ),
    'mp3',
    2450000,
    'pmo-interactions',
    'voice/2025/01/INT-2025-00001.mp3',
    's3://pmo-interactions/voice/2025/01/INT-2025-00001.mp3',
    'audio/mpeg',
    'Customer called to inquire about spring landscaping package. Discussed timing, pricing, and added perennial border refresh. Customer expressed satisfaction with previous work. Scheduled site visit for February 15th.',
    95.5,
    85.5,
    'positive',
    5,
    ARRAY['satisfied', 'interested', 'friendly'],
    'service_inquiry',
    'scheduling',
    'normal',
    true,
    '{"call_quality": "excellent", "customer_tone": "friendly", "service_requested": "spring_landscaping", "estimated_value": 12500.00, "scheduled_visit": "2025-02-15", "previous_satisfaction": "high"}'::jsonb
),

-- Call 2: Technical support escalation
(
    'INT-2025-00002',
    'voice_call',
    'inbound',
    'phone',
    '2025-01-15 14:20:00-05'::timestamptz,
    680, 45, 635,
    jsonb_build_array(
        jsonb_build_object('person_entity_type', 'customer', 'person_entity_id', (SELECT id FROM app.d_cust WHERE code = 'CL-COM-002')),
        jsonb_build_object('person_entity_type', 'employee', 'person_entity_id', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13')
    ),
    'mp3',
    3100000,
    'pmo-interactions',
    'voice/2025/01/INT-2025-00002.mp3',
    's3://pmo-interactions/voice/2025/01/INT-2025-00002.mp3',
    'audio/mpeg',
    'Customer reported irrigation system malfunction in Campus Section C. Initial troubleshooting unsuccessful. Escalated to technical team. Emergency service scheduled for next business day. Customer satisfied with response time.',
    92.0,
    -25.3,
    'negative',
    3,
    ARRAY['frustrated', 'concerned', 'urgent'],
    'technical_support',
    'equipment_malfunction',
    'urgent',
    true,
    '{"issue_type": "irrigation_malfunction", "location": "Campus Section C", "urgency": "high", "escalation_level": 2, "emergency_dispatch": true, "scheduled_repair": "2025-01-16", "impact": "moderate"}'::jsonb
);

-- Chat Interactions
INSERT INTO app.f_customer_interaction (
    interaction_number,
    interaction_type,
    interaction_subtype,
    channel,
    interaction_ts,
    duration_seconds,
    interaction_person_entities,
    content_text,
    sentiment_score,
    sentiment_label,
    customer_satisfaction_score,
    emotion_tags,
    interaction_reason,
    interaction_category,
    priority_level,
    consent_recorded,
    metadata
) VALUES
-- Chat 1: Quick billing question
(
    'INT-2025-00003',
    'chat',
    'inbound',
    'live_chat',
    '2025-01-16 10:15:00-05'::timestamptz,
    180,
    jsonb_build_array(
        jsonb_build_object('person_entity_type', 'customer', 'person_entity_id', (SELECT id FROM app.d_cust WHERE code = 'CL-RES-002')),
        jsonb_build_object('person_entity_type', 'employee', 'person_entity_id', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13')
    ),
    E'Customer: Hi, I have a question about my January invoice.\nAgent: Hello! I''d be happy to help. What''s your question?\nCustomer: I see a charge for snow removal but we didn''t have service this month.\nAgent: Let me check... I see the issue. That was a pre-payment for February based on forecast. I''ll send you a revised invoice with clarification.\nCustomer: Oh, that makes sense. Thank you for explaining!\nAgent: You''re welcome! Anything else I can help with?\nCustomer: No, that''s all. Thanks!',
    72.0,
    'positive',
    5,
    ARRAY['satisfied', 'relieved'],
    'billing_inquiry',
    'billing',
    'normal',
    true,
    '{"chat_platform": "website_widget", "response_time_avg_seconds": 8, "customer_messages": 4, "agent_messages": 4, "resolution_time_seconds": 180}'::jsonb
),

-- Chat 2: Sales inquiry from new prospect
(
    'INT-2025-00004',
    'chat',
    'inbound',
    'live_chat',
    '2025-01-16 15:45:00-05'::timestamptz,
    420,
    jsonb_build_array(
        jsonb_build_object('person_entity_type', 'customer', 'person_entity_id', (SELECT id FROM app.d_cust WHERE code = 'CL-RES-004')),
        jsonb_build_object('person_entity_type', 'employee', 'person_entity_id', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13')
    ),
    E'Customer: I''m interested in landscaping services for a small townhouse yard.\nAgent: Great! I can help you with that. What type of services are you looking for?\nCustomer: I need seasonal cleanup and some simple plant maintenance. Nothing too elaborate.\nAgent: Perfect. For a townhouse, we offer our Silver package which includes bi-weekly maintenance and seasonal cleanups.\nCustomer: What''s the pricing?\nAgent: For a property your size, it would be around $500/month during growing season. I can schedule a free consultation to give you an exact quote.\nCustomer: That sounds good. Can we do next week?\nAgent: Absolutely! I have availability on Wednesday or Friday. Which works better?\nCustomer: Wednesday works. Morning if possible.\nAgent: Perfect! I''ll schedule you for Wednesday at 10 AM. You''ll receive a confirmation email shortly.\nCustomer: Thank you!',
    90.5,
    'positive',
    5,
    ARRAY['interested', 'satisfied', 'enthusiastic'],
    'sales_inquiry',
    'new_customer',
    'normal',
    true,
    '{"chat_platform": "website_widget", "service_interest": "landscaping", "package_discussed": "silver", "consultation_scheduled": "2025-01-22 10:00:00", "estimated_value": 6000.00, "property_type": "townhouse", "interaction_intention": "task"}'::jsonb
);


-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE app.f_customer_interaction IS 'Customer interaction fact table capturing omnichannel customer communications with S3 storage for multimedia content. Uses JSONB for polymorphic person entity references.';
COMMENT ON COLUMN app.f_customer_interaction.interaction_number IS 'Human-readable unique identifier (e.g., INT-2025-00123)';
COMMENT ON COLUMN app.f_customer_interaction.interaction_person_entities IS 'JSONB array of person entities involved: [{"person_entity_type": "customer|employee|client", "person_entity_id": "uuid"}]';
COMMENT ON COLUMN app.f_customer_interaction.interaction_intention_entity IS 'What entity type should be created from this interaction (task, project, quote, etc.)';
COMMENT ON COLUMN app.f_customer_interaction.chunk_number IS 'Sequence number for multi-part interactions (e.g., long calls split into segments)';
COMMENT ON COLUMN app.f_customer_interaction.parent_interaction_id IS 'Links to primary chunk for multi-part interactions';
COMMENT ON COLUMN app.f_customer_interaction.content_object_key IS 'S3 object key path for voice, video, or image content storage';
COMMENT ON COLUMN app.f_customer_interaction.transcript_text IS 'Speech-to-text transcript for voice/video interactions';
COMMENT ON COLUMN app.f_customer_interaction.sentiment_score IS 'AI-generated sentiment score ranging from -100 (very negative) to +100 (very positive)';
COMMENT ON COLUMN app.f_customer_interaction.emotion_tags IS 'AI-detected emotions array (e.g., [frustrated, satisfied, confused])';
COMMENT ON COLUMN app.f_customer_interaction.attachment_ids IS 'Array of artifact UUIDs for related documents/files';
COMMENT ON COLUMN app.f_customer_interaction.metadata IS 'Flexible JSONB for additional context (project_id, task_id, meeting details, etc.)';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Show interaction summary by type and channel
-- SELECT
--     interaction_type,
--     channel,
--     COUNT(*) as interaction_count,
--     AVG(duration_seconds) as avg_duration_seconds,
--     AVG(customer_satisfaction_score) as avg_csat,
--     AVG(sentiment_score) as avg_sentiment
-- FROM app.f_customer_interaction
-- WHERE deleted_ts IS NULL
-- GROUP BY interaction_type, channel
-- ORDER BY interaction_count DESC;

-- Show content storage summary
-- SELECT
--     content_format,
--     COUNT(*) as file_count,
--     SUM(content_size_bytes) as total_size_bytes,
--     AVG(content_size_bytes) as avg_size_bytes,
--     MAX(content_size_bytes) as max_size_bytes
-- FROM app.f_customer_interaction
-- WHERE content_object_key IS NOT NULL
-- GROUP BY content_format
-- ORDER BY total_size_bytes DESC;

-- Show multi-chunk interactions
-- SELECT
--     interaction_number,
--     chunk_number,
--     total_chunks,
--     duration_seconds,
--     LENGTH(transcript_text) as transcript_length
-- FROM app.f_customer_interaction
-- WHERE total_chunks > 1
-- ORDER BY interaction_number, chunk_number;

-- Query person entities from interactions
-- SELECT
--     interaction_number,
--     interaction_type,
--     interaction_ts,
--     interaction_person_entities
-- FROM app.f_customer_interaction
-- WHERE interaction_person_entities IS NOT NULL
-- ORDER BY interaction_ts DESC
-- LIMIT 10;
