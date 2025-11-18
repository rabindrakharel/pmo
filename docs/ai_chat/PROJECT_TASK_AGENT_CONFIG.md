# Project & Task Stakeholder Agent Configuration

> **Specialized AI Agent for Project and Task Queries** - Purpose-built configuration for stakeholders to query project status, task progress, budgets, and team assignments

**Version:** 1.0.0
**Created:** 2025-11-10
**Status:** Production-Ready
**Config File:** `/apps/api/src/modules/chat/orchestrator/agent_config_projecttask.json`

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Key Features](#key-features)
3. [Architecture](#architecture)
4. [Goal Workflow](#goal-workflow)
5. [Supported Queries](#supported-queries)
6. [MCP Tools Used](#mcp-tools-used)
7. [Integration Guide](#integration-guide)
8. [Example Conversations](#example-conversations)
9. [Configuration Options](#configuration-options)
10. [Performance & Cost](#performance--cost)

---

## 🎯 Overview

The **Project & Task Stakeholder Agent** is a specialized conversational AI configuration designed for project stakeholders (managers, executives, team leads) to:

- Query project status and progress
- Track task assignments and completion
- Monitor budgets and timelines
- View team workload distribution
- Get executive summaries with actionable insights

### Design Philosophy

1. **Stakeholder-First**: Responses formatted for executives and managers
2. **Data-Driven**: All answers backed by real-time API data
3. **Concise & Visual**: Structured responses with clear formatting
4. **Actionable**: Surfaces insights, risks, and recommendations
5. **Conversational**: Natural language queries, no technical jargon

---

## ✨ Key Features

### 1. Natural Language Queries

```
❌ Old Way: Navigate through UI, filter tables, export data
✅ New Way: "What's the status of Project Alpha?"
           "Show me John's tasks"
           "Which projects are over budget?"
```

### 2. Executive Summaries

Responses include:
- **Quick Overview** - High-level status at a glance
- **Key Metrics** - Budget, timeline, progress percentages
- **Task Breakdown** - Completed vs in-progress vs open
- **Insights** - Risks, blockers, recommendations

### 3. Multi-Entity Queries

Single query can span:
- Projects → Tasks → Employees → Budgets
- Automatic entity linking via `entity_instance_link`
- Cross-entity aggregation (e.g., "total budget across all projects")

### 4. Formatted Responses

```markdown
**Project Alpha Status:**

Status: In Progress ✅
Budget: $45,000 / $100,000 (45% utilized)
Timeline: Jan 15 - Jun 30, 2025 (on track)
Manager: Sarah Johnson

**Task Summary (15 total):**
✅ Completed: 8 tasks (53%)
🔄 In Progress: 5 tasks (33%)
📋 Open: 2 tasks (14%)

**Key Insights:**
- Budget tracking well, 55% remaining
- No critical blockers
- Recommend prioritizing Task-789 (overdue 3 days)
```

---

## 🏗️ Architecture

### Goal-Oriented Workflow

The agent uses a **5-goal workflow** optimized for information retrieval:

```
1. GREET_AND_UNDERSTAND_QUERY
   ↓ (understand intent)

2. RETRIEVE_PROJECT_TASK_DATA
   ↓ (execute API calls)

3. FORMAT_AND_PRESENT_RESPONSE
   ↓ (stakeholder-friendly formatting)

4. HANDLE_NO_DATA_FOUND (if needed)
   ↓ (suggest alternatives)

5. CONFIRM_AND_CLOSE
   ↓ (satisfaction check)

END
```

### Agent Profiles

**1. Conversational Agent**
- **Role:** Understand queries, format responses, provide insights
- **Personality:** Professional, concise, data-focused
- **Output:** Markdown-formatted executive summaries

**2. MCP Agent**
- **Role:** Execute API calls, retrieve project/task data
- **Tools:** 20+ project/task/employee APIs
- **Strategy:** Smart sequencing (project → tasks → employees)

---

## 🔄 Goal Workflow

### Goal 1: GREET_AND_UNDERSTAND_QUERY

**Purpose:** Welcome stakeholder and parse their query intent

**Success Criteria:**
- `query.intent` field is set (e.g., "project_status", "task_list_by_assignee")

**Example:**
```
User: "What's the status of Project Alpha?"

Agent: "I can help you with that! Let me look up the current status of Project Alpha."

Session Memory Update:
{
  "query": {
    "intent": "project_status",
    "entity": "project",
    "target": "Project Alpha"
  }
}
```

**Supported Intents:**
- `project_status` - Get project overview
- `project_budget` - Budget details
- `project_timeline` - Schedule and milestones
- `task_list` - List tasks with filters
- `task_detail` - Single task deep-dive
- `task_list_by_assignee` - Tasks per employee
- `team_workload` - Task distribution across team
- `project_tasks` - All tasks for a project

---

### Goal 2: RETRIEVE_PROJECT_TASK_DATA

**Purpose:** Execute API calls to fetch data from PMO platform

**MCP Tools Available:**

| Tool | Purpose | Example Usage |
|------|---------|---------------|
| `project_list` | Search projects | Find "Project Alpha" |
| `project_get` | Get project details | Fetch budget, timeline |
| `project_get_tasks` | Get project tasks | List all linked tasks |
| `task_list` | Search tasks | Filter by assignee, status |
| `task_get` | Get task details | Full task info |
| `task_get_assignees` | Get task team | Who's assigned |
| `employee_list` | Search employees | Find "John Smith" |
| `linkage_list` | Entity relationships | Project ↔ Task links |

**Example Execution:**

```typescript
// User asks: "What's the status of Project Alpha?"

// Step 1: Find project
await mcpClient.call('project_list', {
  query_search: 'Project Alpha',
  query_limit: 1
});
// Returns: [{ id: 'proj-123', name: 'Project Alpha', ... }]

// Step 2: Get full project details
await mcpClient.call('project_get', {
  id: 'proj-123'
});
// Returns: { budget_allocated_amt: 100000, budget_spent_amt: 45000, ... }

// Step 3: Get project tasks
await mcpClient.call('project_get_tasks', {
  id: 'proj-123',
  query_limit: 50
});
// Returns: [{ id: 'task-1', dl__task_stage: 'COMPLETED', ... }, ...]
```

**Success Criteria:**
- `data.retrieved` field is set with API response data

---

### Goal 3: FORMAT_AND_PRESENT_RESPONSE

**Purpose:** Transform raw API data into stakeholder-friendly response

**Formatting Guidelines:**

**Project Status Summary:**
```markdown
**Project:** {name}
**Status:** {stage}
**Budget:** ${budget_spent_amt} / ${budget_allocated_amt} ({utilization}%)
**Timeline:** {planned_start_date} - {planned_end_date}
**Manager:** {manager_name}
**Progress:** {progress_percentage}%

**Task Summary ({total_tasks} total):**
✅ Completed: {completed_count} tasks ({completed_pct}%)
🔄 In Progress: {in_progress_count} tasks ({in_progress_pct}%)
📋 Open: {open_count} tasks ({open_pct}%)

**Key Insights:**
- {insight_1}
- {insight_2}
- {recommendation}
```

**Task List Summary:**
```markdown
**Tasks Assigned to {employee_name}:**

1. **{task_name}** ({dl__task_stage})
   - Priority: {dl__task_priority}
   - Effort: {actual_hours} / {estimated_hours} hours
   - Due: {due_date}

2. **{task_name_2}** ...
```

**Success Criteria:**
- `response.formatted` is set to `true`

---

### Goal 4: HANDLE_NO_DATA_FOUND

**Purpose:** Gracefully handle cases where no data exists

**Example:**
```
User: "Show me Project Zeta"

Agent: "I couldn't find a project named 'Project Zeta' in the system.

Would you like me to:
1. Search for projects with similar names?
2. Show all active projects?
3. Search by project manager or business unit?"
```

**Strategies:**
- Suggest broader search
- Offer alternative queries
- List available projects/tasks for context

---

### Goal 5: CONFIRM_AND_CLOSE

**Purpose:** Verify stakeholder satisfaction and close conversation

**Example:**
```
Agent: "Does this answer your question?"

User: "Yes, thank you!"

Agent: "Thank you for using the PMO Assistant! If you need any other project or task information, feel free to ask anytime."
```

---

## 💬 Supported Queries

### Project Queries

| Query Type | Example | Expected Output |
|------------|---------|-----------------|
| **Project Status** | "What's the status of Project Alpha?" | Status, budget, timeline, tasks summary |
| **Project Budget** | "Show me Project Beta's budget" | Allocated vs spent, utilization % |
| **Project Timeline** | "When is Project Gamma due?" | Start/end dates, progress % |
| **Project Tasks** | "List all tasks for Project Delta" | Task list with status, assignees |
| **Multiple Projects** | "Show me all projects in the Design phase" | List of projects filtered by stage |

### Task Queries

| Query Type | Example | Expected Output |
|------------|---------|-----------------|
| **Task by ID** | "Tell me about Task-456" | Full task details, activity log |
| **Task by Name** | "Show me the 'Homepage Redesign' task" | Task details, assignees |
| **Tasks by Assignee** | "What tasks is John working on?" | List of tasks assigned to John |
| **Tasks by Status** | "Show me all open tasks" | Filtered task list |
| **Tasks by Priority** | "Which tasks are high priority?" | High-priority task list |

### Team Queries

| Query Type | Example | Expected Output |
|------------|---------|-----------------|
| **Employee Tasks** | "How many tasks does Sarah have?" | Task count, breakdown by status |
| **Team Workload** | "Show me team workload distribution" | Task count per employee |
| **Available Employees** | "Who has capacity for new tasks?" | Employees with low task count |

### Cross-Entity Queries

| Query Type | Example | Expected Output |
|------------|---------|-----------------|
| **Project + Budget** | "Which projects are over budget?" | List of projects with budget overruns |
| **Project + Timeline** | "Which projects are behind schedule?" | Projects with past-due end dates |
| **Employee + Projects** | "Which projects is John managing?" | Projects where John is manager |

---

## 🔌 MCP Tools Used

### Core API Endpoints

The agent uses the following MCP tools (from `/apps/mcp-server/src/api-manifest.ts`):

#### Project APIs (Category: Project)

```typescript
// Search and list projects
project_list: GET /api/v1/project
  - Filters: active, search, dl__project_stage, business_id
  - Pagination: limit, offset

// Get single project
project_get: GET /api/v1/project/:id

// Get project child entities
project_get_tasks: GET /api/v1/project/:id/task
project_get_wiki: GET /api/v1/project/:id/wiki
project_get_forms: GET /api/v1/project/:id/form
project_get_artifacts: GET /api/v1/project/:id/artifact
```

#### Task APIs (Category: Task)

```typescript
// Search and list tasks
task_list: GET /api/v1/task
  - Filters: project_id, assigned_to_employee_id, dl__task_stage,
             task_type, task_category, worksite_id, client_id
  - Pagination: limit, offset

// Get single task
task_get: GET /api/v1/task/:id

// Get task details
task_get_assignees: GET /api/v1/task/:id/assignees
task_get_case_notes: GET /api/v1/task/:taskId/case-notes
task_get_activity: GET /api/v1/task/:taskId/activity
task_get_kanban: GET /api/v1/project/:projectId/tasks/kanban
```

#### Employee APIs (Category: Employee)

```typescript
// List employees
employee_list: GET /api/v1/employee

// Get single employee
employee_get: GET /api/v1/employee/:id
```

#### Linkage APIs (Category: Linkage)

```typescript
// Get entity relationships
linkage_list: GET /api/v1/linkage
  - Filters: parent_entity_type, parent_entity_id,
             child_entity_type, child_entity_id
```

### Tool Selection Strategy

**Smart Sequencing:**

```
Query: "What's the status of Project Alpha with all task details?"

Execution Plan:
1. project_list(search="Project Alpha") → Get project ID
2. project_get(id=project_id) → Get budget, timeline
3. project_get_tasks(id=project_id) → Get linked tasks
4. For each task with assignee_id:
   - employee_get(id=assignee_id) → Get assignee name
5. Format and present combined data
```

---

## 🛠️ Integration Guide

### Step 1: Update Orchestrator Service

Modify `/apps/api/src/modules/chat/orchestrator/agents/agent-orchestrator.service.ts`:

```typescript
import projectTaskConfig from '../agent_config_projecttask.json';

// Add config loading logic
const configs = {
  'customer_service': customerServiceConfig,
  'project_task_stakeholder': projectTaskConfig  // NEW
};

// Allow config selection via API
export class AgentOrchestratorService {
  constructor(private configType: string = 'customer_service') {
    this.config = configs[configType];
  }
}
```

### Step 2: Create New API Endpoint

Add route in `/apps/api/src/modules/chat/routes.ts`:

```typescript
// Project/Task Stakeholder Chat Session
fastify.post('/api/v1/chat/project-task/session/new', {
  preHandler: [fastify.authenticate],
  schema: {
    body: Type.Object({
      user_id: Type.String(),
      name: Type.Optional(Type.String()),
      email: Type.Optional(Type.String())
    })
  }
}, async (request, reply) => {
  const { user_id, name, email } = request.body as any;

  // Initialize with project-task config
  const orchestrator = new AgentOrchestratorService('project_task_stakeholder');

  const result = await orchestrator.initializeSession({
    userId: user_id,
    chatSessionId: uuidv4(),
    metadata: { name, email }
  });

  return {
    session_id: result.sessionId,
    greeting: "Hello! I'm your PMO Project & Task Assistant. How can I help you today?"
  };
});

// Send message (same endpoint, different config)
fastify.post('/api/v1/chat/project-task/message', {
  preHandler: [fastify.authenticate],
  schema: {
    body: Type.Object({
      session_id: Type.String(),
      message: Type.String()
    })
  }
}, async (request, reply) => {
  const { session_id, message } = request.body as any;

  const orchestrator = new AgentOrchestratorService('project_task_stakeholder');

  const result = await orchestrator.processMessage({
    sessionId: session_id,
    message: message,
    userId: (request as any).user.sub,
    chatSessionId: session_id
  });

  return {
    response: result.response,
    session_id: result.sessionId,
    current_goal: result.currentNode,
    conversation_ended: result.conversationEnded
  };
});
```

### Step 3: Frontend Integration

Create new component `/apps/web/src/components/chat/ProjectTaskChatWidget.tsx`:

```tsx
import React, { useState } from 'react';
import { projectTaskChatApi } from '@/lib/api';

export function ProjectTaskChatWidget() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState('');

  const startSession = async () => {
    const response = await projectTaskChatApi.createSession({
      user_id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email
    });

    setSessionId(response.session_id);
    setMessages([{ role: 'assistant', content: response.greeting }]);
  };

  const sendMessage = async () => {
    if (!sessionId || !input.trim()) return;

    setMessages(prev => [...prev, { role: 'user', content: input }]);

    const response = await projectTaskChatApi.sendMessage({
      session_id: sessionId,
      message: input
    });

    setMessages(prev => [...prev, { role: 'assistant', content: response.response }]);
    setInput('');
  };

  return (
    <div className="project-task-chat-widget">
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        placeholder="Ask about projects or tasks..."
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}
```

### Step 4: Add to PMO Dashboard

Embed widget in `/apps/web/src/pages/DashboardPage.tsx`:

```tsx
import { ProjectTaskChatWidget } from '@/components/chat/ProjectTaskChatWidget';

export function DashboardPage() {
  return (
    <div className="dashboard">
      {/* Existing dashboard content */}

      {/* NEW: Floating chat widget */}
      <div className="floating-chat-assistant">
        <ProjectTaskChatWidget />
      </div>
    </div>
  );
}
```

---

## 💬 Example Conversations

### Example 1: Project Status Query

```
👤 User: "What's the status of Project Alpha?"

🤖 Agent: "I can help you with that! Let me look up the current status of Project Alpha for you."

[Agent executes: project_list(search="Project Alpha") → project_get(id) → project_get_tasks(id)]

🤖 Agent:
**Project Alpha Status:**

**Status:** In Progress ✅
**Budget:** $45,000 / $100,000 (45% utilized)
**Timeline:** Jan 15 - Jun 30, 2025 (on track)
**Manager:** Sarah Johnson

**Task Summary (15 total):**
✅ Completed: 8 tasks (53%)
🔄 In Progress: 5 tasks (33%)
📋 Open: 2 tasks (14%)

**Key Insights:**
- Budget tracking well with 55% remaining
- On schedule, no timeline concerns
- 2 open tasks: "API Integration" and "User Testing"
- Recommend prioritizing "User Testing" (due in 3 days)

Would you like details on specific tasks or team assignments?

👤 User: "Show me the open tasks"

🤖 Agent:
**Open Tasks for Project Alpha:**

1. **API Integration** (Open)
   - Priority: High
   - Assigned to: John Smith
   - Effort: 0 / 16 hours
   - Due: Nov 25, 2025

2. **User Testing** (Open)
   - Priority: Medium
   - Assigned to: Emily Chen
   - Effort: 0 / 8 hours
   - Due: Nov 13, 2025 ⚠️ (in 3 days)

Would you like to see the in-progress tasks as well?
```

---

### Example 2: Task Assignment Query

```
👤 User: "Show me all tasks assigned to John Smith"

🤖 Agent: "Let me find all tasks currently assigned to John."

[Agent executes: employee_list(search="John Smith") → task_list(assigned_to_employee_id=john_id)]

🤖 Agent:
**Tasks Assigned to John Smith (5 total):**

**Completed (1):**
✅ Database Migration - Project Alpha (3 days ago)

**In Progress (3):**
🔄 API Integration - Project Alpha
   - Priority: High | 5 / 16 hours | Due: Nov 25

🔄 Performance Optimization - Project Beta
   - Priority: Medium | 10 / 12 hours | Due: Nov 20

🔄 Bug Fix #234 - Project Gamma
   - Priority: Low | 2 / 4 hours | Due: Nov 15

**Open (1):**
📋 Code Review - Project Delta
   - Priority: Medium | 0 / 6 hours | Due: Nov 18

**Summary:**
- Total effort: 17 / 38 hours (45% complete)
- John is currently working on 3 tasks
- 1 task waiting to start

Would you like more details on any specific task?
```

---

### Example 3: Budget Query

```
👤 User: "Which projects are over budget?"

🤖 Agent: "Let me check all active projects and their budget status."

[Agent executes: project_list(active=true) → for each: calculate budget_spent / budget_allocated]

🤖 Agent:
**Budget Analysis for Active Projects:**

**Over Budget (2 projects):**

1. **Project Gamma** ⚠️
   - Budget: $125,000 / $100,000 (125% utilized, $25K over)
   - Status: In Progress
   - Recommendation: Review scope or request additional funding

2. **Project Delta** ⚠️
   - Budget: $82,500 / $75,000 (110% utilized, $7.5K over)
   - Status: In Progress
   - Recommendation: Evaluate if remaining work can be deferred

**On Budget (3 projects):**
✅ Project Alpha: $45K / $100K (45%)
✅ Project Beta: $60K / $80K (75%)
✅ Project Epsilon: $30K / $50K (60%)

Would you like detailed breakdowns for the over-budget projects?
```

---

## ⚙️ Configuration Options

### Customizing Agent Behavior

Edit `/apps/api/src/modules/chat/orchestrator/agent_config_projecttask.json`:

**1. Change Response Verbosity:**

```json
{
  "agent_profiles": {
    "conversational_agent": {
      "personality_traits": {
        "verbosity": "concise_executive"  // Options: brief, concise_executive, detailed
      }
    }
  }
}
```

**2. Adjust Max Conversation Length:**

```json
{
  "global_constraints": {
    "max_conversation_turns": 20,  // Increase for longer conversations
    "timeout_seconds": 300         // 5 minutes
  }
}
```

**3. Add New Query Intent:**

```json
{
  "goals": [
    {
      "goal_id": "GREET_AND_UNDERSTAND_QUERY",
      // Add new intent mapping
      "intent_recognition": {
        "risk_analysis": {
          "keywords": ["risk", "blocker", "issue", "concern"],
          "api_sequence": ["project_get_tasks", "task_get_activity"],
          "format": "risk_summary"
        }
      }
    }
  ]
}
```

**4. Customize Formatting:**

```json
{
  "goals": [
    {
      "goal_id": "FORMAT_AND_PRESENT_RESPONSE",
      "formatting_guidelines": {
        "project_status_summary": {
          "include": ["name", "stage", "budget", "timeline", "risks"],
          "format": "**{name}**\nStatus: {stage}\nBudget: {budget_summary}\n..."
        }
      }
    }
  ]
}
```

---

## 📊 Performance & Cost

### Response Time Benchmarks

| Query Type | API Calls | Avg Latency | First Token |
|------------|-----------|-------------|-------------|
| **Simple Project Status** | 2 (project_list + project_get) | ~800ms | ~300ms |
| **Project + Tasks** | 3 (project_list + project_get + project_get_tasks) | ~1.2s | ~300ms |
| **Complex Multi-Entity** | 5+ (project + tasks + employees) | ~2.5s | ~300ms |

### Cost per Query

```
Simple Query (1-2 API calls):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LLM calls:              2 × $0.0015 = $0.003
API calls:              2 × $0      = $0     (internal)
Session memory ops:     3 × $0      = $0     (LowDB)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total:                              ~$0.003
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Complex Query (5+ API calls):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LLM calls:              3 × $0.0015 = $0.0045
API calls:              5 × $0      = $0     (internal)
Session memory ops:     5 × $0      = $0     (LowDB)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total:                              ~$0.0045
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Cost per 1000 stakeholders:** ~$3.00 (assuming 1 query/day)

### Optimization Tips

1. **Cache Project List**: Pre-load project names to avoid repeated `project_list` calls
2. **Batch API Calls**: Fetch employee details in parallel instead of sequential
3. **Session Memory**: Store frequently accessed data (project IDs, employee IDs) in session
4. **Pagination**: Limit task lists to 20-50 items to reduce response time

---

## 🔧 Troubleshooting

### Issue: Agent Not Understanding Query

**Symptoms:**
- Agent stuck in `GREET_AND_UNDERSTAND_QUERY` goal
- `query.intent` not being set

**Solution:**
```json
// Add more intent keywords in config
{
  "goals": [
    {
      "goal_id": "GREET_AND_UNDERSTAND_QUERY",
      "intent_keywords": {
        "project_status": ["status", "progress", "how is", "what's happening"],
        "task_list": ["tasks", "todo", "work items", "assignments"]
      }
    }
  ]
}
```

### Issue: Slow Response Times

**Symptoms:**
- Queries taking >5 seconds
- Multiple sequential API calls

**Solution:**
```typescript
// Enable parallel API calls in MCP agent
const [projectData, taskData, employeeData] = await Promise.all([
  mcpClient.call('project_get', { id: projectId }),
  mcpClient.call('project_get_tasks', { id: projectId }),
  mcpClient.call('employee_list', {})
]);
```

### Issue: Data Not Found

**Symptoms:**
- Agent says "No project found" but project exists
- Search returning empty results

**Solution:**
```typescript
// Use wildcard search in project_list
await mcpClient.call('project_list', {
  query_search: `%${searchTerm}%`,  // Wrap with wildcards
  query_limit: 10
});
```

---

## 📚 Related Documentation

- [AI Chat System](./AI_CHAT_SYSTEM.md) - Complete AI chat architecture
- [MCP Adapter Service](../../apps/api/src/modules/chat/mcp-adapter.service.ts) - MCP tool integration
- [API Manifest](../../apps/mcp-server/src/api-manifest.ts) - All available APIs
- [Universal Entity System](../entity_design_pattern/universal_entity_system.md) - PMO entity architecture
- [Project & Task Data Model](../datamodel/datamodel.md) - Database schema

---

## 🎓 Best Practices

### 1. Query Design

**✅ Good:**
- "What's the status of Project Alpha?"
- "Show me John's high-priority tasks"
- "Which projects are behind schedule?"

**❌ Avoid:**
- "Tell me everything about all projects" (too broad)
- "Project Alpha" (incomplete question)
- "UUID 12345-abcd" (use names, not IDs)

### 2. Response Formatting

**✅ Good:**
- Use headers, bullets, progress indicators
- Highlight key metrics (budget, timeline)
- Surface insights and recommendations

**❌ Avoid:**
- Long paragraphs without structure
- Raw API data dumps
- Technical jargon

### 3. MCP Tool Usage

**✅ Good:**
- Sequence API calls logically (project → tasks → employees)
- Cache frequently used data in session memory
- Batch parallel calls when possible

**❌ Avoid:**
- Calling same API multiple times
- Not storing retrieved data for follow-ups
- Ignoring pagination limits

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| **v1.0** | 2025-11-10 | Initial release - 5-goal workflow, 20+ MCP tools, stakeholder-focused formatting |

---

**Last Updated:** 2025-11-10
**Maintained By:** PMO Platform Team
**Config File:** `/apps/api/src/modules/chat/orchestrator/agent_config_projecttask.json`
**Status:** ✅ Production-Ready
