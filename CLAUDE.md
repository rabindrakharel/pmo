| **[🗄️ Database Schema](./db/README.md)** | 5-layer RBAC architecture with 20+ tables | Canadian business context, DDL files, relationships |
| **[🛠️ Management Tools](./tools/README.md)** | 16 platform operation tools | Start/stop, database import, API testing, RBAC debugging. 

Run /home/rabin/projects/pmo/tools/db-import.sh to import all the data all over again.

Run /home/rabin/projects/pmo/tools/start-all.sh to start api or db or web or all servers. 


  I was having trouble with bash variable assignment and token handling. The commands like:
  JWT_TOKEN="token" && curl -H "Authorization: Bearer $JWT_TOKEN" ...
  were not working properly due to bash variable scoping in single command execution.

  What I Found
  Bash(curl -s -H "Authorization: Bearer $(jq -r '.token' /tmp/auth2.json)" "http://localhost:4000/api/v1/project/ab731343-d974-4e4b-9a66-5fb0c672403d/task" | jq '.dat…)
  ⎿  0
  This works. 

   Bash(curl -s -X POST "http://localhost:4000/api/v1/auth/login" -H "Content-Type: application/json" -d '{"email": "james.miller@huronhome.ca",
      "password": "password12…)
  ⎿ {                                                                                                                                                
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzZDY1MWYzYi05ODJkLTRmMzUtYmFmOS0zODhmMzg5ZDg5ZTYiLCJlbWFpbCI6ImphbWVzLm1pbGxlckBodXJv
    bmhvbWUuY2EiLCJuYW1lIjoiSmFtZXMgTWlsbGVyIiwiaWF0IjoxNzU4NDc5Njc0LCJleHAiOjE3NTg1NjYwNzR9.r8idKVf6N5PrmQKW6X5nYr148oJdx8zqaswtLhWkwqI",
    … +6 lines (ctrl+o to expand)


● Now let me test the existing API endpoints that the AssignmentBox component relies on to ensure they work with authentication:

● Bash(curl -s -H "Authorization: Bearer $(jq -r '.token' /tmp/auth_fresh.json)" "http://localhost:4000/api/v1/biz" | jq '.data | length')
  ⎿  0

● Bash(curl -s -H "Authorization: Bearer $(jq -r '.token' /tmp/auth_fresh.json)" "http://localhost:4000/api/v1/entity/org" | jq '.data | length')
  ⎿  14

● Bash(curl -s -H "Authorization: Bearer $(jq -r '.token' /tmp/auth_fresh.json)" "http://localhost:4000/api/v1/client" | jq '.data | length')
  ⎿  13

  When I used the existing test script (./tools/test-api-endpoints.sh), authentication worked perfectly. The script:

  1. Successfully logs in via POST /api/v1/auth/login
  2. Gets a valid JWT token (265 chars)
  3. All authenticated endpoints work - project, task, employee, etc. all return ✅ PASS (200)


different entities use join table: entity_id_hierarchy_mapping for join purposes, no foreign key is required for parent-action 
entity types. 


  Based on my analysis of the project page, Same structure is applicable for rest of the other pages. 
  1. Page Structure Overview

  Project Detail Page (ProjectDetailPage.tsx)

  The main project overview page that serves as the parent entity with navigation to action entities.

  Key Components:
  - DynamicChildEntityTabs: Dynamic tab navigation for action entities (tasks, wiki, artifacts, forms)
  - ActionBar: Contains RBAC-controlled action buttons and filters
  - Project Stats Cards: Display task count, artifact count, completion percentage, team size
  - Editable Fields System: Inline editing with permission checks
  - Project Information Sections: Basic info, status & timeline, budget, description

  Action Entity Pages

  Project Sub-pages:
  - ProjectTaskPage.tsx: Task management with Kanban/Grid views
  - ProjectWikiPage.tsx: Wiki entries with filtered data table
  - ProjectArtifactPage.tsx: Artifact management with preview capabilities
  - ProjectFormPage.tsx: Form management

  2. Component Architecture

  DynamicChildEntityTabs Component

  // Location: apps/web/src/components/common/DynamicChildEntityTabs.tsx

  Key Features:
  - Dynamic Tab Generation: Uses useDynamicChildEntityTabs hook to fetch action summaries from API
  - Entity Mapping: Maps entity types to icons and routes
  - Permission Integration: Tabs are populated based on user's entity access
  - Fallback System: Default tabs if API call fails

  API Integration:
  // Fetches dynamic child entity tabs for tab counts
  GET /api/v1/{parentType}/{parentId}/dynamic-child-entity-tabs

  FilteredDataTable Component

  // Location: apps/web/src/components/FilteredDataTable.tsx

  Features:
  - Configuration-Driven: Uses configService.getEntityConfig() for field definitions
  - Parent-Child Filtering: Filters data by parent entity relationship
  - Dynamic Columns: Renders columns based on entity configuration
  - Row Actions: Edit, delete, view actions based on permissions

  3. API Architecture

  Project Routes (apps/api/src/modules/project/routes.ts)

  Core Endpoints:

  1. Project CRUD:
  GET    /api/v1/project          // List projects with RBAC filtering
  GET    /api/v1/project/:id     // Get single project
  POST   /api/v1/project         // Create project
  PUT    /api/v1/project/:id     // Update project
  DELETE /api/v1/project/:id     // Soft delete project
  2. Action Entity Endpoints:
  GET /api/v1/project/:id/dynamic-child-entity-tabs  // Tab navigation data
  GET /api/v1/project/:id/task             // Project tasks
  GET /api/v1/project/:id/wiki             // Project wiki entries
  GET /api/v1/project/:id/artifact         // Project artifacts
  GET /api/v1/project/:id/form             // Project forms




  NEVER USE DEV_BYPASS_OIDC=true, and never create fallback option in code.
  write code for production grade. 
  Generate a new jwt token each time before you try to authenticate.

  Data curation, Data creation:
  - Please curate the data in .ddl files in this location /home/rabin/projects/pmo/dba/* 
  - append the insert statements in .ddl file so that data can be reimported by tools .sh script /home/rabin/projects/pmo/tools/db-import.sh
  - You must understand the data model first: 

  - Please make sure if you need to rebuild /home/rabin/projects/pmo/tools/db-import.sh script to include all the .ddl files. 
Data model usage: 
🗄️ PMO Database Tables - Short Reference

  🔗 Mapping & Relationship Tables

  entity_id_hierarchy_mapping - Instance Relationships

  Maps actual parent-child relationships between specific entity instances.
  -- Examples:
  parent_entity='project', parent_entity_id='uuid-123', action_entity='task', action_entity_id='uuid-456'
  parent_entity='biz', parent_entity_id='uuid-789', action_entity='project', action_entity_id='uuid-123'
  Purpose: Tracks which tasks belong to which projects, which projects belong to which business units, etc.

  rel_employee_entity_action_rbac - User Permissions

  Maps employee permissions to specific entity instances.
  -- Example: James Miller can view/edit project uuid-123
  employee_id='james-uuid', parent_entity='project', parent_entity_id='uuid-123', permission_action='view'

  rel_emp_role - Employee Role Assignments

  Links employees to their roles with temporal tracking.
  -- Example: James Miller is CEO
  employee_id='james-uuid', role_id='ceo-role-uuid', from_ts='2024-01-01'

  🏗️ Meta Configuration Tables

  meta_entity_types - Foundation Layer

  Defines the 12 core entity types (biz, project, task, wiki, etc.).

  meta_entity_hierarchy - Rules Layer

  Defines what can create what (business→project, project→task).

  meta_entity_hierarchy_permission_mapping - Permission Matrix

  Defines available actions for each relationship type.

  👥 Core Entity Tables

  d_employee - Personnel (25 employees)

  -- Example: James Miller, CEO
  name='James Miller', email='james.miller@huronhome.ca', employee_number='EMP-001'

  d_project - Projects (10 projects)

  -- Example: Fall 2025 Landscaping Campaign
  name='Fall 2025 Landscaping Campaign', project_type='seasonal', budget_allocated=50000
  project/e0bf3527-4968-4170-a7bb-2890c52a84c1

  d_biz - Business Units (3-level hierarchy)

  -- Example: Corporate → Landscaping Division → Grounds Maintenance Dept
  parent_id=null (Corporate), parent_id='corporate-uuid' (Division), parent_id='division-uuid' (Dept)

  ops_task_head - Tasks (8 tasks)

  -- Example: Fall Leaf Cleanup
  name='Fall Leaf Cleanup - Thompson Residence', project_id='landscaping-project-uuid'

  📄 Content Tables

  d_wiki - Knowledge Base (5 entries)

  -- Example: Safety Protocols
  title='Safety Protocols', slug='safety-protocols', published=true

  d_artifact - Documents (8 artifacts)

  -- Example: HVAC Maintenance Template
  name='HVAC Maintenance Checklist Template', artifact_type='template'

  ops_formlog_head - Forms (8 forms)

  -- Example: Safety Inspection Form  
  name='Daily Safety Inspection Form', project_id='project-uuid', biz_id='biz-uuid'

  🎯 Key Relationships

  - Projects have tasks via entity_id_hierarchy_mapping
  - Projects have wiki/artifacts via entity_id_hierarchy_mapping
  - Business units create projects via entity_id_hierarchy_mapping
  - Employees get permissions via rel_employee_entity_action_rbac
  - NO direct foreign keys between action entities - all via hierarchy mapping table