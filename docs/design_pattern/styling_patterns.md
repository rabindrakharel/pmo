# PMO Platform - UI/UX Design System

> **The Single Source of Truth** - Definitive styling patterns for a premium, elegant, and consistent user experience

**Version:** 14.4.1 - WARM SEPIA + DESIGN SYSTEM CENTRALIZATION
**Theme:** Warm Sepia Palette - Easy on eyes for long sessions
**Last Updated:** 2025-12-11
**CRITICAL:** All colors from `dark-*` tokens in tailwind.config.js
**Architecture:** Tailwind CSS v3.4 + React 19 + TypeScript + designSystem.ts

---

## Core Design Philosophy

**Principles:**
1. **Elegance Through Simplicity** - Minimal, clean interfaces without unnecessary decoration
2. **Premium Aesthetics** - Notion-inspired warm neutrals and subtle depth
3. **Consistent Experience** - Every element follows the same patterns
4. **Lightweight Performance** - Smooth transitions, fast interactions
5. **Eye-Pleasing Comfort** - Soft colors, gentle contrasts, refined typography

---

## 1. Color System

### Warm Sepia Palette (v14.4.0) - Easy on Eyes

Based on Tailwind Stone palette with cream undertones. Reduces eye strain for long sessions by avoiding pure black/white and using warm neutrals.

```jsx
// CANVAS & SURFACES (tailwind.config.js: colors.dark)
bg-dark-canvas     // #FAF9F7 - Cream page background (warm off-white)
bg-dark-surface    // #FEFDFB - Warm white for cards, panels
bg-dark-subtle     // #F5F5F4 - Subtle backgrounds (stone-100)
bg-dark-hover      // #E7E5E4 - Hover states (stone-200)
bg-dark-active     // #D6D3D1 - Active/pressed states (stone-300)

// TEXT HIERARCHY (Softer contrast - NOT pure black)
text-dark-text-primary    // #292524 - Soft black (stone-800)
text-dark-text-secondary  // #57534E - Warm gray (stone-600)
text-dark-text-tertiary   // #78716C - Muted warm gray (stone-500)
text-dark-text-placeholder // #A8A29E - Placeholders (stone-400)
text-dark-text-disabled   // #D6D3D1 - Disabled text (stone-300)

// BORDERS (Warm tones)
border-dark-border-subtle   // #F5F5F4 - Subtle borders (stone-100)
border-dark-border-default  // #E7E5E4 - Default borders (stone-200)
border-dark-border-medium   // #D6D3D1 - Medium emphasis (stone-300)
border-dark-border-strong   // #A8A29E - Strong emphasis (stone-400)

// ACCENT (Warm Stone - replaces slate)
bg-dark-accent       // #57534E (stone-600) - Primary buttons, active tabs
hover:bg-dark-accent-hover  // #44403C (stone-700) - Hover state
text-dark-accent     // #57534E - Action text, links
focus:ring-dark-accent-ring // rgba(87, 83, 78, 0.25) - Focus rings

// NUMBERED SCALE (Warm Stone for backwards compatibility)
bg-dark-50   // #FAFAF9 (stone-50)
bg-dark-100  // #F5F5F4 (stone-100)
bg-dark-200  // #E7E5E4 (stone-200)
bg-dark-300  // #D6D3D1 (stone-300)
bg-dark-400  // #A8A29E (stone-400)
bg-dark-500  // #78716C (stone-500)
bg-dark-600  // #57534E (stone-600)
bg-dark-700  // #44403C (stone-700)
bg-dark-800  // #292524 (stone-800)
bg-dark-900  // #1C1917 (stone-900)
```

### Why Warm Sepia?

| Issue | Cool Grays | Warm Sepia |
|-------|------------|------------|
| Text on white | `#1A1A1A` (harsh) | `#292524` (soft) |
| Background | `#FAFAFA` (cold) | `#FAF9F7` (cream) |
| Cards | `#FFFFFF` (glaring) | `#FEFDFB` (warm) |
| Contrast | High (eye strain) | Moderate (comfortable) |

### Semantic Colors

```jsx
// STATUS COLORS (for badges and indicators only)
text-green-600   // Success
text-red-600     // Error/Danger
text-orange-600  // Warning
text-gray-600    // Info (not blue)

// BADGE BACKGROUNDS
bg-green-100 text-green-800   // Success badge
bg-red-100 text-red-800       // Error badge
bg-orange-100 text-orange-800 // Warning badge
bg-gray-100 text-gray-800     // Info/Default badge
```

---

## 2. Typography

### Font Configuration

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
```

### Production Typography Scale (v13.0)

```jsx
// FROM designSystem.ts - text tokens with proper line-heights

// HEADINGS (with tight letter-spacing)
text.h1  // text-2xl font-bold tracking-tight leading-7 (24px)
text.h2  // text-xl font-semibold tracking-tight leading-6 (20px)
text.h3  // text-lg font-medium tracking-tight leading-6 (18px)
text.h4  // text-base font-medium tracking-tight leading-5 (16px)

// BODY TEXT (with proper line-heights)
text.body      // text-sm leading-5 text-dark-text-secondary (14px)
text.bodyLarge // text-base leading-6 text-dark-text-secondary (16px)
text.caption   // text-xs leading-4 text-dark-text-tertiary (12px)

// SPECIAL PATTERNS
text.label     // text-xs font-medium uppercase tracking-wider text-dark-text-tertiary
text.code      // font-mono text-sm bg-dark-muted px-1.5 py-0.5 rounded
text.link      // text-slate-600 hover:text-slate-700 hover:underline

// USAGE EXAMPLES
<h1 className={text.h1}>Page Title</h1>
<p className={text.body}>Body content here</p>
<span className={text.caption}>Metadata text</span>
```

### Legacy Text Sizes (Still Supported)

```jsx
// HEADINGS
text-2xl font-semibold  // Page titles (24px)
text-xl font-semibold   // Section headers (20px)
text-lg font-medium     // Card titles (18px)
text-base font-medium   // Subsection headers (16px)

// BODY TEXT
text-sm font-normal     // Default body text (14px) - MOST COMMON
text-xs font-normal     // Small text, metadata (12px)
text-[10px] font-medium // Labels, counts (10px) - USE SPARINGLY
```

---

## 3. Component Patterns

### 3.1 Button Component (v14.4.1 - Centralized)

**Design Token System** - Use `designSystem.ts` button tokens. Button styling is centralized in designSystem.ts, NOT Tailwind config, because:
- Buttons need compound variants (variant × size × state)
- Type-safe props with IDE autocomplete
- Dynamic composition that Tailwind can't handle

```tsx
// IMPORT FROM DESIGN SYSTEM
import { button, cx } from '@/lib/designSystem';

// PRIMARY BUTTON - Warm stone accent (#57534E)
<button className={cx(button.base, button.variant.primary, button.size.sm)}>
  <Plus className="h-3.5 w-3.5" />
  Create Entity
</button>
// Result: bg-dark-accent text-white h-7 px-2.5 text-xs

// SECONDARY BUTTON
<button className={cx(button.base, button.variant.secondary, button.size.md)}>
  <Link className="h-4 w-4" />
  Entity Mapping
</button>
// Result: bg-dark-surface text-dark-text-primary border border-dark-border-default

// GHOST BUTTON
<button className={cx(button.base, button.variant.ghost, button.size.md)}>
  <Settings className="h-4 w-4" />
  Settings
</button>
// Result: bg-transparent text-dark-text-secondary hover:bg-dark-hover

// DANGER BUTTON
<button className={cx(button.base, button.variant.danger, button.size.md)}>
  <Trash className="h-4 w-4" />
  Delete
</button>
// Result: bg-dark-error text-white hover:bg-red-700

// BUTTON SIZES (v14.4.0 - less bulky)
button.size.xs   // h-6 px-2 text-xs gap-1
button.size.sm   // h-7 px-2.5 text-xs gap-1.5 (RECOMMENDED for tables)
button.size.md   // h-8 px-3 text-sm gap-1.5 (DEFAULT)
button.size.lg   // h-9 px-4 text-sm gap-2
button.size.xl   // h-10 px-5 text-base gap-2

// ICON-ONLY BUTTON
button.icon.sm   // h-7 w-7 p-0
button.icon.md   // h-8 w-8 p-0
```

**Legacy Inline Classes** (Still Supported):

```jsx
// PRIMARY BUTTON
<button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                   bg-dark-accent text-white shadow-sm
                   hover:bg-slate-700 transition-colors
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500">
  <Database className="h-4 w-4" />
  <span>Entities (32)</span>
</button>

// SECONDARY BUTTON
<button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                   bg-white text-dark-text-secondary border border-dark-border
                   hover:bg-dark-muted hover:border-dark-border-strong transition-colors">
  <Link className="h-4 w-4" />
  <span>Entity Mapping</span>
</button>
```

### 3.2 Tabs - Minimalistic Style (Slate Accent)

**Tab Navigation Pattern (Use This Everywhere)**
```jsx
<div className="bg-dark-50/50 border-b border-dark-200 px-6 py-3">
  <div className="flex flex-wrap gap-2">
    {/* Active Tab - SLATE BACKGROUND */}
    <button className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all bg-slate-600 text-white shadow-sm">
      <House className="h-3.5 w-3.5" />
      <span>Overview</span>
    </button>

    {/* Inactive Tab */}
    <button className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all bg-white text-dark-600 border border-dark-300 hover:border-dark-400">
      <FolderKanban className="h-3.5 w-3.5" />
      <span>Core Management</span>
    </button>

    {/* Tab with Count */}
    <button className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all bg-white text-dark-600 border border-dark-300 hover:border-dark-400">
      <CheckSquare className="h-3.5 w-3.5" />
      <span>Tasks</span>
      <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/20 text-current">
        5
      </span>
    </button>
  </div>
</div>
```

### 3.3 Cards & Containers

**Feature Cards with Gradient Icons**
```jsx
// Feature Card with Slate Gradient Icon
<a className="bg-dark-100 rounded-lg p-5 border border-dark-300 hover:border-slate-500 hover:shadow-md transition-all group" href="/project">
  <div className="flex items-start gap-4">
    {/* Icon with Slate Gradient */}
    <div className="h-12 w-12 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
      <FolderKanban className="h-6 w-6 text-white" />
    </div>

    {/* Content */}
    <div className="flex-1">
      <h3 className="font-bold text-dark-600 mb-1 group-hover:text-slate-700">Create Your First Project</h3>
      <p className="text-sm text-dark-700 mb-3">Set up a project with budget, timeline, and team assignments</p>

      {/* Action Link */}
      <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 group-hover:gap-3 transition-all">
        Get Started
        <ArrowRight className="h-4 w-4" />
      </div>
    </div>
  </div>
</a>

// Standard Card
<div className="bg-dark-100 border border-dark-300 rounded-xl shadow-sm p-6 hover:shadow-md transition-all duration-200">
  <h3 className="text-lg font-medium text-dark-700 mb-4">Card Title</h3>
  <p className="text-sm text-dark-600">Card content goes here</p>
</div>
```

### 3.4 Form Elements (Production-Grade v13.0)

**Design Token System** - Use `designSystem.ts` input tokens:

```tsx
// IMPORT FROM DESIGN SYSTEM
import { input } from '@/lib/designSystem';

// INPUT TOKENS
input.base    // w-full rounded-lg border transition-colors
input.default // border-dark-border bg-white text-dark-text-primary
              // placeholder:text-dark-text-muted
              // focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20
input.error   // border-red-500 focus:border-red-500 focus:ring-red-500/20
input.size.sm // px-3 py-1.5 text-sm
input.size.md // px-3 py-2 text-sm (DEFAULT)
input.size.lg // px-4 py-2.5 text-base
```

**Input Fields**
```jsx
// Text Input (using tokens)
<input
  type="text"
  className={`${input.base} ${input.default} ${input.size.md}`}
  placeholder="Enter value..."
/>

// Or inline (legacy)
<input
  type="text"
  className="w-full px-3 py-2 text-sm border border-dark-border rounded-lg bg-white
             text-dark-text-primary placeholder:text-dark-text-muted
             focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500
             transition-colors"
  placeholder="Enter value..."
/>

// Select Dropdown
<select className="w-full px-3 py-2 text-sm border border-dark-border rounded-lg bg-white
                   text-dark-text-primary cursor-pointer
                   focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500
                   transition-colors">
  <option value="">Select option...</option>
  <option value="1">Option 1</option>
</select>

// Search Input with Icon
<div className="relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-text-muted" />
  <input
    type="text"
    placeholder="Search..."
    className="w-full pl-9 pr-3 py-2 text-sm border border-dark-border rounded-lg bg-white
               text-dark-text-primary placeholder:text-dark-text-muted
               focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500
               transition-colors"
  />
</div>
```

### 3.5 Tables - DENSITY SYSTEM (v14.2.0)

**Data Table Density Configuration**

The `EntityListOfInstancesTable` supports three density levels for different use cases:

| Density | Row Height | Cell Padding | Font Size | Use Case |
|---------|------------|--------------|-----------|----------|
| **compact** | 32px | `px-3 py-1` | `text-xs` (12px) | Power users, data comparison, maximizing visible rows |
| **regular** | 40px | `px-4 py-2` | `text-[13px]` | Default everyday use, balanced readability |
| **relaxed** | 48px | `px-5 py-3` | `text-sm` (14px) | Accessibility, touch devices, sparse data |

**Density Config Constants (EntityListOfInstancesTable.tsx)**
```typescript
const DENSITY_CONFIG = {
  compact: {
    rowHeight: 32,
    cellPadding: 'px-3 py-1',
    headerPadding: 'px-3 py-1.5',
    fontSize: 'text-xs',
    badgeSize: 'px-1.5 py-px text-[10px]',
    iconSize: 'h-3 w-3',
    actionIconSize: 'h-3.5 w-3.5',
    inputPadding: 'px-1.5 py-0.5',
  },
  regular: {
    rowHeight: 40,
    cellPadding: 'px-4 py-2',
    headerPadding: 'px-4 py-2',
    fontSize: 'text-[13px]',
    badgeSize: 'px-2 py-0.5 text-[11px]',
    iconSize: 'h-3.5 w-3.5',
    actionIconSize: 'h-4 w-4',
    inputPadding: 'px-2 py-1',
  },
  relaxed: {
    rowHeight: 48,
    cellPadding: 'px-5 py-3',
    headerPadding: 'px-5 py-2.5',
    fontSize: 'text-sm',
    badgeSize: 'px-2.5 py-0.5 text-xs',
    iconSize: 'h-4 w-4',
    actionIconSize: 'h-4 w-4',
    inputPadding: 'px-2.5 py-1.5',
  },
};
```

**Usage**
```tsx
import { EntityListOfInstancesTable, TableDensity } from '@/components/shared/ui/EntityListOfInstancesTable';

// Default is 'compact' for minimal look
<EntityListOfInstancesTable
  data={projects}
  density="compact"  // or "regular" or "relaxed"
  onDensityChange={setDensity}  // Optional: shows density toggle in toolbar
/>
```

**Inline Edit Input Styling (Compact)**
```jsx
// Inputs use densitySettings.inputPadding for consistent sizing
<input className={`w-full ${densitySettings.inputPadding} ${densitySettings.fontSize}
                   border border-slate-300 rounded focus:outline-none
                   focus:border-slate-400 bg-white`} />

// Select dropdowns
<select className={`w-full ${densitySettings.inputPadding} pr-6
                    border border-slate-300 rounded focus:outline-none
                    focus:border-slate-400 bg-white cursor-pointer
                    appearance-none ${densitySettings.fontSize}`} />
```

**Badge Styling by Density**
```jsx
// Compact: px-1.5 py-px text-[10px] rounded
<span className="inline-flex items-center px-1.5 py-px rounded text-[10px] font-medium bg-green-100 text-green-800">
  Active
</span>

// Regular: px-2 py-0.5 text-[11px] rounded
<span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-green-100 text-green-800">
  Active
</span>

// Relaxed: px-2.5 py-0.5 text-xs rounded
<span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
  Active
</span>
```

**Action Icons - Always Visible**
```jsx
// Action icons use densitySettings.actionIconSize
// They are ALWAYS visible (no opacity-0 hover patterns)
<div className="flex items-center justify-center gap-0.5">
  {allActions.map((action) => (
    <button className="p-1 rounded transition-colors text-slate-500 hover:text-slate-700 hover:bg-slate-100">
      {React.cloneElement(action.icon, { className: densitySettings.actionIconSize })}
    </button>
  ))}
</div>
```

**Related Component Styling (Compact)**

| Component | Trigger Padding | Font Size | Icon Size |
|-----------|-----------------|-----------|-----------|
| `BadgeDropdownSelect` | `px-1.5 py-0.5 pr-6` | `text-xs` | `h-3 w-3` |
| `EntityInstanceNameSelect` | `px-1.5 py-0.5` | `text-xs` | `w-3 h-3` |
| Inline `<select>` | `px-1.5 py-0.5 pr-6` | Density-based | `h-3 w-3` |
| Inline `<input>` | Density-based | Density-based | N/A |

**Table Structure (Compact Density)**
```jsx
<div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
  {/* Toolbar */}
  <div className="px-4 py-2.5 bg-white border-b border-slate-100">
    {/* Filter controls */}
  </div>

  {/* Header - minimal with uppercase labels */}
  <thead className="bg-white border-b border-slate-200 sticky top-0 z-30">
    <tr>
      <th className="px-3 py-1.5 text-left">
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Column Name
        </span>
      </th>
    </tr>
  </thead>

  {/* Body - subtle dividers */}
  <tbody className="bg-white divide-y divide-slate-100">
    <tr className="group transition-colors duration-150 hover:bg-slate-50/40">
      <td className="px-3 py-1 text-xs leading-snug text-slate-700">
        Cell content
      </td>
    </tr>
  </tbody>
</div>
```

**CRITICAL COMPACT TABLE RULES:**
- Row height: 32px (not 44px or larger)
- Cell padding: `px-3 py-1` (minimal vertical padding)
- Header labels: `text-[11px] font-medium uppercase tracking-wider text-slate-500`
- Cell text: `text-xs text-slate-700 leading-snug`
- Borders: `border-slate-100` (very subtle dividers)
- Hover: `hover:bg-slate-50/40` (subtle, not heavy)
- Actions: Always visible, `text-slate-500` color

### 3.6 Badges & Labels

**Status Badges**
```jsx
// Standard Badge Pattern (NO BLUE)
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
  Active
</span>

// Count Badge (for tabs, notifications)
<span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-medium bg-white/20 text-current">
  5
</span>

// Status-Specific Badges
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
  Complete
</span>

<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
  Pending
</span>
```

### 3.7 Modals

**Modal Structure**
```jsx
{/* Backdrop */}
<div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />

{/* Modal Container */}
<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
  <div className="bg-dark-100 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
    {/* Header */}
    <div className="flex items-center justify-between px-6 py-4 border-b border-dark-300">
      <h2 className="text-lg font-semibold text-dark-700">Modal Title</h2>
      <button className="p-1 hover:bg-dark-200 rounded-lg transition-colors">
        <X className="h-5 w-5 text-dark-500" />
      </button>
    </div>

    {/* Content */}
    <div className="flex-1 overflow-y-auto px-6 py-4">
      {/* Modal content */}
    </div>

    {/* Footer */}
    <div className="px-6 py-4 border-t border-dark-300 flex justify-end gap-2">
      <button className="px-3 py-2 bg-white text-dark-600 border border-dark-300 rounded-md text-sm font-medium hover:border-dark-400 transition-colors">
        Cancel
      </button>
      <button className="px-3 py-2 bg-slate-600 text-white shadow-sm rounded-md text-sm font-medium hover:bg-slate-700 transition-colors">
        Save Changes
      </button>
    </div>
  </div>
</div>
```

---

## 4. Layout Patterns

### Page Structure & Headers

**Page Header with Actions (STANDARD PATTERN)**
```jsx
// Page Header with Back Button and Actions
<div className="flex items-center justify-between">
  <div className="flex items-center space-x-4">
    {/* Back Button */}
    <button className="p-2 hover:bg-dark-100 rounded-lg transition-colors">
      <ArrowLeft className="h-5 w-5 text-dark-700 stroke-[1.5]" />
    </button>

    {/* Page Title */}
    <div>
      <h1 className="text-sm font-normal text-dark-700">
        Create Worksite
        <span className="text-xs font-light text-dark-700 ml-3">New Worksite</span>
      </h1>
    </div>
  </div>

  {/* Action Buttons */}
  <div className="flex items-center space-x-2">
    {/* Cancel Button - Secondary */}
    <button className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all bg-white text-dark-600 border border-dark-300 hover:border-dark-400">
      <ArrowLeft className="h-3.5 w-3.5" />
      <span>Cancel</span>
    </button>

    {/* Primary Action - Slate-600 */}
    <button className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all bg-slate-600 text-white shadow-sm hover:bg-slate-700">
      <Save className="h-3.5 w-3.5" />
      <span>Create Worksite</span>
    </button>
  </div>
</div>

// Standard Page Container
<div className="min-h-screen bg-dark-50">
  <div className="w-[97%] max-w-[1536px] mx-auto px-4 py-6">
    {/* Content */}
  </div>
</div>
```

### Grid Layouts

```jsx
// 2-Column Grid (for feature cards)
<div className="grid md:grid-cols-2 gap-4">
  {/* Grid items */}
</div>

// 3-Column Grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Grid items */}
</div>

// 4-Column Grid (metrics, small cards)
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Grid items */}
</div>
```

---

## 5. Icons

### Icon Standards

```jsx
// SIZES (Minimalistic approach)
h-3 w-3      // Tiny - badges, inline indicators
h-3.5 w-3.5  // Standard - buttons and UI elements (DEFAULT)
h-4 w-4      // Medium - emphasis elements
h-5 w-5      // Large - special emphasis
h-6 w-6      // Extra large - gradient icon boxes

// COLORS
text-dark-600  // Standard icon color
text-dark-700  // Active/emphasis
text-white     // On dark backgrounds
text-slate-600 // Action links

// In Gradient Boxes
className="h-12 w-12 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg"
```

**Common Icon Usage:**
```jsx
import { Plus, Edit, Trash, Settings, Search, X, Check, ChevronDown, ArrowRight } from 'lucide-react';

// In buttons
<Plus className="h-3.5 w-3.5" />

// In tabs
<FolderKanban className="h-4 w-4" />

// In gradient boxes
<div className="h-12 w-12 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg flex items-center justify-center">
  <Users className="h-6 w-6 text-white" />
</div>

// Action arrows
<ArrowRight className="h-4 w-4" />
```

---

## 6. Spacing Guidelines

### Padding

```jsx
// CONTAINERS
p-6     // Large containers, cards (24px)
p-5     // Feature cards
p-4     // Standard containers, tab containers
p-3     // Compact containers (12px)
p-2     // Small padding (8px)
p-1.5   // Buttons, inputs (6px)

// BUTTONS & TABS - MINIMALISTIC
px-3 py-2    // Standard buttons & tabs (DEFAULT)
px-2 py-1.5  // Small buttons (compact spaces)
px-2 py-1    // Tiny buttons (rare use)
```

### Margins & Gaps

```jsx
// GAPS (Flexbox/Grid)
gap-2    // Tabs, button groups (8px)
gap-3    // Form fields (12px)
gap-4    // Cards, grid items (16px)

// MARGINS
mb-1    // Small spacing (4px)
mb-3    // Medium spacing (12px)
mb-4    // Section spacing (16px)
mb-6    // Large spacing (24px)
```

---

## 7. Borders & Shadows

### Borders

```jsx
// STANDARD BORDERS
border-dark-300       // Default border
border-dark-400       // Hover state
border-slate-500      // Accent hover (for cards)

// BORDER RADIUS
rounded-lg            // Standard (8px) - buttons, cards, inputs
rounded-xl            // Large (12px) - modals, containers
rounded-full          // Pills - badges, counts

// USAGE
className="border border-dark-300 hover:border-slate-500"
```

### Shadows

```jsx
// ELEVATION HIERARCHY
shadow-sm         // Subtle elevation - cards
shadow-md         // Active tabs, hover state
shadow-lg         // Dropdowns
shadow-xl         // Modals
shadow-2xl        // Maximum elevation

// COMMON PATTERNS
className="shadow-md"                                   // Active tabs
className="hover:shadow-md transition-all"             // Card hover
className="shadow-sm hover:shadow-md transition-all"   // Interactive cards
```

---

## 8. Interactive States

### Hover Effects

```jsx
// Cards
hover:border-slate-500     // Accent border on hover
hover:shadow-md           // Elevation on hover
group-hover:scale-110     // Icon scale on parent hover
group-hover:text-slate-700 // Text color change
group-hover:gap-3        // Gap animation

// Buttons
hover:bg-dark-800        // Dark button hover
hover:bg-dark-200        // Light button hover
hover:border-dark-400    // Border enhancement

// Links
text-slate-600 group-hover:gap-3  // Animated arrow links
```

### Focus States

```jsx
// Inputs (Slate focus)
focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500

// Buttons
focus:outline-none focus:ring-2 focus:ring-slate-500/50

// Remove focus
focus:outline-none focus:ring-0
```

### Transition Patterns

```jsx
// Standard transitions
transition-colors              // Color changes
transition-all                 // Multiple properties
transition-all group          // Group hover effects
transition-transform          // Scale animations

// Common combinations
className="transition-all group"                         // Cards
className="transition-all duration-200"                  // Smooth changes
className="group-hover:scale-110 transition-transform"   // Icon animations
```

---

## 9. Special Components

### Gradient Icon Boxes

```jsx
// Feature card icon
<div className="h-12 w-12 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
  <FolderKanban className="h-6 w-6 text-white" />
</div>
```

### Action Links with Arrow

```jsx
<div className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 group-hover:gap-3 transition-all">
  Get Started
  <ArrowRight className="h-4 w-4" />
</div>
```

### Tab Container

```jsx
<div className="bg-dark-100 rounded-xl p-4 border border-dark-300">
  <div className="flex flex-wrap gap-2">
    {/* Tabs go here */}
  </div>
</div>
```

---

## Quick Reference Card

### Must-Use Patterns

| Element | Classes | Notes |
|---------|---------|-------|
| **PRIMARY BUTTON** | `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all bg-slate-600 text-white shadow-sm hover:bg-slate-700` | MINIMALISTIC |
| **Secondary Button** | `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all bg-white text-dark-600 border border-dark-300 hover:border-dark-400` | Clean & light |
| **Active Tab** | `flex items-center gap-2 px-3 py-2 bg-slate-600 text-white shadow-sm rounded-md text-sm font-medium` | Slate accent |
| **Inactive Tab** | `flex items-center gap-2 px-3 py-2 bg-white text-dark-600 border border-dark-300 hover:border-dark-400 rounded-md text-sm font-medium` | White bg |
| **Feature Card** | `bg-dark-100 rounded-lg p-5 border border-dark-300 hover:border-slate-500 hover:shadow-md` | Slate hover border |
| **Gradient Icon** | `h-12 w-12 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg` | Slate gradient |
| **Input Focus** | `focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500` | Slate focus |
| **Action Link** | `text-slate-600 group-hover:gap-3` | Slate text color |

### Color Quick Reference

| Use Case | Color | Class |
|----------|-------|-------|
| Canvas Background | #FAFAFA | `bg-dark-50` |
| Card/Panel | #FFFFFF | `bg-dark-100` |
| Primary Text | #37352F | `text-dark-700` |
| Secondary Text | #787774 | `text-dark-600` |
| Border | #E9E9E7 | `border-dark-300` |
| **PRIMARY BUTTON** | **Slate-600** | **`bg-slate-600`** |
| Active Tab | Slate-600 | `bg-slate-600` |
| Hover State | Slate-700 | `hover:bg-slate-700` |
| Focus Ring | Slate | `ring-slate-500` |
| Action Links | Slate | `text-slate-600` |

---

## Implementation Guidelines

### Critical Rules - MINIMALISTIC DESIGN

1. **ALL PRIMARY BUTTONS USE `bg-slate-600`** - Including Save, Submit, Create
2. **NO GREEN BUTTONS** - Use slate-600 for all save/submit actions
3. **BUTTON PADDING: `px-3 py-2`** - Minimalistic, not bulky
4. **DATA TABLE FONTS: `text-sm`** - Headers and cells, NO tiny text
5. **NO BLUE OR PURPLE** - Use slate for all accent colors
6. **Active tabs use `bg-slate-600`** - With white bg for inactive
7. **Subtle shadows: `shadow-sm`** - Not shadow-md (too heavy)
8. **Icon size in buttons: `h-3.5 w-3.5`** - Smaller, cleaner
9. **Border radius: `rounded-md`** - Not rounded-lg (too rounded)

### Common Mistakes to Avoid

❌ Using green buttons for save/submit - use `bg-slate-600`
❌ Using `text-[10px]` anywhere - minimum is `text-xs`
❌ Using uppercase table headers - use normal case, `font-normal`
❌ Bulky button padding - use `px-3 py-2`, not `px-4 py-2.5`
❌ Using blue/purple for UI - use slate accent only
❌ Heavy shadows (`shadow-md/lg`) - use `shadow-sm` for subtlety
❌ Large border radius (`rounded-lg`) - use `rounded-md`
❌ Large icons in buttons - use `h-3.5 w-3.5` standard

### Consistency Checklist - MINIMALISTIC

- [ ] **ALL primary buttons use `bg-slate-600 text-white shadow-sm`**
- [ ] **NO GREEN BUTTONS - Save/Submit use slate-600**
- [ ] **ALL buttons use `px-3 py-2` padding (minimalistic)**
- [ ] **ALL button icons are `h-3.5 w-3.5`**
- [ ] **Table headers: `text-sm font-normal text-dark-600`**
- [ ] **Table cells: `text-sm text-dark-700`**
- [ ] **NO tiny fonts (`text-[10px]`) anywhere**
- [ ] Active tabs use `bg-slate-600` with `shadow-sm`
- [ ] Inactive tabs/secondary buttons use `bg-white border`
- [ ] Border radius: `rounded-md` (not rounded-lg)
- [ ] Shadows: `shadow-sm` (not shadow-md/lg)

---

## 10. Entity Detail Page Header (v13.0.0)

### Modern Two-Line Header Pattern

Entity detail pages use a next-generation header design inspired by Linear, Notion, and Figma. The design emphasizes:

- **Visual Hierarchy**: Entity name as hero element with larger typography
- **Progressive Disclosure**: Essential info prominent, technical details subtle
- **Pill/Chip Styling**: Secondary metadata uses rounded pill design
- **Copy-to-Clipboard**: Hover reveals copy button with subtle animation

### Header Components

| Component | Purpose | Location |
|-----------|---------|----------|
| `EntityHeaderTitle` | Hero title with inline editing | Line 1 |
| `EntityMetadataChipRow` | Container for metadata chips | Line 2 |
| `EntityMetadataChip` | Pill-styled metadata display | Line 2 |
| `EntityHeaderContainer` | Two-line layout wrapper | Container |

### Header Structure

```jsx
// Modern two-line entity detail header (v13.0.0)
<div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 pt-4 pb-3 flex-shrink-0">
  <div className="w-[97%] max-w-[1536px] mx-auto">
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start space-x-4 flex-1 min-w-0">
        {/* Exit button - vertically aligned with title */}
        <div className="pt-1">
          <ExitButton entityCode={entityCode} isDetailPage={true} />
        </div>

        {/* Two-line header layout */}
        <EntityHeaderContainer className="flex-1 min-w-0">
          {/* Line 1: Hero Title */}
          <EntityHeaderTitle
            value={data.name || 'Untitled'}
            inlineEditable={true}
            onInlineSave={handleInlineSave}
          />

          {/* Line 2: Metadata Chips */}
          <EntityMetadataChipRow>
            <EntityMetadataChip label="code" value="PRJ-001" monospace variant="default" />
            <EntityMetadataChip label="id" value="uuid..." monospace variant="muted" />
            <EntityMetadataChip label="created" value="2 hours ago" variant="muted" />
            <EntityMetadataChip label="updated" value="5 min ago" variant="muted" />
          </EntityMetadataChipRow>
        </EntityHeaderContainer>
      </div>

      {/* Action buttons */}
      <div className="flex items-center space-x-2">
        {/* Edit, Share, Link buttons */}
      </div>
    </div>
  </div>
</div>
```

### EntityHeaderTitle Component

```jsx
// Hero title - large, bold typography with inline editing
<h1 className="text-2xl font-semibold text-slate-800 truncate leading-tight
               cursor-text hover:text-slate-600 transition-colors duration-150">
  Flooring Installation - Markham Industrial #2
</h1>

// Edit mode - underline input style
<input className="text-2xl font-semibold text-slate-800 bg-slate-50
                 border-0 border-b-2 border-slate-300
                 focus:border-slate-600 focus:ring-0
                 px-0 py-1 w-full transition-colors duration-200 outline-none" />
```

### EntityMetadataChip Component

```jsx
// Chip variants
const variantStyles = {
  default: 'bg-slate-100 text-slate-600 border-slate-200',  // Code, prominent
  muted: 'bg-slate-50 text-slate-500 border-slate-100',     // ID, timestamps
  accent: 'bg-slate-600 text-white border-slate-600',       // Version badge
};

// Chip structure
<div className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                text-xs font-medium border transition-all duration-150 hover:shadow-sm
                ${variantStyles[variant]}`}>
  {showLabel && <span className="opacity-60">{label}:</span>}
  <span className={monospace ? 'font-mono' : ''}>{value}</span>
  {onCopy && (
    <button className="opacity-0 group-hover:opacity-100 p-0.5 -mr-1
                      hover:bg-slate-200/50 rounded transition-all duration-200">
      <Copy className="h-3 w-3 opacity-60 hover:opacity-100" />
    </button>
  )}
</div>
```

### Chip Variant Usage

| Field Type | Variant | Monospace | Show Label |
|------------|---------|-----------|------------|
| Code | `default` | Yes | Yes |
| ID | `muted` | Yes | Yes |
| Timestamps | `muted` | No | Yes |
| Version | `accent` | No | No |

### Header Background

```jsx
// Clean white background with subtle border (replaces gray-100)
className="bg-white border-b border-slate-200"

// Old style (deprecated)
// className="bg-gray-100 shadow-sm border-b border-gray-200"
```

### Key Styling Decisions

1. **White background** (`bg-white`) instead of gray for cleaner look
2. **Slate-200 border** (`border-slate-200`) for subtle separation
3. **2xl title** (`text-2xl font-semibold`) for hero prominence
4. **Rounded-full chips** (`rounded-full`) for modern pill style
5. **Subtle opacity** (`opacity-60`) for labels and copy icons
6. **Transition animations** (`transition-all duration-150`) for polish

---

## 11. Form Layout Patterns - MINIMALISTIC DESIGN

### 10.1 Form Submission Editor Layout

**Header Section (Metadata + Actions)**
```jsx
// Form edit header with title and action buttons
<div className="bg-dark-100 border border-dark-300 rounded-lg p-5 shadow-sm
               flex flex-col gap-4 md:flex-row md:items-center md:justify-between
               transition-all hover:shadow-md">
  {/* Title Section */}
  <div className="space-y-1">
    <h2 className="text-base font-medium text-dark-700">
      Edit Form Submission
    </h2>
    <p className="text-xs text-dark-600 tracking-tight">
      {form?.name || 'Form'}
      <span className="text-dark-500 mx-2">·</span>
      <span className="font-mono text-dark-500">
        #{submissionId?.substring(0, 8)}…
      </span>
    </p>
  </div>

  {/* Action Buttons */}
  <div className="flex items-center gap-2">
    {/* Loading Indicator */}
    {isRefreshing && (
      <span className="inline-flex items-center gap-1.5 text-xs text-dark-600
                     px-3 py-2 rounded-md bg-dark-50">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        <span>Refreshing…</span>
      </span>
    )}

    {/* Secondary Buttons */}
    <button className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium
                     transition-all bg-white text-dark-600 border border-dark-300
                     hover:border-dark-400 hover:shadow-sm">
      <RefreshCw className="h-3.5 w-3.5" />
      <span>Refresh</span>
    </button>
  </div>
</div>
```

### 10.2 Metadata Grid (Form Details)

**Enhanced metadata display with icon containers**
```jsx
<div className="bg-dark-100 border border-dark-300 rounded-lg p-5 shadow-sm">
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
    {/* Metadata Item with Icon Container */}
    <div className="flex items-start gap-3 group">
      {/* Icon Container - Rounded with hover effect */}
      <div className="p-2 rounded-lg bg-dark-50 group-hover:bg-slate-50
                    transition-colors flex-shrink-0">
        <Hash className="h-4 w-4 text-dark-600 group-hover:text-slate-600
                       transition-colors" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Label - Uppercase with tracking */}
        <p className="text-[10px] font-medium uppercase tracking-wider
                     text-dark-500 mb-1">
          Form ID
        </p>
        {/* Value - Monospace for IDs/codes */}
        <p className="text-sm font-mono text-dark-700 break-all leading-tight">
          {formId.substring(0, 8)}…
        </p>
      </div>
    </div>

    {/* Status Badge Example */}
    <div className="flex items-start gap-3 group">
      <div className="p-2 rounded-lg bg-dark-50 group-hover:bg-green-50
                    transition-colors flex-shrink-0">
        <CheckCircle className="h-4 w-4 text-dark-600 group-hover:text-green-600
                              transition-colors" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider
                     text-dark-500 mb-1">
          Status
        </p>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full
                       text-xs font-medium bg-green-100 text-green-800 capitalize">
          {status}
        </span>
      </div>
    </div>
  </div>
</div>
```

### 10.3 Entity Form Container (Field Layout)

**Two-column field layout with labels and values**
```jsx
<div className="bg-dark-100 rounded-xl shadow-sm overflow-hidden border border-dark-300
               transition-all hover:shadow-md">
  <div className="p-6">
    <div className="space-y-0">
      {fields.map((field, index) => (
        <div key={field.key}>
          {/* Field Separator (not for first item) */}
          {index > 0 && (
            <div className="h-px my-3 bg-gradient-to-r from-transparent via-dark-300 to-transparent" />
          )}

          {/* Field Row */}
          <div className="group transition-all duration-200 ease-out py-1">
            <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4 items-start">
              {/* Label Column */}
              <label className="text-xs font-medium text-dark-600 pt-2.5 flex items-center gap-2 uppercase tracking-wider">
                <span className="opacity-70 group-hover:opacity-100 transition-opacity duration-200">
                  {field.label}
                </span>
                {field.required && (
                  <span className="text-red-500 text-xs font-bold">*</span>
                )}
              </label>

              {/* Value Column */}
              <div className={`
                relative break-words rounded-lg px-3 py-2.5 -ml-3
                transition-all duration-200 ease-out
                ${isEditing
                  ? 'bg-dark-50 hover:bg-dark-200 shadow-sm focus-within:bg-dark-100 focus-within:shadow-md focus-within:ring-2 focus-within:ring-slate-500/30 focus-within:border-slate-500'
                  : 'hover:bg-dark-50 group-hover:bg-dark-200'
                }
                text-sm text-dark-700 leading-relaxed
              `}>
                {/* Field content */}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
</div>
```

### 10.4 Form Field Patterns

**Common field element styles**
```jsx
// Text Input (consistent with form pattern)
<input
  type="text"
  className="w-full px-3 py-2 text-sm border border-dark-300 rounded-lg bg-dark-100
             text-dark-700 placeholder-dark-400
             focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500
             transition-colors"
  placeholder="Enter value..."
/>

// Select Dropdown
<select className="w-full px-3 py-2 text-sm border border-dark-300 rounded-lg bg-dark-100
                   text-dark-700 focus:outline-none focus:ring-2 focus:ring-slate-500/30
                   focus:border-slate-500 cursor-pointer transition-colors">
  <option value="">Select option...</option>
</select>

// Textarea
<textarea
  className="w-full px-3 py-2 text-sm border border-dark-300 rounded-lg bg-dark-100
             text-dark-700 placeholder-dark-400 resize-none
             focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500
             transition-colors"
  rows={4}
  placeholder="Enter description..."
/>
```

### 10.5 Responsive Form Breakpoints

| Breakpoint | Layout | Padding | Gap |
|------------|--------|---------|-----|
| `< 640px` (mobile) | 1 column, stacked labels | `p-4` | `gap-4` |
| `640px - 768px` (sm) | 2 columns (160px + 1fr) | `p-5` | `gap-5` |
| `768px - 1024px` (md) | 2 columns (160px + 1fr) | `p-5` | `gap-6` |
| `> 1024px` (lg) | 2 columns (160px + 1fr) | `p-5` | `gap-6` |

```jsx
// Responsive field layout
<div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4 items-start">
  {/* Adapts to single column on mobile */}
</div>

// Responsive metadata grid
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
  {/* 1 column mobile, 2 columns tablet, 4 columns desktop */}
</div>
```

---

**This document is the single source of truth for all UI/UX decisions. Follow these patterns exactly.**

---

## 11. CSS Architecture (v13.0 - Zero !important)

### index.css Structure

```css
/* LAYER ORDER - Proper specificity without !important */
@layer base {
  /* CSS custom properties */
  :root {
    --color-canvas: #FAFAFA;
    --color-surface: #FFFFFF;
    --color-accent: #475569;
    /* ... more tokens */
  }
}

@layer components {
  /* Reusable component classes */
  .btn-primary { /* ... */ }
  .card { /* ... */ }
}

@layer utilities {
  /* Custom utilities - override with natural specificity */
  .scrollbar-thin { /* ... */ }
}
```

### Zero !important Policy

- **NEVER** use `!important` in new code
- Use proper CSS specificity hierarchy
- Use Tailwind's `@layer` directive for organization
- Prefer component-level styles over global overrides

### Focus-Visible Pattern

```css
/* Keyboard-only focus rings */
.focus-visible:outline-none
.focus-visible:ring-2
.focus-visible:ring-slate-500
.focus-visible:ring-offset-2

/* Removes ugly focus outlines on mouse click */
```

---

## 12. Section Visual Hierarchy (v13.1.0)

### Layered Depth System

Modern SaaS applications use subtle background variations and shadows to create visual depth and section separation. This follows the "layered surfaces" pattern used by Linear, Notion, and Figma.

**IMPORTANT:** All styling uses the unified `dark-*` palette from tailwind.config.js for consistency with Layout and all components. The `dark-*` palette provides warm neutral grays that complement the overall design.

### Header Section Styling

```jsx
// Entity detail page header with subtle gradient (dark-* palette)
<div className="sticky top-0 z-20 bg-gradient-to-b from-white to-dark-subtle/80 border-b border-dark-200 shadow-sm">
  {/* Header content */}
</div>
```

**Key Properties:**
- `bg-gradient-to-b from-white to-dark-subtle/80` - Subtle downward gradient adds depth
- `border-dark-200` - Consistent border from design system
- `shadow-sm` - Minimal shadow for elevation without harshness

### Content Container Styling

```jsx
// Child entity table container with elevation (dark-* palette)
<div className="bg-white rounded-xl shadow-sm border border-dark-200 overflow-hidden">
  {/* Table content */}
</div>
```

**Key Properties:**
- `bg-white` - Clean white surface for data clarity
- `border-dark-200` - Subtle border from design system
- `rounded-xl` - Modern rounded corners
- `shadow-sm` - Soft elevation

### Data Table Styling

```jsx
// Table container with gradient toolbar (dark-* palette)
<div className="bg-white rounded-xl shadow-sm border border-dark-200">
  {/* Toolbar with gradient */}
  <div className="px-6 py-4 bg-gradient-to-b from-dark-subtle to-white border-b border-dark-200">
    {/* Filter controls */}
  </div>

  {/* Table with gradient header */}
  <thead className="bg-gradient-to-b from-dark-100 to-dark-subtle shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
    {/* Column headers */}
  </thead>

  {/* Pagination footer with inverse gradient */}
  <div className="border-t border-dark-200 bg-gradient-to-t from-dark-subtle to-white">
    {/* Pagination controls */}
  </div>
</div>
```

### Visual Hierarchy Principles

| Layer | Background | Purpose |
|-------|------------|---------|
| Canvas | `bg-dark-100` (Layout) | Base layer, warm neutral |
| Primary Surface | `bg-white` | Cards, tables, content areas |
| Header/Footer | `from-dark-subtle to-white` | Toolbar gradients for depth |
| Table Header | `from-dark-100 to-dark-subtle` | Column header prominence |
| Borders | `border-dark-200` | Subtle separation |
| Shadows | `shadow-sm` | Minimal elevation |

### dark-* Palette Reference (from tailwind.config.js)

| Token | Value | Usage |
|-------|-------|-------|
| `dark-subtle` | `#F7F7F7` | Subtle backgrounds |
| `dark-100` | `#F5F5F5` | Light backgrounds, Layout bg |
| `dark-200` | `#E5E5E5` | Default borders |
| `dark-300` | `#D4D4D4` | Medium borders, inputs |
| `dark-400` | `#A3A3A3` | Muted text |
| `dark-hover` | `#F3F3F3` | Hover states |

### Gradient Direction Patterns

| Element | Gradient Direction | Reason |
|---------|-------------------|--------|
| Page Header | `to-b` (top to bottom) | Light at top, fades down |
| Toolbar | `to-b` (top to bottom) | Matches header pattern |
| Table Header | `to-b` (top to bottom) | Heavier at top for emphasis |
| Pagination | `to-t` (bottom to top) | Inverse gradient for footer |

### Loading State Styling

```jsx
// Consistent loading state with gradient (dark-* palette)
<div className="flex items-center justify-center bg-gradient-to-b from-dark-subtle/50 to-white">
  <EllipsisBounce size="lg" text="Processing" />
</div>
```

---

---

## 13. Palette Unification Guide (v14.3.0)

### The Problem: Mixed Palettes

Current codebase mixes `slate-*` with `dark-*` classes, causing:
- Visual inconsistency between components
- Maintenance burden (two mental models)
- Subtle color mismatches

### The Solution: Unified `dark-*` Palette

**Rule: Use ONLY `dark-*` tokens from tailwind.config.js**

### Migration Mapping

| OLD (slate-*) | NEW (dark-*) | Usage |
|---------------|--------------|-------|
| `bg-slate-50` | `bg-dark-canvas` | Page backgrounds |
| `bg-slate-100` | `bg-dark-subtle` | Subtle backgrounds |
| `bg-slate-100/50` | `bg-dark-50` | Very light backgrounds |
| `hover:bg-slate-50` | `hover:bg-dark-hover` | Hover states |
| `hover:bg-slate-50/80` | `hover:bg-dark-hover` | Hover states |
| `hover:bg-slate-50/50` | `hover:bg-dark-hover/50` | Subtle hovers |
| `border-slate-100` | `border-dark-border-subtle` | Subtle borders |
| `border-slate-200` | `border-dark-border-default` | Default borders |
| `border-slate-300` | `border-dark-border-medium` | Medium borders |
| `text-slate-400` | `text-dark-text-placeholder` | Placeholder text |
| `text-slate-500` | `text-dark-text-tertiary` | Tertiary text |
| `text-slate-600` | `text-dark-text-secondary` | Secondary text |
| `text-slate-700` | `text-dark-text-primary` | Primary text |
| `text-slate-800` | `text-dark-800` | Headings |

### Accent Colors (Exception)

**Accent colors REMAIN `slate-*`** for visual pop on buttons/focus:

```jsx
// KEEP these slate-* for accent
bg-slate-600        // Primary button background
hover:bg-slate-700  // Primary button hover
focus:ring-slate-500/20  // Focus ring
text-slate-600      // Link text
```

### Quick Reference: Where to Use What

| Component | Background | Borders | Text | Hover |
|-----------|------------|---------|------|-------|
| **Layout** | `bg-dark-canvas` | `border-dark-200` | `text-dark-*` | `hover:bg-dark-hover` |
| **Table Container** | `bg-dark-surface` | `border-dark-border-subtle` | - | - |
| **Table Header** | `bg-dark-subtle` | `border-dark-border-default` | `text-dark-text-secondary` | - |
| **Table Row** | `bg-dark-surface` | `border-dark-border-subtle` | `text-dark-800` | `hover:bg-dark-hover` |
| **Input** | `bg-white` | `border-dark-300` | `text-dark-800` | `focus:border-dark-400` |
| **Primary Button** | `bg-slate-600` | - | `text-white` | `hover:bg-slate-700` |
| **Secondary Button** | `bg-white` | `border-dark-300` | `text-dark-700` | `hover:bg-dark-hover` |

### Files to Update

1. **Layout.tsx**
   - Line 100: `bg-slate-100/50` → `bg-dark-canvas`
   - Line 299: `bg-dark-50` → `bg-dark-subtle` (content area)

2. **EntityListOfInstancesTable.tsx**
   - Container: `border-slate-100` → `border-dark-border-subtle`
   - Header: `bg-slate-50/50` → `bg-dark-subtle`
   - Rows: `hover:bg-slate-50/80` → `hover:bg-dark-hover`

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| **v14.4.2** | **2025-12-11** | **Table Hover Consistency Fix** - Removed inline `backgroundColor` from virtualized rows in EntityListOfInstancesTable. Now uses Tailwind `bg-dark-surface` class for both virtualized and regular rows, ensuring consistent `hover:bg-dark-hover` behavior across all tables |
| **v14.4.1** | **2025-12-11** | **Design System Centralization** - All button/input/surface tokens now in designSystem.ts with warm sepia palette. CreateButton uses cx(button.base, button.variant.primary, button.size[size]). Refined button sizes: h-7 for sm (was h-8), less bulky appearance |
| **v14.4** | **2025-12-10** | **Warm Sepia Palette** - Replaced cool grays with warm stone tones for eye comfort. No pure black (#292524 soft black), no pure white (#FEFDFB warm white), cream backgrounds (#FAF9F7). Updated Layout.tsx and EntityListOfInstancesTable.tsx |
| v14.3 | 2025-12-10 | Palette Unification Guide - Migration mapping from slate-* to dark-*, clear rules for accent vs background usage, file-specific update checklist |
| **v14.2** | **2025-12-10** | **Data Table Density System** - 3-tier density (compact/regular/relaxed) with 32px/40px/48px row heights, density-based input padding, compact inline edits, always-visible action icons, `BadgeDropdownSelect` and `EntityInstanceNameSelect` compact styling |
| v13.1 | 2025-12-07 | **Section visual hierarchy** - unified dark-* palette for consistency with Layout, gradient backgrounds for depth, improved header/table/footer separation, eliminates slate-* color mixing |
| v13.0 | 2025-12-07 | Production-grade design system, unified slate palette, zero !important, focus-visible accessibility, Button/IconButton/ButtonGroup components, typography scale with line-heights, Entity Detail Header v13.0.0 (two-line layout, hero title, metadata chips) |
| v12.0 | 2025-11-13 | Minimalistic design system |
| v11.0 | 2025-11-10 | YAML pattern detection |
| v10.0 | 2025-11-07 | Dark theme support |

---

**Maintained by:** PMO Platform Team
**Version:** 14.4.2 - TABLE HOVER CONSISTENCY FIX
**Last Updated:** 2025-12-11