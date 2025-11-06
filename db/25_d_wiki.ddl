-- =====================================================
-- WIKI ENTITY (d_wiki) - KNOWLEDGE BASE
-- =====================================================
--
-- SEMANTICS:
-- • Organizational knowledge base with hierarchical pages, templates, guides, policies
-- • Publication workflow (draft→published→archived), version tracking, visibility controls
-- • Content stored in d_wiki_data; this table tracks metadata
--
-- OPERATIONS:
-- • CREATE: POST /api/v1/wiki, INSERT with publication_status='draft', version=1
-- • UPDATE: PUT /api/v1/wiki/{id}, same ID, version++, in-place
-- • PUBLISH: Update publication_status='published', sets published_ts
-- • ARCHIVE: Update publication_status='archived', hides from searches
-- • DELETE: active_flag=false, to_ts=now(), preserves d_wiki_data
-- • LIST: Filter by publication_status, wiki_type, entity, RBAC enforced
--
-- KEY FIELDS:
-- • id: uuid PRIMARY KEY (stable)
-- • code, page_path: varchar (unique page identifier)
-- • wiki_type, category: varchar (type classification)
-- • dl__wiki_publication_status: text (draft, review, published, archived, deprecated)
-- • parent_wiki_id: uuid (hierarchical structure)
-- • entity_type, entity_id: text, uuid (parent entity link)
-- • visibility: text (public, internal, restricted)
-- • published_ts, published_by_empid: timestamptz, uuid
--
-- RELATIONSHIPS:
-- • Parent: project, task (via entity_type/entity_id)
-- • Self: parent_wiki_id → d_wiki.id (hierarchical pages)
-- • Data: d_wiki_data (actual content)
-- • RBAC: entity_id_rbac_map
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
--      ORDER BY w.published_ts DESC, w.name ASC
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
-- • published_ts, published_by_empid: Publication tracking for accountability
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
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    internal_url varchar(500),   -- Internal wiki URL: /wiki/{id} (authenticated access)
    shared_url varchar(500),     -- Public shared URL: /wiki/shared/{8-char-random} (presigned, no auth required)
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
    published_ts timestamptz,
    published_by_empid uuid,

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



COMMENT ON TABLE app.d_wiki IS 'Knowledge base with hierarchical page structure';