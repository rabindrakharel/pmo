-- =====================================================
-- WIKI ENTITY (d_wiki) - HEAD TABLE
-- Knowledge pages and workflow documentation
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