# WikiEditorPage

**Version:** 9.0.0 | **Location:** `apps/web/src/pages/wiki/WikiEditorPage.tsx` | **Updated:** 2025-12-03

---

## Overview

WikiEditorPage provides a Notion-style block editor for creating and editing wiki pages. It uses the WikiDesigner component for the actual editing interface and supports sharing, linkage, and auto-save.

**Core Principles:**
- Notion-style block editing via WikiDesigner
- Create and edit modes
- Share and linkage integration
- Exit confirmation with unsaved changes

---

## Page Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       WIKIEDITORPAGE ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Route: /wiki/new (create) or /wiki/{id}/edit (edit)                        │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  WikiDesigner (Full-Screen Editor)                                      ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Toolbar: [Exit] | Page Title | [Link] [Share] [Save]               │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Cover Image Area (click to change)                                 │││
│  │  │  ████████████████████████████████████████████████████████████████  │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Icon + Title                                                       │││
│  │  │  [📄] Click to add title...                                         │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Block Editor                                                       │││
│  │  │  ┌───────────────────────────────────────────────────────────────┐ │││
│  │  │  │  / Type to add block...                                       │ │││
│  │  │  │                                                               │ │││
│  │  │  │  [+] Add block | Paragraph | Heading | List | Code | Image   │ │││
│  │  │  └───────────────────────────────────────────────────────────────┘ │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  [ShareModal] [UnifiedLinkageModal] [ExitConfirmDialog]                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. Create vs Edit Mode

```typescript
const { id } = useParams();
const editing = Boolean(id);

useEffect(() => {
  if (editing && id) {
    loadPage();
  } else {
    // Create new page with defaults
    setPage({
      name: '',
      content: { type: 'blocks', blocks: [] },
      metadata: {
        attr: { icon: '📄', cover: 'gradient-blue', path: '/wiki' }
      },
      publication_status: 'draft',
      visibility: 'internal',
      wiki_type: 'page',
    });
  }
}, [editing, id]);
```

### 2. Save Handling

```typescript
const handleSave = async (pageData: any) => {
  if (editing && id) {
    await wikiApi.update(id, pageData);
    const refreshed = await wikiApi.get(id);
    setPage(refreshed);
  } else {
    const created = await wikiApi.create(pageData);
    // Update URL without navigation
    window.history.replaceState(null, '', `/wiki/${created.id}/edit`);
    const refreshed = await wikiApi.get(created.id);
    setPage(refreshed);
  }

  setSaveSuccess(true);
  setTimeout(() => setSaveSuccess(false), 3000);
};
```

### 3. Content Parsing

```typescript
// Parse content if it's a string
if (typeof pageData.content === 'string') {
  try {
    pageData.content = JSON.parse(pageData.content);
  } catch (e) {
    pageData.content = { type: 'blocks', blocks: [] };
  }
}
```

### 4. Toolbar Actions

```tsx
<WikiDesigner
  page={page}
  onSave={handleSave}
  onExit={handleExit}
  actions={id ? [
    {
      id: 'link',
      label: '',
      icon: <LinkIcon className="h-4 w-4" />,
      onClick: () => linkageModal.openAssignParent({
        childEntityType: 'wiki',
        childEntityId: id,
        childEntityName: page?.name
      }),
      variant: 'secondary'
    },
    {
      id: 'share',
      label: '',
      icon: <Share2 className="h-4 w-4" />,
      onClick: () => setIsShareModalOpen(true),
      variant: 'secondary'
    }
  ] : []}
/>
```

### 5. Exit Confirmation

```typescript
const handleExit = () => {
  setShowExitConfirm(true);
};

const handleExitWithoutSaving = () => {
  setShowExitConfirm(false);
  navigate('/wiki');
};
```

---

## Wiki Page Structure

```typescript
interface WikiPage {
  id?: string;
  name: string;
  content: {
    type: 'blocks';
    blocks: Block[];
  };
  metadata?: {
    attr: {
      icon: string;       // Emoji
      cover: string;      // Gradient name
      path: string;       // Navigation path
    };
  };
  publication_status: 'draft' | 'published';
  visibility: 'internal' | 'public';
  wiki_type: 'page' | 'template';
}
```

---

## Modals

| Modal | Purpose |
|-------|---------|
| ShareModal | Share wiki page |
| UnifiedLinkageModal | Link to parent entity |
| ExitConfirmDialog | Confirm exit with unsaved changes |

---

## Related Pages

| Page | Relationship |
|------|--------------|
| [WikiViewPage](./WikiViewPage.md) | Read-only view |
| [EntityListOfInstancesPage](./EntityListOfInstancesPage.md) | Wiki list |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v9.0.0 | 2025-12-03 | Linkage modal integration |
| v1.0.0 | 2025-10-01 | Initial release |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
