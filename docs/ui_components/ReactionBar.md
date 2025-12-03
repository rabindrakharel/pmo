# ReactionBar Component

**Version:** 2.0.0 | **Location:** `apps/web/src/components/entity/task/ReactionBar.tsx` | **Updated:** 2025-12-03

---

## Overview

ReactionBar displays and manages emoji reactions for task updates. Inspired by GitHub, Slack, and Linear reaction systems with toggle support and an emoji picker.

**Core Principles:**
- Toggle-based reactions (add/remove on click)
- Aggregated display with counts
- Quick emoji picker dropdown
- Tooltips showing who reacted

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     REACTIONBAR ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ReactionBar                                                                 │
│  ├── Existing Reactions (map over reactions_data)                           │
│  │   └── ReactionButton × N                                                 │
│  │       ├── Emoji display                                                  │
│  │       ├── Count                                                          │
│  │       ├── Highlighted if user reacted                                    │
│  │       └── Tooltip: "James, Sarah, +2 more"                               │
│  │                                                                          │
│  └── Add Reaction Button                                                    │
│      └── EmojiPicker (dropdown)                                             │
│          └── QuickReaction × 8                                              │
│              [👍] [❤️] [🚀] [👀] [✅] [🔥] [🎉] [🤔]                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Props Interface

```typescript
interface ReactionBarProps {
  /** Task ID for context */
  taskId: string;

  /** Task data ID (comment ID) */
  dataId: string;

  /** Current reactions: emoji → array of user IDs */
  reactions: Record<string, string[]>;

  /** Current user ID for highlighting own reactions */
  currentUserId: string;

  /** Callback when reaction is toggled */
  onReact: (emoji: string) => Promise<void>;

  /** Employee ID → name map for tooltips */
  employeeNames?: Record<string, string>;
}
```

---

## Emoji Map

```typescript
const QUICK_REACTIONS = [
  { emoji: 'thumbs_up', display: '👍', label: 'Thumbs up' },
  { emoji: 'heart', display: '❤️', label: 'Heart' },
  { emoji: 'rocket', display: '🚀', label: 'Rocket' },
  { emoji: 'eyes', display: '👀', label: 'Eyes' },
  { emoji: 'check', display: '✅', label: 'Check' },
  { emoji: 'fire', display: '🔥', label: 'Fire' },
  { emoji: 'party', display: '🎉', label: 'Party' },
  { emoji: 'thinking', display: '🤔', label: 'Thinking' },
];

// Database stores snake_case keys, display uses emoji
const EMOJI_MAP: Record<string, string> = {
  thumbs_up: '👍',
  heart: '❤️',
  rocket: '🚀',
  // ...
};
```

---

## Key Features

### 1. Toggle Behavior

```typescript
const handleReaction = async (emoji: string) => {
  if (reacting) return;
  setReacting(emoji);
  try {
    await onReact(emoji);  // API toggles add/remove
  } finally {
    setReacting(null);
    setShowPicker(false);
  }
};
```

### 2. User Highlight

Current user's reactions are highlighted with blue styling:

```typescript
const userReacted = userIds.includes(currentUserId);

className={`
  ${userReacted
    ? 'bg-blue-100 border-blue-300 text-blue-700'  // Highlighted
    : 'bg-dark-100 border-dark-300 text-dark-600'  // Normal
  }
`}
```

### 3. Tooltip with Names

```typescript
const getReactorNames = (userIds: string[]): string => {
  const names = userIds.map(id => employeeNames[id] || 'Unknown');
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
};
// "James, Sarah, Mike and 2 more"
```

---

## UI/UX Design

### Reaction Display

```
[👍 3]  [🚀 1]  [❤️ 2]  [+]
  │       │       │      │
  │       │       │      └── Add reaction button (opens picker)
  │       │       └── Heart: 2 reactions
  │       └── Rocket: 1 reaction
  └── Thumbs up: 3 reactions (highlighted if user reacted)
```

### Emoji Picker Dropdown

```
┌──────────────────────────────────────┐
│  [👍] [❤️] [🚀] [👀] [✅] [🔥] [🎉] [🤔]  │
└──────────────────────────────────────┘
```

---

## Request Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  REACTION TOGGLE FLOW                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. User clicks 👍 button (or picks from emoji picker)                      │
│                                                                              │
│  2. handleReaction('thumbs_up') called                                      │
│     └── setReacting('thumbs_up')  // Show loading state                     │
│     └── onReact('thumbs_up')      // Passed from ThreadedComment            │
│                                                                              │
│  3. ThreadedComment.onReact → TaskDataContainer.handleReact                 │
│     └── POST /api/v1/task/:taskId/data/:dataId/react                       │
│         Body: { "emoji": "thumbs_up" }                                      │
│                                                                              │
│  4. API toggles reaction:                                                   │
│     IF user NOT in reactions_data.thumbs_up:                                │
│       → ADD user to array, return { action: "added" }                       │
│     ELSE:                                                                    │
│       → REMOVE user from array, return { action: "removed" }                │
│                                                                              │
│  5. TaskDataContainer.loadUpdates() refreshes all data                      │
│                                                                              │
│  6. Component re-renders with updated reactions_data                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Styling

### Reaction Button States

```css
/* Normal state */
.reaction-normal {
  background: #f3f4f6;       /* bg-dark-100 */
  border: 1px solid #d1d5db; /* border-dark-300 */
  color: #4b5563;            /* text-dark-600 */
}

/* User reacted (highlighted) */
.reaction-active {
  background: #dbeafe;       /* bg-blue-100 */
  border: 1px solid #93c5fd; /* border-blue-300 */
  color: #1d4ed8;            /* text-blue-700 */
}

/* Loading state */
.reaction-loading {
  opacity: 0.5;
  cursor: wait;
}
```

### Add Button

```css
.add-reaction {
  padding: 0.375rem;         /* p-1.5 */
  border-radius: 9999px;     /* rounded-full */
  color: #6b7280;            /* text-dark-500 */
}
.add-reaction:hover {
  color: #374151;            /* text-dark-700 */
  background: #f3f4f6;       /* bg-dark-100 */
}
```

---

## Database Storage

```sql
-- reactions_data JSONB column
{
  "thumbs_up": ["uuid-james", "uuid-sarah", "uuid-mike"],
  "rocket": ["uuid-james"],
  "heart": ["uuid-sarah", "uuid-mike"]
}

-- API toggle logic (pseudo-SQL)
UPDATE app.d_task_data
SET reactions_data = CASE
  WHEN reactions_data->'thumbs_up' ? :userId
    THEN jsonb_set(reactions_data, '{thumbs_up}',
         (reactions_data->'thumbs_up') - :userId)
  ELSE
    jsonb_set(reactions_data, '{thumbs_up}',
         COALESCE(reactions_data->'thumbs_up', '[]'::jsonb) || to_jsonb(:userId))
END
WHERE id = :dataId;
```

---

## Related Components

| Component | Relationship |
|-----------|--------------|
| [ThreadedComment](./ThreadedComment.md) | Parent that renders ReactionBar |
| [TaskDataContainer](./TaskDataContainer.md) | Provides handleReact callback |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v2.0.0 | 2025-12-03 | Initial release with toggle, picker, tooltips |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
