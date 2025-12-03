# SmartComposer Component

**Version:** 2.1.0 | **Location:** `apps/web/src/components/entity/task/SmartComposer.tsx` | **Updated:** 2025-12-03

---

## Overview

SmartComposer is a unified input component for the task activity feed inspired by Linear, Notion, Slack, and GitHub. It provides intelligent intent detection, @mentions autocomplete, S3 file uploads, and time entry parsing in a single composable input.

**Core Principles:**
- Unified input for all activity types (comments, time entries, file uploads)
- Auto-detect intents from text (time: `+2h`, mentions: `@name`)
- S3-based file attachments (replaces base64 encoding)
- Real-time intent chips for user feedback

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SMARTCOMPOSER ARCHITECTURE (v2.0)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         User Input                                   │    │
│  │  "Spent 2h on API integration. CC @james.miller for review"         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Intent Detection Engine                           │    │
│  │                                                                      │    │
│  │  TIME PATTERNS:                                                      │    │
│  │  ├── /\+?(\d+(?:\.\d+)?)\s*h(?:ours?)?/gi  → hours                  │    │
│  │  └── /\+?(\d+(?:\.\d+)?)\s*m(?:in)?/gi     → minutes                │    │
│  │                                                                      │    │
│  │  MENTION PATTERN:                                                    │    │
│  │  └── /@(\w+(?:\.\w+)*)/g                   → employee names         │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Detected Intent Chips                             │    │
│  │                                                                      │    │
│  │  ┌──────────────┐  ┌──────────────┐                                 │    │
│  │  │ 🕐 2h logged │  │ @ james      │  ← Visual feedback chips        │    │
│  │  └──────────────┘  └──────────────┘                                 │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         onSubmit Payload                             │    │
│  │  {                                                                   │    │
│  │    content: "Spent 2h on API...",                                   │    │
│  │    hoursLogged: 2.0,                                                │    │
│  │    mentionedEmployeeIds: ["uuid-james"],                            │    │
│  │    attachments: [{s3_bucket, s3_key, filename, ...}],               │    │
│  │    detectedIntents: { time_entry: {hours: 2}, mentions: [...] }     │    │
│  │  }                                                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Props Interface

```typescript
interface SmartComposerProps {
  /** Task ID for S3 upload path */
  taskId: string;

  /** Parent task_data_id for threaded replies (null = top-level) */
  parentDataId?: string | null;

  /** Callback when user submits */
  onSubmit: (data: {
    content: string;
    hoursLogged?: number;
    attachments: S3Attachment[];
    mentionedEmployeeIds: string[];
    detectedIntents: Record<string, any>;
  }) => Promise<void>;

  /** Cancel callback (for reply mode) */
  onCancel?: () => void;

  /** Placeholder text */
  placeholder?: string;

  /** Disable input */
  disabled?: boolean;
}

// Note: Employee data is fetched internally via useRefDataEntityInstanceOptions('employee')
// This provides cached TanStack Query data with automatic revalidation

interface S3Attachment {
  s3_bucket: string;
  s3_key: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  uploaded_by__employee_id: string;
  uploaded_ts: string;
}
```

---

## Key Features

### 1. Time Entry Detection

Automatically parses time entries from natural text:

```typescript
const TIME_PATTERNS = [
  { regex: /\+?(\d+(?:\.\d+)?)\s*h(?:ours?)?/gi, unit: 'hours' },
  { regex: /\+?(\d+(?:\.\d+)?)\s*m(?:in(?:utes?)?)?/gi, unit: 'minutes' },
];

// Examples:
// "+2h" → 2.0 hours
// "30m" → 0.5 hours
// "1.5 hours" → 1.5 hours
// "2h 30m" → 2.5 hours (cumulative)
```

### 2. @Mention Autocomplete (Cached via TanStack Query)

```
┌────────────────────────────────────────────┐
│ Working on task CC @ja                     │
│ ┌────────────────────────────────────────┐ │
│ │ 🔵 James Miller                        │ │
│ │ 🔵 Jane Smith                          │ │
│ │ 🔵 Jacob Brown                         │ │
│ └────────────────────────────────────────┘ │
└────────────────────────────────────────────┘
```

**Data Source:**
```typescript
// Uses cached entity instance names via TanStack Query
const { options, lookup, isLoading } = useRefDataEntityInstanceOptions('employee');
// options = [{ value: uuid, label: name }, ...]
// lookup  = { uuid: name, ... }
```

**Features:**
- Triggered by `@` key
- Uses TanStack Query cached employee data (5-min stale time)
- Shows loading state while fetching
- Filters by name match (up to 8 results)
- Inserts mention in markdown link format: `@[Name](uuid)`
- UUIDs are embedded in content for reliable resolution on submit

**Mention Format:**
```
Input:  @[James Miller](8260b1b0-5efc-4611-ad33-ee76c0cf7f13)
Stored: Same format in data_richtext
Parsed: parseMentionIds() extracts UUIDs for mentionedEmployeeIds array
```

### 3. S3 File Upload

Uses `useS3Upload` hook for presigned URL uploads:

```typescript
const { uploadToS3, uploadingFiles, uploadProgress } = useS3Upload();

// Upload flow:
// 1. User drops/selects file
// 2. uploadToS3() gets presigned URL from API
// 3. Direct upload to S3
// 4. Store {s3_bucket, s3_key} reference in payload
```

### 4. Drag-and-Drop

```typescript
<div
  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
  onDragLeave={() => setDragOver(false)}
  onDrop={handleDrop}
>
  {dragOver && (
    <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed">
      Drop files here
    </div>
  )}
</div>
```

---

## Request Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SMARTCOMPOSER REQUEST FLOW                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. USER TYPES: "Fixed bug +2h @sarah"                                      │
│     └── useEffect detects intents → chips appear: [🕐 2h] [@sarah]          │
│                                                                              │
│  2. USER DROPS FILE: design.png                                             │
│     └── uploadToS3({ entityCode: 'task_data', file, ... })                  │
│     └── Returns: s3_key = "task-data/{taskId}/design.png"                   │
│                                                                              │
│  3. USER CLICKS "Post"                                                       │
│     └── handleSubmit()                                                       │
│         ├── parseTimeEntries(content) → 2.0                                 │
│         ├── parseMentions(content) → ["sarah"]                              │
│         ├── Map mention names → employee UUIDs                              │
│         └── onSubmit({                                                       │
│               content: "Fixed bug +2h @sarah",                               │
│               hoursLogged: 2.0,                                              │
│               attachments: [{s3_bucket, s3_key, ...}],                       │
│               mentionedEmployeeIds: ["uuid-sarah"],                          │
│               detectedIntents: { time_entry: {hours: 2}, mentions: [...] }   │
│             })                                                               │
│                                                                              │
│  4. PARENT COMPONENT (TaskDataContainer):                                    │
│     └── POST /api/v1/task/:taskId/data                                      │
│         Body: {                                                              │
│           data_richtext: {ops: [{insert: "Fixed bug..."}]},                 │
│           hours_logged: 2.0,                                                 │
│           mentioned__employee_ids: ["uuid-sarah"],                           │
│           attachments: [{s3_bucket, s3_key, ...}],                          │
│           detected_intents_data: {...}                                       │
│         }                                                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## UI/UX Design

### Normal Mode (Top-Level Comment)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [🕐 2h logged]  [@james]                          ← Detected intent chips  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Worked on the API integration for 2h with @james...                        │
│                                                                              │
│  ┌──────────────────┐                                                       │
│  │ 📎 design.png    │  ← File preview with progress                        │
│  └──────────────────┘                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  [📎]  [@]                                              [Post]              │
│  Attach Mention                                          Button             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Reply Mode (Threaded)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                          ← Blue border      │
│  Great progress! Looking forward to the next update.                        │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  [📎]  [@]                                    [Cancel]  [Reply]             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Backend Interaction

### API Endpoint

```
POST /api/v1/task/:taskId/data
```

### Request Body

```json
{
  "stage": "saved",
  "data_richtext": {
    "ops": [{"insert": "Fixed bug +2h @sarah\n"}]
  },
  "update_type": "comment",
  "hours_logged": 2.0,
  "mentioned__employee_ids": ["uuid-sarah"],
  "attachments": [
    {
      "s3_bucket": "pmo-attachments",
      "s3_key": "task-data/f1111-1111/design.png",
      "filename": "design.png",
      "content_type": "image/png",
      "size_bytes": 245678,
      "uploaded_by__employee_id": "uuid-james",
      "uploaded_ts": "2025-12-03T15:00:00Z"
    }
  ],
  "detected_intents_data": {
    "time_entry": {"hours": 2},
    "mentions": ["uuid-sarah"]
  }
}
```

### For Replies (Threaded)

```json
{
  "task_data_id": "parent-uuid",  // Links to parent comment
  "stage": "saved",
  "data_richtext": {"ops": [{"insert": "Reply text\n"}]},
  "update_type": "reply"          // Auto-set when task_data_id present
}
```

---

## State Management

```typescript
// Local state
const [content, setContent] = useState('');
const [files, setFiles] = useState<File[]>([]);
const [submitting, setSubmitting] = useState(false);
const [detectedIntents, setDetectedIntents] = useState<DetectedIntent[]>([]);
const [showMentions, setShowMentions] = useState(false);
const [mentionSearch, setMentionSearch] = useState('');
const [dragOver, setDragOver] = useState(false);

// S3 upload hook
const { uploadToS3, uploadProgress, isUploading } = useS3Upload();
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Submit (without Shift) |
| `Shift+Enter` | New line |
| `@` | Open mention autocomplete |
| `Escape` | Close mention dropdown |

---

## Design Inspiration

| Feature | Inspired By |
|---------|-------------|
| Unified input | Linear's comment box |
| @mentions | Slack, Notion |
| Intent chips | Linear's "Will log 2h" |
| Drag-drop uploads | GitHub, Figma |
| Time parsing | Toggl, Clockify |

---

## Related Components

| Component | Relationship |
|-----------|--------------|
| [ThreadedComment](./ThreadedComment.md) | Renders submitted SmartComposer output |
| [ReactionBar](./ReactionBar.md) | Adds reactions to submitted comments |
| [TaskDataContainer](./TaskDataContainer.md) | Parent container orchestrating all components |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v2.1.0 | 2025-12-03 | Replaced prop-based employees with cached TanStack Query lookup via `useRefDataEntityInstanceOptions('employee')`. Mention format changed to `@[Name](uuid)` for reliable UUID resolution. |
| v2.0.0 | 2025-12-03 | Initial release with intent detection, S3 uploads, @mentions |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
