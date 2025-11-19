# PMO Platform Codebase Audit
**Generated**: 2025-11-19
**Purpose**: Document actual entities, routes, services, and endpoints

---

## 1. Infrastructure Tables
**Location**: `db/entity_configuration_settings/`

| Table Name | File | Purpose |
|------------|------|---------|
| `app.entity` | `02_entity.ddl` | Entity type metadata (icons, labels, child_entity_codes) |
| `app.d_domain` | `02_domain.ddl` | Domain metadata |
| `app.entity_instance` | `03_entity_instance.ddl` | Entity instance registry (entity_instance_name, code cache) |
| `app.entity_instance_link` | `05_entity_instance_link.ddl` | Parent-child relationships (hard delete only) |
| `app.entity_rbac` | `06_entity_rbac.ddl` | Person-based permissions (0-7 levels) |

---

## 2. Core Entity Tables
**Location**: `db/*.ddl`

### Business Entities
| Entity Code | Table Name | DB File | DB Model Type |
|-------------|------------|---------|---------------|
| `office` | `app.office` | `06_office.ddl` | Dimension (d) |
| `office-hierarchy` | `app.office_hierarchy` | `06_office.ddl` | Dimension Hierarchy (dh) |
| `business` | `app.business` | `07_business.ddl` | Dimension (d) |
| `business-hierarchy` | `app.business_hierarchy` | `07_business.ddl` | Dimension Hierarchy (dh) |
| `project` | `app.project` | `11_project.ddl` | Fact (f) |
| `task` | `app.task` | `12_task.ddl` | Fact (f) |
| `task-data` | `app.task_data` | `13_task_data.ddl` | Fact Data (fd) |
| `employee` | `app.employee` | `05_employee.ddl` | Dimension (d) |
| `role` | `app.role` | `09_role.ddl` | Dimension (d) |
| `cust` | `app.cust` | `08_customer.ddl` | Dimension (d) |
| `supplier` | `app.supplier` | `09a_supplier.ddl` | Dimension (d) |
| `worksite` | `app.worksite` | `10_worksite.ddl` | Dimension (d) |

### Operations Entities
| Entity Code | Table Name | DB File | DB Model Type |
|-------------|------------|---------|---------------|
| `work_order` | `app.work_order` | `14_work_order.ddl` | Fact (f) |
| `service` | `app.service` | `15_service.ddl` | Dimension (d) |
| `product` | `app.product` | `16_product.ddl` | Dimension (d) |
| `product-hierarchy` | `app.product_hierarchy` | `16_product.ddl` | Dimension Hierarchy (dh) |
| `inventory` | `app.inventory` | `17_inventory.ddl` | Fact (f) |
| `quote` | `app.quote` | `18_quote.ddl` | Fact (f) |
| `order` | `app.order` | `19_order.ddl` | Fact (f) |
| `shipment` | `app.shipment` | `20_shipment.ddl` | Fact (f) |

### Financial Entities
| Entity Code | Table Name | DB File | DB Model Type |
|-------------|------------|---------|---------------|
| `invoice` | `app.invoice_head` | `21a_invoice_head.ddl` | Fact Head (fh) |
| N/A | `app.invoice_data` | `21b_invoice_data.ddl` | Fact Data (fd) |
| `revenue` | `app.revenue` | `23_revenue.ddl` | Fact (f) |
| `expense` | `app.expense` | `24_expense.ddl` | Fact (f) |

### Communication Entities
| Entity Code | Table Name | DB File | DB Model Type |
|-------------|------------|---------|---------------|
| `message-schema` | `app.message_schema` | `25_message_schema.ddl` | Dimension (d) |
| `message-data` | `app.message_data` | `26_message_data.ddl` | Fact (f) |
| `interaction` | `app.interaction` | `27_interaction.ddl` | Fact (f) |

### Content Entities
| Entity Code | Table Name | DB File | DB Model Type |
|-------------|------------|---------|---------------|
| `artifact` | `app.artifact` | `28_artifact.ddl` | Fact (f) |
| `form` | `app.form_head` | `30_form_head.ddl` | Fact Head (fh) |
| N/A | `app.form_data` | `31_form_data.ddl` | Fact Data (fd) |
| `wiki` | `app.wiki_head` | `32_wiki_head.ddl` | Fact Head (fh) |
| N/A | `app.wiki_data` | `33_wiki_data.ddl` | Fact Data (fd) |

### Workflow Entities
| Entity Code | Table Name | DB File | DB Model Type |
|-------------|------------|---------|---------------|
| `workflow` | `app.industry_workflow_graph_head` | `37_industry_workflow_graph_head.ddl` | Fact Head (fh) |
| N/A | `app.industry_workflow_graph_data` | `38_industry_workflow_graph_data.ddl` | Fact Data (fd) |
| N/A | `app.industry_workflow_events` | `39_industry_workflow_events.ddl` | Fact (f) |

### AI/Orchestrator Entities
| Entity Code | Table Name | DB File | DB Model Type |
|-------------|------------|---------|---------------|
| N/A | `app.orchestrator_session` | `40_orchestrator_session.ddl` | Fact (f) |
| N/A | `app.orchestrator_state` | `41_orchestrator_state.ddl` | Fact (f) |
| N/A | `app.orchestrator_agent_log` | `42_orchestrator_agent_log.ddl` | Fact (f) |
| N/A | `app.orchestrator_summary` | `43_orchestrator_summary.ddl` | Fact (f) |
| N/A | `app.orchestrator_agents` | `44_orchestrator_agents.ddl` | Dimension (d) |

### Calendar/Event Entities
| Entity Code | Table Name | DB File | DB Model Type |
|-------------|------------|---------|---------------|
| `event` | `app.event` | `45_event.ddl` | Fact (f) |
| N/A | `app.event_organizer_link` | `46_event_organizer_link.ddl` | Link table |
| `person-calendar` | `app.person_calendar` | `47_person_calendar.ddl` | Dimension (d) |
| `event-person-calendar` | `app.entity_event_person_calendar` | `48_event_person_calendar.ddl` | Link table |

### Supporting Tables
| Table Name | DB File | Purpose |
|------------|---------|---------|
| `app.person` | `04a_person.ddl` | Base person table |
| `app.attachment` | `04b_attachment.ddl` | File attachments |
| `app.logging` | `04_logging.ddl` | Audit logging |
| `app.setting_datalabel` | `03_setting_datalabel.ddl` | Settings/dropdowns |

---

## 3. API Modules
**Location**: `apps/api/src/modules/`

**Total Modules**: 47

| Module Name | Routes File | Primary Entity |
|-------------|-------------|----------------|
| `artifact` | `artifact/routes.ts` | artifact |
| `auth` | `auth/routes.ts` | Authentication |
| `business` | `business/routes.ts` | business |
| `business-hierarchy` | `business-hierarchy/routes.ts` | business_hierarchy |
| `chat` | `chat/routes.ts` | AI Chat |
| `collab` | `collab/routes.ts` | Collaboration |
| `cust` | `cust/routes.ts` | cust (customer) |
| `email` | `email/routes.ts` | Email |
| `email-template` | `email-template/routes.ts` | Email Templates |
| `employee` | `employee/routes.ts` | employee |
| `entity` | `entity/routes.ts` | Entity metadata |
| `entity-options` | `entity-options/routes.ts` | Entity options/dropdowns |
| `event` | `event/routes.ts` | event |
| `event-person-calendar` | `event-person-calendar/routes.ts` | event_person_calendar |
| `expense` | `expense/routes.ts` | expense |
| `form` | `form/routes.ts` | form_head |
| `interaction` | `interaction/routes.ts` | interaction |
| `inventory` | `inventory/routes.ts` | inventory |
| `invoice` | `invoice/routes.ts` | invoice_head |
| `linkage` | `linkage/routes.ts` | entity_instance_link |
| `message-data` | `message-data/routes.ts` | message_data |
| `message-schema` | `message-schema/routes.ts` | message_schema |
| `meta` | `meta/routes.ts` | Metadata |
| `office` | `office/routes.ts` | office |
| `office-hierarchy` | `office-hierarchy/routes.ts` | office_hierarchy |
| `order` | `order/routes.ts` | order |
| `person-calendar` | `person-calendar/routes.ts` | person_calendar |
| `product` | `product/routes.ts` | product |
| `product-hierarchy` | `product-hierarchy/routes.ts` | product_hierarchy |
| `project` | `project/routes.ts` | project |
| `quote` | `quote/routes.ts` | quote |
| `rbac` | `rbac/routes.ts` | entity_rbac |
| `revenue` | `revenue/routes.ts` | revenue |
| `role` | `role/routes.ts` | role |
| `s3-backend` | `s3-backend/routes.ts` | S3 operations |
| `schema` | `schema/routes.ts` | Schema metadata |
| `service` | `service/routes.ts` | service |
| `setting` | `setting/routes.ts` | setting_datalabel |
| `shared` | `shared/routes.ts` | Shared utilities |
| `shipment` | `shipment/routes.ts` | shipment |
| `task` | `task/routes.ts` | task |
| `task-data` | `task-data/routes.ts` | task_data |
| `upload` | `upload/routes.ts` | File uploads |
| `wiki` | `wiki/routes.ts` | wiki_head |
| `work_order` | `work_order/routes.ts` | work_order |
| `workflow` | `workflow/routes.ts` | industry_workflow_graph_head |
| `worksite` | `worksite/routes.ts` | worksite |

---

## 4. Services & Libraries
**Location**: `apps/api/src/services/` and `apps/api/src/lib/`

### Core Service
| Service | File | Purpose |
|---------|------|---------|
| **Entity Infrastructure Service** | `services/entity-infrastructure.service.ts` | Single source of truth for all 4 infrastructure tables (entity, entity_instance, entity_instance_link, entity_rbac) |

### Library Services
| Library | File | Purpose |
|---------|------|---------|
| **Universal Schema Metadata** | `lib/universal-schema-metadata.ts` | Column metadata and filtering |
| **Universal Filter Builder** | `lib/universal-filter-builder.ts` | Zero-config query filtering with auto-type detection |
| **Schema Builder Service** | `lib/schema-builder.service.ts` | Dynamic schema generation |
| **Child Entity Route Factory** | `lib/child-entity-route-factory.ts` | Auto-generate child entity endpoints |
| **Entity Delete Route Factory** | `lib/entity-delete-route-factory.ts` | Auto-generate soft delete endpoints |
| **S3 Attachments** | `lib/s3-attachments.ts` | S3 file upload/download |
| **Data Transformers** | `lib/data-transformers.ts` | Data transformation utilities |
| **Authorization** | `lib/authz.ts` | Authorization helpers |
| **Entity Config** | `lib/entityConfig.ts` | Entity configuration |
| **Pagination** | `lib/pagination.ts` | Pagination utilities |
| **Redis** | `lib/redis.ts` | Redis caching |
| **Logger** | `lib/logger.ts` | Logging utilities |

### Frontend Services
**Location**: `apps/web/src/lib/`

| Service | File | Purpose |
|---------|------|---------|
| **View Config Generator** | `viewConfigGenerator.ts` | Generate view configurations |
| **Settings Loader** | `settingsLoader.ts` | Load settings from API |
| **Entity Config** | `entityConfig.ts` | Entity configuration for UI |
| **Entity Icons** | `entityIcons.ts` | Icon mapping |
| **Settings Config** | `settingsConfig.ts` | Settings configuration |
| **API Factory** | `api-factory.ts` | API client factory |
| **Upload Image** | `uploadImage.ts` | Image upload utilities |

---

## 5. Standard API Endpoints

### Entity CRUD Endpoints
**Pattern**: `/api/v1/{entity}`

```
GET    /api/v1/{entity}              # List with pagination + RBAC
GET    /api/v1/{entity}/:id          # Get single (instance VIEW check)
POST   /api/v1/{entity}              # Create (type-level CREATE check)
PATCH  /api/v1/{entity}/:id          # Update (instance EDIT check)
PUT    /api/v1/{entity}/:id          # Full update (instance EDIT check)
DELETE /api/v1/{entity}/:id          # Soft delete (factory-generated)
```

**Applies to**: project, task, employee, office, business, cust, role, supplier, worksite, work_order, service, product, inventory, quote, order, shipment, invoice, revenue, expense, artifact, form, wiki, interaction, event, person-calendar

### Child Entity Endpoints
**Pattern**: `/api/v1/{parent}/:id/{child}`
**Factory**: `createChildEntityEndpointsFromMetadata()`

```
GET /api/v1/project/:id/task         # Get all tasks for project (with RBAC)
GET /api/v1/office/:id/task          # Get all tasks for office (with RBAC)
GET /api/v1/business/:id/project     # Get all projects for business (with RBAC)
```

### Entity Metadata Endpoints
**Module**: `entity/routes.ts`

```
GET    /api/v1/entity/type/:entity_type?    # Get entity type metadata
GET    /api/v1/entity/domains                # Get all domains
GET    /api/v1/entity/child-counts/:entity_type/:entity_id  # Get child counts
GET    /api/v1/entity/:entityCode/schema     # Get entity schema
PUT    /api/v1/entity/:code/children         # Update child entity codes
PUT    /api/v1/entity/:code/configure        # Configure entity
POST   /api/v1/entity                        # Create entity type
PUT    /api/v1/entity/:code                  # Update entity type
DELETE /api/v1/entity/:code                  # Delete entity type
```

### Entity Options Endpoints
**Module**: `entity-options/routes.ts`

```
GET /api/v1/entity/:entity_type/options     # Get dropdown options for entity
```

### RBAC Endpoints
**Module**: `rbac/routes.ts`

```
GET    /api/v1/rbac/entity/:entity_type/:entity_id/permissions/:person_id  # Check permissions
POST   /api/v1/rbac/entity/:entity_type/:entity_id/permissions             # Grant permission
DELETE /api/v1/rbac/entity/:entity_type/:entity_id/permissions/:person_id  # Revoke permission
```

### Linkage Endpoints
**Module**: `linkage/routes.ts`

```
GET    /api/v1/linkage/:parent_type/:parent_id/:child_type  # Get child links
POST   /api/v1/linkage                                       # Create link
DELETE /api/v1/linkage/:parent_type/:parent_id/:child_type/:child_id  # Delete link
```

### Special Entity Endpoints

#### Project
```
GET /api/v1/project/:id/dynamic-child-entity-tabs   # Get dynamic child tabs
GET /api/v1/project/:id/creatable                   # Get creatable child entities
```

#### Task
```
PATCH /api/v1/task/:id/status                       # Update task status
GET   /api/v1/project/:projectId/tasks/kanban       # Get kanban board
GET   /api/v1/task/:taskId/case-notes               # Get case notes
POST  /api/v1/task/:taskId/case-notes               # Create case note
GET   /api/v1/task/:taskId/activity                 # Get activity log
GET   /api/v1/task/:id/assignees                    # Get assignees
```

#### Employee
```
GET /api/v1/employee/:id/roles                      # Get employee roles
```

---

## 6. Naming Conventions

### Database Tables
- **Dimension tables**: `app.{entity}` (e.g., `app.office`, `app.employee`)
- **Hierarchy tables**: `app.{entity}_hierarchy` (e.g., `app.office_hierarchy`)
- **Fact tables**: `app.{entity}` (e.g., `app.project`, `app.task`)
- **Fact head/data**: `app.{entity}_head`, `app.{entity}_data` (e.g., `app.invoice_head`, `app.invoice_data`)
- **Settings tables**: `app.setting_datalabel_{category}` (e.g., `app.setting_datalabel_project_stage`)
- **Infrastructure tables**: `app.entity`, `app.entity_instance`, `app.entity_instance_link`, `app.entity_rbac`

### Entity Codes
- Use hyphen-separated lowercase (e.g., `office-hierarchy`, `person-calendar`, `event-person-calendar`)
- Match API module names
- Defined in `app.entity` table

### API Modules
- Match entity codes with hyphens (e.g., `business-hierarchy/`, `office-hierarchy/`)
- Special modules: `auth`, `chat`, `meta`, `schema`, `setting`, `shared`, `upload`

### Route Constants
```typescript
const ENTITY_CODE = 'project';        // Entity type identifier
const TABLE_ALIAS = 'p';              // SQL table alias
const TABLE_NAME = 'app.project';     // Full table name
```

---

## 7. Key Architectural Patterns

### 1. Entity Infrastructure Service Pattern
**File**: `apps/api/src/services/entity-infrastructure.service.ts`

All entity routes use this service for:
- RBAC checks (`check_entity_rbac`)
- Entity instance registry (`set_entity_instance_registry`, `update_entity_instance_registry`)
- Parent-child linking (`set_entity_instance_link`)
- Permission management (`set_entity_rbac_owner`)
- RBAC filtering (`get_entity_rbac_where_condition`)

### 2. Factory Pattern
- `createChildEntityEndpointsFromMetadata()` - Auto-generates `/api/v1/{parent}/:id/{child}` endpoints
- `createEntityDeleteEndpoint()` - Auto-generates soft delete endpoints

### 3. Universal Auto-Filter System
**File**: `apps/api/src/lib/universal-filter-builder.ts`

Zero-config filtering based on column naming conventions:
- `dl__*` → Settings dropdown filter
- `*_id` (uuid) → UUID reference filter (auto-cast)
- `*_amt`, `*_price`, `*_cost` → Currency filter (numeric)
- `*_date` → Date filter
- `*_flag` → Boolean filter (auto-cast)
- `search` → Multi-field text search

### 4. Permission Hierarchy
```typescript
Permission.VIEW   = 0  // Read-only
Permission.EDIT   = 1  // Modify (implies View)
Permission.SHARE  = 2  // Share (implies Edit/View)
Permission.DELETE = 3  // Delete (implies Share/Edit/View)
Permission.CREATE = 4  // Create new (type-level only)
Permission.OWNER  = 5  // Full control (automatic on create)
```

---

## Summary Statistics

- **Database Tables**: 50+ tables across 46 DDL files
- **Infrastructure Tables**: 5 (entity, d_domain, entity_instance, entity_instance_link, entity_rbac)
- **Core Entities**: 30+ business entities
- **API Modules**: 47 modules
- **Services**: 1 core service + 12 library services
- **Standard Endpoints**: 5 per entity (GET, GET/:id, POST, PATCH, DELETE)
- **Factory-Generated Endpoints**: Child entity filtering + soft delete per entity
