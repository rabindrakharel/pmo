# Workflow Automation & Industry Workflow System

**Version:** 1.0.0
**Last Updated:** 2025-11-12
**Status:** ✅ Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Trigger-Action Automation](#trigger-action-automation)
4. [Industry Workflow Templates (DAG)](#industry-workflow-templates-dag)
5. [Workflow Instances](#workflow-instances)
6. [Workflow Event Tracking](#workflow-event-tracking)
7. [Database Schema](#database-schema)
8. [API Integration](#api-integration)
9. [Frontend Integration](#frontend-integration)
10. [Use Cases & Examples](#use-cases--examples)
11. [Best Practices](#best-practices)
12. [Troubleshooting](#troubleshooting)

---

## Overview

The **Workflow Automation System** provides two complementary automation capabilities for the PMO platform:

### 1. Trigger-Action Automation (`d_workflow_automation`)
**Purpose:** Event-driven automation with if-then-else logic
**Pattern:** When [TRIGGER] occurs on [ENTITY], then execute [ACTIONS] on [TARGET ENTITY]
**Use Cases:** Auto-assignments, notifications, field updates, entity creation

**Examples:**
- When project is created → Auto-assign default PM
- When task status = "completed" → Notify project manager
- When project status = "planning" → Create default planning tasks

### 2. Industry Workflow Templates (`d_industry_workflow_graph_head`)
**Purpose:** Industry-specific business process lifecycle definitions (DAG structure)
**Pattern:** Define complete business process flow as directed acyclic graph (DAG)
**Use Cases:** Home services workflows, construction workflows, HVAC/plumbing processes

**Examples:**
- Home Services: Lead → Quote → Work Order → Task → Invoice → Payment
- HVAC Emergency: Call → Dispatch → Diagnosis → Approval → Repair → Invoice → Payment
- Construction: Contract → Design → Permits → Foundation → Framing → MEP → Finishing → Occupancy

---

## System Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    WORKFLOW AUTOMATION SYSTEM                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────┐      ┌───────────────────────────┐   │
│  │ Trigger-Action       │      │ Industry Workflow         │   │
│  │ Automation           │      │ Templates (DAG)           │   │
│  │                      │      │                           │   │
│  │ d_workflow_          │      │ d_industry_workflow_      │   │
│  │ automation           │      │ graph_head                │   │
│  │                      │      │                           │   │
│  │ • Event triggers     │      │ • DAG graph structure     │   │
│  │ • Conditional logic  │      │ • Industry-specific       │   │
│  │ • Multi-action exec  │      │ • State transitions       │   │
│  └──────────────────────┘      └───────────────────────────┘   │
│           │                                │                     │
│           │                                │                     │
│           ▼                                ▼                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Workflow Instance & Event Tracking               │  │
│  │                                                            │  │
│  │  d_industry_workflow_graph_data (Instances)              │  │
│  │  f_industry_workflow_events (Event Log)                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Action (Create/Update Entity)
         ↓
Backend API Endpoint
         ↓
    ┌────────────────────────────────┐
    │ Check Workflow Automation      │
    │ (d_workflow_automation)        │
    └────────────────────────────────┘
         ↓
    Match trigger conditions?
         ↓
    Yes → Execute actions
         ↓
    ┌────────────────────────────────┐
    │ Execute Workflow Actions       │
    │ • Update fields                │
    │ • Send notifications           │
    │ • Create entities              │
    │ • Calculate values             │
    └────────────────────────────────┘
         ↓
    ┌────────────────────────────────┐
    │ Log Workflow Event             │
    │ (f_industry_workflow_events)   │
    └────────────────────────────────┘
```

---

## Trigger-Action Automation

### Table: `d_workflow_automation`

**Purpose:** Define event-driven automation rules with trigger-action patterns

### Schema

```sql
CREATE TABLE app.d_workflow_automation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Basic Info
    workflow_name TEXT NOT NULL,
    workflow_description TEXT,

    -- Trigger Configuration
    trigger_entity_type TEXT NOT NULL,      -- 'project', 'task', 'cust', etc.
    trigger_action_type TEXT NOT NULL,      -- 'create', 'update', 'delete', 'status_change', 'field_change'
    trigger_scope TEXT DEFAULT 'all',       -- 'all' or 'specific'
    trigger_entity_id UUID,                 -- Specific entity ID if scope = 'specific'
    trigger_conditions JSONB DEFAULT '{}',  -- Additional conditions

    -- Action Configuration
    action_entity_type TEXT NOT NULL,       -- Entity to act upon
    action_scope TEXT DEFAULT 'same',       -- 'same', 'related', 'specific'
    action_entity_id UUID,                  -- Specific entity ID if scope = 'specific'
    actions JSONB NOT NULL,                 -- Array of actions to execute

    -- Execution Settings
    execution_order INTEGER DEFAULT 0,
    max_executions INTEGER DEFAULT -1,      -- -1 = unlimited
    execution_count INTEGER DEFAULT 0,
    last_executed_ts TIMESTAMPTZ,

    -- Standard fields
    from_ts TIMESTAMPTZ DEFAULT now(),
    to_ts TIMESTAMPTZ,
    active_flag BOOLEAN DEFAULT true,
    created_ts TIMESTAMPTZ DEFAULT now(),
    updated_ts TIMESTAMPTZ DEFAULT now(),
    version INTEGER DEFAULT 1
);
```

### Trigger Types

| Trigger Type | Description | Use Case |
|-------------|-------------|----------|
| **`create`** | Entity created | Auto-assign, create default children |
| **`update`** | Any field updated | Track changes, audit logs |
| **`delete`** | Entity soft-deleted | Cascade notifications, cleanup |
| **`status_change`** | Status field changed | State-based actions |
| **`field_change`** | Specific field changed | Field-specific triggers |

### Action Types

Actions are defined in JSONB format:

```jsonb
[
  {
    "type": "update_field",
    "field": "assigned_to",
    "value": "employee-uuid"
  },
  {
    "type": "send_notification",
    "template": "project_created",
    "recipients": ["employee-uuid"]
  },
  {
    "type": "create_entity",
    "entity_type": "task",
    "fields": {
      "name": "Project Kickoff Meeting",
      "priority": "high"
    }
  },
  {
    "type": "calculate_field",
    "field": "completion_percentage",
    "formula": "completed_tasks / total_tasks * 100"
  }
]
```

### Examples

#### Example 1: Auto-assign PM on Project Create

```sql
INSERT INTO app.d_workflow_automation (
    workflow_name,
    workflow_description,
    trigger_entity_type,
    trigger_action_type,
    trigger_scope,
    action_entity_type,
    action_scope,
    actions
) VALUES (
    'Auto-assign PM on Project Create',
    'Automatically assigns the default project manager when a new project is created',
    'project',
    'create',
    'all',
    'project',
    'same',
    '[
      {"type": "update_field", "field": "assigned_to", "value": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13"},
      {"type": "send_notification", "template": "project_created", "recipients": ["8260b1b0-5efc-4611-ad33-ee76c0cf7f13"]}
    ]'::JSONB
);
```

#### Example 2: Create Default Tasks on Project Status Change

```sql
INSERT INTO app.d_workflow_automation (
    workflow_name,
    workflow_description,
    trigger_entity_type,
    trigger_action_type,
    trigger_scope,
    action_entity_type,
    action_scope,
    actions
) VALUES (
    'Create Planning Tasks',
    'When project status changes to Planning, create default planning tasks',
    'project',
    'status_change',
    'all',
    'task',
    'related',
    '[
      {"type": "create_entity", "entity_type": "task", "fields": {"name": "Project Kickoff Meeting", "priority": "high"}},
      {"type": "create_entity", "entity_type": "task", "fields": {"name": "Resource Allocation", "priority": "medium"}},
      {"type": "create_entity", "entity_type": "task", "fields": {"name": "Timeline Planning", "priority": "high"}}
    ]'::JSONB
);
```

#### Example 3: Update Project Progress on Task Completion

```sql
INSERT INTO app.d_workflow_automation (
    workflow_name,
    workflow_description,
    trigger_entity_type,
    trigger_action_type,
    trigger_scope,
    action_entity_type,
    action_scope,
    actions
) VALUES (
    'Update Project Progress',
    'Recalculate project completion percentage when task status changes',
    'task',
    'status_change',
    'all',
    'project',
    'related',
    '[
      {"type": "calculate_field", "field": "completion_percentage", "formula": "completed_tasks / total_tasks * 100"}
    ]'::JSONB
);
```

---

## Industry Workflow Templates (DAG)

### Table: `d_industry_workflow_graph_head`

**Purpose:** Define industry-specific business process lifecycle templates as directed acyclic graphs (DAGs)

### Schema

```sql
CREATE TABLE app.d_industry_workflow_graph_head (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    descr TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Industry classification
    industry_sector TEXT NOT NULL,
    industry_subsector TEXT,

    -- Workflow graph structure (DAG)
    workflow_graph JSONB NOT NULL,

    -- Workflow configuration
    workflow_version VARCHAR(20) DEFAULT '1.0',
    active_workflow_flag BOOLEAN DEFAULT true,
    default_workflow_flag BOOLEAN DEFAULT false,

    -- Performance metrics
    avg_duration_days INTEGER,
    success_rate_pct DECIMAL(5,2),

    -- Audit fields
    created_by_employee_id UUID,
    updated_by_employee_id UUID,

    -- Standard temporal fields
    active_flag BOOLEAN DEFAULT true,
    from_ts TIMESTAMPTZ DEFAULT now(),
    to_ts TIMESTAMPTZ,
    created_ts TIMESTAMPTZ DEFAULT now(),
    updated_ts TIMESTAMPTZ DEFAULT now(),
    version INTEGER DEFAULT 1
);
```

### Workflow Graph Structure (JSONB)

**DAG Node Format:**

```jsonb
[
  {
    "id": 0,                          // Unique state ID within workflow
    "name": "customer_onboard",       // Descriptive state name
    "descr": "Customer onboarding",   // Human-readable description
    "parent_ids": [],                 // Previous state IDs (empty for start state)
    "child_ids": [1, 2],              // Next possible state IDs
    "entity_name": "cust",            // Which entity gets created at this state
    "terminal_flag": false            // Is this an end state?
  },
  {
    "id": 1,
    "name": "quote_created",
    "descr": "Quote generated for customer",
    "parent_ids": [0],
    "child_ids": [2],
    "entity_name": "quote",
    "terminal_flag": false
  },
  {
    "id": 2,
    "name": "payment_received",
    "descr": "Payment collected, workflow complete",
    "parent_ids": [1],
    "child_ids": [],
    "entity_name": "invoice",
    "terminal_flag": true
  }
]
```

### Industry Workflow Examples

#### Home Services - Standard Project

**Code:** `HS_STD`
**Workflow:** Lead → Quote → Work Order → Task → Invoice → Payment
**Average Duration:** 14 days
**Success Rate:** 87.5%

```jsonb
[
  {"id": 0, "entity_name": "cust", "parent_ids": []},
  {"id": 1, "entity_name": "quote", "parent_ids": [0]},
  {"id": 2, "entity_name": "work_order", "parent_ids": [1]},
  {"id": 3, "entity_name": "task", "parent_ids": [2]},
  {"id": 4, "entity_name": "invoice", "parent_ids": [3]}
]
```

#### HVAC - Emergency Service

**Code:** `HVAC_EMERG`
**Workflow:** Emergency Call → Dispatch → Diagnosis → Approval → Repair → Invoice → Payment
**Average Duration:** 1 day (same-day service)
**Success Rate:** 92.3%

```jsonb
[
  {"id": 0, "name": "emergency_call", "entity_name": "cust", "parent_ids": [], "child_ids": [1]},
  {"id": 1, "name": "dispatch_immediate", "entity_name": "work_order", "parent_ids": [0], "child_ids": [2]},
  {"id": 2, "name": "on_site_diagnosis", "entity_name": "task", "parent_ids": [1], "child_ids": [3, 98]},
  {"id": 3, "name": "verbal_approval", "entity_name": "quote", "parent_ids": [2], "child_ids": [4]},
  {"id": 4, "name": "repair_in_progress", "entity_name": "task", "parent_ids": [3], "child_ids": [5]},
  {"id": 5, "name": "repair_completed", "entity_name": "work_order", "parent_ids": [4], "child_ids": [6]},
  {"id": 6, "name": "invoice_on_site", "entity_name": "invoice", "parent_ids": [5], "child_ids": [7]},
  {"id": 7, "name": "payment_collected", "entity_name": "invoice", "parent_ids": [6], "child_ids": [], "terminal_flag": true},
  {"id": 98, "name": "parts_required", "entity_name": "task", "parent_ids": [2], "child_ids": [], "terminal_flag": true}
]
```

#### Construction - New Home Build

**Code:** `CONST_HOME`
**Workflow:** Contract → Design → Permits → Foundation → Framing → MEP → Finishing → Inspection → Occupancy → Payment
**Average Duration:** 180 days
**Success Rate:** 78.2%

```jsonb
[
  {"id": 0, "name": "client_contract", "entity_name": "cust", "parent_ids": [], "child_ids": [1]},
  {"id": 1, "name": "design_phase", "entity_name": "project", "parent_ids": [0], "child_ids": [2]},
  {"id": 2, "name": "permit_application", "entity_name": "task", "parent_ids": [1], "child_ids": [3]},
  {"id": 3, "name": "permits_approved", "entity_name": "task", "parent_ids": [2], "child_ids": [4]},
  {"id": 4, "name": "foundation_work", "entity_name": "work_order", "parent_ids": [3], "child_ids": [5]},
  {"id": 5, "name": "framing_complete", "entity_name": "work_order", "parent_ids": [4], "child_ids": [6]},
  {"id": 6, "name": "mep_installation", "entity_name": "work_order", "parent_ids": [5], "child_ids": [7]},
  {"id": 7, "name": "interior_finishing", "entity_name": "work_order", "parent_ids": [6], "child_ids": [8]},
  {"id": 8, "name": "final_inspection", "entity_name": "task", "parent_ids": [7], "child_ids": [9, 98]},
  {"id": 9, "name": "occupancy_permit", "entity_name": "task", "parent_ids": [8], "child_ids": [10]},
  {"id": 10, "name": "handover_complete", "entity_name": "project", "parent_ids": [9], "child_ids": [11]},
  {"id": 11, "name": "final_payment", "entity_name": "invoice", "parent_ids": [10], "child_ids": [], "terminal_flag": true},
  {"id": 98, "name": "deficiency_repairs", "entity_name": "task", "parent_ids": [8], "child_ids": [8]}
]
```

#### Plumbing - Standard Service

**Code:** `PLUMB_STD`
**Workflow:** Service Call → Appointment → Assessment → Quote → Approval → Repair → Invoice → Payment
**Average Duration:** 3 days
**Success Rate:** 91.7%

```jsonb
[
  {"id": 0, "name": "service_call", "entity_name": "cust", "parent_ids": [], "child_ids": [1]},
  {"id": 1, "name": "appointment_scheduled", "entity_name": "work_order", "parent_ids": [0], "child_ids": [2]},
  {"id": 2, "name": "assessment_complete", "entity_name": "task", "parent_ids": [1], "child_ids": [3]},
  {"id": 3, "name": "quote_provided", "entity_name": "quote", "parent_ids": [2], "child_ids": [4, 98]},
  {"id": 4, "name": "quote_accepted", "entity_name": "quote", "parent_ids": [3], "child_ids": [5]},
  {"id": 5, "name": "repair_complete", "entity_name": "task", "parent_ids": [4], "child_ids": [6]},
  {"id": 6, "name": "invoice_sent", "entity_name": "invoice", "parent_ids": [5], "child_ids": [7]},
  {"id": 7, "name": "payment_complete", "entity_name": "invoice", "parent_ids": [6], "child_ids": [], "terminal_flag": true},
  {"id": 98, "name": "quote_declined", "entity_name": "quote", "parent_ids": [3], "child_ids": [], "terminal_flag": true}
]
```

---

## Workflow Instances

### Table: `d_industry_workflow_graph_data`

**Purpose:** Store workflow instances with actual entity IDs and current state

### Schema

```sql
CREATE TABLE app.d_industry_workflow_graph_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_instance_id TEXT UNIQUE NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    descr TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Workflow template reference
    workflow_head_id UUID NOT NULL,

    -- Entity graph data (JSONB array with actual entity IDs)
    workflow_graph_data JSONB NOT NULL,

    -- Current state tracking
    current_state_id INTEGER,
    terminal_state_flag BOOLEAN DEFAULT false,

    -- Audit fields
    created_by_employee_id UUID,
    updated_by_employee_id UUID,

    -- Standard temporal fields
    active_flag BOOLEAN DEFAULT true,
    from_ts TIMESTAMPTZ DEFAULT now(),
    to_ts TIMESTAMPTZ,
    created_ts TIMESTAMPTZ DEFAULT now(),
    updated_ts TIMESTAMPTZ DEFAULT now(),
    version INTEGER DEFAULT 1
);
```

### Workflow Instance Data Structure (JSONB)

**Format:** Array of entity nodes with actual entity IDs

```jsonb
[
  {
    "id": 0,
    "entity_name": "cust",
    "entity_id": "aaaaaaaa-0000-0000-0001-111111111111",
    "entity_label": "John Smith",
    "entity_stage": "qualified_lead",
    "parent_ids": [],
    "entity_created_ts": "2024-11-01T09:15:00Z",
    "entity_updated_ts": "2024-11-01T10:30:00Z",
    "current_flag": false,
    "terminal_flag": false
  },
  {
    "id": 1,
    "entity_name": "quote",
    "entity_id": "bbbbbbbb-0000-0000-0001-111111111111",
    "entity_label": "HVAC Repair Quote - $850",
    "entity_stage": "approved",
    "parent_ids": [0],
    "entity_created_ts": "2024-11-01T10:30:00Z",
    "entity_updated_ts": "2024-11-02T14:00:00Z",
    "current_flag": true,
    "terminal_flag": false
  }
]
```

---

## Workflow Event Tracking

### Table: `f_industry_workflow_events`

**Purpose:** Transaction-level fact table capturing all workflow state transitions and business events

### Schema

```sql
CREATE TABLE app.f_industry_workflow_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Event Identification
    event_number VARCHAR(50) NOT NULL UNIQUE,
    event_type VARCHAR(50) NOT NULL,
    event_subtype VARCHAR(50),

    -- Date/Time Dimensions
    event_date DATE NOT NULL,
    event_datetime TIMESTAMPTZ NOT NULL DEFAULT now(),
    event_year INTEGER,
    event_quarter INTEGER,
    event_month INTEGER,

    -- Workflow Dimensions
    workflow_instance_id TEXT NOT NULL,
    workflow_template_id UUID NOT NULL,
    workflow_template_code VARCHAR(50),
    industry_sector TEXT NOT NULL,

    -- State Dimensions
    from_state_id INTEGER,
    from_state_name TEXT,
    to_state_id INTEGER NOT NULL,
    to_state_name TEXT NOT NULL,
    terminal_state_flag BOOLEAN DEFAULT false,

    -- Entity Dimensions
    entity_name TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    entity_action TEXT NOT NULL,

    -- Customer Context
    customer_entity_id TEXT,
    customer_name TEXT,

    -- Employee Dimensions
    performed_by_employee_id UUID,
    assigned_to_employee_id UUID,

    -- Duration Metrics (minutes)
    state_duration_minutes INTEGER,
    cumulative_workflow_duration_minutes INTEGER,
    sla_target_minutes INTEGER,
    sla_variance_minutes INTEGER,

    -- Status Flags
    on_time_flag BOOLEAN DEFAULT true,
    sla_breach_flag BOOLEAN DEFAULT false,
    automated_flag BOOLEAN DEFAULT false,

    -- Financial Metrics (CAD)
    transaction_amt_cad DECIMAL(12,2),
    cumulative_workflow_amt_cad DECIMAL(12,2),

    -- Event Metadata
    event_source VARCHAR(50) DEFAULT 'manual',
    event_metadata JSONB DEFAULT '{}'::jsonb,

    -- Audit Fields
    created_ts TIMESTAMPTZ DEFAULT now(),
    active_flag BOOLEAN DEFAULT true
);
```

### Event Types

| Event Type | Description | Use Case |
|-----------|-------------|----------|
| **`workflow_started`** | Workflow initiated | Lead capture, new customer |
| **`state_transition`** | State changed | Quote approved, task completed |
| **`entity_created`** | New entity added | Work order created, invoice generated |
| **`milestone_reached`** | Key milestone | Work completed, inspection passed |
| **`workflow_completed`** | Terminal state reached | Payment received, project closed |

### Event Example

```sql
INSERT INTO app.f_industry_workflow_events (
    event_number,
    event_type,
    event_date,
    event_datetime,
    workflow_instance_id,
    workflow_template_id,
    workflow_template_code,
    industry_sector,
    from_state_id,
    from_state_name,
    to_state_id,
    to_state_name,
    entity_name,
    entity_id,
    entity_action,
    customer_entity_id,
    customer_name,
    performed_by_employee_id,
    state_duration_minutes,
    transaction_amt_cad,
    event_source,
    event_metadata
) VALUES (
    'WFE-2024-001-003',
    'state_transition',
    '2024-11-02',
    '2024-11-02 14:00:00',
    'WFI-2024-001',
    '550e8400-e29b-41d4-a716-446655440001',
    'HS_STD',
    'home_services',
    1,
    'quote_requested',
    2,
    'quote_approved',
    'quote',
    'bbbbbbbb-0000-0000-0001-111111111111',
    'approve',
    'aaaaaaaa-0000-0000-0001-111111111111',
    'John Smith Residential',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    75,
    850.00,
    'manual',
    '{"approval_method": "email_click", "discount_applied": 0}'::jsonb
);
```

---

## Database Schema

### Complete DDL Catalog

| DDL File | Table | Purpose |
|----------|-------|---------|
| **XXIII_d_workflow_automation.ddl** | `d_workflow_automation` | Trigger-action automation rules |
| **XXIV_d_industry_workflow_graph_head.ddl** | `d_industry_workflow_graph_head` | Industry workflow templates (DAG) |
| **XXV_d_industry_workflow_graph_data.ddl** | `d_industry_workflow_graph_data` | Workflow instances |
| **XXXII_f_industry_workflow_events.ddl** | `f_industry_workflow_events` | Workflow event log (fact table) |

### Relationships

```
d_industry_workflow_graph_head (Template)
         ↓ (workflow_head_id)
d_industry_workflow_graph_data (Instance)
         ↓ (workflow_instance_id)
f_industry_workflow_events (Events)
```

**No Foreign Keys:** All relationships via semantic linkage (polymorphic pattern)

---

## API Integration

### Workflow Automation Endpoints

```http
# List all automation rules
GET /api/v1/workflow-automation?active=true

# Get specific automation rule
GET /api/v1/workflow-automation/:id

# Create new automation rule
POST /api/v1/workflow-automation
Content-Type: application/json

{
  "workflow_name": "Auto-assign PM",
  "trigger_entity_type": "project",
  "trigger_action_type": "create",
  "action_entity_type": "project",
  "actions": [
    {"type": "update_field", "field": "assigned_to", "value": "employee-uuid"}
  ]
}

# Update automation rule
PUT /api/v1/workflow-automation/:id

# Disable automation rule
DELETE /api/v1/workflow-automation/:id
```

### Workflow Template Endpoints

```http
# List all workflow templates
GET /api/v1/workflow-template?industry_sector=home_services

# Get specific template
GET /api/v1/workflow-template/:id

# Get default template for industry
GET /api/v1/workflow-template/default/:industry_sector

# Create new workflow template
POST /api/v1/workflow-template
Content-Type: application/json

{
  "code": "CUSTOM_WF",
  "name": "Custom Workflow",
  "industry_sector": "home_services",
  "workflow_graph": [
    {"id": 0, "entity_name": "cust", "parent_ids": []},
    {"id": 1, "entity_name": "quote", "parent_ids": [0]}
  ]
}
```

### Workflow Instance Endpoints

```http
# List all workflow instances
GET /api/v1/workflow-instance

# Get specific instance
GET /api/v1/workflow-instance/:id

# Create new workflow instance
POST /api/v1/workflow-instance
Content-Type: application/json

{
  "workflow_head_id": "template-uuid",
  "workflow_instance_id": "WFI-2025-001",
  "workflow_graph_data": [
    {"id": 0, "entity_name": "cust", "entity_id": "customer-uuid"}
  ]
}

# Update instance (advance state)
PUT /api/v1/workflow-instance/:id
```

### Workflow Event Endpoints

```http
# List workflow events
GET /api/v1/workflow-events?workflow_instance_id=WFI-2024-001

# Create workflow event
POST /api/v1/workflow-events
Content-Type: application/json

{
  "workflow_instance_id": "WFI-2024-001",
  "event_type": "state_transition",
  "from_state_id": 1,
  "to_state_id": 2,
  "entity_name": "quote",
  "entity_id": "quote-uuid"
}
```

---

## Frontend Integration

### DAG Visualizer Component

**Component:** `DAGVisualizer`
**Location:** `/apps/web/src/components/shared/visualization/DAGVisualizer.tsx`

**Purpose:** Render workflow templates as interactive DAG diagrams

**Usage:**

```tsx
import { DAGVisualizer } from '@/components/shared/visualization/DAGVisualizer';

export function WorkflowTemplateView({ template }) {
  return (
    <DAGVisualizer
      nodes={template.workflow_graph}
      title={template.name}
      industry={template.industry_sector}
    />
  );
}
```

**Features:**
- Interactive node navigation
- State transition visualization
- Entity creation indicators
- Terminal state highlighting
- Branching paths (exception handling)

### Workflow Instance Tracker

```tsx
import { WorkflowTracker } from '@/components/workflow/WorkflowTracker';

export function WorkflowInstancePage({ instance }) {
  return (
    <WorkflowTracker
      instanceId={instance.id}
      currentStateId={instance.current_state_id}
      workflowGraph={instance.workflow_graph_data}
      events={workflowEvents}
    />
  );
}
```

**Features:**
- Real-time state tracking
- Event timeline
- Duration metrics
- Bottleneck identification

---

## Use Cases & Examples

### Use Case 1: Auto-create Default Tasks on Project Status Change

**Scenario:** When project status changes to "Planning", automatically create 3 default tasks

**Implementation:**

```sql
INSERT INTO app.d_workflow_automation (
    workflow_name,
    trigger_entity_type,
    trigger_action_type,
    trigger_conditions,
    action_entity_type,
    action_scope,
    actions
) VALUES (
    'Create Planning Tasks',
    'project',
    'status_change',
    '{"field": "status", "operator": "equals", "value": "planning"}'::JSONB,
    'task',
    'related',
    '[
      {"type": "create_entity", "entity_type": "task", "fields": {"name": "Project Kickoff Meeting", "priority": "high"}},
      {"type": "create_entity", "entity_type": "task", "fields": {"name": "Resource Allocation", "priority": "medium"}},
      {"type": "create_entity", "entity_type": "task", "fields": {"name": "Timeline Planning", "priority": "high"}}
    ]'::JSONB
);
```

**Backend Integration:**

```typescript
// apps/api/src/modules/project/service.ts
async updateProject(id: string, data: any) {
  const oldProject = await this.get(id);
  const updatedProject = await db.update('d_project', id, data);

  // Check workflow automation triggers
  if (oldProject.status !== updatedProject.status) {
    await workflowService.executeTriggers({
      entity_type: 'project',
      action_type: 'status_change',
      entity_id: id,
      old_value: oldProject.status,
      new_value: updatedProject.status
    });
  }

  return updatedProject;
}
```

---

### Use Case 2: HVAC Emergency Service Workflow

**Scenario:** Same-day emergency service with verbal approval

**Workflow Steps:**
1. Emergency Call → Create customer record
2. Immediate Dispatch → Create work order
3. On-site Diagnosis → Create diagnostic task
4. Verbal Approval → Create quote
5. Repair → Update task status
6. Invoice → Generate invoice
7. Payment → Complete workflow

**Template Definition:**

```sql
INSERT INTO app.d_industry_workflow_graph_head (
    code,
    name,
    industry_sector,
    workflow_graph,
    avg_duration_days
) VALUES (
    'HVAC_EMERG',
    'HVAC - Emergency Service',
    'hvac',
    '[
      {"id": 0, "name": "emergency_call", "entity_name": "cust", "parent_ids": [], "child_ids": [1]},
      {"id": 1, "name": "dispatch_immediate", "entity_name": "work_order", "parent_ids": [0], "child_ids": [2]},
      {"id": 2, "name": "on_site_diagnosis", "entity_name": "task", "parent_ids": [1], "child_ids": [3]},
      {"id": 3, "name": "verbal_approval", "entity_name": "quote", "parent_ids": [2], "child_ids": [4]},
      {"id": 4, "name": "repair_in_progress", "entity_name": "task", "parent_ids": [3], "child_ids": [5]},
      {"id": 5, "name": "invoice_on_site", "entity_name": "invoice", "parent_ids": [4], "child_ids": [6]},
      {"id": 6, "name": "payment_collected", "entity_name": "invoice", "parent_ids": [5], "child_ids": [], "terminal_flag": true}
    ]'::JSONB,
    1
);
```

---

### Use Case 3: Construction Workflow with Inspection Loop

**Scenario:** Final inspection can fail, requiring deficiency repairs before retrying

**DAG Structure:**

```
State 8 (final_inspection) ──┬──> State 9 (occupancy_permit) ──> State 10 (handover)
                               │
                               └──> State 98 (deficiency_repairs) ──┐
                                                                     │
                                        ┌────────────────────────────┘
                                        │
                                        └──> Back to State 8 (re-inspection)
```

**Implementation:**

```jsonb
[
  {
    "id": 8,
    "name": "final_inspection",
    "entity_name": "task",
    "parent_ids": [7],
    "child_ids": [9, 98],       // Can go to occupancy OR deficiency repairs
    "terminal_flag": false
  },
  {
    "id": 9,
    "name": "occupancy_permit",
    "entity_name": "task",
    "parent_ids": [8],
    "child_ids": [10],
    "terminal_flag": false
  },
  {
    "id": 98,
    "name": "deficiency_repairs",
    "entity_name": "task",
    "parent_ids": [8],
    "child_ids": [8],           // Loops back to re-inspection
    "terminal_flag": false
  }
]
```

---

## Best Practices

### 1. Workflow Automation

**✅ DO:**
- Use `execution_order` to control trigger sequence
- Set `max_executions` to prevent infinite loops
- Use specific `trigger_conditions` for precision
- Log all automation executions in `f_industry_workflow_events`
- Test automation rules on dev environment first

**❌ DON'T:**
- Create circular automation dependencies
- Use `active_flag=false` without archiving
- Hardcode entity IDs in actions (use dynamic lookups)
- Skip error handling in action execution

### 2. Workflow Templates (DAG)

**✅ DO:**
- Design workflows as DAGs (no cycles except intentional loops)
- Use `terminal_flag=true` for end states
- Document branching logic (e.g., approval/rejection paths)
- Track average durations and success rates
- Version workflows (`workflow_version`)

**❌ DON'T:**
- Create workflows with no terminal states
- Use entity types not in `d_entity` table
- Hardcode entity-specific logic in templates
- Create overly complex workflows (>20 states)

### 3. Workflow Instances

**✅ DO:**
- Update `current_state_id` on every state transition
- Store entity metadata in `entity_label` for display
- Track all state changes in `f_industry_workflow_events`
- Archive completed workflows (`terminal_state_flag=true`)

**❌ DON'T:**
- Modify `workflow_head_id` after instance creation
- Skip event logging for state transitions
- Delete workflow instances (use soft delete)

### 4. Event Tracking

**✅ DO:**
- Log every state transition
- Track duration metrics (`state_duration_minutes`)
- Record financial transactions (`transaction_amt_cad`)
- Include metadata for audit trails
- Use unique `event_number` for traceability

**❌ DON'T:**
- Skip event logging for automated actions
- Store PII in `event_metadata` without encryption
- Delete event records (immutable fact table)

---

## Troubleshooting

### Issue: Automation rule not triggering

**Symptoms:** Workflow automation not executing on expected events

**Causes:**
1. `active_flag=false` on automation rule
2. `trigger_conditions` not met
3. RBAC permissions missing
4. Execution count exceeded `max_executions`

**Solution:**

```sql
-- Check automation rule status
SELECT * FROM app.d_workflow_automation
WHERE workflow_name = 'Your Workflow Name';

-- Verify conditions match
SELECT trigger_conditions FROM app.d_workflow_automation WHERE id = 'rule-uuid';

-- Check execution count
SELECT execution_count, max_executions FROM app.d_workflow_automation
WHERE id = 'rule-uuid';

-- Reset execution count if needed
UPDATE app.d_workflow_automation
SET execution_count = 0, updated_ts = now()
WHERE id = 'rule-uuid';
```

---

### Issue: Workflow instance stuck in non-terminal state

**Symptoms:** Workflow not progressing to terminal state

**Causes:**
1. Missing entity for next state
2. Invalid `child_ids` reference
3. Circular dependency in DAG
4. No event logged for state transition

**Solution:**

```sql
-- Check current state
SELECT current_state_id, terminal_state_flag, workflow_graph_data
FROM app.d_industry_workflow_graph_data
WHERE workflow_instance_id = 'WFI-2024-001';

-- Find next valid states
SELECT workflow_graph->(current_state_id)
FROM app.d_industry_workflow_graph_head
WHERE id = (SELECT workflow_head_id FROM app.d_industry_workflow_graph_data WHERE id = 'instance-uuid');

-- Manually advance state if needed
UPDATE app.d_industry_workflow_graph_data
SET current_state_id = 5, updated_ts = now()
WHERE id = 'instance-uuid';
```

---

### Issue: Duplicate workflow events

**Symptoms:** Multiple event records for same transition

**Causes:**
1. Retry logic without idempotency check
2. Concurrent API calls
3. No unique constraint on `event_number`

**Solution:**

```sql
-- Check for duplicates
SELECT event_number, COUNT(*)
FROM app.f_industry_workflow_events
WHERE workflow_instance_id = 'WFI-2024-001'
GROUP BY event_number
HAVING COUNT(*) > 1;

-- Delete duplicate events (keep earliest)
DELETE FROM app.f_industry_workflow_events
WHERE id NOT IN (
  SELECT MIN(id) FROM app.f_industry_workflow_events
  GROUP BY event_number
);
```

---

### Issue: DAG visualizer not rendering

**Symptoms:** Workflow graph not displayed in UI

**Causes:**
1. Invalid JSONB structure in `workflow_graph`
2. Missing `parent_ids` or `child_ids` fields
3. Orphaned nodes (unreachable from start state)

**Solution:**

```sql
-- Validate JSONB structure
SELECT
  code,
  jsonb_typeof(workflow_graph) AS type,
  jsonb_array_length(workflow_graph) AS node_count
FROM app.d_industry_workflow_graph_head
WHERE code = 'HS_STD';

-- Check for required fields
SELECT
  code,
  elem->>'id' AS node_id,
  elem->>'entity_name' AS entity,
  elem->>'parent_ids' AS parents,
  elem->>'child_ids' AS children
FROM app.d_industry_workflow_graph_head,
LATERAL jsonb_array_elements(workflow_graph) AS elem
WHERE code = 'HS_STD';
```

---

## Summary

**Key Features:**

1. **Trigger-Action Automation** - Event-driven if-then-else automation
2. **Industry Workflow Templates** - DAG-based business process lifecycles
3. **Workflow Instances** - Track actual workflow execution with entity linkages
4. **Event Tracking** - Complete audit trail with duration/financial metrics
5. **DAG Visualization** - Interactive workflow diagrams
6. **Multi-industry Support** - Home services, HVAC, construction, plumbing

**Database Tables:**
- `d_workflow_automation` - Automation rules (XXIII)
- `d_industry_workflow_graph_head` - Workflow templates (XXIV)
- `d_industry_workflow_graph_data` - Workflow instances (XXV)
- `f_industry_workflow_events` - Event log (XXXII)

**Performance Metrics:**
- Average workflow duration tracking
- Success rate calculation
- SLA compliance monitoring
- Bottleneck identification

---

**Last Updated:** 2025-11-12
**Version:** 1.0.0
**Status:** ✅ Production Ready

