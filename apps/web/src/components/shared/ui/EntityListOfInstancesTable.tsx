/**
 * ============================================================================
 * ENTITY DATA TABLE - Universal table component for all entity types
 * ============================================================================
 *
 * Full-featured data table with:
 * - Inline editing with auto-detected field types (text, select, date, number, file upload)
 * - Quick add row at bottom (matches SettingsDataTable pattern)
 * - Filtering, sorting, column selection, pagination
 * - Settings-driven dropdowns with colored badges
 * - Drag & drop reordering support
 *
 * INLINE EDITING PATTERN (Airtable-style v8.4.0, v13.0.0 Cell-Isolated State):
 * - Single-click on editable cell → Instant inline edit of THAT cell only
 * - Click outside / Tab / Enter → Auto-save and exit edit mode
 * - Escape → Cancel without saving
 * - Edit icon (✏️) kept as fallback for discoverability (edits entire row)
 * - Keyboard: 'E' when row focused enters row edit mode
 * - Tab navigates to next editable cell (spreadsheet convention)
 * - Cmd+Z / Ctrl+Z → Undo last change with toast notification
 *
 * v13.0.0 PERFORMANCE: Cell-Isolated State Pattern (Industry Standard)
 * - Cell components (DebouncedInput) manage their own local state
 * - Parent is only notified on COMMIT (blur/enter), not during typing
 * - Eliminates ALL parent re-renders during typing (0 vs 2 per debounce)
 * - Supports 10K+ rows with smooth editing
 * - See: docs/design_pattern/INLINE_EDIT_PERFORMANCE_ACTION_PLAN.md
 *
 * ADD ROW FEATURE:
 * - When allowAddRow=true, shows "+ Add new row" button at bottom
 * - Clicking opens inline form with all visible columns
 * - Provides quick way to add records (complements detailed create form)
 *
 * Used by: All entity pages (projects, tasks, clients, etc.)
 * Different from: SettingsDataTable (specialized for settings with fixed schema)
 */
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Search, Filter, Columns, ChevronLeft, ChevronRight, Edit, Share, Trash2, X, Plus, Check, AlignJustify, Minus, Menu } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  getSettingDatalabel,
  type LabelMetadata
} from '../../../lib/formatters/labelMetadataLoader';
import {
  renderEditModeFromMetadata,
  type BackendFieldMetadata
} from '../../../lib/frontEndFormatterService';
import { colorCodeToTailwindClass } from '../../../lib/formatters/valueFormatters';
// v9.0.0: Use Dexie sync cache for datalabel options
import { getDatalabelSync } from '../../../db/tanstack-index';
import type { EntityMetadata } from '../../../lib/api';

// v8.2.0: Format-at-fetch with required nested metadata structure
import { type FormattedRow, isFormattedData, extractViewType, extractEditType, isValidComponentMetadata } from '../../../lib/formatters';
import { InlineFileUploadCell } from '../file/InlineFileUploadCell';
import { EllipsisBounce, InlineSpinner } from './EllipsisBounce';
// v8.3.2: Shared badge dropdown for datalabel fields (DRY principle)
import { BadgeDropdownSelect } from './BadgeDropdownSelect';
// v9.8.0: Reusable Chip component for filter chips
import { Chip } from './Chip';
// v11.0.0: Split add button for "Add New" + "Link Existing" options
import { SplitAddButton } from './SplitAddButton';
// v11.0.0: Modal for linking existing entities
import { Modal_LinkExistingEntityInstanceToDataTable } from '../modal/Modal_LinkExistingEntityInstanceToDataTable';
// v11.0.0: Entity codes cache for dynamic entity labels
import { useEntityCodes } from '../../../db/cache/hooks';

// ============================================================================
// v14.1.0: DENSITY CONTROL SYSTEM - Modern minimal table design
// ============================================================================
// Three density levels for different use cases:
// - compact: Power users, data comparison, maximizes visible rows
// - regular: Default everyday use, balanced readability
// - relaxed: Accessibility, sparse data, touch-friendly
// ============================================================================
export type TableDensity = 'compact' | 'regular' | 'relaxed';

// v14.2.0: DENSITY CONFIG - Compact for minimal, elegant tables
// v14.3.0: Removed vertical padding from cells - row height + flex centering controls spacing
// v14.3.1: Reduced row heights for tighter, more compact appearance
const DENSITY_CONFIG = {
  compact: {
    rowHeight: 28,
    cellPadding: 'px-3',  // No vertical padding - flex items-center handles alignment
    headerPadding: 'px-3 py-1',
    fontSize: 'text-xs',
    badgeSize: 'px-1.5 py-px text-[10px]',
    iconSize: 'h-3 w-3',
    actionIconSize: 'h-3.5 w-3.5',
    inputPadding: 'px-1.5 py-0.5',  // For inline edit inputs
  },
  regular: {
    rowHeight: 34,
    cellPadding: 'px-4',  // No vertical padding - flex items-center handles alignment
    headerPadding: 'px-4 py-1.5',
    fontSize: 'text-[13px]',
    badgeSize: 'px-2 py-0.5 text-[11px]',
    iconSize: 'h-3.5 w-3.5',
    actionIconSize: 'h-4 w-4',
    inputPadding: 'px-2 py-1',
  },
  relaxed: {
    rowHeight: 42,
    cellPadding: 'px-5',  // No vertical padding - flex items-center handles alignment
    headerPadding: 'px-5 py-2',
    fontSize: 'text-sm',
    badgeSize: 'px-2.5 py-0.5 text-xs',
    iconSize: 'h-4 w-4',
    actionIconSize: 'h-4 w-4',
    inputPadding: 'px-2.5 py-1.5',
  },
} as const;

// ============================================================================
// METADATA-DRIVEN RENDERING (Pure Backend-Driven)
// ============================================================================
// v8.2.0: Metadata is REQUIRED from backend - no fallback generation
// Backend sends: metadata.entityListOfInstancesTable = { viewType: {...}, editType: {...} }
// ============================================================================
// ALL field rendering (view + edit modes) driven by backend metadata
// - View mode: uses FormattedRow.display[key] from format-at-fetch pattern
// - renderEditModeFromMetadata() for edit mode (reads metadata.inputType)
// - Zero frontend pattern detection or configuration
// ============================================================================

/**
 * Extract settings datalabel from column key
 * v8.2.0: Uses centralized mapping from settingsLoader ONLY - no fallback suffix stripping
 * Backend must provide correct datalabelKey via metadata
 */
function extractSettingsDatalabel(columnKey: string): string {
  // v8.2.0: Use centralized mapping ONLY - no fallback pattern stripping
  const mapped = getSettingDatalabel(columnKey);
  if (mapped) {
    return mapped;
  }

  // v8.2.0: Return as-is if not mapped (backend should provide settingsDatalabel)
  return columnKey;
}

/**
 * Column definition - Compatible with both manual and auto-generated configs
 * Matches DataTableColumn from viewConfigGenerator for seamless integration
 */
export interface Column<T = any> {
  key: string;
  title: string;
  visible?: boolean;              // false = hide from UI, but still in data for API calls
  sortable?: boolean;
  filterable?: boolean;
  searchable?: boolean;
  render?: (value: any, record: T, allData?: T[]) => React.ReactNode;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  // Inline editing (now supports all 15 EditTypes from universal detector)
  // v12.2.0: 'select' replaced with 'component' - use component field for specific component
  editable?: boolean;
  editType?: 'text' | 'number' | 'currency' | 'date' | 'datetime' | 'time' |
             'component' | 'multiselect' | 'checkbox' | 'textarea' | 'tags' |
             'jsonb' | 'datatable' | 'file' | 'dag-select';
  // v12.0.0: Renamed lookupSource → lookupSourceTable, datalabelKey → lookupField
  lookupSourceTable?: 'datalabel' | 'entityInstance';  // Backend lookup type
  lookupEntity?: string;                               // Entity code for entityInstance lookup
  lookupField?: string;                                // Field name for lookup (datalabel key or field name)
  /**
   * Static options for inline editing dropdowns
   * Use this when options are hardcoded (e.g., color_code field in settings tables)
   */
  options?: LabelMetadata[];
  /**
   * When true, this column can be edited inline in the DataTable.
   */
  inlineEditable?: boolean;
}

export interface RowAction<T = any> {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick: (record: T) => void;
  disabled?: (record: T) => boolean;
  className?: string;
  variant?: 'default' | 'primary' | 'danger';
}

export interface EntityListOfInstancesTableProps<T = any> {
  data: T[];
  metadata?: EntityMetadata | null;  // Backend metadata (REQUIRED for metadata-driven mode)
  datalabels?: any[];                // Datalabel options from API (for dropdowns and DAG viz)
  columns?: Column<T>[];             // Legacy explicit columns (fallback only)
  loading?: boolean;
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    showSizeChanger?: boolean;
    pageSizeOptions?: number[];
    onChange?: (page: number, pageSize: number) => void;
  };
  rowKey?: string | ((record: T) => string);
  onRowClick?: (record: T) => void;
  searchable?: boolean;
  filterable?: boolean;
  columnSelection?: boolean;
  className?: string;
  rowActions?: RowAction<T>[];
  showDefaultActions?: boolean;
  // NOTE: onView prop removed - row clicks already navigate to detail view
  onEdit?: (record: T) => void;
  onShare?: (record: T) => void;
  onDelete?: (record: T) => void;
  /** v14.3.0: Batch delete callback - triggered by Delete key with selected rows */
  onBatchDelete?: (selectedIds: string[]) => void;
  // Bulk selection support
  selectable?: boolean;
  selectedRows?: string[];
  onSelectionChange?: (selectedRows: string[]) => void;
  // Inline editing support
  inlineEditable?: boolean;
  editingRow?: string | null;

  // Inline edit support
  editedData?: any;
  onInlineEdit?: (rowId: string, field: string, value: any) => void;
  onSaveInlineEdit?: (record: T) => void;
  onCancelInlineEdit?: () => void;
  // Settings entity support
  colorOptions?: { value: string; label: string }[];
  allowReordering?: boolean;
  onReorder?: (newData: T[]) => void;
  // Inline row addition support
  allowAddRow?: boolean;
  onAddRow?: (newRecord: Partial<T>) => void;
  // v8.4.0: Airtable-style cell editing
  editingCell?: { rowId: string; columnKey: string } | null;  // Currently editing cell
  onCellClick?: (rowId: string, columnKey: string, record: T) => void;  // Cell click handler
  onCellSave?: (rowId: string, columnKey: string, value: any, record: T) => void;  // Save single cell
  focusedRowId?: string | null;  // Currently focused row (for keyboard nav)
  onRowFocus?: (rowId: string | null) => void;  // Row focus handler
  // v13.1.0: Infinite scroll loading indicators
  isFetchingNextPage?: boolean;    // Loading more data at bottom
  isFetchingPreviousPage?: boolean; // Loading more data at top (bidirectional scroll)
  hasNextPage?: boolean;           // More data available at bottom
  hasPreviousPage?: boolean;       // More data available at top
  // v14.1.0: Density control for compact/regular/relaxed table appearance
  density?: TableDensity;
  onDensityChange?: (density: TableDensity) => void;
  // v11.0.0: Link Existing Entity feature props
  /** Entity type code (e.g., 'customer', 'task') - enables dynamic labels */
  entityCode?: string;
  /** Parent context - when provided, enables "Link Existing" option */
  parentContext?: {
    entityCode: string;      // Parent entity type (e.g., 'project')
    entityId: string;        // Parent entity instance UUID
    entityLabel?: string;    // Parent display name (e.g., 'Project')
  };
  /** Callback after successful linking - typically used to refresh the list */
  onLinkSuccess?: () => void;
}

export function EntityListOfInstancesTable<T = any>({
  data,
  metadata,  // Backend metadata from API
  datalabels,  // Datalabel options from API response
  columns: initialColumns,
  loading = false,
  pagination,
  rowKey = 'id',
  onRowClick,
  searchable = true,
  filterable = true,
  columnSelection = true,
  className = '',
  rowActions = [],
  showDefaultActions = true,
  onEdit,
  onShare,
  onDelete,
  onBatchDelete,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  inlineEditable = false,
  editingRow = null,
  editedData = {},
  onInlineEdit,
  onSaveInlineEdit,
  onCancelInlineEdit,
  colorOptions,
  allowReordering = false,
  onReorder,
  allowAddRow = false,
  onAddRow,
  // v8.4.0: Airtable-style cell editing
  editingCell = null,
  onCellClick,
  onCellSave,
  focusedRowId = null,
  onRowFocus,
  // v13.1.0: Infinite scroll loading indicators
  isFetchingNextPage = false,
  isFetchingPreviousPage = false,
  hasNextPage = false,
  hasPreviousPage = false,
  // v14.2.0: Density control - default to regular for better readability
  density = 'regular',
  onDensityChange,
  // v11.0.0: Link Existing Entity feature
  entityCode,
  parentContext,
  onLinkSuccess,
}: EntityListOfInstancesTableProps<T>) {
  // ============================================================================
  // v14.1.0: DENSITY CONFIGURATION - Get current density settings
  // ============================================================================
  const densitySettings = DENSITY_CONFIG[density];

  // ============================================================================
  // v14.3.0: MULTI-SELECT - State for Ctrl+Click, Shift+Click, and Shift+Arrow selection
  // ============================================================================
  // Track focused row index for keyboard navigation
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);

  // Anchor point for shift-selection (the starting point of a range selection)
  const [selectionAnchorIndex, setSelectionAnchorIndex] = useState<number | null>(null);

  // Internal selection state (used when parent doesn't control selection)
  const [internalSelectedRows, setInternalSelectedRows] = useState<string[]>([]);

  // Use parent-controlled selection if provided, otherwise use internal state
  const effectiveSelectedRows = selectable && (selectedRows.length > 0 || onSelectionChange) ? selectedRows : internalSelectedRows;
  const setEffectiveSelectedRows = onSelectionChange || setInternalSelectedRows;

  // ============================================================================
  // v11.0.0: LINK EXISTING ENTITY - Modal state and entity label
  // ============================================================================
  const [showLinkExistingModal, setShowLinkExistingModal] = useState(false);
  const { getByCode } = useEntityCodes();

  // Get entity label for dynamic button text (e.g., "Add New Customer")
  // Use singular 'name' for buttons ("Add New Project") not plural 'ui_label' ("Projects")
  const entityMeta = entityCode ? getByCode(entityCode) : null;
  const entityLabel = entityMeta?.name || entityCode || 'Item';

  // ============================================================================
  // METADATA-DRIVEN COLUMN GENERATION (Pure Backend-Driven Architecture)
  // ============================================================================
  // Backend sends complete field metadata → Frontend renders exactly as instructed

  const columns = useMemo(() => {
    // v9.2.0: Support both direct and nested metadata structures
    // - Direct: metadata = { viewType, editType } (from useEntityInstanceData which already extracts)
    // - Nested: metadata = { entityListOfInstancesTable: { viewType, editType } } (legacy/direct API)
    const componentMetadata = isValidComponentMetadata(metadata)
      ? metadata
      : (metadata as any)?.entityListOfInstancesTable;

    // Explicit columns override (for special cases)
    if (initialColumns && initialColumns.length > 0) {
      return initialColumns;
    }

    // Extract viewType and editType from component metadata
    const viewType = extractViewType(componentMetadata);
    const editType = extractEditType(componentMetadata);

    if (!viewType) {
      return [];
    }

    // Get field order from fields array if available, otherwise use viewType keys
    const fieldOrder = (metadata as any)?.fields || Object.keys(viewType);

    return fieldOrder
      .filter((fieldKey: string) => {
        const fieldMeta = viewType[fieldKey];
        if (!fieldMeta) return false;
        return fieldMeta.behavior?.visible === true;
      })
      .map((fieldKey: string) => {
        const viewMeta = viewType[fieldKey];
        const editMeta = editType?.[fieldKey];

        // Extract properties from nested structure
        const label = viewMeta.label || fieldKey.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
        const sortable = viewMeta.behavior?.sortable;
        const filterable = viewMeta.behavior?.filterable;
        const searchable = viewMeta.behavior?.searchable;
        const width = viewMeta.style?.width;
        const align = viewMeta.style?.align;
        const editable = editMeta?.behavior?.editable ?? false;
        const inputType = editMeta?.inputType ?? 'text';
        // v12.0.0: Renamed lookupSource → lookupSourceTable, datalabelKey → lookupField
        const lookupSourceTable = editMeta?.lookupSourceTable;
        const lookupEntity = editMeta?.lookupEntity;
        const lookupField = editMeta?.lookupField || viewMeta?.lookupField;  // v12.0.0: Also check viewMeta

        // Inject key into metadata for downstream use
        // v12.0.0: Include lookupSourceTable, lookupEntity, lookupField for edit mode rendering
        const enrichedMeta = { key: fieldKey, ...viewMeta, inputType, editable, lookupSourceTable, lookupEntity, lookupField };

        return {
          key: fieldKey,
          title: label,
          visible: true,
          sortable,
          filterable,
          searchable,
          width,
          align,
          editable,
          editType: inputType,
          lookupSourceTable,
          lookupEntity,
          lookupField,
          backendMetadata: enrichedMeta
        } as Column<T>;
      });
  }, [metadata, initialColumns]);

  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    // Only include columns that are explicitly marked as visible
    // This respects the visible property from frontEndFormatterService
    new Set(columns.filter(col => col.visible !== false).map(col => col.key))
  );
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [dropdownFilters, setDropdownFilters] = useState<Record<string, string[]>>({});
  const [selectedFilterColumn, setSelectedFilterColumn] = useState<string>('');
  const [filterSearchTerm, setFilterSearchTerm] = useState<string>('');
  const [showFilterDropdown, setShowFilterDropdown] = useState<boolean>(false);

  // v9.4.2: Debounced filter search term to prevent UI lag when typing
  // Filters 1000+ options smoothly without re-rendering on every keystroke
  const [debouncedFilterSearchTerm, setDebouncedFilterSearchTerm] = useState<string>('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilterSearchTerm(filterSearchTerm);
    }, 150); // 150ms debounce - fast enough to feel responsive, slow enough to prevent lag
    return () => clearTimeout(timer);
  }, [filterSearchTerm]);
  const filterContainerRef = useRef<HTMLDivElement | null>(null);
  const columnSelectorRef = useRef<HTMLDivElement | null>(null);

  // Update visibleColumns when columns change (e.g., auto-generated columns loaded)
  // Only add new columns that are marked as visible
  useEffect(() => {
    setVisibleColumns(prev => {
      const newVisible = new Set(prev);
      // Add any new columns that aren't in the set yet AND are visible
      columns.forEach(col => {
        // Only add if column is visible and not already in the set
        if (!newVisible.has(col.key) && col.visible !== false) {
          newVisible.add(col.key);
        }
        // Remove columns that are now marked as not visible
        if (newVisible.has(col.key) && col.visible === false) {
          newVisible.delete(col.key);
        }
      });
      return newVisible;
    });
  }, [columns]);

  // Bottom scrollbar refs (monday.com style)
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const bottomScrollbarRef = useRef<HTMLDivElement | null>(null);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Add row state - v11.0.0: Handled by parent via onAddRow callback
  // (isAddingRow/newRowData removed - parent manages add row state)

  // Bottom scrollbar positioning state
  const [scrollbarStyles, setScrollbarStyles] = useState<{
    left: number;
    width: number;
    visible: boolean;
  }>({ left: 0, width: 0, visible: false });

  // Scroll progress state for progress indicator
  const [scrollProgress, setScrollProgress] = useState(0);

  // ============================================================================
  // v8.4.0: AIRTABLE-STYLE CELL EDITING STATE & HANDLERS
  // ============================================================================
  // Single-click on cell → edit that cell only
  // Enter/Tab/Click outside → save and exit
  // Escape → cancel without saving
  // ============================================================================

  // Local cell editing state (if parent doesn't control it)
  const [localEditingCell, setLocalEditingCell] = useState<{ rowId: string; columnKey: string } | null>(null);

  // v8.4.0: Undo stack for cell edits
  type UndoEntry = { rowId: string; columnKey: string; oldValue: any; newValue: any; record: T };
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [showUndoNotification, setShowUndoNotification] = useState(false);

  // Use parent-controlled state if provided, otherwise use local state
  const activeEditingCell = editingCell ?? localEditingCell;

  // Ref for click-outside detection
  const editingCellRef = useRef<HTMLDivElement | null>(null);

  // Long-press tracking for inline edit (click and hold pattern)
  // Hold mouse down for 500ms → enter edit mode
  // Quick click (< 500ms) → navigate to detail page
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef<boolean>(false); // Track if long-press activated edit mode
  const LONG_PRESS_DELAY = 500; // 500ms hold to enter edit mode

  // Check if a specific cell is being edited
  const isCellEditing = useCallback((rowId: string, columnKey: string) => {
    return activeEditingCell?.rowId === rowId && activeEditingCell?.columnKey === columnKey;
  }, [activeEditingCell]);

  // Enter edit mode for a cell (internal helper)
  const enterEditMode = useCallback((
    rowId: string,
    columnKey: string,
    record: T
  ) => {
    // Get the raw value for editing
    const formattedRecord = record as FormattedRow<any>;
    const rawRecord = formattedRecord.raw || record;
    const rawValue = (rawRecord as any)[columnKey];

    if (onCellClick) {
      // Parent-controlled mode
      onCellClick(rowId, columnKey, record);
    } else {
      // Local state mode - v13.0.0: DebouncedInput manages its own value
      setLocalEditingCell({ rowId, columnKey });
    }

    // Also call onInlineEdit to populate editedData for compatibility
    if (onInlineEdit) {
      onInlineEdit(rowId, columnKey, rawValue);
    }
  }, [onCellClick, onInlineEdit]);

  // Cancel long-press timer
  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Handle cell mouse down - start long-press timer
  const handleCellMouseDown = useCallback((
    e: React.MouseEvent,
    rowId: string,
    columnKey: string,
    record: T,
    isEditable: boolean
  ) => {
    if (!inlineEditable || !isEditable) return;
    if (isCellEditing(rowId, columnKey)) return;

    // Cancel any existing timer and reset flag
    cancelLongPress();
    longPressTriggeredRef.current = false;

    // Start long-press timer
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true; // Mark that long-press triggered edit mode
      enterEditMode(rowId, columnKey, record);
      longPressTimerRef.current = null;
    }, LONG_PRESS_DELAY);
  }, [inlineEditable, isCellEditing, enterEditMode, cancelLongPress, LONG_PRESS_DELAY]);

  // Handle cell mouse up - cancel long-press timer
  const handleCellMouseUp = useCallback(() => {
    cancelLongPress();
  }, [cancelLongPress]);

  // Handle cell mouse leave - cancel long-press timer
  const handleCellMouseLeave = useCallback(() => {
    cancelLongPress();
  }, [cancelLongPress]);

  // Handle cell click - only prevent propagation if long-press triggered edit mode
  // Quick click (< 500ms) → allow propagation → row onClick → navigate to detail page
  // Long press (≥ 500ms) → edit mode already activated, stop propagation
  const handleCellClick = useCallback((
    e: React.MouseEvent,
    rowId: string,
    columnKey: string,
    record: T,
    isEditable: boolean
  ) => {
    // Only stop propagation if long-press triggered edit mode
    // This allows quick clicks to propagate to row for navigation
    if (longPressTriggeredRef.current) {
      e.stopPropagation();
      longPressTriggeredRef.current = false; // Reset for next interaction
    }
    // Quick click: don't stop propagation, let row onClick handle navigation
  }, []);

  // v13.0.0: Cell-Isolated State Pattern (Industry Standard)
  // ─────────────────────────────────────────────────────────
  // DebouncedInput manages its own local state for instant UI feedback.
  // Value is passed directly to handleCellSave on blur/enter via valueOverride.
  // This eliminates ALL parent re-renders during typing (0 vs 2 per debounce).
  // (handleCellValueChange removed - was a NO-OP)

  // Handle cell save (Enter key or blur)
  // v13.0.0: valueOverride is REQUIRED - DebouncedInput always passes value directly
  const handleCellSave = useCallback((rowId: string, columnKey: string, record: T, valueOverride?: unknown) => {
    // v13.0.0: Cell-Isolated State Pattern - value comes from DebouncedInput via valueOverride
    // Fallback to editedData only for row-level edit mode (not cell-level)
    const valueToSave = valueOverride !== undefined ? valueOverride : editedData[columnKey];

    // Get original value for undo stack
    const formattedRecord = record as FormattedRow<any>;
    const rawRecord = formattedRecord.raw || record;
    const originalValue = (rawRecord as any)[columnKey];

    // Only save if value actually changed
    if (valueToSave !== originalValue) {
      // Push to undo stack
      setUndoStack(prev => [...prev.slice(-19), {
        rowId,
        columnKey,
        oldValue: originalValue,
        newValue: valueToSave,
        record
      }]);

      if (onCellSave) {
        // Parent-controlled mode
        onCellSave(rowId, columnKey, valueToSave, record);
      } else if (onSaveInlineEdit) {
        // Fallback to row-level save for compatibility
        // FIX: Update record with new value before saving
        // Add _changedField marker so parent knows which field changed (for stale editedData case)
        const updatedRecord = { ...rawRecord, [columnKey]: valueToSave, _changedField: columnKey, _changedValue: valueToSave };
        onSaveInlineEdit(updatedRecord as T);
      }
    }

    // Clear local editing state
    setLocalEditingCell(null);
  }, [editedData, onCellSave, onSaveInlineEdit]);

  // Handle cell cancel (Escape key)
  const handleCellCancel = useCallback(() => {
    if (editingCell === null && onCancelInlineEdit) {
      // Parent-controlled mode - let parent handle it
      onCancelInlineEdit();
    }

    // Clear local state
    setLocalEditingCell(null);
  }, [editingCell, onCancelInlineEdit]);

  // Handle keyboard events for cell editing
  // Note: Tab navigation requires processedColumns, so we move this function after it's defined
  // This placeholder will be replaced by the actual implementation below processedColumns

  // Note: handleRowKeyDown is defined after processedColumns (see below)
  // Note: Click-outside effect is defined after paginatedData (see below)

  // ============================================================================
  // v8.4.0: Undo handler (Cmd+Z / Ctrl+Z)
  // ============================================================================
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;

    const lastEdit = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));

    // Revert the value
    if (onCellSave) {
      onCellSave(lastEdit.rowId, lastEdit.columnKey, lastEdit.oldValue, lastEdit.record);
    } else if (onInlineEdit && onSaveInlineEdit) {
      onInlineEdit(lastEdit.rowId, lastEdit.columnKey, lastEdit.oldValue);
      // FIX: Update record with reverted value before saving
      const formattedRecord = lastEdit.record as FormattedRow<any>;
      const rawRecord = formattedRecord.raw || lastEdit.record;
      const revertedRecord = { ...rawRecord, [lastEdit.columnKey]: lastEdit.oldValue };
      onSaveInlineEdit(revertedRecord as T);
    }

    // Show notification
    setShowUndoNotification(true);
    setTimeout(() => setShowUndoNotification(false), 2000);
  }, [undoStack, onCellSave, onInlineEdit, onSaveInlineEdit]);

  // Global keyboard listener for Cmd+Z / Ctrl+Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle when not already editing a cell
      if (activeEditingCell) return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeEditingCell, handleUndo]);

  // ============================================================================
  // BACKEND METADATA-DRIVEN OPTIONS LOADING
  // ============================================================================
  // Uses backend metadata to determine which columns need datalabel options
  // v12.0.0: Zero frontend pattern detection - backend tells us via lookupSourceTable: 'datalabel'

  // ✅ FIX: Use useMemo for derived state instead of useState+useEffect
  // Compute labels metadata from columns and datalabels
  const labelsMetadata = useMemo(() => {
    const metadataMap = new Map<string, LabelMetadata[]>();

    if (!inlineEditable) {
      return metadataMap;
    }

    // First, add static options from column definitions
    columns.forEach(col => {
      if (col.options && col.options.length > 0) {
        metadataMap.set(col.key, col.options);
      }
    });

    // Find all columns that need dynamic settings using backend metadata
    // v12.0.0: Check lookupSourceTable === 'datalabel' or has lookupField
    const columnsNeedingSettings = columns.filter(col => {
      const backendMeta = (col as any).backendMetadata as BackendFieldMetadata | undefined;
      return backendMeta?.lookupSourceTable === 'datalabel' || backendMeta?.lookupField || col.lookupSourceTable === 'datalabel' || col.lookupField;
    });

    // Use datalabels from datalabelMetadataStore (populated by API response)
    columnsNeedingSettings.forEach((col) => {
      const backendMeta = (col as any).backendMetadata as BackendFieldMetadata | undefined;
      // v12.0.0: Get lookupField from backend metadata or column key
      const lookupField = backendMeta?.lookupField || col.lookupField || col.key;

      // Fetch from datalabelMetadataStore cache
      const cachedOptions = getDatalabelSync(lookupField);

      if (cachedOptions && cachedOptions.length > 0) {
        // Transform datalabel options to LabelMetadata format
        const options: LabelMetadata[] = cachedOptions
          .filter(opt => opt.active_flag !== false)
          .map((opt: any) => ({
            value: opt.name,  // Use name as value for datalabels
            label: opt.name,
            colorClass: colorCodeToTailwindClass(opt.color_code),  // ✅ Convert color_code to Tailwind classes
            metadata: {
              id: opt.id,
              descr: opt.descr,
              sort_order: opt.sort_order,
              active_flag: opt.active_flag
            }
          }));
        metadataMap.set(col.key, options);
      }
    });

    return metadataMap;
  }, [columns, inlineEditable]);

  // v13.0.0: Pre-transform options for BadgeDropdownSelect (avoids .map() in render loop)
  // This is memoized so it only recomputes when labelsMetadata changes
  const badgeDropdownOptionsMap = useMemo(() => {
    const optionsMap = new Map<string, Array<{ value: string | number; label: string; metadata: { color_code?: string } }>>();

    labelsMetadata.forEach((options, columnKey) => {
      optionsMap.set(columnKey, options.map(opt => ({
        value: opt.value,
        label: opt.label,
        metadata: { color_code: opt.colorClass }
      })));
    });

    return optionsMap;
  }, [labelsMetadata]);

  // v13.0.0: Colors are resolved at format time via formatDataset()
  // and stored in datalabelMetadataStore - no preloading needed
  // (preloadColors useEffect removed as it was a no-op)

  // Helper to get row key
  // v9.5.1: Handle FormattedRow structure where id is inside record.raw
  const getRowKey = (record: T, index: number): string => {
    if (typeof rowKey === 'function') {
      return rowKey(record);
    }
    // Check for FormattedRow structure (has raw property)
    const rawRecord = (record as any).raw || record;
    return rawRecord[rowKey] || index.toString();
  };

  // Calculate filtered and sorted data BEFORE using it
  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    if (filterable) {
      // Handle dropdown filters
      Object.entries(dropdownFilters).forEach(([key, selectedValues]) => {
        if (selectedValues.length > 0) {
          result = result.filter(record => {
            // Handle both FormattedRow and raw data
            let value: string;
            if (isFormattedData([record])) {
              // For formatted data, use raw value for filtering
              value = ((record as FormattedRow).raw as any)[key]?.toString();
            } else {
              // For raw data, use direct property
              value = (record as any)[key]?.toString();
            }
            return selectedValues.includes(value);
          });
        }
      });
    }

    if (sortField) {
      result.sort((a, b) => {
        const aValue = (a as any)[sortField];
        const bValue = (b as any)[sortField];

        if (aValue === bValue) return 0;

        const comparison = aValue < bValue ? -1 : 1;
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [data, dropdownFilters, sortField, sortDirection, filterable]);

  // Client-side pagination: Slice data for current page to avoid rendering all rows
  // This dramatically improves performance when loading large datasets (1000+ rows)
  const paginatedData = useMemo(() => {
    if (!pagination) return filteredAndSortedData;

    const { current, pageSize } = pagination;
    const startIndex = (current - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredAndSortedData.slice(startIndex, endIndex);
  }, [filteredAndSortedData, pagination]);

  // ============================================================================
  // v14.3.0: MULTI-SELECT - Handlers (after paginatedData is defined)
  // ============================================================================
  // Toggle selection for a row (Ctrl+Click or Cmd+Click on Mac)
  // Also sets this row as the anchor for subsequent shift-selections
  const toggleRowSelection = useCallback((rowId: string, rowIndex: number) => {
    if (!selectable) return;
    const newSelection = effectiveSelectedRows.includes(rowId)
      ? effectiveSelectedRows.filter(id => id !== rowId)
      : [...effectiveSelectedRows, rowId];
    setEffectiveSelectedRows(newSelection);
    // Set anchor for shift-selection
    setSelectionAnchorIndex(rowIndex);
  }, [selectable, effectiveSelectedRows, setEffectiveSelectedRows]);

  // Select range from anchor to target index (Shift+Arrow)
  // This replaces the range selection, allowing deselection when reversing direction
  const selectRangeFromAnchor = useCallback((targetIndex: number) => {
    if (!selectable) return;

    // If no anchor, use current target as anchor
    const anchor = selectionAnchorIndex ?? targetIndex;
    const start = Math.min(anchor, targetIndex);
    const end = Math.max(anchor, targetIndex);

    // Build the new selection: only rows in the range from anchor to target
    const rangeRowIds: string[] = [];
    for (let i = start; i <= end; i++) {
      if (paginatedData[i]) {
        rangeRowIds.push(getRowKey(paginatedData[i], i));
      }
    }

    // Replace selection with just the range (allows deselection on reverse)
    setEffectiveSelectedRows(rangeRowIds);
  }, [selectable, selectionAnchorIndex, paginatedData, getRowKey, setEffectiveSelectedRows]);

  // Check if row is selected
  const isRowSelected = useCallback((rowId: string) => {
    return selectable && effectiveSelectedRows.includes(rowId);
  }, [selectable, effectiveSelectedRows]);

  // ============================================================================
  // VIRTUALIZATION - Always enabled for consistent rendering
  // ============================================================================
  // Uses @tanstack/react-virtual to render only rows in the viewport
  // v14.5.0: Always virtualize - single code path for simplicity
  // v13.1.0: Increased overscan to 10 for smoother fast scrolling (prevents blank gaps)
  const OVERSCAN_COUNT = 10;

  // Row virtualizer - always active
  const rowVirtualizer = useVirtualizer({
    count: paginatedData.length,
    getScrollElement: () => tableContainerRef.current,
    // v14.1.0: Use density-based row height
    estimateSize: useCallback(() => densitySettings.rowHeight, [densitySettings.rowHeight]),
    overscan: OVERSCAN_COUNT,
    // Stable keys improve React reconciliation performance
    getItemKey: useCallback((index: number) => {
      const record = paginatedData[index];
      return record ? getRowKey(record, index) : `row-${index}`;
    }, [paginatedData]),
  });

  // Helper to get row className for virtualized rows
  // v14.5.0: Simplified - always virtualized
  // v14.3.0: Added isSelected param for multi-select visual feedback
  // Base bg-dark-surface ensures Tailwind hover works (no inline backgroundColor)
  const getRowClassName = useCallback((isDragging: boolean, isDragOver: boolean, isEditing: boolean, isSelected: boolean = false) => {
    return `group transition-all duration-200 ease-out bg-dark-surface ${
      isSelected
        ? '!bg-blue-50 ring-1 ring-inset ring-blue-200 [&_td]:!bg-blue-50'  // Selection highlight
        : ''
    } ${
      isDragging
        ? 'opacity-60 scale-[0.99] !bg-dark-active shadow-sm'
        : isDragOver
          ? '!bg-dark-hover shadow-inner'
          : ''
    } ${
      isEditing
        ? '!bg-blue-50/30 shadow-inner'
        : allowReordering && !isEditing
          ? 'cursor-move hover:bg-dark-hover'
          : onRowClick || selectable
            ? 'cursor-pointer hover:bg-dark-hover'
            : 'hover:bg-dark-hover'
    }`;
  }, [allowReordering, onRowClick, selectable]);

  // ============================================================================
  // v8.4.0: Click outside to save and close (moved here after paginatedData)
  // ============================================================================
  useEffect(() => {
    if (!activeEditingCell) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Skip if click is inside the editing cell
      if (editingCellRef.current?.contains(target)) return;

      // Skip if click is inside a portal dropdown (data-dropdown-portal marker)
      if (target.closest?.('[data-dropdown-portal]')) return;

      // Click is truly outside - save and close
      const record = paginatedData.find((r, idx) => getRowKey(r, idx) === activeEditingCell.rowId);
      if (record) {
        handleCellSave(activeEditingCell.rowId, activeEditingCell.columnKey, record);
      } else {
        handleCellCancel();
      }
    };

    // Delay adding listener to avoid immediate trigger
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeEditingCell, paginatedData, getRowKey, handleCellSave, handleCellCancel]);

  // v9.4.2: Memoized column options to prevent recalculation on every render
  // Get unique values for each filterable column - CACHE-AWARE
  const getColumnOptions = useCallback((columnKey: string): string[] => {
    // Find column metadata to check if it's a datalabel field
    const column = columns.find(col => col.key === columnKey);
    const backendMeta = (column as any)?.backendMetadata as BackendFieldMetadata | undefined;
    // v12.0.0: Check lookupSourceTable and lookupField
    const isSettingsField = backendMeta?.lookupSourceTable === 'datalabel' || backendMeta?.lookupField || column?.lookupSourceTable === 'datalabel' || column?.lookupField || columnKey.startsWith('dl__');

    // If it's a settings field, fetch options from datalabelMetadataStore cache
    if (isSettingsField) {
      // v12.0.0: Use lookupField instead of settingsDatalabel
      const datalabel = backendMeta?.lookupField || column?.lookupField || extractSettingsDatalabel(columnKey);
      const cachedOptions = getDatalabelSync(datalabel);

      if (cachedOptions && cachedOptions.length > 0) {
        // Return cached datalabel options (already sorted by sort_order in cache)
        return cachedOptions
          .filter(opt => opt.active_flag !== false)
          .map(opt => opt.name);
      }
    }

    // For entity reference fields (e.g., manager__employee_id), could fetch from entity lookup
    // TODO: Implement entity lookup cache integration for reference fields

    // Fallback: Get unique values from current data
    const uniqueValues = new Set<string>();
    data.forEach(record => {
      // Handle both FormattedRow and raw data
      let value: any;
      if (isFormattedData([record])) {
        // For formatted data, use raw value
        value = ((record as FormattedRow).raw as any)[columnKey];
      } else {
        // For raw data, use direct property
        value = (record as any)[columnKey];
      }

      if (value != null && value !== '') {
        uniqueValues.add(value.toString());
      }
    });
    return Array.from(uniqueValues).sort();
  }, [columns, data]);

  // v9.4.2: Memoized filtered options - avoids recalculating on every render
  // Uses debouncedFilterSearchTerm to prevent lag during typing
  const filteredColumnOptions = useMemo(() => {
    if (!selectedFilterColumn) return [];
    const options = getColumnOptions(selectedFilterColumn);
    if (!debouncedFilterSearchTerm) return options;
    return options.filter(option =>
      option.toLowerCase().includes(debouncedFilterSearchTerm.toLowerCase())
    );
  }, [selectedFilterColumn, getColumnOptions, debouncedFilterSearchTerm]);

  // Handle clicking outside dropdowns to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close filter dropdown
      if (filterContainerRef.current && !filterContainerRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }

      // Close column selector dropdown
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target as Node)) {
        setShowColumnSelector(false);
      }
    };

    if (showFilterDropdown || showColumnSelector) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showFilterDropdown, showColumnSelector]);

  // Create default actions if needed
  // NOTE: View action removed - row clicks already navigate to detail view
  const defaultActions: RowAction<T>[] = useMemo(() => {
    const actions: RowAction<T>[] = [];

    if (onEdit) {
      actions.push({
        key: 'edit',
        label: 'Edit',
        icon: <Edit className="h-4 w-4" />,
        onClick: onEdit,
        variant: 'primary'});
    }

    if (onShare) {
      actions.push({
        key: 'share',
        label: 'Share',
        icon: <Share className="h-4 w-4" />,
        onClick: onShare,
        variant: 'default'});
    }

    if (onDelete) {
      actions.push({
        key: 'delete',
        label: 'Delete',
        icon: <Trash2 className="h-4 w-4" />,
        onClick: onDelete,
        variant: 'danger'});
    }

    return actions;
  }, [onEdit, onShare, onDelete]);

  const allActions = useMemo(() => {
    return showDefaultActions ? [...defaultActions, ...rowActions] : rowActions;
  }, [defaultActions, rowActions, showDefaultActions]);

  const processedColumns = useMemo(() => {
    let filteredColumns = columns.filter(col => visibleColumns.has(col.key));

    // Add actions column if there are any actions
    // v14.1.0: Reduced width for compact density icons
    if (allActions.length > 0) {
      const actionsColumn: Column<T> = {
        key: '_actions',
        title: '',  // No header text for cleaner look
        width: allActions.length > 3 ? 100 : allActions.length * 32,
        align: 'center',
      };

      filteredColumns = [...filteredColumns, actionsColumn];
    }

    return filteredColumns;
  }, [columns, visibleColumns, allActions]);

  // ============================================================================
  // PRE-COMPUTED STYLES - Performance optimization for virtualization
  // ============================================================================
  // Pre-compute column styles (O(1) lookup vs O(n) calculation on every render)
  // Dramatically reduces style object creation during scroll
  const columnStylesMap = useMemo(() => {
    const map = new Map<string, React.CSSProperties>();
    processedColumns.forEach((col, idx) => {
      // Actions column has different styling
      if (col.key === '_actions') {
        map.set(col.key, {
          textAlign: (col.align || 'center') as any,
          boxSizing: 'border-box',
          width: col.width || 'auto',
          minWidth: col.width || '80px',
        });
        return;
      }

      // Data columns: Base styles for all cells
      const baseStyle: React.CSSProperties = {
        textAlign: (col.align || 'left') as any,
        boxSizing: 'border-box',
      };

      // v14.6.0: Always respect backend-specified widths
      // When column has explicit width from metadata, use it; otherwise use defaults
      if (col.width) {
        baseStyle.width = col.width;
        baseStyle.minWidth = col.width;
      } else if (processedColumns.length > 7) {
        // Fallback for columns without specified width
        baseStyle.width = '150px';
        baseStyle.minWidth = '150px';
      } else {
        baseStyle.width = 'auto';
        baseStyle.minWidth = '80px';
        baseStyle.flex = '1';
      }

      map.set(col.key, baseStyle);
    });
    return map;
  }, [processedColumns]);

  // Pre-compute cell className for sticky first column
  // v13.1.0: Updated to use white background for clean look
  const getStickyClassName = useCallback((colIndex: number) => {
    return colIndex === 0 ? 'sticky left-0 z-20 bg-dark-surface shadow-r' : '';
  }, []);

  // ============================================================================
  // v8.4.0: Keyboard handler for row-level shortcuts (E to edit)
  // v14.3.0: Added Shift+Arrow for multi-select with anchor-based range
  // Defined here after processedColumns is available
  // ============================================================================
  const handleRowKeyDown = useCallback((
    e: React.KeyboardEvent,
    rowId: string,
    record: T,
    rowIndex: number
  ) => {
    // v14.3.0: Shift+Arrow for range selection from anchor (standard spreadsheet pattern)
    if (selectable && e.shiftKey && !e.ctrlKey && !e.metaKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const newIndex = e.key === 'ArrowUp'
        ? Math.max(0, rowIndex - 1)
        : Math.min(paginatedData.length - 1, rowIndex + 1);

      if (newIndex !== rowIndex) {
        // Select range from anchor to new index (replaces selection, allows deselect on reverse)
        selectRangeFromAnchor(newIndex);
        setFocusedRowIndex(newIndex);

        // Focus the new row for continued keyboard navigation
        const newRowId = getRowKey(paginatedData[newIndex], newIndex);
        const newRowElement = document.querySelector(`[data-row-id="${newRowId}"]`) as HTMLElement;
        newRowElement?.focus();
      }
      return;
    }

    // Plain Arrow keys for navigation (update focused index)
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const newIndex = e.key === 'ArrowUp'
        ? Math.max(0, rowIndex - 1)
        : Math.min(paginatedData.length - 1, rowIndex + 1);

      if (newIndex !== rowIndex) {
        e.preventDefault();
        setFocusedRowIndex(newIndex);

        // Focus the new row
        const newRowId = getRowKey(paginatedData[newIndex], newIndex);
        const newRowElement = document.querySelector(`[data-row-id="${newRowId}"]`) as HTMLElement;
        newRowElement?.focus();
      }
      return;
    }

    // E to enter edit mode (edit first editable column)
    if (e.key === 'e' || e.key === 'E') {
      if (!activeEditingCell && inlineEditable) {
        e.preventDefault();
        // Find first editable column
        const firstEditableColumn = processedColumns.find(col => {
          if (col.key === '_actions') return false;
          const backendMeta = (col as any).backendMetadata as BackendFieldMetadata | undefined;
          return backendMeta?.editable ?? col.editable ?? false;
        });

        if (firstEditableColumn) {
          const formattedRecord = record as FormattedRow<any>;
          const rawRecord = formattedRecord.raw || record;
          const rawValue = (rawRecord as any)[firstEditableColumn.key];

          // v13.0.0: DebouncedInput manages its own local state
          setLocalEditingCell({ rowId, columnKey: firstEditableColumn.key });
          if (onInlineEdit) {
            onInlineEdit(rowId, firstEditableColumn.key, rawValue);
          }
        }
      }
    }

    // v14.3.0: Delete key triggers batch delete for selected rows
    if (e.key === 'Delete' || e.key === 'Backspace') {
      // Only trigger if not editing and we have selected rows
      if (!activeEditingCell && onBatchDelete && effectiveSelectedRows.length > 0) {
        e.preventDefault();
        onBatchDelete(effectiveSelectedRows);
      }
    }
  }, [activeEditingCell, inlineEditable, processedColumns, onInlineEdit, selectable, paginatedData, selectRangeFromAnchor, getRowKey, onBatchDelete, effectiveSelectedRows]);

  // ============================================================================
  // v8.4.0: Tab Navigation - Find next/previous editable cell
  // ============================================================================
  const findNextEditableCell = useCallback((
    currentRowId: string,
    currentColumnKey: string,
    reverse: boolean = false
  ): { rowId: string; columnKey: string; record: T } | null => {
    // Get editable columns
    const editableColumns = processedColumns.filter(col => {
      if (col.key === '_actions') return false;
      const backendMeta = (col as any).backendMetadata as BackendFieldMetadata | undefined;
      return backendMeta?.editable ?? col.editable ?? false;
    });

    if (editableColumns.length === 0) return null;

    // Find current position
    const currentColIndex = editableColumns.findIndex(col => col.key === currentColumnKey);
    const currentRowIndex = paginatedData.findIndex((r, idx) => getRowKey(r, idx) === currentRowId);

    if (currentRowIndex === -1) return null;

    let nextColIndex = reverse ? currentColIndex - 1 : currentColIndex + 1;
    let nextRowIndex = currentRowIndex;

    // If past end of row, go to next row
    if (nextColIndex >= editableColumns.length) {
      nextColIndex = 0;
      nextRowIndex = currentRowIndex + 1;
    }
    // If before start of row, go to previous row
    if (nextColIndex < 0) {
      nextColIndex = editableColumns.length - 1;
      nextRowIndex = currentRowIndex - 1;
    }

    // If no more rows, return null
    if (nextRowIndex < 0 || nextRowIndex >= paginatedData.length) {
      return null;
    }

    const nextRecord = paginatedData[nextRowIndex];
    const nextRowId = getRowKey(nextRecord, nextRowIndex);
    const nextColumnKey = editableColumns[nextColIndex].key;

    return { rowId: nextRowId, columnKey: nextColumnKey, record: nextRecord };
  }, [processedColumns, paginatedData, getRowKey]);

  // Handle keyboard events for cell editing (with Tab navigation)
  const handleCellKeyDown = useCallback((
    e: React.KeyboardEvent,
    rowId: string,
    columnKey: string,
    record: T,
    editType: string
  ) => {
    // Enter to save (except for textarea)
    if (e.key === 'Enter' && editType !== 'textarea') {
      e.preventDefault();
      handleCellSave(rowId, columnKey, record);
      return;
    }

    // Escape to cancel
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCellCancel();
      return;
    }

    // Tab to save and move to next editable cell (Shift+Tab for previous)
    // v13.0.0: DebouncedInput's onBlur fires before Tab handler, so value is already saved
    if (e.key === 'Tab') {
      e.preventDefault();

      // Find next editable cell
      const nextCell = findNextEditableCell(rowId, columnKey, e.shiftKey);
      if (nextCell) {
        // Start editing next cell - v13.0.0: DebouncedInput manages its own value
        setLocalEditingCell({ rowId: nextCell.rowId, columnKey: nextCell.columnKey });
      } else {
        // No more cells, just close editing
        setLocalEditingCell(null);
      }
      return;
    }
  }, [handleCellSave, handleCellCancel, findNextEditableCell]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };


  const handleDropdownFilter = (columnKey: string, value: string, checked: boolean) => {
    setDropdownFilters(prev => {
      const currentValues = prev[columnKey] || [];
      if (checked) {
        return { ...prev, [columnKey]: [...currentValues, value] };
      } else {
        return { ...prev, [columnKey]: currentValues.filter(v => v !== value) };
      }
    });
  };

  const removeFilterChip = (columnKey: string, value: string) => {
    setDropdownFilters(prev => {
      const currentValues = prev[columnKey] || [];
      const newValues = currentValues.filter(v => v !== value);
      if (newValues.length === 0) {
        const { [columnKey]: removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [columnKey]: newValues };
    });
  };

  const getColumnTitle = (columnKey: string) => {
    return columns.find(col => col.key === columnKey)?.title || columnKey;
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (!allowReordering) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (!allowReordering || draggedIndex === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (index !== dragOverIndex) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    if (!allowReordering) return;
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    if (!allowReordering || draggedIndex === null) return;
    e.preventDefault();

    if (draggedIndex !== dropIndex) {
      // Work with filteredAndSortedData since that's what the user sees
      // and what the indices correspond to
      const newData = [...filteredAndSortedData];
      const draggedItem = newData[draggedIndex];

      // Remove from old position
      newData.splice(draggedIndex, 1);

      // Insert at new position
      newData.splice(dropIndex, 0, draggedItem);

      // Call the onReorder callback with reordered data
      onReorder?.(newData);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    if (!allowReordering) return;
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Scroll synchronization handlers (monday.com style bottom scrollbar)
  const handleTableScroll = useCallback(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    // Horizontal scroll sync for bottom scrollbar
    if (bottomScrollbarRef.current) {
      bottomScrollbarRef.current.scrollLeft = container.scrollLeft;

      // Update scroll progress indicator
      const scrollLeft = container.scrollLeft;
      const scrollWidth = container.scrollWidth;
      const clientWidth = container.clientWidth;
      const maxScroll = scrollWidth - clientWidth;
      const progress = maxScroll > 0 ? (scrollLeft / maxScroll) * 100 : 0;
      setScrollProgress(progress);
    }
  }, []);

  const handleBottomScroll = () => {
    if (tableContainerRef.current && bottomScrollbarRef.current) {
      tableContainerRef.current.scrollLeft = bottomScrollbarRef.current.scrollLeft;

      // Update scroll progress indicator
      const scrollLeft = bottomScrollbarRef.current.scrollLeft;
      const scrollWidth = tableContainerRef.current.scrollWidth;
      const clientWidth = tableContainerRef.current.clientWidth;
      const maxScroll = scrollWidth - clientWidth;
      const progress = maxScroll > 0 ? (scrollLeft / maxScroll) * 100 : 0;
      setScrollProgress(progress);
    }
  };

  // Update bottom scrollbar position and width (monday.com style)
  useEffect(() => {
    const updateBottomScrollbar = () => {
      if (!tableContainerRef.current) {
        setScrollbarStyles(prev => {
          if (!prev.visible && prev.left === 0 && prev.width === 0) return prev;
          return { left: 0, width: 0, visible: false };
        });
        return;
      }

      const tableRect = tableContainerRef.current.getBoundingClientRect();
      const tableScrollWidth = tableContainerRef.current.scrollWidth;
      const tableClientWidth = tableContainerRef.current.clientWidth;

      // Only show scrollbar if:
      // 1. Content overflows horizontally
      // 2. Table is visible in viewport
      const isVisible = tableScrollWidth > tableClientWidth && tableRect.top < window.innerHeight;
      const newLeft = Math.max(0, tableRect.left);
      const newWidth = tableClientWidth;

      // Update scrollbar content width
      if (bottomScrollbarRef.current) {
        const scrollbarContent = bottomScrollbarRef.current.querySelector('.scrollbar-content') as HTMLDivElement;
        if (scrollbarContent) {
          scrollbarContent.style.width = `${tableScrollWidth}px`;
        }
      }

      // Only update state if values have changed (prevent infinite loop)
      setScrollbarStyles(prev => {
        if (
          prev.left === newLeft &&
          prev.width === newWidth &&
          prev.visible === isVisible
        ) {
          return prev; // No change, return same object to prevent re-render
        }
        return {
          left: newLeft,
          width: newWidth,
          visible: isVisible};
      });
    };

    // Initial update
    updateBottomScrollbar();

    // Update on various events (passive listeners for better scroll performance)
    window.addEventListener('resize', updateBottomScrollbar, { passive: true });
    window.addEventListener('scroll', updateBottomScrollbar, { capture: true, passive: true });

    // Use ResizeObserver to detect table size changes
    const resizeObserver = new ResizeObserver(updateBottomScrollbar);
    if (tableContainerRef.current) {
      resizeObserver.observe(tableContainerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateBottomScrollbar);
      window.removeEventListener('scroll', updateBottomScrollbar, { capture: true } as any);
      resizeObserver.disconnect();
    };
  }, [data.length, columns.length]); // Only re-run when data or column count changes

  // Add row handlers
  // v11.0.0: handleStartAddRow triggers parent's onAddRow callback
  // Parent is responsible for adding the new row to their data array
  const handleStartAddRow = () => {
    if (onAddRow) {
      const tempId = `temp_${Date.now()}`;
      onAddRow({ id: tempId, _isNew: true } as Partial<T>);
    }
  };

  // v11.5.0: Scroll to top when adding new row (row appears at top, must be visible)
  useEffect(() => {
    if (editingRow?.startsWith('temp_') && tableContainerRef.current) {
      // Scroll to top to show the new row
      tableContainerRef.current.scrollTop = 0;
    }
  }, [editingRow]);

  const toggleColumnVisibility = (key: string) => {
    setVisibleColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const renderSortIcon = (field: string) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ?
      <ChevronUp className="h-4 w-4" /> :
      <ChevronDown className="h-4 w-4" />;
  };

  // v14.6.0: PaginationComponent removed - pagination now inline in unified footer

  if (loading) {
    return (
      <div className="bg-dark-surface rounded-xl shadow-sm border border-dark-200">
        <div className="flex items-center justify-center py-12 bg-gradient-to-b from-dark-subtle/50 to-white">
          <EllipsisBounce size="lg" text="Processing" />
        </div>
      </div>
    );
  }

  // ============================================================================
  // v13.1.0: ENHANCED VISUAL HIERARCHY (dark-* palette)
  // ============================================================================
  // Design Principles:
  // - Clean white surface for data clarity (bg-dark-surface)
  // - Consistent dark-* palette matching Layout (border-dark-200)
  // - Gradient toolbar for visual depth (from-dark-subtle to-white)
  // - Soft shadows for elevation (shadow-sm)
  // ============================================================================
  // v14.2.0: Modern minimal container with very light border
  return (
    <div className={`bg-dark-surface rounded-xl shadow-sm border border-dark-border-subtle overflow-hidden flex flex-col h-full ${className}`}>
      {(filterable || columnSelection) && (
        <div className="px-4 py-2.5 bg-dark-surface border-b border-dark-border-subtle">
          {filterable && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="flex items-center text-sm text-dark-600">
                  <Filter className="h-4 w-4 text-dark-500 stroke-[1.5] mr-2" />
                  <span className="font-normal text-sm text-dark-600">Filter by:</span>
                </div>

                {/* v13.1.0: Updated filter controls to dark-* palette */}
                <div className="relative">
                  <select
                    value={selectedFilterColumn}
                    onChange={(e) => setSelectedFilterColumn(e.target.value)}
                    className="appearance-none px-4 py-1.5 pr-10 w-48 border border-dark-300 rounded-lg text-sm bg-dark-surface hover:border-dark-400 focus:ring-2 focus:ring-dark-accent-ring focus:border-dark-400 transition-all duration-200 shadow-sm font-normal text-dark-700"
                  >
                    <option value="" className="text-dark-500">Select column...</option>
                    {columns.filter(col => col.filterable).map(column => (
                      <option key={column.key} value={column.key}>
                        {column.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="h-4 w-4 text-dark-500 absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                </div>

                {selectedFilterColumn && (
                  <div className="relative" ref={filterContainerRef}>
                    <div className="relative">
                      <Search className="h-4 w-4 text-dark-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Type to filter values..."
                        value={filterSearchTerm}
                        onChange={(e) => {
                          setFilterSearchTerm(e.target.value);
                          setShowFilterDropdown(true);
                        }}
                        onFocus={() => setShowFilterDropdown(true)}
                        className="pl-10 pr-4 py-1.5 w-64 border border-dark-300 rounded-lg text-sm bg-dark-surface focus:ring-2 focus:ring-dark-accent-ring focus:border-dark-400 transition-all duration-200 text-dark-700 placeholder:text-dark-400"
                      />
                    </div>

                    {showFilterDropdown && (
                      <div className="absolute top-full left-0 mt-2 w-80 bg-dark-surface border border-dark-200 rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto">
                        <div className="p-2">
                          {/* v9.4.2: Use memoized filteredColumnOptions for performance */}
                          {filteredColumnOptions.map((option) => {
                              // Check if this column has settings options loaded using backend metadata
                              const selectedColumn = columns.find(col => col.key === selectedFilterColumn);
                              const backendMeta = (selectedColumn as any)?.backendMetadata as BackendFieldMetadata | undefined;
                              // v12.0.0: Check lookupSourceTable and lookupField
                              const isSettingsField = backendMeta?.lookupSourceTable === 'datalabel' || backendMeta?.lookupField || selectedColumn?.lookupSourceTable === 'datalabel' || selectedColumn?.lookupField;

                              // If this is a settings field, look up the color from datalabelMetadataStore
                              let colorCode: string | undefined;
                              if (isSettingsField) {
                                // v12.0.0: Use lookupField instead of settingsDatalabel
                                const datalabel = backendMeta?.lookupField || selectedColumn?.lookupField || extractSettingsDatalabel(selectedFilterColumn);
                                const options = getDatalabelSync(datalabel);
                                const match = options?.find(opt => opt.name === option);
                                colorCode = match?.color_code;
                              }

                              // v9.4.2: Check if option is currently selected
                              const isChecked = (dropdownFilters[selectedFilterColumn] || []).includes(option);

                              return (
                                <label
                                  key={option}
                                  className="flex items-center px-3 py-2 hover:bg-dark-hover rounded-lg cursor-pointer transition-colors group"
                                  onClick={(e) => {
                                    // Only handle if click was NOT on the checkbox itself
                                    if ((e.target as HTMLElement).tagName !== 'INPUT') {
                                      e.preventDefault();
                                      handleDropdownFilter(selectedFilterColumn, option, !isChecked);
                                    }
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      handleDropdownFilter(selectedFilterColumn, option, !isChecked);
                                    }}
                                    className="mr-3 text-dark-600 rounded focus:ring-dark-accent-ring focus:ring-offset-0 flex-shrink-0"
                                  />
                                  <div className="flex-1 min-w-0">
                                    {isSettingsField ? (
                                      // Settings field - always render badge (with or without color)
                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorCode || 'bg-dark-100 text-dark-600'}`}>
                                        {option}
                                      </span>
                                    ) : (
                                      // Non-settings field - render text
                                      <span className="text-sm text-dark-700 truncate">{option}</span>
                                    )}
                                  </div>
                                </label>
                              );
                            })
                          }
                          {filteredColumnOptions.length === 0 && (
                            <div className="px-2 py-1.5 text-xs text-dark-500 text-center">
                              No options found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {Object.keys(dropdownFilters).length > 0 && (
                  <button
                    onClick={() => {
                      setDropdownFilters({});
                      setSelectedFilterColumn('');
                      setFilterSearchTerm('');
                      setShowFilterDropdown(false);
                    }}
                    className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* v14.1.0: Density toggle - compact/regular/relaxed */}
                {onDensityChange && (
                  <div className="flex items-center border border-dark-border-default rounded-lg overflow-hidden">
                    <button
                      onClick={() => onDensityChange('compact')}
                      className={`p-1.5 transition-colors ${density === 'compact' ? 'bg-dark-active text-dark-text-primary' : 'text-dark-text-placeholder hover:text-dark-text-secondary hover:bg-dark-hover'}`}
                      title="Compact density"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onDensityChange('regular')}
                      className={`p-1.5 transition-colors ${density === 'regular' ? 'bg-dark-active text-dark-text-primary' : 'text-dark-text-placeholder hover:text-dark-text-secondary hover:bg-dark-hover'}`}
                      title="Regular density"
                    >
                      <Menu className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onDensityChange('relaxed')}
                      className={`p-1.5 transition-colors ${density === 'relaxed' ? 'bg-dark-active text-dark-text-primary' : 'text-dark-text-placeholder hover:text-dark-text-secondary hover:bg-dark-hover'}`}
                      title="Relaxed density"
                    >
                      <AlignJustify className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* v13.1.0: Column selector with slate palette */}
                {columnSelection && (
                  <div className="relative" ref={columnSelectorRef}>
                    <button
                      onClick={() => setShowColumnSelector(!showColumnSelector)}
                      className="flex items-center px-3 py-1.5 text-sm text-dark-text-secondary border border-dark-border-default rounded-lg hover:bg-dark-hover hover:border-dark-border-medium transition-colors"
                    >
                      <Columns className="h-4 w-4 mr-2 stroke-[1.5]" />
                      Columns
                    </button>

                    {showColumnSelector && (
                      <div className="absolute right-0 mt-2 w-56 bg-dark-surface border border-dark-border-default rounded-xl shadow-lg z-50">
                        <div className="p-2">
                          <div className="text-sm font-medium text-dark-text-primary mb-2 px-1">Show Columns</div>
                          {columns.filter(column => column.visible !== false).map(column => (
                            <label key={column.key} className="flex items-center px-3 py-1.5 hover:bg-dark-hover rounded-lg cursor-pointer transition-colors">
                              <input
                                type="checkbox"
                                checked={visibleColumns.has(column.key)}
                                onChange={() => toggleColumnVisibility(column.key)}
                                className="mr-3 text-dark-text-secondary rounded focus:ring-dark-accent-ring"
                              />
                              <span className="text-sm text-dark-text-primary">{column.title}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {!filterable && columnSelection && (
            <div className="flex items-center justify-end gap-2">
              {/* v14.1.0: Density toggle */}
              {onDensityChange && (
                <div className="flex items-center border border-dark-border-default rounded-lg overflow-hidden">
                  <button
                    onClick={() => onDensityChange('compact')}
                    className={`p-1.5 transition-colors ${density === 'compact' ? 'bg-dark-active text-dark-text-primary' : 'text-dark-text-placeholder hover:text-dark-text-secondary hover:bg-dark-hover'}`}
                    title="Compact density"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onDensityChange('regular')}
                    className={`p-1.5 transition-colors ${density === 'regular' ? 'bg-dark-active text-dark-text-primary' : 'text-dark-text-placeholder hover:text-dark-text-secondary hover:bg-dark-hover'}`}
                    title="Regular density"
                  >
                    <Menu className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onDensityChange('relaxed')}
                    className={`p-1.5 transition-colors ${density === 'relaxed' ? 'bg-dark-active text-dark-text-primary' : 'text-dark-text-placeholder hover:text-dark-text-secondary hover:bg-dark-hover'}`}
                    title="Relaxed density"
                  >
                    <AlignJustify className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div className="relative" ref={columnSelectorRef}>
                <button
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className="flex items-center px-3 py-1.5 text-sm text-dark-text-secondary border border-dark-border-default rounded-lg hover:bg-dark-hover hover:border-dark-border-medium transition-colors"
                >
                  <Columns className="h-4 w-4 mr-2 stroke-[1.5]" />
                  Columns
                </button>

                {showColumnSelector && (
                  <div className="absolute right-0 mt-2 w-56 bg-dark-surface border border-dark-border-default rounded-xl shadow-lg z-50">
                    <div className="p-2">
                      <div className="text-sm font-medium text-dark-text-primary mb-2 px-1">Show Columns</div>
                      {columns.filter(column => column.visible !== false).map(column => (
                        <label key={column.key} className="flex items-center px-3 py-1.5 hover:bg-dark-hover rounded-lg cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={visibleColumns.has(column.key)}
                            onChange={() => toggleColumnVisibility(column.key)}
                            className="mr-3 text-dark-text-secondary rounded focus:ring-dark-accent-ring"
                          />
                          <span className="text-sm text-dark-text-primary">{column.title}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Filter Chips - v13.1.0: Subtle slate border for consistency */}
          {Object.keys(dropdownFilters).length > 0 && (
            <div className="mt-3 pt-3 border-t border-dark-200/60">
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-xs text-dark-600 font-medium">Active filters:</span>
                {Object.entries(dropdownFilters).map(([columnKey, values]) =>
                  values.map((value) => {
                    // Check if this column is a settings field using backend metadata
                    const column = columns.find(col => col.key === columnKey);
                    const backendMeta = (column as any)?.backendMetadata as BackendFieldMetadata | undefined;
                    // v12.0.0: Check lookupSourceTable and lookupField
                    const isSettingsField = backendMeta?.lookupSourceTable === 'datalabel' || backendMeta?.lookupField || column?.lookupSourceTable === 'datalabel' || column?.lookupField;

                    // If this is a settings field, look up the color from centralized cache
                    let colorCode: string | undefined;
                    if (isSettingsField) {
                      // v12.0.0: Use lookupField instead of settingsDatalabel
                      const datalabel = backendMeta?.lookupField || column?.lookupField || extractSettingsDatalabel(columnKey);
                      const options = getDatalabelSync(datalabel);
                      const match = options?.find(opt => opt.name === value);
                      colorCode = match?.color_code;
                    }

                    // v13.1.0: Use slate fallback for uncolored chips
                    const chipColorClass = colorCode ? colorCodeToTailwindClass(colorCode) : 'bg-dark-100 text-dark-700';

                    // v9.8.0: Use reusable Chip component
                    return (
                      <Chip
                        key={`${columnKey}-${value}`}
                        label={value}
                        prefix={`${getColumnTitle(columnKey)}:`}
                        colorClass={chipColorClass}
                        size="md"
                        maxWidth="128px"
                        removable
                        onRemove={() => removeFilterChip(columnKey, value)}
                      />
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* flex-1 allows table to fill available space; min-h-[400px] ensures minimum visibility */}
      {/* Parent must provide height constraints (h-full, flex-1 min-h-0, or explicit height) */}
      <div className="relative flex flex-col flex-1 min-h-[400px]">
        <div
          ref={tableContainerRef}
          className="overflow-y-auto overflow-x-auto scrollbar-elegant flex-1 min-h-0"
          onScroll={handleTableScroll}
        >
          <table
            className="w-full"
            style={{
              // v14.6.0: Calculate minWidth from actual column widths (sum of specified + 150px default)
              minWidth: processedColumns.length > 7
                ? `${processedColumns.reduce((sum, col) => {
                    const w = col.width;
                    if (typeof w === 'string') return sum + parseInt(w, 10) || 150;
                    if (typeof w === 'number') return sum + w;
                    return sum + 150;
                  }, 0)}px`
                : '100%',
              tableLayout: processedColumns.length <= 7 ? 'auto' : 'fixed'
            }}
          >
            {/* v14.2.0: Minimal header - clean white with very subtle bottom border */}
            {/* v14.5.0: Always use flexbox layout (virtualization always on) */}
            <thead
              className="bg-dark-subtle border-b border-dark-border-subtle sticky top-0 z-30"
              style={{ display: 'block' }}
            >
              <tr style={{ display: 'flex', width: '100%' }}>
                {processedColumns.map((column, index) => (
                  <th
                    key={column.key}
                    className={`${densitySettings.headerPadding} text-left ${
                      column.sortable ? 'cursor-pointer hover:bg-dark-hover transition-colors' : ''
                    } ${
                      index === 0 ? 'sticky left-0 z-40 bg-dark-surface' : ''
                    } flex-shrink-0`}
                    style={{
                      // v14.6.0: Respect backend-specified widths
                      width: column.width || (processedColumns.length > 7 ? '150px' : 'auto'),
                      minWidth: column.width || (processedColumns.length > 7 ? '150px' : '80px'),
                      boxSizing: 'border-box',
                      textAlign: column.align || 'left',
                      outline: 0,
                      backgroundColor: 'transparent',
                      flex: column.width ? undefined : (processedColumns.length > 7 ? undefined : '1'),
                    }}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >
                    <div className="flex items-center justify-start">
                      <span className="select-none text-[11px] font-medium uppercase tracking-wider text-dark-text-tertiary">{column.title}</span>
                      <div className="flex items-center ml-2">
                        {column.sortable && (
                          <div className="text-dark-text-placeholder hover:text-dark-text-secondary transition-colors">
                            {renderSortIcon(column.key)}
                          </div>
                        )}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            {/* v14.4.1: Warm surface body - bg handled by Tailwind class for hover consistency */}
            {/* v14.5.0: Always virtualized - single code path */}
            <tbody
              className="bg-dark-surface"
              style={{
                display: 'block',
                position: 'relative',
                height: `${rowVirtualizer.getTotalSize()}px`,
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const index = virtualRow.index;
                  const record = paginatedData[index];
                  const recordId = getRowKey(record, index);
                  const isEditing = inlineEditable && editingRow === recordId;
                  const isDragging = draggedIndex === index;
                  const isDragOver = dragOverIndex === index;

                  return (
                    <tr
                      key={recordId}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      draggable={allowReordering && !isEditing && !activeEditingCell}
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => {
                        // v14.3.0: Ctrl+Click (or Cmd+Click on Mac) for multi-select toggle
                        const isCtrlOrCmd = e.ctrlKey || e.metaKey;
                        if (selectable && (isCtrlOrCmd || e.shiftKey)) {
                          e.preventDefault();
                          toggleRowSelection(recordId, index);
                          setFocusedRowIndex(index);
                          return;
                        }
                        // v9.4.1: Robust click handling for virtualized rows
                        // Only trigger row click if not editing and click wasn't stopped by child
                        if (!isEditing && !activeEditingCell && onRowClick) {
                          onRowClick(record);
                        }
                      }}
                      onKeyDown={(e) => handleRowKeyDown(e, recordId, record, index)}
                      tabIndex={0}
                      data-row-id={recordId}
                      className={`${getRowClassName(isDragging, isDragOver, isEditing || !!isCellEditing(recordId, ''), isRowSelected(recordId))} outline-none`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',  // v14.3.0: Center cells vertically within row height
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                        height: `${densitySettings.rowHeight}px`,
                        borderBottom: '1px solid #F5F5F4', // stone-100 warm subtle dividers
                      }}
                    >
                    {processedColumns.map((column, colIndex) => {
                      // Actions column: Show edit/save icons based on editing state
                      // v8.4.0: Also show save/cancel when any cell in the row is being edited
                      const isAnyCellInRowEditing = activeEditingCell?.rowId === recordId;
                      if (column.key === '_actions') {
                        return (
                          <td
                            key={column.key}
                            className={`${densitySettings.cellPadding} flex-shrink-0 h-full flex items-center ${getStickyClassName(colIndex)}`}
                            style={columnStylesMap.get(column.key)}
                          >
                            {/* v14.2.0: Actions always visible */}
                            <div className="flex items-center justify-center gap-0.5">
                              {(isEditing || isAnyCellInRowEditing) ? (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (activeEditingCell) {
                                        handleCellSave(recordId, activeEditingCell.columnKey, record);
                                      } else if (onSaveInlineEdit) {
                                        const formattedRec = record as FormattedRow<any>;
                                        const rawRec = formattedRec.raw || record;
                                        const updatedRecord = { ...rawRec, ...editedData };
                                        onSaveInlineEdit(updatedRecord as T);
                                      }
                                    }}
                                    className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                                    title="Save (Enter)"
                                  >
                                    <Check className={densitySettings.actionIconSize} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (activeEditingCell) {
                                        handleCellCancel();
                                      } else {
                                        onCancelInlineEdit?.();
                                      }
                                    }}
                                    className="p-1 text-dark-text-tertiary hover:text-dark-text-primary hover:bg-dark-active rounded transition-colors"
                                    title="Cancel (Esc)"
                                  >
                                    <X className={densitySettings.actionIconSize} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  {allActions.map((action) => {
                                    const isDisabled = action.disabled ? action.disabled(record) : false;
                                    const buttonVariants = {
                                      default: 'text-dark-text-tertiary hover:text-dark-text-primary hover:bg-dark-active',
                                      primary: 'text-blue-500 hover:text-blue-700 hover:bg-blue-50',
                                      danger: 'text-dark-text-tertiary hover:text-red-600 hover:bg-red-50'};
                                    return (
                                      <button
                                        key={action.key}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (!isDisabled) action.onClick(record);
                                        }}
                                        disabled={isDisabled}
                                        className={`p-1 rounded transition-colors ${
                                          isDisabled ? 'text-dark-text-disabled cursor-not-allowed' : buttonVariants[action.variant || 'default']
                                        } ${action.className || ''}`}
                                        title={action.label}
                                      >
                                        {React.cloneElement(action.icon as React.ReactElement, { className: densitySettings.actionIconSize })}
                                      </button>
                                    );
                                  })}
                                </>
                              )}
                            </div>
                          </td>
                        );
                      }

                      // Data columns: Extract metadata and render based on field type
                      const backendMeta = (column as any).backendMetadata as BackendFieldMetadata | undefined;
                      const fieldEditable = backendMeta?.editable ?? column.editable ?? false;
                      // v12.2.0: inputType determines rendering (e.g., 'text', 'number', 'component')
                      const inputType = backendMeta?.inputType ?? column.editType ?? 'text';
                      const hasLabelsMetadata = labelsMetadata.has(column.key);
                      const columnOptions = hasLabelsMetadata ? labelsMetadata.get(column.key)! : [];
                      const formattedRecord = record as FormattedRow<any>;
                      const rawRecord = formattedRecord.raw || record;
                      const rawValue = (rawRecord as any)[column.key];

                      // v8.4.0: Check if THIS specific cell is being edited (Airtable-style)
                      const isCellBeingEdited = isCellEditing(recordId, column.key);

                      return (
                        <td
                          key={column.key}
                          className={`${densitySettings.cellPadding} ${densitySettings.fontSize} leading-snug flex-shrink-0 h-full flex items-center ${getStickyClassName(colIndex)} ${
                            fieldEditable && inlineEditable ? 'cursor-text hover:bg-dark-subtle' : ''
                          } ${isCellBeingEdited ? 'bg-blue-50/30' : ''}`}
                          style={columnStylesMap.get(column.key)}
                          onClick={(e) => {
                            if (isEditing) {
                              e.stopPropagation();
                            } else if (fieldEditable && inlineEditable) {
                              handleCellClick(e, recordId, column.key, record, fieldEditable);
                            }
                          }}
                          onMouseDown={(e) => {
                            if (fieldEditable && inlineEditable) {
                              handleCellMouseDown(e, recordId, column.key, record, fieldEditable);
                            }
                          }}
                          onMouseUp={handleCellMouseUp}
                          onMouseLeave={handleCellMouseLeave}
                        >
                          {/* v8.4.0: Cell editing - show edit field if THIS cell is being edited OR row-level editing */}
                          {(isCellBeingEdited || (isEditing && fieldEditable)) ? (
                            <div
                              ref={isCellBeingEdited ? editingCellRef : undefined}
                              onKeyDown={(e) => handleCellKeyDown(e, recordId, column.key, record, inputType)}
                              className="w-full"
                            >
                              {inputType === 'file' ? (
                                <InlineFileUploadCell
                                  value={rawValue}
                                  entityCode={onEdit ? 'artifact' : 'cost'}
                                  entityId={(rawRecord as any).id}
                                  fieldName={column.key}
                                  accept={backendMeta?.accept}
                                  onUploadComplete={(fileUrl) => {
                                    // v13.0.0: Direct save on upload complete
                                    handleCellSave(recordId, column.key, record, fileUrl);
                                  }}
                                  disabled={false}
                                />
                              ) : column.key === 'color_code' && colorOptions ? (
                                // v13.0.0: Cell-Isolated State - Direct save on selection
                                <div className="relative w-full">
                                  <select
                                    autoFocus
                                    value={rawValue ?? ''}  // v13.0.0: Use rawValue (select saves immediately)
                                    onChange={(e) => {
                                      // v13.0.0: Direct save - no intermediate state updates
                                      handleCellSave(recordId, column.key, record, e.target.value);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className={`w-full ${densitySettings.inputPadding} pr-6 border border-dark-border-medium rounded focus:outline-none focus:border-dark-border-strong bg-dark-surface transition-colors cursor-pointer appearance-none ${densitySettings.fontSize}`}
                                  >
                                    <option value="">Select color...</option>
                                    {colorOptions.map(opt => (
                                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                  </select>
                                  <ChevronDown className={`${densitySettings.iconSize} text-dark-text-tertiary absolute right-1.5 top-1/2 transform -translate-y-1/2 pointer-events-none`} />
                                </div>
                              ) : inputType === 'component' && hasLabelsMetadata ? (
                                // v12.2.0: inputType 'component' with datalabel options renders BadgeDropdownSelect
                                // v13.0.0: Cell-Isolated State - Direct save on selection (atomic action)
                                <BadgeDropdownSelect
                                  value={rawValue ?? ''}  // v13.0.0: Use rawValue (dropdown saves immediately)
                                  options={badgeDropdownOptionsMap.get(column.key) || []}
                                  onChange={(value) => {
                                    // v13.0.0: Direct save - no intermediate state updates
                                    handleCellSave(recordId, column.key, record, value);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                // ALL OTHER FIELDS - Backend-driven renderer with auto-focus
                                // v13.0.0: Cell-Isolated State - DebouncedInput manages local state,
                                // onChange triggers handleCellSave directly (commit-only pattern)
                                <div onClick={(e) => e.stopPropagation()}>
                                  {(() => {
                                    const metadata = (column as any).backendMetadata || { inputType: 'text', label: column.key };
                                    return renderEditModeFromMetadata(
                                      rawValue,  // v13.0.0: Use rawValue only (DebouncedInput has its own local state)
                                      metadata,
                                      (val) => {
                                        // v13.0.0: Direct save on commit (blur/enter from DebouncedInput)
                                        handleCellSave(recordId, column.key, record, val);
                                      },
                                      {
                                        className: `w-full ${densitySettings.inputPadding} ${densitySettings.fontSize} border border-dark-border-medium rounded focus:outline-none focus:border-dark-border-strong bg-dark-surface`,
                                        autoFocus: isCellBeingEdited
                                      }
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          ) : (
                            // v14.1.0: Minimal display styling - no inline padding, uses cell padding
                            <div className="truncate text-dark-text-primary">
                              {(() => {
                                if (column.render) return column.render((record as any)[column.key], record);
                                const formatted = record as FormattedRow<any>;
                                if (formatted.display && formatted.styles !== undefined) {
                                  const displayValue = formatted.display[column.key];
                                  const styleClass = formatted.styles[column.key];
                                  if (styleClass) {
                                    // v14.1.0: Compact badge with density-based sizing
                                    return <span className={`inline-flex items-center ${densitySettings.badgeSize} rounded font-medium ${styleClass}`}>{displayValue}</span>;
                                  }
                                  return <span>{displayValue}</span>;
                                }
                                const value = (record as any)[column.key];
                                if (value === null || value === undefined || value === '') {
                                  return <span className="text-dark-text-disabled">—</span>;
                                }
                                return <span>{String(value)}</span>;
                              })()}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {paginatedData.length === 0 && !loading && !allowAddRow && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-dark-700">No data found</p>
          </div>
        )}
      </div>

      {/* Bottom Scrollbar (Next-Gen Style - fixed to viewport bottom) */}
      {scrollbarStyles.visible && (
        <div
          ref={bottomScrollbarRef}
          className="overflow-x-auto overflow-y-hidden bottom-scrollbar-track bottom-scrollbar-enhanced"
          style={{
            position: 'fixed',
            bottom: 0,
            left: `${scrollbarStyles.left}px`,
            width: `${scrollbarStyles.width}px`,
            height: '24px',
            zIndex: 1000}}
          onScroll={handleBottomScroll}
        >
          {/* Progress indicator showing scroll position */}
          <div
            className="scrollbar-progress-indicator"
            style={{
              width: `${scrollProgress}%`}}
          />
          {/* Scrollbar content */}
          <div className="scrollbar-content" style={{ height: '1px' }} />
        </div>
      )}

      {/* v11.0.0: Link Existing Entity Modal */}
      {parentContext && entityCode && (
        <Modal_LinkExistingEntityInstanceToDataTable
          isOpen={showLinkExistingModal}
          onClose={() => setShowLinkExistingModal(false)}
          parentEntity={parentContext.entityCode}
          parentId={parentContext.entityId}
          childEntity={entityCode}
          childEntityLabel={entityLabel}
          onSuccess={onLinkSuccess}
        />
      )}

      {/* v14.6.0: Unified footer - minimal & elegant matching child entity tabs */}
      <div className="flex-shrink-0 border-t border-dark-border-subtle">
        <div className="flex items-center justify-between px-4 py-2">
          {/* Left side: Add button */}
          <div className="flex items-center">
            {allowAddRow && (
              <SplitAddButton
                entityLabel={entityLabel}
                onAddNew={handleStartAddRow}
                onLinkExisting={() => setShowLinkExistingModal(true)}
                showLinkOption={!!parentContext}
              />
            )}
          </div>

          {/* Right side: Pagination info + controls - minimal style */}
          {pagination && (
            <div className="flex items-center gap-3">
              {/* Results info - subtle text */}
              <span className="text-xs text-dark-text-tertiary">
                {loading ? (
                  <InlineSpinner />
                ) : (
                  <>{Math.max(0, pagination.total || filteredAndSortedData.length) > 0 ? (pagination.current - 1) * pagination.pageSize + 1 : 0}–{Math.max(0, pagination.total || filteredAndSortedData.length) > 0 ? Math.min(pagination.current * pagination.pageSize, Math.max(0, pagination.total || filteredAndSortedData.length)) : 0} of {Math.max(0, pagination.total || filteredAndSortedData.length)}</>
                )}
              </span>

              {/* Page size selector - minimal */}
              {pagination.showSizeChanger !== false && (
                <select
                  value={pagination.pageSize}
                  onChange={(e) => {
                    e.preventDefault();
                    pagination.onChange?.(1, Number(e.target.value));
                  }}
                  className="px-2 py-1 text-xs text-dark-text-tertiary bg-transparent border-0 focus:ring-0 focus:outline-none cursor-pointer hover:text-dark-text-secondary transition-colors"
                >
                  {(pagination.pageSizeOptions || [20, 50, 100, 200]).map(size => (
                    <option key={size} value={size}>{size} / page</option>
                  ))}
                </select>
              )}

              {/* Page controls - minimal icons only */}
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    pagination.onChange?.(pagination.current - 1, pagination.pageSize);
                  }}
                  disabled={pagination.current <= 1 || Math.max(0, pagination.total || filteredAndSortedData.length) === 0}
                  className="p-1 text-dark-text-tertiary hover:text-dark-text-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {(() => {
                  const totalPages = Math.max(1, Math.ceil((pagination.total || filteredAndSortedData.length) / pagination.pageSize));
                  return Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.current <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.current >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = pagination.current - 2 + i;
                    }
                    return (
                      <button
                        type="button"
                        key={pageNum}
                        onClick={(e) => {
                          e.preventDefault();
                          pagination.onChange?.(pageNum, pagination.pageSize);
                        }}
                        className={`min-w-[24px] h-6 text-xs font-medium transition-colors ${
                          pagination.current === pageNum
                            ? 'text-dark-text-primary'
                            : 'text-dark-text-tertiary hover:text-dark-text-secondary'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  });
                })()}

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    pagination.onChange?.(pagination.current + 1, pagination.pageSize);
                  }}
                  disabled={pagination.current >= Math.max(1, Math.ceil((pagination.total || filteredAndSortedData.length) / pagination.pageSize)) || Math.max(0, pagination.total || filteredAndSortedData.length) === 0}
                  className="p-1 text-dark-text-tertiary hover:text-dark-text-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* v8.4.0: Undo notification toast */}
      {showUndoNotification && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
          <div className="bg-dark-900 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            <span className="text-sm">Change undone</span>
            <span className="text-xs text-dark-400 ml-2">⌘Z</span>
          </div>
        </div>
      )}
    </div>
  );
}

