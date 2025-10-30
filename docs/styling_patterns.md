# PMO Platform - Styling Patterns & Design System

> **Comprehensive design system documentation** - The single source of truth for all UI/UX styling patterns, colors, typography, icons, buttons, labels, and tabs across the PMO platform

**Last Updated:** 2025-10-29
**Version:** 6.0 - Complete Design System Documentation
**Architecture:** Tailwind CSS v4 + React 19 + TypeScript
**Coverage:** All components, pages, and shared patterns

---

## Table of Contents

1. [Typography System](#1-typography-system)
2. [Color Palette](#2-color-palette)
3. [Icon Standards](#3-icon-standards)
4. [Button Patterns](#4-button-patterns)
5. [Label & Badge Patterns](#5-label--badge-patterns)
6. [Tab Navigation](#6-tab-navigation)
7. [Form Elements](#7-form-elements)
8. [Spacing & Layout](#8-spacing--layout)
9. [Border & Shadow Standards](#9-border--shadow-standards)
10. [Interactive States](#10-interactive-states)
11. [Component-Specific Patterns](#11-component-specific-patterns)

---

## 1. Typography System

### 1.1 Font Family

```css
/* Primary font stack - used throughout the application */
font-family: Inter, 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif
```

**Applied in:**
- All metadata displays
- Form inputs
- Button text
- Body content

### 1.2 Font Sizes

```jsx
// Extra small - Uppercase labels, badges, counts
text-[10px]      // 10px - Category headers, metadata labels, count badges

// Extra small - Metadata values, small text
text-xs          // 12px - Tab labels, metadata values, small buttons, badges

// Small - Body text, form inputs, table cells
text-sm          // 14px - Most UI text, inputs, buttons, table content

// Base - Default
text-base        // 16px - Standard paragraphs

// Large - Section headers
text-lg          // 18px - Card titles, section headings

// Extra large - Page titles
text-xl          // 20px - Page headers
text-2xl         // 24px - Major section headers
text-3xl         // 30px - h2 headings
text-4xl         // 36px - h1 page titles
```

**Usage Examples:**

```jsx
{/* Uppercase metadata label */}
<span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
  Project Name:
</span>

{/* Metadata value */}
<span className="text-xs text-gray-800 font-medium">
  Construction Project Alpha
</span>

{/* Body text */}
<p className="text-sm text-gray-700">
  Regular paragraph content goes here
</p>

{/* Page title */}
<h1 className="text-2xl font-semibold text-gray-900">
  Project Dashboard
</h1>
```

### 1.3 Font Weights

```jsx
font-normal      // 400 - Default body text, buttons, most UI elements
font-medium      // 500 - Labels, metadata values, emphasized text
font-semibold    // 600 - Section headers, important headings
font-bold        // 700 - h1, h2 (rarely used)
```

**Weight Selection Guide:**
- **font-normal (400)**: Buttons, navigation, tabs, body text
- **font-medium (500)**: Uppercase labels, metadata values, table headers
- **font-semibold (600)**: Page titles, card headers

### 1.4 Letter Spacing

```jsx
tracking-wide    // 0.01em - Uppercase labels
tracking-wider   // 0.05em - Category headers, all-caps text
```

**Usage Pattern:**
```jsx
{/* Category header in sidebar */}
<div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
  Configuration
</div>

{/* Metadata label */}
<span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
  Created:
</span>
```

### 1.5 Line Height

```jsx
leading-none     // 1 - Tight spacing
leading-tight    // 1.25 - Headings
leading-normal   // 1.5 - Body text (default)
leading-relaxed  // 1.625 - Paragraph text
```

### 1.6 Text Transformations

```jsx
uppercase        // Used for labels, category headers
capitalize       // Rare - mostly for entity names
lowercase        // Not used
```

**Standard Uppercase Pattern:**
```jsx
{/* Always pair uppercase with tracking and small font */}
<span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
  Configuration
</span>
```

---

## 2. Color Palette

### 2.1 Gray Scale (Primary Palette)

```jsx
// BACKGROUNDS
bg-white         // #FFFFFF - Cards, panels, modals, inputs
bg-gray-50       // #F9FAFB - Page backgrounds, subtle containers
bg-gray-100      // #F3F4F6 - Hover states, disabled backgrounds, count badges
bg-gray-200      // #E5E7EB - Dividers (unused for backgrounds)

// TEXT COLORS
text-gray-900    // #111827 - Primary headings (rare)
text-gray-800    // #1F2937 - Metadata values, strong text, body headings
text-gray-700    // #374151 - Active tabs, buttons, primary body text
text-gray-600    // #4B5563 - Default text, icons, count badge text
text-gray-500    // #6B7280 - Category headers, muted icons
text-gray-400    // #9CA3AF - Metadata labels, placeholders, disabled text

// BORDER COLORS
border-gray-300  // #D1D5DB - PRIMARY BORDER (all buttons, inputs, cards, dividers)
border-gray-200  // #E5E7EB - Subtle dividers, secondary borders
```

**⚠️ IMPORTANT: Use gray-300 for ALL standard borders**

### 2.2 Semantic Colors

```jsx
// SUCCESS (Green)
bg-green-50      // #F0FDF4 - Alert backgrounds
bg-green-100     // #DCFCE7 - Badge backgrounds
text-green-600   // #16A34A - Success icons, text
text-green-700   // #15803D - Success states
text-green-800   // #166534 - Badge text
border-green-300 // Badge borders

// ERROR/DANGER (Red)
bg-red-50        // #FEF2F2 - Alert backgrounds
bg-red-100       // #FEE2E2 - Badge backgrounds
text-red-600     // #DC2626 - Error text, icons
text-red-700     // #B91C1C - Danger hover states
text-red-800     // #991B1B - Badge text
border-red-500   // #EF4444 - Error borders, danger buttons

// WARNING (Orange)
bg-orange-50     // #FFF7ED - Alert backgrounds
bg-orange-100    // #FFEDD5 - Badge backgrounds
text-orange-600  // #EA580C - Warning icons
text-orange-700  // #C2410C - Warning states

// INFO (Blue)
bg-blue-50       // #EFF6FF - Info backgrounds, hover states
bg-blue-100      // #DBEAFE - Info badges
text-blue-600    // #2563EB - Links, info text
text-blue-700    // #1D4ED8 - Active links
text-blue-800    // #1E40AF - Badge text
border-blue-300  // Badge borders

// ADDITIONAL COLORS (for badges)
purple, cyan, pink, amber, yellow
// All use 100 background / 800 text pattern
```

### 2.3 Badge Color System

**Standard Badge Color Pattern:**
```jsx
bg-[color]-100   // Light background
text-[color]-800 // Dark text
border-[color]-300 // Border (optional)
```

**Available Colors:**
- blue, purple, green, red, yellow, orange, gray, cyan, pink, amber

**Example:**
```jsx
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
  Planning
</span>
```

---

## 3. Icon Standards

### 3.1 Icon Library

**Source:** Lucide React (`lucide-react` package)

**Common Icons:**
```jsx
import {
  User,           // User profiles, employees
  Settings,       // Settings, configuration
  LogOut,         // Logout action
  Shield,         // Security, permissions
  CreditCard,     // Billing
  Menu,           // Hamburger menu
  ChevronLeft,    // Back navigation, collapse
  ChevronRight,   // Forward, expand
  ChevronDown,    // Dropdown indicators
  Tag,            // Labels, tags
  Search,         // Search inputs
  Copy,           // Copy to clipboard
  Check,          // Checkmarks, confirmations
  X,              // Close, cancel
  Edit,           // Edit actions
  Trash,          // Delete actions
  Plus,           // Create, add
  Download,       // Download actions
  Share,          // Share actions
  Link,           // Linkage, relationships
} from 'lucide-react';
```

### 3.2 Icon Sizes

```jsx
// TINY - Status indicators, inline badges
h-3 w-3          // 12px - Checkmarks in badges, small status icons

// SMALL - Tab icons, inline with small text
h-3.5 w-3.5      // 14px - Tab icons, small inline icons

// STANDARD - Default for most UI (PRIMARY SIZE)
h-4 w-4          // 16px - Most icons (buttons, navigation, metadata, inputs)

// MEDIUM - Navigation, headers (DEPRECATED for action buttons)
h-5 w-5          // 20px - Large navigation icons, special cases

// LARGE - Page icons, empty states
h-6 w-6          // 24px - Page headers, major sections
h-7 w-7          // 28px - Logo, brand icons
h-8 w-8          // 32px - Empty states, loaders
```

**⚠️ Default Standard: Use `h-4 w-4` for all action icons**

### 3.3 Icon Stroke Width

```jsx
stroke-[1.5]     // Standard stroke width - used everywhere
stroke-[2]       // Rare - bold emphasis only
```

**Standard Pattern:**
```jsx
<Settings className="h-4 w-4 text-gray-600 stroke-[1.5]" />
```

### 3.4 Icon Colors

```jsx
// DEFAULT ICONS
text-gray-600    // Primary icon color (navigation, actions)
text-gray-500    // Muted icons, inactive states
text-gray-400    // Disabled icons, placeholders

// ACTIVE/HOVER STATES
text-gray-700    // Active navigation icons
text-gray-600    // Hover state (from gray-500)

// SEMANTIC COLORS
text-green-600   // Success icons
text-red-600     // Error/danger icons
text-blue-600    // Info/link icons
text-orange-600  // Warning icons
```

### 3.5 Icon Usage Patterns

**Navigation Icons:**
```jsx
<Settings className="h-4 w-4 text-gray-500 group-hover:text-gray-600 stroke-[1.5]" />
```

**Action Icons:**
```jsx
<Edit className="h-4 w-4 text-gray-600 stroke-[1.5]" />
```

**Tab Icons:**
```jsx
<CheckSquare className="h-3.5 w-3.5 stroke-[1.5]" />
```

**Status Icons:**
```jsx
<Check className="h-3 w-3 text-green-600" />
```

**Icon + Text Pattern:**
```jsx
<div className="inline-flex items-center gap-2">
  <Icon className="h-4 w-4" />
  <span>Text</span>
</div>
```

---

## 4. Button Patterns

### 4.1 Button Component

**Location:** `apps/web/src/components/shared/button/Button.tsx`

**Base Classes:**
```jsx
const baseClasses = 'inline-flex items-center border text-sm font-normal rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0';
```

### 4.2 Button Variants

```jsx
// PRIMARY (light gray style)
border-gray-300 text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300
focus:ring-gray-400 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200

// SECONDARY (identical to primary)
border-gray-300 text-gray-700 bg-white hover:bg-gray-50

// DANGER (red gradient)
border-red-500 text-white bg-gradient-to-b from-red-500 to-red-600
hover:from-red-600 hover:to-red-700 focus:ring-red-400

// SUCCESS (light gray style)
border-gray-300 text-gray-700 bg-white hover:bg-gray-50

// GHOST (borderless)
border-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-400
```

**⚠️ Note: All non-danger buttons use light gray border style (no shadows)**

### 4.3 Button Sizes

```jsx
sm: 'px-2.5 py-1 text-xs'      // Small - 10px vertical, 12px text
md: 'px-3 py-1.5 text-sm'      // Medium - 6px vertical, 14px text (DEFAULT)
lg: 'px-4 py-2 text-base'      // Large - 8px vertical, 16px text
```

### 4.4 Button Icon Sizing

```jsx
// Small button
h-3 w-3 stroke-[1.5]

// Medium button (default)
h-4 w-4 stroke-[1.5]

// Large button
h-5 w-5 stroke-[1.5]
```

### 4.5 Button Usage Examples

```jsx
{/* Primary button */}
<Button variant="primary" size="md" icon={Save}>
  Save Changes
</Button>

{/* Secondary button */}
<Button variant="secondary" size="sm">
  Cancel
</Button>

{/* Danger button */}
<Button variant="danger" icon={Trash}>
  Delete
</Button>

{/* Icon-only button */}
<button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
  <Edit className="h-4 w-4 text-gray-600 stroke-[1.5]" />
</button>

{/* Ghost button */}
<Button variant="ghost" size="sm" icon={X}>
  Close
</Button>
```

### 4.6 Button States

```jsx
// LOADING STATE
{loading && (
  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
)}

// DISABLED STATE
disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed
```

---

## 5. Label & Badge Patterns

### 5.1 Uppercase Labels

**Standard Pattern:**
```jsx
<span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
  Project Name:
</span>
```

**Usage:**
- Metadata labels
- Category headers
- Form field labels
- Table column headers

**Example in Context:**
```jsx
{/* Metadata field */}
<div className="flex items-center gap-1.5">
  <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
    Code:
  </span>
  <span className="text-xs text-gray-800 font-medium">
    PROJ-2024-001
  </span>
</div>
```

### 5.2 Badge Patterns

**Standard Badge:**
```jsx
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
  Active
</span>
```

**Badge Size Variants:**
```jsx
// Extra small
px-2 py-0.5 text-[10px]        // For inline use, compact displays

// Small (default)
px-2.5 py-0.5 text-xs          // Standard badges

// Medium
px-3 py-1 text-sm              // Larger badges
```

**Badge Color Variants:**
```jsx
// Success
bg-green-100 text-green-800

// Error
bg-red-100 text-red-800

// Warning
bg-yellow-100 text-yellow-800

// Info
bg-blue-100 text-blue-800

// Default
bg-gray-100 text-gray-800

// Custom colors: purple, cyan, pink, amber, orange
```

### 5.3 Count Badges

**Standard Count Badge:**
```jsx
<span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-normal bg-gray-100 text-gray-600">
  5
</span>
```

**Usage:** Tab counts, notification counts, item counters

### 5.4 Category Headers

**Sidebar Category Pattern:**
```jsx
<div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
  Configuration
</div>
```

**Properties:**
- Font: `text-xs` (12px)
- Weight: `font-medium` (500)
- Color: `text-gray-500`
- Transform: `uppercase`
- Spacing: `tracking-wider`
- Padding: `px-3 py-1`

---

## 6. Tab Navigation

### 6.1 Tab Component

**Location:** `apps/web/src/components/shared/entity/DynamicChildEntityTabs.tsx`

**Tab Container:**
```jsx
<div className="bg-white">
  <div className="px-6 py-1.5">
    <nav className="flex items-center gap-6" aria-label="Tabs">
      {/* Tabs */}
    </nav>
  </div>
  <div className="h-px bg-gray-200" />
</div>
```

### 6.2 Tab Button Styles

**Active Tab:**
```jsx
<button className="group inline-flex items-center gap-1.5 px-1 py-1.5 border-b-2 border-gray-300 text-gray-700 font-normal text-xs transition-all duration-200">
  <Icon className="h-3.5 w-3.5 stroke-[1.5]" />
  <span>Overview</span>
  {count && (
    <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-normal bg-gray-100 text-gray-600">
      {count}
    </span>
  )}
</button>
```

**Inactive Tab:**
```jsx
<button className="border-transparent text-gray-600 hover:border-gray-300 cursor-pointer">
  {/* Same structure as active */}
</button>
```

**Disabled Tab:**
```jsx
<button className="border-transparent text-gray-400 cursor-not-allowed">
  {/* Same structure */}
</button>
```

### 6.3 Tab Design Principles

**Key Features:**
- **Minimalistic:** Simple underline indicator (border-b-2)
- **No color change:** Text stays gray-700/gray-600
- **Small icons:** h-3.5 w-3.5 (14px)
- **Compact spacing:** py-1.5 (6px vertical padding)
- **Clean hover:** Subtle border appearance only

**⚠️ Design Rule:** Use basic underline, don't change font color or add decorative effects

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

**Properties:**
- Padding: `px-3 py-1.5` (12px horizontal, 6px vertical)
- Border: `border-gray-300` (light gray)
- Focus: Ring with gray-400 at 30% opacity
- Placeholder: `text-gray-400`

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

### 7.3 Textarea

```jsx
<textarea
  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
             focus:ring-2 focus:ring-gray-400/30 focus:border-gray-300
             placeholder:text-gray-400 resize-vertical"
  rows={4}
  placeholder="Enter description..."
/>
```

### 7.4 Select Dropdown

```jsx
<select
  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm
             focus:outline-none focus:ring-2 focus:ring-gray-400/30 focus:border-gray-300
             bg-white cursor-pointer"
>
  <option value="">Select option</option>
  <option value="1">Option 1</option>
</select>
```

### 7.5 Checkbox

```jsx
<label className="flex items-center gap-2 cursor-pointer">
  <input
    type="checkbox"
    className="h-4 w-4 text-blue-600 border-gray-300 rounded
               focus:ring-2 focus:ring-gray-400/30"
  />
  <span className="text-sm text-gray-700">Checkbox label</span>
</label>
```

---

## 8. Spacing & Layout

### 8.1 Padding Scale

```jsx
p-0.5   // 2px
p-1     // 4px - Tight spacing
p-1.5   // 6px - Compact buttons, inputs
p-2     // 8px - Small containers
p-3     // 12px - Standard padding (inputs, cards)
p-4     // 16px - Card content
p-6     // 24px - Page containers, large cards
p-8     // 32px - Hero sections
```

### 8.2 Margin Scale

```jsx
mb-1    // 4px - Tight spacing
mb-2    // 8px - Between label and input
mb-3    // 12px
mb-4    // 16px - Between sections
mb-6    // 24px - Major section spacing
```

### 8.3 Gap Scale

```jsx
gap-1     // 4px - Very tight
gap-1.5   // 6px - Icon + text in tabs/metadata
gap-2     // 8px - Icon + text standard
gap-3     // 12px - Button groups
gap-4     // 16px - Grid items, form fields
gap-6     // 24px - Tab navigation, large spacing
```

### 8.4 Container Padding Standards

```jsx
// Header
px-6 py-2        // Reduced from py-4 to py-2 (50% reduction)

// Main content
px-6 py-4        // Page padding

// Compact containers
px-4 py-3        // Settings sidebar

// Card content
p-4              // Standard card
p-6              // Large card
```

---

## 9. Border & Shadow Standards

### 9.1 Border Colors

```jsx
// PRIMARY BORDER (use this for EVERYTHING)
border-gray-300  // #D1D5DB - Standard for all buttons, inputs, cards, dividers

// SUBTLE BORDERS
border-gray-200  // #E5E7EB - Section dividers, subtle containers

// SEMANTIC BORDERS (exceptions only)
border-red-500   // Error states, danger actions
border-green-500 // Success confirmation (rare)
```

**⚠️ CRITICAL RULE: Use `border-gray-300` for ALL standard UI borders**

### 9.2 Border Radius

```jsx
rounded       // 4px - Default
rounded-md    // 6px - Inputs, buttons
rounded-lg    // 8px - Cards, panels
rounded-xl    // 12px - Modals
rounded-full  // 9999px - Badges, avatars, count badges
```

### 9.3 Shadow Scale

```jsx
shadow-sm     // Subtle - buttons, small cards
shadow        // Default - cards
shadow-md     // Moderate - hover states
shadow-lg     // Large - modals, dropdowns
shadow-xl     // Extra large - emphasized panels
shadow-2xl    // Maximum - hero elements
```

**Standard Card Shadow:**
```jsx
className="shadow-sm hover:shadow-md transition-all duration-200"
```

---

## 10. Interactive States

### 10.1 Hover States

```jsx
// Background hover
hover:bg-gray-50     // Light hover for white backgrounds
hover:bg-gray-100    // Buttons, icon buttons

// Border hover
hover:border-gray-300  // Standard hover

// Text hover
hover:text-gray-600    // From gray-500
hover:text-gray-700    // From gray-600
```

### 10.2 Focus States

```jsx
// Standard input focus
focus:outline-none focus:ring-2 focus:ring-gray-400/30 focus:border-gray-300

// Button focus
focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-gray-400

// No focus ring (inline edit)
focus:ring-0 focus:outline-none
```

### 10.3 Disabled States

```jsx
disabled:bg-gray-100
disabled:text-gray-400
disabled:border-gray-200
disabled:cursor-not-allowed
```

### 10.4 Transition Standards

```jsx
transition-colors      // Color transitions (default)
transition-all         // Multiple properties
duration-150          // Fast (buttons)
duration-200          // Standard (most UI)
duration-300          // Slow (animations)
```

---

## 11. Component-Specific Patterns

### 11.1 Sidebar Navigation Item

```jsx
<button
  className={`
    ${active
      ? 'bg-gray-100 text-gray-900 border-r-2 border-gray-300'
      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
    }
    w-full group flex items-center px-3 py-1.5 text-sm font-normal
    rounded-l-lg transition-all duration-200
  `}
>
  <Icon className={`
    ${active ? 'text-gray-700' : 'text-gray-500 group-hover:text-gray-600'}
    ${collapsed ? '' : 'mr-3'}
    h-4 w-4 stroke-[1.5]
  `} />
  {!collapsed && <span>Label</span>}
</button>
```

### 11.2 Card Pattern

```jsx
<div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 p-4">
  {/* Card content */}
</div>
```

### 11.3 Modal Pattern

```jsx
{/* Backdrop */}
<div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />

{/* Modal */}
<div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh]">
  {/* Header */}
  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
    <h2 className="text-lg font-semibold text-gray-900">Title</h2>
    <button className="p-1 hover:bg-gray-100 rounded-lg">
      <X className="h-5 w-5 text-gray-500" />
    </button>
  </div>

  {/* Content */}
  <div className="flex-1 overflow-y-auto px-6 py-4">
    {/* Content */}
  </div>

  {/* Footer */}
  <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
    <Button variant="secondary">Cancel</Button>
    <Button variant="primary">Save</Button>
  </div>
</div>
```

### 11.4 Table Pattern

```jsx
<div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
  <table className="min-w-full divide-y divide-gray-200">
    <thead className="bg-gray-50">
      <tr>
        <th className="px-3 py-1.5 text-left text-[11px] font-normal text-gray-600 uppercase tracking-wider">
          Column
        </th>
      </tr>
    </thead>
    <tbody className="bg-white divide-y divide-gray-100">
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="px-3 py-1.5 text-xs text-gray-700">
          Cell
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### 11.5 Copy to Clipboard Button

```jsx
<button
  onClick={() => handleCopy(value)}
  className="p-1 hover:bg-gray-100 rounded transition-colors"
  title="Copy to clipboard"
>
  {copied ? (
    <Check className="h-3 w-3 text-green-600" />
  ) : (
    <Copy className="h-3 w-3 text-gray-400" />
  )}
</button>
```

---

## Quick Reference

### Most Common Patterns

| Pattern | Classes |
|---------|---------|
| **Standard Button** | `border-gray-300 text-gray-700 bg-white hover:bg-gray-50 px-3 py-1.5 text-sm rounded` |
| **Icon Button** | `p-1.5 hover:bg-gray-100 rounded-lg transition-colors` |
| **Badge** | `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800` |
| **Count Badge** | `min-w-[16px] h-[16px] px-1 rounded-full text-[10px] bg-gray-100 text-gray-600` |
| **Uppercase Label** | `text-[10px] font-medium text-gray-400 uppercase tracking-wider` |
| **Metadata Value** | `text-xs text-gray-800 font-medium` |
| **Input** | `px-3 py-1.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400/30` |
| **Card** | `bg-white rounded-lg border border-gray-200 shadow-sm p-4` |
| **Active Tab** | `border-b-2 border-gray-300 text-gray-700 text-xs` |
| **Icon Standard** | `h-4 w-4 text-gray-600 stroke-[1.5]` |

---

## Design Principles

1. **Minimalism:** Clean, simple designs without excessive decoration
2. **Consistency:** Use gray-300 for ALL borders, h-4 w-4 for ALL action icons
3. **Typography Hierarchy:** Uppercase labels (10px) + medium values (12px)
4. **Compact Spacing:** Reduced padding/margins for efficient use of space
5. **Subtle Interactions:** Gentle hover states, smooth transitions
6. **Accessibility:** Clear focus states, sufficient color contrast

---

## Related Documentation

- **Architecture:** `/docs/ui_ux_route_api.md`
- **Data Model:** `/docs/datamodel.md`
- **Components:** Entity-specific patterns in `/apps/web/src/components/`

---

**Maintained By:** PMO Platform Team
**Last Audit:** 2025-10-29
**Version:** 6.0 - Complete Design System
