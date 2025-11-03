-- =====================================================
-- ENTITY TYPE METADATA TABLE (d_entity)
-- Stores entity TYPE definitions with parent-child relationships and icons
-- =====================================================
--
-- BUSINESS PURPOSE:
-- Maintains metadata for all entity TYPES in the system including parent-child relationships,
-- icons, labels, and hierarchical structures. This is the single source of truth for entity
-- type definitions and their relationships, used for dynamic UI generation (tabs, navigation).
--
-- RELATIONSHIP TO d_entity_instance_id:
-- • d_entity: Stores entity TYPE metadata (what types exist, their relationships, icons)
-- • d_entity_instance_id: Stores entity INSTANCE data (actual UUIDs, names of specific entities)
--
-- Example:
-- • d_entity has ONE row for "project" type with child_entities=[task, wiki, artifact, form]
-- • d_entity_instance_id has MANY rows for each project instance (Project A, Project B, etc.)
--
-- API SEMANTICS & LIFECYCLE:
--
-- 1. GET ENTITY TYPE METADATA
--    • Endpoint: GET /api/v1/entity/type/:code
--    • Database: SELECT * FROM d_entity WHERE code=$1
--    • Returns: Entity type with icon, label, child_entities array
--    • Frontend: Used for dynamic tab generation, navigation
--
-- 2. GET ALL ENTITY TYPES
--    • Endpoint: GET /api/v1/entity/types
--    • Database: SELECT * FROM d_entity ORDER BY display_order
--    • Returns: All entity types with metadata
--    • Frontend: Used for entity type pickers, navigation menus
--
-- 3. GET CHILD ENTITY TYPES FOR PARENT
--    • Endpoint: GET /api/v1/entity/type/:code/children
--    • Database: SELECT child_entities FROM d_entity WHERE code=$1
--    • Returns: Array of child entity metadata with icons and labels
--    • Frontend: DynamicChildEntityTabs component
--
-- PARENT-CHILD ENTITY TYPE MAPPING:
--   This table stores the canonical parent-child relationships for entity types.
--
--   PARENT ENTITY TYPE → CHILD ENTITY TYPES
--   =====================================================
--   office             → task, artifact, wiki, form
--   business           → project
--   project            → task, wiki, artifact, form
--   task               → form, artifact
--   cust               → project, artifact, form
--   role               → employee
--   form               → artifact
--   order              → invoice, shipment
--   quote              → work_order
--   employee           → (no children - leaf node)
--   wiki               → (no children - leaf node)
--   artifact           → (no children - leaf node)
--   worksite           → (no children - leaf node)
--   position           → (no children - leaf node)
--   reports            → (no children - leaf node)
--   service            → (no children - leaf node)
--   product            → (no children - leaf node)
--   inventory          → (no children - leaf node)
--   invoice            → (no children - leaf node)
--   shipment           → (no children - leaf node)
--   work_order         → (no children - leaf node)
--
-- KEY FIELDS:
-- • code: Entity type identifier ('office', 'business', 'project', 'task', etc.)
-- • name: Display name for the entity type (Office, Business, Project, Task, etc.)
-- • ui_label: UI display label for the entity type plural (Offices, Businesses, Projects, Tasks, etc.)
-- • ui_icon: Lucide icon name (e.g., 'FolderOpen', 'CheckSquare', 'Users')
-- • child_entities: JSONB array of child entity metadata
--   Format: [{"entity": "task", "ui_icon": "CheckSquare", "ui_label": "Tasks", "order": 1}, ...]
-- • display_order: Order for UI display (sidebar, menus, etc.)
-- • active_flag: Whether this entity type is currently active in the system
--
-- RELATIONSHIPS:
-- • This table defines the schema for d_entity_instance_id instances
-- • child_entities defines valid parent-child types in d_entity_id_map
-- • Used by frontend for dynamic component generation
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

-- Create indexes for common query patterns
CREATE INDEX idx_d_entity_active ON app.d_entity(active_flag) WHERE active_flag = true;
CREATE INDEX idx_d_entity_display_order ON app.d_entity(display_order);
CREATE INDEX idx_d_entity_child_entities_gin ON app.d_entity USING gin(child_entities);

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
