# Functions Service

> **LLM function calling definitions for tool use and entity operations**

**File**: `apps/api/src/modules/chat/functions.service.ts`
**Used By**: Chat routes, OpenAI Service, Agent Orchestrator Service

---

## How It Works (Building Blocks)

### Block 1: Function Schema Registry

**Function Catalog**:
- Maintains registry of all available LLM functions
- Each function has: name, description, parameters schema
- Categorized by capability (entity CRUD, search, calendar, etc.)
- JSON Schema format (OpenAI function calling standard)

**Function Categories**:
- **Entity Operations** - create_project, update_task, delete_entity
- **Search** - search_entities, find_by_name, filter_entities
- **Calendar** - create_event, book_calendar, check_availability
- **Data Retrieval** - get_entity, list_entities, get_options
- **Aggregations** - count_entities, sum_amounts, group_by

### Block 2: Parameter Schema Definition

**Schema Structure**:
- Function name (e.g., "create_project")
- Human-readable description
- Required parameters list
- Optional parameters list
- Parameter types (string, number, boolean, object, array)
- Enum constraints (allowed values)
- Default values

**Example Schema**:
```
create_project:
  description: "Create new project with business context"
  parameters:
    - name (required, string)
    - business_id (required, uuid)
    - start_date (optional, date)
    - budget_allocated_amt (optional, number)
```

### Block 3: Function Execution Dispatcher

**Execution Flow**:
- LLM decides which function to call
- Returns function name + arguments JSON
- Service validates arguments against schema
- Dispatches to corresponding handler function
- Handler executes business logic (database query, API call, etc.)
- Returns result to LLM for response generation

**Validation**:
- Type checking (string vs number vs uuid)
- Required parameter presence
- Enum value validation
- UUID format validation
- Date format validation

### Block 4: Dynamic Function Loading

**Entity Function Generation**:
- For each entity type (project, task, customer, etc.)
- Auto-generates standard CRUD functions:
  - `create_{entity}`
  - `update_{entity}`
  - `delete_{entity}`
  - `get_{entity}`
  - `list_{entity}`
- Uses entity metadata from `d_entity` table
- Parameter schemas from column metadata

**Template-Based Generation**:
- Common parameter patterns (name, descr, active_flag)
- Entity-specific parameters (project has budget, task has deadline)
- Relationship parameters (parent_id, assigned_to)

---

## Operational Flow

### LLM Function Call Request

**Sequence**:
1. User asks: "Create a project called Kitchen Renovation for ABC Corp"
2. Chat service sends user message to LLM with function list
3. LLM analyzes request and decides to call `create_project`
4. LLM returns:
   ```json
   {
     "function_call": {
       "name": "create_project",
       "arguments": {
         "name": "Kitchen Renovation",
         "business_id": "abc-corp-uuid"
       }
     }
   }
   ```
5. Functions Service receives function call
6. Validates arguments against `create_project` schema
7. Dispatches to project creation handler
8. Handler creates project in database
9. Returns result to LLM
10. LLM generates natural language response: "I've created the Kitchen Renovation project for ABC Corp"

### Function Schema Loading

**Sequence**:
1. Chat route starts conversation
2. Loads function definitions from Functions Service
3. Service queries `d_entity` for entity types
4. For each entity:
   - Generate CRUD function schemas
   - Load custom function schemas
5. Merge all function schemas
6. Return complete function catalog
7. Chat route includes functions in LLM request

### Function Execution with Validation

**Sequence**:
1. Functions Service receives function call
2. Lookup function schema by name
3. Validate arguments:
   - Check required parameters present
   - Validate types (uuid format, number range)
   - Validate enums (dl__project_stage values)
4. If validation fails → Return error to LLM
5. If validation passes:
   - Dispatch to handler
   - Execute business logic
   - Catch errors
   - Return result or error
6. LLM receives result and formulates response

### Entity Search Function

**Sequence**:
1. User asks: "Show me all active projects for ABC Corp"
2. LLM calls `search_entities`:
   ```json
   {
     "entity_type": "project",
     "filters": {
       "business_id": "abc-corp-uuid",
       "active_flag": true
     }
   }
   ```
3. Functions Service validates arguments
4. Dispatches to entity search handler
5. Handler builds SQL query with filters
6. Executes query with RBAC filtering
7. Returns project list
8. LLM receives results and formats as natural language

---

**File**: `apps/api/src/modules/chat/functions.service.ts`
