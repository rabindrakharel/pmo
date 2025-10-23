-- ============================================================================
-- SETTING: WIKI PUBLICATION STATUS
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Defines the sequential states of wiki content publication workflow. This is a
--   SEQUENTIAL STATE table where each status represents a discrete phase in the
--   content creation and review process. Statuses form a graph-like flow tracking
--   wiki articles from draft through review and publication to archival.
--
-- Sequential State Behavior:
--   - Wiki content progresses through editorial workflow stages
--   - Allows circular transitions (e.g., review -> draft for revisions)
--   - Multiple publication paths (published, private, archived)
--   - Terminal states (archived, deprecated) typically have no forward transitions
--   - parent_id field enables graph-like relationships for workflow visualization
--
-- Business Context:
--   Knowledge base content management for collaborative documentation:
--   1. Draft: Work in progress, not visible to other users
--   2. Review: Submitted for editorial review and approval
--   3. Private: Approved but restricted to specific user groups
--   4. Published: Publicly visible to all authorized users
--   5. Deprecated: Outdated content marked for replacement
--   6. Archived: Historical reference only, not actively used
--
-- Typical State Transitions:
--   draft -> review (submit for approval)
--   review -> published (approval granted, make public)
--   review -> draft (revisions needed)
--   review -> private (approval granted, but restricted access)
--   published -> deprecated (content outdated)
--   published -> archived (long-term storage)
--   deprecated -> draft (update and refresh content)
--
-- Integration Points:
--   - d_wiki.publication_status references this table
--   - Content approval workflows trigger notifications
--   - Search indexes filter by publication status
--   - Access control based on status (draft/private vs public)
--
-- UI/UX Usage:
--   - Status dropdown in wiki editor forms
--   - Status badges in wiki lists with color coding
--   - Editorial dashboard showing content in review
--   - Sequential state visualizer component showing flow graph
--
-- Sequential State Visualization Pattern:
--   This table powers the SequentialStateVisualizer React component which renders
--   an interactive timeline showing wiki content progression through publishing workflow.
--
--   Display Format: ● Draft → ● **Under Review** → ○ Published → ○ Archived
--   - Current status: Blue circle with checkmark, ring effect, highlighted label
--   - Past statuses: Light blue circles with checkmarks
--   - Future statuses: Gray circles, dimmed labels
--   - Interactive: Click any status to jump directly (in edit/create modes)
--
--   The component automatically detects this as a sequential field by matching
--   the 'status' pattern in the field key ('publication_status'). Configuration
--   is centralized in apps/web/src/lib/sequentialStateConfig.ts
--
--   Sort Order: The sort_order field determines left-to-right display sequence.
--   Publishing workflow: 1=Draft, 2=Under Review, 3=Published, 4=Archived
--
--   Integration:
--   - API endpoint: GET /api/v1/setting?category=wiki_publication_status
--   - Returns statuses with sort_order for sequential visualization
--   - Auto-replaces standard dropdown in EntityFormContainer component
--   - Provides visual editorial workflow context in wiki forms and detail pages
--

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.setting_datalabel_wiki_publication_status (
    level_id integer PRIMARY KEY,
    name varchar(50) NOT NULL UNIQUE,
    descr text,
    sort_order integer,
    parent_id integer, -- Enables graph-like flow relationships between statuses
    is_active boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

-- Index for wiki publication status
CREATE INDEX idx_wiki_status_parent ON app.setting_datalabel_wiki_publication_status(parent_id);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Wiki publication status values with parent_id relationships showing typical flow graph
-- parent_id represents the most common preceding status (null for initial states)

INSERT INTO app.setting_datalabel_wiki_publication_status (level_id, name, descr, sort_order, parent_id) VALUES
(0, 'draft', 'Draft - work in progress. Not visible to other users. Initial entry point.', 0, NULL),
(1, 'review', 'Under review - pending editorial approval. Submitted by author for quality check.', 1, 0),
(2, 'published', 'Published - publicly visible to all authorized users. Primary active status.', 2, 1),
(3, 'archived', 'Archived - historical reference only. No longer actively maintained. Terminal state.', 3, 2),
(4, 'deprecated', 'Deprecated - outdated content marked for replacement or removal.', 4, 2),
(5, 'private', 'Private - approved but restricted to specific user groups or roles only.', 5, 1);

COMMENT ON TABLE app.setting_datalabel_wiki_publication_status IS 'Sequential state table for wiki content publication workflow with graph-like flow relationships';
COMMENT ON COLUMN app.setting_datalabel_wiki_publication_status.parent_id IS 'Most common preceding status in the editorial flow. NULL for initial or independent states.';
