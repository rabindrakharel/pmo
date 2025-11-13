# Automation & Workflow Domain

> **Purpose**: DAG-based workflow orchestration, industry pack templates, trigger-action automation, and multi-agent AI orchestration. Powers complex business processes with state machines and intelligent agents.

## Domain Overview

The Automation & Workflow Domain provides sophisticated workflow orchestration capabilities including industry-specific business process templates (DAG graphs), trigger-action automation rules, workflow event tracking, and multi-agent AI orchestration for complex decision-making and task execution. It enables codified industry best practices and intelligent process automation.

### Business Value

- **Industry Pack Workflows** with pre-configured business process templates
- **DAG State Machines** for visual workflow tracking and stage progression
- **Trigger-Action Automation** for event-driven business rules
- **Multi-Agent AI Orchestration** with specialized agents for complex workflows
- **Workflow Analytics** with success rates, duration tracking, and bottleneck identification
- **Process Standardization** across teams and projects
- **Intelligent Automation** with AI-driven decision support

## Entities

| Entity | DDL File | Table | Purpose |
|--------|----------|-------|---------|
| **Workflow Automation** | XXIII_d_workflow_automation.ddl | `d_workflow_automation` | Trigger-action automation rules with conditional logic and multi-action execution |
| **Industry Workflow Graph Head** | XXIV_d_industry_workflow_graph_head.ddl | `d_industry_workflow_graph_head` | Workflow template DAG definitions for industry-specific business processes |
| **Industry Workflow Graph Data** | XXV_d_industry_workflow_graph_data.ddl | `d_industry_workflow_graph_data` | Workflow instance data tracking actual execution state and entity creation |
| **Workflow Events** | XXXII_f_industry_workflow_events.ddl | `f_industry_workflow_events` | Event log for workflow state transitions and milestone tracking |
| **Orchestrator Session** | XXXVII_orchestrator_session.ddl | `orchestrator_session` | AI orchestration session tracking for multi-agent workflows |
| **Orchestrator State** | XXXVIII_orchestrator_state.ddl | `orchestrator_state` | State management for orchestrator sessions |
| **Orchestrator Agent Log** | XXXIX_orchestrator_agent_log.ddl | `orchestrator_agent_log` | Detailed agent execution logs and decision trails |
| **Orchestrator Summary** | XL_orchestrator_summary.ddl | `orchestrator_summary` | Summary reports of orchestrator sessions |
| **Orchestrator Agents** | XLI_orchestrator_agents.ddl | `orchestrator_agents` | Agent definitions with capabilities and prompts |

## Entity Relationships

```
┌────────────────────────────────────────────────────────────────────────┐
│              AUTOMATION & WORKFLOW DOMAIN                             │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌───────────────────────────┐                                        │
│  │  Workflow Automation      │ (Trigger-Action Rules)                 │
│  │  (d_workflow_automation)  │                                         │
│  │                           │                                         │
│  │ Pattern:                  │                                         │
│  │ WHEN [trigger_entity]     │                                         │
│  │   [trigger_action]        │                                         │
│  │   [conditions]            │                                         │
│  │ THEN [actions]            │                                         │
│  │   ON [action_entity]      │                                         │
│  │                           │                                         │
│  │ Examples:                 │                                         │
│  │ • When Project created    │                                         │
│  │   → Assign PM, Send notif │                                         │
│  │ • When Task completed     │                                         │
│  │   → Update parent status  │                                         │
│  │ • When Quote accepted     │                                         │
│  │   → Create Order          │                                         │
│  └───────────────────────────┘                                         │
│                                                                        │
│  ┌───────────────────────────┐                                        │
│  │ Industry Workflow Graph   │ (DAG Template)                          │
│  │ Head                      │                                         │
│  │ (d_industry_workflow      │                                         │
│  │  _graph_head)             │                                         │
│  │                           │                                         │
│  │ • Industry Sector         │                                         │
│  │ • Workflow Graph JSONB    │                                         │
│  │ • State Nodes:            │                                         │
│  │   [                       │                                         │
│  │     {id: 0, name: "lead", │                                         │
│  │      entity: "cust",      │                                         │
│  │      child_ids: [1,2]},   │                                         │
│  │     {id: 1, name: "quote",│                                         │
│  │      entity: "quote",     │                                         │
│  │      parent_ids: [0],     │                                         │
│  │      child_ids: [2,3]},   │                                         │
│  │     ...                   │                                         │
│  │   ]                       │                                         │
│  │                           │                                         │
│  │ Powers:                   │                                         │
│  │ • DAG visualization       │                                         │
│  │ • Stage progression       │                                         │
│  │ • Entity creation flow    │                                         │
│  └───────────────────────────┘                                         │
│           │                                                            │
│           │ instantiated as                                            │
│           ▼                                                            │
│  ┌───────────────────────────┐                                        │
│  │ Industry Workflow Graph   │ (DAG Instance)                          │
│  │ Data                      │                                         │
│  │ (d_industry_workflow      │                                         │
│  │  _graph_data)             │                                         │
│  │                           │                                         │
│  │ • workflow_head_id        │                                         │
│  │ • current_state_id        │                                         │
│  │ • state_history JSONB     │                                         │
│  │ • created_entities JSONB  │                                         │
│  │                           │                                         │
│  │ Tracks:                   │                                         │
│  │ • Active state in DAG     │                                         │
│  │ • State transition history│                                         │
│  │ • Entities created per    │                                         │
│  │   state                   │                                         │
│  └───────────────────────────┘                                         │
│           │                                                            │
│           │ generates                                                  │
│           ▼                                                            │
│  ┌───────────────────────────┐                                        │
│  │ Workflow Events           │ (Event Log)                             │
│  │ (f_industry_workflow      │                                         │
│  │  _events)                 │                                         │
│  │                           │                                         │
│  │ • event_type              │                                         │
│  │ • from_state → to_state   │                                         │
│  │ • trigger_entity_id       │                                         │
│  │ • created_entity_id       │                                         │
│  │ • event_ts                │                                         │
│  │                           │                                         │
│  │ Enables:                  │                                         │
│  │ • Audit trail             │                                         │
│  │ • Analytics               │                                         │
│  │ • Bottleneck detection    │                                         │
│  └───────────────────────────┘                                         │
│                                                                        │
│  ┌───────────────────────────┐                                        │
│  │ Orchestrator Session      │ (Multi-Agent AI)                        │
│  │ (orchestrator_session)    │                                         │
│  │                           │                                         │
│  │ • session_id              │                                         │
│  │ • goal                    │                                         │
│  │ • orchestrator_prompt     │                                         │
│  │ • active_agents JSONB     │                                         │
│  │ • session_status          │                                         │
│  │                           │                                         │
│  │ Coordinates:              │                                         │
│  │ • Agent selection         │                                         │
│  │ • Task delegation         │                                         │
│  │ • Result aggregation      │                                         │
│  └───────────────────────────┘                                         │
│           │                                                            │
│           │ uses                                                       │
│           ▼                                                            │
│  ┌───────────────────────────┐                                        │
│  │ Orchestrator Agents       │ (Agent Definitions)                     │
│  │ (orchestrator_agents)     │                                         │
│  │                           │                                         │
│  │ • agent_name              │                                         │
│  │ • agent_type              │                                         │
│  │ • capabilities JSONB      │                                         │
│  │ • system_prompt           │                                         │
│  │                           │                                         │
│  │ Specialized Agents:       │                                         │
│  │ • Planner Agent           │                                         │
│  │ • Executor Agent          │                                         │
│  │ • Analyzer Agent          │                                         │
│  │ • Validator Agent         │                                         │
│  │ • Reporter Agent          │                                         │
│  └───────────────────────────┘                                         │
│           │                                                            │
│           │ logs to                                                    │
│           ▼                                                            │
│  ┌───────────────────────────┐                                        │
│  │ Orchestrator Agent Log    │ (Execution Trail)                       │
│  │ (orchestrator_agent_log)  │                                         │
│  │                           │                                         │
│  │ • session_id              │                                         │
│  │ • agent_name              │                                         │
│  │ • action_type             │                                         │
│  │ • input_data JSONB        │                                         │
│  │ • output_data JSONB       │                                         │
│  │ • execution_ts            │                                         │
│  │                           │                                         │
│  │ Captures:                 │                                         │
│  │ • Agent decisions         │                                         │
│  │ • LLM calls               │                                         │
│  │ • Tool invocations        │                                         │
│  │ • Error handling          │                                         │
│  └───────────────────────────┘                                         │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Relationship Rules

1. **Workflow Graph Head → Workflow Graph Data**: One-to-many
   - Template defines DAG structure once
   - Many project/customer instances use same template
   - Instance tracks current state and history

2. **Workflow Graph Data → Workflow Events**: One-to-many
   - Each workflow instance generates many events
   - Events log state transitions over time
   - Event timeline for analytics

3. **Orchestrator Session → Orchestrator Agents**: Many-to-many
   - Session uses multiple agents
   - Same agent can participate in multiple sessions
   - Agent selection based on capabilities

4. **Orchestrator Session → Orchestrator Agent Log**: One-to-many
   - Session generates many agent log entries
   - Complete execution trail
   - Debugging and audit

5. **Workflow Automation**: Standalone
   - No direct relationships to other tables
   - Triggered by entity events via application logic
   - Actions modify entities directly

## Business Semantics

### Workflow Automation Patterns

**Trigger Types** (`trigger_action_type`):
- **create**: When entity is created
- **update**: When entity is modified
- **delete**: When entity is soft deleted
- **status_change**: When status field changes
- **field_change**: When specific field changes
- **scheduled**: Time-based trigger (cron)

**Trigger Scope** (`trigger_scope`):
- **all**: Any entity of this type triggers workflow
- **specific**: Only specific entity instance triggers

**Action Types** (in `actions` JSONB):
```json
[
  {"type": "update_field", "field": "status", "value": "in_progress"},
  {"type": "send_notification", "template": "task_assigned", "recipients": ["empid-123"]},
  {"type": "create_entity", "entity_type": "task", "fields": {"name": "Follow up", "priority": "high"}},
  {"type": "send_email", "template": "welcome_email", "to": "{{customer.email}}"},
  {"type": "call_webhook", "url": "https://api.external.com/notify", "method": "POST"},
  {"type": "run_script", "script_id": "custom-script-123"}
]
```

**Example Automation Rules**:

1. **Auto-assign PM on Project Create**:
   ```
   WHEN project IS created
   THEN update_field(assigned_to = "default-pm-uuid")
   AND send_notification(template = "project_created", recipients = ["pm-uuid"])
   ```

2. **Create Planning Tasks on Status Change**:
   ```
   WHEN project.status CHANGES TO "Planning"
   THEN create_entity(task, name = "Kickoff Meeting")
   AND create_entity(task, name = "Resource Allocation")
   AND create_entity(task, name = "Timeline Planning")
   ```

3. **Notify PM on Task Completion**:
   ```
   WHEN task.status CHANGES TO "Completed"
   AND task.assigned_to = "any"
   THEN send_notification(template = "task_completed", recipients = ["project_manager"])
   ```

4. **Convert Quote to Order on Acceptance**:
   ```
   WHEN quote.status CHANGES TO "Accepted"
   THEN create_entity(order, from_quote_id = quote.id)
   AND update_field(quote.converted_to_order = true)
   AND send_email(template = "order_confirmation", to = "{{customer.email}}")
   ```

### Industry Workflow DAGs

**Workflow Graph Structure** (JSONB):
```json
{
  "workflow_version": "1.0",
  "states": [
    {
      "id": 0,
      "name": "lead_generation",
      "descr": "Lead captured from marketing",
      "parent_ids": [],
      "child_ids": [1, 2],
      "entity_name": "cust",
      "entity_status": "Lead",
      "terminal_flag": false,
      "avg_duration_days": 2
    },
    {
      "id": 1,
      "name": "customer_onboarding",
      "descr": "Customer qualification and onboarding",
      "parent_ids": [0],
      "child_ids": [2, 3],
      "entity_name": "cust",
      "entity_status": "Qualified",
      "terminal_flag": false,
      "avg_duration_days": 3
    },
    {
      "id": 2,
      "name": "quote_generation",
      "descr": "Generate price quote for customer",
      "parent_ids": [0, 1],
      "child_ids": [3, 4],
      "entity_name": "quote",
      "entity_status": "Draft",
      "terminal_flag": false,
      "avg_duration_days": 1
    },
    {
      "id": 3,
      "name": "quote_sent",
      "descr": "Quote sent to customer",
      "parent_ids": [2],
      "child_ids": [4, 5],
      "entity_name": "quote",
      "entity_status": "Sent",
      "terminal_flag": false,
      "avg_duration_days": 5
    },
    {
      "id": 4,
      "name": "quote_accepted",
      "descr": "Customer accepted quote",
      "parent_ids": [3],
      "child_ids": [6],
      "entity_name": "order",
      "entity_status": "Confirmed",
      "terminal_flag": false,
      "avg_duration_days": 1
    },
    {
      "id": 5,
      "name": "quote_rejected",
      "descr": "Customer rejected quote",
      "parent_ids": [3],
      "child_ids": [],
      "entity_name": "quote",
      "entity_status": "Rejected",
      "terminal_flag": true,
      "success": false
    },
    {
      "id": 6,
      "name": "work_scheduled",
      "descr": "Work scheduled with customer",
      "parent_ids": [4],
      "child_ids": [7],
      "entity_name": "task",
      "entity_status": "Scheduled",
      "terminal_flag": false,
      "avg_duration_days": 7
    },
    {
      "id": 7,
      "name": "work_completed",
      "descr": "Service work completed",
      "parent_ids": [6],
      "child_ids": [8],
      "entity_name": "task",
      "entity_status": "Completed",
      "terminal_flag": false,
      "avg_duration_days": 1
    },
    {
      "id": 8,
      "name": "invoice_sent",
      "descr": "Invoice sent to customer",
      "parent_ids": [7],
      "child_ids": [9],
      "entity_name": "invoice",
      "entity_status": "Sent",
      "terminal_flag": false,
      "avg_duration_days": 1
    },
    {
      "id": 9,
      "name": "payment_received",
      "descr": "Customer payment received",
      "parent_ids": [8],
      "child_ids": [],
      "entity_name": "invoice",
      "entity_status": "Paid",
      "terminal_flag": true,
      "success": true
    }
  ]
}
```

**Industry Pack Templates**:

- **Home Services - Standard**: Lead → Quote → Order → Work → Invoice → Payment
- **HVAC - Emergency**: Call → Dispatch → Arrive → Diagnose → Repair → Invoice → Payment
- **Construction - Residential**: Lead → Site Visit → Quote → Contract → Permits → Build → Inspection → Close
- **Plumbing - Maintenance**: Contract → Schedule → Service → Invoice → Payment
- **Electrical - Commercial**: RFP → Quote → Approval → Design → Installation → Testing → Invoice → Payment

### Multi-Agent Orchestration

**Orchestrator Session Flow**:
```
1. User submits goal: "Create comprehensive project plan for HVAC installation"
2. Orchestrator analyzes goal, selects agents:
   - Planner Agent: Breaks down project into phases
   - Estimator Agent: Calculates costs and timelines
   - Resource Agent: Identifies required materials and labor
   - Risk Agent: Assesses potential risks
   - Reporter Agent: Compiles final report
3. Orchestrator delegates tasks to agents in sequence/parallel
4. Agents execute, log results
5. Orchestrator aggregates results
6. Final output delivered to user
```

**Agent Types**:

| Agent | Capabilities | Example Use |
|-------|--------------|-------------|
| **Planner** | Task breakdown, sequencing, dependency mapping | Create project timeline with dependencies |
| **Estimator** | Cost estimation, pricing, budgeting | Estimate total project cost with line items |
| **Resource** | Material procurement, labor allocation | Identify required products and technicians |
| **Risk** | Risk assessment, mitigation planning | Identify potential delays and mitigation strategies |
| **Analyzer** | Data analysis, pattern recognition | Analyze historical data for insights |
| **Validator** | Quality checks, compliance verification | Validate project plan against regulations |
| **Reporter** | Report generation, summarization | Create executive summary of project plan |

**Agent Communication Pattern**:
```
Orchestrator: "Planner, break down HVAC installation project"
Planner Agent: [Returns 5 phases with 23 tasks]

Orchestrator: "Estimator, calculate cost for these tasks"
Estimator Agent: [Returns cost breakdown: $12,500]

Orchestrator: "Resource, identify materials needed"
Resource Agent: [Returns list: 1× Carrier AC, 1× Thermostat, 50ft copper tubing...]

Orchestrator: "Risk, assess potential issues"
Risk Agent: [Returns risks: Supply chain delays (High), Weather delays (Medium)...]

Orchestrator: "Reporter, compile final plan"
Reporter Agent: [Returns formatted PDF with all sections]
```

## Data Patterns

### Workflow Automation Execution

When trigger event occurs:

```
1. Event detected (e.g., project created)
2. Query workflow_automation for matching rules:
   WHERE trigger_entity_type = 'project'
     AND trigger_action_type = 'create'
     AND (trigger_scope = 'all' OR trigger_entity_id = $project_id)
     AND active_flag = true
   ORDER BY execution_order
3. For each matching rule:
   a. Evaluate trigger_conditions (if any)
   b. If conditions pass, execute actions array sequentially
   c. Log execution (increment execution_count, update last_executed_ts)
   d. If max_executions reached, deactivate rule
```

### Workflow State Transition

When workflow instance progresses:

```
1. User action triggers state transition (e.g., quote accepted)
2. Load workflow_graph_data instance
3. Validate transition: current_state → next_state in DAG
4. Create entities defined for next state:
   - If state.entity_name = 'order', create order
   - Link order to parent customer via d_entity_id_map
5. Update workflow_graph_data:
   - current_state_id = next_state.id
   - Append to state_history: {from: 2, to: 4, ts: now()}
   - Append to created_entities: {state: 4, entity: 'order', id: 'uuid-...'}
6. Create workflow_event log entry:
   - event_type = 'state_transition'
   - from_state_id = 2
   - to_state_id = 4
   - created_entity_id = 'order-uuid'
```

### Orchestrator Session Lifecycle

```
1. CREATE SESSION
   INSERT INTO orchestrator_session (goal, orchestrator_prompt, session_status)
   VALUES ('Create project plan', '...', 'initializing');

2. SELECT AGENTS
   Orchestrator analyzes goal, queries orchestrator_agents for matching capabilities
   UPDATE orchestrator_session SET active_agents = '["planner", "estimator", "resource"]';

3. EXECUTE AGENTS
   For each agent:
     a. INSERT INTO orchestrator_agent_log (session_id, agent_name, action_type, input_data)
     b. Agent executes task (LLM call, tool invocation)
     c. UPDATE orchestrator_agent_log SET output_data = '...', execution_status = 'completed'

4. AGGREGATE RESULTS
   Orchestrator collects all agent outputs, synthesizes final result

5. COMPLETE SESSION
   UPDATE orchestrator_session SET session_status = 'completed', final_output = '...';
   INSERT INTO orchestrator_summary (session_id, summary_text, success_flag);
```

## Use Cases

### UC-1: Execute Workflow Automation on Project Creation

**Actors**: Sales Rep, System

**Flow**:
1. Sales Rep creates new Project: "HVAC Installation - Store #45"
2. System saves project to database
3. System triggers workflow automation check:
   ```sql
   SELECT * FROM d_workflow_automation
   WHERE trigger_entity_type = 'project'
     AND trigger_action_type = 'create'
     AND active_flag = true
   ORDER BY execution_order;
   ```
4. System finds rule: "Auto-assign PM on Project Create"
5. Rule actions:
   ```json
   [
     {"type": "update_field", "field": "assigned_to", "value": "james-miller-uuid"},
     {"type": "send_notification", "template": "project_created", "recipients": ["james-miller-uuid"]}
   ]
   ```
6. System executes actions:
   - Updates project.assigned_to = james-miller-uuid
   - Sends notification to James Miller: "New project assigned: HVAC Installation - Store #45"
7. System logs execution:
   - execution_count++
   - last_executed_ts = now()
8. PM receives notification, reviews project

**Entities Touched**: Workflow Automation, Project, Employee (notification)

### UC-2: Progress Through Industry Workflow DAG

**Actors**: Sales Rep, Customer, System

**Flow**:
1. Sales Rep creates Customer (Lead status)
2. System creates workflow instance:
   ```sql
   INSERT INTO d_industry_workflow_graph_data (workflow_head_id, current_state_id)
   VALUES ('hs-standard-workflow-id', 0);  -- State 0: Lead Generation
   ```
3. Sales Rep qualifies lead → Customer status = "Qualified"
4. Sales Rep clicks "Next Stage" → System transitions workflow:
   - current_state: 0 (Lead Generation)
   - next_state: 1 (Customer Onboarding)
5. System validates transition (0 → 1 allowed in DAG)
6. System creates Workflow Event:
   ```sql
   INSERT INTO f_industry_workflow_events (workflow_data_id, from_state_id, to_state_id, event_type)
   VALUES ('workflow-instance-id', 0, 1, 'state_transition');
   ```
7. Sales Rep creates Quote for Customer
8. Quote created → System transitions workflow:
   - current_state: 1 (Customer Onboarding)
   - next_state: 2 (Quote Generation)
9. Customer accepts Quote
10. System transitions workflow:
    - current_state: 2 (Quote Generation)
    - next_state: 4 (Quote Accepted)
    - Creates Order entity (per DAG state definition)
11. Workflow continues through remaining states...
12. Finally reaches state 9 (Payment Received, terminal)
13. Workflow marked complete, success metrics updated

**Entities Touched**: Workflow Graph Head, Workflow Graph Data, Workflow Events, Customer, Quote, Order, Invoice

### UC-3: Multi-Agent Project Planning

**Actors**: Project Manager, Orchestrator, AI Agents

**Flow**:
1. PM requests: "Create comprehensive project plan for HVAC installation at 123 Main St"
2. System creates Orchestrator Session:
   ```sql
   INSERT INTO orchestrator_session (goal, orchestrator_prompt, session_status)
   VALUES (
     'Create comprehensive project plan for HVAC installation',
     'You are an expert project orchestrator...',
     'initializing'
   );
   ```
3. Orchestrator analyzes goal, selects agents:
   - Planner Agent
   - Estimator Agent
   - Resource Agent
   - Risk Agent
   - Reporter Agent
4. Orchestrator delegates to Planner Agent:
   ```sql
   INSERT INTO orchestrator_agent_log (session_id, agent_name, action_type, input_data)
   VALUES ('session-123', 'planner', 'plan_project', '{"address": "123 Main St", "service": "HVAC"}');
   ```
5. Planner Agent returns:
   ```json
   {
     "phases": [
       {"name": "Site Preparation", "duration_days": 1, "tasks": [...]},
       {"name": "Equipment Installation", "duration_days": 2, "tasks": [...]},
       {"name": "Testing & Commissioning", "duration_days": 1, "tasks": [...]}
     ]
   }
   ```
6. Orchestrator delegates to Estimator Agent with Planner's output
7. Estimator returns cost breakdown: $12,500 total
8. Orchestrator delegates to Resource Agent
9. Resource returns material list and labor requirements
10. Orchestrator delegates to Risk Agent
11. Risk returns risk assessment with mitigation strategies
12. Orchestrator delegates to Reporter Agent with all aggregated data
13. Reporter generates comprehensive project plan document (PDF)
14. System updates session:
    ```sql
    UPDATE orchestrator_session
    SET session_status = 'completed', final_output = '{...}'
    WHERE id = 'session-123';
    ```
15. PM receives final project plan with:
    - Detailed timeline (4 days)
    - Cost estimate ($12,500)
    - Material requirements (list)
    - Risk assessment
    - Executive summary
16. PM reviews and approves, creates Project from plan

**Entities Touched**: Orchestrator Session, Orchestrator Agents, Orchestrator Agent Log, Orchestrator Summary, Project

## Technical Architecture

### Key Tables

```sql
-- Workflow Automation
CREATE TABLE app.d_workflow_automation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_name TEXT NOT NULL,
    trigger_entity_type TEXT NOT NULL,             -- 'project', 'task'
    trigger_action_type TEXT NOT NULL,             -- 'create', 'update', 'status_change'
    trigger_scope TEXT DEFAULT 'all',              -- 'all' or 'specific'
    trigger_conditions JSONB DEFAULT '{}',         -- Additional filter conditions
    action_entity_type TEXT NOT NULL,              -- Entity to act upon
    actions JSONB NOT NULL,                        -- Array of actions
    execution_order INTEGER DEFAULT 0,
    max_executions INTEGER DEFAULT -1,
    execution_count INTEGER DEFAULT 0,
    last_executed_ts TIMESTAMPTZ,
    active_flag BOOLEAN DEFAULT true
);

-- Industry Workflow Graph Head (Template)
CREATE TABLE app.d_industry_workflow_graph_head (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,              -- 'HS_STD', 'HVAC_EMERG'
    name text NOT NULL,                             -- 'Home Services - Standard'
    industry_sector text NOT NULL,
    workflow_graph jsonb NOT NULL,                  -- DAG definition
    active_workflow_flag boolean DEFAULT true,
    default_workflow_flag boolean DEFAULT false,
    avg_duration_days integer,
    success_rate_pct decimal(5,2)
);

-- Industry Workflow Graph Data (Instance)
CREATE TABLE app.d_industry_workflow_graph_data (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_head_id uuid NOT NULL,                 -- FK to template
    current_state_id integer,                       -- Current state in DAG
    state_history jsonb DEFAULT '[]'::jsonb,        -- Transition history
    created_entities jsonb DEFAULT '{}'::jsonb,     -- Entities created
    workflow_status text DEFAULT 'active',
    started_ts timestamptz DEFAULT now(),
    completed_ts timestamptz
);

-- Workflow Events
CREATE TABLE app.f_industry_workflow_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_data_id uuid NOT NULL,
    event_type text NOT NULL,                       -- 'state_transition', 'entity_created'
    from_state_id integer,
    to_state_id integer,
    created_entity_id uuid,
    event_ts timestamptz DEFAULT now()
);

-- Orchestrator Session
CREATE TABLE app.orchestrator_session (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id varchar(100) UNIQUE NOT NULL,
    goal text NOT NULL,
    orchestrator_prompt text,
    active_agents jsonb DEFAULT '[]'::jsonb,
    session_status text DEFAULT 'initializing',     -- 'initializing', 'running', 'completed', 'failed'
    final_output jsonb,
    started_ts timestamptz DEFAULT now(),
    completed_ts timestamptz
);

-- Orchestrator Agents
CREATE TABLE app.orchestrator_agents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name varchar(100) UNIQUE NOT NULL,
    agent_type varchar(50) NOT NULL,                -- 'planner', 'estimator', etc.
    capabilities jsonb DEFAULT '[]'::jsonb,
    system_prompt text,
    model varchar(50),
    active_flag boolean DEFAULT true
);

-- Orchestrator Agent Log
CREATE TABLE app.orchestrator_agent_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id varchar(100) NOT NULL,
    agent_name varchar(100) NOT NULL,
    action_type varchar(50),
    input_data jsonb,
    output_data jsonb,
    execution_status text DEFAULT 'pending',
    execution_ts timestamptz DEFAULT now()
);
```

### API Endpoints

```
# Workflow Automation
GET    /api/v1/workflow-automation       # List automation rules
POST   /api/v1/workflow-automation       # Create rule
PUT    /api/v1/workflow-automation/:id   # Update rule
DELETE /api/v1/workflow-automation/:id   # Deactivate rule

# Industry Workflows
GET    /api/v1/workflow-template         # List workflow templates
GET    /api/v1/workflow-template/:id     # Get template DAG
POST   /api/v1/workflow-instance         # Start workflow instance
PUT    /api/v1/workflow-instance/:id/transition  # Transition state
GET    /api/v1/workflow-instance/:id     # Get instance status

# Orchestrator
POST   /api/v1/orchestrator/session      # Start orchestrator session
GET    /api/v1/orchestrator/session/:id  # Get session status
GET    /api/v1/orchestrator/session/:id/logs  # Get agent logs
```

## Integration Points

### Upstream Dependencies

- **All Domains**: Workflow automation can trigger on any entity

### Downstream Dependencies

- **All Domains**: Workflow actions can create/update any entity

## Data Volume & Performance

### Expected Data Volumes

- Workflow Automation Rules: 50 - 500 rules
- Workflow Templates: 10 - 100 templates
- Workflow Instances: 10,000 - 100,000 instances
- Workflow Events: 100,000 - 1,000,000 events per year
- Orchestrator Sessions: 1,000 - 10,000 per year
- Agent Logs: 10,000 - 100,000 per year

### Indexing Strategy

```sql
CREATE INDEX idx_workflow_auto_trigger ON app.d_workflow_automation(trigger_entity_type, trigger_action_type);
CREATE INDEX idx_workflow_data_head ON app.d_industry_workflow_graph_data(workflow_head_id);
CREATE INDEX idx_workflow_events_data ON app.f_industry_workflow_events(workflow_data_id);
CREATE INDEX idx_orchestrator_session_status ON app.orchestrator_session(session_status);
```

## Future Enhancements

1. **Visual Workflow Builder**: Drag-and-drop DAG designer
2. **Conditional Branching**: Complex if/then/else logic in workflows
3. **Workflow Versioning**: Template version control
4. **A/B Testing**: Test multiple workflow variants
5. **Workflow Analytics**: Bottleneck detection, success rate analysis
6. **Custom Agents**: User-defined AI agents with custom prompts
7. **Agent Marketplace**: Pre-built agents for common tasks
8. **Workflow Templates Library**: Industry-specific workflow packs
9. **Real-Time Monitoring**: Live workflow execution dashboard
10. **Predictive Analytics**: AI-predicted workflow duration and success

---

**Domain Owner**: Platform Engineering & Automation Teams
**Last Updated**: 2025-11-13
**Related Domains**: All domains (cross-cutting automation and orchestration)
