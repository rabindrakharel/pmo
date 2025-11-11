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
-- KEY FIELDS:
-- • code: varchar(50) PRIMARY KEY ('office', 'project', 'task')
-- • name: varchar(100) (Office, Project, Task)
-- • ui_label: varchar(100) (Offices, Projects, Tasks)
-- • ui_icon: varchar(50) (Lucide icon: FolderOpen, CheckSquare)
-- • child_entities: jsonb ([{"entity":"task", "ui_icon":"CheckSquare", "ui_label":"Tasks"}])
-- • display_order: int4 (sidebar/menu order)
--
-- PARENT-CHILD MAPPING:
-- • office → task, artifact, wiki, form, cost, revenue
-- • business → project, cost, revenue
-- • project → task, wiki, artifact, form, cost, revenue
-- • task → form, artifact, cost, revenue, employee (assignees)
-- • cust → project, artifact, form, cost, revenue
-- • role → employee
-- • form, quote, order → (have children per child_entities JSONB)
-- • Leaf nodes: employee, wiki, artifact, worksite, position, reports, service, product, etc.
--
-- =====================================================

CREATE TABLE app.d_entity (
    code varchar(50) NOT NULL PRIMARY KEY,
    name varchar(100) NOT NULL,
    ui_label varchar(100) NOT NULL,
    ui_icon varchar(50),
    child_entities jsonb DEFAULT '[]'::jsonb,
    display_order int4 NOT NULL DEFAULT 999,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

COMMENT ON TABLE app.d_entity IS 'Entity TYPE metadata with parent-child relationships and icons - single source of truth for entity type definitions';
COMMENT ON COLUMN app.d_entity.code IS 'Entity type identifier (office, business, project, task, etc.)';
COMMENT ON COLUMN app.d_entity.name IS 'Entity name (Office, Business, Project, Task, etc.)';
COMMENT ON COLUMN app.d_entity.ui_label IS 'UI display label for entity type plural (Offices, Businesses, Projects, Tasks, etc.)';
COMMENT ON COLUMN app.d_entity.ui_icon IS 'Lucide icon name for UI display (FolderOpen, CheckSquare, Users, etc.)';
COMMENT ON COLUMN app.d_entity.child_entities IS 'JSONB array of child entity metadata: [{"entity": "task", "ui_icon": "CheckSquare", "ui_label": "Tasks", "order": 1}]';

-- =====================================================
-- DATA CURATION
-- Populate entity TYPE metadata with parent-child relationships
-- =====================================================

-- Office entity type (has 6 child types)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'office',
  'Office',
  'Offices',
  'MapPin',
  '[
    {"entity": "task", "ui_icon": "CheckSquare", "ui_label": "Tasks", "order": 1},
    {"entity": "artifact", "ui_icon": "FileText", "ui_label": "Artifacts", "order": 2},
    {"entity": "wiki", "ui_icon": "BookOpen", "ui_label": "Wiki", "order": 3},
    {"entity": "form", "ui_icon": "FileText", "ui_label": "Forms", "order": 4},
    {"entity": "cost", "ui_icon": "DollarSign", "ui_label": "Costs", "order": 5},
    {"entity": "revenue", "ui_icon": "TrendingUp", "ui_label": "Revenue", "order": 6}
  ]'::jsonb,
  10
);

-- Business entity type (has 3 child types)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'business',
  'Business',
  'Businesses',
  'Building2',
  '[
    {"entity": "project", "ui_icon": "FolderOpen", "ui_label": "Projects", "order": 1},
    {"entity": "cost", "ui_icon": "DollarSign", "ui_label": "Costs", "order": 2},
    {"entity": "revenue", "ui_icon": "TrendingUp", "ui_label": "Revenue", "order": 3}
  ]'::jsonb,
  20
);

-- Project entity type (has 6 child types)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'project',
  'Project',
  'Projects',
  'FolderOpen',
  '[
    {"entity": "task", "ui_icon": "CheckSquare", "ui_label": "Tasks", "order": 1},
    {"entity": "wiki", "ui_icon": "BookOpen", "ui_label": "Wiki", "order": 2},
    {"entity": "artifact", "ui_icon": "FileText", "ui_label": "Artifacts", "order": 3},
    {"entity": "form", "ui_icon": "FileText", "ui_label": "Forms", "order": 4},
    {"entity": "cost", "ui_icon": "DollarSign", "ui_label": "Costs", "order": 5},
    {"entity": "revenue", "ui_icon": "TrendingUp", "ui_label": "Revenue", "order": 6}
  ]'::jsonb,
  30
);

-- Task entity type (has 4 child types)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'task',
  'Task',
  'Tasks',
  'CheckSquare',
  '[
    {"entity": "form", "ui_icon": "FileText", "ui_label": "Forms", "order": 1},
    {"entity": "artifact", "ui_icon": "FileText", "ui_label": "Artifacts", "order": 2},
    {"entity": "cost", "ui_icon": "DollarSign", "ui_label": "Costs", "order": 3},
    {"entity": "revenue", "ui_icon": "TrendingUp", "ui_label": "Revenue", "order": 4}
  ]'::jsonb,
  40
);

-- Customer entity type (has 5 child types)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'cust',
  'Customer',
  'Customers',
  'Users',
  '[
    {"entity": "project", "ui_icon": "FolderOpen", "ui_label": "Projects", "order": 1},
    {"entity": "artifact", "ui_icon": "FileText", "ui_label": "Artifacts", "order": 2},
    {"entity": "form", "ui_icon": "FileText", "ui_label": "Forms", "order": 3},
    {"entity": "cost", "ui_icon": "DollarSign", "ui_label": "Costs", "order": 4},
    {"entity": "revenue", "ui_icon": "TrendingUp", "ui_label": "Revenue", "order": 5}
  ]'::jsonb,
  50
);

-- Role entity type (has 1 child type)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'role',
  'Role',
  'Roles',
  'UserCheck',
  '[
    {"entity": "employee", "ui_icon": "Users", "ui_label": "Employees", "order": 1}
  ]'::jsonb,
  60
);

-- Form entity type (has 1 child type)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'form',
  'Form',
  'Forms',
  'FileText',
  '[
    {"entity": "artifact", "ui_icon": "FileText", "ui_label": "Artifacts", "order": 1}
  ]'::jsonb,
  70
);

-- Employee entity type (leaf node - no children)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'employee',
  'Employee',
  'Employees',
  'Users',
  '[]'::jsonb,
  80
);

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

-- Position entity type (leaf node - no children)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'position',
  'Position',
  'Positions',
  'Briefcase',
  '[]'::jsonb,
  120
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

-- Cost entity type (leaf node - no children)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'cost',
  'Cost',
  'Costs',
  'DollarSign',
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

-- Chat entity type (AI Assistant - leaf node - no children)
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'chat',
  'AI Chat',
  'AI Assistant',
  'MessageSquare',
  '[]'::jsonb,
  210
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
