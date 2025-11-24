 End-to-End Dataflow for Datalabel Visualization

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                    PHASE 1: DATABASE & SCHEMA                                │
  └─────────────────────────────────────────────────────────────────────────────┘

  1. Database Tables

     app.project                          datalabel_project_stage
     ├── id: UUID                         ├── id: UUID
     ├── dl__project_stage: VARCHAR ────→ ├── code: VARCHAR (e.g., 'planning')
     └── ...other fields                  ├── label: VARCHAR ('Planning')
                                          ├── parent_id: UUID (hierarchy)
                                          ├── color_code: VARCHAR ('blue')
                                          └── display_order: INT


  ┌─────────────────────────────────────────────────────────────────────────────┐
  │              PHASE 2: API METADATA GENERATION (BACKEND)                      │
  └─────────────────────────────────────────────────────────────────────────────┘

  2. Pattern Detection (backend-formatter.service.ts:1577)
     
     Field Name: "dl__project_stage"
         ↓
     pattern-mapping.yaml:163 → { pattern: "dl__*", fieldBusinessType: "datalabel" }
         ↓
     Generates YAML-based metadata


  3. YAML Metadata Generation (backend-formatter.service.ts:1621-1629)

     ┌─────────────────────────────────────────────────────────────┐
     │ if (fieldName.startsWith('dl__')) {                         │
     │   yamlMetadata.datalabelKey = fieldName;  ← Datalabel key  │
     │   yamlMetadata.loadFromDataLabels = true;                  │
     │                                                             │
     │   if (component === 'entityFormContainer') {               │
     │     yamlMetadata.EntityFormContainer_viz_container =       │
     │       'DAGVisualizer';  ← ✨ DAG visualization trigger     │
     │   }                                                         │
     │ }                                                           │
     └─────────────────────────────────────────────────────────────┘


  4. API Response Structure (GET /api/v1/project/:id)
     
     {
       "data": { "dl__project_stage": "planning" },  ← Raw value
       "metadata": {
         "entityFormContainer": {
           "dl__project_stage": {
             "dtype": "str",
             "format": "datalabel",
             "viewType": "datalabel",
             "editType": "select",
             "datalabelKey": "dl__project_stage",
             "loadFromDataLabels": true,
             "EntityFormContainer_viz_container": "DAGVisualizer"  ← 🎯 KEY FIELD
           }
         }
       }
     }


  ┌─────────────────────────────────────────────────────────────────────────────┐
  │            PHASE 3: LOGIN-TIME CACHING (FRONTEND - v8.2.0)                   │
  └─────────────────────────────────────────────────────────────────────────────┘

  5. Datalabel Cache (AuthContext.tsx + useDatalabelMetadataStore)
     
     User logs in
         ↓
     GET /api/v1/datalabels/all  ← Fetch ALL datalabels once
         ↓
     {
       "project_stage": [
         { code: "planning", label: "Planning", parent_id: null, 
           color_code: "blue", display_order: 1 },
         { code: "execution", label: "Execution", parent_id: "planning", 
           color_code: "green", display_order: 2 }
       ]
     }
         ↓
     localStorage.setItem('datalabel_cache', JSON.stringify(data))
     TTL: 1 hour


  ┌─────────────────────────────────────────────────────────────────────────────┐
  │          PHASE 4: FRONTEND RENDERING - VIEW MODE (DAG)                       │
  └─────────────────────────────────────────────────────────────────────────────┘

  6. EntityFormContainer.tsx (View Mode - Lines 141-147)
     
     Field metadata arrives from API:
     {
       "EntityFormContainer_viz_container": "DAGVisualizer",  ← Detected
       "datalabelKey": "dl__project_stage",
       "viewType": "datalabel"
     }
         ↓
     ┌──────────────────────────────────────────────────────────┐
     │ let vizContainer = fieldMeta.EntityFormContainer_viz_    │
     │                    container;                            │
     │                                                          │
     │ if (!vizContainer &&                                     │
     │     (fieldMeta.viewType === 'dag' ||                     │
     │      fieldMeta.format === 'dag')) {                      │
     │   vizContainer = 'DAGVisualizer';  ← Fallback           │
     │ }                                                        │
     └──────────────────────────────────────────────────────────┘
         ↓
     vizContainer === 'DAGVisualizer' ? true


  7. DAGVisualizer Component (DAGVisualizer.tsx)
     
     Props:
     - value: "planning"  ← Current stage
     - datalabelKey: "dl__project_stage"
         ↓
     useDatalabelMetadataStore.getState().getDatalabels('project_stage')
         ↓
     Builds hierarchy tree from parent_id relationships
         ↓
     ┌───────────────────────────────────────────────────────────┐
     │   ○────→○────→●────→○────→○                              │
     │   Initiation → Planning → Execution → Monitoring → Closed │
     │                           (current)                       │
     └───────────────────────────────────────────────────────────┘
         ↓
     Renders nodes with:
     - Solid fill for current stage
     - Arrows for workflow progression
     - Colors from color_code field


  ┌─────────────────────────────────────────────────────────────────────────────┐
  │        PHASE 5: FRONTEND RENDERING - EDIT MODE (COLORED DROPDOWN)            │
  └─────────────────────────────────────────────────────────────────────────────┘

  8. EntityFormContainer.tsx (Edit Mode - Lines 620-672)
     
     Field metadata:
     {
       "editType": "select",
       "datalabelKey": "dl__project_stage",
       "loadFromDataLabels": true
     }
         ↓
     Fetches labels from cache:
     useDatalabelMetadataStore.getState().getDatalabels('project_stage')
         ↓
     hasLabelsMetadata && options.length > 0 ? true
         ↓
     ┌──────────────────────────────────────────────────────────┐
     │ const coloredOptions = options.map((opt) => ({          │
     │   value: opt.value,                                     │
     │   label: opt.label,                                     │
     │   metadata: {                                           │
     │     color_code: opt.colorClass  ← 'bg-blue-100 text-    │
     │                                    blue-700'            │
     │   }                                                     │
     │ }));                                                    │
     │                                                         │
     │ return <ColoredDropdown                                │
     │   options={coloredOptions}                             │
     │   onChange={handleFieldChange}                         │
     │ />;                                                     │
     └──────────────────────────────────────────────────────────┘


  9. ColoredDropdown Component (ColoredDropdown.tsx)
     
     Renders portal-based dropdown with:
         ↓
     ┌────────────────────────────────────────────────┐
     │ Project Stage ▼                                │
     ├────────────────────────────────────────────────┤
     │ Planning (selected)                            │
     │ ╔══════════════════════════════════════════╗   │
     │ ║ ● Planning                               ║   │
     │ ║ ● Execution                              ║   │
     │ ║ ● Monitoring                             ║   │
     │ ║ ● Closed                                 ║   │
     │ ╚══════════════════════════════════════════╝   │
     └────────────────────────────────────────────────┘
     
     Each option renders as badge with color from metadata.color_code


  ┌─────────────────────────────────────────────────────────────────────────────┐
  │              PHASE 6: ENTITYDATATABLE INLINE EDIT                            │
  └─────────────────────────────────────────────────────────────────────────────┘

  10. EntityDataTable Inline Edit (EntityDataTable.tsx:1736, 1945)
      
      Inline edit mode triggered
          ↓
      renderEditModeFromMetadata(value, fieldMeta, onChange)
          ↓
      frontEndFormatterService.tsx detects:
      - fieldMeta.editType === 'select'
      - fieldMeta.loadFromDataLabels === true
          ↓
      Renders ColoredDropdown (same as EntityFormContainer edit mode)


  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                    SUMMARY: KEY INTEGRATION POINTS                           │
  └─────────────────────────────────────────────────────────────────────────────┘

  ✅ FIXES APPLIED:

  1. Backend: Added `EntityFormContainer_viz_container: 'DAGVisualizer'` 
     - File: backend-formatter.service.ts:1626-1628
     - Triggers DAG visualization in view mode

  2. Frontend (EntityFormContainer): Check for `EntityFormContainer_viz_container`
     - File: EntityFormContainer.tsx:141-147
     - Detects which visualization component to use

  3. Frontend (EntityFormContainer): ColoredDropdown in edit mode
     - File: EntityFormContainer.tsx:620-672
     - Replaces plain select with colored badge dropdown

  4. TypeScript Interface: Added field definition
     - File: backend-formatter.service.ts:110
     - `EntityFormContainer_viz_container?: 'DAGVisualizer' | 'MetadataTable' | string;`


  🎯 CACHE ARCHITECTURE (v8.2.0):

  - Login-time: All datalabels fetched once, cached for 1 hour
  - Format-at-read: Raw data cached, formatted on-read using React Query select
  - Zero network calls: Dropdown options read from localStorage cache
  - Instant updates: Datalabel color changes reflected immediately (reformatted on read)

  Testing URLs

  1. View Mode (DAG): http://localhost:5173/project/93b05234-f0b1-4d23-87f2-9b6fd901018d
    - Project Stage field should show workflow visualization with nodes
  2. Edit Mode (Colored Dropdown): Same URL, click "Edit" button
    - Project Stage dropdown should show colored badge options
  3. Inline Edit (EntityDataTable): http://localhost:5173/project
    - Click edit icon on any row, Project Stage should show colored dropdown

  All three issues are now fixed! 🎉


  The data table for employees under the role is not showing up correct formatting, but the data table for role is showing me the correct formatting, especially for updated, created. We must have entity data table and the exact design pattern reused for every single data table, be it the child data table or the entity data table. There is still the entity data table. So for the parent component or the child component, the same data table must show up with the correct props in the similar desired behavior. Please work on this and fix these issues. For entity data, for form container, entity form container, there is a page. That page will have the React query and then there's some data casting, then there's some juice stand casting for metadata. So the overview tab will show up all the all the information about a particular parent entity. But when we click the child entity, there's where the props will be passed and it will fetch the, it performs some fetch. And that fetch must still go into the CAS. And the CAS key for that should be that the CAS key for that must be the same thing as the other one. Like it will be slash role, slash the role ID and then slash employee. So the CAS key must exactly tell us what it is, right? And depending on the CAS key, it must be cast or, you know, it should also support the optimistic update. And the employee under role must show the correct formatting is showing for the role. It should all be seamless. The same design must be there everywhere. Design must be there everywhere.