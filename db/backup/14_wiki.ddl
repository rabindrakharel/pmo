-- ============================================================================
-- d_wiki: Collaborative documentation pages (Confluence-like)
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.d_wiki (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Metadata
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  summary text,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],

  -- Content
  content jsonb NOT NULL DEFAULT '{}'::jsonb,      -- canonical doc model (for future editors)
  content_html text,                                -- rendered HTML snapshot for fast view

  -- Ownership / sharing
  owner_id uuid REFERENCES app.d_employee(id) ON DELETE SET NULL,
  owner_name text,
  published boolean NOT NULL DEFAULT false,
  share_link text UNIQUE,                           -- short share token for public view

  -- Versioning / lifecycle
  version int NOT NULL DEFAULT 1,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_d_wiki_title_trgm ON app.d_wiki USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_d_wiki_tags ON app.d_wiki USING gin (tags);

-- Sample starter page
INSERT INTO app.d_wiki (title, slug, summary, tags, content, content_html, published, owner_name)
VALUES (
  'Welcome to Wiki',
  'welcome',
  'Getting started with the Wiki module',
  ARRAY['getting-started','docs'],
  '{"type":"html","html":"<h1>Welcome</h1><p>Create, edit and share knowledge.</p>"}',
  '<h1>Welcome</h1><p>Create, edit and share knowledge.</p>',
  true,
  'System'
)
ON CONFLICT (slug) DO NOTHING;

