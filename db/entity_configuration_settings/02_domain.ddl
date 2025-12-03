-- =====================================================
-- DOMAIN TABLE (domain)
-- =====================================================
--
-- SEMANTICS:
-- • Master list of business domains that organize entities
-- • Each domain represents a cohesive business capability area
-- • Enables subscription-based feature flagging per domain
-- • Drives UI organization, sidebar grouping, and navigation
--
-- OPERATIONS:
-- • GET ALL: GET /api/v1/domain ORDER BY display_order
-- • GET BY CODE: GET /api/v1/domain/:code
-- • SUBSCRIPTION CHECK: SELECT * WHERE code=$1 AND subscription_flag=true
--
-- DOMAIN LIST (10 core domains):
-- 1. customer_360 - Unified people, organizations, business structures
-- 2. operations - Internal operational execution (projects/tasks/services/work orders)
-- 3. product_inventory - Products, stock, consumables, materials
-- 4. order_fulfillment - Sales pipelines, purchasing, delivery logistics
-- 5. financial_management - Cost control, profitability, billing metrics
-- 6. communication_interaction - Messaging, engagement, interaction logs
-- 7. knowledge_documentation - Wikis, forms, artifacts, reports
-- 8. identity_access_control - RBAC, entity definitions, polymorphism
-- 9. automation_workflow - DAG workflows, industry packs, orchestration
-- 10. event_calendar - Events, appointments, scheduling, person calendars
--
-- =====================================================

CREATE TABLE app.domain (
    domain_id SERIAL,
    code varchar(50),
    name varchar(100),
    description text,
    subscription_flag boolean DEFAULT true,
    display_order int4 DEFAULT 999,
    ui_icon varchar(50),
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

COMMENT ON TABLE app.domain IS 'Master domain table organizing entities into business capability areas with subscription control';
COMMENT ON COLUMN app.domain.domain_id IS 'Unique domain identifier';
COMMENT ON COLUMN app.domain.code IS 'Domain code (customer_360, operations, service_delivery, etc.)';
COMMENT ON COLUMN app.domain.name IS 'Display name (Customer 360, Operations, Service Delivery, etc.)';
COMMENT ON COLUMN app.domain.description IS 'Business semantics and purpose of the domain';
COMMENT ON COLUMN app.domain.subscription_flag IS 'Whether customer has subscribed/enabled this domain';
COMMENT ON COLUMN app.domain.display_order IS 'Sidebar/menu display order';
COMMENT ON COLUMN app.domain.ui_icon IS 'Lucide icon name for domain';

-- =====================================================
-- DATA CURATION: INSERT ALL DOMAINS
-- =====================================================

INSERT INTO app.domain (code, name, description, subscription_flag, display_order, ui_icon) VALUES
('customer_360', 'Customer 360', 'Unified view of people, organizations, and business structures. Manages customers, employees, roles, offices, businesses, and worksites.', true, 10, 'Users'),
('operations', 'Operations', 'Internal operational execution structure. Manages projects, tasks, task data, work orders, and service catalog for field service delivery.', true, 20, 'FolderOpen'),
('product_inventory', 'Product & Inventory', 'Product catalog, stock management, consumables, and materials. Tracks inventory levels and product hierarchies.', true, 30, 'Package'),
('order_fulfillment', 'Order & Fulfillment', 'Sales pipelines, purchasing, and delivery logistics. Manages quotes, orders, shipments, and invoices.', true, 40, 'ShoppingCart'),
('financial_management', 'Financial Management', 'Cost control, profitability tracking, and billing metrics. Handles costs, revenue, and expenses across all entities.', true, 50, 'DollarSign'),
('communication_interaction', 'Communication & Interaction', 'Messaging, engagement, and interaction logging. Manages message schemas, message data, and customer interactions.', true, 60, 'MessageCircle'),
('knowledge_documentation', 'Knowledge & Documentation', 'Wikis, forms, artifacts, and reports. Central repository for organizational knowledge and documentation.', true, 70, 'BookOpen'),
('identity_access_control', 'Identity & Access Control', 'RBAC, entity definitions, polymorphic relationships, and instance tracking. Core platform infrastructure for permissions and entity management.', true, 80, 'Shield'),
('automation_workflow', 'Automation & Workflow', 'DAG workflow graphs, industry workflow packs, automation engine, and orchestration runtime. Powers complex multi-step business processes.', true, 90, 'GitBranch'),
('event_calendar', 'Event & Calendar', 'Event management, appointments, scheduling, person calendars, and event organization. Handles event creation, organizer linking, person availability tracking, and booking confirmations.', true, 100, 'Calendar')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    subscription_flag = EXCLUDED.subscription_flag,
    display_order = EXCLUDED.display_order,
    ui_icon = EXCLUDED.ui_icon,
    updated_ts = now();
