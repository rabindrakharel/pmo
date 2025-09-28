-- =====================================================
-- WIKI DATA (d_wiki_data) - DATA TABLE
-- Wiki content with markdown/HTML and change tracking
-- =====================================================

CREATE TABLE app.d_wiki_data (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    wiki_id uuid NOT NULL REFERENCES app.d_wiki(id) ON DELETE CASCADE,

    -- Content storage
    content_markdown text,
    content_html text,
    content_metadata jsonb DEFAULT '{}'::jsonb,

    -- Data stage
    stage varchar(20) NOT NULL DEFAULT 'draft', -- draft, saved

    -- Update information
    updated_by_empid uuid NOT NULL,
    update_type varchar(50) DEFAULT 'content_edit', -- content_edit, structure_change, metadata_update
    change_summary text,
    change_description text,

    -- Content analysis
    word_count integer,
    reading_time_minutes integer,

    -- Linked content
    internal_links varchar[] DEFAULT '{}', -- Links to other wiki pages
    external_links varchar[] DEFAULT '{}', -- External URLs
    attached_artifacts uuid[] DEFAULT '{}', -- Related artifact IDs

    -- Temporal fields
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

-- Indexes for wiki data
CREATE INDEX idx_wiki_data_wiki_id ON app.d_wiki_data(wiki_id);
CREATE INDEX idx_wiki_data_updated_by ON app.d_wiki_data(updated_by_empid);
CREATE INDEX idx_wiki_data_stage ON app.d_wiki_data(stage);
CREATE INDEX idx_wiki_data_created ON app.d_wiki_data(created_ts DESC);
CREATE INDEX idx_wiki_data_links ON app.d_wiki_data USING gin(internal_links);

-- Update trigger for wiki data
CREATE TRIGGER trg_wiki_data_updated_ts BEFORE UPDATE ON app.d_wiki_data
    FOR EACH ROW EXECUTE FUNCTION app.update_updated_ts();

COMMENT ON TABLE app.d_wiki_data IS 'Wiki content with markdown/HTML and change tracking';