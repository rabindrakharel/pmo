# Project & Task Entity System - UI/UX Enhancement Documentation

> **Complete guide to the enhanced entity detail page system** with share/link modals, compact layouts, and inline editing

**Last Updated:** 2025-10-28
**Version:** 2.3.0
**Related Docs:** [UI/UX Architecture](./ui_ux_route_api.md), [Data Model](./datamodel.md)

**v2.3 Updates (2025-10-28):**
- **Convention Over Configuration inline editing** - Auto-detects editable fields by naming patterns
- **Zero manual configuration** - Removed all `inlineEditable` flags from entityConfig
- **Inline file upload** - Drag-drop file upload directly in table cells
- **Bidirectional transformers** - Automatic data format conversion (tags, arrays, etc.)
- **Field capability detection** - Single source of truth in `fieldCapabilities.ts`

**v2.2 Updates (2025-10-27):**
- **Sticky headers** for EntityMainPage and EntityDetailPage with proper z-index layering
- **DRY metadata components**: MetadataField, MetadataRow, MetadataSeparator
- **Reduced spacing**: gap-2 → gap-1.5 (rows), gap-1 → gap-0.5 (fields)
- **File handling**: FilePreview and DragDropFileUpload components for artifact, cost, revenue
- **Layout overflow fix**: Proper scrolling with pb-8 padding

---

## Table of Contents

1. [Overview](#overview)
2. [Entity Detail Page Architecture](#entity-detail-page-architecture)
3. [Header Redesign](#header-redesign)
4. [Share Modal System](#share-modal-system)
5. [Link Modal System](#link-modal-system)
6. [Compact Form Layout](#compact-form-layout)
7. [Technical Implementation](#technical-implementation)
8. [API Integration](#api-integration)
9. [DRY Principles Applied](#dry-principles-applied)
10. [Testing & Validation](#testing--validation)

---

## Overview

### What Changed

This document covers the major UI/UX enhancements made to the entity detail page system, focusing on:

- **Header Redesign**: Name, code, slug, ID moved to page header with inline editing
- **Auto-detected Inline Editing (v2.3)**: Fields automatically editable based on naming conventions
- **Share Modal**: Universal sharing to users, roles, or public links
- **Link Modal**: Entity relationship management with search and preview
- **Compact Layout**: Reduced spacing and elegant striped dividers
- **Copy Functionality**: One-click copy for name, code, slug, ID
- **Fixed Preview Fetch Loop**: Resolved 429 error with React refs

### Key Benefits

- **50% less vertical space** - More content visible without scrolling
- **Universal modals** - Single implementation works across 13+ entity types
- **Zero configuration inline editing (v2.3)** - Auto-detection eliminates 65+ manual flags
- **Improved UX** - Intuitive sharing, linking, and editing with real-time feedback
- **Performance** - Eliminated infinite API loops with proper dependency management
- **Accessibility** - Clear visual hierarchy and keyboard navigation

---

## Entity Detail Page Architecture

### File Structure

```
apps/web/src/
├── pages/shared/
│   └── EntityDetailPage.tsx          # Main detail page (header, share, link)
├── components/shared/
│   ├── entity/
│   │   └── EntityFormContainer.tsx   # Compact form renderer
│   └── modal/
│       ├── Modal.tsx                 # Reusable base modal
│       ├── ShareModal.tsx            # Share functionality
│       ├── LinkModal.tsx             # Link management
│       └── index.ts                  # Exports
└── lib/
    └── entityConfig.ts               # Entity configurations
```

### Component Hierarchy

```
EntityDetailPage
├── Header Section
│   ├── Breadcrumb Navigation
│   ├── Entity Type + Name + Code + Slug + ID (with copy icons)
│   └── Action Buttons (Link, Share, Edit, Delete)
├── Tab Navigation
│   ├── Overview Tab
│   │   ├── EntityFormContainer (compact fields)
│   │   └── Preview Section (for artifacts)
│   └── Child Entity Tabs (tasks, wiki, artifacts, etc.)
├── ShareModal (when share clicked)
└── LinkModal (when link clicked)
```

---

## Header Redesign

### Visual Layout

**Before:**
```
┌─────────────────────────────────────────────┐
│ [Back] > Project                            │
│                                             │
│ Corporate Office Space Planning             │
│ [Edit] [Delete]                             │
└─────────────────────────────────────────────┘
```

**After (v2.2 - Sticky Header with DRY Components):**
```
┌─────────────────────────────────────────────────────────────┐
│ [STICKY HEADER - z-index: 20]                              │
│ [Back] > Project                                            │
│                                                             │
│ project name: Corporate Office Space Planning [📋]         │
│ · code: CORP-2025-001 [📋] · slug: /corp-office [📋]       │
│ · id: abc123... [📋]                                        │
│                                                             │
│ [🔗] [📤] [✏️] [🗑️]                                        │
│                                                             │
│ [Overview] [Tasks] [Wiki] [Artifacts]  ← Tabs also sticky  │
└─────────────────────────────────────────────────────────────┘
│ [SCROLLABLE CONTENT BELOW]                                  │
```

### Implementation

**EntityDetailPage.tsx (v2.2)** - Using DRY Components:

```typescript
{/* Sticky Header Section */}
<div className="sticky top-0 z-20 bg-gray-50 pb-4">
  {/* Compact metadata row using DRY components */}
  <MetadataRow className="overflow-x-auto">
    {/* Name */}
    <MetadataField
      label={`${config.displayName} name`}
      value={isEditing ? (editedData.name || '') : (data.name || '')}
      isEditing={isEditing}
      fieldKey="name"
      copiedField={copiedField}
      onCopy={handleCopy}
      onChange={handleFieldChange}
      placeholder="Enter name..."
      inputWidth="16rem"
    />

    <MetadataSeparator show={!!(data.code || data.slug || id)} />

    {/* Code */}
    {(data.code || isEditing) && (
      <MetadataField
        label="code"
        value={isEditing ? (editedData.code || '') : data.code}
        isEditing={isEditing}
        fieldKey="code"
        copiedField={copiedField}
        onCopy={handleCopy}
        onChange={handleFieldChange}
        placeholder="CODE"
        inputWidth="8rem"
      />
    )}

    <MetadataSeparator show={!!(data.code && (data.slug || isEditing))} />

    {/* Slug */}
    {(data.slug || isEditing) && (
      <MetadataField
        label="slug"
        value={isEditing ? (editedData.slug || '') : data.slug}
        isEditing={isEditing}
        fieldKey="slug"
        copiedField={copiedField}
        onCopy={handleCopy}
        onChange={handleFieldChange}
        placeholder="slug-name"
        prefix="/"
        inputWidth="10rem"
      />
    )}

    <MetadataSeparator show={!!((data.code || data.slug) && id)} />

    {/* ID */}
    {id && (
      <MetadataField
        label="id"
        value={id}
        isEditing={false}
        fieldKey="id"
        copiedField={copiedField}
        onCopy={handleCopy}
        className="text-gray-500"
      />
    )}
  </MetadataRow>

  {/* Action buttons */}
  <div className="flex items-center space-x-2 mt-3">
    {/* Edit, Share, Link buttons */}
  </div>

  {/* Tabs */}
  <DynamicChildEntityTabs />
</div>
```

### Copy Functionality

```typescript
const [copiedField, setCopiedField] = useState<string | null>(null);

const handleCopy = async (field: string, value: string) => {
  try {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  } catch (error) {
    console.error('Failed to copy:', error);
  }
};
```

**Features:**
- Visual feedback (checkmark icon for 2 seconds)
- Uses Clipboard API for reliable copying
- Works across all modern browsers
- Accessible via keyboard navigation

---

## Share Modal System

### Visual Design

```
┌─────────────────────────────────────────────┐
│  Share project                         [X]  │
├─────────────────────────────────────────────┤
│  ┌───────────────────────────────────────┐  │
│  │ Sharing: Corporate Office Planning    │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  Share with:                                │
│  ┌─────────────────────────────────────────┐│
│  │ 🔗 Anyone with the link            [✓] ││
│  │    Create a shareable link...          ││
│  └─────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────┐│
│  │ 👤 Specific users                  [ ] ││
│  │    Share with selected users only      ││
│  └─────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────┐│
│  │ 🛡️  Specific roles                 [ ] ││
│  │    Share with users in roles...        ││
│  └─────────────────────────────────────────┘│
│                                             │
│  Share link:                                │
│  ┌─────────────────────────────────────────┐│
│  │ http://localhost:5173/shared/abc123    ││
│  │                                    [📋]││
│  └─────────────────────────────────────────┘│
│                                             │
├─────────────────────────────────────────────┤
│                        [Cancel]  [Share]    │
└─────────────────────────────────────────────┘
```

### Implementation

**ShareModal.tsx** (apps/web/src/components/shared/modal/ShareModal.tsx):

```typescript
interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string;
  entityName?: string;
  currentSharedUrl?: string;
  onShare: (shareData: ShareData) => Promise<void>;
}

interface ShareData {
  shareType: 'public' | 'users' | 'roles';
  userIds?: string[];
  roleIds?: string[];
  permissions?: string[];
}
```

### Usage Example

```typescript
// In EntityDetailPage.tsx
const [isShareModalOpen, setIsShareModalOpen] = useState(false);

// In JSX
<ShareModal
  isOpen={isShareModalOpen}
  onClose={() => setIsShareModalOpen(false)}
  entityType={entityType}
  entityId={id}
  entityName={data?.name || data?.title}
  currentSharedUrl={data?.shared_url}
  onShare={handleShare}
/>
```

---

## Link Modal System

### Visual Design

```
┌─────────────────────────────────────────────┐
│  Manage task links                     [X]  │
├─────────────────────────────────────────────┤
│  ┌───────────────────────────────────────┐  │
│  │ Managing links for:                   │  │
│  │ Corporate Office Space Planning       │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  Current Links (2):                         │
│  ┌─────────────────────────────────────────┐│
│  │ 🔗 Workspace Renovation            [🔓]││
│  │    project · contains                  ││
│  └─────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────┐│
│  │ 🔗 Design Phase                    [🔓]││
│  │    task · contains                     ││
│  └─────────────────────────────────────────┘│
│                                             │
│  Add New Link:                              │
│  Link to: [Project ▼]                       │
│  [🔍 Search project...]                     │
│                                             │
│  ┌─────────────────────────────────────────┐│
│  │ Workspace Renovation         [Link]    ││
│  │ WORK-2025-001                          ││
│  ├─────────────────────────────────────────┤│
│  │ Office Expansion             [✓Linked]││
│  │ OFF-2025-005                           ││
│  └─────────────────────────────────────────┘│
│                                             │
├─────────────────────────────────────────────┤
│                                    [Close]  │
└─────────────────────────────────────────────┘
```

### API Integration

#### Load Existing Links

```typescript
GET /api/v1/linkage?child_entity_type={type}&child_entity_id={id}

Response:
{
  "data": [
    {
      "id": "linkage-uuid",
      "parent_entity_type": "project",
      "parent_entity_id": "project-uuid",
      "parent_entity_name": "Workspace Renovation",
      "relationship_type": "contains"
    }
  ]
}
```

#### Create Link

```typescript
POST /api/v1/linkage

Body:
{
  "parent_entity_type": "project",
  "parent_entity_id": "project-uuid",
  "child_entity_type": "task",
  "child_entity_id": "task-uuid",
  "relationship_type": "contains"
}
```

#### Delete Link

```typescript
DELETE /api/v1/linkage/{linkageId}
```

### Usage Example

```typescript
// In EntityDetailPage.tsx
const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

// In header actions
<button
  onClick={() => setIsLinkModalOpen(true)}
  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
  title="Manage links"
>
  <LinkIcon className="h-5 w-5 text-gray-600 stroke-[1.5]" />
</button>

// Modal component
<LinkModal
  isOpen={isLinkModalOpen}
  onClose={() => setIsLinkModalOpen(false)}
  childEntityType={entityType}
  childEntityId={id}
  childEntityName={data?.name || data?.title}
/>
```

---

## Compact Form Layout

### Before vs After

**Before (Original):**
```
┌──────────────────────────────────────┐
│  Name                                │
│  ┌────────────────────────────────┐ │
│  │ Corporate Office Planning      │ │
│  └────────────────────────────────┘ │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │ ← Solid thick line
│                                      │ ← Large gap (py-4)
│  Description                         │
│  ┌────────────────────────────────┐ │
│  │ Large workspace renovation     │ │
│  │ for corporate headquarters     │ │
│  └────────────────────────────────┘ │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                      │
│  Start Date                          │
│  ┌────────────────────────────────┐ │
│  │ 2025-01-15                     │ │
│  └────────────────────────────────┘ │
└──────────────────────────────────────┘
```

**After (Compact):**
```
┌──────────────────────────────────────┐
│ Description        Large workspace   │ ← Single line, tight spacing
│ ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  │ ← Striped transparent (15% opacity)
│ Start Date         2025-01-15        │
│ ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  │
│ Project Stage      Planning          │
│ ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  │
│ Priority           High              │
└──────────────────────────────────────┘
```

**Space Reduction:**
- Original: ~800px height for 5 fields
- Compact: ~400px height for same 5 fields
- **50% reduction in vertical space**

### Implementation

**EntityFormContainer.tsx** changes:

```typescript
// Exclude header fields (now in EntityDetailPage header)
const excludedFields = ['name', 'title', 'code', 'slug', 'id'];
const visibleFields = config.fields.filter(f => !excludedFields.includes(f.key));

// Compact spacing
<div className="bg-white rounded-lg border border-gray-200 p-4"> {/* was p-8 */}
  <div className="space-y-0"> {/* was space-y-6 */}
    {visibleFields.map((field, index) => (
      <React.Fragment key={field.key}>
        {/* Striped divider (15% opacity) */}
        {index > 0 && (
          <div
            className="h-px my-1.5"
            style={{
              backgroundImage: 'repeating-linear-gradient(90deg, rgba(209, 213, 219, 0.15) 0px, rgba(209, 213, 219, 0.15) 4px, transparent 4px, transparent 8px)'
            }}
          />
        )}

        {/* Field row with reduced padding */}
        <div className="group transition-all duration-200 ease-out py-1.5"> {/* was py-4 */}
          <div className="grid grid-cols-[160px_1fr] gap-4 items-start">
            {/* Smaller label */}
            <label className="text-xs font-medium text-gray-500 pt-1 flex items-center gap-1.5"> {/* was text-sm */}
              {field.label}
              {field.required && <span className="text-red-500">*</span>}
            </label>

            {/* Conditional highlight in edit mode */}
            <div className={`rounded-lg px-2.5 py-1 -ml-2.5 transition-all duration-200 ${
              isEditing ? 'bg-white/80 border border-gray-200' : 'border border-transparent'
            }`}>
              {renderField(field)}
            </div>
          </div>
        </div>
      </React.Fragment>
    ))}
  </div>
</div>
```

### Striped Divider Pattern

**CSS Implementation:**
```css
background-image: repeating-linear-gradient(
  90deg,
  rgba(209, 213, 219, 0.15) 0px,  /* Gray-300 at 15% opacity */
  rgba(209, 213, 219, 0.15) 4px,  /* Stripe width */
  transparent 4px,                 /* Gap start */
  transparent 8px                  /* Gap end (4px gap) */
);
```

**Visual Result:**
```
████░░░░████░░░░████░░░░████░░░░
↑4px↑4px↑4px↑4px
stripe gap stripe gap
```

Benefits:
- Subtle visual separation
- Doesn't overpower content
- Maintains clean, modern look
- Better than solid lines for dense layouts

---

## Technical Implementation

### Fixed Preview Fetch Loop

**Problem:**
```typescript
// Before (infinite loop)
useEffect(() => {
  if (entityType === 'artifact' && data?.object_key) {
    fetchPreviewUrl();
  }
}, [data?.object_key, entityType, fetchPreviewUrl, loadingPreview]); // ❌ fetchPreviewUrl causes re-render
```

**Solution:**
```typescript
// After (controlled fetch)
const lastObjectKeyRef = React.useRef<string | null>(null);

useEffect(() => {
  if (entityType === 'artifact' && data?.object_key) {
    // Only fetch if object_key changed
    if (lastObjectKeyRef.current !== data.object_key) {
      console.log('Object key changed, clearing preview and fetching new one');
      lastObjectKeyRef.current = data.object_key;
      setPreviewUrl(null);
      fetchPreviewUrl();
    }
    // Or if we have no preview and not currently loading
    else if (!previewUrl && !loadingPreview) {
      console.log('No preview URL yet, fetching for object_key:', data.object_key);
      fetchPreviewUrl();
    }
  }
}, [data?.object_key, entityType]); // ✅ Only depend on actual data
```

**Why This Works:**
- `useRef` stores value without triggering re-renders
- Compare current vs previous object_key
- Only fetch when truly needed
- Prevents 429 (Too Many Requests) errors

### Save Handler with Header Fields

```typescript
const handleSave = async () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  const token = localStorage.getItem('auth_token');

  // Merge header fields + form fields
  const payload = {
    ...editedData, // Contains name, code, slug from header + all form fields
  };

  const response = await fetch(`${apiUrl}/api/v1/${entityType}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (response.ok) {
    const result = await response.json();
    setData(result.data);
    setEditedData(result.data);
    setIsEditing(false);
  }
};
```

**Key Points:**
- Header fields (name, code, slug) stored in `editedData` state
- Form fields also stored in `editedData` state
- Single `handleSave` sends all changes
- API receives complete updated entity

---

## API Integration

### Endpoints Used

| Endpoint | Method | Purpose | Modal |
|----------|--------|---------|-------|
| `/api/v1/linkage` | GET | Load existing links | Link |
| `/api/v1/linkage` | POST | Create new link | Link |
| `/api/v1/linkage/{id}` | DELETE | Remove link | Link |
| `/api/v1/{entityType}` | GET | Search entities to link | Link |
| `/api/v1/employee` | GET | Load users for sharing | Share |
| `/api/v1/role` | GET | Load roles for sharing | Share |
| `/api/v1/{entityType}/{id}/share-url` | POST | Generate public share link | Share |
| `/api/v1/{entityType}/{id}` | PUT | Update entity (with header fields) | Detail Page |
| `/api/v1/artifact/{id}/preview` | GET | Get presigned preview URL | Detail Page |

---

## DRY Principles Applied

### 1. Base Modal Component

**Single Implementation:**
```typescript
// apps/web/src/components/shared/modal/Modal.tsx
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size, footer }) => {
  // Universal modal shell
  // Used by ShareModal, LinkModal, EntityEditModal, etc.
};
```

**Benefits:**
- Consistent backdrop blur, animations, styling
- Keyboard navigation (ESC to close)
- Click-outside-to-close
- Responsive sizing (sm, md, lg, xl)
- Single file to update for global modal changes

### 2. Entity Type Agnostic

**ShareModal:**
```typescript
// Works for any entity type
<ShareModal
  entityType="project"     // or "task", "client", "artifact", etc.
  entityId={id}
  entityName={data?.name}
  onShare={handleShare}
/>
```

**LinkModal:**
```typescript
// Works for any entity type
<LinkModal
  childEntityType="task"   // or "project", "wiki", "artifact", etc.
  childEntityId={id}
  childEntityName={data?.name}
/>
```

**No Duplication:**
- 13+ entity types
- Single modal implementation for all
- ~90% code reuse vs separate modals per entity

---

## Testing & Validation

### Manual Testing Checklist

#### Header Functionality
- [ ] Name displays correctly for all entity types
- [ ] Code displays for entities that have code field
- [ ] Slug displays for entities with slug
- [ ] ID displays and is truncated properly
- [ ] Copy icons work for each field
- [ ] Copied checkmark appears for 2 seconds
- [ ] Edit mode allows editing name, code, slug
- [ ] Save button sends all edited data to API
- [ ] Cancel button reverts changes

#### Share Modal
- [ ] Modal opens when Share icon clicked
- [ ] Entity name displays in header
- [ ] "Public link" option generates shareable URL
- [ ] Copy button copies full URL to clipboard
- [ ] "Specific users" loads employee list
- [ ] User checkboxes work correctly
- [ ] "Specific roles" loads role list
- [ ] Role checkboxes work correctly
- [ ] Share button triggers onShare callback
- [ ] Modal closes after successful share
- [ ] Error handling displays alerts

#### Link Modal
- [ ] Modal opens when Link icon clicked
- [ ] Current links load and display
- [ ] Unlink button removes relationship
- [ ] Entity type selector changes search context
- [ ] Search triggers after 2+ characters
- [ ] Search results display with name + code
- [ ] Already-linked entities show "Linked" badge
- [ ] Link button creates new relationship
- [ ] List refreshes after link/unlink
- [ ] Empty states show appropriate messages

#### Compact Layout
- [ ] Fields display in line-by-line format
- [ ] Spacing is compact (py-1.5)
- [ ] Striped dividers are visible but subtle
- [ ] Labels are small (text-xs) and aligned
- [ ] Values display correctly for all field types
- [ ] Edit mode highlights fields properly
- [ ] No horizontal scroll on mobile

#### Performance
- [ ] Preview fetch doesn't loop (no 429 errors)
- [ ] Modal animations are smooth (60fps)
- [ ] Search debouncing works (no excessive API calls)
- [ ] Large entity lists don't lag (100+ items)

---

## Future Enhancements

### Planned Features

1. **Share Permissions Granularity**
   - Per-user edit/view/delete permissions
   - Time-limited share links (expires after 7 days)
   - Share history tracking (who shared when)
   - Revoke access button

2. **Link Relationship Types**
   - Beyond "contains": depends_on, blocks, duplicates
   - Bidirectional links (task blocks task)
   - Relationship metadata (link strength, priority)
   - Link visualization (graph view)

3. **Bulk Operations**
   - Multi-select links to delete
   - Bulk link creation (link 5 tasks to 1 project)
   - Share with team/department presets

4. **UI Enhancements**
   - Drag-and-drop to reorder fields
   - Collapsible field sections
   - Field history (see previous values)
   - Inline comments on fields

5. **Performance Optimizations**
   - Virtual scrolling for large lists (1000+ items)
   - Infinite scroll pagination
   - Search result caching
   - Optimistic UI updates

6. **Accessibility**
   - ARIA labels for all interactive elements
   - Keyboard shortcuts (Ctrl+K to share)
   - Screen reader announcements
   - High contrast mode support

---

## Summary

### What Was Accomplished

1. **Header Redesign**: Name, code, slug, ID moved to page header with inline editing
2. **Share Modal**: Universal sharing to users, roles, or public links
3. **Link Modal**: Entity relationship management with search
4. **Compact Layout**: 50% space reduction with elegant striped dividers
5. **Fixed Preview Loop**: Eliminated 429 errors with React refs
6. **DRY Architecture**: Single components work across 13+ entity types

### Files Modified

- `/home/rabin/projects/pmo/apps/web/src/pages/shared/EntityDetailPage.tsx`
- `/home/rabin/projects/pmo/apps/web/src/components/shared/entity/EntityFormContainer.tsx`
- `/home/rabin/projects/pmo/apps/web/src/lib/entityConfig.ts`

### Files Created

- `/home/rabin/projects/pmo/apps/web/src/components/shared/modal/Modal.tsx`
- `/home/rabin/projects/pmo/apps/web/src/components/shared/modal/ShareModal.tsx`
- `/home/rabin/projects/pmo/apps/web/src/components/shared/modal/LinkModal.tsx`
- `/home/rabin/projects/pmo/apps/web/src/components/shared/modal/index.ts`

### Impact

- **User Experience**: 50% less scrolling, cleaner interface, intuitive actions
- **Developer Experience**: Reusable components, config-driven, easy to extend
- **Performance**: Fixed infinite loops, optimized rendering
- **Maintainability**: DRY principles, single source of truth

---

**End of Documentation**
