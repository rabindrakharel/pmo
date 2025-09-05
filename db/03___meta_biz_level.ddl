-- ============================================================================
-- BUSINESS HIERARCHY LEVELS (Organizational Structure Metadata)
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Business hierarchy level definitions for organizational structure management.
-- Defines the hierarchical levels within business organizations from corporation
-- down to individual working units.
--
-- Hierarchy Pattern:
-- • Level 0: Corporation (Top-level corporate entity)
-- • Level 1: Division (Major business division with P&L)
-- • Level 2: Department (Functional department)
-- • Level 3: Team (Working team unit)
-- • Level 4: Squad (Agile squad with cross-functional capabilities)
-- • Level 5: Sub-team (Specialized sub-team for specific functions)
--
-- Integration:
-- • Links to d_scope_org for business unit definitions
-- • Supports hierarchical organizational reporting
-- • Enables organizational capability planning
-- • Facilitates governance and compliance structures

-- ============================================================================
-- DDL:
-- ============================================================================

-- Business Level Definitions
CREATE TABLE app.meta_biz_level (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id int NOT NULL UNIQUE,
  name text NOT NULL,
  "descr" text,
  sort_order int NOT NULL DEFAULT 0,
  is_leaf_level boolean NOT NULL DEFAULT false,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Business Hierarchy Levels for Huron Home Services
INSERT INTO app.meta_biz_level (level_id, name, "descr", sort_order, is_leaf_level, tags, attr) VALUES
(0, 'Corporation', 'Top-level corporate entity with board governance', 0, false, '["enterprise", "root", "legal-entity"]', '{"max_children": 50, "requires_board": true, "governance": "board", "compliance": ["SOX", "securities"], "reporting": "public"}'),
(1, 'Division', 'Major business division with P&L responsibility', 1, false, '["division", "strategic", "profit-center"]', '{"max_children": 20, "has_p_and_l": true, "governance": "executive", "budget_authority": "high", "market_focus": true}'),
(2, 'Department', 'Functional department with operational focus', 2, false, '["department", "operational", "functional"]', '{"max_children": 15, "has_budget": true, "governance": "management", "specialization": "functional", "cross_functional": false}'),
(3, 'Team', 'Working team unit with specific deliverables', 3, false, '["team", "tactical", "delivery"]', '{"max_children": 8, "has_manager": true, "governance": "team-lead", "delivery_focus": true, "agile_enabled": true}'),
(4, 'Squad', 'Agile squad with cross-functional capabilities', 4, false, '["squad", "agile", "cross-functional"]', '{"max_children": 6, "has_lead": true, "governance": "servant-leader", "methodology": "scrum", "autonomy": "high"}'),
(5, 'Sub-team', 'Specialized sub-team for specific functions', 5, true, '["subteam", "specialized", "focused"]', '{"max_children": 0, "has_lead": true, "governance": "peer", "specialization": "technical", "temporary": false}');