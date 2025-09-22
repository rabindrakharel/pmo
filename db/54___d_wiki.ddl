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
),
(
  'Safety Protocols and Emergency Procedures',
  'safety-protocols',
  'Comprehensive safety protocols and emergency procedures for all Huron Home Services operations',
  ARRAY['safety','emergency','protocols','procedures','training'],
  '{"type":"html","html":"<h1>Safety Protocols and Emergency Procedures</h1><h2>General Safety Guidelines</h2><ul><li>Personal Protective Equipment (PPE) requirements for all job sites</li><li>Vehicle safety and pre-trip inspection procedures</li><li>Tool and equipment safety protocols</li><li>Chemical handling and WHMIS compliance</li></ul><h2>Emergency Procedures</h2><ul><li>Accident reporting and response procedures</li><li>Medical emergency protocols</li><li>Equipment failure and workplace incident reporting</li><li>Client property damage procedures</li></ul><h2>Training Requirements</h2><ul><li>Annual safety training certification</li><li>Job-specific safety briefings</li><li>New employee orientation safety module</li></ul>"}',
  '<h1>Safety Protocols and Emergency Procedures</h1><h2>General Safety Guidelines</h2><ul><li>Personal Protective Equipment (PPE) requirements for all job sites</li><li>Vehicle safety and pre-trip inspection procedures</li><li>Tool and equipment safety protocols</li><li>Chemical handling and WHMIS compliance</li></ul><h2>Emergency Procedures</h2><ul><li>Accident reporting and response procedures</li><li>Medical emergency protocols</li><li>Equipment failure and workplace incident reporting</li><li>Client property damage procedures</li></ul><h2>Training Requirements</h2><ul><li>Annual safety training certification</li><li>Job-specific safety briefings</li><li>New employee orientation safety module</li></ul>',
  true,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'James Miller'
),
(
  'HVAC Systems Maintenance Guidelines',
  'hvac-maintenance-guidelines',
  'Technical maintenance guidelines and best practices for HVAC systems servicing',
  ARRAY['hvac','maintenance','technical','guidelines','procedures'],
  '{"type":"html","html":"<h1>HVAC Systems Maintenance Guidelines</h1><h2>Preventive Maintenance Schedule</h2><ul><li>Quarterly filter replacement and system inspection</li><li>Annual heat exchanger cleaning and safety testing</li><li>Bi-annual refrigerant level checks and leak detection</li><li>Monthly thermostat calibration verification</li></ul><h2>Diagnostic Procedures</h2><ul><li>System performance testing protocols</li><li>Electrical component inspection procedures</li><li>Airflow measurement and optimization</li><li>Energy efficiency assessment methods</li></ul><h2>Safety and Compliance</h2><ul><li>TSSA gas equipment certification requirements</li><li>Refrigerant handling and recovery procedures</li><li>Electrical safety protocols for HVAC work</li></ul>"}',
  '<h1>HVAC Systems Maintenance Guidelines</h1><h2>Preventive Maintenance Schedule</h2><ul><li>Quarterly filter replacement and system inspection</li><li>Annual heat exchanger cleaning and safety testing</li><li>Bi-annual refrigerant level checks and leak detection</li><li>Monthly thermostat calibration verification</li></ul><h2>Diagnostic Procedures</h2><ul><li>System performance testing protocols</li><li>Electrical component inspection procedures</li><li>Airflow measurement and optimization</li><li>Energy efficiency assessment methods</li></ul><h2>Safety and Compliance</h2><ul><li>TSSA gas equipment certification requirements</li><li>Refrigerant handling and recovery procedures</li><li>Electrical safety protocols for HVAC work</li></ul>',
  true,
  (SELECT id FROM app.d_employee WHERE email = 'mike.torres@huronhome.ca'),
  'Mike Torres'
)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- FALL 2025 LANDSCAPING CAMPAIGN WIKI ENTRIES
-- ============================================================================

-- Wiki entries specific to the Fall 2025 Landscaping Campaign project
INSERT INTO app.d_wiki (title, slug, summary, tags, content, content_html, published, owner_id, owner_name)
VALUES (
  'Fall 2025 Landscaping Campaign Overview',
  'fall-2025-landscaping-overview',
  'Comprehensive overview of the Fall 2025 Landscaping Campaign including objectives, timeline, and team assignments',
  ARRAY['fall-2025','landscaping','campaign','project-overview','seasonal'],
  '{"type":"html","html":"<h1>Fall 2025 Landscaping Campaign Overview</h1><h2>Project Objectives</h2><ul><li>Complete seasonal landscaping services for 25+ premium residential and commercial clients</li><li>Establish long-term client relationships through exceptional fall services</li><li>Demonstrate expertise in seasonal transition and winter preparation</li><li>Generate $450,000 in campaign revenue with 15% profit margin</li></ul><h2>Service Areas</h2><ul><li>Oakville premium residential properties</li><li>Mississauga commercial and retail locations</li><li>Toronto high-profile commercial accounts</li></ul><h2>Campaign Timeline</h2><ul><li><strong>August 2025:</strong> Equipment preparation and material procurement</li><li><strong>September 2025:</strong> Site assessments, soil preparation, and seeding</li><li><strong>October 2025:</strong> Plant installation, maintenance, and quality inspection</li><li><strong>November 2025:</strong> Winterization and campaign completion</li></ul><h2>Team Assignments</h2><ul><li><strong>James Miller:</strong> Campaign oversight, client relations, quality assurance</li><li><strong>Amanda Foster:</strong> Site assessments, fertilizer programs</li><li><strong>Tom Richardson:</strong> Seeding operations, boundary marking</li><li><strong>Carlos Santos:</strong> Equipment management, soil preparation, mulching</li><li><strong>Patricia Lee:</strong> Plant installation, material coordination</li></ul>"}',
  '<h1>Fall 2025 Landscaping Campaign Overview</h1><h2>Project Objectives</h2><ul><li>Complete seasonal landscaping services for 25+ premium residential and commercial clients</li><li>Establish long-term client relationships through exceptional fall services</li><li>Demonstrate expertise in seasonal transition and winter preparation</li><li>Generate $450,000 in campaign revenue with 15% profit margin</li></ul><h2>Service Areas</h2><ul><li>Oakville premium residential properties</li><li>Mississauga commercial and retail locations</li><li>Toronto high-profile commercial accounts</li></ul><h2>Campaign Timeline</h2><ul><li><strong>August 2025:</strong> Equipment preparation and material procurement</li><li><strong>September 2025:</strong> Site assessments, soil preparation, and seeding</li><li><strong>October 2025:</strong> Plant installation, maintenance, and quality inspection</li><li><strong>November 2025:</strong> Winterization and campaign completion</li></ul><h2>Team Assignments</h2><ul><li><strong>James Miller:</strong> Campaign oversight, client relations, quality assurance</li><li><strong>Amanda Foster:</strong> Site assessments, fertilizer programs</li><li><strong>Tom Richardson:</strong> Seeding operations, boundary marking</li><li><strong>Carlos Santos:</strong> Equipment management, soil preparation, mulching</li><li><strong>Patricia Lee:</strong> Plant installation, material coordination</li></ul>',
  true,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'James Miller'
),
(
  'Fall Soil Preparation Best Practices',
  'fall-soil-preparation-guide',
  'Technical guide for optimal soil preparation techniques specific to fall landscaping and winter readiness',
  ARRAY['soil-preparation','fall-landscaping','best-practices','technical-guide','seasonal'],
  '{"type":"html","html":"<h1>Fall Soil Preparation Best Practices</h1><h2>Soil Testing and Analysis</h2><ul><li>Conduct comprehensive soil pH testing (optimal range 6.0-7.0)</li><li>Test for nutrient deficiencies (nitrogen, phosphorus, potassium)</li><li>Assess soil compaction levels and drainage capabilities</li><li>Document findings for targeted amendment application</li></ul><h2>Aeration Techniques</h2><ul><li>Core aeration for heavily trafficked areas (2-3 inch depth)</li><li>Spike aeration for lighter compaction relief</li><li>Optimal timing: early September when soil moisture is moderate</li><li>Post-aeration overseeding within 48 hours for best results</li></ul><h2>Organic Amendment Application</h2><ul><li>Compost incorporation at 1-2 inch depth</li><li>Balanced fall fertilizer (higher potassium for winter hardiness)</li><li>Mycorrhizal inoculant for enhanced root development</li><li>Slow-release nitrogen for sustained spring growth</li></ul><h2>Moisture Management</h2><ul><li>Ensure adequate soil moisture before winter freeze</li><li>Install drainage solutions in problem areas</li><li>Mulch application to retain moisture and prevent freeze-thaw cycles</li></ul>"}',
  '<h1>Fall Soil Preparation Best Practices</h1><h2>Soil Testing and Analysis</h2><ul><li>Conduct comprehensive soil pH testing (optimal range 6.0-7.0)</li><li>Test for nutrient deficiencies (nitrogen, phosphorus, potassium)</li><li>Assess soil compaction levels and drainage capabilities</li><li>Document findings for targeted amendment application</li></ul><h2>Aeration Techniques</h2><ul><li>Core aeration for heavily trafficked areas (2-3 inch depth)</li><li>Spike aeration for lighter compaction relief</li><li>Optimal timing: early September when soil moisture is moderate</li><li>Post-aeration overseeding within 48 hours for best results</li></ul><h2>Organic Amendment Application</h2><ul><li>Compost incorporation at 1-2 inch depth</li><li>Balanced fall fertilizer (higher potassium for winter hardiness)</li><li>Mycorrhizal inoculant for enhanced root development</li><li>Slow-release nitrogen for sustained spring growth</li></ul><h2>Moisture Management</h2><ul><li>Ensure adequate soil moisture before winter freeze</li><li>Install drainage solutions in problem areas</li><li>Mulch application to retain moisture and prevent freeze-thaw cycles</li></ul>',
  true,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'James Miller'
),
(
  'Cool-Season Grass Seeding Guide',
  'cool-season-grass-seeding',
  'Comprehensive guide to fall seeding with cool-season grass varieties for optimal establishment and spring performance',
  ARRAY['grass-seeding','cool-season','fall-planting','turf-establishment','landscaping'],
  '{"type":"html","html":"<h1>Cool-Season Grass Seeding Guide</h1><h2>Recommended Varieties</h2><ul><li><strong>Tall Fescue:</strong> Drought tolerant, high traffic areas, deep root system</li><li><strong>Perennial Ryegrass:</strong> Quick establishment, excellent wear tolerance</li><li><strong>Fine Fescue:</strong> Shade tolerance, low maintenance requirements</li><li><strong>Kentucky Bluegrass:</strong> Premium appearance, moderate maintenance</li></ul><h2>Seeding Rates and Timing</h2><ul><li>New lawns: 3-4 lbs per 1,000 sq ft</li><li>Overseeding: 1-2 lbs per 1,000 sq ft</li><li>Optimal timing: September 15 - October 15</li><li>Soil temperature: 50-65°F for optimal germination</li></ul><h2>Application Techniques</h2><ul><li>Broadcast seeding with mechanical spreader for even distribution</li><li>Light raking to ensure seed-soil contact (¼ inch depth)</li><li>Starter fertilizer application concurrent with seeding</li><li>Light mulch application to retain moisture</li></ul><h2>Post-Seeding Care</h2><ul><li>Daily watering for first 2-3 weeks (light, frequent applications)</li><li>Avoid foot traffic during germination period</li><li>First mowing when grass reaches 3 inches height</li><li>Fall fertilizer application 6-8 weeks after germination</li></ul>"}',
  '<h1>Cool-Season Grass Seeding Guide</h1><h2>Recommended Varieties</h2><ul><li><strong>Tall Fescue:</strong> Drought tolerant, high traffic areas, deep root system</li><li><strong>Perennial Ryegrass:</strong> Quick establishment, excellent wear tolerance</li><li><strong>Fine Fescue:</strong> Shade tolerance, low maintenance requirements</li><li><strong>Kentucky Bluegrass:</strong> Premium appearance, moderate maintenance</li></ul><h2>Seeding Rates and Timing</h2><ul><li>New lawns: 3-4 lbs per 1,000 sq ft</li><li>Overseeding: 1-2 lbs per 1,000 sq ft</li><li>Optimal timing: September 15 - October 15</li><li>Soil temperature: 50-65°F for optimal germination</li></ul><h2>Application Techniques</h2><ul><li>Broadcast seeding with mechanical spreader for even distribution</li><li>Light raking to ensure seed-soil contact (¼ inch depth)</li><li>Starter fertilizer application concurrent with seeding</li><li>Light mulch application to retain moisture</li></ul><h2>Post-Seeding Care</h2><ul><li>Daily watering for first 2-3 weeks (light, frequent applications)</li><li>Avoid foot traffic during germination period</li><li>First mowing when grass reaches 3 inches height</li><li>Fall fertilizer application 6-8 weeks after germination</li></ul>',
  true,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'James Miller'
),
(
  'Seasonal Plant Selection and Installation',
  'seasonal-plant-installation',
  'Guide to selecting and installing seasonal plants for fall color and spring preparation in the Greater Toronto Area',
  ARRAY['seasonal-plants','fall-installation','plant-selection','landscaping','horticulture'],
  '{"type":"html","html":"<h1>Seasonal Plant Selection and Installation</h1><h2>Fall Color Plants</h2><ul><li><strong>Chrysanthemums (Mums):</strong> Hardy varieties, diverse colors, 6-8 week bloom period</li><li><strong>Asters:</strong> Native species, excellent for pollinators, purple/pink blooms</li><li><strong>Ornamental Kale:</strong> Cold tolerant, unique foliage, lasts until hard frost</li><li><strong>Pansies:</strong> Cool weather blooms, winter hardy varieties available</li></ul><h2>Spring Bulb Installation</h2><ul><li><strong>Tulips:</strong> Plant 6 inches deep, October-November installation</li><li><strong>Daffodils:</strong> Naturalize well, deer resistant, early spring color</li><li><strong>Crocuses:</strong> First spring blooms, excellent for naturalizing</li><li><strong>Hyacinths:</strong> Fragrant blooms, structured garden appearance</li></ul><h2>Installation Best Practices</h2><ul><li>Soil preparation with compost and balanced fertilizer</li><li>Proper planting depth based on bulb size (3x bulb height)</li><li>Adequate spacing for mature plant size</li><li>Water thoroughly after installation</li><li>Mulch application for winter protection</li></ul><h2>Maintenance Schedule</h2><ul><li>Weekly watering until ground freeze</li><li>Deadheading spent blooms</li><li>Winter protection for tender varieties</li><li>Spring fertilizer application for bulbs</li></ul>"}',
  '<h1>Seasonal Plant Selection and Installation</h1><h2>Fall Color Plants</h2><ul><li><strong>Chrysanthemums (Mums):</strong> Hardy varieties, diverse colors, 6-8 week bloom period</li><li><strong>Asters:</strong> Native species, excellent for pollinators, purple/pink blooms</li><li><strong>Ornamental Kale:</strong> Cold tolerant, unique foliage, lasts until hard frost</li><li><strong>Pansies:</strong> Cool weather blooms, winter hardy varieties available</li></ul><h2>Spring Bulb Installation</h2><ul><li><strong>Tulips:</strong> Plant 6 inches deep, October-November installation</li><li><strong>Daffodils:</strong> Naturalize well, deer resistant, early spring color</li><li><strong>Crocuses:</strong> First spring blooms, excellent for naturalizing</li><li><strong>Hyacinths:</strong> Fragrant blooms, structured garden appearance</li></ul><h2>Installation Best Practices</h2><ul><li>Soil preparation with compost and balanced fertilizer</li><li>Proper planting depth based on bulb size (3x bulb height)</li><li>Adequate spacing for mature plant size</li><li>Water thoroughly after installation</li><li>Mulch application for winter protection</li></ul><h2>Maintenance Schedule</h2><ul><li>Weekly watering until ground freeze</li><li>Deadheading spent blooms</li><li>Winter protection for tender varieties</li><li>Spring fertilizer application for bulbs</li></ul>',
  true,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'James Miller'
),
(
  'Client Communication Standards',
  'client-communication-standards',
  'Professional communication standards and protocols for maintaining excellent client relationships during landscaping projects',
  ARRAY['client-communication','standards','protocols','customer-service','project-management'],
  '{"type":"html","html":"<h1>Client Communication Standards</h1><h2>Initial Project Communication</h2><ul><li>Site visit confirmation 24-48 hours in advance</li><li>Detailed project timeline and milestone communication</li><li>Clear explanation of weather dependency factors</li><li>Emergency contact information and procedures</li></ul><h2>Ongoing Project Updates</h2><ul><li>Weekly progress reports via email with photos</li><li>Immediate notification of any schedule changes</li><li>Daily communication during active work periods</li><li>Proactive weather-related schedule adjustments</li></ul><h2>Quality Assurance Communication</h2><ul><li>Pre-work site condition documentation</li><li>Daily progress photography</li><li>Quality checkpoint reviews with client</li><li>Final walkthrough and satisfaction confirmation</li></ul><h2>Professional Standards</h2><ul><li>Response to client inquiries within 4 hours</li><li>Professional appearance and branded uniforms</li><li>Respectful property protection and cleanup</li><li>Clear documentation of all communications</li></ul><h2>Issue Resolution Process</h2><ul><li>Immediate acknowledgment of client concerns</li><li>Clear action plan and timeline for resolution</li><li>Follow-up confirmation of satisfaction</li><li>Documentation of lessons learned</li></ul>"}',
  '<h1>Client Communication Standards</h1><h2>Initial Project Communication</h2><ul><li>Site visit confirmation 24-48 hours in advance</li><li>Detailed project timeline and milestone communication</li><li>Clear explanation of weather dependency factors</li><li>Emergency contact information and procedures</li></ul><h2>Ongoing Project Updates</h2><ul><li>Weekly progress reports via email with photos</li><li>Immediate notification of any schedule changes</li><li>Daily communication during active work periods</li><li>Proactive weather-related schedule adjustments</li></ul><h2>Quality Assurance Communication</h2><ul><li>Pre-work site condition documentation</li><li>Daily progress photography</li><li>Quality checkpoint reviews with client</li><li>Final walkthrough and satisfaction confirmation</li></ul><h2>Professional Standards</h2><ul><li>Response to client inquiries within 4 hours</li><li>Professional appearance and branded uniforms</li><li>Respectful property protection and cleanup</li><li>Clear documentation of all communications</li></ul><h2>Issue Resolution Process</h2><ul><li>Immediate acknowledgment of client concerns</li><li>Clear action plan and timeline for resolution</li><li>Follow-up confirmation of satisfaction</li><li>Documentation of lessons learned</li></ul>',
  true,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'James Miller'
)
ON CONFLICT (slug) DO NOTHING;


