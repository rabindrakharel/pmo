# WikiViewPage

**Version:** 9.0.0 | **Location:** `apps/web/src/pages/wiki/WikiViewPage.tsx` | **Updated:** 2025-12-03

---

## Overview

WikiViewPage displays wiki content in read-only mode with cover images, icons, and rendered HTML content. It provides navigation to the wiki editor and back to the wiki list.

**Core Principles:**
- Read-only wiki display
- Cover image gradients
- Emoji/icon support
- HTML content rendering

---

## Page Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        WIKIVIEWPAGE ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Route: /wiki/{id}                                                          │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Layout Shell                                                           ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Cover Image (gradient based on attr.cover)                         │││
│  │  │  ████████████████████████████████████████████████████████████████  │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Header                                                             │││
│  │  │  [📄] Page Title                                   [Edit] [Back]    │││
│  │  │  Updated: Dec 3, 2025, 10:30 AM                                     │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Content Article (prose styling)                                    │││
│  │  │  ┌───────────────────────────────────────────────────────────────┐ │││
│  │  │  │  <div dangerouslySetInnerHTML={{ __html: content_html }} />   │ │││
│  │  │  │                                                               │ │││
│  │  │  │  ## Getting Started                                           │ │││
│  │  │  │  This wiki page explains how to...                            │ │││
│  │  │  │                                                               │ │││
│  │  │  └───────────────────────────────────────────────────────────────┘ │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Cover Gradients

| Cover Value | Gradient |
|-------------|----------|
| `gradient-purple` | `from-purple-600 to-pink-600` |
| `emerald` | `from-emerald-600 to-teal-600` |
| `gray` | `bg-dark-200` |
| (default) | `from-dark-700 to-indigo-600` |

---

## Key Features

### 1. Data Loading

```typescript
useEffect(() => {
  (async () => {
    if (!id) return;
    const res = await wikiApi.get(id);
    setPage(res);
  })();
}, [id]);
```

### 2. Cover Image Rendering

```tsx
<div className={`h-40 rounded-xl ${
  page.attr?.cover === 'gradient-purple'
    ? 'bg-gradient-to-r from-purple-600 to-pink-600'
    : page.attr?.cover === 'emerald'
    ? 'bg-gradient-to-r from-emerald-600 to-teal-600'
    : page.attr?.cover === 'gray'
    ? 'bg-dark-200'
    : 'bg-gradient-to-r from-dark-700 to-indigo-600'
}`} />
```

### 3. Icon + Title

```tsx
<div className="flex items-center gap-3">
  <div className="w-12 h-12 text-3xl flex items-center justify-center bg-dark-100 rounded-md border">
    {page.attr?.icon || '📄'}
  </div>
  <h1 className="text-sm font-normal text-dark-600">{page.name}</h1>
</div>
```

### 4. HTML Content Rendering

```tsx
<article className="bg-dark-100 border rounded-md p-6 prose max-w-none">
  <div dangerouslySetInnerHTML={{
    __html: page.content_html || page.contentHtml || ''
  }} />
</article>
```

---

## Navigation

| Action | Target |
|--------|--------|
| Edit button | `/wiki/{id}/edit` |
| Back button | `/wiki` |

---

## Wiki Page Structure

```typescript
interface WikiPage {
  id: string;
  name: string;
  content_html?: string;      // Rendered HTML
  contentHtml?: string;       // Alternative key
  attr?: {
    icon?: string;            // Emoji icon
    cover?: string;           // Cover gradient
    path?: string;            // Navigation path
  };
  updatedTs?: string;         // ISO timestamp
  updated_ts?: string;        // Alternative key
}
```

---

## Related Pages

| Page | Relationship |
|------|--------------|
| [WikiEditorPage](./WikiEditorPage.md) | Edit mode |
| [EntityListOfInstancesPage](./EntityListOfInstancesPage.md) | Wiki list view |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v9.0.0 | 2025-12-03 | Design system v10.0 |
| v1.0.0 | 2025-10-01 | Initial release |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
