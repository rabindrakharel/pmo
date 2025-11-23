Login page → Login
Sidebar → Click "Office"
EntityListOfInstancesPage (Office list with data table) → EntityDataTable component
Click first row → Navigate to specific office
EntitySpecificInstancePage (Office detail) → EntityFormContainer component
Click Edit → Edit mode

Signed in, went to his page: http://localhost:5173/welcome, Clicked on office button in sidebar, went to page http://localhost:5173/office, clicked on first record in data table, 
http://localhost:5173/office/f3f1d494-a334-49cc-aa23-540f8b59da5f

Navigation Flow Logging Summary
1. Sidebar → Office List (EntityListOfInstancesPage)
[RENDER #1] 🖼️ EntityListOfInstancesPage: office
2. Office List Data Table (EntityDataTable)
[RENDER #1] 🖼️ EntityDataTable: office
[API FETCH] 📡 useEntityInstanceList.fetchData: office
[API FETCH] ✅ EntityDataTable received X items
3. Click Row → Navigate to Detail (EntitySpecificInstancePage)
[NAVIGATION] 🚀 Row clicked - navigating to detail page
[RENDER #1] 🖼️ EntitySpecificInstancePage: office/{id}
[API FETCH] 📡 useEntityInstance: office/{id}
[CACHE HIT/MISS] 💾 useEntityInstance: office/{id}
4. Detail Page Form (EntityFormContainer)
[RENDER #1] 🖼️ EntityFormContainer {isEditing: false, hasEntityFormContainerMetadata: true}
[FIELDS] 📋 EntityFormContainer fields computed from BACKEND METADATA {fieldCount: 22}
5. Click Edit Button
[EDIT MODE] ✏️ Starting edit mode
[RENDER #2] 🖼️ EntityFormContainer {isEditing: true}
6. Typing in Form Fields
[FIELD CHANGE] ✍️ EntityFormContainer.handleFieldChange {fieldKey: 'descr', valueType: 'string'}
[FIELD CHANGE] ⏱️ Debounced update for descr (300ms)
7. Save Changes
[SAVE] 💾 handleSave called {dirtyFields: ['descr']}
Color Legend
Color	Meaning
🔴 Red #ff6b6b	API Fetch
🟢 Green #51cf66	Cache HIT / Backend metadata used
🟡 Yellow #fcc419	Cache MISS / Config fallback
🔵 Blue #748ffc	EntityListOfInstancesPage render
🟣 Purple #da77f2	EntitySpecificInstancePage render
🟢 Green #69db7c	EntityDataTable render
🟡 Gold #ffd43b	EntityFormContainer render
🔵 Cyan #74c0fc	Field change events



Check the below logs for above interaction, and spot any any issues. \
Find issuse if any! and list the issues only, don't fix but list the issue and propose solution. Don't fix. Where else might we have such issue? Write them. 

Reference documents: 
\docs/services/backend-formatter.service.md
docs/services/entity-infrastructure.service.md\









You are a Staff-level Advanced Software Engineer and Solutions Architect.
Your task is to produce crisp, concise, technically coherent documentation describing the final state of a system’s architecture, reusable design patterns, data/interaction flows, and page, component, route, service relationship, and more.

You are writing this documentation for another highly technical Staff Architect LLM agent.

Core Requirements

Document only the current, final state of the system.

If recent changes were made, identify which parts of existing documentation are now outdated.

Explicitly point out which documents must be updated and reflect those updates.

Do not include descriptions of old states.

Accurately assess and reflect the current truth of the system.

Understand all components, flows, and architectural patterns.

Produce coherent documentation that fully reflects how the system works now.

Documentation Structure
Follow this structure exactly when producing documentation:

Semantics & Business Context

Tooling & Framework Architecture (very short)

Architecture, Block Diagrams, Flow Diagrams

Crisp system diagrams

Step-by-step plumbing & system design explanation

Database, API & UI/UX Mapping (only if relevant)

Entity Relationships (only if .ddl has changed)

Central Configuration, Middleware, API Factory Pattern, Auth, Reusable Backend Blocks
(only if configuration/auth/middleware changed; do not include code)

User Interaction Flow Examples

Data flow diagram

API endpoints & route handlers

Component architecture

Critical Considerations for Developers

Short, technical, high-value guidance for extending or building the feature

Strictly NO long code or coding lines.

You MUST include:

Data Flow Diagram

System Design Diagram

Tooling Overview

Architecture Overview

Action Required

Update all referenced .md files accordingly.

Do not update this instruction file.

Ensure updates are coherent, structural, and reflect the current system state.

Formatting Constraints

No long code blocks.

No low-value explanations.

Only diagrams, architecture, flows, relationships, and high-level technical clarity.







critic: 
be super smart, and next generation expert and compare this approach with other advanced implementations, and rate my code, design pattern; critic and suggest:
1. Overall Rating & Executive Summary
  2. Architecture Analysis
    - Convention over Configuration
    - DRY principles
    - Type safety
    - Performance optimization
  3. Comparison with Industry Standards
    - React Query / TanStack Table
    - Headless UI patterns
    - Modern state management
    - Enterprise data grids (ag-Grid, MUI DataGrid)
  4. Strengths (what's done well)
  5. Weaknesses & Gaps (what's missing)
  6. Critical Issues (what needs immediate attention)
  7. Advanced Patterns Not Implemented
  8. Recommendations (concrete improvements)

  put the conent in featureadd/critic.md\
  \
  understand current state: \
  /home/rabin/projects/pmo/docs/core_algorithm_design_pattern.md
  /home/rabin/projects/pmo/docs/EntityDataTable.md 



  Now go on to reate api, and ui details for quote, product and service. Goal is to have same components reused, dry princple adhered, no much extra coding, but using existing
  template, You can refer to project/task and how it's done. \
  Design patterns strictly followed. \\
  don't read all of the docs below but grep search the content below and link the knowledge.
  /home/rabin/projects/pmo/docs/datatable/EntityDataTable.md\
  /home/rabin/projects/pmo/docs/s3_service\
  /home/rabin/projects/pmo/docs/styling_patterns.md\
  /home/rabin/projects/pmo/docs/datamodel/datamodel.md\
  /home/rabin/projects/pmo/docs/settings/settings.md 
────────────────────────────────────────────────────────