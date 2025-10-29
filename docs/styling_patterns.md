# PMO Platform - Complete Layout & Styling Reference Guide

> **Production-ready styling standards for all components, buttons, divs, and reusable patterns** - The single source of truth for consistent UI/UX implementation across the PMO platform

**Last Updated:** 2025-10-29
**Version:** 5.0 - Universal Border Standardization
**Architecture:** Tailwind CSS v4 + React 19 + TypeScript
**Codebase Coverage:** 141+ files analyzed (71 components, 70+ pages)

## 🎨 Version 5.0 Highlights - Universal Light Gray Borders

This version standardizes all borders to light gray for consistency:
- **Standard Border: gray-300** - #D1D5DB is now the universal border color
- **All Buttons** - Light gray border style (no dark borders)
- **All Cards & Dividers** - Consistent gray-300 borders
- **All Icons & Objects** - Unified border treatment
- **607 Instances Updated** - Every border now uses gray-300 (or gray-200 for subtle)
- **No Dark Borders** - Removed gray-400, gray-500, gray-600, gray-700, gray-800, gray-900

### Previous Versions:
- **v4.0** - Borderless forms, refined typography, compact layouts, clean tabs
- **v3.0** - Metadata patterns, icon sizing, action buttons
- **v2.0** - Component standardization
- **v1.0** - Initial styling guide

---

## Quick Navigation

**For Daily Development:**
- [Reusable Constants](#1-reusable-styling-constants) - Pre-defined const values in code
- [Buttons](#2-button-patterns) - All button variants and sizes
- [Form Elements](#3-form-elements--inputs) - Inputs, textareas, selects, checkboxes
- [Layout Patterns](#4-layout--container-patterns) - Flex, grid, spacing
- [Quick Reference](#quick-reference-table) - Copy-paste ready snippets

**For System Understanding:**
- [Typography](#5-typography-system) - Font sizes, weights, line heights
- [Colors](#6-color-system) - Complete palette with semantic meanings
- [Spacing](#7-spacing-system) - Padding, margin, gap standards
- [Interactive States](#8-interactive-states) - Hover, focus, disabled, loading

---

## Table of Contents

1. [Reusable Styling Constants](#1-reusable-styling-constants)
2. [Button Patterns](#2-button-patterns)
3. [Form Elements & Inputs](#3-form-elements--inputs)
   - **3.1 Borderless Form Inputs (v4.0 New Pattern)** ⭐
   - 3.2 Standard Text Input (Legacy)
4. [Layout & Container Patterns](#4-layout--container-patterns)
   - **4.2 Container Padding Standards (v4.0 Compact)** ⭐
5. [Typography System](#5-typography-system)
   - **5.1 Metadata Display Pattern (v4.0 Enhanced)** ⭐
6. [Color System](#6-color-system)
7. [Spacing System](#7-spacing-system)
8. [Interactive States](#8-interactive-states)
9. [Border & Shadow Standards](#9-border--shadow-standards)
10. [Modal & Dialog Patterns](#10-modal--dialog-patterns)
11. [Table Patterns](#11-table-patterns)
12. [Card Patterns](#12-card-patterns)
13. [Badge & Tag Patterns](#13-badge--tag-patterns)
14. [Alert & Message Patterns](#14-alert--message-patterns)
    - **14.5 Tab Navigation Pattern (v4.0 Minimalistic)** ⭐
15. [Icon Standards](#15-icon-standards)
    - **15.1 Icon Sizing Scale (v4.0 Updated)** ⭐
16. [Page Layout Templates](#16-page-layout-templates)
17. [Component-Specific Patterns](#17-component-specific-patterns)
18. [Quick Reference Table](#quick-reference-table)
    - **v4.0 Quick Copy-Paste Snippets** ⭐
19. [v4.0 Design Philosophy Summary](#v40-design-philosophy-summary) ⭐ NEW

---

## 1. Reusable Styling Constants

### 1.1 Metadata Value Class
**Location:** `apps/web/src/pages/shared/EntityDetailPage.tsx:521`

```typescript
const metadataValueClass = "text-[13px] text-gray-800 leading-[1.4] whitespace-nowrap";

const metadataValueStyle: React.CSSProperties = {
  fontFamily: "Inter, 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
  letterSpacing: '-0.01em'
};
```

**Usage:** All entity metadata displays (name, code, slug, ID)
**Occurrences:** High - used across all entity detail pages
**Pattern Type:** DRY constant for consistency

### 1.2 Button Base Classes
**Location:** `apps/web/src/components/shared/button/Button.tsx:32`

```typescript
const baseClasses = 'inline-flex items-center border text-sm font-normal rounded-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 shadow-sm';

const variantClasses = {
  primary: 'border-slate-600 text-white bg-gradient-to-b from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 hover:shadow-md focus:ring-slate-400 disabled:bg-gradient-to-b disabled:from-gray-300 disabled:to-gray-300 disabled:border-gray-300 disabled:text-gray-500 disabled:shadow-none',

  secondary: 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 hover:shadow focus:ring-gray-400 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:shadow-none',

  danger: 'border-red-500 text-white bg-gradient-to-b from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 hover:shadow-md focus:ring-red-400 disabled:bg-gradient-to-b disabled:from-gray-300 disabled:to-gray-300 disabled:border-gray-300 disabled:text-gray-500 disabled:shadow-none',

  success: 'border-emerald-500 text-white bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 hover:shadow-md focus:ring-emerald-400 disabled:bg-gradient-to-b disabled:from-gray-300 disabled:to-gray-300 disabled:border-gray-300 disabled:text-gray-500 disabled:shadow-none',

  ghost: 'border-transparent text-gray-700 hover:bg-gray-100 hover:shadow-sm focus:ring-gray-400 disabled:text-gray-400 disabled:shadow-none'
};

const sizeClasses = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base'
};
```

**Reuse Count:** 100+ across entire codebase
**Components Using:** Button, ActionButtons, RBACButton, CreateButton

### 1.3 Modal Size Classes
**Location:** `apps/web/src/components/shared/modal/Modal.tsx:23-28`

```typescript
const sizeClasses = {
  sm: 'max-w-md',     // 448px
  md: 'max-w-2xl',    // 672px - default
  lg: 'max-w-4xl',    // 896px
  xl: 'max-w-6xl'     // 1152px
};
```

### 1.4 Grid Column Responsive Classes
**Location:** `apps/web/src/components/shared/ui/GridView.tsx:105-112`

```typescript
const gridColsClasses = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5',
  6: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6'
};
```

### 1.5 Card Padding Classes
**Location:** `apps/web/src/components/shared/ui/GridView.tsx:114-118`

```typescript
const cardPaddingClasses = {
  small: 'p-4',    // 16px
  medium: 'p-6',   // 24px - default
  large: 'p-8'     // 32px
};
```

### 1.6 Badge Color Mapping
**Location:** `apps/web/src/components/shared/ui/GridView.tsx:43-51`

```typescript
const getBadgeColorClass = (variant: string) => {
  const variants = {
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
    default: 'bg-gray-100 text-gray-800'
  };
  return variants[variant] || variants.default;
};
```

### 1.7 Table Header Standard Class
**Location:** Multiple table components

```typescript
const tableHeaderClass = "px-3 py-1.5 text-left text-[11px] font-normal text-gray-600 bg-gray-50";
```

**Reuse Count:** 5+ table headers
**Purpose:** Consistent header styling across all data tables

---

## 2. Button Patterns

### 2.1 Standard Button Component
**Component:** `apps/web/src/components/shared/button/Button.tsx`

```jsx
// Usage Examples
<Button variant="primary" size="md" icon={Save} onClick={handleSave}>
  Save Changes
</Button>

<Button variant="secondary" size="sm" icon={X} onClick={handleCancel}>
  Cancel
</Button>

<Button variant="danger" size="md" loading={isDeleting} onClick={handleDelete}>
  Delete
</Button>

<Button variant="success" size="lg" icon={Check}>
  Confirm
</Button>

<Button variant="ghost" size="sm" icon={Edit}>
  Edit
</Button>
```

**Icon Sizing within Buttons:**
- Small (sm): `h-3 w-3`
- Medium (md): `h-4 w-4` ← default
- Large (lg): `h-5 w-5`

### 2.2 Icon-Only Buttons

```jsx
// Standard icon button
<button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
  <Edit className="h-4 w-4 text-gray-600" />
</button>

// Small icon button
<button className="p-1 hover:bg-gray-100 rounded transition-colors">
  <X className="h-3.5 w-3.5 text-gray-500" />
</button>

// Large icon button
<button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
  <Settings className="h-5 w-5 text-gray-600" />
</button>
```

### 2.3 Hover-Reveal Icon Buttons

```jsx
<div className="group relative">
  {/* Content */}
  <button className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-100 rounded transition-all">
    <Copy className="h-3.5 w-3.5 text-gray-400" />
  </button>
</div>
```

**Occurrences:** 25+ across EntityDetailPage, WikiDesigner, DataTable

### 2.4 Loading Button State

```jsx
{loading && (
  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
)}
```

### 2.5 Button Groups

```jsx
// Horizontal button group
<div className="flex items-center gap-3">
  <Button variant="secondary">Cancel</Button>
  <Button variant="primary">Save</Button>
</div>

// Action bar pattern
<div className="flex items-center justify-between bg-white px-6 py-4 border-b border-gray-200">
  <div className="flex items-center space-x-4">
    {/* Left actions */}
  </div>
  <div className="flex items-center space-x-3">
    {/* Right actions */}
  </div>
</div>
```

---

## 3. Form Elements & Inputs

### 3.1 Borderless Form Inputs (v4.0 New Pattern) ⭐

**Location:** `apps/web/src/components/shared/entity/EntityFormContainer.tsx`

The v4.0 design introduces elegant borderless inputs with gradient backgrounds and multi-layer shadows:

```jsx
{/* Field Container with Gradient Background */}
<div
  className={`
    relative break-words rounded-md px-3 py-2 -ml-3
    transition-all duration-300 ease-out
    ${isEditing
      ? 'bg-gradient-to-br from-gray-50/50 via-white/50 to-gray-50/30
         hover:from-blue-50/30 hover:via-white/70 hover:to-blue-50/20
         hover:shadow-[0_0_0_1px_rgba(59,130,246,0.1),0_2px_8px_-2px_rgba(59,130,246,0.08)]
         focus-within:from-white focus-within:via-white focus-within:to-blue-50/20
         focus-within:shadow-[0_0_0_1px_rgba(59,130,246,0.25),0_4px_16px_-4px_rgba(59,130,246,0.15),0_0_24px_-8px_rgba(96,165,250,0.2)]
         focus-within:scale-[1.002]'
      : 'hover:bg-gradient-to-br hover:from-gray-50/40 hover:via-white/20 hover:to-gray-50/30'
    }
  `}
>
  {/* Uppercase Label with Tracking */}
  <label
    className="text-xs font-medium text-gray-500 pt-2 flex items-center gap-1.5"
    style={{
      fontFamily: "'Inter', 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
      letterSpacing: '0.01em',
      textTransform: 'uppercase',
      fontSize: '11px'
    }}
  >
    <span className="opacity-50 group-hover:opacity-100 transition-all duration-300 group-hover:text-blue-600">
      {field.label}
    </span>
  </label>

  {/* Borderless Input */}
  <input
    type={field.type}
    value={value || ''}
    onChange={(e) => onChange(field.key, e.target.value)}
    className={`w-full border-0 focus:ring-0 focus:outline-none
                transition-all duration-300 bg-transparent px-0 py-0.5
                ${field.readonly
                  ? 'cursor-not-allowed text-gray-400'
                  : 'text-gray-900 placeholder:text-gray-400/60 hover:placeholder:text-gray-500/80'
                }`}
    style={{
      fontFamily: "'Inter', 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
      fontSize: '14px',
      letterSpacing: '-0.01em',
      fontWeight: '400'
    }}
  />
</div>
```

**Key Design Principles:**
- **No Borders:** Removed all hard borders for a cleaner look
- **Gradient Backgrounds:** Multi-stop gradients for subtle depth (from-gray-50/50 via-white/50)
- **Multi-Layer Shadows:** 3-layer shadow system on focus for depth perception
- **Smooth Animations:** 300ms transitions for all state changes
- **Subtle Scale:** 1.002 scale on focus for tactile feedback
- **Uppercase Labels:** 11px, tracked, medium weight for hierarchy

**Shadow System Breakdown:**
- **Hover:** Single outline + soft drop shadow
  - `0_0_0_1px_rgba(59,130,246,0.1)` - Subtle outline
  - `0_2px_8px_-2px_rgba(59,130,246,0.08)` - Soft shadow
- **Focus:** Triple-layer depth effect
  - Layer 1: `0_0_0_1px_rgba(59,130,246,0.25)` - Stronger outline
  - Layer 2: `0_4px_16px_-4px_rgba(59,130,246,0.15)` - Medium shadow
  - Layer 3: `0_0_24px_-8px_rgba(96,165,250,0.2)` - Outer glow

**Reuse Count:** 50+ form fields across EntityFormContainer
**Used In:** All entity create/edit forms

### 3.2 Standard Text Input (Legacy)

```jsx
<input
  className="w-full px-3 py-2 border border-gray-300 rounded text-sm
             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
             placeholder:text-gray-400"
  placeholder="Enter text..."
/>
```

**Note:** Being phased out in favor of borderless pattern (v4.0)
**Reuse Count:** 50+ occurrences
**Used In:** All form components, modals, search fields

### 3.2 Input with Icon Prefix

```jsx
<div className="relative">
  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
  <input
    className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded
               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    placeholder="Search..."
  />
</div>
```

**Common Icon Sizes:** `h-4 w-4`
**Icon Positioning:** `left-2` for left padding

### 3.3 Textarea

```jsx
<textarea
  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
             focus:ring-2 focus:ring-blue-500 focus:border-blue-500
             placeholder:text-gray-400 resize-vertical"
  rows={4}
  placeholder="Enter description..."
/>
```

### 3.4 Select Dropdown

```jsx
<select
  className="w-full px-3 py-2 border border-gray-300 rounded text-sm
             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
             bg-white cursor-pointer"
>
  <option value="">Select option</option>
  <option value="1">Option 1</option>
</select>
```

### 3.5 Checkbox

```jsx
<label className="flex items-center gap-2 cursor-pointer">
  <input
    type="checkbox"
    className="h-4 w-4 text-blue-600 border-gray-300 rounded
               focus:ring-2 focus:ring-blue-500"
  />
  <span className="text-sm text-gray-700">Checkbox label</span>
</label>
```

### 3.6 Form Label Standard

```jsx
<label className="text-sm font-medium text-gray-700 mb-1 block">
  Field Label
</label>
```

**Pattern:** Always use `mb-1` or `mb-2` spacing before input

### 3.7 Form Field Container (EntityFormContainer)

```jsx
<div className="grid grid-cols-[160px_1fr] gap-4 items-start">
  <label className="text-xs font-medium text-gray-500 pt-2">
    Field Label
  </label>
  <div className="flex-1">
    <input {...props} />
  </div>
</div>
```

**Grid Layout:** 160px fixed label width, remaining space for input

### 3.8 Inline Editable Field

```jsx
<input
  className="flex-1 text-lg font-semibold text-gray-900
             bg-white border-b-2 border-gray-300
             hover:border-blue-400 focus:border-blue-500
             focus:ring-0 focus:outline-none
             px-2 py-1 rounded-t"
  value={value}
/>
```

**Used In:** EntityDetailPage header editing

### 3.9 Striped Divider Between Fields

```jsx
<div
  className="h-px my-1.5"
  style={{
    backgroundImage: 'repeating-linear-gradient(90deg, ' +
      'rgba(209, 213, 219, 0.15) 0px, ' +
      'rgba(209, 213, 219, 0.15) 4px, ' +
      'transparent 4px, ' +
      'transparent 8px)'
  }}
/>
```

**Pattern:** 4px stripe, 4px gap, 15% opacity
**Spacing:** `my-1.5` (6px vertical margin)

---

## 4. Layout & Container Patterns

### 4.1 Page Wrapper

```jsx
<div className="min-h-screen bg-gray-50">
  {/* Page content */}
</div>
```

### 4.2 Container Padding Standards (v4.0 Compact)

**v4.0 Update:** Achieved ~25-30% height reduction across all major sections

```jsx
// Header (Layout.tsx) - Reduced from py-4 to py-2
<header className="bg-white border-b border-gray-200 px-6 py-2">
  <div className="flex items-center justify-between">
    <NavigationBreadcrumb />
  </div>
</header>

// Main content wrapper - Reduced from pb-4 to pb-2
<div className="pb-2">
  {children}
</div>

// Metadata section - Reduced from pb-4 to pb-2
<div className="sticky top-0 z-20 bg-gray-50 pb-2">
  {/* Metadata header */}
</div>

// Metadata header container - Added py-2 for balanced spacing
<div className="flex items-center justify-between py-2">
  {/* Project name, code, etc. */}
</div>

// Flex item spacing - Reduced from space-x-4 to space-x-3
<div className="flex items-center space-x-3 flex-1 min-w-0">
  {/* Items */}
</div>

// Button group spacing - Reduced from space-x-2 to space-x-1.5
<div className="flex items-center space-x-1.5">
  {/* Action buttons */}
</div>

// Content margin - Reduced from mt-3 to mt-2
<div className="mt-2">
  {/* Content sections */}
</div>

// Card/panel container (compact)
<div className="p-4">
  {/* Content */}
</div>

// Tight spacing
<div className="p-2">
  {/* Content */}
</div>
```

**v4.0 Height Reduction Summary:**
- Header: 50% reduction (py-4 → py-2)
- Content wrapper: 50% reduction (pb-4 → pb-2)
- Metadata section: 50% reduction (pb-4 → pb-2)
- Flex spacing: 25% reduction (space-x-4 → space-x-3)
- Button spacing: 25% reduction (space-x-2 → space-x-1.5)
- Margins: 33% reduction (mt-3 → mt-2)

**Total Space Saved:** ~52px in vertical height

### 4.3 Flex Layouts

```jsx
// Space between (header pattern)
<div className="flex items-center justify-between">
  <div>{/* Left */}</div>
  <div>{/* Right */}</div>
</div>

// Centered
<div className="flex items-center justify-center gap-2">
  {/* Centered content */}
</div>

// Left-aligned with gap
<div className="flex items-center gap-2">
  {/* Items */}
</div>

// Vertical stack
<div className="flex flex-col space-y-4">
  {/* Stacked items */}
</div>
```

**Reuse Count:** 200+ flex center patterns across codebase

### 4.4 Grid Layouts

```jsx
// Two-column form
<div className="grid grid-cols-[160px_1fr] gap-4 items-start">
  {/* Label */}
  {/* Input */}
</div>

// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Grid items */}
</div>

// Three-column data table
<div className="grid grid-cols-[1fr_auto_100px] gap-2">
  {/* Name */ }
  {/* Status */}
  {/* Actions */}
</div>
```

### 4.5 Overflow & Height Patterns

```jsx
// Scrollable area with fixed height
<div className="max-h-[calc(100vh-300px)] overflow-y-auto">
  {/* Scrollable content */}
</div>

// Full viewport height
<div className="h-screen overflow-hidden">
  {/* Fixed height content */}
</div>

// Horizontal scroll
<div className="overflow-x-auto">
  {/* Wide content */}
</div>
```

---

## 5. Typography System

### 5.1 Metadata Display Pattern (v4.0 Enhanced) ⭐

**Location:** `apps/web/src/lib/data_transform_render.tsx`, `apps/web/src/pages/shared/EntityDetailPage.tsx`

The v4.0 design introduces refined metadata typography with uppercase labels and enhanced contrast:

```jsx
{/* MetadataField Component Pattern */}
export function MetadataField({ label, value, fieldKey, onCopy, copiedField, className = '' }) {
  // Label styling - uppercase, tracked, medium weight
  const labelClass = 'text-gray-400 font-medium text-[10px] flex-shrink-0 tracking-wide uppercase';

  // Value styling - darker, bolder, tighter tracking
  const valueClass = `text-gray-800 font-normal text-xs ${className}`;
  const valueStyle = {
    fontFamily: "Inter, 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
    letterSpacing: '-0.01em',
    fontWeight: '500'  // Medium weight for prominence
  };

  return (
    <div className="group flex items-center gap-1.5">
      {/* Label */}
      <span className={labelClass}>{label}:</span>

      {/* Value */}
      <span className={valueClass} style={valueStyle}>
        {value}
      </span>

      {/* Copy button with blue hover */}
      <button
        onClick={() => onCopy(value, fieldKey)}
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-blue-50 rounded transition-all duration-200"
      >
        {copiedField === fieldKey ? (
          <Check className="h-3 w-3 text-green-600" />
        ) : (
          <Copy className="h-3 w-3 text-gray-400 hover:text-blue-600" />
        )}
      </button>
    </div>
  );
}

{/* Metadata Separator */}
export function MetadataSeparator({ show = true }) {
  if (!show) return null;
  return <span className="text-gray-300 flex-shrink-0 mx-0.5 opacity-50">·</span>;
}

{/* Usage in EntityDetailPage */}
<div className="flex items-center space-x-3 flex-1 min-w-0">
  {/* Project Name */}
  <MetadataField
    label="Project Name"
    value={data.name}
    fieldKey="name"
    onCopy={handleCopy}
    copiedField={copiedField}
  />

  <MetadataSeparator />

  {/* Code */}
  <MetadataField
    label="code"
    value={data.code}
    fieldKey="code"
    onCopy={handleCopy}
    copiedField={copiedField}
  />

  <MetadataSeparator />

  {/* Created/Updated Timestamps */}
  {data.created_ts && (
    <>
      <span className="text-gray-400 font-medium text-[10px] flex-shrink-0 tracking-wide uppercase">
        created:
      </span>
      <span
        className="text-gray-800 font-normal text-xs"
        style={{
          fontFamily: "Inter, 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
          letterSpacing: '-0.01em',
          fontWeight: '500'
        }}
        title={formatFriendlyDate(data.created_ts)}
      >
        {formatRelativeTime(data.created_ts)}
      </span>
    </>
  )}
</div>
```

**Key Design Elements:**
- **Labels:** 10px, uppercase, tracked (0.01em), gray-400, medium weight
- **Values:** 12px, gray-800, tight tracking (-0.01em), medium weight (500)
- **Separators:** Gray-300 dots with 50% opacity, mx-0.5 spacing
- **Copy Buttons:** Blue hover (hover:bg-blue-50, hover:text-blue-600) instead of gray
- **Font Family:** Inter prioritized for better readability

**Reuse Count:** 15+ metadata displays
**Used In:** EntityDetailPage headers, metadata sections

### 5.2 Text Size Scale

```jsx
// Extra small (10px) - status badges, counts, uppercase labels ⭐ v4.0
text-[10px]

// Extra small (12px) - labels, metadata values ⭐ v4.0
text-xs

// Small (13px) - entity metadata values
text-[13px]

// Small (14px) - body text, table cells, form inputs ⭐ v4.0
text-sm

// Base (16px) - default size
text-base

// Large (18px) - section headers
text-lg

// Extra large (20px) - h4
text-xl

// 2XL (24px) - h3
text-2xl

// 3XL (30px) - h2
text-3xl

// 4XL (36px) - h1, page titles
text-4xl
```

### 5.2 Font Weight Scale

```jsx
font-normal    // 400 - default body text
font-medium    // 500 - labels, section headers
font-semibold  // 600 - page titles, important headers
font-bold      // 700 - h1, h2
```

### 5.3 Line Height Standards

```jsx
leading-none      // 1
leading-tight     // 1.25
leading-[1.4]     // 1.4 - metadata values
leading-normal    // 1.5
leading-relaxed   // 1.625 - body paragraphs
leading-loose     // 2
```

### 5.4 Common Typography Combinations

```jsx
// Page title
className="text-3xl font-bold text-gray-900"

// Section header
className="text-lg font-semibold text-gray-900"

// Subsection label
className="text-sm font-medium text-gray-700"

// Field label
className="text-xs font-medium text-gray-500"

// Body text
className="text-sm text-gray-700"

// Secondary text
className="text-xs text-gray-600"

// Helper/placeholder text
className="text-xs text-gray-400"

// Metadata value (DRY constant)
className="text-[13px] text-gray-800 leading-[1.4]"
```

### 5.5 Heading Hierarchy

```jsx
// h1 - Page titles, wiki titles
<h1 className="text-4xl font-bold text-gray-900">Title</h1>

// h2 - Major sections
<h2 className="text-3xl font-bold text-gray-800">Section</h2>

// h3 - Subsections
<h3 className="text-2xl font-semibold text-gray-800">Subsection</h3>

// h4 - Minor sections
<h4 className="text-xl font-semibold text-gray-700">Minor Section</h4>

// h5 - Component headers
<h5 className="text-lg font-medium text-gray-700">Component</h5>

// h6 - Small headers
<h6 className="text-base font-medium text-gray-700">Small Header</h6>
```

---

## 6. Color System

### 6.1 Gray Scale (Neutrals)

```jsx
// Backgrounds
bg-white         // #FFFFFF - Default
bg-gray-50       // #F9FAFB - Page background
bg-gray-100      // #F3F4F6 - Hover states, subtle backgrounds
bg-gray-200      // #E5E7EB - Borders, dividers

// Text Colors
text-gray-900    // #111827 - Primary headings
text-gray-800    // #1F2937 - Strong text
text-gray-700    // #374151 - Body text
text-gray-600    // #4B5563 - Icons, secondary text
text-gray-500    // #6B7280 - Muted text, labels
text-gray-400    // #9CA3AF - Placeholder, helper text

// Border Colors - STANDARDIZED (v5.0)
border-gray-300  // #D1D5DB - STANDARD BORDER (default for all buttons, inputs, cards, icons)
border-gray-200  // #E5E7EB - Subtle borders (dividers, section separators)
border-gray-100  // #F3F4F6 - Very subtle borders (optional, minimal separation)
```

### 6.2 Primary Colors (DEPRECATED - v5.0)

**⚠️ These colors are NO LONGER USED for borders/buttons (replaced with gray-300)**

```jsx
// DEPRECATED: Slate colors (no longer used for buttons)
// All buttons now use border-gray-300 (see section 2)

// DEPRECATED: Blue borders (replaced with gray)
// All borders now use border-gray-300 as standard
// Only semantic colors (red for danger) are exceptions

// Focus rings still use gray
focus:ring-gray-400  // Standard focus ring color
```

### 6.3 Semantic Colors

```jsx
// Success (Green)
bg-green-50      // #F0FDF4 - Alert background
bg-green-100     // #DCFCE7 - Badge background
text-green-600   // #16A34A - Success text
text-green-700   // #15803D - Done state
text-green-800   // #166534 - Dark success text

// Error/Danger (Red)
bg-red-50        // #FEF2F2 - Alert background
bg-red-100       // #FEE2E2 - Badge background
text-red-600     // #DC2626 - Error text
text-red-700     // #B91C1C - Delete button hover
border-red-500   // #EF4444 - Error border

// Warning (Orange)
bg-orange-50     // #FFF7ED - Alert background
bg-orange-100    // #FFEDD5 - Badge background
text-orange-600  // #EA580C - Warning text
text-orange-700  // #C2410C - In Progress state

// Info (Blue)
bg-blue-50       // #EFF6FF - Info box
bg-blue-100      // #DBEAFE - Badge
text-blue-600    // #2563EB - Info text
```

### 6.4 Stage/Workflow Colors (Kanban)

```typescript
const STAGE_COLORS = {
  'Backlog':     '#6B7280',  // Gray-500
  'To Do':       '#3B82F6',  // Blue-500
  'In Progress': '#F59E0B',  // Amber-500
  'In Review':   '#8B5CF6',  // Violet-500
  'Done':        '#10B981',  // Emerald-500
  'Blocked':     '#EF4444',  // Red-500
  'Cancelled':   '#9CA3AF'   // Gray-400
};
```

---

## 7. Spacing System

### 7.1 Padding Scale

```jsx
p-0.5   // 2px
p-1     // 4px
p-1.5   // 6px - compact form fields
p-2     // 8px - small buttons, tight containers
p-3     // 12px - inputs, table cells
p-4     // 16px - cards, panels (compact)
p-6     // 24px - page containers, large cards
p-8     // 32px - hero sections
```

### 7.2 Margin Scale

```jsx
mb-1    // 4px
mb-2    // 8px - between label and input
mb-4    // 16px - between sections
mb-6    // 24px - major section spacing
```

### 7.3 Gap Scale

```jsx
gap-1   // 4px
gap-2   // 8px - icon + text
gap-3   // 12px - button groups
gap-4   // 16px - grid items, form fields
gap-6   // 24px - large grid spacing
```

### 7.4 Space Between Children

```jsx
space-y-1   // 4px vertical
space-y-2   // 8px vertical
space-y-4   // 16px vertical - default
space-y-6   // 24px vertical - major sections

space-x-2   // 8px horizontal
space-x-3   // 12px horizontal - button groups
space-x-4   // 16px horizontal
```

**Reuse Count:** 150+ occurrences of space-y/space-x patterns

---

## 8. Interactive States

### 8.1 Hover States

```jsx
// Background hover
hover:bg-gray-50
hover:bg-gray-100
hover:bg-blue-50

// Border hover
hover:border-gray-400
hover:border-blue-400

// Shadow hover
hover:shadow-md
hover:shadow-lg

// Transform hover (lift effect)
hover:-translate-y-1
```

### 8.2 Focus States

```jsx
// Standard focus ring
focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2

// For inputs
focus:ring-2 focus:ring-blue-500 focus:border-blue-500

// For dark backgrounds
focus:ring-2 focus:ring-white focus:ring-offset-2

// No focus ring (inline edit)
focus:ring-0 focus:outline-none
```

### 8.3 Disabled States

```jsx
disabled:bg-gray-100
disabled:text-gray-400
disabled:border-gray-200
disabled:shadow-none
disabled:cursor-not-allowed
```

### 8.4 Active/Selected States

```jsx
// Button active
active:bg-blue-800

// Selected item
className={`${isSelected
  ? 'bg-blue-50 border-blue-400 text-blue-700'
  : 'border-gray-300 hover:bg-gray-50'
}`}
```

### 8.5 Loading States

```jsx
// Spinner
<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />

// Spinner (large)
<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />

// Pulsing skeleton
<div className="animate-pulse bg-gray-200 h-4 w-full rounded" />
```

---

## 9. Border & Shadow Standards

### 9.1 Border Styles (v5.0 STANDARDIZED)

**🎯 UNIVERSAL STANDARD: Use `border-gray-300` for ALL borders**

```jsx
// ✅ STANDARD BORDER (use this for everything)
border border-gray-300   // #D1D5DB - Buttons, inputs, cards, icons, dividers
                         // 374 instances across codebase

// Subtle borders (optional, for minimal separation)
border border-gray-200   // #E5E7EB - Section dividers, subtle containers
                         // 217 instances across codebase

// Very subtle borders (rare)
border border-gray-100   // #F3F4F6 - Minimal visual separation
                         // 16 instances across codebase

// ⚠️ EXCEPTION: Semantic colors only (not for regular UI)
border border-red-500    // Error states, danger actions
border border-green-500  // Success confirmation (rare)

// ❌ NEVER USE: Dark borders (deprecated in v5.0)
// border-gray-400, border-gray-500, border-gray-600, border-gray-700, border-gray-800, border-gray-900
// border-slate-* (all slate borders removed)
// border-blue-* (removed, except semantic states)
```

**Direction-specific borders:**
```jsx
// Bottom border only
border-b border-gray-300  // Standard
border-b border-gray-200  // Subtle

// Top border
border-t border-gray-300

// Left/Right borders
border-l border-gray-300
border-r border-gray-300
```

### 9.2 Border Radius

```jsx
rounded       // 4px - default
rounded-lg    // 8px - cards, buttons, inputs
rounded-xl    // 12px - modals
rounded-full  // 9999px - badges, avatar
rounded-t     // Top corners only
```

### 9.3 Shadow Scale

```jsx
shadow-sm     // 0 1px 2px 0 rgba(0, 0, 0, 0.05)
shadow        // 0 1px 3px 0 rgba(0, 0, 0, 0.1)
shadow-md     // 0 4px 6px -1px rgba(0, 0, 0, 0.1)
shadow-lg     // 0 10px 15px -3px rgba(0, 0, 0, 0.1)
shadow-xl     // 0 20px 25px -5px rgba(0, 0, 0, 0.1)
shadow-2xl    // 0 25px 50px -12px rgba(0, 0, 0, 0.25)
```

### 9.4 Divide Patterns (Tables/Lists)

```jsx
// Between children
divide-y divide-gray-200

// Vertical divider
divide-x divide-gray-300
```

---

## 10. Modal & Dialog Patterns

### 10.1 Modal Backdrop

```jsx
<div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity" />
```

### 10.2 Modal Container

```jsx
<div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
  {/* Modal content */}
</div>
```

### 10.3 Modal Header

```jsx
<div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
  <h2 className="text-lg font-semibold text-gray-900">Modal Title</h2>
  <button className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
    <X className="h-5 w-5 text-gray-500" />
  </button>
</div>
```

### 10.4 Modal Content

```jsx
<div className="flex-1 overflow-y-auto px-6 py-4">
  <div className="space-y-4">
    {/* Form fields or content */}
  </div>
</div>
```

### 10.5 Modal Footer

```jsx
<div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
  <Button variant="secondary">Cancel</Button>
  <Button variant="primary">Save</Button>
</div>
```

---

## 11. Table Patterns

### 11.1 Table Container

```jsx
<div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
  <table className="min-w-full divide-y divide-gray-200">
    {/* Table content */}
  </table>
</div>
```

### 11.2 Table Header

```jsx
<thead className="bg-gray-50">
  <tr>
    <th className="px-3 py-1.5 text-left text-[11px] font-normal text-gray-600 uppercase tracking-wider">
      Column Name
    </th>
  </tr>
</thead>
```

### 11.3 Table Body

```jsx
<tbody className="bg-white divide-y divide-gray-100">
  <tr className="hover:bg-gray-50 transition-colors">
    <td className="px-3 py-1.5 text-xs text-gray-700">
      Cell content
    </td>
  </tr>
</tbody>
```

### 11.4 Linked/Selected Row

```jsx
<tr className="bg-blue-50 border-l-4 border-blue-500">
  {/* Row content */}
</tr>
```

---

## 12. Card Patterns

### 12.1 Standard Card

```jsx
<div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 p-6">
  {/* Card content */}
</div>
```

**Reuse Count:** 80+ occurrences

### 12.2 Card with Header

```jsx
<div className="bg-white rounded-lg border border-gray-200 shadow-sm">
  <div className="px-6 py-4 border-b border-gray-200">
    <h3 className="text-lg font-semibold">Card Title</h3>
  </div>
  <div className="p-6">
    {/* Content */}
  </div>
</div>
```

### 12.3 Compact Card

```jsx
<div className="bg-white rounded-lg border border-gray-200 p-4">
  {/* Compact content */}
</div>
```

---

## 13. Badge & Tag Patterns

### 13.1 Default Badge

```jsx
<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
  Badge
</span>
```

**Reuse Count:** 40+ occurrences

### 13.2 Status Badges

```jsx
// Success
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
  <Check className="h-3 w-3 mr-1" />
  Linked
</span>

// Error
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
  Error
</span>

// Info
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
  Info
</span>
```

### 13.3 Count Badge

```jsx
<span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-gray-200 text-[10px] font-medium text-gray-700">
  5
</span>
```

### 13.4 Database-Driven Colored Badges (v2.6) ⭐

**Purpose:** Automatically render colored badges using database `color_code` field instead of hardcoding colors

**Location:** `apps/web/src/lib/data_transform_render.tsx` (Part 4: Badge Rendering)

**Architecture:**

```
Database color_code → settingsColorCache → COLOR_MAP → Tailwind classes → React element
    "blue"              Map<string, string>    Record      "bg-blue-100"   <span>Badge</span>
```

**Usage Patterns:**

**Pattern A - Settings Tables (Direct Color):**
```jsx
// entityConfig.ts - Settings table name column
{
  key: 'name',
  title: 'Name',
  render: (value, record) => renderSettingBadge(record.color_code, value)
}

// Renders:
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
  Planning
</span>
```

**Pattern B - Entity Tables (Auto-Applied):**
```jsx
// entityConfig.ts - Entity stage/status columns
{
  key: 'project_stage',
  title: 'Stage',
  loadOptionsFromSettings: true  // ← Automatically adds badge renderer!
}

// Auto-enhancement at module load:
// settingsConfig.applySettingsBadgeRenderers() adds:
// render: renderSettingBadge(value, { category: 'project_stage' })
```

**Pattern C - Inline Edit Dropdowns (ColoredDropdown):**
```jsx
// DataTable.tsx - Inline edit mode
<ColoredDropdown
  value={currentValue}
  options={columnOptions}  // From settingsLoader with color_code
  onChange={handleChange}
/>

// Inside ColoredDropdown component:
const selectedColor = selectedOption?.metadata?.color_code;

// Selected value button
<button>
  {selectedOption ? (
    renderSettingBadge(selectedColor, String(selectedOption.label))
  ) : (
    <span className="text-gray-400">Select...</span>
  )}
</button>

// Dropdown menu options
{options.map(opt => {
  const optionColor = opt.metadata?.color_code;
  return (
    <button onClick={() => handleSelect(opt.value)}>
      {renderSettingBadge(optionColor, String(opt.label))}
    </button>
  );
})}
```

**Pattern D - Filter Dropdowns (DataTable):**
```jsx
// DataTable.tsx - Filter dropdown rendering
{isSettingsField ? (
  colorCode ? renderSettingBadge(colorCode, option) : renderSettingBadge(undefined, option)
) : (
  <span className="text-sm text-gray-700">{option}</span>
)}
```

**Color Map (Complete Palette):**

```typescript
export const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  blue:   { bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-300' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
  green:  { bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-300' },
  red:    { bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-300' },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
  gray:   { bg: 'bg-gray-100',   text: 'text-gray-800',   border: 'border-gray-300' },
  cyan:   { bg: 'bg-cyan-100',   text: 'text-cyan-800',   border: 'border-cyan-300' },
  pink:   { bg: 'bg-pink-100',   text: 'text-pink-800',   border: 'border-pink-300' },
  amber:  { bg: 'bg-amber-100',  text: 'text-amber-800',  border: 'border-amber-300' },
};
```

**Badge Size Variants:**

```typescript
// Size: 'xs' (default) - Most common, used in tables
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
  Planning
</span>

// Size: 'sm' - Slightly larger, used in detail pages
<span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
  Planning
</span>

// Size: 'md' - Large, used in headers
<span className="inline-flex items-center px-4 py-1.5 rounded-full text-base font-medium bg-blue-100 text-blue-800">
  Planning
</span>
```

**Tailwind Color Classes (100/800 Pattern):**

| Color  | Background (100) | Text (800) | Border (300) | Hex Codes |
|--------|-----------------|------------|--------------|-----------|
| Blue   | `bg-blue-100`   | `text-blue-800` | `border-blue-300` | #DBEAFE / #1E40AF |
| Purple | `bg-purple-100` | `text-purple-800` | `border-purple-300` | #F3E8FF / #6B21A8 |
| Green  | `bg-green-100`  | `text-green-800` | `border-green-300` | #DCFCE7 / #166534 |
| Red    | `bg-red-100`    | `text-red-800` | `border-red-300` | #FEE2E2 / #991B1B |
| Yellow | `bg-yellow-100` | `text-yellow-800` | `border-yellow-300` | #FEF9C3 / #854D0E |
| Orange | `bg-orange-100` | `text-orange-800` | `border-orange-300` | #FFEDD5 / #9A3412 |
| Gray   | `bg-gray-100`   | `text-gray-800` | `border-gray-300` | #F3F4F6 / #1F2937 |
| Cyan   | `bg-cyan-100`   | `text-cyan-800` | `border-cyan-300` | #CFFAFE / #155E75 |
| Pink   | `bg-pink-100`   | `text-pink-800` | `border-pink-300` | #FCE7F3 / #9F1239 |
| Amber  | `bg-amber-100`  | `text-amber-800` | `border-amber-300` | #FEF3C7 / #92400E |

**ColoredDropdown Styling (Inline Edit):**

```jsx
// Dropdown button (selected value)
<button
  className="w-full px-2.5 py-1.5 pr-8 border border-gray-300 rounded-md
             focus:ring-2 focus:ring-gray-400/30 focus:border-gray-300
             bg-white shadow-sm hover:border-gray-300 transition-colors
             cursor-pointer text-left"
>
  {renderSettingBadge(selectedColor, selectedLabel)}
</button>

// Dropdown menu container
<div className="absolute z-50 w-full mt-1 bg-white border border-gray-200
                rounded-md shadow-lg max-h-60 overflow-auto">
  <div className="py-1">
    {/* Options */}
  </div>
</div>

// Dropdown option button
<button
  className="w-full px-3 py-2 text-left hover:bg-gray-50
             transition-colors flex items-center"
>
  {renderSettingBadge(optionColor, optionLabel)}
</button>
```

**Reuse Count:** 100+ occurrences across:
- Settings tables: 16 tables × name column
- Entity tables: 50+ stage/status/priority fields
- Filter dropdowns: All settings-based filters
- Inline edit dropdowns: All editable settings fields

**Benefits:**

| Aspect | Old (Hardcoded) | New (Database-Driven) |
|--------|----------------|----------------------|
| Code lines | ~2,000 lines | ~200 lines (90% reduction) |
| Color updates | Redeploy app | Update database only |
| New categories | Add code + deploy | Zero code changes |
| Consistency | Manual sync | Automatic everywhere |
| Visual matching | Settings ≠ entities | Perfect match |

**See Also:**
- [Settings Pattern 7 - Database-Driven Colors](./settings.md#pattern-7-database-driven-badge-color-system-v25)
- [Settings Pattern 7.1 - Inline Edit Dropdowns](./settings.md#pattern-71-inline-edit-dropdowns-with-colored-badges-v26)
- [DataTable ColoredDropdown](./data_table.md#coloreddropdown-component-v26)
- [Badge Rendering System](./ui_ux_route_api.md#badge-rendering-functions-v26)

---

## 14. Alert & Message Patterns

### 14.1 Success Alert

```jsx
<div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
  <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
  <p className="text-sm text-green-700">Success message here</p>
</div>
```

### 14.2 Error Alert

```jsx
<div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
  <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
  <p className="text-sm text-red-700">Error message here</p>
</div>
```

### 14.3 Warning Alert

```jsx
<div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-2">
  <AlertCircle className="h-4 w-4 text-orange-600 flex-shrink-0" />
  <p className="text-sm text-orange-700">Warning message here</p>
</div>
```

### 14.4 Info Box

```jsx
<div className="bg-blue-50 border border-blue-100 rounded-xl p-6 space-y-4">
  {/* Info content */}
</div>
```

**Reuse Count:** 30+ alert patterns

---

## 14.5 Tab Navigation Pattern (v4.0 Minimalistic) ⭐

**Location:** `apps/web/src/components/shared/entity/DynamicChildEntityTabs.tsx`

The v4.0 design features clean, minimalistic tabs with simple underlines (simplified from elaborate pill design based on user feedback):

```jsx
<div className="bg-white">
  {/* Tab Navigation Container - Compact padding */}
  <div className="px-6 py-1.5">
    <nav className="flex items-center gap-6" aria-label="Tabs">
      {tabs.map((tab) => {
        const isActive = activeTab?.id === tab.id;
        const IconComponent = tab.icon || getEntityIcon(tab.id);

        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab)}
            disabled={tab.disabled}
            title={tab.tooltip}
            className={[
              // Base styles - small font, minimal padding
              'group inline-flex items-center gap-1.5 px-1 py-1.5 border-b-2 font-normal text-xs transition-all duration-200',
              // Active state - simple underline, no color change
              isActive
                ? 'border-gray-900 text-gray-700'
                : tab.disabled
                ? 'border-transparent text-gray-400 cursor-not-allowed'
                : 'border-transparent text-gray-600 hover:border-gray-300 cursor-pointer'
            ].join(' ')}
          >
            {/* Icon - small size */}
            <IconComponent className="h-3.5 w-3.5 stroke-[1.5]" />

            {/* Label - no font changes */}
            <span>{tab.label}</span>

            {/* Count badge - minimal styling */}
            {tab.count !== undefined && (
              <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-normal bg-gray-100 text-gray-600">
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  </div>

  {/* Bottom border separator */}
  <div className="h-px bg-gray-200" />
</div>
```

**Design Principles (User Feedback Driven):**
- **Simple Underline:** Basic `border-b-2` for active state (no gradients, no shadows)
- **Minimal Color Changes:** Only border changes color, text stays gray-700/gray-600
- **No Decoration:** No glassmorphic effects, no scale transforms
- **Compact Spacing:** py-1.5 instead of py-2 (25% reduction)
- **Small Icons:** h-3.5 w-3.5 for tab icons
- **Clean Hover:** Subtle border appearance on hover

**User Feedback Applied:** "Use basic underline on click, don't change font color or other decor, no glassmorphic"

**Reuse Count:** All entity detail pages with child tabs
**Used In:** DynamicChildEntityTabs component

---

## 15. Icon Standards

### 15.1 Icon Sizing Scale (v4.0 Updated)

```jsx
// Tiny (badges, status indicators)
h-3 w-3

// Small (inline with text, buttons, tab icons) ⭐ v4.0
h-3.5 w-3.5

// Standard (most UI elements, action icons) ⭐ v4.0 - DEFAULT for action buttons
h-4 w-4

// Medium (toolbar, headers) - DEPRECATED for action icons in v4.0
h-5 w-5

// Large (page headers)
h-6 w-6

// Extra large (empty states, loaders)
h-8 w-8

// Hero
h-12 w-12
```

**v4.0 Action Icon Standard:** All action icons (Download, Link, Share, Edit, Save) now use `h-4 w-4` (16px) instead of `h-5 w-5` (20px) for better visual proportions.

**Updated in v4.0:**
- EntityDetailPage action icons: Download, Link, Share, Edit, Save, X (all h-4 w-4)
- Tab icons: h-3.5 w-3.5 for compact appearance
- Copy buttons in metadata: h-3 w-3 for inline use

### 15.2 Icon Colors

```jsx
// Default
text-gray-600

// Muted
text-gray-400

// Primary
text-blue-600

// Success
text-green-600

// Error
text-red-600

// Warning
text-orange-600
```

### 15.3 Icon + Text Pattern

```jsx
<div className="inline-flex items-center gap-2">
  <Icon className="h-4 w-4" />
  <span>Text</span>
</div>
```

---

## 16. Page Layout Templates

### 16.1 EntityDetailPage Layout

```jsx
<div className="min-h-screen bg-gray-50">
  {/* Breadcrumb */}
  <nav className="px-6 py-3 bg-white border-b border-gray-200">
    {/* Breadcrumb items */}
  </nav>

  {/* Header */}
  <div className="px-6 py-4 bg-white border-b border-gray-200">
    {/* Entity name, code, slug, ID */}
    {/* Action buttons */}
  </div>

  {/* Tabs */}
  <div className="px-6 bg-white border-b border-gray-200">
    {/* Tab navigation */}
  </div>

  {/* Content */}
  <div className="p-6">
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {/* Content area */}
    </div>
  </div>
</div>
```

### 16.2 EntityMainPage Layout

```jsx
<div className="p-6">
  {/* Header */}
  <div className="flex items-center justify-between mb-6">
    <h1 className="text-2xl font-bold">{entityType} ({count})</h1>
    <Button variant="primary" icon={Plus}>Create</Button>
  </div>

  {/* Filters and view toggles */}
  <div className="flex items-center gap-4 mb-4">
    {/* Search, filters, view buttons */}
  </div>

  {/* Content (table/kanban/grid) */}
  <div className="bg-white rounded-lg border border-gray-200">
    {/* Data view */}
  </div>
</div>
```

---

## 17. Component-Specific Patterns

### 17.1 Sequential State Visualizer

```jsx
<div className="flex items-center gap-2">
  {stages.map((stage, index) => (
    <React.Fragment key={stage.id}>
      {/* Circle */}
      <div className={`
        flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all
        ${isCurrentStage ? 'bg-gray-600 border-gray-600' : 'bg-white border-gray-300'}
      `}>
        {isCurrentStage && <Check className="h-4 w-4 text-white" />}
      </div>

      {/* Connector */}
      {index < stages.length - 1 && (
        <div className={`
          h-0.5 flex-1
          ${isPastStage ? 'bg-gray-600' : 'border-t-2 border-dashed border-gray-300'}
        `} />
      )}
    </React.Fragment>
  ))}
</div>
```

### 17.2 Kanban Column

```jsx
<div className="flex-shrink-0 w-80 bg-gray-50 rounded-lg">
  {/* Header */}
  <div className="p-3 border-b border-gray-200">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full">
        {count}
      </span>
    </div>
  </div>

  {/* Cards */}
  <div className="p-2 space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
    {/* Kanban cards */}
  </div>
</div>
```

### 17.3 Copy to Clipboard Button

```jsx
<button
  onClick={() => handleCopy('field', value)}
  className="p-1 hover:bg-gray-100 rounded transition-colors"
  title="Copy to clipboard"
>
  {copiedField === 'field' ? (
    <Check className="h-3.5 w-3.5 text-green-600" />
  ) : (
    <Copy className="h-3.5 w-3.5 text-gray-400" />
  )}
</button>
```

### 17.4 Entity Type Selector (Button Grid)

```jsx
<div className="flex flex-wrap gap-2">
  {entityTypes.map(type => (
    <button
      key={type}
      onClick={() => setSelectedType(type)}
      className={`
        px-2 py-1 text-xs border rounded transition-colors
        ${selectedType === type
          ? 'bg-blue-50 border-blue-400 text-blue-700'
          : 'border-gray-300 hover:bg-gray-50'
        }
      `}
    >
      <Icon className="h-3.5 w-3.5 mr-1 inline" />
      {label}
    </button>
  ))}
</div>
```

---

## Quick Reference Table

### Most Common Patterns (v4.0 Updated)

| Pattern | Classes | Occurrences | v4.0 Changes |
|---------|---------|-------------|--------------|
| **Borderless Form Input** ⭐ NEW | `border-0 focus:ring-0 bg-transparent` + gradient container | 50+ | Replaces bordered inputs |
| **Metadata Label** ⭐ NEW | `text-[10px] text-gray-400 font-medium uppercase tracking-wide` | 15+ | Uppercase, tracked |
| **Metadata Value** ⭐ NEW | `text-xs text-gray-800 font-medium` + letterSpacing: '-0.01em', fontWeight: '500' | 15+ | Darker, bolder |
| **Tab Navigation** ⭐ UPDATED | `border-b-2 border-gray-900 text-gray-700` (active) | All tabs | Simplified underline |
| **Action Icon Size** ⭐ UPDATED | `h-4 w-4` (was h-5 w-5) | 60+ | 20% smaller |
| **Header Padding** ⭐ UPDATED | `py-2` (was py-4) | All headers | 50% reduction |
| **Button Base** | `inline-flex items-center border text-sm font-normal rounded-md transition-all duration-150` | 100+ | No change |
| **Flex Center** | `flex items-center justify-[between\|center]` | 200+ | No change |
| **Card** | `bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md` | 80+ | No change |
| **Icon Button** | `p-1.5 hover:bg-gray-100 rounded-lg transition-colors` | 60+ | No change |
| **Badge** | `inline-flex items-center px-2 py-1 rounded-full text-xs font-medium` | 40+ | No change |
| **Modal Header** | `flex items-center justify-between px-6 py-4 border-b border-gray-200` | 20+ | No change |
| **Space Between** | `space-y-4 \| gap-4` (v4.0: gap-3, gap-2) | 150+ | Reduced spacing |
| **Alert** | `bg-[color]-50 border border-[color]-200 rounded-lg p-3 flex items-center gap-2` | 30+ | No change |
| **Hover Reveal** | `opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-100 rounded` | 25+ | No change |
| **Table Header** | `px-3 py-1.5 text-left text-[11px] font-normal text-gray-600 bg-gray-50` | 10+ | No change |
| **Page Container** | `p-6 bg-white rounded-lg border border-gray-200` | 70+ | No change |

### v4.0 Quick Copy-Paste Snippets

**Borderless Form Field Container:**
```jsx
<div className="relative break-words rounded-md px-3 py-2 -ml-3 transition-all duration-300 ease-out bg-gradient-to-br from-gray-50/50 via-white/50 to-gray-50/30 hover:from-blue-50/30 hover:via-white/70 hover:to-blue-50/20 hover:shadow-[0_0_0_1px_rgba(59,130,246,0.1),0_2px_8px_-2px_rgba(59,130,246,0.08)] focus-within:from-white focus-within:via-white focus-within:to-blue-50/20 focus-within:shadow-[0_0_0_1px_rgba(59,130,246,0.25),0_4px_16px_-4px_rgba(59,130,246,0.15),0_0_24px_-8px_rgba(96,165,250,0.2)] focus-within:scale-[1.002]">
```

**Uppercase Metadata Label:**
```jsx
<span className="text-gray-400 font-medium text-[10px] flex-shrink-0 tracking-wide uppercase">Label:</span>
```

**Metadata Value:**
```jsx
<span className="text-gray-800 font-normal text-xs" style={{ fontFamily: "Inter, 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif", letterSpacing: '-0.01em', fontWeight: '500' }}>Value</span>
```

**Simple Tab Button (Active):**
```jsx
<button className="group inline-flex items-center gap-1.5 px-1 py-1.5 border-b-2 border-gray-900 text-gray-700 font-normal text-xs transition-all duration-200">
```

**Action Icon (v4.0 Standard):**
```jsx
<Edit2 className="h-4 w-4 text-gray-600 stroke-[1.5]" />
```

---

## Implementation Recommendations

### Phase 1: Create Constants File (Highest Priority)

Create `apps/web/src/lib/tailwind-constants.ts`:

```typescript
// Button classes
export const BUTTON_BASE = 'inline-flex items-center border text-sm font-normal rounded-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 shadow-sm';

export const BUTTON_VARIANTS = {
  primary: 'border-slate-600 text-white bg-gradient-to-b from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800',
  secondary: 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50',
  danger: 'border-red-500 text-white bg-gradient-to-b from-red-500 to-red-600',
};

export const BUTTON_SIZES = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base',
};

// Input classes
export const INPUT_BASE = 'w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

// Card classes
export const CARD_BASE = 'bg-white rounded-lg border border-gray-200 shadow-sm';

// Badge classes
export const BADGE_BASE = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium';

export const BADGE_COLORS = {
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  default: 'bg-gray-100 text-gray-800',
};

// Icon sizes
export const ICON_SIZES = {
  xs: 'h-3 w-3',
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
  xl: 'h-6 w-6',
  '2xl': 'h-8 w-8',
};

// Metadata styling
export const METADATA_VALUE_CLASS = "text-[13px] text-gray-800 leading-[1.4] whitespace-nowrap";
export const METADATA_VALUE_STYLE: React.CSSProperties = {
  fontFamily: "Inter, 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
  letterSpacing: '-0.01em'
};
```

**Expected Impact:** ~40% reduction in inline class duplication

### Phase 2: Create Wrapper Components

Focus on highest-reuse patterns:
1. FormField component (wraps label + input)
2. Alert component (success/error/warning/info variants)
3. Badge component (color variants)
4. IconButton component

**Timeline:** 2-3 days

### Phase 3: Gradual Migration

Migrate components in priority order:
1. Shared components (Button, Modal already done)
2. Form components (highest reuse)
3. Page components (EntityDetailPage, EntityMainPage)

**Timeline:** 3-5 days

---

## Statistics & Coverage

**Codebase Analysis:**
- Total Files Analyzed: 141+
  - Component Files: 71
  - Page Files: 70+
- Styling Patterns Documented: 50+ (v4.0: +6 new patterns)
- Reusable Constants Identified: 15+
- Code Examples Provided: 100+

**Pattern Frequency:**
- Button patterns: 100+ occurrences
- Input patterns: 50+ occurrences (v4.0: borderless redesign)
- Flex layouts: 200+ occurrences
- Card patterns: 80+ occurrences
- Badge patterns: 40+ occurrences
- Alert patterns: 30+ occurrences
- Icon button patterns: 60+ occurrences (v4.0: h-4 w-4 standard)
- Metadata displays: 15+ occurrences (v4.0: uppercase labels)
- Tab navigation: All entity detail pages (v4.0: simplified underline)

**v4.0 Impact:**
- Height reduction: ~25-30% across all sections
- Form field redesign: 50+ borderless inputs with gradient backgrounds
- Icon standardization: 60+ icons resized from h-5 to h-4
- Typography refinement: 15+ metadata labels converted to uppercase
- Tab simplification: All tabs updated to minimalistic underline design

**Consolidation Opportunity:** ~40% of inline styles can be replaced with constants

---

## v4.0 Design Philosophy Summary

The v4.0 update represents a comprehensive shift toward:

1. **Elegance through Simplicity**
   - Removed hard borders in favor of gradients
   - Simplified tab design per user feedback
   - Cleaner, more spacious layouts

2. **Enhanced Typography**
   - Uppercase labels (10px, tracked) for hierarchy
   - Medium-weight values (500) for prominence
   - Inter font family prioritization

3. **Vertical Efficiency**
   - 25-30% height reduction across UI
   - Saved ~52px in vertical space
   - More content visible above the fold

4. **Refined Interactions**
   - 300ms smooth animations
   - Multi-layer shadow systems
   - Subtle scale effects (1.002)
   - Blue hover states for actions

5. **User-Driven Design**
   - Tab design simplified based on direct feedback
   - "Basic underline, no decoration" approach
   - Minimalistic over elaborate

---

## Related Documentation

- **UI/UX Architecture:** `/docs/ui_ux_route_api.md`
- **Component System:** `/docs/COMPONENTS.md` (future)
- **Data Model:** `/docs/datamodel.md`
- **Unified Linkage:** `/docs/UnifiedLinkageSystem.md`

---

## Additional Reference Files

For deeper analysis and implementation roadmap:
- **Detailed Patterns Guide:** `/docs/STYLING_PATTERNS_GUIDE.md` (1,239 lines)
- **Quick Reference:** `/docs/STYLING_QUICK_REFERENCE.md` (448 lines)
- **Implementation Roadmap:** `/docs/STYLING_IMPLEMENTATION_ROADMAP.md` (552 lines)
- **README:** `/docs/README_STYLING.md`

---

**Last Updated:** 2025-10-29
**Version:** 4.0 - Next-Generation Design Update
**Maintained By:** PMO Platform Team
**Questions?** Check implementation examples in:
- Form inputs: `/apps/web/src/components/shared/entity/EntityFormContainer.tsx`
- Metadata: `/apps/web/src/lib/data_transform_render.tsx`
- Tabs: `/apps/web/src/components/shared/entity/DynamicChildEntityTabs.tsx`
- Icons: `/apps/web/src/pages/shared/EntityDetailPage.tsx`
