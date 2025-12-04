# EntitySpecificInstancePage

**Version:** 9.7.0 | **Location:** `apps/web/src/pages/shared/EntitySpecificInstancePage.tsx` | **Updated:** 2025-12-03

---

## Overview

EntitySpecificInstancePage is the universal detail page that renders the detail/edit view for ANY entity type in the system. It's one of the "3 Universal Pages" that power the entire application, providing entity viewing, editing, child entity tabs, and file handling.

**Core Principles:**
- Single component renders 27+ entity types
- Two-query architecture (metadata + data separation)
- Dexie draft persistence with undo/redo
- Optimistic mutations for instant UI feedback
- Dynamic child entity tabs via DynamicChildEntityTabs

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 ENTITYSPECIFICINSTANCEPAGE ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Route: /{entityCode}/{id}  (e.g., /project/abc-123, /task/def-456)         │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                          Layout Shell                                    ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Header: [Exit] Entity Name [Edit|Save|Cancel] [Share] [Link]       │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  DynamicChildEntityTabs                                             │││
│  │  │  [Overview] [Tasks (5)] [Team (3)] [Documents (2)]                  │││
│  │  │  ═══════════                                                        │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Content Area (based on selected tab)                               │││
│  │  │                                                                     │││
│  │  │  Overview Tab → EntityInstanceFormContainer                         │││
│  │  │  Child Tab   → EntityListOfInstancesTable (filtered by parent)      │││
│  │  │  Wiki Entity → WikiContentRenderer                                  │││
│  │  │  Form Entity → FormDataTable / FormSubmissionEditor                 │││
│  │  │  Artifact    → FilePreview + DragDropFileUpload                     │││
│  │  │                                                                     │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Props Interface

```typescript
interface EntitySpecificInstancePageProps {
  /** Entity type code (e.g., 'project', 'task', 'employee') */
  entityCode: string;
}
```

---

## Key Features

### 1. Two-Query Architecture (v9.6.0)

```typescript
// Query 1: Entity Data (5-min cache)
const {
  data: rawData,
  refData,
  isLoading,
  refetch,
} = useEntity(entityCode, id);

// Query 2: Metadata (30-min cache via content=metadata API)
const {
  viewType: formViewType,
  editType: formEditType,
  isLoading: metadataLoading,
} = useEntityInstanceMetadata(entityCode, 'entityInstanceFormContainer');
```

### 2. Dexie Draft Persistence (v9.0.0)

```typescript
// Drafts persist across page refresh and browser restart
const {
  hasDraft: isEditing,
  currentData: editedData,
  dirtyFields,
  hasChanges,
  startEdit: startDraft,
  updateField: updateDraftField,
  discardDraft,
  getChanges,
  undo, redo,
  canUndo, canRedo,
} = useDraft(entityCode, id);
```

### 3. Optimistic Mutations (v9.5.0)

```typescript
// Instant UI feedback with automatic rollback on error
const { updateEntity: optimisticUpdateEntity } = useOptimisticMutation(entityCode, {
  onError: (error) => {
    setSaveError(error.message);
    alert(`Operation failed: ${error.message}`);
  },
});
```

### 4. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save changes |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Escape` | Cancel editing |

### 5. Dynamic Child Entity Tabs

```typescript
// Fetched from API based on entity.child_entity_codes
const { tabs, loading: tabsLoading } = useDynamicChildEntityTabs(entityCode, id || '');

// Child data fetched when on child tab
const {
  data: childData,
  refData: childRefData,
  total: childTotal,
} = useEntityInstanceData(
  currentChildEntity || '',
  childQueryParams,
  { enabled: shouldFetchChildData }
);
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  DATA FLOW                                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Route Match: /project/abc-123 → entityCode="project", id="abc-123"      │
│                                                                              │
│  2. Parallel Queries:                                                        │
│     useEntity('project', 'abc-123') → Raw data + refData                    │
│     useEntityInstanceMetadata('project', 'entityInstanceFormContainer')     │
│     useDynamicChildEntityTabs('project', 'abc-123') → Child tabs            │
│                                                                              │
│  3. Format on Read:                                                         │
│     formatRow(rawData, formMetadata, refData) → FormattedRow                │
│                                                                              │
│  4. Render Overview:                                                         │
│     <EntityInstanceFormContainer                                             │
│       data={editedData || rawData}                                          │
│       formattedData={formattedData}                                         │
│       metadata={{ viewType, editType }}                                     │
│     />                                                                       │
│                                                                              │
│  5. Edit Flow:                                                               │
│     startDraft() → updateDraftField() → getChanges() →                      │
│     optimisticUpdateEntity() → discardDraft()                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Entity-Specific Handling

| Entity | Special Features |
|--------|------------------|
| `wiki` | WikiContentRenderer (Notion-style block editor) |
| `form` | FormDataTable + FormSubmissionEditor |
| `artifact` | FilePreview + DragDropFileUpload |
| `email_template` | EmailTemplateRenderer |
| `task` | TaskDataContainer |

---

## Modals

| Modal | Trigger | Purpose |
|-------|---------|---------|
| ShareModal | Share button | Share entity with users/roles |
| UnifiedLinkageModal | Link button | Manage parent/child relationships |

---

## Related Components

| Component | Relationship |
|-----------|--------------|
| [Layout](./Layout.md) | Application shell |
| [DynamicChildEntityTabs](./DynamicChildEntityTabs.md) | Tab navigation |
| [EntityInstanceFormContainer](./EntityInstanceFormContainer.md) | Form rendering |
| [EntityListOfInstancesTable](./EntityListOfInstancesTable.md) | Child entity table |
| [ShareModal](./ShareModal.md) | Entity sharing |
| [UnifiedLinkageModal](./UnifiedLinkageModal.md) | Linkage management |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v9.7.0 | 2025-12-03 | Child entity metadata separation (two-query) |
| v9.6.0 | 2025-11-30 | useEntityInstanceMetadata for form metadata |
| v9.5.0 | 2025-11-28 | Optimistic mutations for instant feedback |
| v9.0.0 | 2025-11-26 | Dexie draft + TanStack Query migration |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
