-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Business scope hierarchy representing organizational structure for departmental 
-- organization, budget allocation, and operational decision-making authority.
--
-- Hierarchy Structure:
-- Only has 3 levels with level id: 0, 1, 2 for  • Corporation → Division → Department
-- • Supports cost center management, resource allocation, and project ownership
-- • Enables cross-functional coordination and matrix organizations
-- • Integration with financial and governance requirements

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.d_scope_business (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Standard fields (audit, metadata, SCD type 2)
  name text NOT NULL,
  "descr" text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  -- Business-specific fields
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
  level_id int NOT NULL REFERENCES app.meta_biz_level(level_id),
  parent_id uuid REFERENCES app.d_scope_business(id) ON DELETE SET NULL
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Insert Huron Home Services Business Hierarchy (Corrected levels: 0=Corporation, 1=Division, 2=Department)
INSERT INTO app.d_scope_business (name, "descr", code, business_type, cost_center_code, budget_allocated, fte_allocation, parent_cost_center, is_profit_center, is_cost_center, approval_limit, operational_status, establishment_date, from_ts, level_id, parent_id, tags, attr) VALUES

-- Corporation Level (Level 0)
('Huron Home Services', 'Comprehensive home services company providing landscaping, plumbing, heating, snow removal, electrical, and solar installation services across Southern Ontario', 'HURON-HOME', 'operational', 'CC-1000', 5200000.00, 125.0, NULL, true, true, 500000.00, 'active', '2018-04-15', now(), 0, NULL, '["corporation", "home-services", "residential"]', '{"incorporated": "Canada", "headquarters": "Mississauga", "service_area": "Southern Ontario", "founded": 2018, "business_license": "ON-HS-2018-4567"}'),

-- Division Level (Level 1)
('Field Services Division', 'Operational division managing all field-based home services including landscaping, plumbing, heating, and electrical work', 'FIELD-DIV', 'operational', 'CC-2000', 3200000.00, 85.0, 'CC-1000', true, true, 250000.00, 'active', '2018-05-01', now(), 1, (SELECT id FROM app.d_scope_business WHERE name = 'Huron Home Services'), '["field-services", "operations", "technical"]', '{"primary_function": "service_delivery", "service_areas": ["landscaping", "plumbing", "hvac", "electrical"], "coverage_radius": "150km"}'),

('Business Operations Division', 'Administrative division handling customer service, dispatch, billing, and business support functions', 'BIZ-OPS-DIV', 'support', 'CC-2100', 1200000.00, 25.0, 'CC-1000', false, true, 100000.00, 'active', '2018-06-01', now(), 1, (SELECT id FROM app.d_scope_business WHERE name = 'Huron Home Services'), '["operations", "customer-service", "admin"]', '{"primary_function": "business_support", "services": ["dispatch", "billing", "customer_service", "hr"], "hours_of_operation": "7:00-19:00"}'),

('Specialty Services Division', 'Specialized division for seasonal services, renewable energy installations, and emergency response services', 'SPECIALTY-DIV', 'operational', 'CC-2200', 800000.00, 15.0, 'CC-1000', true, true, 150000.00, 'active', '2020-01-01', now(), 1, (SELECT id FROM app.d_scope_business WHERE name = 'Huron Home Services'), '["specialty", "seasonal", "renewable-energy"]', '{"primary_function": "specialty_services", "services": ["snow_removal", "solar_installation", "emergency_response"], "seasonal_operations": true}'),

-- Department Level (Level 2) - Service Departments
('Landscaping Department', 'Comprehensive landscaping services including lawn care, garden design, tree services, and outdoor maintenance', 'LANDSCAPING', 'operational', 'CC-3000', 950000.00, 28.0, 'CC-2000', true, true, 75000.00, 'active', '2018-05-15', now(), 2, (SELECT id FROM app.d_scope_business WHERE name = 'Field Services Division'), '["landscaping", "outdoor", "seasonal"]', '{"services": ["lawn_care", "tree_services", "garden_design", "irrigation"], "seasonal_peak": "April-October", "equipment_count": 45}'),

('Plumbing Department', 'Professional plumbing services covering installations, repairs, maintenance, and emergency plumbing solutions', 'PLUMBING', 'operational', 'CC-3100', 850000.00, 22.0, 'CC-2000', true, true, 50000.00, 'active', '2018-05-15', now(), 2, (SELECT id FROM app.d_scope_business WHERE name = 'Field Services Division'), '["plumbing", "water", "emergency"]', '{"services": ["installations", "repairs", "drain_cleaning", "emergency_calls"], "emergency_availability": "24/7", "licensed_technicians": 18}'),

('Heating Department', 'Heating, ventilation, and air conditioning services including installations, maintenance, and energy efficiency upgrades', 'HVAC', 'operational', 'CC-3200', 750000.00, 20.0, 'CC-2000', true, true, 60000.00, 'active', '2018-07-01', now(), 2, (SELECT id FROM app.d_scope_business WHERE name = 'Field Services Division'), '["hvac", "heating", "cooling"]', '{"services": ["furnace_service", "ac_installation", "duct_cleaning", "energy_audits"], "seasonal_demand": ["winter_heating", "summer_cooling"], "gas_license": "TSSA_certified"}'),

('Electrical Department', 'Licensed electrical services including installations, repairs, upgrades, and electrical safety inspections', 'ELECTRICAL', 'operational', 'CC-3300', 680000.00, 18.0, 'CC-2000', true, true, 45000.00, 'active', '2019-03-01', now(), 2, (SELECT id FROM app.d_scope_business WHERE name = 'Field Services Division'), '["electrical", "safety", "installations"]', '{"services": ["panel_upgrades", "wiring", "outlet_installation", "safety_inspections"], "esa_licensed": true, "master_electricians": 6}'),

('Customer Service Department', 'Customer relationship management, scheduling, billing, and customer satisfaction services', 'CUSTOMER-SERVICE', 'support', 'CC-3400', 320000.00, 12.0, 'CC-2100', false, true, 25000.00, 'active', '2018-06-15', now(), 2, (SELECT id FROM app.d_scope_business WHERE name = 'Business Operations Division'), '["customer-service", "scheduling", "billing"]', '{"services": ["appointment_booking", "billing_support", "customer_inquiries"], "service_hours": "7:00-19:00", "multilingual_support": ["english", "french"]}'),

('Administration Department', 'Human resources, finance, legal compliance, and general administrative support services', 'ADMIN', 'support', 'CC-3500', 280000.00, 8.0, 'CC-2100', false, true, 20000.00, 'active', '2018-06-01', now(), 2, (SELECT id FROM app.d_scope_business WHERE name = 'Business Operations Division'), '["hr", "finance", "administration"]', '{"services": ["payroll", "recruitment", "compliance", "insurance"], "regulatory_compliance": ["WSIB", "CRA", "ESA"]}'),

('Snow Removal Department', 'Seasonal snow removal services for residential and commercial properties including de-icing and winter maintenance', 'SNOW-REMOVAL', 'operational', 'CC-3600', 420000.00, 8.0, 'CC-2200', true, true, 40000.00, 'active', '2020-01-15', now(), 2, (SELECT id FROM app.d_scope_business WHERE name = 'Specialty Services Division'), '["snow-removal", "winter", "seasonal"]', '{"services": ["driveway_clearing", "walkway_maintenance", "de_icing", "commercial_lots"], "seasonal_operation": "November-March", "equipment": ["plows", "salt_spreaders", "blowers"]}'),

('Solar Installation Department', 'Renewable energy solutions specializing in residential solar panel installations, maintenance, and energy consulting', 'SOLAR', 'operational', 'CC-3700', 380000.00, 7.0, 'CC-2200', true, true, 85000.00, 'active', '2021-06-01', now(), 2, (SELECT id FROM app.d_scope_business WHERE name = 'Specialty Services Division'), '["solar", "renewable-energy", "installations"]', '{"services": ["solar_panels", "energy_audits", "battery_storage", "grid_tie"], "certified_installers": 5, "warranty_years": 25}');

