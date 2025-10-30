# LLM/AI Agent Instructions - PMO Platform Development Guide

> **Comprehensive development guidelines for AI agents** - Critical patterns, styling rules, and architectural principles for building and extending the PMO platform

**Target Audience:** AI Language Models (Claude, GPT, etc.) working on code generation, refactoring, and feature development
**Last Updated:** 2025-10-29
**Version:** 3.0 - Complete Styling & Architecture Guide

---

## Table of Contents

1. [Critical Design System Rules](#1-critical-design-system-rules)
2. [Typography Standards](#2-typography-standards)
3. [Icon Standards](#3-icon-standards)
4. [Button Implementation](#4-button-implementation)
5. [Label & Badge Implementation](#5-label--badge-implementation)
6. [Tab Navigation Implementation](#6-tab-navigation-implementation)
7. [Form Elements](#7-form-elements)
8. [Color Usage Rules](#8-color-usage-rules)
9. [Spacing & Layout Rules](#9-spacing--layout-rules)
10. [Component Architecture Patterns](#10-component-architecture-patterns)
11. [Common Mistakes to Avoid](#11-common-mistakes-to-avoid)
12. [Code Generation Templates](#12-code-generation-templates)

---

## 1. Critical Design System Rules

### ⚠️ MANDATORY RULES - Never Violate

**Border Standard:**
```typescript
// ✅ CORRECT - Use gray-300 for ALL borders
border border-gray-300

// ❌ WRONG - Never use these
border border-gray-400  // Too dark
border border-gray-500  // Too dark
border border-slate-*   // Wrong color family
border border-blue-*    // Only for semantic states
```

**Icon Size Standard:**
```typescript
// ✅ CORRECT - Default icon size for actions
h-4 w-4 stroke-[1.5]

// ❌ WRONG - Don't use h-5 w-5 for action icons anymore
h-5 w-5  // Deprecated for action buttons (only use for special cases)
```

**Tab Design Standard:**
```typescript
// ✅ CORRECT - Minimalistic underline only
border-b-2 border-gray-300 text-gray-700  // Active
border-transparent text-gray-600 hover:border-gray-300  // Inactive

// ❌ WRONG - No decorative effects
bg-gradient-to-*  // No gradients on tabs
shadow-*          // No shadows on tabs
scale-*           // No scale transforms on tabs
```

---

## 2. Typography Standards

### 2.1 Font Sizes - When to Use What

**Decision Tree:**
```typescript
// Is it a category header or uppercase label?
→ text-[10px] font-medium uppercase tracking-wider

// Is it metadata value or badge text?
→ text-xs (12px)

// Is it body text, button, or input?
→ text-sm (14px)

// Is it a page title?
→ text-2xl (24px)
```

### 2.2 Font Weight Selection

```typescript
// RULE: Use font-normal (400) for MOST UI elements
// Buttons, navigation, tabs, body text → font-normal

// RULE: Use font-medium (500) for emphasis
// Uppercase labels, metadata values, table headers → font-medium

// RULE: Use font-semibold (600) rarely
// Only page titles and major section headers → font-semibold
```

### 2.3 Uppercase Labels Pattern

**When to Apply:**
- Category headers in sidebars
- Metadata field labels
- Table column headers
- Section dividers

**Standard Implementation:**
```jsx
<span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
  {label}:
</span>
```

**⚠️ ALWAYS pair uppercase with:**
1. `text-[10px]` font size
2. `font-medium` weight
3. `tracking-wider` or `tracking-wide` spacing
4. `text-gray-400` or `text-gray-500` color

---

## 3. Icon Standards

### 3.1 Icon Sizing Decision Tree

```typescript
// Status icon in badge? → h-3 w-3
// Tab icon? → h-3.5 w-3.5
// Action button / Navigation / Metadata? → h-4 w-4 (DEFAULT)
// Page header / Logo? → h-6 w-6 or h-7 w-7
```

### 3.2 Icon Color Selection

```typescript
// Default state → text-gray-600
// Muted/inactive → text-gray-500
// Disabled → text-gray-400
// Active navigation → text-gray-700
// Success → text-green-600
// Error → text-red-600
```

### 3.3 Icon Implementation Template

```jsx
// Navigation icon (with hover)
<Settings className="h-4 w-4 text-gray-500 group-hover:text-gray-600 stroke-[1.5]" />

// Action icon (no hover needed)
<Edit className="h-4 w-4 text-gray-600 stroke-[1.5]" />

// Tab icon (smaller)
<CheckSquare className="h-3.5 w-3.5 stroke-[1.5]" />

// Status icon (semantic color)
<Check className="h-3 w-3 text-green-600" />
```

### 3.4 Icon + Text Pattern

```jsx
// Standard gap: 1.5 or 2
<div className="inline-flex items-center gap-1.5">
  <Icon className="h-3.5 w-3.5 stroke-[1.5]" />
  <span className="text-xs">Label</span>
</div>

// Buttons automatically handle spacing via icon prop
<Button icon={Save} size="md">Save</Button>
```

---

## 4. Button Implementation

### 4.1 Button Component Usage

**Import:**
```jsx
import { Button } from '../components/shared/button/Button';
```

**Standard Patterns:**
```jsx
// Primary action
<Button variant="primary" size="md" icon={Save} onClick={handleSave}>
  Save Changes
</Button>

// Secondary/cancel
<Button variant="secondary" size="sm" onClick={handleCancel}>
  Cancel
</Button>

// Danger/delete
<Button variant="danger" icon={Trash} onClick={handleDelete}>
  Delete
</Button>

// Icon-only button (use raw button element)
<button
  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
  onClick={handleEdit}
>
  <Edit className="h-4 w-4 text-gray-600 stroke-[1.5]" />
</button>
```

### 4.2 Button Size Selection

```typescript
// Inline actions, compact UIs → size="sm"
// Default buttons → size="md"
// Hero actions, emphasized → size="lg"
```

### 4.3 Loading & Disabled States

```jsx
// Loading state (automatic via component)
<Button loading={isSubmitting}>Submit</Button>

// Disabled state
<Button disabled={!isValid}>Save</Button>
```

---

## 5. Label & Badge Implementation

### 5.1 Metadata Label + Value Pattern

```jsx
// Standard metadata field
<div className="flex items-center gap-1.5">
  {/* Label - uppercase, small, gray */}
  <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
    Code:
  </span>

  {/* Value - medium weight, darker */}
  <span className="text-xs text-gray-800 font-medium">
    PROJ-2024-001
  </span>
</div>
```

### 5.2 Badge Implementation

**Standard Badge:**
```jsx
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
  {label}
</span>
```

**Color Selection:**
```jsx
// Success/complete → bg-green-100 text-green-800
// Error/failed → bg-red-100 text-red-800
// Warning/pending → bg-yellow-100 text-yellow-800
// Info/active → bg-blue-100 text-blue-800
// Default/neutral → bg-gray-100 text-gray-800
```

**Count Badge (for tabs, notifications):**
```jsx
<span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-normal bg-gray-100 text-gray-600">
  {count}
</span>
```

### 5.3 Category Header Pattern

```jsx
<div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
  Configuration
</div>
```

---

## 6. Tab Navigation Implementation

### 6.1 Tab Component Usage

**Import:**
```jsx
import { DynamicChildEntityTabs, useDynamicChildEntityTabs } from '../components/shared/entity/DynamicChildEntityTabs';
```

**Standard Implementation:**
```jsx
function EntityDetailPage() {
  const { tabs, loading } = useDynamicChildEntityTabs(entityType, entityId);

  return (
    <DynamicChildEntityTabs
      title={entityName}
      parentType={entityType}
      parentId={entityId}
      tabs={tabs}
    />
  );
}
```

### 6.2 Tab Design Rules

**✅ DO:**
- Use simple `border-b-2` underline for active state
- Keep text `text-gray-700` for active, `text-gray-600` for inactive
- Use `h-3.5 w-3.5` for tab icons
- Add count badges with standard pattern
- Use `gap-6` between tabs

**❌ DON'T:**
- Add gradients or shadows to tabs
- Change font color on hover (only border)
- Use decorative effects or animations
- Scale or transform tabs on interaction

---

## 7. Form Elements

### 7.1 Standard Input

```jsx
<input
  type="text"
  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md
             focus:outline-none focus:ring-2 focus:ring-gray-400/30 focus:border-gray-300
             placeholder:text-gray-400"
  placeholder="Enter text..."
/>
```

### 7.2 Search Input

```jsx
<div className="relative">
  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
  <input
    type="text"
    placeholder="Search..."
    className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md
               focus:outline-none focus:ring-2 focus:ring-gray-400/30 focus:border-gray-300"
  />
</div>
```

### 7.3 Select Dropdown

```jsx
<select
  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm
             focus:outline-none focus:ring-2 focus:ring-gray-400/30 focus:border-gray-300
             bg-white cursor-pointer"
>
  <option value="">Select option</option>
  {options.map(opt => (
    <option key={opt.value} value={opt.value}>{opt.label}</option>
  ))}
</select>
```

---

## 8. Color Usage Rules

### 8.1 Text Color Decision Tree

```typescript
// Is it a primary heading? → text-gray-900 (rare, mostly use gray-800)
// Is it metadata value or strong text? → text-gray-800
// Is it active tab or button text? → text-gray-700
// Is it default text or icon? → text-gray-600
// Is it category header or muted? → text-gray-500
// Is it label or placeholder? → text-gray-400
```

### 8.2 Background Color Decision Tree

```typescript
// Is it a card or modal? → bg-white
// Is it page background? → bg-gray-50
// Is it hover state? → hover:bg-gray-100
// Is it disabled or count badge? → bg-gray-100
```

### 8.3 Border Color Rules

```typescript
// ⚠️ CRITICAL RULE: Use border-gray-300 for EVERYTHING except:
// - Subtle dividers → border-gray-200
// - Error states → border-red-500
// - Success states → border-green-500 (rare)
```

---

## 9. Spacing & Layout Rules

### 9.1 Padding Selection

```typescript
// Inline elements (badges, small buttons) → px-2.5 py-0.5 or px-2 py-1
// Inputs and form fields → px-3 py-1.5
// Cards and panels → p-4
// Large cards → p-6
// Page containers → px-6 py-4
// Headers (compact v6.0) → px-6 py-2
```

### 9.2 Gap Selection

```typescript
// Icon + text in metadata/tabs → gap-1.5
// Icon + text in buttons → gap-2
// Button groups → gap-3
// Form fields → gap-4
// Tab navigation → gap-6
```

### 9.3 Margin Between Elements

```typescript
// Tight spacing → mb-1 or mb-2
// Standard sections → mb-4
// Major sections → mb-6
```

---

## 10. Component Architecture Patterns

### 10.1 Sidebar Navigation Item

```jsx
<button
  className={`
    ${isActive
      ? 'bg-gray-100 text-gray-900 border-r-2 border-gray-300'
      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
    }
    w-full group flex items-center
    ${isCollapsed ? 'justify-center px-2' : 'px-3'}
    py-1.5 text-sm font-normal rounded-l-lg transition-all duration-200
  `}
>
  <Icon className={`
    ${isActive ? 'text-gray-700' : 'text-gray-500 group-hover:text-gray-600'}
    ${isCollapsed ? '' : 'mr-3'}
    h-4 w-4 stroke-[1.5]
  `} />
  {!isCollapsed && <span>{label}</span>}
</button>
```

### 10.2 Card Pattern

```jsx
<div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 p-4">
  {/* Card header */}
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
    <button className="p-1.5 hover:bg-gray-100 rounded-lg">
      <MoreVertical className="h-4 w-4 text-gray-600" />
    </button>
  </div>

  {/* Card content */}
  <div className="space-y-2">
    {content}
  </div>
</div>
```

### 10.3 Table Pattern

```jsx
<div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
  <table className="min-w-full divide-y divide-gray-200">
    <thead className="bg-gray-50">
      <tr>
        <th className="px-3 py-1.5 text-left text-[11px] font-normal text-gray-600 uppercase tracking-wider">
          {column}
        </th>
      </tr>
    </thead>
    <tbody className="bg-white divide-y divide-gray-100">
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="px-3 py-1.5 text-xs text-gray-700">
          {cell}
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## 11. Common Mistakes to Avoid

### ❌ Mistake 1: Using Wrong Border Color

```typescript
// ❌ WRONG
border border-gray-400
border border-slate-600

// ✅ CORRECT
border border-gray-300
```

### ❌ Mistake 2: Using Large Icons for Actions

```typescript
// ❌ WRONG
<Edit className="h-5 w-5" />

// ✅ CORRECT
<Edit className="h-4 w-4 stroke-[1.5]" />
```

### ❌ Mistake 3: Decorative Tab Designs

```typescript
// ❌ WRONG
<button className="border-b-2 border-blue-500 bg-gradient-to-r shadow-lg">

// ✅ CORRECT
<button className="border-b-2 border-gray-300 text-gray-700">
```

### ❌ Mistake 4: Inconsistent Label Styling

```typescript
// ❌ WRONG
<span className="text-sm text-gray-600">Label:</span>

// ✅ CORRECT
<span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
  Label:
</span>
```

### ❌ Mistake 5: Missing Stroke Width on Icons

```typescript
// ❌ WRONG
<Settings className="h-4 w-4" />

// ✅ CORRECT
<Settings className="h-4 w-4 stroke-[1.5]" />
```

### ❌ Mistake 6: Using Wrong Font Weight

```typescript
// ❌ WRONG - Don't use font-bold everywhere
<button className="font-bold">Button</button>

// ✅ CORRECT - Use font-normal for buttons
<button className="font-normal">Button</button>
```

---

## 12. Code Generation Templates

### Template 1: New Page with Header & Content

```jsx
import React from 'react';
import { Button } from '../components/shared/button/Button';
import { Plus } from 'lucide-react';

export function NewPage() {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Page Title
        </h1>
        <Button variant="primary" icon={Plus}>
          Create New
        </Button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg border border-gray-300 shadow-sm p-4">
        {/* Page content */}
      </div>
    </div>
  );
}
```

### Template 2: Metadata Display Row

```jsx
<div className="flex items-center space-x-3">
  {/* Field 1 */}
  <div className="flex items-center gap-1.5">
    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
      Code:
    </span>
    <span className="text-xs text-gray-800 font-medium">
      PROJ-001
    </span>
  </div>

  {/* Separator */}
  <span className="text-gray-300">·</span>

  {/* Field 2 */}
  <div className="flex items-center gap-1.5">
    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
      Status:
    </span>
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
      Active
    </span>
  </div>
</div>
```

### Template 3: Form with Input Fields

```jsx
<form onSubmit={handleSubmit} className="space-y-4">
  {/* Text input */}
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Project Name
    </label>
    <input
      type="text"
      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md
                 focus:outline-none focus:ring-2 focus:ring-gray-400/30 focus:border-gray-300"
      placeholder="Enter project name..."
    />
  </div>

  {/* Select */}
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Status
    </label>
    <select className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm
                       focus:outline-none focus:ring-2 focus:ring-gray-400/30 focus:border-gray-300">
      <option value="">Select status</option>
      <option value="active">Active</option>
      <option value="completed">Completed</option>
    </select>
  </div>

  {/* Actions */}
  <div className="flex items-center gap-3 pt-4">
    <Button type="button" variant="secondary" onClick={handleCancel}>
      Cancel
    </Button>
    <Button type="submit" variant="primary">
      Save
    </Button>
  </div>
</form>
```

### Template 4: Icon-Only Action Buttons

```jsx
<div className="flex items-center gap-1.5">
  <button
    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
    title="Edit"
  >
    <Edit className="h-4 w-4 text-gray-600 stroke-[1.5]" />
  </button>

  <button
    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
    title="Share"
  >
    <Share className="h-4 w-4 text-gray-600 stroke-[1.5]" />
  </button>

  <button
    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
    title="Delete"
  >
    <Trash className="h-4 w-4 text-red-600 stroke-[1.5]" />
  </button>
</div>
```

---

## Quick Decision Flowcharts

### When Building a New Component:

1. **Choose Border:** → Always `border-gray-300`
2. **Choose Icon Size:** → Default to `h-4 w-4`
3. **Choose Text Color:** → Body text: `text-gray-700`, Icons: `text-gray-600`
4. **Choose Font Weight:** → Default to `font-normal` (400)
5. **Choose Padding:** → Cards: `p-4`, Inputs: `px-3 py-1.5`
6. **Choose Border Radius:** → Buttons/inputs: `rounded-md`, Cards: `rounded-lg`, Badges: `rounded-full`

### When Styling Text:

1. **Is it uppercase?** → `text-[10px] font-medium uppercase tracking-wider`
2. **Is it a value?** → `text-xs text-gray-800 font-medium`
3. **Is it body text?** → `text-sm text-gray-700`
4. **Is it a page title?** → `text-2xl font-semibold text-gray-900`

### When Adding Icons:

1. **Action button?** → `h-4 w-4 stroke-[1.5]`
2. **Tab?** → `h-3.5 w-3.5 stroke-[1.5]`
3. **Badge status?** → `h-3 w-3`
4. **Always add:** `stroke-[1.5]` and appropriate color

---

## Documentation References

**For detailed styling patterns:** `/docs/styling_patterns.md`
**For architecture:** `/docs/ui_ux_route_api.md`
**For data model:** `/docs/datamodel.md`

---

## Final Checklist Before Code Submission

- [ ] All borders use `border-gray-300` (not gray-400+)
- [ ] All action icons use `h-4 w-4 stroke-[1.5]`
- [ ] All icons have `stroke-[1.5]` specified
- [ ] Uppercase labels use `text-[10px] font-medium uppercase tracking-wider`
- [ ] Tabs use simple `border-b-2` underline (no gradients/shadows)
- [ ] Buttons use `Button` component with correct variant
- [ ] Form inputs use `border-gray-300` and correct focus ring
- [ ] Color usage follows gray scale hierarchy
- [ ] Spacing uses standard values (gap-1.5, gap-2, gap-3, etc.)
- [ ] Transitions use `transition-colors` or `transition-all` with duration

---

**Maintained By:** PMO Platform Team
**Last Updated:** 2025-10-29
**Version:** 3.0 - Complete LLM Development Guide
