-- ============================================================================
-- HR SCOPE HIERARCHY (Human Resources and Organizational Structure)
-- ============================================================================

-- ============================================================================
-- SEMANTIC DESCRIPTION:
-- ============================================================================
--
-- The HR scope hierarchy represents the human resources organizational structure
-- that defines reporting relationships, management hierarchies, authority levels,
-- and career progression paths within the organization. It provides the foundation
-- for performance management, compensation planning, and organizational governance.
--
-- ARCHITECTURAL PURPOSE:
-- The d_scope_hr table serves as the human capital structure that enables:
--
-- • REPORTING RELATIONSHIPS: Clear management hierarchy and reporting chains
-- • AUTHORITY DELEGATION: Decision-making authority levels and approval workflows
-- • PERFORMANCE MANAGEMENT: Performance review cycles and career development paths
-- • COMPENSATION PLANNING: Salary bands, bonus structures, and equity programs
-- • SUCCESSION PLANNING: Leadership development and succession management
-- • ORGANIZATIONAL GOVERNANCE: Compliance with labor laws and HR policies

-- ============================================================================
-- DDL (Data Definition Language):
-- ============================================================================

CREATE TABLE app.d_scope_hr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "descr" text,
  position_code text,
  job_family text,
  job_level text,
  salary_band_min numeric(10,2),
  salary_band_max numeric(10,2),
  bonus_target_pct numeric(5,2),
  equity_eligible boolean DEFAULT false,
  direct_reports_max int,
  approval_limit numeric(12,2),
  bilingual_req boolean DEFAULT false,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  level_id int NOT NULL REFERENCES app.meta_hr_level(level_id),
  parent_id uuid REFERENCES app.d_scope_hr(id) ON DELETE SET NULL,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.rel_hr_biz_loc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hr_id uuid NOT NULL REFERENCES app.d_scope_hr(id) ON DELETE CASCADE,
  biz_id uuid REFERENCES app.d_scope_business(id) ON DELETE SET NULL,
  loc_id uuid REFERENCES app.d_scope_location(id) ON DELETE SET NULL,
  assignment_type text DEFAULT 'primary',
  assignment_pct numeric(5,2) DEFAULT 100.0,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  from_ts timestamptz NOT NULL,
  to_ts timestamptz,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ============================================================================
-- DATA CURATION (Synthetic Data Generation):
-- ============================================================================

-- Insert Canadian HR Hierarchy
INSERT INTO app.d_scope_hr (name, "descr", position_code, job_family, salary_band_min, salary_band_max, bonus_target_pct, equity_eligible, direct_reports_max, approval_limit, from_ts, level_id, parent_id, tags, attr) VALUES
('CEO Office', 'Chief Executive Officer and executive leadership team', 'CEO-001', 'Executive', 300000.00, 500000.00, 50.0, true, 8, 10000000.00, now(), 1, NULL, '["c-level", "executive"]', '{"board_reporting": true}'),
('VP Engineering', 'Vice President of Engineering', 'VP-ENG-001', 'Engineering', 200000.00, 300000.00, 35.0, true, 10, 2000000.00, now(), 2, (SELECT id FROM app.d_scope_hr WHERE name = 'CEO Office'), '["vp", "technical"]', '{"engineering_strategy": true}'),
('VP Sales', 'Vice President of Sales', 'VP-SALES-001', 'Sales', 180000.00, 280000.00, 50.0, true, 8, 1500000.00, now(), 2, (SELECT id FROM app.d_scope_hr WHERE name = 'CEO Office'), '["vp", "revenue"]', '{"revenue_responsibility": true}'),
('Engineering Directors', 'Engineering department directors', 'DIR-ENG-001', 'Engineering', 140000.00, 200000.00, 25.0, true, 15, 500000.00, now(), 3, (SELECT id FROM app.d_scope_hr WHERE name = 'VP Engineering'), '["director", "management"]', '{"department_management": true}'),
('Engineering Managers', 'Team and project managers', 'MGR-ENG-001', 'Engineering', 95000.00, 150000.00, 20.0, false, 8, 200000.00, now(), 4, (SELECT id FROM app.d_scope_hr WHERE name = 'Engineering Directors'), '["manager", "team"]', '{"team_management": true}'),
('Senior Engineers', 'Senior individual contributors', 'SR-ENG-001', 'Engineering', 75000.00, 110000.00, 12.0, false, 3, 25000.00, now(), 6, (SELECT id FROM app.d_scope_hr WHERE name = 'Engineering Managers'), '["senior", "technical"]', '{"technical_expertise": true}');
