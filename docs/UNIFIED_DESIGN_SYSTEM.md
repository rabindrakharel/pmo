# 🎨 Unified Design System - PMO Platform

## Overview

The **Unified Design System** provides a coherent, scalable, and efficient framework for all content creation and interaction across the PMO platform. It eliminates UI/UX inconsistencies by establishing universal patterns that work across forms, wiki pages, emails, reports, and any future entity types.

---

## 🏗️ Architecture

### Core Principles

1. **Consistency**: Same patterns across all entity types
2. **Scalability**: Easy to extend for new entity types
3. **Efficiency**: Reusable components reduce development time
4. **Accessibility**: WCAG 2.1 AA compliant
5. **Performance**: Optimized rendering and interactions

### Component Hierarchy

```
┌─────────────────────────────────────────┐
│         UniversalDesigner               │
│  (Base framework for all designers)     │
├─────────────┬───────────┬───────────────┤
│   Toolbar   │  Canvas   │  Properties   │
│  (Blocks)   │ (Content) │  (Settings)   │
└─────────────┴───────────┴───────────────┘
       │              │              │
       └──────── UniversalBlock ──────┘
                 (Content units)
                       │
                 InlineEdit
              (Seamless editing)
```

---

## 📦 Components

### 1. UniversalDesigner

**Purpose**: Base layout framework for all designers (Form, Wiki, Email, Report, etc.)

**Features**:
- 3-panel layout (Toolbar | Canvas | Properties)
- View mode switcher (Design | Preview | Code)
- Collapsible sidebars
- Unified action bar
- Editable title
- Custom footer support

**Usage Example**:

```tsx
import { UniversalDesigner } from '@/components/shared/designer';

function MyDesigner() {
  return (
    <UniversalDesigner
      title="My Document"
      titleEditable
      onTitleChange={(newTitle) => setTitle(newTitle)}

      viewModes={[
        { id: 'design', label: 'Design' },
        { id: 'preview', label: 'Preview', icon: <Eye /> },
      ]}
      currentViewMode={viewMode}
      onViewModeChange={setViewMode}

      toolbar={<MyToolbar />}
      canvas={<MyCanvas />}
      properties={<MyProperties />}

      primaryAction={{
        id: 'save',
        label: 'Save',
        icon: <Save />,
        onClick: handleSave,
        loading: isSaving,
      }}
      onCancel={handleCancel}
    />
  );
}
```

**Props**:

| Prop | Type | Description |
|------|------|-------------|
| `title` | `string` | Document title |
| `titleEditable` | `boolean` | Allow inline title editing |
| `onTitleChange` | `(title: string) => void` | Title change handler |
| `viewModes` | `DesignerViewMode[]` | Available view modes |
| `currentViewMode` | `string` | Active view mode ID |
| `toolbar` | `ReactNode` | Left sidebar content |
| `canvas` | `ReactNode` | Center canvas content |
| `properties` | `ReactNode` | Right sidebar content |
| `primaryAction` | `DesignerAction` | Main action button (Save) |
| `actions` | `DesignerAction[]` | Additional actions |

---

### 2. UniversalBlock

**Purpose**: Unified block component for all content types (wiki blocks, email blocks, form fields)

**Features**:
- Drag & drop reordering
- Context menu (duplicate, delete, move, hide, lock)
- Visual feedback (hover, selection, drag)
- Consistent styling
- Accessibility support

**Usage Example**:

```tsx
import { UniversalBlock, UniversalBlockContainer } from '@/components/shared/designer';
import { DndContext, SortableContext } from '@dnd-kit/core';

function MyBlocks() {
  return (
    <DndContext onDragEnd={handleDragEnd}>
      <SortableContext items={blocks.map(b => b.id)}>
        <UniversalBlockContainer
          emptyState={<EmptyPlaceholder />}
        >
          {blocks.map(block => (
            <UniversalBlock
              key={block.id}
              id={block.id}
              type={block.type}
              isSelected={selectedBlockId === block.id}
              onSelect={() => setSelectedBlockId(block.id)}
              onDuplicate={() => duplicateBlock(block.id)}
              onDelete={() => deleteBlock(block.id)}
              onMoveUp={() => moveBlockUp(block.id)}
              onMoveDown={() => moveBlockDown(block.id)}
            >
              <BlockContent block={block} />
            </UniversalBlock>
          ))}
        </UniversalBlockContainer>
      </SortableContext>
    </DndContext>
  );
}
```

**Props**:

| Prop | Type | Description |
|------|------|-------------|
| `id` | `string` | Unique block identifier |
| `type` | `string` | Block type (heading, paragraph, form-field, etc.) |
| `children` | `ReactNode` | Block content |
| `isSelected` | `boolean` | Selection state |
| `isLocked` | `boolean` | Lock state (prevents editing/dragging) |
| `isHidden` | `boolean` | Visibility state |
| `onSelect` | `() => void` | Selection handler |
| `onDuplicate` | `() => void` | Duplicate handler |
| `onDelete` | `() => void` | Delete handler |
| `onMoveUp` | `() => void` | Move up handler |
| `onMoveDown` | `() => void` | Move down handler |
| `onToggleVisibility` | `() => void` | Toggle visibility |
| `onToggleLock` | `() => void` | Toggle lock |

---

### 3. InlineEdit Components

**Purpose**: Seamless inline editing across all entity detail views

**Components**:
- `InlineText` - Single-line text
- `InlineTextarea` - Multi-line text
- `InlineSelect` - Dropdown selection
- `InlineNumber` - Numeric input (with prefix/suffix support)
- `InlineDate` - Date picker

**Features**:
- Click to edit
- Keyboard shortcuts (Enter to save, Escape to cancel)
- Visual feedback (hover states, edit mode indicators)
- Save/Cancel actions
- Loading states

**Usage Example**:

```tsx
import {
  InlineText,
  InlineTextarea,
  InlineSelect,
  InlineNumber,
  InlineDate,
} from '@/components/shared/designer';

function EntityDetailView({ entity, onUpdate }) {
  return (
    <div className="space-y-4">
      <InlineText
        label="Name"
        value={entity.name}
        onSave={(newName) => onUpdate({ name: newName })}
        required
      />

      <InlineTextarea
        label="Description"
        value={entity.description}
        onSave={(newDesc) => onUpdate({ description: newDesc })}
      />

      <InlineSelect
        label="Status"
        value={entity.status}
        options={[
          { value: 'draft', label: 'Draft' },
          { value: 'published', label: 'Published' },
        ]}
        onSave={(newStatus) => onUpdate({ status: newStatus })}
      />

      <InlineNumber
        label="Budget"
        value={entity.budget}
        prefix="$"
        onSave={(newBudget) => onUpdate({ budget: newBudget })}
      />

      <InlineDate
        label="Due Date"
        value={entity.dueDate}
        onSave={(newDate) => onUpdate({ dueDate: newDate })}
      />
    </div>
  );
}
```

**Common Props**:

| Prop | Type | Description |
|------|------|-------------|
| `value` | `any` | Current value |
| `onSave` | `(value) => void \| Promise<void>` | Save handler |
| `label` | `string` | Field label |
| `placeholder` | `string` | Placeholder text |
| `disabled` | `boolean` | Disable editing |
| `required` | `boolean` | Required field |

---

## 🎯 Use Cases

### 1. Wiki Designer

```tsx
import { UniversalDesigner } from '@/components/shared/designer';
import { WikiToolbar, WikiProperties } from './wiki-components';
import { EditorContent } from '@tiptap/react';

function WikiDesigner({ page, onSave }) {
  return (
    <UniversalDesigner
      title={page.title}
      titleEditable
      icon={<BookOpen />}

      toolbar={<WikiToolbar editor={editor} />}
      canvas={<EditorContent editor={editor} />}
      properties={<WikiProperties page={page} editor={editor} />}

      primaryAction={{
        id: 'save',
        label: 'Publish',
        onClick: () => onSave(page),
      }}
    />
  );
}
```

### 2. Form Designer

```tsx
import { UniversalDesigner } from '@/components/shared/designer';
import { FormFieldPalette, FormCanvas, FormProperties } from './form-components';

function FormDesigner({ form, onSave }) {
  return (
    <UniversalDesigner
      title={form.name}
      titleEditable
      icon={<FileText />}

      toolbar={<FormFieldPalette onAddField={handleAddField} />}
      canvas={
        <FormCanvas
          fields={form.fields}
          onUpdateField={handleUpdateField}
        />
      }
      properties={<FormProperties form={form} />}

      primaryAction={{
        id: 'save',
        label: 'Save Form',
        onClick: () => onSave(form),
      }}
    />
  );
}
```

### 3. Email Designer

```tsx
import { UniversalDesigner } from '@/components/shared/designer';
import { EmailBlockToolbar, EmailCanvas, EmailProperties } from './email-components';

function EmailDesigner({ template, onSave }) {
  return (
    <UniversalDesigner
      title={template.subject}
      titleEditable
      icon={<Mail />}

      viewModes={[
        { id: 'design', label: 'Design' },
        { id: 'preview', label: 'Preview', icon: <Eye /> },
        { id: 'html', label: 'HTML', icon: <Code /> },
      ]}

      toolbar={<EmailBlockToolbar onAddBlock={handleAddBlock} />}
      canvas={<EmailCanvas blocks={template.blocks} />}
      properties={<EmailProperties template={template} />}

      primaryAction={{
        id: 'save',
        label: 'Save Template',
        onClick: () => onSave(template),
      }}
    />
  );
}
```

### 4. Entity Detail with Inline Editing

```tsx
import { InlineText, InlineTextarea, InlineSelect, InlineDate } from '@/components/shared/designer';

function ProjectDetail({ project, onUpdate }) {
  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-2 gap-4">
        <InlineText
          label="Project Name"
          value={project.name}
          onSave={(name) => onUpdate({ name })}
          required
        />

        <InlineSelect
          label="Status"
          value={project.status}
          options={PROJECT_STATUSES}
          onSave={(status) => onUpdate({ status })}
        />

        <InlineDate
          label="Start Date"
          value={project.startDate}
          onSave={(startDate) => onUpdate({ startDate })}
        />

        <InlineDate
          label="End Date"
          value={project.endDate}
          onSave={(endDate) => onUpdate({ endDate })}
        />
      </div>

      <InlineTextarea
        label="Description"
        value={project.description}
        onSave={(description) => onUpdate({ description })}
      />
    </div>
  );
}
```

---

## 🎨 Design Patterns

### 1. Consistent Layout

All designers follow the same 3-panel layout:

```
┌──────────────────────────────────────────────────────┐
│  [Icon] Title          [Design|Preview|Code]  [Save] │ ← Header
├────────┬────────────────────────────┬─────────────────┤
│        │                            │                 │
│ Tool-  │         Canvas             │   Properties    │ ← Main
│ bar    │      (Editable Area)       │   (Settings)    │
│        │                            │                 │
│ [+]    │  ┌──────────────────┐     │  Name: ____     │
│ Block  │  │ Selected Block   │     │  Status: ▼      │
│ Types  │  └──────────────────┘     │  Tags: [+]      │
│        │                            │                 │
└────────┴────────────────────────────┴─────────────────┘
```

### 2. Block-Based Content

All content is represented as blocks:

```typescript
interface Block {
  id: string;
  type: string;
  content: any;
  metadata?: any;
}

// Wiki Block
{ id: 'h1', type: 'heading', content: 'My Title', metadata: { level: 1 } }

// Form Field Block
{ id: 'f1', type: 'text', content: { label: 'Name', placeholder: 'Enter name' } }

// Email Block
{ id: 'e1', type: 'image', content: { src: 'image.jpg', alt: 'Logo' } }
```

### 3. Unified Actions

Consistent action patterns across all designers:

- **Primary**: Save, Publish, Send
- **Secondary**: Preview, Export, Share
- **Cancel**: Always available in top-right

### 4. Drag & Drop

Universal drag-and-drop using `@dnd-kit`:

```tsx
<DndContext onDragEnd={handleReorder}>
  <SortableContext items={blockIds}>
    {blocks.map(block => (
      <UniversalBlock {...block} />
    ))}
  </SortableContext>
</DndContext>
```

---

## 🚀 Migration Guide

### Migrating Existing Designers

**Before** (Old WikiDesigner):
```tsx
function WikiDesigner() {
  return (
    <div className="custom-layout">
      <div className="custom-toolbar">...</div>
      <div className="custom-canvas">...</div>
      <div className="custom-properties">...</div>
    </div>
  );
}
```

**After** (Using UniversalDesigner):
```tsx
import { UniversalDesigner } from '@/components/shared/designer';

function WikiDesigner() {
  return (
    <UniversalDesigner
      title="Wiki Page"
      toolbar={<Toolbar />}
      canvas={<Canvas />}
      properties={<Properties />}
      primaryAction={{ label: 'Save', onClick: handleSave }}
    />
  );
}
```

**Benefits**:
- ✅ 70% less custom layout code
- ✅ Automatic responsive behavior
- ✅ Consistent UX across platform
- ✅ Built-in collapsible sidebars
- ✅ Keyboard shortcuts support

---

## 📊 Component Matrix

| Feature | UniversalDesigner | UniversalBlock | InlineEdit |
|---------|-------------------|----------------|------------|
| **Drag & Drop** | Container | ✅ Yes | ❌ No |
| **Keyboard Nav** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Responsive** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Accessibility** | ✅ ARIA | ✅ ARIA | ✅ ARIA |
| **Customizable** | ✅ High | ✅ Medium | ✅ Medium |
| **Use Case** | Designers | Content | Entity Fields |

---

## 🎓 Best Practices

### 1. Component Selection

- Use **UniversalDesigner** for:
  - Form builders
  - Wiki/document editors
  - Email template designers
  - Report builders
  - Any multi-panel creation interface

- Use **UniversalBlock** for:
  - Draggable content units
  - Form fields
  - Content sections
  - Email blocks

- Use **InlineEdit** for:
  - Entity detail pages
  - Quick field updates
  - Settings panels
  - Profile information

### 2. Consistency Rules

1. **Always** use UniversalDesigner for complex editors
2. **Always** provide keyboard shortcuts (Ctrl+S for save, Esc for cancel)
3. **Always** show loading states during async operations
4. **Never** create custom layout components when UniversalDesigner exists
5. **Never** mix inline edit with traditional forms in same view

### 3. Performance Tips

- Lazy load toolbar/properties content
- Virtualize long block lists (use `react-window`)
- Debounce autosave operations
- Memoize expensive components

```tsx
const MemoizedCanvas = React.memo(Canvas);
const MemoizedToolbar = React.memo(Toolbar);
```

---

## 🔮 Future Enhancements

- [ ] Dark mode support
- [ ] Custom themes per entity type
- [ ] AI-assisted block suggestions
- [ ] Real-time collaboration
- [ ] Version history UI
- [ ] Template marketplace
- [ ] Mobile-optimized layouts
- [ ] Accessibility improvements (WCAG 2.2 AAA)

---

## 📚 Additional Resources

- [TipTap Documentation](https://tiptap.dev/) - Rich text editor
- [DnD Kit Documentation](https://dndkit.com/) - Drag and drop
- [Tailwind CSS](https://tailwindcss.com/) - Styling system
- [React ARIA](https://react-spectrum.adobe.com/react-aria/) - Accessibility

---

## 💬 Support

For questions or contributions:
- 📖 Read the inline documentation
- 🐛 Report issues in the project repository
- 💡 Suggest improvements via pull requests

---

**Built with ❤️ for the PMO Platform**
