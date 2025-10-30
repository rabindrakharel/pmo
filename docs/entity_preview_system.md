# Entity Preview System

> **Quick preview panel for viewing entity details without navigation**
> Slide-over panel activated when clicking parent entity instances

---

## Overview

The **Entity Preview System** provides a quick way to preview entity details without leaving the current page. When you click on a parent entity instance (e.g., a project in a list), a preview button appears in the top-right header. Clicking this button opens a slide-over panel showing the entity's details.

**Key Features:**
- ✅ Quick preview without navigation
- ✅ Slide-over panel from right side
- ✅ Preview button only active when entity selected
- ✅ Keyboard shortcuts (ESC to close)
- ✅ Click outside to close
- ✅ Link to full detail view

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   ENTITY PREVIEW SYSTEM                  │
└──────────────────────────────────────────────────────────┘
                          │
                          ├─── EntityPreviewContext.tsx
                          │    (State management)
                          │
                          ├─── EntityPreviewPanel.tsx
                          │    (Slide-over UI component)
                          │
                          └─── Layout.tsx
                               (Preview button in header)
```

### Components

#### 1. EntityPreviewContext (`/contexts/EntityPreviewContext.tsx`)
**Purpose:** Centralized state management for preview system

**State:**
```typescript
interface EntityPreviewData {
  entityType: string;    // e.g., 'project', 'task', 'client'
  entityId: string;      // Entity UUID
  label?: string;        // Optional display label
}

interface EntityPreviewContextValue {
  entityPreviewData: EntityPreviewData | null;
  isEntityPreviewOpen: boolean;
  openEntityPreview: (entity: EntityPreviewData) => void;
  closeEntityPreview: () => void;
}
```

**Usage:**
```typescript
import { useEntityPreview } from '../contexts/EntityPreviewContext';

function MyComponent() {
  const { openEntityPreview } = useEntityPreview();

  const handleClick = (entity) => {
    openEntityPreview({
      entityType: 'project',
      entityId: entity.id,
      label: entity.name
    });
  };

  return <button onClick={() => handleClick(project)}>Select</button>;
}
```

#### 2. EntityPreviewPanel (`/components/shared/preview/EntityPreviewPanel.tsx`)
**Purpose:** Slide-over panel UI component

**Features:**
- Slides in from right side (max-width: 2xl)
- Auto-fetches entity data when opened
- Shows entity overview fields
- Link to full detail view
- Backdrop with click-outside to close
- ESC key to close

**Rendering:**
- Loading state with spinner
- Error state with message
- Success state with entity fields
- Raw data viewer (collapsible)

#### 3. Preview Button in Layout (`/components/shared/layout/Layout.tsx`)
**Purpose:** Header button to open preview panel

**Behavior:**
- **Disabled** when no entity selected (gray, cursor-not-allowed)
- **Active** when entity selected (hover effects, clickable)
- Located in top-right header next to breadcrumb

**Visual States:**
```css
/* Disabled */
bg-gray-50 text-gray-400 cursor-not-allowed

/* Active */
bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900
```

---

## Usage Patterns

### Pattern 1: Open Preview from Table Row Click

**Scenario:** User clicks on a parent entity row in a table

```typescript
import { useEntityPreview } from '../contexts/EntityPreviewContext';
import { useNavigate } from 'react-router-dom';

function ProjectTable() {
  const { openEntityPreview } = useEntityPreview();
  const navigate = useNavigate();

  const handleRowClick = (project) => {
    // Set preview data (activates preview button)
    openEntityPreview({
      entityType: 'project',
      entityId: project.id,
      label: `Project: ${project.name}`
    });

    // Optionally navigate to detail page
    // navigate(`/project/${project.id}`);
  };

  return (
    <table>
      {projects.map(project => (
        <tr key={project.id} onClick={() => handleRowClick(project)}>
          <td>{project.name}</td>
          <td>{project.stage}</td>
        </tr>
      ))}
    </table>
  );
}
```

### Pattern 2: Open Preview from Link/Button

**Scenario:** User clicks a "Preview" button/link

```typescript
import { useEntityPreview } from '../contexts/EntityPreviewContext';

function TaskCard({ task }) {
  const { openEntityPreview } = useEntityPreview();

  const handlePreviewClick = (e) => {
    e.stopPropagation(); // Prevent parent click handlers

    openEntityPreview({
      entityType: 'task',
      entityId: task.id,
      label: task.title
    });
  };

  return (
    <div className="task-card">
      <h3>{task.title}</h3>
      <button onClick={handlePreviewClick}>
        Quick Preview
      </button>
    </div>
  );
}
```

### Pattern 3: Open Preview from Child Entity Tab

**Scenario:** User clicks on a child entity in a parent's detail page

```typescript
import { useEntityPreview } from '../contexts/EntityPreviewContext';

function ProjectDetailPage() {
  const { openEntityPreview } = useEntityPreview();

  const handleTaskClick = (task) => {
    // Show task preview while staying on project page
    openEntityPreview({
      entityType: 'task',
      entityId: task.id,
      label: `Task: ${task.name}`
    });
  };

  return (
    <div>
      <h1>Project Details</h1>

      <h2>Tasks</h2>
      {tasks.map(task => (
        <div key={task.id} onClick={() => handleTaskClick(task)}>
          {task.name}
        </div>
      ))}
    </div>
  );
}
```

### Pattern 4: Clear Preview Selection

**Scenario:** User navigates away or wants to deselect entity

```typescript
import { useEntityPreview } from '../contexts/EntityPreviewContext';

function MyComponent() {
  const { closeEntityPreview } = useEntityPreview();

  useEffect(() => {
    // Clear preview when unmounting
    return () => {
      closeEntityPreview();
    };
  }, [closeEntityPreview]);

  return <div>Content</div>;
}
```

---

## User Flow

### Flow 1: Table Row Click → Preview

```
1. USER views a table of projects
   ↓
2. USER clicks on "Website Redesign" project row
   ↓
3. SYSTEM calls openEntityPreview({
     entityType: 'project',
     entityId: 'abc-123',
     label: 'Project: Website Redesign'
   })
   ↓
4. SYSTEM updates context state
   • entityPreviewData = { entityType, entityId, label }
   • Preview button becomes ACTIVE (no longer gray)
   ↓
5. USER sees preview button is now enabled in top-right
   ↓
6. USER clicks "Preview" button
   ↓
7. SYSTEM opens EntityPreviewPanel
   • Fetches entity data via API
   • Shows loading spinner
   • Renders entity fields when loaded
   ↓
8. USER views project details in slide-over panel
   ↓
9. USER can:
   • Click "Open Full View" to navigate
   • Press ESC to close
   • Click outside to close
   • Click X button to close
```

### Flow 2: No Entity Selected

```
1. USER loads page
   ↓
2. SYSTEM state:
   • entityPreviewData = null
   • Preview button is DISABLED (gray)
   ↓
3. USER hovers over preview button
   ↓
4. SYSTEM shows tooltip:
   "Select an entity to preview"
   ↓
5. USER cannot click (disabled state)
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **ESC** | Close preview panel |

---

## Styling & Visual Design

### Preview Button States

```typescript
// Disabled (no entity selected)
<button
  disabled
  className="bg-gray-50 text-gray-400 cursor-not-allowed"
>
  <Eye className="h-4 w-4" />
  Preview
</button>

// Active (entity selected)
<button
  className="bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900"
>
  <Eye className="h-4 w-4" />
  Preview
</button>
```

### Slide-over Panel

```css
/* Panel dimensions */
max-width: 32rem (2xl)
height: 100vh
position: fixed, right: 0, top: 0
z-index: 50

/* Animations */
transition: transform 300ms ease-in-out
translate-x-full (hidden) → translate-x-0 (visible)

/* Backdrop */
z-index: 40
opacity: 0.3
background: black
```

---

## API Integration

### Entity Data Fetching

The EntityPreviewPanel automatically fetches entity data using the API client:

```typescript
import { fetchEntityData } from '../../../lib/api';

// Inside EntityPreviewPanel
const loadEntityData = async () => {
  const data = await fetchEntityData(
    entityPreviewData.entityType,
    entityPreviewData.entityId
  );
  setEntityData(data);
};
```

**API Endpoint Called:**
```
GET /api/v1/{entityType}/{entityId}
```

**Example:**
```
GET /api/v1/project/abc-123-def-456
```

---

## Integration with Existing Components

### In App.tsx

```typescript
import { EntityPreviewProvider } from './contexts/EntityPreviewContext';
import { EntityPreviewPanel } from './components/shared/preview/EntityPreviewPanel';

function App() {
  return (
    <EntityPreviewProvider>
      <AppRoutes />
      <EntityPreviewPanel />  {/* Renders globally */}
    </EntityPreviewProvider>
  );
}
```

### In Layout.tsx

```typescript
import { useEntityPreview } from '../../../contexts/EntityPreviewContext';

export function Layout({ children }) {
  const { entityPreviewData, openEntityPreview } = useEntityPreview();

  return (
    <header>
      {/* Preview button in top-right */}
      <button
        disabled={!entityPreviewData}
        onClick={() => openEntityPreview(entityPreviewData!)}
      >
        <Eye /> Preview
      </button>
    </header>
  );
}
```

---

## Benefits

1. **✅ No Navigation Required**
   - View entity details without leaving current page
   - Maintains scroll position and context

2. **✅ Fast & Lightweight**
   - Slide-over panel loads quickly
   - No full page reload

3. **✅ Context Preservation**
   - User stays on current page
   - Can compare multiple entities quickly

4. **✅ Keyboard Friendly**
   - ESC to close
   - Tab navigation support

5. **✅ Consistent UX**
   - Same pattern across all entity types
   - Familiar slide-over interaction

---

## Testing Checklist

- [ ] **Preview Button States**
  - [ ] Disabled when no entity selected
  - [ ] Active when entity selected
  - [ ] Tooltip shows appropriate message

- [ ] **Panel Opening**
  - [ ] Slides in from right
  - [ ] Backdrop appears
  - [ ] Entity data fetches

- [ ] **Panel Closing**
  - [ ] ESC key closes panel
  - [ ] Click outside closes panel
  - [ ] X button closes panel
  - [ ] Smooth animation

- [ ] **Data Display**
  - [ ] Loading spinner shows
  - [ ] Entity fields render correctly
  - [ ] "Open Full View" link works

- [ ] **Edge Cases**
  - [ ] Error handling (failed fetch)
  - [ ] Empty data handling
  - [ ] Long entity names (ellipsis)

---

## Future Enhancements

### Phase 2: Enhanced Preview

1. **Tabs in Preview Panel**
   - Overview tab (current)
   - Child entities tabs
   - Activity history tab

2. **Preview Actions**
   - Quick edit button
   - Share button
   - Copy link button

3. **Multiple Previews**
   - Stack multiple previews
   - Navigate between previewed entities

4. **Preview History**
   - Recently previewed entities
   - Quick access to previous previews

---

## Summary

The Entity Preview System provides a **fast, lightweight way to view entity details** without navigation. Key components:

1. **EntityPreviewContext** - State management
2. **EntityPreviewPanel** - Slide-over UI
3. **Preview Button** - Header activation button

**Usage Pattern:**
```typescript
// When entity clicked/selected
openEntityPreview({ entityType, entityId, label });

// Preview button becomes active
// User clicks preview button
// Panel slides in with entity details
```

**Files:**
- `/contexts/EntityPreviewContext.tsx`
- `/components/shared/preview/EntityPreviewPanel.tsx`
- `/components/shared/layout/Layout.tsx` (preview button)
- `/App.tsx` (provider wrapper)

**Status:** ✅ Implemented (v1.0)
**Last Updated:** 2025-01-23
