# PMO Platform - Layout & Styling Guide

> **Complete styling reference for all components, pages, and UI elements** - Coherent design system for consistent implementation across the PMO platform

**Last Updated:** 2025-10-24
**Version:** 2.0
**Architecture:** Tailwind CSS v4 + React 19

---

## Table of Contents

1. [Design System Overview](#design-system-overview)
2. [Typography System](#typography-system)
3. [Layout & Spacing](#layout--spacing)
4. [Color Palette](#color-palette)
5. [Component Styles](#component-styles)
6. [Page Layouts](#page-layouts)
7. [Responsive Design](#responsive-design)
8. [Animation & Transitions](#animation--transitions)
9. [Accessibility Guidelines](#accessibility-guidelines)

---

## Design System Overview

### Core Principles

1. **Compact & Efficient** - 50% space reduction from original designs
2. **Consistent** - Same patterns across all entity types
3. **Accessible** - WCAG 2.1 AA compliant
4. **Notion-Inspired** - Clean, minimal, block-based content
5. **Settings-Driven** - Dynamic styling from configuration

### Technology Stack

| Layer | Technology |
|-------|-----------|
| **Styling** | Tailwind CSS v4 |
| **Icons** | Lucide React |
| **Fonts** | System fonts (no external fonts) |
| **Framework** | React 19 |
| **Build** | Vite |

---

## Typography System

### Font Families

```css
/* System font stack - no external fonts */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
             'Helvetica Neue', Arial, sans-serif;

/* Monospace for code/IDs */
font-family: 'Monaco', 'Courier New', monospace;
```

### Heading Hierarchy

```typescript
// Heading levels (used in WikiDesigner, WikiContentRenderer)
h1: 'text-4xl font-bold'          // 36px, 700 weight
h2: 'text-3xl font-bold'          // 30px, 700 weight
h3: 'text-2xl font-semibold'      // 24px, 600 weight
h4: 'text-xl font-semibold'       // 20px, 600 weight
h5: 'text-lg font-medium'         // 18px, 500 weight
h6: 'text-base font-medium'       // 16px, 500 weight
```

### Page & Component Headers

```typescript
// EntityDetailPage header name
'text-lg font-semibold text-gray-900'     // 18px, 600 weight, dark gray

// Section headers
'text-sm font-medium text-gray-700'       // 14px, 500 weight

// Subsection labels
'text-xs font-medium text-gray-500'       // 12px, 500 weight, muted gray
```

### Body Text

```typescript
// Primary content (paragraphs, descriptions)
'text-sm text-gray-700 leading-relaxed'   // 14px, gray, 1.625 line-height

// Secondary text (metadata, captions)
'text-xs text-gray-500'                   // 12px, muted gray

// Helper text / placeholder
'text-xs text-gray-400'                   // 12px, light gray

// Tiny text (status badges, counts)
'text-[10px] text-gray-500'               // 10px, muted gray
```

### Special Text Styles

```typescript
// Entity type labels (Office, Business, Project, etc.)
'text-xs font-normal text-gray-400'       // 12px, normal weight, muted

// Field labels in forms
'text-xs font-medium text-gray-500 pt-1'  // 12px, medium weight, padding-top

// Code / ID / Slug
'font-mono text-sm text-gray-600'         // Monospace, 14px

// Links
'text-blue-600 hover:text-blue-700 underline'
```

---

## Layout & Spacing

### Compact Layout System

**Design Goal:** Reduce vertical space by 50% from original layouts

#### Spacing Scale

```typescript
// Original → Compact
py-8  → py-4      // Container padding
py-4  → py-1.5    // Field row padding
py-6  → py-2      // Section spacing
space-y-6 → space-y-0  // Remove vertical spacing between fields
```

#### Container Padding

```typescript
// Page containers
'p-6'              // Main page wrapper
'p-4'              // Card/panel containers (was p-8)
'p-2'              // Inner containers, tight spacing

// Inline padding
'px-4'             // Standard horizontal padding
'px-2 py-1'        // Compact button/badge padding
'px-3 py-1.5'      // Table cell padding (was px-4 py-2)
```

#### Margin System

```typescript
// Section margins
'mt-6 mb-4'        // Section header margins
'mt-4 mb-2'        // Subsection margins
'mt-2 mb-1'        // Small element margins

// Block margins (wiki content)
'mb-4'             // Paragraph margin
'my-4'             // Quote/code block margin
'mt-8 mb-4'        // H1 margin
'mt-6 mb-3'        // H2 margin
```

### Grid Layouts

```typescript
// Two-column field layout (EntityFormContainer)
'grid grid-cols-[160px_1fr] gap-4 items-start'
// Label: 160px fixed width
// Value: remaining space (1fr)
// Gap: 16px (gap-4)

// Three-column data table
'grid grid-cols-[1fr_auto_100px] gap-2'
// Name: flexible
// Status: auto-width
// Action: 100px fixed

// Responsive grid
'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
```

### Flexbox Patterns

```typescript
// Header row (space between, centered)
'flex items-center justify-between'

// Icon + text
'flex items-center gap-2'

// Inline metadata (code, slug, ID)
'flex items-center gap-2 flex-wrap text-sm text-gray-500'

// Button groups
'flex items-center gap-3'
```

---

## Color Palette

### Base Grays

```typescript
// Background colors
'bg-white'         // #FFFFFF - Default background
'bg-gray-50'       // #F9FAFB - Subtle background
'bg-gray-100'      // #F3F4F6 - Hover states
'bg-gray-200'      // #E5E7EB - Borders, dividers

// Text colors
'text-gray-900'    // #111827 - Primary headings
'text-gray-700'    // #374151 - Body text
'text-gray-500'    // #6B7280 - Secondary text
'text-gray-400'    // #9CA3AF - Placeholder, helper text
```

### Semantic Colors

```typescript
// Blue (primary, links, selected states)
'bg-blue-50'       // #EFF6FF - Light background
'bg-blue-100'      // #DBEAFE - Badge background
'text-blue-600'    // #2563EB - Link text
'text-blue-700'    // #1D4ED8 - Selected text
'border-blue-400'  // #60A5FA - Selected border
'border-blue-500'  // #3B82F6 - Active border

// Green (success, done states)
'bg-green-50'      // #F0FDF4 - Success background
'text-green-600'   // #16A34A - Success text
'text-green-700'   // #15803D - Done state

// Red (error, delete states)
'bg-red-50'        // #FEF2F2 - Error background
'text-red-600'     // #DC2626 - Error text
'text-red-500'     // #EF4444 - Delete button hover

// Orange (warning, in-progress)
'bg-orange-50'     // #FFF7ED - Warning background
'text-orange-600'  // #EA580C - In Progress state

// Purple (review states)
'bg-purple-50'     // #FAF5FF - Review background
'text-purple-600'  // #9333EA - Review state
```

### Stage Colors (Kanban)

```typescript
const STAGE_COLORS = {
  'Backlog':     '#6B7280',  // Gray
  'To Do':       '#3B82F6',  // Blue
  'In Progress': '#F59E0B',  // Orange
  'In Review':   '#8B5CF6',  // Purple
  'Done':        '#10B981',  // Green
  'Blocked':     '#EF4444',  // Red
  'Cancelled':   '#9CA3AF'   // Light Gray
};
```

---

## Component Styles

### Buttons

#### Primary Button

```typescript
className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg
           hover:bg-blue-700 active:bg-blue-800
           transition-colors duration-200
           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
```

#### Secondary Button

```typescript
className="px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg
           border border-gray-300
           hover:bg-gray-50 active:bg-gray-100
           transition-colors duration-200
           focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
```

#### Icon Button (Small)

```typescript
className="p-2 hover:bg-gray-100 rounded-lg transition-colors"

// Icon size
<Icon className="h-5 w-5 text-gray-600 stroke-[1.5]" />
```

#### Entity Type Button (UnifiedLinkageModal)

```typescript
// Unselected
className="px-2 py-1 text-xs border border-gray-300 rounded
           hover:bg-gray-50 transition-colors"

// Selected
className="px-2 py-1 text-xs border border-blue-400 rounded
           bg-blue-50 text-blue-700 transition-colors"
```

#### Action Button (Plus/X icons)

```typescript
// Link button (green plus)
className="text-green-600 hover:text-green-700 cursor-pointer"
<Plus className="h-3.5 w-3.5" />

// Unlink button (red X)
className="text-red-600 hover:text-red-700 cursor-pointer"
<X className="h-3.5 w-3.5" />
```

### Badges & Tags

#### Status Badge

```typescript
// Linked status
className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
           bg-blue-100 text-blue-700 text-[10px] font-medium"

// Success status
className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
           bg-green-100 text-green-700 text-[10px] font-medium"

// Error status
className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
           bg-red-100 text-red-700 text-[10px] font-medium"
```

#### Tag Pill

```typescript
className="inline-flex items-center px-2.5 py-0.5 rounded-full
           text-xs font-medium bg-gray-100 text-gray-700"
```

### Form Inputs

#### Text Input

```typescript
className="w-full px-3 py-2 text-sm
           border border-gray-300 rounded-lg
           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
           placeholder-gray-400
           transition-colors duration-200"
```

#### Inline Editable Input (EntityDetailPage header)

```typescript
className="flex-1 text-lg font-semibold text-gray-900
           bg-white border-b-2 border-gray-300
           hover:border-blue-400 focus:border-blue-500
           focus:ring-0 focus:outline-none
           px-2 py-1 rounded-t"
```

#### Auto-Resize Textarea (WikiDesigner)

```typescript
className="w-full bg-transparent border-none outline-none
           resize-none overflow-hidden
           text-gray-700 placeholder-gray-400 leading-relaxed"
style={{ minHeight: '24px' }}

// Hook implementation:
const textareaRef = useAutoResizeTextarea(block.content || '');
useEffect(() => {
  const textarea = textareaRef.current;
  if (textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }
}, [value]);
```

#### Select Dropdown

```typescript
className="w-full px-3 py-2 text-sm
           border border-gray-300 rounded-lg
           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
           bg-white cursor-pointer"
```

### Tables

#### Table Container

```typescript
className="overflow-x-auto bg-white rounded-lg border border-gray-200"
```

#### Table Header

```typescript
// Header row
className="bg-gray-50 border-b border-gray-200"

// Header cell
className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
```

#### Table Body

```typescript
// Body row
className="border-b border-gray-100 hover:bg-gray-50 transition-colors"

// Linked row (UnifiedLinkageModal)
className="border-b border-gray-100 bg-blue-50"

// Body cell
className="px-3 py-1.5 text-xs text-gray-700"
```

### Modals

#### Modal Backdrop

```typescript
className="fixed inset-0 z-50 flex items-center justify-center
           bg-black bg-opacity-50 backdrop-blur-sm"
```

#### Modal Container

```typescript
// Size variants
const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

className="relative bg-white rounded-lg shadow-xl
           ${sizeClasses[size]} w-full mx-4
           max-h-[90vh] overflow-y-auto"
```

#### Modal Header

```typescript
className="flex items-center justify-between p-4 border-b border-gray-200"

// Title
className="text-lg font-semibold text-gray-900"

// Close button
className="p-1 hover:bg-gray-100 rounded transition-colors"
<X className="h-5 w-5 text-gray-500" />
```

#### Modal Footer

```typescript
className="flex items-center justify-end gap-3 p-4 border-t border-gray-200"
```

### Dividers

#### Solid Divider

```typescript
className="h-px bg-gray-200 my-4"
```

#### Striped Divider (Compact Layout)

```typescript
// 15% opacity striped pattern
className="h-px my-1.5"
style={{
  backgroundImage: 'repeating-linear-gradient(90deg, ' +
    'rgba(209, 213, 219, 0.15) 0px, ' +    // Gray-300 at 15% opacity
    'rgba(209, 213, 219, 0.15) 4px, ' +    // 4px stripe
    'transparent 4px, ' +                   // Gap start
    'transparent 8px)'                      // Gap end (4px gap)
}}
```

**Visual Pattern:**
```
████░░░░████░░░░████░░░░████░░░░
↑4px↑4px↑4px↑4px
stripe gap stripe gap
```

### Icons

#### Icon Sizes

```typescript
// Tiny (status indicators)
className="h-3 w-3"

// Small (inline with text)
className="h-3.5 w-3.5"

// Standard (buttons, actions)
className="h-4 w-4"

// Medium (page headers)
className="h-5 w-5"

// Large (empty states)
className="h-6 w-6"
```

#### Icon Colors & Weights

```typescript
// Default
className="text-gray-600 stroke-[1.5]"

// Muted
className="text-gray-400 stroke-[1.5]"

// Success
className="text-green-600 stroke-[2]"

// Error
className="text-red-600 stroke-[2]"

// Primary action
className="text-blue-600 stroke-[1.5]"
```

---

## Page Layouts

### EntityDetailPage Layout

```typescript
┌──────────────────────────────────────────────────────────────┐
│  Breadcrumb Navigation                                       │
│  Home > Projects > Project Name                              │
├──────────────────────────────────────────────────────────────┤
│  Header Section (Compact)                                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ project name: Corporate Office Planning [📋]          │ │
│  │ · code: CORP-001 [📋] · slug: /corp-office [📋]       │ │
│  │ · id: abc123... [📋]                                   │ │
│  │                                                         │ │
│  │ [🔗 Link] [📤 Share] [✏️ Edit] [🗑️ Delete]           │ │
│  └────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│  Tab Navigation (if entity has children)                     │
│  [ Overview ] [ Tasks ] [ Wiki ] [ Artifacts ]               │
├──────────────────────────────────────────────────────────────┤
│  Content Area                                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Overview Tab (Compact Form Layout)                     │ │
│  │ Description    Large workspace renovation              │ │
│  │ ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈│ │
│  │ Start Date     2025-01-15                              │ │
│  │ ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈│ │
│  │ Project Stage  ○──○──●──○──○ (Execution)             │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**CSS:**
```typescript
// Page wrapper
<div className="min-h-screen bg-gray-50">
  // Breadcrumb
  <nav className="px-6 py-3 bg-white border-b border-gray-200">
    <div className="flex items-center gap-2 text-sm">
      // Breadcrumb items
    </div>
  </nav>

  // Header
  <div className="px-6 py-4 bg-white border-b border-gray-200">
    // Header content (name, code, slug, ID, action buttons)
  </div>

  // Tabs
  <div className="px-6 bg-white border-b border-gray-200">
    // Tab navigation
  </div>

  // Content
  <div className="p-6">
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      // EntityFormContainer or child entity list
    </div>
  </div>
</div>
```

### EntityMainPage Layout

```typescript
┌──────────────────────────────────────────────────────────────┐
│  Header                                                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Projects (25)                          [+ Create]      │ │
│  │ [🔍 Search] [🔽 Filter]  [📊] [📋] [🎯]              │ │
│  └────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│  Content Area (Table/Kanban/Grid)                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Table View                                              │ │
│  │ ┌──────────────────────────────────────────────────┐  │ │
│  │ │ Name          Code      Stage      Budget        │  │ │
│  │ ├──────────────────────────────────────────────────┤  │ │
│  │ │ Project A     PRJ-001   Planning   $150k        │  │ │
│  │ │ Project B     PRJ-002   Execution  $200k        │  │ │
│  │ └──────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### WikiDesigner Layout (Notion-style)

```typescript
┌──────────────────────────────────────────────────────────────┐
│  Cover Image / Gradient                                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                 gradient-blue                           │ │
│  │                                                         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  📚 Page Title                                               │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ [☰] Heading 1                                    [🗑️] │ │
│  │ ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈│ │
│  │ [☰] Paragraph block text here...             [🗑️] │ │
│  │ ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈│ │
│  │ [☰] • Bullet point                           [🗑️] │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  [+ Add Block]                                               │
└──────────────────────────────────────────────────────────────┘
```

**Block Styles:**
```typescript
// Block container
className="group relative p-2 hover:bg-gray-50 rounded transition-colors"

// Drag handle
className="absolute left-0 top-1/2 -translate-y-1/2 opacity-0
           group-hover:opacity-100 cursor-move"
<GripVertical className="h-4 w-4 text-gray-400" />

// Delete button
className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0
           group-hover:opacity-100 p-1 hover:bg-red-50 rounded"
<Trash2 className="h-3.5 w-3.5 text-red-600" />
```

---

## Responsive Design

### Breakpoint System (Tailwind)

```typescript
// Mobile first approach
sm: '640px',   // Small devices (landscape phones)
md: '768px',   // Medium devices (tablets)
lg: '1024px',  // Large devices (laptops)
xl: '1280px',  // Extra large devices (desktops)
2xl: '1536px'  // 2X large devices (large desktops)
```

### Responsive Patterns

#### Stack on Mobile, Grid on Desktop

```typescript
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
```

#### Hide on Mobile

```typescript
className="hidden md:block"  // Hide below md breakpoint
```

#### Different Padding by Breakpoint

```typescript
className="px-4 md:px-6 lg:px-8"
```

#### Responsive Typography

```typescript
className="text-sm md:text-base lg:text-lg"
```

---

## Animation & Transitions

### Transition Utilities

```typescript
// Color transitions (buttons, hover states)
className="transition-colors duration-200"

// All properties
className="transition-all duration-200 ease-out"

// Transform transitions (modals, dropdowns)
className="transition-transform duration-300 ease-in-out"
```

### Common Animations

#### Fade In (Modal)

```typescript
// Backdrop
className="transition-opacity duration-300"
style={{ opacity: isOpen ? 1 : 0 }}

// Content
className="transition-all duration-300 transform"
style={{
  opacity: isOpen ? 1 : 0,
  scale: isOpen ? 1 : 0.95
}}
```

#### Hover Lift (Cards)

```typescript
className="transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
```

#### Success Flash (Copy Button)

```typescript
// Icon swap with transition
{copiedField === 'name' ? (
  <Check className="h-3.5 w-3.5 text-green-600 transition-all duration-200" />
) : (
  <Copy className="h-3.5 w-3.5 text-gray-400 transition-all duration-200" />
)}

// Reset after 2 seconds
setTimeout(() => setCopiedField(null), 2000);
```

---

## Accessibility Guidelines

### Focus States

```typescript
// All interactive elements MUST have focus styles
className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"

// For dark backgrounds
className="focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2"
```

### Keyboard Navigation

```typescript
// Enable keyboard interaction
<button
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
>
```

### ARIA Labels

```typescript
// Icon-only buttons
<button aria-label="Close modal">
  <X className="h-5 w-5" />
</button>

// Status indicators
<span aria-label="Linked" className="text-blue-600">
  <Check className="h-3.5 w-3.5" />
</span>
```

### Color Contrast

**Minimum Ratios (WCAG AA):**
- Normal text: 4.5:1
- Large text (18pt+): 3:1
- UI components: 3:1

**Examples:**
```typescript
// ✅ PASS: text-gray-700 on bg-white (10.8:1)
className="text-gray-700"

// ✅ PASS: text-gray-500 on bg-white (4.6:1)
className="text-gray-500"

// ❌ FAIL: text-gray-400 on bg-white (2.8:1) - Only for large text!
className="text-gray-400"
```

---

## Special Component Patterns

### Copy to Clipboard Button

```typescript
<button
  onClick={() => handleCopy('name', data.name)}
  className="p-1 hover:bg-gray-100 rounded transition-colors"
  title="Copy name"
>
  {copiedField === 'name' ? (
    <Check className="h-3.5 w-3.5 text-green-600" />
  ) : (
    <Copy className="h-3.5 w-3.5 text-gray-400" />
  )}
</button>

// Handler
const handleCopy = async (field: string, value: string) => {
  await navigator.clipboard.writeText(value);
  setCopiedField(field);
  setTimeout(() => setCopiedField(null), 2000);
};
```

### Entity Type Selector (Button Grid)

```typescript
// Container
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
      {getEntityLabel(type)}
    </button>
  ))}
</div>
```

### Sequential State Visualizer

```typescript
// Container
<div className="flex items-center gap-2">
  {stages.map((stage, index) => (
    <React.Fragment key={stage.level_name}>
      {/* Circle */}
      <div className={`
        flex items-center justify-center
        w-8 h-8 rounded-full border-2 transition-all
        ${currentStage === stage.level_name
          ? 'bg-gray-600 border-gray-600'  // Current (filled)
          : 'bg-white border-gray-300'      // Other (hollow)
        }
      `}>
        {currentStage === stage.level_name && (
          <Check className="h-4 w-4 text-white" />
        )}
      </div>

      {/* Connector line */}
      {index < stages.length - 1 && (
        <div className={`
          h-0.5 flex-1
          ${index < currentStageIndex
            ? 'bg-gray-600'          // Completed (solid)
            : 'border-t-2 border-dashed border-gray-300'  // Future (dashed)
          }
        `} />
      )}
    </React.Fragment>
  ))}
</div>

// Label row
<div className="flex items-center justify-between mt-2">
  {stages.map(stage => (
    <span key={stage.level_name} className="text-xs text-gray-500">
      {stage.level_name}
    </span>
  ))}
</div>
```

### Kanban Column

```typescript
// Column container
<div className="flex-shrink-0 w-80 bg-gray-50 rounded-lg">
  {/* Header */}
  <div className="p-3 border-b border-gray-200">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: column.color }}
        />
        <h3 className="text-sm font-medium text-gray-900">
          {column.title}
        </h3>
      </div>
      <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full">
        {column.items.length}
      </span>
    </div>
  </div>

  {/* Cards */}
  <div className="p-2 space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
    {column.items.map(item => (
      <div
        key={item.id}
        className="p-3 bg-white rounded-lg border border-gray-200
                   hover:shadow-md transition-shadow cursor-pointer"
      >
        {/* Card content */}
      </div>
    ))}
  </div>
</div>
```

---

## Implementation Checklist

When implementing new components, ensure:

- [ ] **Typography**: Uses documented font sizes and weights
- [ ] **Spacing**: Uses compact layout system (py-1.5, p-4, etc.)
- [ ] **Colors**: Uses semantic color palette
- [ ] **Transitions**: All interactive elements have smooth transitions
- [ ] **Focus States**: All clickable elements have visible focus rings
- [ ] **ARIA Labels**: Icon-only buttons have aria-label
- [ ] **Responsive**: Mobile-first with appropriate breakpoints
- [ ] **Consistency**: Matches existing component patterns
- [ ] **Accessibility**: Meets WCAG 2.1 AA standards

---

## Quick Reference

### Most Common Patterns

```typescript
// Container
'bg-white rounded-lg border border-gray-200 p-4'

// Section header
'text-sm font-medium text-gray-700 mb-2'

// Field label
'text-xs font-medium text-gray-500'

// Field value
'text-sm text-gray-700'

// Primary button
'px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg
 hover:bg-blue-700 transition-colors'

// Secondary button
'px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium
 rounded-lg hover:bg-gray-50 transition-colors'

// Icon button
'p-2 hover:bg-gray-100 rounded-lg transition-colors'

// Table cell
'px-3 py-1.5 text-xs text-gray-700'

// Status badge
'inline-flex items-center px-2 py-0.5 rounded-full text-[10px]
 font-medium bg-blue-100 text-blue-700'

// Striped divider
'h-px my-1.5' + striped gradient background

// Modal backdrop
'fixed inset-0 z-50 flex items-center justify-center
 bg-black bg-opacity-50 backdrop-blur-sm'
```

---

## Related Documentation

- **UI/UX Architecture**: `ui_ux_route_api.md`
- **Project & Task System**: `Project_Task.md`
- **Wiki System**: `wiki.md`
- **Kanban System**: `component_Kanban_System.md`
- **Unified Linkage**: `UnifiedLinkageSystem.md`

---

**Last Updated:** 2025-10-24
**Maintained By:** PMO Platform Team
**Questions?** Check implementation examples in `/apps/web/src/components/`
