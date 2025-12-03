# EmailDesignerPage

**Version:** 9.0.0 | **Location:** `apps/web/src/pages/marketing/EmailDesignerPage.tsx` | **Updated:** 2025-12-03

---

## Overview

EmailDesignerPage provides a drag-and-drop canvas for designing email templates. It uses the CanvasEmailDesigner component and loads/saves templates via the marketing API.

**Core Principles:**
- Drag-and-drop email design via CanvasEmailDesigner
- Template loading from marketing API
- Auto-parse JSON template_schema
- Full-screen editor experience

---

## Page Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      EMAILDESIGNERPAGE ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Route: /marketing/{id}/edit                                                │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  CanvasEmailDesigner (Full-Screen Editor)                               ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Toolbar: [Exit] | Template Name | [Save]                           │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  │  ┌───────────────┬─────────────────────────────────────────────────────┐││
│  │  │  Block Palette│  Canvas Preview                                     │││
│  │  │  ┌───────────┐│  ┌─────────────────────────────────────────────────┐│││
│  │  │  │ Header    ││  │  ┌───────────────────────────────────────────┐  ││││
│  │  │  │ Text      ││  │  │  [Header Block]                           │  ││││
│  │  │  │ Image     ││  │  └───────────────────────────────────────────┘  ││││
│  │  │  │ Button    ││  │  ┌───────────────────────────────────────────┐  ││││
│  │  │  │ Divider   ││  │  │  [Text Block]                             │  ││││
│  │  │  │ Spacer    ││  │  └───────────────────────────────────────────┘  ││││
│  │  │  │ Columns   ││  │  ┌───────────────────────────────────────────┐  ││││
│  │  │  │ Social    ││  │  │  [Button Block]                           │  ││││
│  │  │  └───────────┘│  │  └───────────────────────────────────────────┘  ││││
│  │  └───────────────┴──└─────────────────────────────────────────────────┘│││
│  │                                                                         ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Properties Panel (when block selected)                             │││
│  │  │  Text Color: [#333333]  Font Size: [16px]  Padding: [20px]         │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. Template Loading

```typescript
useEffect(() => {
  if (id) {
    loadTemplate();
  }
}, [id]);

const loadTemplate = async () => {
  const api = APIFactory.getAPI('marketing');
  const data = await api.get(id!);

  // Parse template_schema if it's a string
  if (data.template_schema && typeof data.template_schema === 'string') {
    data.template_schema = JSON.parse(data.template_schema);
  }

  setTemplate(data);
};
```

### 2. Save Handler

```typescript
const handleSave = async (schema: any) => {
  const api = APIFactory.getAPI('marketing');
  await api.update(id!, { template_schema: schema });
  console.log('Email template saved successfully!');
};
```

### 3. Error Handling

```tsx
if (error || !template) {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <p className="text-red-600 mb-4">{error || 'Template not found'}</p>
        <button onClick={() => navigate('/marketing')}>
          Back to Marketing
        </button>
      </div>
    </div>
  );
}
```

---

## Template Schema Structure

```typescript
interface EmailTemplateSchema {
  blocks: EmailBlock[];
  settings?: {
    backgroundColor?: string;
    width?: number;
  };
}

interface EmailBlock {
  id: string;
  type: 'header' | 'text' | 'image' | 'button' | 'divider' | 'spacer' | 'columns' | 'social';
  props: Record<string, any>;
}
```

---

## Block Types

| Block | Purpose | Key Props |
|-------|---------|-----------|
| `header` | Page header | text, backgroundColor |
| `text` | Body text | content, fontSize, color |
| `image` | Image block | src, alt, width |
| `button` | CTA button | text, href, backgroundColor |
| `divider` | Horizontal line | color, thickness |
| `spacer` | Vertical space | height |
| `columns` | Multi-column layout | columns[] |
| `social` | Social icons | icons[] |

---

## Related Pages

| Page | Relationship |
|------|--------------|
| [EntityListOfInstancesPage](./EntityListOfInstancesPage.md) | Marketing list |
| [EntitySpecificInstancePage](./EntitySpecificInstancePage.md) | Template details |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v9.0.0 | 2025-12-03 | CanvasEmailDesigner integration |
| v1.0.0 | 2025-10-01 | Initial release |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
