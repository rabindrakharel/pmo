# TaskDataContainer - Next-Gen Activity Feed

**Version:** 2.0.0 | **Location:** `apps/web/src/components/entity/task/TaskDataContainer.tsx` | **Updated:** 2025-12-03

---

## Overview

TaskDataContainer is the orchestrating component for the task activity feed, providing a Linear/Notion/Slack-inspired experience for comments, threading, reactions, file attachments, and form submissions.

**Core Principles:**
- Container/Presenter pattern - orchestrates child components
- Centralized state management for updates, replies, and filters
- API integration for all CRUD operations
- S3-based attachments (no base64)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  TASK ACTIVITY FEED ARCHITECTURE (v2.0)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     TaskDataContainer                                │    │
│  │                     (Orchestrator)                                   │    │
│  │                                                                      │    │
│  │  State:                                                              │    │
│  │  ├── updates: TaskUpdate[]       # All task updates                 │    │
│  │  ├── replies: Record<id, TaskUpdate[]>  # Threaded replies          │    │
│  │  ├── filter: 'all' | 'pinned' | 'unresolved'                        │    │
│  │  ├── replyingTo: string | null   # Current reply target             │    │
│  │  ├── employees: Employee[]       # For @mentions                    │    │
│  │  └── forms: Form[]               # For form submissions             │    │
│  │                                                                      │    │
│  │  Methods:                                                            │    │
│  │  ├── loadUpdates()               # GET /task/:id/data               │    │
│  │  ├── loadReplies(parentId)       # GET /task/:id/data/:id/replies   │    │
│  │  ├── handleSubmit(data)          # POST /task/:id/data              │    │
│  │  ├── handleReact(id, emoji)      # POST /task/:id/data/:id/react    │    │
│  │  ├── handlePin(id)               # PATCH /task/:id/data/:id/pin     │    │
│  │  └── handleResolve(id)           # PATCH /task/:id/data/:id/resolve │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│              ┌───────────────┼───────────────┐                              │
│              │               │               │                              │
│              ▼               ▼               ▼                              │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                   │
│  │ SmartComposer │  │ ThreadedComment│ │ FilterTabs    │                   │
│  │               │  │ (recursive)   │  │               │                   │
│  │ • Intent      │  │ • Avatar      │  │ • All         │                   │
│  │   detection   │  │ • Content     │  │ • Pinned      │                   │
│  │ • @mentions   │  │ • Attachments │  │ • Open        │                   │
│  │ • S3 upload   │  │ • Reactions   │  │               │                   │
│  │ • Time parse  │  │ • Actions     │  │               │                   │
│  └───────────────┘  │ • Replies     │  └───────────────┘                   │
│                     └───────────────┘                                       │
│                            │                                                │
│                            ▼                                                │
│                     ┌───────────────┐                                       │
│                     │ ReactionBar   │                                       │
│                     │               │                                       │
│                     │ • Display     │                                       │
│                     │ • Toggle      │                                       │
│                     │ • Picker      │                                       │
│                     └───────────────┘                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Hierarchy

```
TaskDataContainer
├── Header
│   ├── Title ("Activity Feed")
│   ├── Count badge
│   ├── Pinned count badge
│   └── FilterTabs (All | Pinned | Open)
│
├── SmartComposer (new comment)
│   └── Form toggle ("Submit a form instead")
│
├── PinnedSection (if filter = 'all' && pinnedUpdates.length > 0)
│   └── ThreadedComment × N
│       └── SmartComposer (if replying)
│
├── RegularUpdates
│   └── ThreadedComment × N
│       ├── ReactionBar
│       ├── Reply button → SmartComposer (inline)
│       └── Nested ThreadedComment (replies)
│
└── ImagePreviewModal (overlay)
```

---

## Props Interface

```typescript
interface TaskDataContainerProps {
  /** Task ID for API calls */
  taskId: string;

  /** Optional project ID for context */
  projectId?: string;

  /** Callback when update is posted */
  onUpdatePosted?: () => void;

  /** Public view mode (read-only, no compose) */
  isPublicView?: boolean;
}
```

---

## State Management

```typescript
// Data state
const [updates, setUpdates] = useState<TaskUpdate[]>([]);
const [loading, setLoading] = useState(true);
const [pinnedCount, setPinnedCount] = useState(0);
const [unresolvedCount, setUnresolvedCount] = useState(0);

// Reply state
const [replyingTo, setReplyingTo] = useState<string | null>(null);
const [replies, setReplies] = useState<Record<string, TaskUpdate[]>>({});
const [loadingReplies, setLoadingReplies] = useState<Record<string, boolean>>({});

// Filter state
const [filter, setFilter] = useState<'all' | 'pinned' | 'unresolved'>('all');

// Form submission state
const [showFormSelector, setShowFormSelector] = useState(false);
const [forms, setForms] = useState<any[]>([]);
const [selectedFormId, setSelectedFormId] = useState<string>('');
const [selectedForm, setSelectedForm] = useState<any>(null);

// @mentions
const [employees, setEmployees] = useState<Employee[]>([]);
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  COMPLETE DATA FLOW                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. COMPONENT MOUNT                                                          │
│  ─────────────────                                                          │
│  useEffect → loadUpdates() → GET /api/v1/task/:taskId/data                  │
│           → loadEmployees() → GET /api/v1/employee?limit=100                │
│                                                                              │
│  Response: {                                                                 │
│    data: TaskUpdate[],                                                       │
│    total: number,                                                            │
│    pinned_count: number,                                                     │
│    unresolved_count: number                                                  │
│  }                                                                           │
│                                                                              │
│  2. CREATE COMMENT                                                           │
│  ─────────────────                                                          │
│  SmartComposer.onSubmit → handleSubmit(data) →                              │
│    POST /api/v1/task/:taskId/data                                           │
│    Body: {                                                                   │
│      data_richtext: { ops: [...] },                                         │
│      update_type: "comment",                                                 │
│      hours_logged: 2.0,                                                      │
│      mentioned__employee_ids: ["uuid1"],                                     │
│      attachments: [{s3_bucket, s3_key, ...}],                               │
│      detected_intents_data: {...}                                           │
│    }                                                                         │
│  → loadUpdates() (refresh)                                                  │
│                                                                              │
│  3. CREATE REPLY                                                             │
│  ────────────────                                                           │
│  Same as CREATE but with task_data_id set to parent ID                      │
│  → loadUpdates() + loadReplies(parentId)                                    │
│                                                                              │
│  4. TOGGLE REACTION                                                          │
│  ─────────────────                                                          │
│  ReactionBar.onReact → handleReact(dataId, emoji) →                         │
│    POST /api/v1/task/:taskId/data/:dataId/react                             │
│    Body: { emoji: "thumbs_up" }                                             │
│  → loadUpdates() (refresh)                                                  │
│                                                                              │
│  5. TOGGLE PIN                                                               │
│  ────────────                                                               │
│  ThreadedComment.onPin → handlePin(dataId) →                                │
│    PATCH /api/v1/task/:taskId/data/:dataId/pin                              │
│  → loadUpdates() (refresh)                                                  │
│                                                                              │
│  6. TOGGLE RESOLVE                                                           │
│  ────────────────                                                           │
│  ThreadedComment.onResolve → handleResolve(dataId) →                        │
│    PATCH /api/v1/task/:taskId/data/:dataId/resolve                          │
│  → loadUpdates() (refresh)                                                  │
│                                                                              │
│  7. LOAD REPLIES                                                             │
│  ────────────                                                               │
│  ThreadedComment.onLoadReplies → loadReplies(parentId) →                    │
│    GET /api/v1/task/:taskId/data/:parentId/replies                          │
│  → setReplies({ ...prev, [parentId]: data })                                │
│                                                                              │
│  8. FILTER CHANGE                                                            │
│  ─────────────                                                              │
│  FilterTab click → setFilter('pinned') → useEffect → loadUpdates()          │
│  URL params: ?pinned_only=true OR ?unresolved_only=true                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/api/v1/task/:taskId/data` | GET | List updates | `?pinned_only` `?unresolved_only` | `{data, total, pinned_count, unresolved_count}` |
| `/api/v1/task/:taskId/data` | POST | Create update | `{data_richtext, hours_logged, ...}` | `TaskUpdate` |
| `/api/v1/task/:taskId/data/:id/replies` | GET | Get replies | - | `{data: TaskUpdate[]}` |
| `/api/v1/task/:taskId/data/:id/react` | POST | Toggle reaction | `{emoji}` | `{reactions_data, action}` |
| `/api/v1/task/:taskId/data/:id/pin` | PATCH | Toggle pin | - | `{pinned_flag, pinned_by, pinned_ts}` |
| `/api/v1/task/:taskId/data/:id/resolve` | PATCH | Toggle resolve | - | `{resolved_flag, resolved_by, resolved_ts}` |

---

## Database Schema (d_task_data)

```sql
CREATE TABLE app.d_task_data (
    id uuid PRIMARY KEY,
    task_id uuid NOT NULL,

    -- Threading
    task_data_id uuid,              -- Parent for replies (NULL = top-level)

    -- Core fields
    stage varchar(20),              -- draft, saved
    updated_by__employee_id uuid,
    data_richtext jsonb,            -- Quill Delta format
    update_type varchar(50),        -- comment, reply, status_change, form, time_entry
    hours_logged decimal(8,2),

    -- v2.0 Next-Gen fields
    mentioned__employee_ids uuid[],
    reactions_data jsonb,           -- {"emoji": ["uuid1", "uuid2"]}
    pinned_flag boolean,
    pinned_by__employee_id uuid,
    pinned_ts timestamptz,
    resolved_flag boolean,
    resolved_by__employee_id uuid,
    resolved_ts timestamptz,
    attachments jsonb,              -- [{s3_bucket, s3_key, filename, ...}]
    detected_intents_data jsonb,

    -- Temporal
    created_ts timestamptz,
    updated_ts timestamptz
);
```

---

## UI/UX Design

### Full Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  💬 Activity Feed  [5]  [📌 2 pinned]              [All] [Pinned] [Open (3)]│
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ [🕐 2h logged]  [@james]                                              │  │
│  │ ─────────────────────────────────────────────────────────────────────  │  │
│  │ Write an update... Use @name to mention, +2h for time logging         │  │
│  │ ─────────────────────────────────────────────────────────────────────  │  │
│  │ [📎]  [@]                                                    [Post]   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  📄 Submit a form instead                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  📌 Pinned                                                                   │
│  ────────────────────────────────────────────────────────────────────────   │
│  🔵 James Miller  •  2d ago  •  +3h  •  ✓ Resolved                          │
│  Important API documentation completed. See attached PDF.                    │
│  📄 api-docs.pdf (245 KB) ⬇️                                                │
│  [👍 3] [🚀 1]  [↩️ Reply]  [📌 Unpin]  [✓ Unresolve]                       │
│                                                                              │
│  ════════════════════════════════════════════════════════════════════════   │
│                                                                              │
│  🔵 Sarah Connor  •  5h ago                                                 │
│  Working on the frontend components for the new dashboard.                  │
│  CC @mike.jones for review.                                                  │
│  [👍 1]  [+]  [↩️ Reply]  [📌 Pin]  [✓ Resolve]                             │
│    💬 Show 2 replies                                                        │
│                                                                              │
│  ────────────────────────────────────────────────────────────────────────   │
│                                                                              │
│  🔵 Mike Jones  •  1h ago  •  +1.5h                                         │
│  Fixed the bug in authentication flow. Spent 1.5h debugging.               │
│  [👍 2]  [+]  [↩️ Reply]  [📌 Pin]  [✓ Resolve]                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Filter States

| Filter | API Query | Display |
|--------|-----------|---------|
| All | (no params) | Pinned section + Regular updates |
| Pinned | `?pinned_only=true` | Only pinned updates |
| Open | `?unresolved_only=true` | Only unresolved threads |

---

## Form Submission Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FORM SUBMISSION FLOW                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. User clicks "Submit a form instead"                                     │
│     └── setShowFormSelector(true)                                           │
│     └── loadForms() → GET /api/v1/task/:taskId/form                        │
│                                                                              │
│  2. User selects form from dropdown                                         │
│     └── handleFormSelect(formId)                                            │
│     └── GET /api/v1/form/:formId → setSelectedForm(data)                   │
│                                                                              │
│  3. User fills and submits InteractiveForm                                  │
│     └── handleFormSubmitSuccess(submissionData)                             │
│     └── POST /api/v1/form/:formId/submit                                   │
│     └── POST /api/v1/task/:taskId/data (type: 'form')                      │
│           Body: {                                                            │
│             update_type: 'form',                                             │
│             data_richtext: { ops: [{ insert: 'Form "X" submitted\n' }] },   │
│             metadata: {                                                      │
│               form_id, form_name, submission_id,                             │
│               submission_data, submission_timestamp                          │
│             }                                                                │
│           }                                                                  │
│     └── loadUpdates() (refresh)                                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Child Component Summary

| Component | File | Purpose | Props |
|-----------|------|---------|-------|
| **SmartComposer** | `SmartComposer.tsx` | Unified input with intent detection | `taskId, parentDataId, onSubmit, employees` |
| **ThreadedComment** | `ThreadedComment.tsx` | Single comment with threading | `update, onReact, onPin, onResolve, replies` |
| **ReactionBar** | `ReactionBar.tsx` | Emoji reactions display/picker | `reactions, onReact, currentUserId` |
| **InteractiveForm** | `../form/InteractiveForm.tsx` | Dynamic form rendering | `formId, fields, onSubmitSuccess` |

---

## Design Inspiration

| Feature | Source | Implementation |
|---------|--------|----------------|
| Smart Composer | Linear | Intent chips, @mentions, unified input |
| Threading | Slack | Collapse/expand, reply counts |
| Reactions | GitHub | Emoji picker, aggregated counts |
| Pinning | Notion | Pinned section at top |
| Resolution | Linear | Checkmark to close threads |
| Filters | Linear | All/Pinned/Open tabs |
| File Previews | Figma | Inline images, download links |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v2.0.0 | 2025-12-03 | Next-gen rewrite: threading, reactions, S3, SmartComposer |
| v1.0.0 | 2025-10 | Original implementation with base64 attachments |

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| [SmartComposer.md](./SmartComposer.md) | Unified input component |
| [ThreadedComment.md](./ThreadedComment.md) | Comment rendering with threading |
| [ReactionBar.md](./ReactionBar.md) | Emoji reactions |
| [MAIN_ENTITY_DATA_ENTITY_PATTERN.md](../design_pattern/MAIN_ENTITY_DATA_ENTITY_PATTERN.md) | Parent-child entity pattern |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
