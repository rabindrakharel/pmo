# Operations Domain

> **Purpose**: Internal operational execution structure for project and task management. Manages the full lifecycle of operations (projects), tasks, work orders, and execution tracking.

## Domain Overview

The Operations domain is the **execution engine** of the PMO platform. It manages all internal operational work through a hierarchical project/task structure with rich metadata, attachments, and work order linking. This domain transforms high-level business objectives into executable work units with clear ownership, deadlines, and progress tracking.

### Business Value

- **Project Portfolio Management** with multi-stage workflows
- **Task Breakdown** from epics to granular work items
- **Work Order Integration** for field service execution
- **Resource Allocation** across projects and tasks
- **Progress Tracking** with real-time status updates
- **Multi-Entity Linking** to customers, offices, businesses

## Entities

| Entity | DDL File | Table | Purpose |
|--------|----------|-------|---------|
| **Project** | XII_d_project.ddl | `d_project` | Project master with stages, budgets, and parent-child hierarchy |
| **Task** | XIII_d_task.ddl | `d_task` | Task head with assignments, deadlines, and workflow stages |
| **Task Data** | XIV_d_task_data.ddl | `d_task_data` | Temporal task data (versioned task details) |
| **Work Order** | XXXI_fact_work_order.ddl | `fact_work_order` | Field service work orders linked to tasks/projects |

## Entity Relationships

```
┌──────────────────────────────────────────────────────────────┐
│                  OPERATIONS DOMAIN                            │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─────────────────┐                                          │
│  │    Customer     │ (from Customer 360)                      │
│  │   (d_client)    │                                          │
│  └────────┬────────┘                                          │
│           │ has many                                          │
│           ▼                                                    │
│  ┌─────────────────┐         parent/child     ┌────────────┐ │
│  │    Project      │◄──────────────────────►│  Project   │ │
│  │  (d_project)    │      (sub-projects)     │  (parent)  │ │
│  │                 │                          └────────────┘ │
│  │ • name          │                                          │
│  │ • dl__stage     │◄─────────┐                              │
│  │ • budget_amt    │          │                              │
│  │ • start_date    │          │ has many                     │
│  │ • end_date      │          │                              │
│  └────────┬────────┘          │                              │
│           │                   │                              │
│           │ has many          │                              │
│           ▼                   │                              │
│  ┌─────────────────┐          │                              │
│  │      Task       │──────────┘                              │
│  │    (d_task)     │                                          │
│  │                 │◄──────┐                                 │
│  │ • name          │       │ has                             │
│  │ • dl__priority  │       │                                 │
│  │ • dl__stage     │       │                                 │
│  │ • assignee_id   │       │                                 │
│  │ • due_date      │       │                                 │
│  └────────┬────────┘       │                                 │
│           │                │                                 │
│           │ versioned by   │                                 │
│           ▼                │                                 │
│  ┌─────────────────┐       │                                 │
│  │   Task Data     │       │                                 │
│  │ (d_task_data)   │       │                                 │
│  │                 │       │                                 │
│  │ • task_id (FK)  │       │                                 │
│  │ • version       │       │                                 │
│  │ • description   │       │                                 │
│  │ • valid_from    │       │                                 │
│  │ • valid_to      │       │                                 │
│  └─────────────────┘       │                                 │
│                            │                                 │
│  ┌─────────────────┐       │                                 │
│  │  Work Order     │───────┘                                 │
│  │(fact_work_order)│                                          │
│  │                 │                                          │
│  │ • wo_number     │                                          │
│  │ • task_id       │                                          │
│  │ • technician_id │                                          │
│  │ • status        │                                          │
│  │ • scheduled_ts  │                                          │
│  └─────────────────┘                                          │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

### Relationship Rules

1. **Customer → Project**: One-to-many (via `d_entity_id_map`)
2. **Project → Task**: One-to-many
3. **Task → Task Data**: One-to-many (temporal versioning)
4. **Task → Work Order**: One-to-many
5. **Project → Project**: Parent-child (sub-projects)

## Business Semantics

### Project Lifecycle

```
Initiation → Planning → Execution → Monitoring → Closure
     ↓          ↓          ↓            ↓           ↓
  Concept   Budgeted   In Progress   At Risk    Completed
                                       ↓
                                   On Hold
```

Controlled via `dl__project_stage` settings field. Stage transitions trigger:
- Notifications to stakeholders
- Budget approval workflows
- Resource allocation
- Risk assessments

### Task Workflow (DAG-based)

```
Backlog → To Do → In Progress → Code Review → Testing → Done
                       ↓
                   Blocked (issue)
```

Managed via `dl__task_stage` with configurable DAG (Directed Acyclic Graph). Each stage has:
- Entry/exit conditions
- SLA timers
- Auto-assignments
- Webhook triggers

### Work Order Status Flow

```
Draft → Scheduled → Dispatched → In Progress → On Hold → Completed
                                                   ↓
                                              Cancelled
```

Work orders bridge operational tasks with field service execution.

## Data Patterns

### Project Hierarchy

Projects support **multi-level nesting** for complex engagements:

```
Enterprise Project (Level 1)
  ├─ Regional Rollout (Level 2)
  │   ├─ Ontario Implementation (Level 3)
  │   └─ Quebec Implementation (Level 3)
  └─ Product Development (Level 2)
      ├─ Backend API (Level 3)
      └─ Frontend UI (Level 3)
```

Implemented via `parent_project_id` self-referential foreign key.

### Temporal Task Data

Tasks use **head/data pattern** for version control:

- **d_task**: Immutable task header (ID, name, project link)
- **d_task_data**: Versioned task details (description, estimates, metadata)

```sql
-- Query current task state
SELECT t.task_id, t.name, td.description, td.estimate_hours
FROM d_task t
JOIN d_task_data td ON t.task_id = td.task_id
WHERE td.valid_to IS NULL; -- current version
```

### Polymorphic Task Linking

Tasks can be children of:
- Projects (standard)
- Customers (customer-facing tasks)
- Offices (internal office tasks)
- Events (event prep tasks)

All via `d_entity_id_map` with `parent_entity_type` polymorphism.

## Use Cases

### UC-1: Create Project from Customer Opportunity

**Actors**: Sales Rep, Project Manager, System

**Flow**:
1. Sales rep creates Customer record (Customer 360)
2. Customer status = "Qualified"
3. Create Project linked to Customer
4. Set `dl__project_stage` = "Initiation"
5. Assign Project Manager (employee)
6. Set budget, timeline, deliverables
7. Break down into Tasks (WBS)
8. Assign tasks to employees
9. Stage → "Execution"
10. Track progress via task completion %

**Entities**: Project, Task, Task Data, Customer

### UC-2: Field Service Work Order Execution

**Actors**: Dispatcher, Technician, System

**Flow**:
1. Task created for "Install HVAC Unit"
2. Dispatcher creates Work Order linked to Task
3. Assign Technician (employee)
4. Schedule time slot (via Service Delivery calendar)
5. Technician receives mobile notification
6. Technician marks WO "In Progress"
7. Technician completes work, uploads photos
8. WO marked "Completed"
9. Task auto-updated to "Done"
10. Customer invoiced (Financial Management)

**Entities**: Task, Work Order, Employee, Calendar

### UC-3: Multi-Phase Construction Project

**Actors**: PM, Superintendent, Subcontractors

**Flow**:
1. Create parent Project "Office Tower Construction"
2. Create child Projects:
   - Foundation (Phase 1)
   - Structural (Phase 2)
   - MEP (Phase 3)
   - Finishes (Phase 4)
3. Each phase has 50-200 tasks
4. Dependencies: Phase 2 starts after Phase 1 "Done"
5. Track costs per phase (Financial Management)
6. Roll up budget/actuals to parent project
7. Gantt chart view shows critical path

**Entities**: Project (5x), Task (500+), Work Order (100+)

## Technical Architecture

### Key Tables

```sql
-- Project (d_project)
CREATE TABLE app.d_project (
    project_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_project_id INT4, -- sub-projects
    dl__project_stage VARCHAR(50),
    budget_amt NUMERIC(15,2),
    start_date DATE,
    end_date DATE,
    customer_id INT4, -- soft link via d_entity_id_map
    owner_employee_id INT4,
    created_ts TIMESTAMPTZ DEFAULT now()
);

-- Task (d_task) - Head table
CREATE TABLE app.d_task (
    task_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    project_id INT4,
    dl__task_priority VARCHAR(50), -- High, Medium, Low
    dl__task_stage VARCHAR(50), -- Backlog, To Do, In Progress, Done
    assignee_employee_id INT4,
    due_date DATE,
    created_ts TIMESTAMPTZ DEFAULT now()
);

-- Task Data (d_task_data) - Temporal versioning
CREATE TABLE app.d_task_data (
    task_data_id SERIAL PRIMARY KEY,
    task_id INT4 NOT NULL,
    version INT4 DEFAULT 1,
    description TEXT,
    estimate_hours NUMERIC(8,2),
    actual_hours NUMERIC(8,2),
    valid_from TIMESTAMPTZ DEFAULT now(),
    valid_to TIMESTAMPTZ, -- NULL = current version
    changed_by_employee_id INT4
);

-- Work Order (fact_work_order)
CREATE TABLE app.fact_work_order (
    work_order_id SERIAL PRIMARY KEY,
    wo_number VARCHAR(50) UNIQUE NOT NULL,
    task_id INT4,
    dl__wo_status VARCHAR(50),
    technician_employee_id INT4,
    scheduled_start_ts TIMESTAMPTZ,
    scheduled_end_ts TIMESTAMPTZ,
    actual_start_ts TIMESTAMPTZ,
    actual_end_ts TIMESTAMPTZ,
    notes TEXT,
    created_ts TIMESTAMPTZ DEFAULT now()
);
```

### API Endpoints

```
# Projects
GET    /api/v1/project              # List projects
GET    /api/v1/project/:id          # Get project + child projects
POST   /api/v1/project              # Create project
PATCH  /api/v1/project/:id          # Update project
DELETE /api/v1/project/:id          # Soft delete

GET    /api/v1/project/:id/task     # Get tasks for project
GET    /api/v1/project/:id/expense  # Get expenses (Financial domain)

# Tasks
GET    /api/v1/task                 # List tasks
GET    /api/v1/task/:id             # Get task + current task_data
POST   /api/v1/task                 # Create task
PATCH  /api/v1/task/:id             # Update task (creates new task_data version)
DELETE /api/v1/task/:id             # Soft delete

GET    /api/v1/task/:id/history     # Get all task_data versions

# Work Orders
GET    /api/v1/work_order           # List work orders
GET    /api/v1/work_order/:id       # Get work order
POST   /api/v1/work_order           # Create work order
PATCH  /api/v1/work_order/:id       # Update work order status
```

### Workflow Integration

Projects and Tasks integrate with **Automation & Workflow** domain:

```sql
-- Trigger workflow on project stage change
INSERT INTO f_industry_workflow_events (
    entity_type,
    entity_instance_id,
    event_type,
    event_payload
) VALUES (
    'project',
    123,
    'stage_change',
    '{"old_stage": "Planning", "new_stage": "Execution"}'::jsonb
);
```

## Integration Points

### Upstream Dependencies

- **Customer 360**: Projects linked to Customers, Employees
- **Identity & Access Control**: RBAC for project/task permissions

### Downstream Dependencies

- **Service Delivery**: Work orders schedule field service
- **Financial Management**: Expenses/Revenue tracked per project
- **Knowledge & Documentation**: Artifacts, forms attached to projects/tasks
- **Event & Calendar**: Project milestones as events

## Data Volume & Performance

### Expected Data Volumes

- Projects: 5,000 - 50,000 active projects
- Tasks: 100,000 - 1,000,000 tasks
- Task Data versions: 300,000 - 3,000,000 versions
- Work Orders: 50,000 - 500,000 WOs

### Indexing Strategy

```sql
CREATE INDEX idx_project_stage ON app.d_project(dl__project_stage);
CREATE INDEX idx_project_parent ON app.d_project(parent_project_id);
CREATE INDEX idx_task_project ON app.d_task(project_id);
CREATE INDEX idx_task_assignee ON app.d_task(assignee_employee_id);
CREATE INDEX idx_task_stage ON app.d_task(dl__task_stage);
CREATE INDEX idx_task_data_task ON app.d_task_data(task_id, valid_to);
CREATE INDEX idx_wo_task ON app.fact_work_order(task_id);
```

## Future Enhancements

1. **Gantt Chart View**: Interactive timeline with dependencies
2. **Critical Path Analysis**: Auto-calculate project slack
3. **Resource Leveling**: Auto-balance workload across employees
4. **Budget Forecasting**: Predict overruns based on burn rate
5. **AI Task Estimation**: ML-based effort prediction
6. **Mobile Work Order App**: Offline-first field technician app

---

**Domain Owner**: Operations & PMO Teams
**Last Updated**: 2025-11-13
**Related Domains**: Customer 360, Financial Management, Service Delivery
