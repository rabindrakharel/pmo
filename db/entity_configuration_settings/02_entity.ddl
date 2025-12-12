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
-- • GET TYPE: GET /api/v1/entity/codes/:code
-- • GET ALL: GET /api/v1/entity/codes ORDER BY display_order
-- • GET CHILDREN: SELECT child_entity_codes WHERE code=$1
-- • UPSERT: INSERT ... ON CONFLICT (code) DO UPDATE
--
-- PARENT-CHILD MAPPING:
-- • office → task, artifact, wiki, form, expense, revenue
-- • business → project, expense, revenue
-- • project → task, artifact, wiki, form, customer, event, revenue, expense
-- • task → customer, quote, order, event, shipment, revenue, expense
-- • customer → project, artifact, form, expense, revenue
-- • role → person (role membership per RBAC v2.0.0)
-- • form, quote, order → (have children per child_entity_codes JSONB)
-- • Leaf nodes: employee, wiki, artifact, worksite, reports, service, product, etc.
--
-- =====================================================

CREATE TABLE app.entity (
    code varchar(50) PRIMARY KEY,
    name varchar(100),
    ui_label varchar(100),
    ui_icon varchar(50),
    db_table varchar(100), -- Physical table name without prefix (db table name)
    db_model_type varchar(2), -- Data model type: 'd'=dimension, 'dh'=dimension hierarchy, 'f'=fact, 'fh'=fact head
    child_entity_codes jsonb DEFAULT '[]'::jsonb,
    display_order int4 DEFAULT 999,
    domain_id int4,
    domain_code varchar(50),
    domain_name varchar(100),
    column_metadata jsonb DEFAULT '[]'::jsonb,
    config_datatable jsonb DEFAULT '{"defaultSort": "updated_ts", "defaultSortOrder": "desc", "itemsPerPage": 25}'::jsonb,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

COMMENT ON TABLE app.entity IS 'Entity TYPE metadata with parent-child relationships and icons - single source of truth for entity type definitions';
COMMENT ON COLUMN app.entity.code IS 'Entity type identifier (office, business, project, task, etc.)';
COMMENT ON COLUMN app.entity.name IS 'Entity name (Office, Business, Project, Task, etc.)';
COMMENT ON COLUMN app.entity.ui_label IS 'UI display label for entity type plural (Offices, Businesses, Projects, Tasks, etc.)';
COMMENT ON COLUMN app.entity.ui_icon IS 'Lucide icon name for UI display (FolderOpen, CheckSquare, Users, etc.)';
COMMENT ON COLUMN app.entity.db_table IS 'Physical table name without prefix (person, inventory, order, office_hierarchy, etc.) - Single source of truth for entity-to-table mapping';
COMMENT ON COLUMN app.entity.db_model_type IS 'Data model classification: d=dimension, dh=dimension hierarchy, f=fact, fh=fact head, fd=fact data';
COMMENT ON COLUMN app.entity.child_entity_codes IS 'JSONB array of child entity metadata: [{"entity": "task", "ui_icon": "CheckSquare", "ui_label": "Tasks", "order": 1}]';
COMMENT ON COLUMN app.entity.domain_id IS 'Domain ID (denormalized from d_domain for performance)';
COMMENT ON COLUMN app.entity.domain_code IS 'Domain code (denormalized from d_domain for performance)';
COMMENT ON COLUMN app.entity.domain_name IS 'Domain name (denormalized from d_domain for performance)';
COMMENT ON COLUMN app.entity.config_datatable IS 'DataTable configuration: {defaultSort, defaultSortOrder, itemsPerPage} - DB-driven list view settings';

-- =====================================================
-- DATA CURATION
-- Populate entity TYPE metadata with parent-child relationships
-- =====================================================

-- Office entity type (has 6 child types)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'office',
  'Office',
  'Offices',
  'MapPin',
  'office',
  'd',
  '["task", "artifact", "wiki", "form", "expense", "revenue"]'::jsonb,
  10
);

-- Business entity type (has 3 child types)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'business',
  'Business',
  'Businesses',
  'Building2',
  'business',
  'd',
  '["project", "expense", "revenue"]'::jsonb,
  20
);

-- Project entity type (has 8 child types)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'project',
  'Project',
  'Projects',
  'FolderOpen',
  'project',
  'f',
  '["task", "artifact", "wiki", "form", "customer", "event", "revenue", "expense"]'::jsonb,
  30
);

-- Task entity type (has 7 child types)
-- NOTE: task_data is NOT a child entity - it's rendered via custom TaskDataContainer component (activity feed)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'task',
  'Task',
  'Tasks',
  'CheckSquare',
  'task',
  'f',
  '["customer", "quote", "order", "event", "shipment", "revenue", "expense"]'::jsonb,
  40
);

-- Customer entity type (has 5 child types)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'customer',
  'Customer',
  'Customers',
  'Users',
  'customer',
  'd',
  '["project", "artifact", "form", "expense", "revenue"]'::jsonb,
  50
);

-- Role entity type (has 1 child type - person for role membership per RBAC v2.0.0)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'role',
  'Role',
  'Roles',
  'UserCheck',
  'role',
  'd',
  '["person"]'::jsonb,
  60
);

-- Form entity type (has 2 child types) - Fact Head
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'form',
  'Form',
  'Forms',
  'FileText',
  'form',
  'fh',
  '["form_data", "artifact"]'::jsonb,
  70
);

-- Employee entity type (has 1 child type)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'employee',
  'Employee',
  'Employees',
  'Users',
  'employee',
  'd',
  '["rbac"]'::jsonb,
  80
);

-- RBAC entity type (permissions - child of role and employee)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'rbac',
  'Permission',
  'Permissions',
  'Shield',
  'entity_rbac',
  'f',
  '[]'::jsonb,
  85
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  db_table = EXCLUDED.db_table,
  db_model_type = EXCLUDED.db_model_type,
  child_entity_codes = EXCLUDED.child_entity_codes,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Wiki entity type (has 1 child type for content blocks)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'wiki',
  'Wiki',
  'Wiki Pages',
  'BookOpen',
  'wiki',
  'fh',
  '["wiki_data"]'::jsonb,
  90
);

-- Person entity type (base entity for all people)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'person',
  'Person',
  'People',
  'User',
  'person',
  'd',
  '[]'::jsonb,
  95
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  db_table = EXCLUDED.db_table,
  db_model_type = EXCLUDED.db_model_type,
  child_entity_codes = EXCLUDED.child_entity_codes,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Artifact entity type (leaf node - no children)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'artifact',
  'Artifact',
  'Artifacts',
  'FileText',
  'artifact',
  'f',
  '[]'::jsonb,
  100
);

-- Attachment entity type (file attachments - referenced by artifact, invoice)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'attachment',
  'Attachment',
  'Attachments',
  'Paperclip',
  'attachment',
  'd',
  '[]'::jsonb,
  101
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  db_table = EXCLUDED.db_table,
  db_model_type = EXCLUDED.db_model_type,
  child_entity_codes = EXCLUDED.child_entity_codes,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Worksite entity type (leaf node - no children)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'worksite',
  'Worksite',
  'Worksites',
  'MapPin',
  'worksite',
  'd',
  '[]'::jsonb,
  110
);

-- Chat entity type (AI chat sessions - leaf node - no children)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'chat',
  'Chat',
  'Chat',
  'MessageSquare',
  'interaction',
  'f',
  '[]'::jsonb,
  35
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  db_table = EXCLUDED.db_table,
  db_model_type = EXCLUDED.db_model_type,
  child_entity_codes = EXCLUDED.child_entity_codes,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Calendar entity type (person availability/booking - leaf node - no children)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'person-calendar',
  'Calendar',
  'Calendar',
  'Calendar',
  'person_calendar',
  'd',
  '[]'::jsonb,
  45
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  db_table = EXCLUDED.db_table,
  db_model_type = EXCLUDED.db_model_type,
  child_entity_codes = EXCLUDED.child_entity_codes,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Service entity type (leaf node - no children)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'service',
  'Service',
  'Services',
  'Wrench',
  'service',
  'd',
  '[]'::jsonb,
  135
);

-- Product entity type (leaf node - no children)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'product',
  'Product',
  'Products',
  'Package',
  'product',
  'd',
  '[]'::jsonb,
  140
);

-- Supplier entity type (vendors/suppliers for procurement)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'supplier',
  'Supplier',
  'Suppliers',
  'Building',
  'supplier',
  'd',
  '[]'::jsonb,
  141
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  db_table = EXCLUDED.db_table,
  db_model_type = EXCLUDED.db_model_type,
  child_entity_codes = EXCLUDED.child_entity_codes,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Quote entity type (has 1 child type: work_order)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'quote',
  'Quote',
  'Quotes',
  'FileText',
  'quote',
  'f',
  '["work_order"]'::jsonb,
  145
);

-- Work Order entity type (leaf node - no children)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'work_order',
  'Work Order',
  'Work Orders',
  'ClipboardCheck',
  'work_order',
  'f',
  '[]'::jsonb,
  155
);

-- Inventory entity type (leaf node - no children)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'inventory',
  'Inventory',
  'Inventory',
  'Warehouse',
  'inventory',
  'f',
  '[]'::jsonb,
  150
);

-- Order entity type (has 2 child types)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'order',
  'Order',
  'Orders',
  'ShoppingCart',
  'order',
  'f',
  '["invoice", "shipment"]'::jsonb,
  160
);

-- Invoice entity type (has 1 child type for line items)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'invoice',
  'Invoice',
  'Invoices',
  'Receipt',
  'invoice',
  'fh',
  '["invoice_data"]'::jsonb,
  170
);

-- Shipment entity type (leaf node - no children)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'shipment',
  'Shipment',
  'Shipments',
  'Truck',
  'shipment',
  'f',
  '[]'::jsonb,
  180
);

-- Expense entity type (leaf node - no children)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'expense',
  'Expense',
  'Expenses',
  'Receipt',
  'expense',
  'f',
  '[]'::jsonb,
  190
);

-- Revenue entity type (leaf node - no children)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'revenue',
  'Revenue',
  'Revenue',
  'TrendingUp',
  'revenue',
  'f',
  '[]'::jsonb,
  200
);

-- Workflow entity type (workflow templates - has workflow_data as child)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'workflow',
  'Workflow',
  'Workflows',
  'GitBranch',
  'workflow',
  'fh',
  '["workflow_data"]'::jsonb,
  205
);

-- Event entity type (Universal parent - can have many child entities)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'event',
  'Event',
  'Events',
  'Calendar',
  'event',
  'f',
  '["event-person-calendar", "task", "project", "service", "customer", "employee", "business"]'::jsonb,
  215
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  db_table = EXCLUDED.db_table,
  db_model_type = EXCLUDED.db_model_type,
  child_entity_codes = EXCLUDED.child_entity_codes,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Office Hierarchy entity type (Organizational structure hierarchy - separate from operational office)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'office_hierarchy',
  'Office Hierarchy',
  'Office Hierarchies',
  'Network',
  'office_hierarchy',
  'dh',
  '[]'::jsonb,
  220
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  db_table = EXCLUDED.db_table,
  db_model_type = EXCLUDED.db_model_type,
  child_entity_codes = EXCLUDED.child_entity_codes,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Business Hierarchy entity type (Organizational structure hierarchy - separate from operational business)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'business_hierarchy',
  'Business Hierarchy',
  'Business Hierarchies',
  'Network',
  'business_hierarchy',
  'dh',
  '[]'::jsonb,
  225
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  db_table = EXCLUDED.db_table,
  db_model_type = EXCLUDED.db_model_type,
  child_entity_codes = EXCLUDED.child_entity_codes,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Product Hierarchy entity type (Product categorization hierarchy - separate from SKU-level products)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'product_hierarchy',
  'Product Hierarchy',
  'Product Hierarchies',
  'Network',
  'product_hierarchy',
  'dh',
  '[]'::jsonb,
  230
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  db_table = EXCLUDED.db_table,
  db_model_type = EXCLUDED.db_model_type,
  child_entity_codes = EXCLUDED.child_entity_codes,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Message Schema entity type (Email/SMS/Push templates)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'message_schema',
  'Message Schema',
  'Message Schemas',
  'Mail',
  'message_schema',
  'd',
  '[]'::jsonb,
  240
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  db_table = EXCLUDED.db_table,
  db_model_type = EXCLUDED.db_model_type,
  child_entity_codes = EXCLUDED.child_entity_codes,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Message entity type (Sent/scheduled messages)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'message',
  'Message',
  'Messages',
  'Send',
  'message_data',
  'f',
  '[]'::jsonb,
  250
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  db_table = EXCLUDED.db_table,
  db_model_type = EXCLUDED.db_model_type,
  child_entity_codes = EXCLUDED.child_entity_codes,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Interaction entity type (Customer Interactions)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'interaction',
  'Interaction',
  'Interactions',
  'MessageCircle',
  'interaction',
  'f',
  '[]'::jsonb,
  270
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  db_table = EXCLUDED.db_table,
  db_model_type = EXCLUDED.db_model_type,
  child_entity_codes = EXCLUDED.child_entity_codes,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Workflow Automation entity type
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'workflow_automation',
  'Workflow Automation',
  'Workflow Automations',
  'Zap',
  'workflow_automation',
  'd',
  '[]'::jsonb,
  280
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  db_table = EXCLUDED.db_table,
  db_model_type = EXCLUDED.db_model_type,
  child_entity_codes = EXCLUDED.child_entity_codes,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- =====================================================
-- FACT DATA ENTITIES (Transactional Detail Records)
-- =====================================================
-- These entities store line-item or detail data for their parent fact head entities
-- Pattern: {parent}_data contains child records linked via {parent}_id or {parent}_number

-- Form Data entity type (form submissions - child of form)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'form_data',
  'Form Data',
  'Form Submissions',
  'FileInput',
  'form_data',
  'fd',
  '[]'::jsonb,
  71
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  db_table = EXCLUDED.db_table,
  db_model_type = EXCLUDED.db_model_type,
  child_entity_codes = EXCLUDED.child_entity_codes,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Task Data entity type (task checklist items - child of task)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'task_data',
  'Task Data',
  'Task Items',
  'ListChecks',
  'task_data',
  'fd',
  '[]'::jsonb,
  41
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  db_table = EXCLUDED.db_table,
  db_model_type = EXCLUDED.db_model_type,
  child_entity_codes = EXCLUDED.child_entity_codes,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Wiki Data entity type (wiki content blocks - child of wiki)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'wiki_data',
  'Wiki Data',
  'Wiki Blocks',
  'FileCode',
  'wiki_data',
  'fd',
  '[]'::jsonb,
  91
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  db_table = EXCLUDED.db_table,
  db_model_type = EXCLUDED.db_model_type,
  child_entity_codes = EXCLUDED.child_entity_codes,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Invoice Data entity type (invoice line items - child of invoice)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'invoice_data',
  'Invoice Data',
  'Invoice Line Items',
  'ListOrdered',
  'invoice_data',
  'fd',
  '[]'::jsonb,
  171
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  db_table = EXCLUDED.db_table,
  db_model_type = EXCLUDED.db_model_type,
  child_entity_codes = EXCLUDED.child_entity_codes,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- =====================================================
-- EVENT & CALENDAR ENTITIES
-- =====================================================

-- Booking entity type (event RSVP/booking records)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'event-person-calendar',
  'Booking',
  'Booking',
  'CalendarCheck',
  'entity_event_person_calendar',
  'f',
  '[]'::jsonb,
  216
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  db_table = EXCLUDED.db_table,
  db_model_type = EXCLUDED.db_model_type,
  child_entity_codes = EXCLUDED.child_entity_codes,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- =====================================================
-- WORKFLOW ENTITIES (Workflow Graph)
-- =====================================================

-- Workflow Data entity type (workflow instances - child of workflow)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'workflow_data',
  'Workflow Data',
  'Workflow Instances',
  'GitCommit',
  'workflow_data',
  'fd',
  '[]'::jsonb,
  206
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  db_table = EXCLUDED.db_table,
  db_model_type = EXCLUDED.db_model_type,
  child_entity_codes = EXCLUDED.child_entity_codes,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Workflow Events entity type (workflow event triggers)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order)
VALUES (
  'workflow_events',
  'Workflow Events',
  'Workflow Events',
  'Zap',
  'industry_workflow_events',
  'f',
  '[]'::jsonb,
  207
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  db_table = EXCLUDED.db_table,
  db_model_type = EXCLUDED.db_model_type,
  child_entity_codes = EXCLUDED.child_entity_codes,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- =====================================================
-- CONFIGURATION ENTITIES (Settings & Lookup Tables)
-- =====================================================

-- Domain entity type (domain definitions for entity grouping) - DEACTIVATED (meta-entity)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order, active_flag)
VALUES (
  'domain',
  'Domain',
  'Domains',
  'Layers',
  'd_domain',
  'd',
  '[]'::jsonb,
  895,
  false
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  db_table = EXCLUDED.db_table,
  db_model_type = EXCLUDED.db_model_type,
  child_entity_codes = EXCLUDED.child_entity_codes,
  display_order = EXCLUDED.display_order,
  active_flag = EXCLUDED.active_flag,
  updated_ts = now();

-- Datalabel entity type (settings/lookup labels) - DEACTIVATED (meta-entity)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order, active_flag)
VALUES (
  'datalabel',
  'Data Label',
  'Data Labels',
  'Tag',
  'datalabel',
  'd',
  '[]'::jsonb,
  896,
  false
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  db_table = EXCLUDED.db_table,
  db_model_type = EXCLUDED.db_model_type,
  child_entity_codes = EXCLUDED.child_entity_codes,
  display_order = EXCLUDED.display_order,
  active_flag = EXCLUDED.active_flag,
  updated_ts = now();

-- =====================================================
-- META-ENTITIES: Self-Describing Infrastructure
-- =====================================================
-- Infrastructure tables registered as entities themselves
-- Creates self-describing entity system where d_entity describes itself

-- Entity meta-entity (represents the concept of 'entity' itself) - DEACTIVATED (meta-entity)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order, active_flag)
VALUES (
  'entity',
  'Entity',
  'Entities',
  'Database',
  'entity',
  'd',
  '[]'::jsonb,
  900,
  false
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  db_table = EXCLUDED.db_table,
  db_model_type = EXCLUDED.db_model_type,
  child_entity_codes = EXCLUDED.child_entity_codes,
  display_order = EXCLUDED.display_order,
  active_flag = EXCLUDED.active_flag,
  updated_ts = now();

-- Entity Instance meta-entity (renamed from entity_instance_registry) - DEACTIVATED (meta-entity)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order, active_flag)
VALUES (
  'entity_instance',
  'Entity Instance',
  'Entity Instances',
  'List',
  'entity_instance',
  'f',
  '[]'::jsonb,
  910,
  false
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  db_table = EXCLUDED.db_table,
  db_model_type = EXCLUDED.db_model_type,
  child_entity_codes = EXCLUDED.child_entity_codes,
  display_order = EXCLUDED.display_order,
  active_flag = EXCLUDED.active_flag,
  updated_ts = now();

-- Entity Instance Link meta-entity - DEACTIVATED (meta-entity)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order, active_flag)
VALUES (
  'entity_instance_link',
  'Entity Instance Link',
  'Entity Instance Links',
  'Link',
  'entity_instance_link',
  'f',
  '[]'::jsonb,
  920,
  false
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  db_table = EXCLUDED.db_table,
  db_model_type = EXCLUDED.db_model_type,
  child_entity_codes = EXCLUDED.child_entity_codes,
  display_order = EXCLUDED.display_order,
  active_flag = EXCLUDED.active_flag,
  updated_ts = now();

-- Entity RBAC meta-entity - DEACTIVATED (meta-entity)
INSERT INTO app.entity (code, name, ui_label, ui_icon, db_table, db_model_type, child_entity_codes, display_order, active_flag)
VALUES (
  'entity_rbac',
  'Entity RBAC',
  'Entity RBAC',
  'ShieldCheck',
  'entity_rbac',
  'f',
  '[]'::jsonb,
  930,
  false
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  db_table = EXCLUDED.db_table,
  db_model_type = EXCLUDED.db_model_type,
  child_entity_codes = EXCLUDED.child_entity_codes,
  display_order = EXCLUDED.display_order,
  active_flag = EXCLUDED.active_flag,
  updated_ts = now();

-- =====================================================
-- DATA CURATION: NEW DOMAIN ARCHITECTURE MAPPING
-- =====================================================
-- Map entities to new domain structure with denormalized fields
-- Based on the 11-domain architecture

-- DOMAIN 1: CUSTOMER 360
-- Purpose: Unified people, organizations, and business structures
UPDATE app.entity e SET
    domain_id = d.domain_id,
    domain_code = d.code,
    domain_name = d.name,
    updated_ts = now()
FROM app.d_domain d
WHERE d.code = 'customer_360'
  AND e.code IN ('customer', 'business', 'employee', 'role', 'office', 'worksite');

-- DOMAIN 2: OPERATIONS
-- Purpose: Internal operational execution (projects, tasks, work orders, services)
UPDATE app.entity e SET
    domain_id = d.domain_id,
    domain_code = d.code,
    domain_name = d.name,
    updated_ts = now()
FROM app.d_domain d
WHERE d.code = 'operations'
  AND e.code IN ('project', 'task', 'task_data', 'work_order', 'service');

-- DOMAIN 3: PRODUCT & INVENTORY
-- Purpose: Products, stock, consumables, materials
UPDATE app.entity e SET
    domain_id = d.domain_id,
    domain_code = d.code,
    domain_name = d.name,
    updated_ts = now()
FROM app.d_domain d
WHERE d.code = 'product_inventory'
  AND e.code IN ('product', 'inventory', 'product_hierarchy');

-- DOMAIN 4: ORDER & FULFILLMENT
-- Purpose: Sales pipelines, purchasing, delivery logistics
UPDATE app.entity e SET
    domain_id = d.domain_id,
    domain_code = d.code,
    domain_name = d.name,
    updated_ts = now()
FROM app.d_domain d
WHERE d.code = 'order_fulfillment'
  AND e.code IN ('quote', 'order', 'shipment', 'invoice', 'invoice_data');

-- DOMAIN 5: FINANCIAL MANAGEMENT
-- Purpose: Cost control, profitability, billing metrics
UPDATE app.entity e SET
    domain_id = d.domain_id,
    domain_code = d.code,
    domain_name = d.name,
    updated_ts = now()
FROM app.d_domain d
WHERE d.code = 'financial_management'
  AND e.code IN ('expense', 'revenue');

-- DOMAIN 6: COMMUNICATION & INTERACTION
-- Purpose: Messaging, engagement, interaction logs, chat sessions
UPDATE app.entity e SET
    domain_id = d.domain_id,
    domain_code = d.code,
    domain_name = d.name,
    updated_ts = now()
FROM app.d_domain d
WHERE d.code = 'communication_interaction'
  AND e.code IN ('message_schema', 'message', 'interaction', 'chat');

-- DOMAIN 7: KNOWLEDGE & DOCUMENTATION
-- Purpose: Wikis, forms, artifacts
UPDATE app.entity e SET
    domain_id = d.domain_id,
    domain_code = d.code,
    domain_name = d.name,
    updated_ts = now()
FROM app.d_domain d
WHERE d.code = 'knowledge_documentation'
  AND e.code IN ('wiki', 'wiki_data', 'artifact', 'form', 'form_data');

-- DOMAIN 8: IDENTITY & ACCESS CONTROL
-- Purpose: RBAC, entity definitions, polymorphism, IDs
UPDATE app.entity e SET
    domain_id = d.domain_id,
    domain_code = d.code,
    domain_name = d.name,
    updated_ts = now()
FROM app.d_domain d
WHERE d.code = 'identity_access_control'
  AND e.code IN ('rbac', 'domain', 'datalabel', 'entity', 'entity_instance', 'entity_instance_link', 'entity_rbac');

-- DOMAIN 9: AUTOMATION & WORKFLOW
-- Purpose: DAG workflows, industry workflow packs, automation engine
UPDATE app.entity e SET
    domain_id = d.domain_id,
    domain_code = d.code,
    domain_name = d.name,
    updated_ts = now()
FROM app.d_domain d
WHERE d.code = 'automation_workflow'
  AND e.code IN ('workflow', 'workflow_automation', 'workflow_data', 'workflow_events');

-- DOMAIN 10: EVENT & CALENDAR
-- Purpose: Events, appointments, scheduling, person calendars, RSVP tracking
UPDATE app.entity e SET
    domain_id = d.domain_id,
    domain_code = d.code,
    domain_name = d.name,
    updated_ts = now()
FROM app.d_domain d
WHERE d.code = 'event_calendar'
  AND e.code IN ('event', 'person-calendar', 'event-person-calendar');

-- Handle hierarchies (assign to Customer 360 as organizational structures)
UPDATE app.entity e SET
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
UPDATE app.entity e
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
    AND c.table_name = e.db_table
)
WHERE e.db_table IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM information_schema.tables t
    WHERE t.table_schema = 'app'
      AND t.table_name = e.db_table
  );

-- NOTE: Special handling no longer needed - all entities use db_table column directly

-- =====================================================
-- NOTE: db_table and db_model_type are now set directly
-- in the INSERT statements above. No separate UPDATE needed.
-- =====================================================

