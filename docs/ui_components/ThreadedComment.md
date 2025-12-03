# ThreadedComment Component

**Version:** 2.0.0 | **Location:** `apps/web/src/components/entity/task/ThreadedComment.tsx` | **Updated:** 2025-12-03

---

## Overview

ThreadedComment renders a single comment/update in the task activity feed with support for nested replies, emoji reactions, S3 attachments, pinning, and resolution. Inspired by Linear, Slack, and GitHub comment systems.

**Core Principles:**
- Recursive rendering for threaded replies
- Rich text content with mention highlighting
- S3 attachment previews (images inline, files downloadable)
- Integrated ReactionBar for emoji reactions
- Action buttons for reply, pin, resolve

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     THREADEDCOMMENT ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ThreadedComment                                                             │
│  ├── Pinned Indicator          [📌 Pinned]                                  │
│  │                                                                           │
│  ├── Avatar + Header                                                         │
│  │   ├── User avatar (gradient circle)                                      │
│  │   ├── User name                                                           │
│  │   ├── Relative time (2h ago)                                             │
│  │   ├── Hours logged badge (+2h)                                           │
│  │   └── Resolved indicator (✓ Resolved)                                    │
│  │                                                                           │
│  ├── Rich Text Content                                                       │
│  │   ├── Text with formatting (bold, italic, code)                          │
│  │   ├── Links (clickable)                                                   │
│  │   └── @mentions (highlighted badges)                                      │
│  │                                                                           │
│  ├── S3 Attachments                                                          │
│  │   ├── Images (inline thumbnails)                                          │
│  │   └── Files (download links with icons)                                   │
│  │                                                                           │
│  ├── Action Row                                                              │
│  │   ├── ReactionBar (emoji display + picker)                               │
│  │   ├── Reply button (if not reply)                                         │
│  │   ├── Pin button (editors only)                                           │
│  │   └── Resolve button (editors only)                                       │
│  │                                                                           │
│  └── Nested Replies                                                          │
│      ├── "Show N replies" toggle                                             │
│      └── [ThreadedComment] × N  (recursive)                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Props Interface

```typescript
interface S3Attachment {
  s3_bucket: string;
  s3_key: string;
  filename: string;
  content_type?: string;
  size_bytes?: number;
  uploaded_by__employee_id?: string;
  uploaded_ts?: string;
}

interface TaskUpdate {
  id: string;
  task_id: string;
  task_data_id: string | null;        // Parent for threading
  stage: string;
  updated_by__employee_id: string;
  data_richtext: any;                  // Quill Delta format
  update_type: string;
  hours_logged?: number;
  mentioned__employee_ids?: string[];
  reactions_data: Record<string, string[]>;  // emoji → [userIds]
  pinned_flag: boolean;
  pinned_by__employee_id?: string;
  pinned_ts?: string;
  resolved_flag: boolean;
  resolved_by__employee_id?: string;
  resolved_ts?: string;
  attachments: S3Attachment[];
  created_ts: string;
  updated_ts: string;
  updated_by_name?: string;
  reply_count?: number;
}

interface ThreadedCommentProps {
  /** The task update data */
  update: TaskUpdate;

  /** Current user ID for reaction toggling */
  currentUserId: string;

  /** Can user edit (pin/resolve)? */
  canEdit: boolean;

  /** Is this a reply? (affects styling) */
  isReply?: boolean;

  /** Callback when reply button clicked */
  onReply?: (parentId: string) => void;

  /** Callback for reaction toggle */
  onReact: (dataId: string, emoji: string) => Promise<void>;

  /** Callback for pin toggle */
  onPin: (dataId: string) => Promise<void>;

  /** Callback for resolve toggle */
  onResolve: (dataId: string) => Promise<void>;

  /** Callback to load replies */
  onLoadReplies?: (parentId: string) => void;

  /** Pre-loaded replies */
  replies?: TaskUpdate[];

  /** Loading state for replies */
  repliesLoading?: boolean;

  /** S3 presigned URL getter */
  getPresignedUrl?: (s3Key: string) => Promise<string>;

  /** Employee ID → name map for tooltips */
  employeeNames?: Record<string, string>;
}
```

---

## Key Features

### 1. Rich Text Rendering

Parses Quill Delta format and renders with formatting:

```typescript
const renderRichText = (richtext: any) => {
  if (!richtext?.ops) return null;

  return delta.ops.map((op, idx) => {
    let element = op.insert;
    const attrs = op.attributes || {};

    if (attrs.bold) element = <strong>{element}</strong>;
    if (attrs.italic) element = <em>{element}</em>;
    if (attrs.code) element = <code className="bg-dark-100 px-1 rounded">{element}</code>;
    if (attrs.link) element = <a href={attrs.link} className="text-blue-600">{element}</a>;
    if (attrs.mention) {
      element = (
        <span className="bg-blue-100 text-blue-700 px-1.5 rounded-full">
          @{attrs.mention.name}
        </span>
      );
    }

    return element;
  });
};
```

### 2. S3 Attachment Previews

```
┌────────────────────────────────────────────┐
│  IMAGES (inline thumbnails):               │
│  ┌──────────┐  ┌──────────┐                │
│  │ 📷       │  │ 📷       │                │
│  │ image.png│  │ photo.jpg│                │
│  └──────────┘  └──────────┘                │
│                                             │
│  FILES (download links):                    │
│  ┌────────────────────────────────────┐    │
│  │ 📄 report.pdf (102 KB)  ⬇️         │    │
│  └────────────────────────────────────┘    │
└────────────────────────────────────────────┘
```

### 3. Recursive Threading

```typescript
// Nested replies render recursively
{showReplies && replies.map((reply) => (
  <ThreadedComment
    key={reply.id}
    update={reply}
    isReply={true}           // Adds left border + indent
    currentUserId={currentUserId}
    canEdit={canEdit}
    onReact={onReact}
    onPin={onPin}
    onResolve={onResolve}
    // No onReply for nested replies (single-level threading)
  />
))}
```

### 4. Relative Time Formatting

```typescript
const formatRelativeTime = (timestamp: string): string => {
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return then.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
};
// Examples: "just now", "5m ago", "2h ago", "3d ago", "Dec 3"
```

---

## UI/UX Design

### Top-Level Comment

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📌 Pinned                                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  🔵 James Miller  •  2h ago  •  +2h  •  ✓ Resolved                          │
│                                                                              │
│  Fixed the API bug that was causing timeout errors. Tested with             │
│  @sarah.connor and confirmed the fix works.                                 │
│                                                                              │
│  ┌──────────┐                                                               │
│  │ 📷       │                                                               │
│  │ fix.png  │                                                               │
│  └──────────┘                                                               │
│                                                                              │
│  [👍 2] [🚀 1]  [+]     [↩️ Reply]  [📌 Pin]  [✓ Resolve]                   │
│                                                                              │
│  💬 Show 3 replies                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Reply (Nested with Left Border)

```
    │  🔵 Sarah Connor  •  1h ago
    │
    │  Thanks for the fix! I've verified it on my end too.
    │
    │  [👍 1]  [+]
```

---

## Request Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  THREADEDCOMMENT REQUEST FLOW                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  REACTION TOGGLE:                                                            │
│  ─────────────────                                                          │
│  1. User clicks emoji on ReactionBar                                        │
│  2. onReact(dataId, emoji) called                                           │
│  3. Parent (TaskDataContainer) calls:                                        │
│     POST /api/v1/task/:taskId/data/:dataId/react                            │
│     Body: { "emoji": "thumbs_up" }                                          │
│  4. API toggles user in reactions_data[emoji] array                         │
│  5. Response: { reactions_data, action: "added" | "removed" }               │
│                                                                              │
│  PIN TOGGLE:                                                                 │
│  ────────────                                                               │
│  1. User clicks Pin button                                                  │
│  2. onPin(dataId) called                                                    │
│  3. Parent calls: PATCH /api/v1/task/:taskId/data/:dataId/pin               │
│  4. API toggles pinned_flag, sets pinned_by, pinned_ts                      │
│  5. UI updates: shows/hides 📌 Pinned indicator                             │
│                                                                              │
│  LOAD REPLIES:                                                               │
│  ─────────────                                                              │
│  1. User clicks "Show N replies"                                            │
│  2. onLoadReplies(parentId) called                                          │
│  3. Parent calls: GET /api/v1/task/:taskId/data/:dataId/replies             │
│  4. Replies loaded into component state                                     │
│  5. Recursive ThreadedComment renders each reply                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Styling Details

### Reply Indent (Left Border)

```css
/* Reply styling */
.reply {
  margin-left: 2rem;          /* ml-8 */
  border-left: 2px solid;     /* border-l-2 */
  border-color: #e5e7eb;      /* border-dark-200 */
  padding-left: 1rem;         /* pl-4 */
}
```

### Action Buttons (Hover Reveal)

```css
/* Hidden by default, shown on hover */
.action-buttons {
  opacity: 0;
  transition: opacity 150ms;
}
.group:hover .action-buttons {
  opacity: 1;
}
```

### Pin/Resolve Active States

```css
/* Pinned button active */
.pin-active {
  color: #d97706;             /* text-amber-600 */
  background: #fef3c7;        /* bg-amber-50 */
}

/* Resolved button active */
.resolve-active {
  color: #16a34a;             /* text-green-600 */
  background: #dcfce7;        /* bg-green-50 */
}
```

---

## Related Components

| Component | Relationship |
|-----------|--------------|
| [ReactionBar](./ReactionBar.md) | Embedded for emoji reactions |
| [SmartComposer](./SmartComposer.md) | Creates content that ThreadedComment displays |
| [TaskDataContainer](./TaskDataContainer.md) | Parent container managing state |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v2.0.0 | 2025-12-03 | Initial release with threading, reactions, S3 attachments |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
