-- =====================================================
-- WIKI ENTITY (d_wiki) - CONTENT ENTITY
-- Knowledge base with hierarchical page structure and publication workflow
-- =====================================================
--
-- BUSINESS PURPOSE:
-- Manages organizational knowledge base with wiki pages, templates, workflows, guides, and policies.
-- Supports hierarchical page structure, version tracking, publication workflow, and visibility controls.
-- Wiki pages can be linked to projects, tasks, or standalone knowledge repositories.
--
-- API SEMANTICS & LIFECYCLE:
--
-- 1. CREATE WIKI PAGE
--    • Endpoint: POST /api/v1/wiki
--    • Body: {name, code, wiki_type, category, page_path, parent_wiki_id, primary_entity_type, primary_entity_id}
--    • Returns: {id: "new-uuid", version: 1, publication_status: "draft", ...}
--    • Database: INSERT with version=1, active_flag=true, publication_status='draft', created_ts=now()
--    • RBAC: Requires permission 4 (create) on entity='wiki', entity_id='all'
--    • Business Rule: New pages default to 'draft' status; must be published explicitly
--
-- 2. UPDATE WIKI PAGE (Content Editing, Draft Revisions)
--    • Endpoint: PUT /api/v1/wiki/{id}
--    • Body: {name, descr, metadata, tags, publication_status, visibility}
--    • Returns: {id: "same-uuid", version: 2, updated_ts: "new-timestamp"}
--    • Database: UPDATE SET [fields], version=version+1, updated_ts=now() WHERE id=$1
--    • SCD Behavior: IN-PLACE UPDATE
--      - Same ID (preserves page path and entity relationships)
--      - version increments (audit trail of content changes)
--      - updated_ts refreshed
--      - NO archival (publication_status can change: draft → published → archived)
--    • RBAC: Requires permission 1 (edit) on entity='wiki', entity_id={id} OR 'all'
--    • Business Rule: Content changes increment version; actual content stored in d_wiki_data
--
-- 3. PUBLISH WIKI PAGE
--    • Frontend Action: User clicks "Publish" button on draft page
--    • Endpoint: PUT /api/v1/wiki/{id}
--    • Body: {publication_status: "published"}
--    • Database: UPDATE SET publication_status='published', published_at=now(), published_by_empid=$user_id, version=version+1 WHERE id=$1
--    • Business Rule: Publishes page to intended audience based on visibility setting
--
-- 4. ARCHIVE/DEPRECATE WIKI PAGE
--    • Endpoint: PUT /api/v1/wiki/{id}
--    • Body: {publication_status: "archived"}
--    • Database: UPDATE SET publication_status='archived', updated_ts=now(), version=version+1 WHERE id=$1
--    • Business Rule: Hides from active searches; preserves for historical reference
--
-- 5. SOFT DELETE WIKI PAGE
--    • Endpoint: DELETE /api/v1/wiki/{id}
--    • Database: UPDATE SET active_flag=false, to_ts=now() WHERE id=$1
--    • RBAC: Requires permission 3 (delete)
--    • Business Rule: Removes from all views; preserves content in d_wiki_data
--
-- 6. LIST WIKI PAGES (Filtered by Status, Type, Entity)
--    • Endpoint: GET /api/v1/wiki?publication_status=published&wiki_type=guide&limit=50
--    • Database:
--      SELECT w.* FROM d_wiki w
--      WHERE w.active_flag=true
--        AND EXISTS (
--          SELECT 1 FROM entity_id_rbac_map rbac
--          WHERE rbac.empid=$user_id
--            AND rbac.entity='wiki'
--            AND (rbac.entity_id=w.id::text OR rbac.entity_id='all')
--            AND 0=ANY(rbac.permission)  -- View permission
--        )
--      ORDER BY w.published_at DESC, w.name ASC
--      LIMIT $1 OFFSET $2
--    • RBAC: User sees ONLY wiki pages they have view access to
--    • Frontend: Renders in EntityMainPage with table view + search
--
-- 7. GET SINGLE WIKI PAGE (WITH CONTENT)
--    • Endpoint: GET /api/v1/wiki/{id}
--    • Database: SELECT * FROM d_wiki WHERE id=$1 AND active_flag=true
--    • RBAC: Checks entity_id_rbac_map for view permission
--    • Frontend: WikiContentRenderer displays formatted content from d_wiki_data
--
-- 8. GET WIKI HIERARCHY (Tree Structure)
--    • Endpoint: GET /api/v1/wiki/{id}/children
--    • Database:
--      SELECT w.* FROM d_wiki w
--      WHERE w.parent_wiki_id=$1
--        AND w.active_flag=true
--        AND w.publication_status='published'
--      ORDER BY w.sort_order, w.name
--    • Frontend: TreeView or nested navigation menu
--
-- KEY SCD FIELDS:
-- • id: Stable UUID (never changes, preserves page path and entity links)
-- • version: Increments on content updates (audit trail of revisions)
-- • from_ts: Page creation timestamp (never modified)
-- • to_ts: Page deletion timestamp (NULL=active, timestamptz=deleted)
-- • active_flag: Page status (true=active, false=deleted)
-- • created_ts: Original creation time (never modified)
-- • updated_ts: Last modification time (refreshed on UPDATE)
--
-- KEY BUSINESS FIELDS:
-- • wiki_type: Page classification ('page', 'template', 'workflow', 'guide', 'policy')
-- • publication_status: Workflow state ('draft', 'published', 'archived', 'deprecated')
--   - Loaded from setting_datalabel_wiki_publication_status via /api/v1/setting?category=wiki_publication_status
-- • page_path: Hierarchical path (/projects/methodology/agile) for URL routing
-- • parent_wiki_id: Hierarchical relationship (NULL for root pages, UUID for child pages)
-- • visibility: Access level ('public', 'internal', 'restricted', 'private')
-- • keywords: ARRAY for search indexing and SEO
-- • published_at, published_by_empid: Publication tracking for accountability
--
-- RELATIONSHIPS:
-- • parent_wiki_id → d_wiki (self-reference for hierarchical structure)
-- • published_by_empid → d_employee (who published the page)
-- • primary_entity_type, primary_entity_id: Links wiki to project/task/etc via entity_id_map
-- • wiki_id ← d_wiki_data (content versions stored separately)
--
-- =====================================================

CREATE TABLE app.d_wiki (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(100) UNIQUE NOT NULL,
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    tags jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,

    -- Wiki classification
    wiki_type varchar(50) DEFAULT 'page', -- page, template, workflow, guide, policy
    category varchar(100),

    -- Content structure
    page_path varchar(500), -- Hierarchical path like /projects/methodology/agile
    parent_wiki_id uuid ,
    sort_order integer DEFAULT 0,

    -- Publication status
    publication_status varchar(50) DEFAULT 'draft', -- draft, published, archived, deprecated
    published_at timestamptz,
    published_by_empid uuid,

    -- Access control
    visibility varchar(20) DEFAULT 'internal', -- public, internal, restricted, private
    read_access_groups varchar[] DEFAULT '{}',
    edit_access_groups varchar[] DEFAULT '{}',

    -- SEO and discovery
    keywords varchar[] DEFAULT '{}',
    summary text,

    -- Relationships (mapped via entity_id_map)
    primary_entity_type varchar(50), -- project, task, business, office
    primary_entity_id uuid,

    -- Temporal fields
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);



COMMENT ON TABLE app.d_wiki IS 'Knowledge base with hierarchical page structure';

-- =====================================================
-- DATA CURATION
-- Wiki entries for Fall 2024 Landscaping Campaign
-- =====================================================

-- Wiki 1: Fall Landscaping Best Practices Guide
INSERT INTO app.d_wiki (
    id,
    slug,
    code,
    name,
    descr,
    tags,
    metadata,
    wiki_type,
    category,
    page_path,
    publication_status,
    published_at,
    published_by_empid,
    visibility,
    keywords,
    summary,
    primary_entity_type,
    primary_entity_id
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    'fall-landscaping-best-practices',
    'WIKI-FLC-001',
    'Fall Landscaping Best Practices Guide',
    'Comprehensive guide for fall landscaping services including leaf cleanup, aeration, overseeding, and winterization techniques for Ontario residential and commercial properties.',
    '["landscaping", "fall", "best_practices", "seasonal", "guide", "ontario"]'::jsonb,
    '{"created_by": "James Miller", "audience": "field_crews", "last_reviewed": "2024-08-15", "review_frequency": "annual"}'::jsonb,
    'guide',
    'Landscaping Operations',
    '/projects/landscaping/fall-2024/best-practices',
    'published',
    '2024-08-15 10:00:00',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    'internal',
    ARRAY['fall', 'landscaping', 'aeration', 'overseeding', 'leaf_cleanup', 'winterization', 'ontario'],
    'Essential guidelines and techniques for delivering high-quality fall landscaping services, including equipment requirements, timing considerations, and quality standards.',
    'project',
    '84215ccb-313d-48f8-9c37-4398f28c0b1f'
);

-- Wiki 2: Equipment Maintenance and Safety Checklist
INSERT INTO app.d_wiki (
    id,
    slug,
    code,
    name,
    descr,
    tags,
    metadata,
    wiki_type,
    category,
    page_path,
    publication_status,
    published_at,
    published_by_empid,
    visibility,
    keywords,
    summary,
    primary_entity_type,
    primary_entity_id
) VALUES (
    '22222222-2222-2222-2222-222222222222',
    'equipment-maintenance-safety-checklist',
    'WIKI-FLC-002',
    'Equipment Maintenance and Safety Checklist',
    'Daily, weekly, and monthly maintenance checklists for landscaping equipment including mowers, aerators, blowers, and hand tools. Includes safety protocols and inspection procedures.',
    '["equipment", "maintenance", "safety", "checklist", "inspection", "tools"]'::jsonb,
    '{"created_by": "James Miller", "equipment_types": ["mowers", "aerators", "blowers", "hand_tools"], "compliance": "WSIB Ontario"}'::jsonb,
    'checklist',
    'Safety & Compliance',
    '/projects/landscaping/fall-2024/equipment-safety',
    'published',
    '2024-08-20 09:00:00',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    'internal',
    ARRAY['equipment', 'safety', 'maintenance', 'inspection', 'WSIB', 'compliance'],
    'Comprehensive equipment maintenance and safety procedures to ensure crew safety, equipment longevity, and regulatory compliance.',
    'project',
    '84215ccb-313d-48f8-9c37-4398f28c0b1f'
);

-- Wiki 3: Client Communication Templates
INSERT INTO app.d_wiki (
    id,
    slug,
    code,
    name,
    descr,
    tags,
    metadata,
    wiki_type,
    category,
    page_path,
    publication_status,
    published_at,
    published_by_empid,
    visibility,
    keywords,
    summary,
    primary_entity_type,
    primary_entity_id
) VALUES (
    '33333333-3333-3333-3333-333333333333',
    'client-communication-templates',
    'WIKI-FLC-003',
    'Client Communication Templates',
    'Professional email and message templates for client communication including service notifications, scheduling updates, weather delays, completion confirmations, and upsell opportunities.',
    '["communication", "templates", "client_service", "messaging", "professional"]'::jsonb,
    '{"created_by": "James Miller", "template_types": ["service_notification", "scheduling", "delays", "completion", "upsell"], "tone": "professional_friendly"}'::jsonb,
    'template',
    'Customer Service',
    '/projects/landscaping/fall-2024/client-templates',
    'published',
    '2024-08-25 14:00:00',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    'internal',
    ARRAY['communication', 'templates', 'client', 'customer_service', 'messaging'],
    'Ready-to-use communication templates for consistent, professional client interactions throughout the fall landscaping campaign.',
    'project',
    '84215ccb-313d-48f8-9c37-4398f28c0b1f'
);

-- Wiki 4: Fall Campaign Workflow Process
INSERT INTO app.d_wiki (
    id,
    slug,
    code,
    name,
    descr,
    tags,
    metadata,
    wiki_type,
    category,
    page_path,
    publication_status,
    published_at,
    published_by_empid,
    visibility,
    keywords,
    summary,
    primary_entity_type,
    primary_entity_id
) VALUES (
    '44444444-4444-4444-4444-444444444444',
    'fall-campaign-workflow-process',
    'WIKI-FLC-004',
    'Fall Campaign Workflow Process',
    'End-to-end workflow documentation for fall landscaping campaign from lead generation through service completion, invoicing, and follow-up. Includes role responsibilities and handoff points.',
    '["workflow", "process", "campaign", "operations", "procedures"]'::jsonb,
    '{"created_by": "James Miller", "process_stages": ["lead_gen", "scheduling", "service_delivery", "quality_check", "invoicing", "follow_up"], "roles": ["sales", "dispatcher", "crew_lead", "admin"]}'::jsonb,
    'workflow',
    'Operations Process',
    '/projects/landscaping/fall-2024/workflow',
    'published',
    '2024-09-01 08:00:00',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    'internal',
    ARRAY['workflow', 'process', 'operations', 'procedures', 'handoff'],
    'Step-by-step workflow process ensuring consistent service delivery and quality throughout the fall campaign.',
    'project',
    '84215ccb-313d-48f8-9c37-4398f28c0b1f'
);

-- Wiki 5: Seasonal Pricing Strategy
INSERT INTO app.d_wiki (
    id,
    slug,
    code,
    name,
    descr,
    tags,
    metadata,
    wiki_type,
    category,
    page_path,
    publication_status,
    published_at,
    published_by_empid,
    visibility,
    keywords,
    summary,
    primary_entity_type,
    primary_entity_id
) VALUES (
    '55555555-5555-5555-5555-555555555555',
    'seasonal-pricing-strategy',
    'WIKI-FLC-005',
    'Seasonal Pricing Strategy',
    'Pricing guidelines and strategies for fall landscaping services including package deals, volume discounts, early booking incentives, and competitive positioning for Ontario market.',
    '["pricing", "strategy", "seasonal", "packages", "discounts", "revenue"]'::jsonb,
    '{"created_by": "James Miller", "price_categories": ["residential", "commercial", "package_deals"], "discount_types": ["early_bird", "volume", "loyalty"], "market": "Ontario"}'::jsonb,
    'policy',
    'Sales & Pricing',
    '/projects/landscaping/fall-2024/pricing',
    'published',
    '2024-08-10 11:00:00',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    'restricted',
    ARRAY['pricing', 'strategy', 'revenue', 'packages', 'discounts', 'sales'],
    'Comprehensive pricing strategy for fall landscaping services designed to maximize revenue while maintaining competitive positioning.',
    'project',
    '84215ccb-313d-48f8-9c37-4398f28c0b1f'
);