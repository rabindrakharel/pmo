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
--    • Body: {name, code, wiki_type, category, page_path, parent__wiki_id, primary_entity_type, primary_entity_id}
--    • Returns: {id: "new-uuid", version: 1, publication_status: "draft", ...}
--    • Database: INSERT with version=1, active_flag=true, publication_status='draft', created_ts=now()
--    • RBAC: Requires permission 4 (create) on entity='wiki', entity_id='11111111-1111-1111-1111-111111111111'
--    • Business Rule: New pages default to 'draft' status; must be published explicitly
--
-- 2. UPDATE WIKI PAGE (Content Editing, Draft Revisions)
--    • Endpoint: PUT /api/v1/wiki/{id}
--    • Body: {name, descr, metadata, publication_status, visibility}
--    • Returns: {id: "same-uuid", version: 2, updated_ts: "new-timestamp"}
--    • Database: UPDATE SET [fields], version=version+1, updated_ts=now() WHERE id=$1
--    • SCD Behavior: IN-PLACE UPDATE
--      - Same ID (preserves page path and entity relationships)
--      - version increments (audit trail of content changes)
--      - updated_ts refreshed
--      - NO archival (publication_status can change: draft → published → archived)
--    • RBAC: Requires permission 1 (edit) on entity='wiki', entity_id={id} OR '11111111-1111-1111-1111-111111111111'
--    • Business Rule: Content changes increment version; actual content stored in d_wiki_data
--
-- 3. PUBLISH WIKI PAGE
--    • Frontend Action: User clicks "Publish" button on draft page
--    • Endpoint: PUT /api/v1/wiki/{id}
--    • Body: {publication_status: "published"}
--    • Database: UPDATE SET publication_status='published', published_ts=now(), published_by__employee_id=$user_id, version=version+1 WHERE id=$1
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
--          SELECT 1 FROM entity_rbac rbac
--          WHERE rbac.person_code='employee' AND rbac.person_id=$user_id
--            AND rbac.entity='wiki'
--            AND (rbac.entity_id=w.id::text OR rbac.entity_id='11111111-1111-1111-1111-111111111111')
--            AND 0=ANY(rbac.permission)  -- View permission
--        )
--      ORDER BY w.published_ts DESC, w.name ASC
--      LIMIT $1 OFFSET $2
--    • RBAC: User sees ONLY wiki pages they have view access to
--    • Frontend: Renders in EntityListOfInstancesPage with table view + search
--
-- 7. GET SINGLE WIKI PAGE (WITH CONTENT)
--    • Endpoint: GET /api/v1/wiki/{id}
--    • Database: SELECT * FROM d_wiki WHERE id=$1 AND active_flag=true
--    • RBAC: Checks entity_rbac for view permission
--    • Frontend: WikiContentRenderer displays formatted content from d_wiki_data
--
-- 8. GET WIKI HIERARCHY (Tree Structure)
--    • Endpoint: GET /api/v1/wiki/{id}/children
--    • Database:
--      SELECT w.* FROM d_wiki w
--      WHERE w.parent__wiki_id=$1
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
--   - Loaded from app.datalabel via /api/v1/setting?category=wiki_publication_status
-- • page_path: Hierarchical path (/projects/methodology/agile) for URL routing
-- • parent__wiki_id: Hierarchical relationship (NULL for root pages, UUID for child pages)
-- • visibility: Access level ('public', 'internal', 'restricted', 'private')
-- • keywords: ARRAY for search indexing and SEO
-- • published_ts, published_by_empid: Publication tracking for accountability
--
-- RELATIONSHIPS:
-- • parent__wiki_id → d_wiki (self-reference for hierarchical structure)
-- • published_by__employee_id → app.employee (who published the page)
-- • primary_entity_type, primary_entity_id: Links wiki to project/task/etc via entity_id_map
-- • wiki_id ← d_wiki_data (content versions stored separately)
--
-- =====================================================

CREATE TABLE app.wiki (
    id uuid DEFAULT gen_random_uuid(),
    code varchar(50),
    name varchar(200),
    descr text,
    internal_url varchar(500),   -- Internal wiki URL: /wiki/{id} (authenticated access)
    shared_url varchar(500),     -- Public shared URL: /wiki/shared/{8-char-random} (presigned, no auth required)
    metadata jsonb DEFAULT '{}'::jsonb,

    -- Wiki classification
    wiki_type varchar(50) DEFAULT 'page', -- page, template, workflow, guide, policy
    category varchar(100),

    -- Content structure
    page_path varchar(500), -- Hierarchical path like /projects/methodology/agile
    parent__wiki_id uuid ,
    sort_order integer DEFAULT 0,

    -- Publication status
    publication_status varchar(50) DEFAULT 'draft', -- draft, published, archived, deprecated
    published_ts timestamptz,
    published_by__employee_id uuid,

    -- Access control
    visibility varchar(20) DEFAULT 'internal', -- public, internal, restricted, private
    read_access_groups varchar[] DEFAULT '{}',
    edit_access_groups varchar[] DEFAULT '{}',

    -- SEO and discovery
    keywords varchar[] DEFAULT '{}',
    summary text,

    -- Content (block-based structure for wiki editor)
    content jsonb DEFAULT NULL,

    -- Relationships (mapped via entity_id_map)
    primary_entity_type varchar(50), -- project, task, business, office
    primary_entity_id uuid,

    -- Temporal fields
    active_flag boolean DEFAULT true,
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);



COMMENT ON TABLE app.wiki IS 'Knowledge base with hierarchical page structure';