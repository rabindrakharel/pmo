-- ============================================================================
-- BUSINESS SCOPE HIERARCHY (Organizational Structure)
-- ============================================================================

-- ============================================================================
-- SEMANTIC DESCRIPTION:
-- ============================================================================
--
-- The business scope hierarchy represents the organizational structure that defines
-- how the company is organized from a business operations perspective. It provides
-- the foundational framework for departmental organization, budget allocation,
-- project assignment, and operational decision-making authority.
--
-- ARCHITECTURAL PURPOSE:
-- The d_scope_business table serves as the organizational backbone that enables:
--
-- • ORGANIZATIONAL STRUCTURE: Multi-level business hierarchy from corporation to sub-teams
-- • AUTHORITY DELEGATION: Clear chain of command and decision-making authority
-- • BUDGET MANAGEMENT: Budget allocation and cost center management across business units
-- • RESOURCE ALLOCATION: Human and material resource assignment to business functions
-- • PERFORMANCE TRACKING: Business unit performance measurement and KPI management
-- • PROJECT OWNERSHIP: Clear project ownership and accountability structure
--
-- BUSINESS HIERARCHY DESIGN:
-- The hierarchy follows standard corporate organizational patterns:
--
-- Level 1 (Corporation): TechCorp Inc. (Top-level legal entity)
-- Level 2 (Division): Engineering, Sales, Marketing, Finance (Major business divisions)
-- Level 3 (Department): Backend, Frontend, DevOps, Customer Success (Functional departments)
-- Level 4 (Team): Platform Team, Mobile Team, QA Team (Working teams)
-- Level 5 (Sub-team): API Squad, UI Squad, Testing Squad (Specialized groups)
--
-- OPERATIONAL INTEGRATION:
-- Business scopes integrate with operational activities:
-- - Projects are assigned to specific business units for ownership and accountability
-- - Tasks inherit business context from their parent projects
-- - Employees are primarily associated with business units for reporting structure
-- - Budgets and resources are allocated at business unit levels
--
-- CROSS-FUNCTIONAL COORDINATION:
-- Business hierarchy enables cross-functional operations:
--
-- • MATRIX ORGANIZATIONS: Employees can work across multiple business units
-- • SHARED SERVICES: Common services (IT, HR, Finance) support multiple business units
-- • PROJECT COLLABORATION: Cross-departmental projects with clear ownership
-- • RESOURCE SHARING: Temporary resource allocation between business units
--
-- FINANCIAL AND GOVERNANCE INTEGRATION:
-- Business structure supports financial and governance requirements:
--
-- • PROFIT & LOSS: Department-level P&L responsibility and reporting
-- • COST CENTERS: Business unit cost tracking and budget management
-- • APPROVAL WORKFLOWS: Hierarchical approval chains for expenditures and decisions
-- • COMPLIANCE: Business unit specific regulatory and compliance requirements
-- • AUDIT TRAILS: Business context for all operational activities and decisions
--
-- REAL-WORLD PMO SCENARIOS:
--
-- 1. CROSS-FUNCTIONAL PROJECT:
--    - Project owned by 'Product Development' department
--    - Resources drawn from 'Backend Team' and 'Frontend Team'
--    - Budget allocated from 'Engineering Division' cost center
--    - Oversight from 'VP Engineering' hierarchy level
--
-- 2. DEPARTMENTAL REORGANIZATION:
--    - 'Platform Engineering' department restructured
--    - Teams reassigned between 'Infrastructure' and 'Platform' departments
--    - Projects and permissions automatically inherit new business context
--    - Historical tracking maintains audit trail of organizational changes
--
-- 3. ACQUISITION INTEGRATION:
--    - New company acquired and integrated as 'Mobile Division'
--    - Existing business hierarchy extended to include acquired teams
--    - Projects and resources mapped to new organizational structure
--    - Permission inheritance ensures appropriate access controls
--
-- SCALABILITY AND FLEXIBILITY:
-- Business hierarchy design supports organizational growth:
-- - Dynamic hierarchy expansion without schema changes
-- - Flexible team structures for agile and matrix organizations
-- - Support for temporary project teams and task forces
-- - Integration with external partners and contractors
--
-- PERMISSION AND ACCESS CONTROL:
-- Business hierarchy drives access control patterns:
-- - Department-level access to projects and resources
-- - Team-level access to specific tools and systems
-- - Cross-functional access for collaboration and shared services
-- - Executive-level access for oversight and strategic planning

-- ============================================================================
-- DDL (Data Definition Language):
-- ============================================================================

CREATE TABLE app.d_scope_business (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "descr" text,
  code text, -- Business unit code for financial systems integration
  business_type text DEFAULT 'operational', -- 'operational', 'support', 'strategic', 'temporary'
  cost_center_code text, -- Integration with financial/ERP systems
  budget_allocated numeric(15,2), -- Annual budget allocation in CAD
  fte_allocation numeric(8,2), -- Full-time equivalent employee allocation
  manager_emp_id uuid, -- Business unit manager/lead
  parent_cost_center text, -- Parent cost center for financial rollup
  is_profit_center boolean DEFAULT false, -- Whether this unit has P&L responsibility
  is_cost_center boolean DEFAULT true, -- Whether this unit tracks costs separately
  approval_limit numeric(12,2), -- Maximum expenditure approval limit
  operational_status text DEFAULT 'active', -- 'active', 'inactive', 'restructuring', 'sunset'
  establishment_date date, -- When this business unit was established
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  level_id int NOT NULL REFERENCES app.meta_biz_level(level_id),
  parent_id uuid REFERENCES app.d_scope_business(id) ON DELETE SET NULL,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- DATA CURATION (Synthetic Data Generation):
-- ============================================================================

-- Insert Canadian Technology Corporation Business Hierarchy
INSERT INTO app.d_scope_business (name, "descr", code, business_type, cost_center_code, budget_allocated, fte_allocation, parent_cost_center, is_profit_center, is_cost_center, approval_limit, operational_status, establishment_date, from_ts, level_id, parent_id, tags, attr) VALUES

-- Corporation Level (Level 1)
('TechCorp Inc.', 'Canadian technology corporation specializing in enterprise software solutions and consulting services', 'TECH-CORP', 'strategic', 'CC-1000', 50000000.00, 250.0, NULL, true, true, 10000000.00, 'active', '1995-03-15', now(), 1, NULL, '["corporation", "technology", "enterprise"]', '{"stock_symbol": "TECH.TO", "incorporated": "Canada", "headquarters": "Toronto", "revenue_cad": 75000000, "founded": 1995}'),

-- Division Level (Level 2)
('Engineering Division', 'Software engineering, research and development, and technical innovation division', 'ENG-DIV', 'operational', 'CC-2000', 25000000.00, 150.0, 'CC-1000', false, true, 2500000.00, 'active', '1995-06-01', now(), 2, (SELECT id FROM app.d_scope_business WHERE name = 'TechCorp Inc.'), '["engineering", "r&d", "technical"]', '{"primary_function": "product_development", "technology_stack": ["Java", "Python", "React", "AWS"], "methodologies": ["Agile", "DevOps", "CI/CD"]}'),

('Sales Division', 'Sales, marketing, and customer relationship management division', 'SALES-DIV', 'operational', 'CC-2100', 8000000.00, 40.0, 'CC-1000', true, true, 1000000.00, 'active', '1995-04-01', now(), 2, (SELECT id FROM app.d_scope_business WHERE name = 'TechCorp Inc.'), '["sales", "marketing", "customer-success"]', '{"primary_function": "revenue_generation", "sales_targets_cad": 75000000, "customer_segments": ["enterprise", "mid-market", "government"]}'),

('Operations Division', 'Business operations, finance, HR, and administrative support division', 'OPS-DIV', 'support', 'CC-2200', 12000000.00, 35.0, 'CC-1000', false, true, 500000.00, 'active', '1995-05-01', now(), 2, (SELECT id FROM app.d_scope_business WHERE name = 'TechCorp Inc.'), '["operations", "finance", "hr", "admin"]', '{"primary_function": "business_support", "services": ["finance", "hr", "legal", "facilities"], "shared_services": true}'),

('Strategic Initiatives', 'Strategic planning, mergers & acquisitions, and innovation lab', 'STRAT-DIV', 'strategic', 'CC-2300', 5000000.00, 25.0, 'CC-1000', false, true, 1500000.00, 'active', '2010-01-01', now(), 2, (SELECT id FROM app.d_scope_business WHERE name = 'TechCorp Inc.'), '["strategic", "innovation", "m&a"]', '{"primary_function": "strategic_planning", "focus_areas": ["AI", "blockchain", "cloud_transformation"], "innovation_budget": 3000000}'),

-- Department Level (Level 3)
('Platform Engineering', 'Infrastructure, DevOps, and platform development services supporting all engineering teams', 'PLAT-ENG', 'support', 'CC-3000', 8000000.00, 45.0, 'CC-2000', false, true, 800000.00, 'active', '1998-02-01', now(), 3, (SELECT id FROM app.d_scope_business WHERE name = 'Engineering Division'), '["infrastructure", "devops", "platform"]', '{"primary_function": "platform_services", "services": ["AWS", "Kubernetes", "CI/CD", "monitoring"], "uptime_sla": 99.9}'),

('Product Development', 'Product management, UX design, and feature development for customer-facing applications', 'PROD-DEV', 'operational', 'CC-3100', 12000000.00, 65.0, 'CC-2000', true, true, 1200000.00, 'active', '1996-01-01', now(), 3, (SELECT id FROM app.d_scope_business WHERE name = 'Engineering Division'), '["product", "development", "customer-facing"]', '{"primary_function": "product_development", "products": ["CRM", "ERP", "Mobile_App"], "development_methodology": "Agile Scrum"}'),

('Quality Assurance', 'Software testing, quality control, and release management across all engineering products', 'QA-DEPT', 'support', 'CC-3200', 3000000.00, 25.0, 'CC-2000', false, true, 300000.00, 'active', '1997-09-01', now(), 3, (SELECT id FROM app.d_scope_business WHERE name = 'Engineering Division'), '["testing", "quality", "release-management"]', '{"primary_function": "quality_assurance", "testing_types": ["unit", "integration", "e2e", "performance"], "automation_coverage": 85}'),

('Customer Success', 'Customer onboarding, support, training, and relationship management', 'CUST-SUC', 'operational', 'CC-3300', 4000000.00, 25.0, 'CC-2100', false, true, 400000.00, 'active', '2005-03-01', now(), 3, (SELECT id FROM app.d_scope_business WHERE name = 'Sales Division'), '["customer-support", "training", "success"]', '{"primary_function": "customer_retention", "satisfaction_target": 95, "support_channels": ["phone", "email", "chat", "portal"]}'),

('Business Development', 'New business acquisition, partnerships, and market expansion', 'BIZ-DEV', 'operational', 'CC-3400', 3000000.00, 12.0, 'CC-2100', true, true, 600000.00, 'active', '2000-01-01', now(), 3, (SELECT id FROM app.d_scope_business WHERE name = 'Sales Division'), '["sales", "partnerships", "expansion"]', '{"primary_function": "business_growth", "target_markets": ["US", "Europe"], "partnership_types": ["technology", "channel", "strategic"]}'),

('Finance & Accounting', 'Financial planning, accounting, budgeting, and regulatory compliance', 'FIN-ACCT', 'support', 'CC-3500', 3000000.00, 18.0, 'CC-2200', false, true, 200000.00, 'active', '1995-06-01', now(), 3, (SELECT id FROM app.d_scope_business WHERE name = 'Operations Division'), '["finance", "accounting", "compliance"]', '{"primary_function": "financial_management", "compliance": ["IFRS", "GAAP", "SOX"], "reporting_frequency": "monthly"}'),

('Human Resources', 'Talent acquisition, employee development, performance management, and workplace culture', 'HR-DEPT', 'support', 'CC-3600', 2500000.00, 12.0, 'CC-2200', false, true, 150000.00, 'active', '1995-05-01', now(), 3, (SELECT id FROM app.d_scope_business WHERE name = 'Operations Division'), '["hr", "talent", "culture"]', '{"primary_function": "human_resources", "services": ["recruitment", "training", "performance", "benefits"], "employee_satisfaction": 4.2}'),

-- Team Level (Level 4)
('Backend Team', 'Server-side development, API design, database management, and system integration', 'BACK-TEAM', 'operational', 'CC-4000', 4000000.00, 25.0, 'CC-3000', false, true, 400000.00, 'active', '1998-06-01', now(), 4, (SELECT id FROM app.d_scope_business WHERE name = 'Platform Engineering'), '["backend", "api", "database"]', '{"primary_function": "backend_development", "technologies": ["Java", "Spring", "PostgreSQL", "Redis"], "api_endpoints": 150}'),

('Frontend Team', 'User interface development, user experience design, and client-side application development', 'FRONT-TEAM', 'operational', 'CC-4100', 4500000.00, 22.0, 'CC-3100', false, true, 450000.00, 'active', '1999-03-01', now(), 4, (SELECT id FROM app.d_scope_business WHERE name = 'Product Development'), '["frontend", "ui", "ux"]', '{"primary_function": "frontend_development", "technologies": ["React", "TypeScript", "Tailwind", "Figma"], "applications": ["web", "mobile_web"]}'),

('DevOps Team', 'Infrastructure automation, deployment pipelines, monitoring, and site reliability engineering', 'DEVOPS-TEAM', 'support', 'CC-4200', 3000000.00, 15.0, 'CC-3000', false, true, 300000.00, 'active', '2010-01-01', now(), 4, (SELECT id FROM app.d_scope_business WHERE name = 'Platform Engineering'), '["devops", "infrastructure", "automation"]', '{"primary_function": "infrastructure_automation", "cloud_providers": ["AWS", "Azure"], "deployment_frequency": "daily"}'),

('Mobile Team', 'Mobile application development for iOS and Android platforms', 'MOBILE-TEAM', 'operational', 'CC-4300', 3500000.00, 18.0, 'CC-3100', false, true, 350000.00, 'active', '2015-01-01', now(), 4, (SELECT id FROM app.d_scope_business WHERE name = 'Product Development'), '["mobile", "ios", "android"]', '{"primary_function": "mobile_development", "platforms": ["iOS", "Android", "React_Native"], "app_store_rating": 4.5}'),

-- Sub-team Level (Level 5)
('API Squad', 'Specialized team focusing on RESTful API design, GraphQL implementation, and microservices architecture', 'API-SQUAD', 'operational', 'CC-5000', 1800000.00, 8.0, 'CC-4000', false, true, 180000.00, 'active', '2018-01-01', now(), 5, (SELECT id FROM app.d_scope_business WHERE name = 'Backend Team'), '["api", "microservices", "architecture"]', '{"primary_function": "api_development", "api_style": ["REST", "GraphQL"], "microservices_count": 25}'),

('Data Squad', 'Data engineering, analytics, business intelligence, and data warehouse management', 'DATA-SQUAD', 'support', 'CC-5100', 2000000.00, 10.0, 'CC-4000', false, true, 200000.00, 'active', '2017-01-01', now(), 5, (SELECT id FROM app.d_scope_business WHERE name = 'Backend Team'), '["data", "analytics", "warehouse"]', '{"primary_function": "data_engineering", "tools": ["Snowflake", "DBT", "Airflow"], "data_volume_tb": 500}'),

('UI Squad', 'User interface component library, design system, and accessibility implementation', 'UI-SQUAD', 'operational', 'CC-5200', 2200000.00, 12.0, 'CC-4100', false, true, 220000.00, 'active', '2019-01-01', now(), 5, (SELECT id FROM app.d_scope_business WHERE name = 'Frontend Team'), '["ui", "design-system", "accessibility"]', '{"primary_function": "ui_development", "design_system": "TechCorp DS", "accessibility_compliance": "WCAG 2.1 AA"}');

-- Now that business hierarchy exists, add foreign key constraint for worksite business reference
ALTER TABLE app.d_scope_worksite
  ADD CONSTRAINT d_scope_worksite_biz_fk
  FOREIGN KEY (biz_id) REFERENCES app.d_scope_business(id) ON DELETE SET NULL;

-- Indexes intentionally omitted in this simplified DDL; add as needed later.
