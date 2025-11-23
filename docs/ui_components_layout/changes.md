 Updated 7 documentation files to reflect the architectural changes:

  | File                                                              | Changes
  |
  |-------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------
  |
  | docs/pages/PAGE_ARCHITECTURE.md                                   | Removed FilteredDataTable, EntityChildListPage sections; Updated to EntityDataTable + LabelsDataTable; Updated route patterns to /:id/*
  |
  | docs/ui_components_layout/Layout_Component_Architecture.md        | Removed FilteredDataTable from architecture diagrams; Updated component hierarchy; Updated data flow
  |
  | docs/instructionToLLM.md                                          | Updated logging examples to show EntityDataTable instead of FilteredDataTable
  |
  | docs/architecture/NAVIGATION_FLOW_ANALYSIS.md                     | Updated data flow diagrams to show direct EntityDataTable usage
  |
  | docs/pages/settings.md                                            | Renamed SettingsDataTable → LabelsDataTable references
  |
  | docs/product_services_quotes/ENTITY_ATTRIBUTE_INLINE_DATATABLE.md | Updated comparison tables and file structure
  |
  | docs/README.md                                                    | Updated keyword index for PAGE_ARCHITECTURE.md
  |

  Key Documentation Changes

  | Old Term                  | New Term                                           |
  |---------------------------|----------------------------------------------------|
  | FilteredDataTable         | EntityDataTable (used directly by pages)           |
  | EntityChildListPage       | Removed - child tabs render EntityDataTable inline |
  | SettingsDataTable         | LabelsDataTable                                    |
  | <Outlet /> for child tabs | Direct inline rendering                            |
  | Nested child routes       | Wildcard /:id/* pattern                            |

> What datatable is used in labels management in settings/ page? What datatable is used in listing entities instance in /office /project page? 

● DataTable Usage

  | Page                       | Route                                            | DataTable Component |
  |----------------------------|--------------------------------------------------|---------------------|
  | Labels/Settings Management | /setting/:category (e.g., /setting/projectStage) | LabelsDataTable     |
  | Entity Instance Lists      | /office, /project, /task, etc.                   | EntityDataTable     |

  Architecture

  DataTableBase (shared base)
  ├── EntityDataTable    → Dynamic schema, backend metadata-driven
  │                        Used by: EntityListOfInstancesPage, EntitySpecificInstancePage (child tabs)
  │
  └── LabelsDataTable    → Fixed schema (id, name, descr, parent_id, color_code)
                           Used by: SettingDetailPage (labels/datalabel management)

  Key Differences

  | Feature      | EntityDataTable                 | LabelsDataTable                                   |
  |--------------|---------------------------------|---------------------------------------------------|
  | Schema       | Dynamic (from backend metadata) | Fixed 5 columns                                   |
  | Columns      | Generated from metadata.fields  | Hardcoded: id, name, descr, parent_id, color_code |
  | Color badges | Via datalabel lookup            | Direct color_code field                           |
  | Drag reorder | No                              | Yes                                               |
  | Use case     | Entity instances                | Labels/datalabels                                 |

> EntityDataTable is used for both  Used by: EntityListOfInstancesPage, EntitySpecificInstancePage (child tabs), but in these 2 cases, In one case esp child tabs - we pass the parent to fetch the data?? How 
does it all work? 

● EntityDataTable Data Flow

  Both pages use EntityDataTable directly, but with different API endpoints:

  1. EntityListOfInstancesPage (/project)

  // Fetches ALL entities of type
  const { data, metadata } = useEntityInstanceList('project', {
    page: 1,
    pageSize: 100
  });
  // API: GET /api/v1/project

  <EntityDataTable
    data={data}
    metadata={metadata}
    // ...
  />

  2. EntitySpecificInstancePage Child Tabs (/project/:id/task)

  // Fetches entities FILTERED by parent
  const { data, metadata } = useEntityInstanceList('task', {
    page: 1,
    pageSize: 100,
    parent_code: 'project',    // ← Parent filter
    parent_id: id              // ← Parent UUID
  });
  // API: GET /api/v1/project/{id}/task

  <EntityDataTable
    data={data}           // Same component
    metadata={metadata}   // Same props structure
    // ...
  />

  Visual Flow

  ┌─────────────────────────────────────────────────────────────────┐
  │  EntityListOfInstancesPage (/project)                           │
  ├─────────────────────────────────────────────────────────────────┤
  │                                                                 │
  │  useEntityInstanceList('project', { page, pageSize })           │
  │           │                                                     │
  │           ▼                                                     │
  │  GET /api/v1/project                                            │
  │           │                                                     │
  │           ▼                                                     │
  │  EntityDataTable ← data, metadata                               │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────┐
  │  EntitySpecificInstancePage (/project/:id) → Child Tab: Tasks   │
  ├─────────────────────────────────────────────────────────────────┤
  │                                                                 │
  │  useEntityInstanceList('task', {                                │
  │    page, pageSize,                                              │
  │    parent_code: 'project',   // Filter param                    │
  │    parent_id: 'abc-123'      // Filter param                    │
  │  })                                                             │
  │           │                                                     │
  │           ▼                                                     │
  │  GET /api/v1/project/abc-123/task   (child entity endpoint)     │
  │           │                                                     │
  │           ▼                                                     │
  │  EntityDataTable ← data, metadata   (same component!)           │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘

  The Hook Handles It

  // useEntityInstanceList internally builds the correct URL:
  function useEntityInstanceList(entityCode, params) {
    const url = params.parent_code && params.parent_id
      ? `/api/v1/${params.parent_code}/${params.parent_id}/${entityCode}`  // Child endpoint
      : `/api/v1/${entityCode}`;  // Main endpoint

    // Both return same structure: { data, metadata, total }
  }

  Key Point

  EntityDataTable is dumb - it just renders whatever data and metadata it receives. The page is responsible for:
  1. Determining the context (main list vs child tab)
  2. Calling the hook with appropriate params
  3. Passing data to EntityDataTable
