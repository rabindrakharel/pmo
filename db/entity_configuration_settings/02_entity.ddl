-- =====================================================
-- ENTITY TYPE METADATA (d_entity)
-- =====================================================
--
-- SEMANTICS:
-- • Single source of truth for entity TYPE definitions (not instances)
-- • Defines parent-child relationships, UI icons, labels for dynamic UI
-- • Powers tab generation, navigation menus, entity pickers
--
-- OPERATIONS:
-- • GET TYPE: GET /api/v1/entity/type/:code
-- • GET ALL: GET /api/v1/entity/types ORDER BY display_order
-- • GET CHILDREN: SELECT child_entities WHERE code=$1
-- • UPSERT: INSERT ... ON CONFLICT (code) DO UPDATE
--
-- PARENT-CHILD MAPPING:
-- • office → task, artifact, wiki, form, cost, revenue
-- • business → project, cost, revenue
-- • project → task, wiki, artifact, form, cost, revenue
-- • task → form, artifact, cost, revenue, employee (assignees)
-- • cust → project, artifact, form, cost, revenue
-- • role → employee
-- • form, quote, order → (have children per child_entities JSONB)
-- • Leaf nodes: employee, wiki, artifact, worksite, reports, service, product, etc.
--
-- =====================================================

CREATE TABLE app.d_entity (
    code varchar(50) NOT NULL PRIMARY KEY,
    name varchar(100) NOT NULL,
    ui_label varchar(100) NOT NULL,
    ui_icon varchar(50),
    db_table varchar(100), -- ✨ NEW: Database table name (d_project, f_message_data, etc.) - Fully dynamic entity-to-table mapping!
    child_entities jsonb DEFAULT '[]'::jsonb,
    display_order int4 NOT NULL DEFAULT 999,
    dl_entity_domain varchar(100), -- DEPRECATED: Legacy domain categorization (use domain_id/code/name instead)
    domain_id int4, -- Foreign key to d_domain.domain_id (denormalized for performance)
    domain_code varchar(50), -- Denormalized domain code (customer_360, operations, etc.)
    domain_name varchar(100), -- Denormalized domain name (Customer 360, Operations, etc.)
    column_metadata jsonb DEFAULT '[]'::jsonb, -- Column definitions: [{orderid, name, descr, datatype, is_nullable, default_value}]
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

COMMENT ON TABLE app.d_entity IS 'Entity TYPE metadata with parent-child relationships and icons - single source of truth for entity type definitions';
COMMENT ON COLUMN app.d_entity.code IS 'Entity type identifier (office, business, project, task, etc.)';
COMMENT ON COLUMN app.d_entity.name IS 'Entity name (Office, Business, Project, Task, etc.)';
COMMENT ON COLUMN app.d_entity.ui_label IS 'UI display label for entity type plural (Offices, Businesses, Projects, Tasks, etc.)';
COMMENT ON COLUMN app.d_entity.ui_icon IS 'Lucide icon name for UI display (FolderOpen, CheckSquare, Users, etc.)';
COMMENT ON COLUMN app.d_entity.db_table IS '✨ Database table name for entity (d_project, f_message_data, etc.) - Single source of truth for entity-to-table mapping';
COMMENT ON COLUMN app.d_entity.child_entities IS 'JSONB array of child entity metadata: [{"entity": "task", "ui_icon": "CheckSquare", "ui_label": "Tasks", "order": 1}]';
COMMENT ON COLUMN app.d_entity.domain_id IS 'Domain ID (denormalized from d_domain for performance)';
COMMENT ON COLUMN app.d_entity.domain_code IS 'Domain code (denormalized from d_domain for performance)';
COMMENT ON COLUMN app.d_entity.domain_name IS 'Domain name (denormalized from d_domain for performance)';

-- =====================================================
-- DATA CURATION
-- Populate entity TYPE metadata with parent-child relationships
-- =====================================================

-- Office entity type (has 6 child types)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, db_table, child_entities, display_order, dl_entity_domain)
VALUES (
  'office',
  'Office',
  'Offices',
  'MapPin',
  'd_office',
  '["task", "artifact", "wiki", "form", "expense", "revenue"]'::jsonb,
  10,
  'Organization'
);

-- Business entity type (has 3 child types)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'business',
  'Business',
  'Businesses',
  'Building2',
  '["project", "expense", "revenue"]'::jsonb,
  20
);

-- Project entity type (has 6 child types)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'project',
  'Project',
  'Projects',
  'FolderOpen',
  '["task", "wiki", "artifact", "form", "expense", "revenue"]'::jsonb,
  30
);

-- Task entity type (has 4 child types)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'task',
  'Task',
  'Tasks',
  'CheckSquare',
  '["form", "artifact", "expense", "revenue"]'::jsonb,
  40
);

-- Customer entity type (has 5 child types)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'cust',
  'Customer',
  'Customers',
  'Users',
  '["project", "artifact", "form", "expense", "revenue"]'::jsonb,
  50
);

-- Role entity type (has 2 child types)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'role',
  'Role',
  'Roles',
  'UserCheck',
  '["rbac", "employee"]'::jsonb,
  60
);

-- Form entity type (has 1 child type)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'form',
  'Form',
  'Forms',
  'FileText',
  '["artifact"]'::jsonb,
  70
);

-- Employee entity type (has 1 child type)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'employee',
  'Employee',
  'Employees',
  'Users',
  '["rbac"]'::jsonb,
  80
);

-- RBAC entity type (permissions - child of role and employee)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'rbac',
  'Permission',
  'Permissions',
  'Shield',
  '[]'::jsonb,
  85
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  child_entities = EXCLUDED.child_entities,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Wiki entity type (leaf node - no children)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'wiki',
  'Wiki',
  'Wiki Pages',
  'BookOpen',
  '[]'::jsonb,
  90
);

-- Person entity type (base entity for all people)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, db_table, child_entities, display_order)
VALUES (
  'person',
  'Person',
  'People',
  'User',
  'd_person',
  '[]'::jsonb,
  95
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  db_table = EXCLUDED.db_table,
  child_entities = EXCLUDED.child_entities,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Artifact entity type (leaf node - no children)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'artifact',
  'Artifact',
  'Artifacts',
  'FileText',
  '[]'::jsonb,
  100
);

-- Attachment entity type (file attachments - referenced by artifact, invoice)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, db_table, child_entities, display_order)
VALUES (
  'attachment',
  'Attachment',
  'Attachments',
  'Paperclip',
  'd_attachment',
  '[]'::jsonb,
  101
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  db_table = EXCLUDED.db_table,
  child_entities = EXCLUDED.child_entities,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Worksite entity type (leaf node - no children)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'worksite',
  'Worksite',
  'Worksites',
  'MapPin',
  '[]'::jsonb,
  110
);

-- Reports entity type (leaf node - no children)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'reports',
  'Reports',
  'Reports',
  'BarChart',
  '[]'::jsonb,
  130
);

-- Calendar entity type (leaf node - no children)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'calendar',
  'Calendar',
  'Calendars',
  'Calendar',
  '[]'::jsonb,
  135
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  child_entities = EXCLUDED.child_entities,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Service entity type (leaf node - no children)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'service',
  'Service',
  'Services',
  'Wrench',
  '[]'::jsonb,
  135
);

-- Product entity type (leaf node - no children)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'product',
  'Product',
  'Products',
  'Package',
  '[]'::jsonb,
  140
);

-- Supplier entity type (vendors/suppliers for procurement)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, db_table, child_entities, display_order)
VALUES (
  'supplier',
  'Supplier',
  'Suppliers',
  'Building',
  'd_supplier',
  '[]'::jsonb,
  141
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  db_table = EXCLUDED.db_table,
  child_entities = EXCLUDED.child_entities,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Quote entity type (has 1 child type: work_order)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'quote',
  'Quote',
  'Quotes',
  'FileText',
  '[
    {"entity": "work_order", "ui_icon": "ClipboardCheck", "ui_label": "Work Orders", "order": 1}
  ]'::jsonb,
  145
);

-- Work Order entity type (leaf node - no children)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'work_order',
  'Work Order',
  'Work Orders',
  'ClipboardCheck',
  '[]'::jsonb,
  155
);

-- Inventory entity type (leaf node - no children)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'inventory',
  'Inventory',
  'Inventory',
  'Warehouse',
  '[]'::jsonb,
  150
);

-- Order entity type (has 2 child types)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'order',
  'Order',
  'Orders',
  'ShoppingCart',
  '[
    {"entity": "invoice", "ui_icon": "Receipt", "ui_label": "Invoices", "order": 1},
    {"entity": "shipment", "ui_icon": "Truck", "ui_label": "Shipments", "order": 2}
  ]'::jsonb,
  160
);

-- Invoice entity type (leaf node - no children)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'invoice',
  'Invoice',
  'Invoices',
  'Receipt',
  '[]'::jsonb,
  170
);

-- Shipment entity type (leaf node - no children)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'shipment',
  'Shipment',
  'Shipments',
  'Truck',
  '[]'::jsonb,
  180
);

-- Expense entity type (leaf node - no children)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'expense',
  'Expense',
  'Expenses',
  'Receipt',
  '[]'::jsonb,
  190
);

-- Revenue entity type (leaf node - no children)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'revenue',
  'Revenue',
  'Revenue',
  'TrendingUp',
  '[]'::jsonb,
  200
);

-- Workflow entity type (leaf node - no children)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'workflow',
  'Workflow',
  'Workflows',
  'GitBranch',
  '[]'::jsonb,
  205
);

-- Event entity type (Universal parent - can have many child entities)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'event',
  'Event',
  'Events',
  'Calendar',
  '[
    {"entity": "task", "ui_icon": "CheckSquare", "ui_label": "Tasks", "order": 1},
    {"entity": "project", "ui_icon": "FolderOpen", "ui_label": "Projects", "order": 2},
    {"entity": "service", "ui_icon": "Wrench", "ui_label": "Services", "order": 3},
    {"entity": "cust", "ui_icon": "Users", "ui_label": "Customers", "order": 4},
    {"entity": "employee", "ui_icon": "Users", "ui_label": "Employees", "order": 5},
    {"entity": "business", "ui_icon": "Building2", "ui_label": "Businesses", "order": 6}
  ]'::jsonb,
  215
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  child_entities = EXCLUDED.child_entities,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Office Hierarchy entity type (Organizational structure hierarchy - separate from operational office)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'office_hierarchy',
  'Office Hierarchy',
  'Office Hierarchies',
  'Network',
  '[]'::jsonb,
  220
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  child_entities = EXCLUDED.child_entities,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Business Hierarchy entity type (Organizational structure hierarchy - separate from operational business)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'business_hierarchy',
  'Business Hierarchy',
  'Business Hierarchies',
  'Network',
  '[]'::jsonb,
  225
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  child_entities = EXCLUDED.child_entities,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Product Hierarchy entity type (Product categorization hierarchy - separate from SKU-level products)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'product_hierarchy',
  'Product Hierarchy',
  'Product Hierarchies',
  'Network',
  '[]'::jsonb,
  230
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  child_entities = EXCLUDED.child_entities,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Message Schema entity type (Email/SMS/Push templates)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'message_schema',
  'Message Schema',
  'Message Schemas',
  'Mail',
  '[]'::jsonb,
  240
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  child_entities = EXCLUDED.child_entities,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Message entity type (Sent/scheduled messages)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'message',
  'Message',
  'Messages',
  'Send',
  '[]'::jsonb,
  250
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  child_entities = EXCLUDED.child_entities,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Interaction entity type (Customer Interactions)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'interaction',
  'Interaction',
  'Interactions',
  'MessageCircle',
  '[]'::jsonb,
  270
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  child_entities = EXCLUDED.child_entities,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Workflow Automation entity type
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'workflow_automation',
  'Workflow Automation',
  'Workflow Automations',
  'Zap',
  '[]'::jsonb,
  280
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  child_entities = EXCLUDED.child_entities,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- =====================================================
-- META-ENTITIES: Self-Describing Infrastructure
-- =====================================================
-- Infrastructure tables registered as entities themselves
-- Creates self-describing entity system where d_entity describes itself

-- Entity meta-entity (represents the concept of 'entity' itself)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'entity',
  'Entity',
  'Entities',
  'Database',
  '[]'::jsonb,
  900
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  child_entities = EXCLUDED.child_entities,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Entity Instance meta-entity (renamed from entity_instance_registry)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'entity_instance',
  'Entity Instance',
  'Entity Instances',
  'List',
  '[]'::jsonb,
  910
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  child_entities = EXCLUDED.child_entities,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Entity Instance Link meta-entity
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'entity_instance_link',
  'Entity Instance Link',
  'Entity Instance Links',
  'Link',
  '[]'::jsonb,
  920
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  child_entities = EXCLUDED.child_entities,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Entity RBAC meta-entity
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'entity_rbac',
  'Entity RBAC',
  'Entity RBAC',
  'ShieldCheck',
  '[]'::jsonb,
  930
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  child_entities = EXCLUDED.child_entities,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- =====================================================
-- DATA CURATION: DOMAIN CATEGORIZATION (LEGACY)
-- =====================================================
-- DEPRECATED: Use domain_id/domain_code/domain_name instead
-- Assign entities to business domains for Settings page tabs (old system)

-- Core Management domain
UPDATE app.d_entity SET dl_entity_domain = 'Core Management'
WHERE code IN ('project', 'task');

-- Organization domain
UPDATE app.d_entity SET dl_entity_domain = 'Organization'
WHERE code IN ('office', 'employee', 'role', 'office_hierarchy');

-- Business domain
UPDATE app.d_entity SET dl_entity_domain = 'Business'
WHERE code IN ('business', 'business_hierarchy', 'worksite');

-- Operations domain
UPDATE app.d_entity SET dl_entity_domain = 'Operations'
WHERE code IN ('quote', 'work_order', 'workflow', 'workflow_automation');

-- Customers domain
UPDATE app.d_entity SET dl_entity_domain = 'Customers'
WHERE code IN ('cust', 'interaction');

-- Retail domain
UPDATE app.d_entity SET dl_entity_domain = 'Retail'
WHERE code IN ('service', 'product', 'product_hierarchy', 'inventory', 'order', 'shipment');

-- Sales & Finance domain
UPDATE app.d_entity SET dl_entity_domain = 'Sales & Finance'
WHERE code IN ('invoice', 'expense', 'revenue');

-- Content & Docs domain
UPDATE app.d_entity SET dl_entity_domain = 'Content & Docs'
WHERE code IN ('wiki', 'artifact', 'form', 'reports', 'message_schema', 'message');

-- Advanced domain
UPDATE app.d_entity SET dl_entity_domain = 'Advanced'
WHERE code IN ('event', 'calendar');

-- =====================================================
-- DATA CURATION: NEW DOMAIN ARCHITECTURE MAPPING
-- =====================================================
-- Map entities to new domain structure with denormalized fields
-- Based on the 11-domain architecture

-- DOMAIN 1: CUSTOMER 360
-- Purpose: Unified people, organizations, and business structures
UPDATE app.d_entity e SET
    domain_id = d.domain_id,
    domain_code = d.code,
    domain_name = d.name,
    updated_ts = now()
FROM app.d_domain d
WHERE d.code = 'customer_360'
  AND e.code IN ('cust', 'business', 'employee', 'role', 'office', 'worksite');

-- DOMAIN 2: OPERATIONS
-- Purpose: Internal operational execution (projects, tasks, work orders, services)
UPDATE app.d_entity e SET
    domain_id = d.domain_id,
    domain_code = d.code,
    domain_name = d.name,
    updated_ts = now()
FROM app.d_domain d
WHERE d.code = 'operations'
  AND e.code IN ('project', 'task', 'work_order', 'service');

-- DOMAIN 3: PRODUCT & INVENTORY
-- Purpose: Products, stock, consumables, materials
UPDATE app.d_entity e SET
    domain_id = d.domain_id,
    domain_code = d.code,
    domain_name = d.name,
    updated_ts = now()
FROM app.d_domain d
WHERE d.code = 'product_inventory'
  AND e.code IN ('product', 'inventory', 'product_hierarchy');

-- DOMAIN 4: ORDER & FULFILLMENT
-- Purpose: Sales pipelines, purchasing, delivery logistics
UPDATE app.d_entity e SET
    domain_id = d.domain_id,
    domain_code = d.code,
    domain_name = d.name,
    updated_ts = now()
FROM app.d_domain d
WHERE d.code = 'order_fulfillment'
  AND e.code IN ('quote', 'order', 'shipment', 'invoice');

-- DOMAIN 5: FINANCIAL MANAGEMENT
-- Purpose: Cost control, profitability, billing metrics
UPDATE app.d_entity e SET
    domain_id = d.domain_id,
    domain_code = d.code,
    domain_name = d.name,
    updated_ts = now()
FROM app.d_domain d
WHERE d.code = 'financial_management'
  AND e.code IN ('expense', 'revenue');

-- DOMAIN 6: COMMUNICATION & INTERACTION
-- Purpose: Messaging, engagement, interaction logs
UPDATE app.d_entity e SET
    domain_id = d.domain_id,
    domain_code = d.code,
    domain_name = d.name,
    updated_ts = now()
FROM app.d_domain d
WHERE d.code = 'communication_interaction'
  AND e.code IN ('message_schema', 'message', 'interaction');

-- DOMAIN 7: KNOWLEDGE & DOCUMENTATION
-- Purpose: Wikis, forms, artifacts, reports
UPDATE app.d_entity e SET
    domain_id = d.domain_id,
    domain_code = d.code,
    domain_name = d.name,
    updated_ts = now()
FROM app.d_domain d
WHERE d.code = 'knowledge_documentation'
  AND e.code IN ('wiki', 'artifact', 'form', 'reports');

-- DOMAIN 8: IDENTITY & ACCESS CONTROL
-- Purpose: RBAC, entity definitions, polymorphism, IDs
UPDATE app.d_entity e SET
    domain_id = d.domain_id,
    domain_code = d.code,
    domain_name = d.name,
    updated_ts = now()
FROM app.d_domain d
WHERE d.code = 'identity_access_control'
  AND e.code IN ('rbac');

-- DOMAIN 9: AUTOMATION & WORKFLOW
-- Purpose: DAG workflows, industry workflow packs, automation engine
UPDATE app.d_entity e SET
    domain_id = d.domain_id,
    domain_code = d.code,
    domain_name = d.name,
    updated_ts = now()
FROM app.d_domain d
WHERE d.code = 'automation_workflow'
  AND e.code IN ('workflow', 'workflow_automation');

-- DOMAIN 10: EVENT & CALENDAR
-- Purpose: Events, appointments, scheduling, person calendars, RSVP tracking
UPDATE app.d_entity e SET
    domain_id = d.domain_id,
    domain_code = d.code,
    domain_name = d.name,
    updated_ts = now()
FROM app.d_domain d
WHERE d.code = 'event_calendar'
  AND e.code IN ('event', 'calendar');

-- Handle hierarchies (assign to Customer 360 as organizational structures)
UPDATE app.d_entity e SET
    domain_id = d.domain_id,
    domain_code = d.code,
    domain_name = d.name,
    updated_ts = now()
FROM app.d_domain d
WHERE d.code = 'customer_360'
  AND e.code IN ('office_hierarchy', 'business_hierarchy');

-- =====================================================
-- DATA CURATION: COLUMN METADATA FROM INFORMATION_SCHEMA
-- =====================================================
-- Auto-populate column_metadata from database schema

-- Update column_metadata for all entities by querying information_schema
UPDATE app.d_entity e
SET column_metadata = (
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'orderid', c.ordinal_position,
      'name', c.column_name,
      'descr', col_description((table_schema || '.' || table_name)::regclass::oid, c.ordinal_position),
      'datatype', 
        CASE 
          WHEN c.data_type = 'ARRAY' THEN c.udt_name || '[]'
          WHEN c.character_maximum_length IS NOT NULL THEN c.data_type || '(' || c.character_maximum_length || ')'
          WHEN c.numeric_precision IS NOT NULL AND c.numeric_scale IS NOT NULL THEN c.data_type || '(' || c.numeric_precision || ',' || c.numeric_scale || ')'
          ELSE c.data_type
        END,
      'is_nullable', c.is_nullable = 'YES',
      'default_value', c.column_default
    ) ORDER BY c.ordinal_position
  ), '[]'::jsonb)
  FROM information_schema.columns c
  WHERE c.table_schema = 'app'
    AND c.table_name = 'd_' || e.code
)
WHERE EXISTS (
  SELECT 1 
  FROM information_schema.tables t
  WHERE t.table_schema = 'app'
    AND t.table_name = 'd_' || e.code
);

-- Special handling for entities with different table naming patterns

-- Update for client (table: d_client)
UPDATE app.d_entity e
SET column_metadata = (
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'orderid', c.ordinal_position,
      'name', c.column_name,
      'descr', col_description((table_schema || '.' || table_name)::regclass::oid, c.ordinal_position),
      'datatype', 
        CASE 
          WHEN c.data_type = 'ARRAY' THEN c.udt_name || '[]'
          WHEN c.character_maximum_length IS NOT NULL THEN c.data_type || '(' || c.character_maximum_length || ')'
          WHEN c.numeric_precision IS NOT NULL AND c.numeric_scale IS NOT NULL THEN c.data_type || '(' || c.numeric_precision || ',' || c.numeric_scale || ')'
          ELSE c.data_type
        END,
      'is_nullable', c.is_nullable = 'YES',
      'default_value', c.column_default
    ) ORDER BY c.ordinal_position
  ), '[]'::jsonb)
  FROM information_schema.columns c
  WHERE c.table_schema = 'app' AND c.table_name = 'd_client'
)
WHERE e.code = 'cust';

-- Update for forms (table: d_form_head)
UPDATE app.d_entity e
SET column_metadata = (
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'orderid', c.ordinal_position,
      'name', c.column_name,
      'descr', col_description((table_schema || '.' || table_name)::regclass::oid, c.ordinal_position),
      'datatype', 
        CASE 
          WHEN c.data_type = 'ARRAY' THEN c.udt_name || '[]'
          WHEN c.character_maximum_length IS NOT NULL THEN c.data_type || '(' || c.character_maximum_length || ')'
          WHEN c.numeric_precision IS NOT NULL AND c.numeric_scale IS NOT NULL THEN c.data_type || '(' || c.numeric_precision || ',' || c.numeric_scale || ')'
          ELSE c.data_type
        END,
      'is_nullable', c.is_nullable = 'YES',
      'default_value', c.column_default
    ) ORDER BY c.ordinal_position
  ), '[]'::jsonb)
  FROM information_schema.columns c
  WHERE c.table_schema = 'app' AND c.table_name = 'd_form_head'
)
WHERE e.code = 'form';

-- Update for fact tables (f_* instead of d_*)
UPDATE app.d_entity e
SET column_metadata = (
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'orderid', c.ordinal_position,
      'name', c.column_name,
      'descr', col_description((table_schema || '.' || table_name)::regclass::oid, c.ordinal_position),
      'datatype', 
        CASE 
          WHEN c.data_type = 'ARRAY' THEN c.udt_name || '[]'
          WHEN c.character_maximum_length IS NOT NULL THEN c.data_type || '(' || c.character_maximum_length || ')'
          WHEN c.numeric_precision IS NOT NULL AND c.numeric_scale IS NOT NULL THEN c.data_type || '(' || c.numeric_precision || ',' || c.numeric_scale || ')'
          ELSE c.data_type
        END,
      'is_nullable', c.is_nullable = 'YES',
      'default_value', c.column_default
    ) ORDER BY c.ordinal_position
  ), '[]'::jsonb)
  FROM information_schema.columns c
  WHERE c.table_schema = 'app' AND c.table_name = 'f_' || e.code
)
WHERE e.code IN ('order', 'inventory', 'shipment', 'invoice', 'expense', 'revenue', 'interaction', 'message');

-- Update for message_schema (table: d_message_schema)
UPDATE app.d_entity e
SET column_metadata = (
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'orderid', c.ordinal_position,
      'name', c.column_name,
      'descr', col_description((table_schema || '.' || table_name)::regclass::oid, c.ordinal_position),
      'datatype', 
        CASE 
          WHEN c.data_type = 'ARRAY' THEN c.udt_name || '[]'
          WHEN c.character_maximum_length IS NOT NULL THEN c.data_type || '(' || c.character_maximum_length || ')'
          WHEN c.numeric_precision IS NOT NULL AND c.numeric_scale IS NOT NULL THEN c.data_type || '(' || c.numeric_precision || ',' || c.numeric_scale || ')'
          ELSE c.data_type
        END,
      'is_nullable', c.is_nullable = 'YES',
      'default_value', c.column_default
    ) ORDER BY c.ordinal_position
  ), '[]'::jsonb)
  FROM information_schema.columns c
  WHERE c.table_schema = 'app' AND c.table_name = 'd_message_schema'
)
WHERE e.code = 'message_schema';

-- Update for quotes (table: f_quote)
UPDATE app.d_entity e
SET column_metadata = (
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'orderid', c.ordinal_position,
      'name', c.column_name,
      'descr', col_description((table_schema || '.' || table_name)::regclass::oid, c.ordinal_position),
      'datatype',
        CASE
          WHEN c.data_type = 'ARRAY' THEN c.udt_name || '[]'
          WHEN c.character_maximum_length IS NOT NULL THEN c.data_type || '(' || c.character_maximum_length || ')'
          WHEN c.numeric_precision IS NOT NULL AND c.numeric_scale IS NOT NULL THEN c.data_type || '(' || c.numeric_precision || ',' || c.numeric_scale || ')'
          ELSE c.data_type
        END,
      'is_nullable', c.is_nullable = 'YES',
      'default_value', c.column_default
    ) ORDER BY c.ordinal_position
  ), '[]'::jsonb)
  FROM information_schema.columns c
  WHERE c.table_schema = 'app' AND c.table_name = 'f_quote'
)
WHERE e.code = 'quote';

-- Update for work_order (table: f_work_order)
UPDATE app.d_entity e
SET column_metadata = (
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'orderid', c.ordinal_position,
      'name', c.column_name,
      'descr', col_description((table_schema || '.' || table_name)::regclass::oid, c.ordinal_position),
      'datatype',
        CASE
          WHEN c.data_type = 'ARRAY' THEN c.udt_name || '[]'
          WHEN c.character_maximum_length IS NOT NULL THEN c.data_type || '(' || c.character_maximum_length || ')'
          WHEN c.numeric_precision IS NOT NULL AND c.numeric_scale IS NOT NULL THEN c.data_type || '(' || c.numeric_precision || ',' || c.numeric_scale || ')'
          ELSE c.data_type
        END,
      'is_nullable', c.is_nullable = 'YES',
      'default_value', c.column_default
    ) ORDER BY c.ordinal_position
  ), '[]'::jsonb)
  FROM information_schema.columns c
  WHERE c.table_schema = 'app' AND c.table_name = 'f_work_order'
)
WHERE e.code = 'work_order';

-- Update for workflow_automation (table: d_workflow_automation)
UPDATE app.d_entity e
SET column_metadata = (
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'orderid', c.ordinal_position,
      'name', c.column_name,
      'descr', col_description((table_schema || '.' || table_name)::regclass::oid, c.ordinal_position),
      'datatype', 
        CASE 
          WHEN c.data_type = 'ARRAY' THEN c.udt_name || '[]'
          WHEN c.character_maximum_length IS NOT NULL THEN c.data_type || '(' || c.character_maximum_length || ')'
          WHEN c.numeric_precision IS NOT NULL AND c.numeric_scale IS NOT NULL THEN c.data_type || '(' || c.numeric_precision || ',' || c.numeric_scale || ')'
          ELSE c.data_type
        END,
      'is_nullable', c.is_nullable = 'YES',
      'default_value', c.column_default
    ) ORDER BY c.ordinal_position
  ), '[]'::jsonb)
  FROM information_schema.columns c
  WHERE c.table_schema = 'app' AND c.table_name = 'd_workflow_automation'
)
WHERE e.code = 'workflow_automation';

-- Update for person calendar (table: d_person_calendar)
UPDATE app.d_entity e
SET column_metadata = (
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'orderid', c.ordinal_position,
      'name', c.column_name,
      'descr', col_description((table_schema || '.' || table_name)::regclass::oid, c.ordinal_position),
      'datatype',
        CASE
          WHEN c.data_type = 'ARRAY' THEN c.udt_name || '[]'
          WHEN c.character_maximum_length IS NOT NULL THEN c.data_type || '(' || c.character_maximum_length || ')'
          WHEN c.numeric_precision IS NOT NULL AND c.numeric_scale IS NOT NULL THEN c.data_type || '(' || c.numeric_precision || ',' || c.numeric_scale || ')'
          ELSE c.data_type
        END,
      'is_nullable', c.is_nullable = 'YES',
      'default_value', c.column_default
    ) ORDER BY c.ordinal_position
  ), '[]'::jsonb)
  FROM information_schema.columns c
  WHERE c.table_schema = 'app' AND c.table_name = 'd_person_calendar'
)
WHERE e.code = 'calendar';

-- =====================================================
-- DATA CURATION: ENTITY-TO-TABLE MAPPING (db_table column)
-- =====================================================
-- Populate db_table column for all entities - SINGLE SOURCE OF TRUTH!
-- No more hardcoded mappings in backend code!

-- Core entities (d_ prefix - standard pattern)
UPDATE app.d_entity SET db_table = 'd_business' WHERE code = 'business';
UPDATE app.d_entity SET db_table = 'd_office' WHERE code = 'office';
UPDATE app.d_entity SET db_table = 'd_cust' WHERE code = 'cust';
UPDATE app.d_entity SET db_table = 'd_project' WHERE code = 'project';
UPDATE app.d_entity SET db_table = 'd_task' WHERE code = 'task';
UPDATE app.d_entity SET db_table = 'd_employee' WHERE code = 'employee';
UPDATE app.d_entity SET db_table = 'd_role' WHERE code = 'role';
UPDATE app.d_entity SET db_table = 'd_position' WHERE code = 'position';
UPDATE app.d_entity SET db_table = 'd_worksite' WHERE code = 'worksite';
UPDATE app.d_entity SET db_table = 'd_wiki' WHERE code = 'wiki';
UPDATE app.d_entity SET db_table = 'd_artifact' WHERE code = 'artifact';
UPDATE app.d_entity SET db_table = 'd_reports' WHERE code = 'reports';
UPDATE app.d_entity SET db_table = 'd_event' WHERE code = 'event';
UPDATE app.d_entity SET db_table = 'd_product' WHERE code = 'product';
UPDATE app.d_entity SET db_table = 'd_service' WHERE code = 'service';
UPDATE app.d_entity SET db_table = 'd_workflow_automation' WHERE code IN ('workflow', 'workflow_automation');

-- Special naming: form (table: d_form_head)
UPDATE app.d_entity SET db_table = 'd_form_head' WHERE code = 'form';

-- Special naming: calendar (table: d_person_calendar)
UPDATE app.d_entity SET db_table = 'd_person_calendar' WHERE code = 'calendar';

-- Special naming: message_schema (table: d_message_schema)
UPDATE app.d_entity SET db_table = 'd_message_schema' WHERE code = 'message_schema';

-- Hierarchies (d_ prefix)
UPDATE app.d_entity SET db_table = 'd_business_hierarchy' WHERE code = 'business_hierarchy';
UPDATE app.d_entity SET db_table = 'd_office_hierarchy' WHERE code = 'office_hierarchy';
UPDATE app.d_entity SET db_table = 'd_product_hierarchy' WHERE code = 'product_hierarchy';

-- Fact tables (f_ prefix)
UPDATE app.d_entity SET db_table = 'f_expense' WHERE code = 'expense';
UPDATE app.d_entity SET db_table = 'f_revenue' WHERE code = 'revenue';
UPDATE app.d_entity SET db_table = 'f_invoice' WHERE code = 'invoice';
UPDATE app.d_entity SET db_table = 'f_order' WHERE code = 'order';
UPDATE app.d_entity SET db_table = 'f_inventory' WHERE code = 'inventory';
UPDATE app.d_entity SET db_table = 'f_shipment' WHERE code = 'shipment';
UPDATE app.d_entity SET db_table = 'f_customer_interaction' WHERE code = 'interaction';
UPDATE app.d_entity SET db_table = 'f_message_data' WHERE code = 'message';

-- Fact tables (f_ prefix - standardized)
UPDATE app.d_entity SET db_table = 'f_quote' WHERE code = 'quote';
UPDATE app.d_entity SET db_table = 'f_work_order' WHERE code = 'work_order';

-- Meta-entities (infrastructure tables as entities)
UPDATE app.d_entity SET db_table = 'd_entity' WHERE code = 'entity';
UPDATE app.d_entity SET db_table = 'd_entity_instance' WHERE code = 'entity_instance';
UPDATE app.d_entity SET db_table = 'd_entity_instance_link' WHERE code = 'entity_instance_link';
UPDATE app.d_entity SET db_table = 'd_entity_rbac' WHERE code = 'entity_rbac';

-- New entities
UPDATE app.d_entity SET db_table = 'd_person' WHERE code = 'person';
UPDATE app.d_entity SET db_table = 'd_attachment' WHERE code = 'attachment';
UPDATE app.d_entity SET db_table = 'd_supplier' WHERE code = 'supplier';

