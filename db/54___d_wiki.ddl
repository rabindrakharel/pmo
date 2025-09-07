-- ============================================================================
-- WIKI KNOWLEDGE BASE
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Collaborative documentation and knowledge base system providing
--   wiki-style content management with versioning, sharing, and
--   collaborative editing capabilities similar to Confluence.
--
-- Features:
--   - Rich content management with JSON-based storage
--   - Version control and change tracking
--   - Public/private sharing with secure link generation
--   - Owner-based access control and collaboration
--   - Full-text search and content organization
--
-- Integration:
--   - Links to d_employee for ownership and collaboration
--   - Supports project documentation and knowledge sharing
--   - Enables organizational knowledge management
--   - Facilitates team collaboration and information sharing

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.d_wiki (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Metadata
  title text NOT NULL,
  slug text NOT NULL,
  summary text,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],

  -- Content
  content jsonb NOT NULL DEFAULT '{}'::jsonb,      -- canonical doc model (for future editors)
  content_html text,                                -- rendered HTML snapshot for fast view

  -- Ownership / sharing
  owner_id uuid REFERENCES app.d_employee(id) ON DELETE SET NULL,
  owner_name text,
  published boolean NOT NULL DEFAULT false,
  share_link text,                                  -- short share token for public view

  -- Versioning / lifecycle
  version int NOT NULL DEFAULT 1,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_wiki_slug UNIQUE (slug)
);


-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Knowledge base content for Huron Home Services
-- Linking to James Miller as owner where appropriate

-- Welcome and Getting Started
INSERT INTO app.d_wiki (title, slug, summary, tags, content, content_html, published, owner_id, owner_name)
VALUES (
  'Huron Home Services Knowledge Base',
  'welcome',
  'Welcome to the Huron Home Services knowledge base - your central hub for company information, processes, and best practices',
  ARRAY['welcome','company','knowledge-base'],
  '{"type":"html","html":"<h1>Welcome to Huron Home Services Knowledge Base</h1><p>This knowledge base contains essential information for all team members including policies, procedures, best practices, and project documentation.</p><h2>Quick Navigation</h2><ul><li>Company Policies & Procedures</li><li>Project Management Guidelines</li><li>Technical Standards & Designs</li><li>Employee Resources</li></ul>"}',
  '<h1>Welcome to Huron Home Services Knowledge Base</h1><p>This knowledge base contains essential information for all team members including policies, procedures, best practices, and project documentation.</p><h2>Quick Navigation</h2><ul><li>Company Policies & Procedures</li><li>Project Management Guidelines</li><li>Technical Standards & Designs</li><li>Employee Resources</li></ul>',
  true,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'James Miller'
),
(
  'Company Vision and Strategy',
  'company-vision',
  'Huron Home Services corporate vision, mission, and strategic priorities as defined by leadership',
  ARRAY['strategy','vision','leadership','company'],
  '{"type":"html","html":"<h1>Company Vision & Strategy</h1><h2>Our Mission</h2><p>To be Ontario''s premier integrated home services provider, delivering exceptional value through innovation, sustainability, and customer excellence.</p><h2>Strategic Priorities 2024-2025</h2><ul><li>Geographic expansion into Hamilton-Niagara region</li><li>Technology integration and digital transformation</li><li>Sustainable service offerings and environmental stewardship</li><li>Workforce development and employee satisfaction</li></ul><h2>Core Values</h2><ul><li>Customer Excellence</li><li>Safety First</li><li>Environmental Responsibility</li><li>Team Collaboration</li><li>Continuous Innovation</li></ul>"}',
  '<h1>Company Vision & Strategy</h1><h2>Our Mission</h2><p>To be Ontario''s premier integrated home services provider, delivering exceptional value through innovation, sustainability, and customer excellence.</p><h2>Strategic Priorities 2024-2025</h2><ul><li>Geographic expansion into Hamilton-Niagara region</li><li>Technology integration and digital transformation</li><li>Sustainable service offerings and environmental stewardship</li><li>Workforce development and employee satisfaction</li></ul><h2>Core Values</h2><ul><li>Customer Excellence</li><li>Safety First</li><li>Environmental Responsibility</li><li>Team Collaboration</li><li>Continuous Innovation</li></ul>',
  true,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'James Miller'
),
(
  'Project Management Best Practices',
  'project-management',
  'Comprehensive guide to project management methodologies and best practices at Huron Home Services',
  ARRAY['project-management','best-practices','processes'],
  '{"type":"html","html":"<h1>Project Management Best Practices</h1><h2>Project Lifecycle</h2><ol><li>Project Initiation & Scoping</li><li>Planning & Design Phase</li><li>Resource Allocation</li><li>Execution & Monitoring</li><li>Quality Assurance</li><li>Project Closure & Review</li></ol><h2>Key Tools & Systems</h2><ul><li>ServiceTitan for scheduling and dispatch</li><li>AutoCAD for technical designs</li><li>Microsoft Project for timeline management</li><li>Quality checklists and safety protocols</li></ul>"}',
  '<h1>Project Management Best Practices</h1><h2>Project Lifecycle</h2><ol><li>Project Initiation & Scoping</li><li>Planning & Design Phase</li><li>Resource Allocation</li><li>Execution & Monitoring</li><li>Quality Assurance</li><li>Project Closure & Review</li></ol><h2>Key Tools & Systems</h2><ul><li>ServiceTitan for scheduling and dispatch</li><li>AutoCAD for technical designs</li><li>Microsoft Project for timeline management</li><li>Quality checklists and safety protocols</li></ul>',
  true,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'James Miller'
)
ON CONFLICT (slug) DO NOTHING;

