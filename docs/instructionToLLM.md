Modern uiux design principles around these concepts below that are production grade and robust, industry pioneers using it. 
Brainstorm and provide next generation, innovative design pattern here. 
Don't fix my code but propose a design, solution so I may review and approve. 
-----------------------------------------------------------------------------------------------------------------------


Check the below logs for above interaction, and spot any any issues and do RCA (Root cause analysis).
Keep analysing until you can be confident of the root cause, Then go on to propose the solution. 
Don't make the changes, but do proper issue identification, RCA and suggest resolution. Also mention why this issue occured? 
How can we prevent in the future? Where else might we have such issue? Write them. 

Reference documents: 
\docs/services/entity-component-metadata.service.md
docs/services/entity-infrastructure.service.md\
------------------------------------------------------------------------------------------------------------------------


What's the industry trend, 
be super smart, and next generation expert, who is going to propose future implementation with changes over existing state indepth about modern industry engineering trends, and how industry pioneers have solved this problem, 
Be extra smart and understand how to find a solution that's not a band-aid shim solution, but production grade robust and scalable, yet achieves the outcome and business needs not compromised. Compare existing approach with future  implementations, how to resolve it coherently? 

-------------------------------------------------------------

Login page → Login
Sidebar → Click "Office"
EntityListOfInstancesPage (Office list with data table) → EntityListOfInstancesTable component
Click first row → Navigate to specific office
EntitySpecificInstancePage (Office detail) → EntityInstanceFormContainer component
Click Edit → Edit mode

Signed in, went to his page: http://localhost:5173/welcome, Clicked on office button in sidebar, went to page http://localhost:5173/office, clicked on first record in data table, 
http://localhost:5173/office/f3f1d494-a334-49cc-aa23-540f8b59da5f

Navigation Flow Logging Summary
1. Sidebar → Office List (EntityListOfInstancesPage)
[RENDER #1] 🖼️ EntityListOfInstancesPage: office
2. Office List Data Table (EntityListOfInstancesTable)
[RENDER #1] 🖼️ EntityListOfInstancesTable: office
[API FETCH] 📡 useEntityInstanceList.fetchData: office
[API FETCH] ✅ EntityListOfInstancesTable received X items
3. Click Row → Navigate to Detail (EntitySpecificInstancePage)
[NAVIGATION] 🚀 Row clicked - navigating to detail page
[RENDER #1] 🖼️ EntitySpecificInstancePage: office/{id}
[API FETCH] 📡 useEntityInstance: office/{id}
[CACHE HIT/MISS] 💾 useEntityInstance: office/{id}
4. Detail Page Form (EntityInstanceFormContainer)
[RENDER #1] 🖼️ EntityInstanceFormContainer {isEditing: false, hasEntityInstanceFormContainerMetadata: true}
[FIELDS] 📋 EntityInstanceFormContainer fields computed from BACKEND METADATA {fieldCount: 22}
5. Click Edit Button
[EDIT MODE] ✏️ Starting edit mode
[RENDER #2] 🖼️ EntityInstanceFormContainer {isEditing: true}
6. Typing in Form Fields
[FIELD CHANGE] ✍️ EntityInstanceFormContainer.handleFieldChange {fieldKey: 'descr', valueType: 'string'}
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
🟢 Green #69db7c	EntityListOfInstancesTable render
🟡 Gold #ffd43b	EntityInstanceFormContainer render
🔵 Cyan #74c0fc	Field change events


 The issue or the problem that was communicated to you through PROMPT and what you found out and how you solved it and how it must be solved all together as a design pattern,
  please put that together for both cases. We want to be consistent with our design pattern for entity list of instances table and entity instance form container. We want to
  be consistent with our design pattern on both. Is there a industry, innovative, robust design pattern to solve this issue? Holistically and putting everything together,
  regressively not breaking other features. We don't want to hardcode or create a band aid solution but a standard one.
  Critic if the design pattern will break anything?  
What's the industry standard robust engineered fix, not band aid solution?






With all the changes made,  
Search through to find out any legacy, backward compatibility code, or fallback logic that needs to be cleaned up, to strictly adhere to current state standards. What are the parts you want to remove? How do you plan on how updating these document and which part? Show me your action plan. 







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
  /home/rabin/projects/pmo/docs/EntityListOfInstancesTable.md 



  Now go on to reate api, and ui details for quote, product and service. Goal is to have same components reused, dry princple adhered, no much extra coding, but using existing
  template, You can refer to project/task and how it's done. \
  Design patterns strictly followed. \\
  don't read all of the docs below but grep search the content below and link the knowledge.
  /home/rabin/projects/pmo/docs/datatable/EntityListOfInstancesTable.md\
  /home/rabin/projects/pmo/docs/s3_service\
  /home/rabin/projects/pmo/docs/styling_patterns.md\
  /home/rabin/projects/pmo/docs/datamodel/datamodel.md\
  /home/rabin/projects/pmo/docs/settings/settings.md
────────────────────────────────────────────────────────

## Feature Design Thought Process

When designing a new feature that touches multiple layers (DB, API, Frontend), follow this systematic approach:

### Phase 1: Understand the User's Intent
- [ ] What is the user trying to accomplish?
- [ ] What are the possible outcomes or user choices?
- [ ] What data/tables are affected by each outcome?
- [ ] What is the scope? (Single entity, parent-child, cross-entity)

### Phase 2: Analyze Existing Patterns
- [ ] **Check CLAUDE.md** - Does a similar pattern exist? (CRUD, RBAC, linking, sharing)
- [ ] **Check entity-infrastructure.service.ts** - What transactional methods exist?
- [ ] **Check universal-entity-crud-factory.ts** - How are similar endpoints structured?
- [ ] **Search for similar components** - Grep for modal patterns, handlers, hooks
- [ ] **Check pattern-mapping.yaml** - How are similar field types handled?

### Phase 3: Identify Coherence Points
Navigate and verify each layer:

**Backend:**
1. **Infrastructure Service** (`entity-infrastructure.service.ts`)
   - Does a method already exist for this operation?
   - What parameters does it need?
   - Is it transactional (multi-table)?

2. **API Endpoints** (`universal-entity-crud-factory.ts`, module routes)
   - How are similar endpoints structured?
   - What query parameters are used?
   - What does the SELECT return? Is new data needed?

3. **RBAC Patterns**
   - What permission level makes sense for this operation?
   - Check existing similar endpoints for precedent
   - Document the permission rationale

4. **YAML Pattern Detection** (`pattern-mapping.yaml`, `view-type-mapping.yaml`, `edit-type-mapping.yaml`)
   - How will new fields be typed?
   - Should field be visible or hidden in UI?

**Frontend:**
5. **Component Props**
   - What props exist for similar operations?
   - How is context/state passed from parent?

6. **Page Integration**
   - How are handlers wired to child components?
   - What context is available at each level?

7. **State Management**
   - What TanStack Query hooks exist?
   - What cache keys need invalidation?

### Phase 4: Identify Conflicts & Coherence Issues
- [ ] **API Response Gap** - Does the endpoint return all needed data?
- [ ] **RBAC Mismatch** - Does existing code use different permission than intended?
- [ ] **Multiple Patterns** - Are there conflicting approaches in the codebase?
- [ ] **UI Visibility** - Do new fields need YAML config to show/hide?
- [ ] **Breaking Changes** - Will this affect existing functionality?

### Phase 5: Document Before Implementing
Create documentation in appropriate location:
- **UI/UX Spec**: `docs/ui_components/{ComponentName}.md`
- **Design Pattern**: Section in `docs/design_pattern/FRONTEND_DESIGN_PATTERN.md`
- **LLM Reference**: Update `CLAUDE.md` with new pattern
- **Service Docs**: Update `docs/services/` if new methods added

### Phase 6: Implementation Checklist Structure
Organize by layer with priority:

| Priority | Layer | Category | Action |
|----------|-------|----------|--------|
| HIGH | Backend | API Response | Add missing fields to SELECT |
| HIGH | Backend | YAML Config | Add field → fieldBusinessType mapping |
| HIGH | Backend | Endpoint | Add new route handler |
| MEDIUM | Backend | Service | Add helper methods |
| HIGH | Frontend | Component | Create/modify component |
| MEDIUM | Frontend | Page | Wire handlers and props |
| LOW | Docs | Reference | Update CLAUDE.md, design patterns |

### Key Files to Check for Any Entity Feature
```
Backend:
├── CLAUDE.md                                    # LLM reference, patterns
├── apps/api/src/services/
│   ├── entity-infrastructure.service.ts         # Transactional CRUD
│   ├── pattern-mapping.yaml                     # Column → fieldBusinessType
│   ├── view-type-mapping.yaml                   # View rendering config
│   └── edit-type-mapping.yaml                   # Edit input config
├── apps/api/src/lib/
│   └── universal-entity-crud-factory.ts         # API endpoint factory
└── apps/api/src/modules/{entity}/
    └── routes.ts                                # Entity-specific endpoints

Frontend:
├── apps/web/src/components/shared/ui/
│   └── EntityListOfInstancesTable.tsx           # Data table component
├── apps/web/src/pages/shared/
│   └── EntitySpecificInstancePage.tsx           # Detail page with child tabs
├── apps/web/src/components/shared/entity/
│   └── DynamicChildEntityTabs.tsx               # Child entity tab container
└── apps/web/src/db/tanstack-hooks/
    └── *.ts                                     # TanStack Query hooks

Documentation:
├── docs/ui_components/                          # UI component specs
├── docs/design_pattern/                         # Architecture patterns
├── docs/services/                               # Service documentation
└── docs/rbac/                                   # Permission patterns
```

### Questions to Ask Before Implementation
1. **Same component, different behavior?** → Use props/context to conditionally render
2. **New field in API response?** → Check SELECT clause, add YAML config
3. **Hidden from UI?** → Use `systemInternal_*` fieldBusinessType pattern
4. **RBAC required?** → Check permission level, document rationale
5. **Affects multiple tables?** → Use transactional methods from entity-infrastructure.service
6. **Similar pattern exists?** → Reuse existing modal/component patterns
7. **Cache invalidation needed?** → Identify TanStack Query keys to invalidate
8. **Breaking existing behavior?** → Create NEW endpoint vs modifying existing

────────────────────────────────────────────────────────