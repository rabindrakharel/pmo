-- =====================================================
-- SETTING: WIKI PUBLICATION STATUS
-- Defines available wiki publication status values
-- =====================================================

CREATE TABLE IF NOT EXISTS app.setting_datalabel_wiki_publication_status (
    level_id integer PRIMARY KEY,
    level_name varchar(50) NOT NULL UNIQUE,
    level_descr text,
    is_active boolean DEFAULT true,
    sort_order integer,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

-- Wiki publication status values
INSERT INTO app.setting_datalabel_wiki_publication_status (level_id, level_name, level_descr, sort_order) VALUES
(0, 'draft', 'Draft - work in progress', 0),
(1, 'review', 'Under review - pending approval', 1),
(2, 'published', 'Published - publicly visible', 2),
(3, 'archived', 'Archived - historical reference only', 3),
(4, 'deprecated', 'Deprecated - outdated content', 4),
(5, 'private', 'Private - restricted access only', 5);

COMMENT ON TABLE app.setting_datalabel_wiki_publication_status IS 'Wiki publication status setting values for d_wiki.publication_status';
