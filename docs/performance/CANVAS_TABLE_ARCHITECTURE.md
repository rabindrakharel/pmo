# Canvas/WebGL Table Architecture

> Comprehensive guide for high-performance table rendering using Canvas/WebGL

## Table of Contents

1. [Performance Comparison](#1-performance-comparison)
2. [Architecture Overview](#2-architecture-overview)
3. [Data Flow Architecture](#3-data-flow-architecture)
4. [Component Architecture](#4-component-architecture)
5. [Event Handling System](#5-event-handling-system)
6. [Feature Migration Matrix](#6-feature-migration-matrix)
7. [Implementation Plan](#7-implementation-plan)
8. [Code Examples](#8-code-examples)

---

## 1. Performance Comparison

### Why DOM Tables Are Slow

```
DOM Table: 1000 rows × 23 columns
═══════════════════════════════════════════════════════════════

Browser must:
┌─────────────────────────────────────────────────────────────┐
│ 1. CREATE 23,000+ DOM nodes                                 │
│    └── Each node: memory allocation, prototype chain        │
│                                                             │
│ 2. BUILD render tree                                        │
│    └── CSS cascade calculation for each node                │
│                                                             │
│ 3. LAYOUT (reflow)                                          │
│    └── Calculate position/size for 23,000 elements          │
│                                                             │
│ 4. PAINT                                                    │
│    └── Rasterize each element to pixels                     │
│                                                             │
│ 5. COMPOSITE                                                │
│    └── Combine layers for final display                     │
└─────────────────────────────────────────────────────────────┘

Result: 2-5 seconds render time
```

### Performance Metrics Comparison

| Metric | DOM (1000 rows) | Virtualized DOM | Canvas | WebGL |
|--------|-----------------|-----------------|--------|-------|
| DOM Nodes | 23,000+ | ~500 | 1 | 1 |
| Initial Render | 2-5 sec | 50-100ms | 10-30ms | 5-15ms |
| Scroll FPS | 15-30 | 55-60 | 60 | 60 |
| Memory Usage | High | Medium | Low | Low |
| 100K Rows | Unusable | Slow | Smooth | Smooth |
| 1M Rows | Crash | Unusable | Usable | Smooth |

### When to Use Each Approach

```
                         DATA SIZE
           ┌─────────────────────────────────────────┐
           │                                         │
    < 1K   │  ████████████ DOM Table                 │  Simple, full features
           │                                         │
   1K-10K  │  ████████████████████ Virtualization   │  Best balance
           │                                         │
  10K-100K │  ██████████████████████████ Canvas     │  High performance
           │                                         │
   > 100K  │  ████████████████████████████ WebGL    │  Maximum performance
           │                                         │
           └─────────────────────────────────────────┘
```

---

## 2. Architecture Overview

### Current DOM Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT: DOM-BASED TABLE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  React Component Tree                                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ <EntityDataTable>                                          │ │
│  │   ├── <table>                                              │ │
│  │   │     ├── <thead>                                        │ │
│  │   │     │     └── <tr> × 1 (header row)                    │ │
│  │   │     │           └── <th> × 23 (columns)                │ │
│  │   │     └── <tbody>                                        │ │
│  │   │           └── <tr> × 1000 (data rows)      ← SLOW      │ │
│  │   │                 └── <td> × 23 (cells)      ← 23K nodes │ │
│  │   │                       └── content + styles             │ │
│  │   └── <PaginationControls>                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Event Handling: Native DOM events (onClick, onHover, etc.)     │
│  Styling: CSS classes, inline styles                            │
│  Editing: Native <input>, <select> elements                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Proposed Canvas Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   PROPOSED: CANVAS-BASED TABLE                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    React Shell Component                    │ │
│  │  <CanvasDataTable>                                         │ │
│  │    │                                                       │ │
│  │    ├── <HeaderRow>  (DOM - for accessibility)              │ │
│  │    │     └── <th> × 23 (sortable, filterable)              │ │
│  │    │                                                       │ │
│  │    ├── <canvas>  (Single DOM element)         ← FAST       │ │
│  │    │     └── CanvasRenderer (paints all rows)  ← 1 node    │ │
│  │    │                                                       │ │
│  │    ├── <EditOverlay>  (DOM - positioned absolutely)        │ │
│  │    │     └── <input> / <select> when editing               │ │
│  │    │                                                       │ │
│  │    ├── <TooltipLayer>  (DOM - for tooltips)                │ │
│  │    │                                                       │ │
│  │    └── <ScrollContainer>  (handles virtual scroll)         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Event Handling: Manual hit detection + coordinate mapping      │
│  Styling: Programmatic painting (fillRect, fillText)            │
│  Editing: DOM overlay positioned over canvas                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Flow Architecture

### Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         DATA FLOW                                │
└─────────────────────────────────────────────────────────────────┘

     ┌──────────────┐
     │   Backend    │
     │   (API)      │
     └──────┬───────┘
            │ HTTP Response: 1000 rows
            ▼
┌───────────────────────────────────────────────────────────────┐
│                    JAVASCRIPT MEMORY                           │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  React Query Cache                                      │  │
│  │  ┌───────────────────────────────────────────────────┐  │  │
│  │  │  Raw Data: Row[]  (1000 items)                    │  │  │
│  │  │  Metadata: FieldMetadata[]                        │  │  │
│  │  │  Datalabels: Map<string, DatalabelOption[]>       │  │  │
│  │  └───────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                              │                                 │
│                              ▼                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Format at Read (select option)                         │  │
│  │  ┌───────────────────────────────────────────────────┐  │  │
│  │  │  FormattedRow[] = {                               │  │  │
│  │  │    raw: originalData,                             │  │  │
│  │  │    display: { name: "Project A", budget: "$5K" }, │  │  │
│  │  │    styles: { status: "bg-green-500" }             │  │  │
│  │  │  }                                                │  │  │
│  │  └───────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                              │                                 │
│                              ▼                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Client-Side Operations (instant, no API call)          │  │
│  │  ├── Filter: data.filter(row => ...)                    │  │
│  │  ├── Sort: data.sort((a, b) => ...)                     │  │
│  │  ├── Search: data.filter(row => row.name.includes(...)) │  │
│  │  └── Group: groupBy(data, 'status')                     │  │
│  └─────────────────────────────────────────────────────────┘  │
│                              │                                 │
│                              ▼                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Processed Data Store                                   │  │
│  │  ┌───────────────────────────────────────────────────┐  │  │
│  │  │  filteredData: Row[]     (0-1000 items)           │  │  │
│  │  │  sortedData: Row[]       (ordered)                │  │  │
│  │  │  totalCount: number      (for pagination UI)      │  │  │
│  │  └───────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────────┐
│                    CANVAS RENDERER                             │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Viewport Calculation                                   │  │
│  │  ┌───────────────────────────────────────────────────┐  │  │
│  │  │  scrollTop: 2400px                                │  │  │
│  │  │  viewportHeight: 600px                            │  │  │
│  │  │  rowHeight: 40px                                  │  │  │
│  │  │  startRow: 60  (2400 / 40)                        │  │  │
│  │  │  endRow: 75    (60 + 600/40)                      │  │  │
│  │  │  visibleRows: 15 rows                             │  │  │
│  │  └───────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                              │                                 │
│                              ▼                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Paint Commands (executed on canvas context)            │  │
│  │  ┌───────────────────────────────────────────────────┐  │  │
│  │  │  for (row of visibleRows) {                       │  │  │
│  │  │    ctx.fillStyle = row.isHovered ? '#f0f0f0' : '#fff'│ │
│  │  │    ctx.fillRect(0, y, width, rowHeight)           │  │  │
│  │  │    ctx.strokeRect(0, y, width, rowHeight)         │  │  │
│  │  │    for (col of columns) {                         │  │  │
│  │  │      ctx.fillText(row.display[col.key], x, y+24)  │  │  │
│  │  │    }                                              │  │  │
│  │  │  }                                                │  │  │
│  │  └───────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────────┐
│                         DISPLAY                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  <canvas width="1200" height="600">                     │  │
│  │  ┌───────────────────────────────────────────────────┐  │  │
│  │  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │  │  │
│  │  │  ░ Row 60: Project A  │ Active  │ $5,000 │ 2024 ░  │  │  │
│  │  │  ░ Row 61: Project B  │ Draft   │ $3,000 │ 2024 ░  │  │  │
│  │  │  ░ Row 62: Project C  │ Active  │ $8,000 │ 2024 ░  │  │  │
│  │  │  ░ ... (15 visible rows painted as pixels) ...   ░  │  │  │
│  │  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │  │  │
│  │  └───────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

---

## 4. Component Architecture

### Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPONENT ARCHITECTURE                        │
└─────────────────────────────────────────────────────────────────┘

CanvasDataTable (Main Container)
├── CanvasTableProvider (Context)
│   ├── State: data, columns, scroll, selection, editingCell
│   └── Actions: setSort, setFilter, startEdit, saveEdit
│
├── TableHeader (DOM - for accessibility & interactivity)
│   ├── HeaderCell (×23)
│   │   ├── SortIndicator
│   │   ├── FilterDropdown
│   │   └── ResizeHandle
│   └── SelectAllCheckbox
│
├── CanvasBody (Canvas rendering engine)
│   ├── CanvasRenderer
│   │   ├── RowPainter
│   │   ├── CellPainter
│   │   ├── SelectionPainter
│   │   └── HoverPainter
│   ├── ScrollManager
│   │   ├── VirtualScrollbar
│   │   └── ScrollPositionTracker
│   └── HitDetector
│       ├── CellBoundaryMap
│       └── EventCoordinateMapper
│
├── OverlayLayer (DOM - positioned over canvas)
│   ├── EditOverlay
│   │   ├── TextInput
│   │   ├── SelectDropdown
│   │   ├── DatePicker
│   │   └── MultiSelect
│   ├── TooltipOverlay
│   ├── ContextMenuOverlay
│   └── SelectionOverlay
│
├── TableFooter (DOM)
│   ├── PaginationControls
│   ├── RowCount
│   └── PageSizeSelector
│
└── AccessibilityLayer (Hidden, for screen readers)
    ├── AriaLiveRegion
    └── VirtualAccessibleTable
```

### File Structure

```
apps/web/src/components/shared/canvas-table/
├── CanvasDataTable.tsx           # Main container component
├── CanvasTableProvider.tsx       # Context & state management
├── index.ts                      # Exports
│
├── core/
│   ├── CanvasRenderer.ts         # Main rendering engine
│   ├── RowPainter.ts             # Row painting logic
│   ├── CellPainter.ts            # Cell painting (text, badges, icons)
│   ├── GridPainter.ts            # Grid lines, borders
│   └── SelectionPainter.ts       # Selection highlight
│
├── interaction/
│   ├── HitDetector.ts            # Click/hover detection
│   ├── ScrollManager.ts          # Virtual scrolling
│   ├── KeyboardHandler.ts        # Arrow keys, tab, enter
│   ├── DragHandler.ts            # Column resize, row reorder
│   └── SelectionManager.ts       # Multi-select, range select
│
├── overlays/
│   ├── EditOverlay.tsx           # Inline editing inputs
│   ├── TooltipOverlay.tsx        # Cell tooltips
│   ├── ContextMenu.tsx           # Right-click menu
│   └── DropdownOverlay.tsx       # Filter dropdowns
│
├── header/
│   ├── TableHeader.tsx           # DOM header row
│   ├── HeaderCell.tsx            # Sortable/filterable header
│   └── ColumnResizer.tsx         # Drag to resize
│
├── accessibility/
│   ├── AriaAnnouncer.tsx         # Screen reader announcements
│   └── KeyboardNavigation.ts     # A11y keyboard handling
│
├── hooks/
│   ├── useCanvasTable.ts         # Main hook
│   ├── useVirtualScroll.ts       # Scroll position management
│   ├── useHitDetection.ts        # Click/hover mapping
│   └── useEditOverlay.ts         # Edit mode management
│
├── utils/
│   ├── coordinateUtils.ts        # Pixel ↔ cell mapping
│   ├── paintUtils.ts             # Canvas drawing helpers
│   ├── measureText.ts            # Text width calculation
│   └── colorUtils.ts             # Badge colors, themes
│
└── types/
    ├── canvas-table.types.ts     # TypeScript interfaces
    └── events.types.ts           # Event type definitions
```

---

## 5. Event Handling System

### Event Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     EVENT HANDLING SYSTEM                        │
└─────────────────────────────────────────────────────────────────┘

User Interaction
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│  Native DOM Events (captured on <canvas> element)               │
│  ├── onClick(e: MouseEvent)                                     │
│  ├── onMouseMove(e: MouseEvent)                                 │
│  ├── onMouseDown/Up(e: MouseEvent)                              │
│  ├── onWheel(e: WheelEvent)                                     │
│  ├── onKeyDown(e: KeyboardEvent)                                │
│  └── onContextMenu(e: MouseEvent)                               │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│  Coordinate Transformer                                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Input:  e.offsetX = 450, e.offsetY = 180                 │  │
│  │                                                           │  │
│  │  Calculations:                                            │  │
│  │  ├── absoluteY = offsetY + scrollTop = 180 + 2400 = 2580  │  │
│  │  ├── rowIndex = floor(absoluteY / rowHeight) = 64         │  │
│  │  ├── colIndex = findColumn(offsetX) = 2 ("status")        │  │
│  │  │                                                        │  │
│  │  Output: { row: 64, col: 2, cellKey: "status" }           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│  Event Router                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  switch (eventType) {                                     │  │
│  │    case 'click':                                          │  │
│  │      if (isCheckboxColumn) → toggleSelection(row)         │  │
│  │      else if (isActionColumn) → handleAction(row, action) │  │
│  │      else → navigateToDetail(row)                         │  │
│  │                                                           │  │
│  │    case 'dblclick':                                       │  │
│  │      → startInlineEdit(row, col)                          │  │
│  │                                                           │  │
│  │    case 'mousemove':                                      │  │
│  │      → updateHoverState(row, col)                         │  │
│  │      → showTooltip(row, col)                              │  │
│  │                                                           │  │
│  │    case 'contextmenu':                                    │  │
│  │      → showContextMenu(row, col, x, y)                    │  │
│  │  }                                                        │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│  State Update → Re-render                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  setHoveredRow(64)                                        │  │
│  │       │                                                   │  │
│  │       ▼                                                   │  │
│  │  requestAnimationFrame(() => {                            │  │
│  │    canvasRenderer.render({                                │  │
│  │      data: filteredData,                                  │  │
│  │      hoveredRow: 64,                                      │  │
│  │      selectedRows: [12, 45],                              │  │
│  │      editingCell: null                                    │  │
│  │    })                                                     │  │
│  │  })                                                       │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Click Event Flow (Detailed)

```typescript
// 1. Native event captured
canvas.addEventListener('click', (e: MouseEvent) => {
  // 2. Transform coordinates
  const { row, col, cellBounds } = hitDetector.detectCell(
    e.offsetX,
    e.offsetY,
    scrollTop
  );

  // 3. Determine action based on column type
  const column = columns[col];

  if (column.key === '_checkbox') {
    // Selection toggle
    selectionManager.toggle(row);
    renderer.render({ selectedRows: selectionManager.getSelected() });
  }
  else if (column.key === '_actions') {
    // Action buttons - need sub-hit detection
    const action = hitDetector.detectActionButton(e.offsetX, cellBounds);
    if (action === 'edit') onEdit?.(data[row]);
    if (action === 'delete') onDelete?.(data[row]);
  }
  else {
    // Row click - navigate to detail
    const rowData = data[row];
    navigate(`/${entityCode}/${rowData.id}`);
  }
});
```

### Inline Edit Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    INLINE EDIT FLOW                              │
└─────────────────────────────────────────────────────────────────┘

1. Double-click detected
   │
   ▼
┌─────────────────────────────────────────────────────────────────┐
│  Calculate cell position                                        │
│  cellBounds = {                                                 │
│    x: 320,      // absolute X position                          │
│    y: 180,      // Y position relative to viewport              │
│    width: 150,  // column width                                 │
│    height: 40   // row height                                   │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────────────┐
│  Render DOM overlay positioned over canvas                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  <div style={{                                            │  │
│  │    position: 'absolute',                                  │  │
│  │    left: cellBounds.x,                                    │  │
│  │    top: cellBounds.y,                                     │  │
│  │    width: cellBounds.width,                               │  │
│  │    height: cellBounds.height,                             │  │
│  │    zIndex: 100                                            │  │
│  │  }}>                                                      │  │
│  │    {column.editType === 'select' ? (                      │  │
│  │      <SelectDropdown                                      │  │
│  │        options={datalabelOptions}                         │  │
│  │        value={currentValue}                               │  │
│  │        onChange={handleChange}                            │  │
│  │      />                                                   │  │
│  │    ) : (                                                  │  │
│  │      <input                                               │  │
│  │        type={column.inputType}                            │  │
│  │        value={currentValue}                               │  │
│  │        onChange={handleChange}                            │  │
│  │        autoFocus                                          │  │
│  │      />                                                   │  │
│  │    )}                                                     │  │
│  │  </div>                                                   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────────────┐
│  User edits value                                               │
│  ├── onChange: update local state                               │
│  ├── onBlur/Enter: save and close                               │
│  └── onEscape: cancel and close                                 │
└─────────────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────────────┐
│  Save changes                                                   │
│  1. Update local data: data[row][col.key] = newValue            │
│  2. Remove DOM overlay                                          │
│  3. Re-render canvas (shows updated value)                      │
│  4. API call: PATCH /api/v1/{entity}/{id}                       │
│  5. Invalidate React Query cache                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Feature Migration Matrix

### Features: What's Preserved vs What Changes

| Feature | DOM Table | Canvas Table | Migration Effort |
|---------|-----------|--------------|------------------|
| **Data Display** | ✅ Native | ✅ Painted | Low |
| **Sorting** | ✅ Native | ✅ Same logic | None |
| **Filtering** | ✅ Native | ✅ Same logic | None |
| **Search** | ✅ Native | ✅ Same logic | None |
| **Pagination** | ✅ Native | ✅ Same logic | None |
| **Row Click** | ✅ onClick | ⚠️ Hit detection | Medium |
| **Hover Effects** | ✅ CSS :hover | ⚠️ Manual tracking | Medium |
| **Row Selection** | ✅ Checkbox | ⚠️ Painted checkbox | Medium |
| **Inline Editing** | ✅ Native inputs | ⚠️ DOM overlay | High |
| **Dropdown Select** | ✅ Native select | ⚠️ DOM overlay | High |
| **Drag & Drop** | ✅ Native DnD | ⚠️ Manual implementation | High |
| **Text Selection** | ✅ Native | ❌ Complex/Limited | Very High |
| **Copy/Paste** | ✅ Native | ⚠️ Custom handler | High |
| **Right-click Menu** | ✅ Native | ⚠️ Custom menu | Medium |
| **Keyboard Nav** | ✅ Native tab | ⚠️ Custom handler | High |
| **Accessibility** | ✅ Native ARIA | ⚠️ Custom ARIA | Very High |
| **Column Resize** | ✅ CSS/JS | ⚠️ Drag handler | Medium |
| **Sticky Header** | ✅ CSS sticky | ✅ Separate DOM | Low |
| **Sticky Columns** | ✅ CSS sticky | ⚠️ Dual canvas | High |
| **Tooltips** | ✅ Native title | ⚠️ DOM overlay | Medium |
| **Badge Colors** | ✅ CSS | ✅ Painted | Low |
| **Currency Format** | ✅ Intl.NumberFormat | ✅ Same | None |
| **Date Format** | ✅ Intl.DateTimeFormat | ✅ Same | None |

### Features Lost (Hard to Implement)

| Feature | Why It's Hard | Workaround |
|---------|---------------|------------|
| **Native Text Selection** | Canvas is pixels, not text | Custom selection box UI |
| **Browser Find (Ctrl+F)** | Can't search canvas pixels | Custom search UI |
| **Screen Reader Full Support** | No semantic structure | Hidden accessible table |
| **Print (Ctrl+P)** | Canvas may not print well | Generate DOM for print |
| **Browser Autofill** | No native form fields | N/A |

### Features Fully Portable

| Feature | Implementation |
|---------|----------------|
| All data operations | Same JavaScript logic |
| API integration | Same hooks/fetching |
| State management | Same Zustand/React Query |
| Format-at-read | Same formatters |
| Metadata-driven rendering | Same backend metadata |
| Datalabel badges | Paint with colors from API |
| Currency/date formatting | Same Intl formatters |

---

## 7. Implementation Plan

### Phase 1: Core Rendering Engine (Week 1-2)

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: Core Canvas Renderer                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Tasks:                                                         │
│  □ Set up canvas element with proper sizing                     │
│  □ Implement CanvasRenderer class                               │
│  □ Create RowPainter for basic row rendering                    │
│  □ Create CellPainter for text, numbers, dates                  │
│  □ Implement virtual scrolling (only paint visible rows)        │
│  □ Add scroll event handling                                    │
│  □ Implement badge painting for datalabel fields                │
│  □ Add grid lines and borders                                   │
│                                                                  │
│  Deliverable: Static table that displays data with scrolling    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 2: Interaction Layer (Week 2-3)

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: Hit Detection & Basic Interaction                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Tasks:                                                         │
│  □ Implement HitDetector (pixel → cell mapping)                 │
│  □ Add click handling (row navigation)                          │
│  □ Add hover state tracking and highlight painting              │
│  □ Implement row selection (checkbox column)                    │
│  □ Add keyboard navigation (arrow keys, page up/down)           │
│  □ Implement column sorting (click header)                      │
│                                                                  │
│  Deliverable: Interactive table with click, hover, selection    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 3: Edit Overlays (Week 3-4)

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3: Inline Editing via DOM Overlays                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Tasks:                                                         │
│  □ Create EditOverlay component                                 │
│  □ Implement text input overlay                                 │
│  □ Implement select/dropdown overlay                            │
│  □ Implement date picker overlay                                │
│  □ Implement number input with currency formatting              │
│  □ Add save/cancel with keyboard (Enter/Escape)                 │
│  □ Connect to API mutation hooks                                │
│                                                                  │
│  Deliverable: Full inline editing matching current behavior     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 4: Header & Filtering (Week 4-5)

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 4: DOM Header with Filtering                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Tasks:                                                         │
│  □ Create TableHeader as DOM component (above canvas)           │
│  □ Implement sortable headers                                   │
│  □ Implement filter dropdowns                                   │
│  □ Add column visibility toggle                                 │
│  □ Implement column resizing                                    │
│  □ Sync column widths between header and canvas                 │
│                                                                  │
│  Deliverable: Full header functionality matching current        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 5: Polish & Accessibility (Week 5-6)

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 5: Accessibility & Production Ready                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Tasks:                                                         │
│  □ Add ARIA live regions for screen readers                     │
│  □ Implement keyboard-only navigation                           │
│  □ Add focus indicators                                         │
│  □ Create hidden accessible table for screen readers            │
│  □ Add tooltips overlay                                         │
│  □ Add context menu overlay                                     │
│  □ Performance optimization and testing                         │
│  □ Cross-browser testing                                        │
│                                                                  │
│  Deliverable: Production-ready accessible canvas table          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Timeline

```
Week 1-2: Core Rendering
├── Canvas setup
├── Virtual scrolling
├── Cell painting
└── Badge rendering

Week 2-3: Interactions
├── Hit detection
├── Click/hover
├── Row selection
└── Keyboard nav

Week 3-4: Editing
├── Edit overlays
├── Input types
├── Save/cancel
└── API integration

Week 4-5: Header
├── DOM header
├── Sorting
├── Filtering
└── Column resize

Week 5-6: Polish
├── Accessibility
├── Tooltips
├── Context menu
└── Testing

Total: 6 weeks for full feature parity
```

---

## 8. Code Examples

### Basic Canvas Renderer

```typescript
// core/CanvasRenderer.ts
export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr: number;  // Device pixel ratio for retina

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.dpr = window.devicePixelRatio || 1;
    this.setupCanvas();
  }

  private setupCanvas() {
    // Handle retina displays
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);
  }

  render(state: RenderState) {
    const { data, columns, scrollTop, hoveredRow, selectedRows } = state;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Calculate visible rows
    const rowHeight = 40;
    const startRow = Math.floor(scrollTop / rowHeight);
    const visibleRows = Math.ceil(this.canvas.height / this.dpr / rowHeight) + 1;
    const endRow = Math.min(startRow + visibleRows, data.length);

    // Paint visible rows only
    for (let i = startRow; i < endRow; i++) {
      const y = (i - startRow) * rowHeight;
      this.paintRow(data[i], i, y, columns, {
        isHovered: hoveredRow === i,
        isSelected: selectedRows.includes(i)
      });
    }
  }

  private paintRow(
    row: FormattedRow,
    rowIndex: number,
    y: number,
    columns: Column[],
    state: { isHovered: boolean; isSelected: boolean }
  ) {
    const { isHovered, isSelected } = state;

    // Background
    if (isSelected) {
      this.ctx.fillStyle = '#e0f2fe';  // Selection blue
    } else if (isHovered) {
      this.ctx.fillStyle = '#f5f5f5';  // Hover gray
    } else {
      this.ctx.fillStyle = rowIndex % 2 === 0 ? '#ffffff' : '#fafafa';
    }
    this.ctx.fillRect(0, y, this.canvas.width / this.dpr, 40);

    // Border
    this.ctx.strokeStyle = '#e5e5e5';
    this.ctx.strokeRect(0, y, this.canvas.width / this.dpr, 40);

    // Cells
    let x = 0;
    for (const col of columns) {
      this.paintCell(row, col, x, y);
      x += col.width;
    }
  }

  private paintCell(row: FormattedRow, col: Column, x: number, y: number) {
    const value = row.display[col.key] || '';
    const style = row.styles?.[col.key];

    // Handle different render types
    if (style?.startsWith('bg-')) {
      // Badge cell
      this.paintBadge(value, style, x + 8, y + 8, col.width - 16);
    } else {
      // Text cell
      this.ctx.fillStyle = '#1f2937';
      this.ctx.font = '14px Inter, sans-serif';
      this.ctx.textBaseline = 'middle';

      // Truncate text if too long
      const maxWidth = col.width - 16;
      const text = this.truncateText(value, maxWidth);
      this.ctx.fillText(text, x + 8, y + 20);
    }
  }

  private paintBadge(text: string, colorClass: string, x: number, y: number, maxWidth: number) {
    const colors = this.getBadgeColors(colorClass);
    const textWidth = Math.min(this.ctx.measureText(text).width + 16, maxWidth);

    // Badge background
    this.ctx.fillStyle = colors.bg;
    this.roundRect(x, y, textWidth, 24, 4);
    this.ctx.fill();

    // Badge text
    this.ctx.fillStyle = colors.text;
    this.ctx.font = '12px Inter, sans-serif';
    this.ctx.fillText(text, x + 8, y + 16);
  }

  private truncateText(text: string, maxWidth: number): string {
    if (this.ctx.measureText(text).width <= maxWidth) return text;

    let truncated = text;
    while (this.ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number) {
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, w, h, r);
  }

  private getBadgeColors(colorClass: string): { bg: string; text: string } {
    // Map Tailwind classes to canvas colors
    const colorMap: Record<string, { bg: string; text: string }> = {
      'bg-green-100': { bg: '#dcfce7', text: '#166534' },
      'bg-blue-100': { bg: '#dbeafe', text: '#1e40af' },
      'bg-yellow-100': { bg: '#fef9c3', text: '#854d0e' },
      'bg-red-100': { bg: '#fee2e2', text: '#991b1b' },
      // Add more mappings...
    };
    return colorMap[colorClass] || { bg: '#f3f4f6', text: '#374151' };
  }
}
```

### Hit Detector

```typescript
// interaction/HitDetector.ts
export class HitDetector {
  private columns: Column[];
  private rowHeight: number;
  private scrollTop: number;

  constructor(columns: Column[], rowHeight: number = 40) {
    this.columns = columns;
    this.rowHeight = rowHeight;
    this.scrollTop = 0;
  }

  setScrollTop(scrollTop: number) {
    this.scrollTop = scrollTop;
  }

  detectCell(offsetX: number, offsetY: number): HitResult | null {
    // Calculate row
    const absoluteY = offsetY + this.scrollTop;
    const rowIndex = Math.floor(absoluteY / this.rowHeight);

    // Calculate column
    let x = 0;
    let colIndex = -1;
    for (let i = 0; i < this.columns.length; i++) {
      if (offsetX >= x && offsetX < x + this.columns[i].width) {
        colIndex = i;
        break;
      }
      x += this.columns[i].width;
    }

    if (colIndex === -1) return null;

    return {
      rowIndex,
      colIndex,
      column: this.columns[colIndex],
      cellBounds: {
        x,
        y: (rowIndex * this.rowHeight) - this.scrollTop,
        width: this.columns[colIndex].width,
        height: this.rowHeight
      }
    };
  }
}

interface HitResult {
  rowIndex: number;
  colIndex: number;
  column: Column;
  cellBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
```

### Edit Overlay Component

```tsx
// overlays/EditOverlay.tsx
import React, { useEffect, useRef } from 'react';

interface EditOverlayProps {
  cellBounds: { x: number; y: number; width: number; height: number };
  column: Column;
  value: any;
  datalabelOptions?: DatalabelOption[];
  onSave: (value: any) => void;
  onCancel: () => void;
}

export function EditOverlay({
  cellBounds,
  column,
  value,
  datalabelOptions,
  onSave,
  onCancel
}: EditOverlayProps) {
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  const [localValue, setLocalValue] = React.useState(value);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSave(localValue);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const style: React.CSSProperties = {
    position: 'absolute',
    left: cellBounds.x,
    top: cellBounds.y,
    width: cellBounds.width,
    height: cellBounds.height,
    zIndex: 100,
    padding: '4px',
    boxSizing: 'border-box'
  };

  // Render appropriate input based on column type
  if (column.editType === 'select' && datalabelOptions) {
    return (
      <div style={style}>
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={() => onSave(localValue)}
          onKeyDown={handleKeyDown}
          className="w-full h-full border rounded px-2"
        >
          {datalabelOptions.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (column.editType === 'number' || column.editType === 'currency') {
    return (
      <div style={style}>
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="number"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={() => onSave(localValue)}
          onKeyDown={handleKeyDown}
          className="w-full h-full border rounded px-2"
        />
      </div>
    );
  }

  // Default: text input
  return (
    <div style={style}>
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => onSave(localValue)}
        onKeyDown={handleKeyDown}
        className="w-full h-full border rounded px-2"
      />
    </div>
  );
}
```

### Main Component

```tsx
// CanvasDataTable.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CanvasRenderer } from './core/CanvasRenderer';
import { HitDetector } from './interaction/HitDetector';
import { EditOverlay } from './overlays/EditOverlay';
import { TableHeader } from './header/TableHeader';

export function CanvasDataTable({
  data,
  columns,
  metadata,
  onRowClick,
  onEdit,
  onDelete
}: CanvasDataTableProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const hitDetectorRef = useRef<HitDetector | null>(null);

  const [scrollTop, setScrollTop] = useState(0);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [editingCell, setEditingCell] = useState<{
    row: number;
    col: number;
    bounds: { x: number; y: number; width: number; height: number };
  } | null>(null);

  // Initialize renderer
  useEffect(() => {
    if (canvasRef.current) {
      rendererRef.current = new CanvasRenderer(canvasRef.current);
      hitDetectorRef.current = new HitDetector(columns);
    }
  }, [columns]);

  // Re-render on state change
  useEffect(() => {
    rendererRef.current?.render({
      data,
      columns,
      scrollTop,
      hoveredRow,
      selectedRows
    });
  }, [data, columns, scrollTop, hoveredRow, selectedRows]);

  // Scroll handler
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    hitDetectorRef.current?.setScrollTop(newScrollTop);
  }, []);

  // Click handler
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const hit = hitDetectorRef.current?.detectCell(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    if (!hit) return;

    const row = data[hit.rowIndex];
    if (hit.column.key === '_checkbox') {
      setSelectedRows(prev =>
        prev.includes(hit.rowIndex)
          ? prev.filter(i => i !== hit.rowIndex)
          : [...prev, hit.rowIndex]
      );
    } else {
      onRowClick?.(row);
    }
  }, [data, onRowClick]);

  // Double-click for editing
  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const hit = hitDetectorRef.current?.detectCell(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    if (!hit || !hit.column.editable) return;

    setEditingCell({
      row: hit.rowIndex,
      col: hit.colIndex,
      bounds: hit.cellBounds
    });
  }, []);

  // Hover handler
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const hit = hitDetectorRef.current?.detectCell(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    setHoveredRow(hit?.rowIndex ?? null);
  }, []);

  // Save edit
  const handleSaveEdit = useCallback((value: any) => {
    if (!editingCell) return;

    const row = data[editingCell.row];
    const column = columns[editingCell.col];

    // Update local state
    row.raw[column.key] = value;

    // Close overlay
    setEditingCell(null);

    // API call
    onEdit?.({ ...row.raw, [column.key]: value });
  }, [editingCell, data, columns, onEdit]);

  return (
    <div className="relative">
      {/* DOM Header - for accessibility and interactivity */}
      <TableHeader
        columns={columns}
        onSort={handleSort}
        onFilter={handleFilter}
      />

      {/* Scrollable container */}
      <div
        ref={containerRef}
        className="overflow-auto"
        style={{ height: 600 }}
        onScroll={handleScroll}
      >
        {/* Virtual scroll spacer */}
        <div style={{ height: data.length * 40, position: 'relative' }}>
          {/* Canvas - positioned at scroll offset */}
          <canvas
            ref={canvasRef}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredRow(null)}
            style={{
              position: 'sticky',
              top: 0,
              width: '100%',
              height: 600
            }}
          />
        </div>
      </div>

      {/* Edit overlay - rendered over canvas when editing */}
      {editingCell && (
        <EditOverlay
          cellBounds={editingCell.bounds}
          column={columns[editingCell.col]}
          value={data[editingCell.row].raw[columns[editingCell.col].key]}
          onSave={handleSaveEdit}
          onCancel={() => setEditingCell(null)}
        />
      )}
    </div>
  );
}
```

---

## 9. Custom Visualizations

### Why Canvas Excels at Visualizations

```
DOM Table Cell:                     Canvas Cell:
┌─────────────────┐                 ┌─────────────────┐
│ $5,000          │                 │ $5,000 ████▌    │  ← Inline bar
│ (just text)     │                 │ ↗ +12%          │  ← Sparkline
└─────────────────┘                 └─────────────────┘

DOM: Each visualization = multiple nested DOM elements
Canvas: Any visualization = just pixels (zero DOM overhead)
```

### Visualization Types Possible with Canvas

#### 1. Inline Sparklines

```
┌──────────────────────────────────────────────────────────────┐
│  Project Name    │ Budget     │ Trend (7 days)  │ Status    │
├──────────────────┼────────────┼─────────────────┼───────────┤
│  Website Redesign│ $50,000    │ ╱╲╱─╲╱╱        │ ● Active  │
│  Mobile App      │ $120,000   │ ╱╱╱╱╱╱╱        │ ● Active  │
│  API Migration   │ $35,000    │ ╲╲╲─╱╲╲        │ ● At Risk │
└──────────────────┴────────────┴─────────────────┴───────────┘
```

```typescript
// Sparkline painter
function paintSparkline(ctx: CanvasRenderingContext2D, data: number[], x: number, y: number, width: number, height: number) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  ctx.beginPath();
  ctx.strokeStyle = data[data.length - 1] >= data[0] ? '#22c55e' : '#ef4444';
  ctx.lineWidth = 1.5;

  data.forEach((value, i) => {
    const px = x + i * stepX;
    const py = y + height - ((value - min) / range) * height;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });

  ctx.stroke();
}
```

#### 2. Progress Bars / Gauges

```
┌──────────────────────────────────────────────────────────────┐
│  Task Name       │ Progress          │ Hours    │ Due Date  │
├──────────────────┼───────────────────┼──────────┼───────────┤
│  Design Phase    │ ████████████░░ 85%│ 24/32    │ Nov 28    │
│  Development     │ ██████░░░░░░░ 45% │ 48/120   │ Dec 15    │
│  Testing         │ ██░░░░░░░░░░░ 15% │ 8/60     │ Dec 20    │
└──────────────────┴───────────────────┴──────────┴───────────┘
```

```typescript
function paintProgressBar(ctx: CanvasRenderingContext2D, progress: number, x: number, y: number, width: number, height: number) {
  const barWidth = width - 40;  // Leave room for percentage text
  const fillWidth = barWidth * Math.min(progress, 1);

  // Background
  ctx.fillStyle = '#e5e7eb';
  roundRect(ctx, x, y + 4, barWidth, height - 8, 4);
  ctx.fill();

  // Progress fill
  const color = progress >= 0.8 ? '#22c55e' : progress >= 0.5 ? '#f59e0b' : '#3b82f6';
  ctx.fillStyle = color;
  roundRect(ctx, x, y + 4, fillWidth, height - 8, 4);
  ctx.fill();

  // Percentage text
  ctx.fillStyle = '#374151';
  ctx.font = '12px Inter';
  ctx.fillText(`${Math.round(progress * 100)}%`, x + barWidth + 8, y + height / 2 + 4);
}
```

#### 3. Mini Bar Charts

```
┌──────────────────────────────────────────────────────────────┐
│  Employee        │ Tasks by Status           │ Total │ Avg  │
├──────────────────┼───────────────────────────┼───────┼──────┤
│  John Smith      │ ██ ████ ██████ ░░        │ 24    │ 4.2  │
│                  │ TD  IP   Done   Blocked   │       │      │
│  Jane Doe        │ █ ██████ ████████ █      │ 31    │ 3.8  │
│  Bob Wilson      │ ████ ██ ████ ░░░░        │ 18    │ 4.5  │
└──────────────────┴───────────────────────────┴───────┴──────┘
```

```typescript
function paintMiniBarChart(ctx: CanvasRenderingContext2D, data: { value: number; color: string }[], x: number, y: number, width: number, height: number) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const barHeight = height - 8;
  let currentX = x;

  data.forEach(({ value, color }) => {
    const barWidth = (value / total) * width;
    ctx.fillStyle = color;
    ctx.fillRect(currentX, y + 4, barWidth - 2, barHeight);
    currentX += barWidth;
  });
}
```

#### 4. Heatmap Cells

```
┌──────────────────────────────────────────────────────────────┐
│  Project         │ Mon  │ Tue  │ Wed  │ Thu  │ Fri  │ Total │
├──────────────────┼──────┼──────┼──────┼──────┼──────┼───────┤
│  Website         │ ░░░░ │ ████ │ ████ │ ░░░░ │ ██░░ │ 24h   │
│  Mobile App      │ ████ │ ████ │ ████ │ ████ │ ████ │ 40h   │
│  API Work        │ ██░░ │ ░░░░ │ ░░░░ │ ████ │ ████ │ 18h   │
└──────────────────┴──────┴──────┴──────┴──────┴──────┴───────┘

Legend: ░░░░ = 0-2h  ██░░ = 2-4h  ████ = 4-8h
```

```typescript
function paintHeatmapCell(ctx: CanvasRenderingContext2D, value: number, max: number, x: number, y: number, width: number, height: number) {
  const intensity = value / max;

  // Color gradient from light to dark
  const r = Math.round(255 - intensity * 200);
  const g = Math.round(255 - intensity * 100);
  const b = Math.round(255 - intensity * 50);

  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fillRect(x + 2, y + 2, width - 4, height - 4);

  // Value text
  ctx.fillStyle = intensity > 0.5 ? '#ffffff' : '#374151';
  ctx.font = '11px Inter';
  ctx.textAlign = 'center';
  ctx.fillText(value.toString(), x + width / 2, y + height / 2 + 4);
}
```

#### 5. Status Indicators with Icons

```
┌──────────────────────────────────────────────────────────────┐
│  Task            │ Priority │ Status      │ Assignee        │
├──────────────────┼──────────┼─────────────┼─────────────────┤
│  Fix login bug   │ 🔴 High  │ ⏳ In Prog  │ 👤 John + 2     │
│  Add dark mode   │ 🟡 Med   │ ✅ Done     │ 👤 Jane         │
│  Update docs     │ 🟢 Low   │ 📋 Backlog  │ 👤 Unassigned   │
└──────────────────┴──────────┴─────────────┴─────────────────┘
```

```typescript
function paintStatusIcon(ctx: CanvasRenderingContext2D, status: string, x: number, y: number) {
  const icons: Record<string, { symbol: string; color: string }> = {
    'in_progress': { symbol: '◐', color: '#3b82f6' },
    'completed': { symbol: '●', color: '#22c55e' },
    'blocked': { symbol: '■', color: '#ef4444' },
    'backlog': { symbol: '○', color: '#9ca3af' },
  };

  const icon = icons[status] || icons['backlog'];
  ctx.fillStyle = icon.color;
  ctx.font = '14px Arial';
  ctx.fillText(icon.symbol, x, y + 14);
}
```

#### 6. Inline Gantt / Timeline

```
┌──────────────────────────────────────────────────────────────┐
│  Phase           │ Nov                    Dec                │
│                  │ 1  8  15 22 29 │ 6  13 20 27            │
├──────────────────┼────────────────┴──────────────────────────┤
│  Planning        │ ████████░░░░░░░░░░░░░░░░░░░░░░           │
│  Design          │ ░░░░████████████░░░░░░░░░░░░░░           │
│  Development     │ ░░░░░░░░░░░░████████████████░░           │
│  Testing         │ ░░░░░░░░░░░░░░░░░░░░████████████         │
└──────────────────┴──────────────────────────────────────────┘
```

```typescript
function paintGanttBar(
  ctx: CanvasRenderingContext2D,
  startDate: Date,
  endDate: Date,
  timelineStart: Date,
  timelineEnd: Date,
  x: number, y: number, width: number, height: number,
  color: string,
  progress: number
) {
  const totalDays = (timelineEnd.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24);
  const startOffset = (startDate.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24);
  const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

  const barX = x + (startOffset / totalDays) * width;
  const barWidth = (duration / totalDays) * width;
  const barHeight = height - 8;

  // Background bar
  ctx.fillStyle = color + '40';  // 25% opacity
  roundRect(ctx, barX, y + 4, barWidth, barHeight, 4);
  ctx.fill();

  // Progress fill
  ctx.fillStyle = color;
  roundRect(ctx, barX, y + 4, barWidth * progress, barHeight, 4);
  ctx.fill();

  // Border
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  roundRect(ctx, barX, y + 4, barWidth, barHeight, 4);
  ctx.stroke();
}
```

#### 7. Relationship Indicators

```
┌──────────────────────────────────────────────────────────────┐
│  Entity          │ Relationships                   │ Count  │
├──────────────────┼─────────────────────────────────┼────────┤
│  Project Alpha   │ ●──●──●──●──●  (5 tasks)       │ 12     │
│  Project Beta    │ ●──●──●  (3 tasks)             │ 8      │
│  Client ABC      │ ●══●══●══●  (4 projects)       │ 4      │
└──────────────────┴─────────────────────────────────┴────────┘
```

### Visualization Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                VISUALIZATION CELL RENDERER                       │
└─────────────────────────────────────────────────────────────────┘

CellPainter
├── TextPainter (default)
├── BadgePainter (datalabel fields)
├── SparklinePainter
│   └── data: number[] (e.g., last 7 days values)
├── ProgressBarPainter
│   └── data: { value: number, max: number }
├── MiniChartPainter
│   └── data: { segments: { value: number, color: string }[] }
├── HeatmapPainter
│   └── data: { value: number, min: number, max: number }
├── GanttPainter
│   └── data: { start: Date, end: Date, progress: number }
├── IconPainter
│   └── data: { icon: string, color: string }
└── CustomPainter
    └── data: any (user-defined render function)
```

### Column Configuration for Visualizations

```typescript
// Column definitions with visualization types
const columns: CanvasColumn[] = [
  {
    key: 'name',
    title: 'Project Name',
    width: 200,
    renderType: 'text'  // Default
  },
  {
    key: 'budget_trend',
    title: 'Budget Trend',
    width: 120,
    renderType: 'sparkline',
    visualizationConfig: {
      dataKey: 'budget_history',  // Array field in row data
      color: 'auto',              // Green if up, red if down
      height: 24
    }
  },
  {
    key: 'progress',
    title: 'Progress',
    width: 150,
    renderType: 'progress_bar',
    visualizationConfig: {
      maxValue: 100,
      showLabel: true,
      colorThresholds: {
        low: { max: 30, color: '#ef4444' },
        medium: { max: 70, color: '#f59e0b' },
        high: { max: 100, color: '#22c55e' }
      }
    }
  },
  {
    key: 'task_distribution',
    title: 'Tasks by Status',
    width: 180,
    renderType: 'stacked_bar',
    visualizationConfig: {
      segments: [
        { key: 'todo_count', color: '#94a3b8', label: 'To Do' },
        { key: 'in_progress_count', color: '#3b82f6', label: 'In Progress' },
        { key: 'done_count', color: '#22c55e', label: 'Done' },
        { key: 'blocked_count', color: '#ef4444', label: 'Blocked' }
      ]
    }
  },
  {
    key: 'timeline',
    title: 'Timeline',
    width: 250,
    renderType: 'gantt',
    visualizationConfig: {
      startField: 'planned_start_date',
      endField: 'planned_end_date',
      progressField: 'completion_pct',
      timelineRange: 'quarter'  // or 'month', 'year', 'custom'
    }
  },
  {
    key: 'activity',
    title: 'Weekly Activity',
    width: 140,
    renderType: 'heatmap',
    visualizationConfig: {
      dataKey: 'weekly_hours',  // Array of 7 values
      colorScale: 'blue',       // or 'green', 'red', 'custom'
      showValues: false
    }
  }
];
```

### Comparison: DOM vs Canvas Visualizations

| Visualization | DOM Implementation | Canvas Implementation |
|---------------|-------------------|----------------------|
| **Sparkline** | SVG (many paths) or Chart.js | Single path stroke |
| **Progress Bar** | Nested divs + CSS | Two rectangles |
| **Mini Chart** | Chart.js / Recharts | Direct painting |
| **Heatmap** | Background-color per cell | Fill rectangles |
| **Gantt** | Complex positioned divs | Simple rectangles |
| **Icons** | Icon font or SVG | Text or path |

### Performance: 1000 Rows × Visualization Column

| Approach | DOM Elements | Render Time |
|----------|--------------|-------------|
| **DOM + SVG Sparklines** | 1000 SVGs × ~20 paths = 20,000 | ~3000ms |
| **DOM + Chart.js** | 1000 canvases | ~2000ms |
| **Canvas Table** | 1 canvas | ~50ms |

### Interactive Visualizations

Canvas visualizations can still be interactive:

```typescript
// Hover on sparkline shows tooltip with values
handleMouseMove(e: MouseEvent) {
  const hit = hitDetector.detectCell(e.offsetX, e.offsetY);
  if (!hit) return;

  const column = columns[hit.colIndex];

  if (column.renderType === 'sparkline') {
    // Calculate which data point is hovered
    const sparklineData = data[hit.rowIndex][column.visualizationConfig.dataKey];
    const cellWidth = column.width - 16;  // Padding
    const pointIndex = Math.floor((e.offsetX - hit.cellBounds.x - 8) / (cellWidth / sparklineData.length));

    if (pointIndex >= 0 && pointIndex < sparklineData.length) {
      showTooltip({
        x: e.offsetX,
        y: e.offsetY,
        content: `Day ${pointIndex + 1}: ${sparklineData[pointIndex]}`
      });
    }
  }

  if (column.renderType === 'stacked_bar') {
    // Show which segment is hovered
    const segments = column.visualizationConfig.segments;
    const rowData = data[hit.rowIndex];
    // ... calculate segment bounds and show tooltip
  }
}
```

### Custom Visualization API

```typescript
// Allow users to define custom visualizations
const customVisualization: CustomVisualizationConfig = {
  key: 'risk_indicator',
  title: 'Risk Level',
  width: 100,
  renderType: 'custom',
  render: (ctx, value, bounds, row) => {
    const riskLevel = row.risk_score;
    const segments = 5;
    const segmentWidth = (bounds.width - 16) / segments;

    for (let i = 0; i < segments; i++) {
      const filled = i < riskLevel;
      ctx.fillStyle = filled
        ? (riskLevel <= 2 ? '#22c55e' : riskLevel <= 3 ? '#f59e0b' : '#ef4444')
        : '#e5e7eb';
      ctx.fillRect(
        bounds.x + 8 + i * segmentWidth,
        bounds.y + 12,
        segmentWidth - 2,
        16
      );
    }
  }
};
```

---

## Summary

### Key Architectural Decisions

1. **Hybrid Approach**: Canvas for body, DOM for header/overlays
2. **Hit Detection**: Map pixel coordinates to logical cells
3. **DOM Overlays**: Native inputs positioned over canvas for editing
4. **Virtual Scrolling**: Only render visible rows
5. **State-Driven Rendering**: React state triggers canvas repaint

### Trade-offs Accepted

| Gain | Cost |
|------|------|
| 100x faster rendering | More complex codebase |
| Smooth scrolling at 100K rows | No native text selection |
| 60 FPS interactions | Custom accessibility layer |
| Lower memory usage | Manual event handling |

### Recommendation

For PMO's 20K projects / 40K tasks:
- **Short term**: Implement virtualization (react-virtual) - 90% benefit, 10% effort
- **Long term**: Consider Canvas if data grows to 100K+ or real-time updates needed

---

**Document Version**: 1.0.0
**Last Updated**: 2024-11-24
**Author**: PMO Platform Team
