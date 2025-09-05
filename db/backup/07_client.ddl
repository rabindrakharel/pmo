-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Client management system for external stakeholder and customer relationships,
-- enabling comprehensive tracking and coordination with external entities including
-- clients, vendors, government agencies, and strategic partners.
--
-- Key Features:
-- • External relationship management and contact centralization
-- • Client grouping and categorization for project workflows
-- • Communication coordination and compliance tracking
-- • Integration with project management and approval workflows

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.d_client (
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
  -- Client-specific fields
  client_parent_id uuid REFERENCES app.d_client(id) ON DELETE SET NULL,
  contact jsonb NOT NULL DEFAULT '{}'::jsonb,
  level_id int,
  level_name text
);


-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Insert comprehensive client relationships representing various stakeholder types
INSERT INTO app.d_client (name, contact, tags, attr) VALUES

-- Government and Public Sector Clients
('Government of Ontario - Digital Services', 
 '{
   "primary": {
     "name": "Sarah Thompson",
     "title": "Director of Digital Services",
     "email": "sarah.thompson@ontario.ca",
     "phone": "+1-416-326-1234",
     "secure_email": "sarah.thompson@ontario.ca"
   },
   "secondary": {
     "name": "Michael Rodriguez",
     "title": "Senior Project Manager",
     "email": "michael.rodriguez@ontario.ca",
     "phone": "+1-416-326-1235"
   },
   "department": "Treasury Board Secretariat",
   "address": "777 Bay Street, Toronto, ON M7A 2J3",
   "languages": ["English", "French"],
   "security_clearance": "Secret",
   "preferred_communication": "secure_email",
   "business_hours": "8:30-16:30 EST",
   "accessibility_requirements": "AODA compliant communications",
   "billing_contact": "procurement@ontario.ca"
 }'::jsonb, 
 '["government", "ontario", "digital-services", "bilingual"]', 
 '{"jurisdiction": "provincial", "compliance_requirements": ["FIPPA", "AODA", "Official Languages Act"], "contract_type": "RFP", "security_classification": "protected", "project_value": 1200000}'),

('City of Toronto - IT Department',
 '{
   "primary": {
     "name": "Jennifer Liu",
     "title": "Chief Information Officer",
     "email": "jennifer.liu@toronto.ca",
     "phone": "+1-416-392-1234"
   },
   "technical": {
     "name": "David Kim",
     "title": "Senior Systems Architect",
     "email": "david.kim@toronto.ca",
     "phone": "+1-416-392-1240"
   },
   "address": "100 Queen Street West, Toronto, ON M5H 2N2",
   "languages": ["English"],
   "preferred_communication": "email",
   "business_hours": "8:30-16:30 EST",
   "procurement_contact": "procurement@toronto.ca"
 }'::jsonb,
 '["municipal", "toronto", "it-services"]',
 '{"jurisdiction": "municipal", "compliance_requirements": ["MFIPPA"], "contract_type": "vendor_of_record", "project_value": 450000}'),

-- Enterprise and Financial Services Clients
('Royal Bank of Canada - Digital Innovation Lab',
 '{
   "primary": {
     "name": "Michael Chen",
     "title": "VP Digital Products",
     "email": "michael.chen@rbc.com",
     "phone": "+1-416-955-1234"
   },
   "secondary": {
     "name": "Lisa Wang",
     "title": "Senior Product Manager",
     "email": "lisa.wang@rbc.com",
     "phone": "+1-416-955-1240"
   },
   "technical": {
     "name": "David Rodriguez",
     "title": "Chief Technology Architect",
     "email": "david.rodriguez@rbc.com",
     "phone": "+1-416-955-1250"
   },
   "address": "200 Bay Street, Toronto, ON M5J 2J5",
   "languages": ["English", "French"],
   "preferred_communication": "secure_email",
   "business_hours": "9:00-17:00 EST",
   "escalation_contact": "escalation@rbc.com",
   "compliance_contact": "compliance@rbc.com"
 }'::jsonb,
 '["financial-services", "banking", "enterprise", "mobile-app"]',
 '{"industry": "financial_services", "security_requirements": ["PCI-DSS", "SOX"], "compliance_requirements": ["OSFI", "PIPEDA"], "contract_type": "MSA", "project_value": 850000}'),

('Shopify Inc. - Platform Engineering',
 '{
   "primary": {
     "name": "Amanda Foster",
     "title": "Director of Platform Engineering",
     "email": "amanda.foster@shopify.com",
     "phone": "+1-613-241-2828"
   },
   "technical": {
     "name": "Roberto Santos",
     "title": "Senior Staff Engineer",
     "email": "roberto.santos@shopify.com",
     "phone": "+1-613-241-2830"
   },
   "address": "150 Elgin Street, Ottawa, ON K2P 1L4",
   "languages": ["English", "French"],
   "preferred_communication": "slack",
   "business_hours": "9:00-17:00 EST",
   "slack_workspace": "shopify-techcorp.slack.com",
   "emergency_contact": "on-call@shopify.com"
 }'::jsonb,
 '["technology", "e-commerce", "platform", "scale"]',
 '{"industry": "technology", "collaboration_model": "agile", "communication_tools": ["slack", "jira", "confluence"], "contract_type": "SOW", "project_value": 650000}'),

-- Academic and Research Partners
('University of Toronto - Computer Science Department',
 '{
   "primary": {
     "name": "Dr. Jennifer Liu",
     "title": "Research Director",
     "email": "j.liu@cs.toronto.edu",
     "phone": "+1-416-978-4000"
   },
   "research_coordinator": {
     "name": "Dr. Ahmed Hassan",
     "title": "Principal Investigator",
     "email": "ahmed.hassan@cs.toronto.edu",
     "phone": "+1-416-978-4010"
   },
   "ip_contact": {
     "name": "Technology Transfer Office",
     "email": "tech.transfer@utoronto.ca",
     "phone": "+1-416-978-7718"
   },
   "address": "40 St. George Street, Toronto, ON M5S 2E4",
   "languages": ["English"],
   "preferred_communication": "email",
   "business_hours": "9:00-17:00 EST",
   "research_ethics": "approval_required",
   "student_contacts": ["grad.students@cs.toronto.edu"]
 }'::jsonb,
 '["academic", "research", "university", "ai-analytics"]',
 '{"partnership_type": "research_collaboration", "ip_sharing": "joint_ownership", "student_involvement": true, "publication_rights": "joint", "research_agreement": "active", "funding_source": ["NSERC", "internal"]}'),

('McGill University - AI Research Lab',
 '{
   "primary": {
     "name": "Dr. Marie Dubois",
     "title": "Laboratory Director",
     "email": "marie.dubois@mcgill.ca",
     "phone": "+1-514-398-1234"
   },
   "graduate_coordinator": {
     "name": "Dr. François Martin",
     "title": "Graduate Program Coordinator",
     "email": "francois.martin@mcgill.ca",
     "phone": "+1-514-398-1240"
   },
   "address": "845 Rue Sherbrooke Ouest, Montreal, QC H3A 0G4",
   "languages": ["French", "English"],
   "preferred_communication": "email",
   "business_hours": "9:00-17:00 EST",
   "collaboration_agreement": "active",
   "research_focus": ["machine_learning", "natural_language_processing"]
 }'::jsonb,
 '["academic", "research", "montreal", "ai", "bilingual"]',
 '{"partnership_type": "research_collaboration", "primary_language": "French", "ip_sharing": "shared_publication", "research_agreement": "active", "funding_source": ["FRQNT", "industry_partnership"]}'),

-- Technology Vendors and Suppliers
('Cisco Canada - Enterprise Solutions',
 '{
   "primary": {
     "name": "Robert Kim",
     "title": "Enterprise Account Manager",
     "email": "robert.kim@cisco.com",
     "phone": "+1-416-564-1234"
   },
   "technical_support": {
     "email": "support@cisco.com",
     "phone": "+1-800-553-6387"
   },
   "emergency_support": {
     "phone": "+1-800-553-2447",
     "escalation": "critical_systems_only"
   },
   "address": "181 Bay Street, Toronto, ON M5J 2T3",
   "languages": ["English", "French"],
   "preferred_communication": "email",
   "business_hours": "8:00-17:00 EST",
   "account_team": ["presales", "technical", "support"],
   "contract_manager": "contracts@cisco.com"
 }'::jsonb,
 '["vendor", "networking", "infrastructure", "enterprise"]',
 '{"vendor_type": "technology_supplier", "relationship": "strategic_partner", "contract_type": "enterprise_agreement", "support_level": "premium", "sla": "4_hour_response"}'),

('Amazon Web Services - Canada',
 '{
   "primary": {
     "name": "Patricia Anderson",
     "title": "Solutions Architect",
     "email": "patricia.anderson@amazon.com",
     "phone": "+1-416-646-1234"
   },
   "technical_account_manager": {
     "name": "James Thompson",
     "title": "Technical Account Manager",
     "email": "james.thompson@amazon.com",
     "phone": "+1-416-646-1240"
   },
   "billing_contact": {
     "email": "billing@amazon.com"
   },
   "address": "120 Bremner Blvd, Toronto, ON M5J 0A8",
   "languages": ["English", "French"],
   "preferred_communication": "email",
   "business_hours": "24/7 support available",
   "support_portal": "https://console.aws.amazon.com/support/"
 }'::jsonb,
 '["vendor", "cloud", "infrastructure", "aws"]',
 '{"vendor_type": "cloud_provider", "relationship": "strategic_partner", "contract_type": "pay_as_you_go", "support_level": "business", "data_residency": "canada_central"}'),

-- Consulting and Professional Services
('Deloitte Digital - Technology Consulting',
 '{
   "primary": {
     "name": "Sandra Martinez",
     "title": "Managing Director",
     "email": "sandra.martinez@deloitte.ca",
     "phone": "+1-416-643-1234"
   },
   "project_lead": {
     "name": "Kevin Wang",
     "title": "Senior Manager",
     "email": "kevin.wang@deloitte.ca",
     "phone": "+1-416-643-1240"
   },
   "address": "Bay Adelaide Centre, 333 Bay Street, Toronto, ON M5H 2R2",
   "languages": ["English", "French"],
   "preferred_communication": "email",
   "business_hours": "8:00-18:00 EST",
   "expertise": ["digital_transformation", "cloud_migration", "agile_coaching"]
 }'::jsonb,
 '["consulting", "professional-services", "digital-transformation"]',
 '{"service_type": "management_consulting", "expertise_areas": ["strategy", "technology", "operations"], "contract_type": "time_and_materials", "clearance_level": "public"}'),

-- International and Remote Clients
('TechStart Solutions - Berlin Office',
 '{
   "primary": {
     "name": "Klaus Mueller",
     "title": "Chief Technology Officer",
     "email": "klaus.mueller@techstart.de",
     "phone": "+49-30-1234-5678"
   },
   "local_contact": {
     "name": "Emma Johnson",
     "title": "North American Liaison",
     "email": "emma.johnson@techstart.de",
     "phone": "+1-647-555-1234"
   },
   "address": "Unter den Linden 77, 10117 Berlin, Germany",
   "languages": ["German", "English"],
   "preferred_communication": "video_conference",
   "business_hours": "9:00-17:00 CET (UTC+1)",
   "timezone": "Europe/Berlin",
   "collaboration_tools": ["teams", "slack"]
 }'::jsonb,
 '["international", "european", "technology", "remote"]',
 '{"geographic_region": "europe", "timezone_difference": "+6_hours", "currency": "EUR", "contract_jurisdiction": "ontario_law", "data_residency": "canadian_requirements"}');

-- Client group functionality removed - client grouping now handled via tags and attributes in main d_client table

-- Indexes removed for simplified import
