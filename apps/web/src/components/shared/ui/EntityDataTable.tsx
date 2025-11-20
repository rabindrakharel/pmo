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
 * INLINE EDITING PATTERN (Matches SettingsDataTable):
 * - Click Edit icon (✏️) on any row to enter edit mode
 * - Edit icon transforms into Check icon (✓) with Cancel (✗)
 * - All editable fields become inputs/dropdowns
 * - Click Check to save, X to cancel
 *
 * ADD ROW FEATURE:
 * - When allowAddRow=true, shows "+ Add new row" button at bottom
 * - Clicking opens inline form with all visible columns
 * - Provides quick way to add records (complements detailed create form)
 *
 * Used by: All entity pages (projects, tasks, clients, etc.)
 * Different from: SettingsDataTable (specialized for settings with fixed schema)
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, Search, Filter, Columns, ChevronLeft, ChevronRight, Edit, Share, Trash2, X, Plus, Check } from 'lucide-react';
import {
  loadFieldOptions,
  getSettingDatalabel,
  type SettingOption
} from '../../../lib/settingsLoader';
import {
  renderDataLabelBadge,
  COLOR_MAP,
  getSettingColor,
  loadSettingsColors,
  renderViewModeFromMetadata,
  formatCurrency,
  formatRelativeTime,
  formatFriendlyDate
} from '../../../lib/frontEndFormatterService';
import type { BackendFieldMetadata, EntityMetadata } from '../../../lib/api';
import { InlineFileUploadCell } from '../file/InlineFileUploadCell';

// ============================================================================
// TEMPORARY: Minimal compatibility types (deprecated function removal)
// TODO: Migrate to backend metadata architecture
// ============================================================================
interface FieldCapability {
  inlineEditable: boolean;
  editType: string;
  isFileUpload: boolean;
}

/**
 * @deprecated Temporary inline replacement for getFieldCapability()
 * TODO: Migrate to backend metadata architecture - Backend provides editable flags
 */
function getFieldCapability(columnKey: string, dataType?: string): FieldCapability {
  const readonly = /^(id|.*_id|created.*|updated.*|deleted.*|.*_at|.*_ts|.*_count|.*_total)$/i.test(columnKey);
  const isFileUpload = columnKey.includes('attachment') || columnKey.includes('file');

  return {
    inlineEditable: !readonly,
    editType: dataType || 'text',
    isFileUpload
  };
}

/**
 * @deprecated Temporary inline replacement for renderField()
 * TODO: Migrate to backend metadata architecture - Use renderViewModeFromMetadata/renderEditModeFromMetadata
 */
interface RenderFieldOptions {
  fieldKey: string;
  value: any;
  mode: 'view' | 'edit';
  onChange?: (key: string, value: any) => void;
  inlineMode?: boolean;
  data?: any;
  customRender?: (value: any, record: any) => React.ReactNode;
  loadDataLabels?: boolean;
}

function renderField(options: RenderFieldOptions): React.ReactNode {
  const { fieldKey, value, mode, onChange, inlineMode, data, customRender, loadDataLabels } = options;

  // Custom render override
  if (customRender && mode === 'view') {
    return customRender(value, data);
  }

  // View mode
  if (mode === 'view') {
    // Badge for datalabel fields
    if (loadDataLabels || fieldKey.startsWith('dl__')) {
      return renderDataLabelBadge(value, getSettingDatalabel(fieldKey) || fieldKey);
    }

    // Currency
    if (fieldKey.includes('_amt') || fieldKey.includes('_price') || fieldKey.includes('_cost')) {
      return <span className="font-mono text-right">{formatCurrency(value)}</span>;
    }

    // Timestamps
    if (fieldKey.endsWith('_ts') || fieldKey.endsWith('_at')) {
      return <span title={formatFriendlyDate(value)}>{formatRelativeTime(value)}</span>;
    }

    // Dates
    if (fieldKey.endsWith('_date')) {
      return formatFriendlyDate(value);
    }

    // Boolean
    if (fieldKey.startsWith('is_') || fieldKey.endsWith('_flag')) {
      return value ? '✓' : '✗';
    }

    // Default
    return value ?? '-';
  }

  // Edit mode
  if (mode === 'edit' && onChange) {
    const inputClass = inlineMode
      ? 'w-full px-2 py-1 text-sm border border-dark-300 rounded focus:outline-none focus:ring-1 focus:ring-dark-500'
      : 'w-full px-3 py-2 border-0 focus:outline-none focus:ring-0';

    // Currency/number
    if (fieldKey.includes('_amt') || fieldKey.includes('_price') || fieldKey.includes('_cost') || fieldKey.includes('_hours')) {
      return (
        <input
          type="number"
          step="0.01"
          value={value ?? ''}
          onChange={(e) => onChange(fieldKey, parseFloat(e.target.value) || null)}
          className={inputClass}
        />
      );
    }

    // Date
    if (fieldKey.endsWith('_date')) {
      return (
        <input
          type="date"
          value={value ?? ''}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          className={inputClass}
        />
      );
    }

    // Boolean
    if (fieldKey.startsWith('is_') || fieldKey.endsWith('_flag')) {
      return (
        <input
          type="checkbox"
          checked={value ?? false}
          onChange={(e) => onChange(fieldKey, e.target.checked)}
        />
      );
    }

    // Text (default)
    return (
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        className={inputClass}
      />
    );
  }

  return value ?? '-';
}

// ============================================================================
// METADATA-DRIVEN RENDERING (Pure Backend-Driven)
// ============================================================================
// ALL field rendering (view + edit modes) driven by backend metadata
// - renderViewModeFromMetadata() for view mode (reads metadata.renderType)
// - renderEditModeFromMetadata() for edit mode (reads metadata.inputType)
// - Zero frontend pattern detection or configuration
// ============================================================================

/**
 * Extract settings datalabel from column key
 * Uses centralized mapping from settingsLoader for proper datalabel resolution
 * Examples:
 *   'project_stage' -> 'project_stage'
 *   'opportunity_funnel_stage_name' -> 'opportunity_funnel_stage'
 *   'dl__opportunity_funnel_stage' -> 'opportunity_funnel_stage' (via FIELD_TO_SETTING_MAP)
 */
function extractSettingsDatalabel(columnKey: string): string {
  // First try centralized mapping from settingsLoader
  // This handles fields like dl__opportunity_funnel_stage -> opportunity_funnel_stage
  const mapped = getSettingDatalabel(columnKey);
  if (mapped) {
    return mapped;
  }

  // Fallback: strip common suffixes for legacy field patterns
  return columnKey
    .replace(/_name$/, '')
    .replace(/_id$/, '')
    .replace(/_level_id$/, '');
}

/**
 * Custom Dropdown Component for Inline Editing with Colored Badges
 */
interface ColoredDropdownProps {
  value: string;
  options: SettingOption[];
  onChange: (value: string) => void;
  onClick: (e: React.MouseEvent) => void;
}

function ColoredDropdown({ value, options, onChange, onClick }: ColoredDropdownProps) {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = React.useState({ top: 0, left: 0, width: 0, openUpward: false });

  // Update dropdown position when it opens or on scroll/resize
  React.useEffect(() => {
    if (dropdownOpen && buttonRef.current) {
      const updatePosition = () => {
        if (buttonRef.current) {
          const rect = buttonRef.current.getBoundingClientRect();
          const maxDropdownHeight = 240; // max-h-60 = 240px
          const viewportHeight = window.innerHeight;
          const spaceBelow = viewportHeight - rect.bottom - 20; // 20px buffer
          const spaceAbove = rect.top - 20; // 20px buffer

          // Calculate actual content height (estimate)
          const estimatedItemHeight = 40; // px per item
          const estimatedContentHeight = Math.min(options.length * estimatedItemHeight, maxDropdownHeight);

          // Decide if dropdown should open upward
          const shouldOpenUpward = spaceBelow < estimatedContentHeight && spaceAbove > spaceBelow;

          // Calculate position
          let top: number;
          if (shouldOpenUpward) {
            // Open above: position so bottom of dropdown aligns near top of button
            const availableHeight = Math.min(estimatedContentHeight, spaceAbove);
            top = rect.top + window.scrollY - availableHeight - 4;
          } else {
            // Open below: position just below the button
            top = rect.bottom + window.scrollY + 4;
          }

          setDropdownPosition({
            top,
            left: rect.left + window.scrollX,
            width: rect.width,
            openUpward: shouldOpenUpward});
        }
      };

      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);

      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [dropdownOpen, options.length]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);
  const selectedColor = selectedOption?.metadata?.color_code;

  return (
    <div className="relative w-full">
      {/* Selected value display */}
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick(e);
          setDropdownOpen(!dropdownOpen);
        }}
        className="w-full px-2.5 py-1.5 pr-8 border border-dark-400 rounded-md focus:ring-2 focus:ring-dark-700/30 focus:border-dark-400 bg-dark-100 shadow-sm hover:border-dark-400 transition-colors cursor-pointer text-left"
        style={{
          fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
          fontSize: '13px',
          minHeight: '32px',
          maxHeight: '32px'}}
      >
        {selectedOption ? (
          renderDataLabelBadge(selectedColor, String(selectedOption.label))
        ) : (
          <span className="text-dark-600">Select...</span>
        )}
      </button>
      <ChevronDown className="h-4 w-4 text-dark-700 absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none" />

      {/* Dropdown menu - rendered via portal to avoid overflow clipping */}
      {dropdownOpen && createPortal(
        <div
          ref={dropdownRef}
          className="bg-dark-100 border border-dark-300 rounded-md overflow-auto"
          style={{
            position: 'absolute',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            maxHeight: '240px',
            zIndex: 9999,
            boxShadow: dropdownPosition.openUpward
              ? '0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)'
              : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'}}
        >
          <div className="py-1">
            {options.map(opt => {
              const optionColor = opt.metadata?.color_code;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(opt.value as string);
                    setDropdownOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-dark-100 transition-colors flex items-center"
                >
                  {renderDataLabelBadge(optionColor, String(opt.label))}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
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
  editable?: boolean;
  editType?: 'text' | 'number' | 'currency' | 'date' | 'datetime' | 'time' |
             'select' | 'multiselect' | 'checkbox' | 'textarea' | 'tags' |
             'jsonb' | 'datatable' | 'file' | 'dag-select';
  loadDataLabels?: boolean;
  loadFromEntity?: string;         // Load options from entity API (e.g., 'employee', 'project')
  /**
   * Static options for inline editing dropdowns (alternative to loadDataLabels)
   * Use this when options are hardcoded (e.g., color_code field in settings tables)
   */
  options?: SettingOption[];
  /**
   * When true, this column can be edited inline in the DataTable.
   * Fields with loadDataLabels automatically become editable with dropdowns.
   * Tags fields are also automatically editable with text inputs.
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

export interface EntityDataTableProps<T = any> {
  data: T[];
  metadata?: EntityMetadata | null;  // Backend metadata (REQUIRED for metadata-driven mode)
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
  // Bulk selection support
  selectable?: boolean;
  selectedRows?: string[];
  onSelectionChange?: (selectedRows: string[]) => void;
  // Inline editing support
  inlineEditable?: boolean;
  editingRow?: string | null;

  // ============================================================================
  // NEW: Auto-Generation Support (Universal Field Detector Integration)
  // ============================================================================
  /**
   * Auto-generate columns from data using universal field detector
   * When true and columns prop is not provided, automatically detects field types
   * and generates appropriate column configurations
   *
   * @example
   * <EntityDataTable data={projects} autoGenerateColumns />
   * // Automatically detects: budget_allocated_amt → currency, dl__project_stage → DAG, etc.
   */
  autoGenerateColumns?: boolean;

  /**
   * Optional data types for auto-generation (for JSONB/array detection)
   * @example
   * dataTypes={{ metadata: 'jsonb'}}
   */
  dataTypes?: Record<string, string>;
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
  // DEPRECATED props (kept for backward compatibility, will be removed)
  autoGenerateColumns?: boolean;  // DEPRECATED: Use metadata instead
  dataTypes?: Record<string, string>;  // DEPRECATED: Use metadata instead
}

export function EntityDataTable<T = any>({
  data,
  metadata,  // Backend metadata from API
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
  autoGenerateColumns = false,
  dataTypes}: EntityDataTableProps<T>) {
  // ============================================================================
  // METADATA-DRIVEN COLUMN GENERATION (Pure Backend-Driven Architecture)
  // ============================================================================
  // Backend sends complete field metadata → Frontend renders exactly as instructed

  const columns = useMemo(() => {
    // Priority 1: Backend Metadata (Pure metadata-driven - NO FALLBACK)
    if (metadata?.fields) {
      return metadata.fields
        .filter(fieldMeta => {
          // ✅ NEW: Object-based visibility control
          if (typeof fieldMeta.visible === 'object' && fieldMeta.visible !== null) {
            return fieldMeta.visible.EntityDataTable === true;
          }
          // Backward compatibility: treat boolean as visible everywhere
          return fieldMeta.visible === true;
        })
        .map(fieldMeta => ({
          key: fieldMeta.key,
          title: fieldMeta.label,
          visible: true,  // Already filtered above, so all are visible
          sortable: fieldMeta.sortable,
          filterable: fieldMeta.filterable,
          searchable: fieldMeta.searchable,
          width: fieldMeta.width,
          align: fieldMeta.align,
          editable: fieldMeta.editable,
          editType: fieldMeta.editType,
          loadDataLabels: fieldMeta.loadFromDataLabels,
          loadFromEntity: fieldMeta.loadFromEntity,
          // Pure metadata-driven rendering - backend tells frontend how to render
          render: (value: any, record: any) => renderViewModeFromMetadata(value, fieldMeta, record)
        } as Column<T>));
    }

    // Priority 2: Explicit columns (for custom overrides only)
    if (initialColumns && initialColumns.length > 0) {
      return initialColumns;
    }

    // Priority 3: Legacy auto-generation (DEPRECATED - for backward compatibility only)
    // ⚠️ This path should NOT be used for new entities - always provide metadata from backend
    if (autoGenerateColumns && data.length > 0) {
      console.warn(
        '[EntityDataTable] Using deprecated autoGenerateColumns. ' +
        'Update backend route to return metadata instead.'
      );
      // Fallback to empty columns - force migration to metadata
      return [];
    }

    return [];
  }, [metadata, initialColumns, autoGenerateColumns, data.length]);

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

  // Add row state
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [newRowData, setNewRowData] = useState<Partial<T>>({});

  // Bottom scrollbar positioning state
  const [scrollbarStyles, setScrollbarStyles] = useState<{
    left: number;
    width: number;
    visible: boolean;
  }>({ left: 0, width: 0, visible: false });

  // Scroll progress state for progress indicator
  const [scrollProgress, setScrollProgress] = useState(0);

  // ============================================================================
  // CENTRALIZED CAPABILITY DETECTION - TRUE DRY SYSTEM
  // ============================================================================

  // Auto-detect field capabilities based on naming conventions (Convention over Configuration)
  const columnCapabilities = useMemo(() => {
    const capabilities = new Map<string, FieldCapability>();
    columns.forEach(col => {
      capabilities.set(col.key, getFieldCapability(col.key, col.editType));
    });
    return capabilities;
  }, [columns]);

  // State for dynamically loaded setting options
  const [settingOptions, setSettingOptions] = useState<Map<string, SettingOption[]>>(new Map());

  // Load setting options for columns that need them (auto-detected)
  useEffect(() => {
    const loadAllSettingOptions = async () => {
      const optionsMap = new Map<string, SettingOption[]>();

      // First, add static options from column definitions
      columns.forEach(col => {
        if (col.options && col.options.length > 0) {
          optionsMap.set(col.key, col.options);
        }
      });

      // Find all columns that need dynamic settings using capability detection
      const columnsNeedingSettings = columns.filter(col => {
        const capability = columnCapabilities.get(col.key);
        return capability?.loadDataLabels;
      });

      // Load options for each column
      await Promise.all(
        columnsNeedingSettings.map(async (col) => {
          try {
            const capability = columnCapabilities.get(col.key)!;
            const datalabel = capability.settingsDatalabel || col.key;
            const options = await loadFieldOptions(datalabel);
            if (options.length > 0) {
              optionsMap.set(col.key, options);
            }
          } catch (error) {
            console.error(`Failed to load options for ${col.key}:`, error);
          }
        })
      );

      setSettingOptions(optionsMap);
    };

    if (inlineEditable) {
      loadAllSettingOptions();
    }
  }, [columns, inlineEditable, columnCapabilities]);

  // Preload colors for all settings columns (for filter dropdowns and inline edit)
  useEffect(() => {
    const preloadColors = async () => {
      // Find all columns with loadDataLabels
      const settingsColumns = columns.filter(col => {
        const capability = columnCapabilities.get(col.key);
        return col.loadDataLabels || capability?.loadDataLabels;
      });

      // Extract datalabels and preload colors
      const datalabels = settingsColumns.map(col => extractSettingsDatalabel(col.key));
      const uniqueDatalabels = Array.from(new Set(datalabels));

      // Preload all colors in parallel
      await Promise.all(
        uniqueDatalabels.map(datalabel => loadSettingsColors(datalabel).catch(err => {
          console.error(`Failed to preload colors for ${datalabel}:`, err);
        }))
      );
    };

    if (filterable || inlineEditable) {
      preloadColors();
    }
  }, [columns, columnCapabilities, filterable, inlineEditable]);

  // Helper to get row key
  const getRowKey = (record: T, index: number): string => {
    if (typeof rowKey === 'function') {
      return rowKey(record);
    }
    return (record as any)[rowKey] || index.toString();
  };

  // Calculate filtered and sorted data BEFORE using it
  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    if (filterable) {
      // Handle dropdown filters
      Object.entries(dropdownFilters).forEach(([key, selectedValues]) => {
        if (selectedValues.length > 0) {
          result = result.filter(record => {
            const value = (record as any)[key]?.toString();
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


  // Get unique values for each filterable column
  const getColumnOptions = (columnKey: string) => {
    const uniqueValues = new Set<string>();
    data.forEach(record => {
      const value = (record as any)[columnKey];
      if (value != null && value !== '') {
        uniqueValues.add(value.toString());
      }
    });
    return Array.from(uniqueValues).sort();
  };

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
    if (allActions.length > 0) {
      const actionsColumn: Column<T> = {
        key: '_actions',
        title: 'Actions',
        width: allActions.length > 3 ? 120 : allActions.length * 40,
        align: 'center',
        render: (_, record) => {
          return (
            <div className="flex items-center justify-center space-x-1">
              {allActions.map((action) => {
                const isDisabled = action.disabled ? action.disabled(record) : false;

                const buttonVariants = {
                  default: 'text-dark-700 hover:text-dark-600 hover:bg-dark-100',
                  primary: 'text-dark-600 hover:text-dark-600 hover:bg-dark-100',
                  danger: 'text-red-600 hover:text-red-900 hover:bg-red-50'};

                return (
                  <button
                    key={action.key}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isDisabled) {
                        action.onClick(record);
                      }
                    }}
                    disabled={isDisabled}
                    className={`p-1.5 rounded transition-colors ${
                      isDisabled
                        ? 'text-gray-300 cursor-not-allowed'
                        : buttonVariants[action.variant || 'default']
                    } ${action.className || ''}`}
                    title={action.label}
                  >
                    {action.icon}
                  </button>
                );
              })}
            </div>
          );
        }};

      filteredColumns = [...filteredColumns, actionsColumn];
    }

    return filteredColumns;
  }, [columns, visibleColumns, allActions]);

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
  const handleTableScroll = () => {
    if (tableContainerRef.current && bottomScrollbarRef.current) {
      bottomScrollbarRef.current.scrollLeft = tableContainerRef.current.scrollLeft;

      // Update scroll progress indicator
      const scrollLeft = tableContainerRef.current.scrollLeft;
      const scrollWidth = tableContainerRef.current.scrollWidth;
      const clientWidth = tableContainerRef.current.clientWidth;
      const maxScroll = scrollWidth - clientWidth;
      const progress = maxScroll > 0 ? (scrollLeft / maxScroll) * 100 : 0;
      setScrollProgress(progress);
    }
  };

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

    // Update on various events
    window.addEventListener('resize', updateBottomScrollbar);
    window.addEventListener('scroll', updateBottomScrollbar, true); // Use capture phase

    // Use ResizeObserver to detect table size changes
    const resizeObserver = new ResizeObserver(updateBottomScrollbar);
    if (tableContainerRef.current) {
      resizeObserver.observe(tableContainerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateBottomScrollbar);
      window.removeEventListener('scroll', updateBottomScrollbar, true);
      resizeObserver.disconnect();
    };
  }, [data.length, columns.length]); // Only re-run when data or column count changes

  // Add row handlers
  // Handle add row - adds empty row inline and enters edit mode
  const handleStartAddRow = () => {
    // Generate temporary ID for the new row
    const tempId = `temp_${Date.now()}`;

    // Create empty row with default values
    const newRow: any = {
      id: tempId,
      _isNew: true, // Flag to identify new rows
    };

    // Add empty row to data
    const newData = [...data, newRow];

    // Trigger parent's onAddRow with the new row data to update parent state
    // Parent should add this to their data array
    if (onAddRow) {
      onAddRow(newRow);
    }
  };

  const handleSaveNewRow = () => {
    // This is handled by the regular save flow now
    setIsAddingRow(false);
    setNewRowData({});
  };

  const handleCancelAddRow = () => {
    setIsAddingRow(false);
    setNewRowData({});
  };

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

  const PaginationComponent = () => {
    if (!pagination) return null;

    const { current, pageSize, total, showSizeChanger = true, pageSizeOptions = [20, 50, 100, 200], onChange } = pagination;
    const totalPages = Math.max(1, Math.ceil((total || filteredAndSortedData.length) / pageSize));
    const actualTotal = Math.max(0, total || filteredAndSortedData.length);
    const startRecord = actualTotal > 0 ? (current - 1) * pageSize + 1 : 0;
    const endRecord = actualTotal > 0 ? Math.min(current * pageSize, actualTotal) : 0;


    return (
      <div className="flex items-center justify-between px-6 py-4 border-t border-dark-300 bg-gradient-to-r from-dark-100/50 to-dark-100">
        <div className="flex items-center text-sm text-dark-700">
          <span className="font-normal">
            {loading ? (
              <>Loading...</>
            ) : (
              <>Showing <span className="text-dark-600">{startRecord}</span> to <span className="text-dark-600">{endRecord}</span> of <span className="text-dark-600">{actualTotal}</span> results</>
            )}
          </span>
          {showSizeChanger && (
            <select
              value={pageSize}
              onChange={(e) => {
                e.preventDefault();
                onChange?.(1, Number(e.target.value));
              }}
              className="ml-6 px-3 py-1.5 border border-dark-300 rounded-md text-sm bg-dark-100 focus:ring-2 focus:ring-dark-700/30 focus:border-dark-400 transition-all duration-200"
            >
              {pageSizeOptions.map(size => (
                <option key={size} value={size}>{size} per page</option>
              ))}
            </select>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onChange?.(current - 1, pageSize);
            }}
            disabled={current <= 1 || actualTotal === 0}
            className="p-2 border border-dark-300 rounded-md text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-dark-100 hover:border-dark-400 hover:shadow-sm transition-all duration-200 bg-dark-100/50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          
          <div className="flex items-center space-x-1">
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (current <= 4) {
                pageNum = i + 1;
              } else if (current >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = current - 3 + i;
              }

              return (
                <button
                  type="button"
                  key={pageNum}
                  onClick={(e) => {
                    e.preventDefault();
                    onChange?.(pageNum, pageSize);
                  }}
                  className={`px-3 py-1.5 text-sm border rounded-md font-normal transition-all duration-200 ${
                    current === pageNum
                      ? 'bg-dark-100 text-dark-600 border-dark-400 shadow-sm'
                      : 'border-dark-300 bg-dark-100/70 hover:bg-dark-100 hover:border-dark-400 hover:shadow-sm text-dark-600'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onChange?.(current + 1, pageSize);
            }}
            disabled={current >= totalPages || actualTotal === 0}
            className="p-2 border border-dark-300 rounded-md text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-dark-100 hover:border-dark-400 hover:shadow-sm transition-all duration-200 bg-dark-100/50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-dark-100 rounded-md shadow-sm border border-dark-300">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dark-400"></div>
          <span className="ml-3 text-dark-700">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-dark-100 rounded-xl shadow-sm border border-dark-300 overflow-hidden flex flex-col m-1 h-full ${className}`}>
      {(filterable || columnSelection) && (
        <div className="px-6 py-4 bg-gradient-to-r from-dark-100 to-dark-100/50 border-b border-dark-300">
          {filterable && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="flex items-center text-sm text-dark-600">
                  <Filter className="h-4 w-4 text-dark-700 stroke-[1.5] mr-2" />
                  <span className="font-normal text-sm text-dark-700">Filter by:</span>
                </div>
                
                <div className="relative">
                  <select
                    value={selectedFilterColumn}
                    onChange={(e) => setSelectedFilterColumn(e.target.value)}
                    className="appearance-none px-4 py-1.5 pr-10 w-48 border border-dark-400 rounded-xl text-sm bg-dark-100 hover:bg-dark-100 focus:ring-2 focus:ring-dark-700/30 focus:border-dark-400 transition-all duration-200 shadow-sm font-normal text-dark-600"
                  >
                    <option value="" className="text-dark-700">Select column...</option>
                    {columns.filter(col => col.filterable).map(column => (
                      <option key={column.key} value={column.key}>
                        {column.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="h-4 w-4 text-dark-600 absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                </div>

                {selectedFilterColumn && (
                  <div className="relative" ref={filterContainerRef}>
                    <div className="relative">
                      <Search className="h-4 w-4 text-dark-600 absolute left-3 top-1/2 transform -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Type to filter values..."
                        value={filterSearchTerm}
                        onChange={(e) => {
                          setFilterSearchTerm(e.target.value);
                          setShowFilterDropdown(true);
                        }}
                        onFocus={() => setShowFilterDropdown(true)}
                        className="pl-10 pr-4 py-1.5 w-64 border border-dark-300 rounded-md text-sm bg-dark-100 focus:ring-2 focus:ring-dark-700/30 focus:border-dark-400 transition-all duration-200"
                      />
                    </div>

                    {showFilterDropdown && (
                      <div className="absolute top-full left-0 mt-2 w-80 bg-dark-100 border border-dark-300 rounded-xl shadow-sm z-50 backdrop-blur-sm max-h-64 overflow-y-auto">
                        <div className="p-2">
                          {getColumnOptions(selectedFilterColumn)
                            .filter(option =>
                              option.toLowerCase().includes(filterSearchTerm.toLowerCase())
                            )
                            .map((option) => {
                              // Check if this column has settings options loaded
                              const selectedColumn = columns.find(col => col.key === selectedFilterColumn);
                              const capability = columnCapabilities.get(selectedFilterColumn);
                              const isSettingsField = selectedColumn?.loadDataLabels || capability?.loadDataLabels;

                              // If this is a settings field, look up the color from centralized cache
                              let colorCode: string | undefined;
                              if (isSettingsField) {
                                const datalabel = extractSettingsDatalabel(selectedFilterColumn);
                                colorCode = getSettingColor(datalabel, option);
                              }

                              return (
                                <label
                                  key={option}
                                  className="flex items-center px-3 py-2 hover:bg-dark-100 rounded-md cursor-pointer transition-colors group"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const isCurrentlyChecked = (dropdownFilters[selectedFilterColumn] || []).includes(option);
                                    handleDropdownFilter(selectedFilterColumn, option, !isCurrentlyChecked);
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={(dropdownFilters[selectedFilterColumn] || []).includes(option)}
                                    onChange={() => {}} // Controlled by label onClick
                                    onClick={(e) => e.stopPropagation()}
                                    className="mr-3 text-dark-700 rounded focus:ring-slate-500/30 focus:ring-offset-0 flex-shrink-0"
                                  />
                                  <div className="flex-1 min-w-0">
                                    {isSettingsField ? (
                                      // Settings field - always render badge (with or without color)
                                      colorCode ? renderDataLabelBadge(colorCode, option) : renderDataLabelBadge(undefined, option)
                                    ) : (
                                      // Non-settings field - render text
                                      <span className="text-sm text-dark-600 group-hover:text-dark-600 truncate">{option}</span>
                                    )}
                                  </div>
                                </label>
                              );
                            })
                          }
                          {getColumnOptions(selectedFilterColumn)
                            .filter(option =>
                              option.toLowerCase().includes(filterSearchTerm.toLowerCase())
                            ).length === 0 && (
                            <div className="px-2 py-1.5 text-xs text-dark-700 text-center">
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

              {columnSelection && (
                <div className="relative" ref={columnSelectorRef}>
                  <button
                    onClick={() => setShowColumnSelector(!showColumnSelector)}
                    className="flex items-center px-3 py-1.5 text-sm text-dark-700 border border-dark-300 rounded hover:bg-dark-100 hover:border-dark-400 transition-colors"
                  >
                    <Columns className="h-4 w-4 mr-2 stroke-[1.5]" />
                    Columns
                  </button>

                  {showColumnSelector && (
                    <div className="absolute right-0 mt-2 w-56 bg-dark-100 border border-dark-300 rounded-md shadow-sm z-50">
                      <div className="p-2">
                        <div className="text-sm font-normal text-dark-700 mb-2 px-1">Show Columns</div>
                        {/* Only show columns that aren't system/hidden fields (id, *_id, *_metadata) */}
                        {columns.filter(column => {
                          // Skip columns that are explicitly hidden in field detection
                          if (column.visible === false) return false;
                          // Also skip 'id' and fields ending with '_id', '_ids' or containing '_metadata'
                          if (column.key === 'id' || column.key.endsWith('_id') || column.key.endsWith('_ids') || column.key.includes('_metadata')) return false;
                          return true;
                        }).map(column => (
                          <label key={column.key} className="flex items-center px-3 py-1.5 hover:bg-dark-100 rounded cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={visibleColumns.has(column.key)}
                              onChange={() => toggleColumnVisibility(column.key)}
                              className="mr-3 text-dark-700 rounded focus:ring-dark-700"
                            />
                            <span className="text-sm text-dark-600">{column.title}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!filterable && columnSelection && (
            <div className="flex items-center justify-end">
              <div className="relative" ref={columnSelectorRef}>
                <button
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className="flex items-center px-3 py-1.5 text-sm text-dark-700 border border-dark-300 rounded hover:bg-dark-100 hover:border-dark-400 transition-colors"
                >
                  <Columns className="h-4 w-4 mr-2 stroke-[1.5]" />
                  Columns
                </button>

                {showColumnSelector && (
                  <div className="absolute right-0 mt-2 w-56 bg-dark-100 border border-dark-300 rounded-md shadow-sm z-50">
                    <div className="p-2">
                      <div className="text-sm font-normal text-dark-700 mb-2 px-1">Show Columns</div>
                      {/* Only show columns that aren't system/hidden fields (id, *_id, *_ids, *_metadata) */}
                      {columns.filter(column => {
                        // Skip columns that are explicitly hidden in field detection
                        if (column.visible === false) return false;
                        // Also skip 'id' and fields ending with '_id', '_ids' or containing '_metadata'
                        if (column.key === 'id' || column.key.endsWith('_id') || column.key.endsWith('_ids') || column.key.includes('_metadata')) return false;
                        return true;
                      }).map(column => (
                        <label key={column.key} className="flex items-center px-3 py-1.5 hover:bg-dark-100 rounded cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={visibleColumns.has(column.key)}
                            onChange={() => toggleColumnVisibility(column.key)}
                            className="mr-3 text-dark-700 rounded focus:ring-dark-700"
                          />
                          <span className="text-sm text-dark-600">{column.title}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Filter Chips */}
          {Object.keys(dropdownFilters).length > 0 && (
            <div className="mt-3 pt-3 border-t border-dark-300">
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-xs text-dark-700 font-medium">Active filters:</span>
                {Object.entries(dropdownFilters).map(([columnKey, values]) =>
                  values.map((value) => {
                    // Check if this column is a settings field
                    const column = columns.find(col => col.key === columnKey);
                    const capability = columnCapabilities.get(columnKey);
                    const isSettingsField = column?.loadDataLabels || capability?.loadDataLabels;

                    // If this is a settings field, look up the color from centralized cache
                    let colorCode: string | undefined;
                    if (isSettingsField) {
                      const datalabel = extractSettingsDatalabel(columnKey);
                      colorCode = getSettingColor(datalabel, value);
                    }

                    const chipColorClass = colorCode ? (COLOR_MAP[colorCode] || COLOR_MAP.gray) : 'bg-dark-100 text-dark-600';

                    return (
                      <div
                        key={`${columnKey}-${value}`}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${chipColorClass}`}
                      >
                        <span className="opacity-75">{getColumnTitle(columnKey)}:</span>
                        <span className="max-w-32 truncate" title={value}>
                          {value}
                        </span>
                        <button
                          onClick={() => removeFilterChip(columnKey, value)}
                          className="ml-1 hover:bg-black/10 rounded-full p-0.5 transition-colors"
                          title={`Remove ${value} filter`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="relative flex flex-col" style={{ maxHeight: 'calc(100vh - 400px)' }}>
        <div
          ref={tableContainerRef}
          className="overflow-y-auto overflow-x-auto scrollbar-elegant"
          style={{
            maxHeight: 'calc(100% - 100px)'}}
          onScroll={handleTableScroll}
        >
          <table
            className="w-full divide-y divide-dark-400"
            style={{
              minWidth: processedColumns.length > 7 ? `${processedColumns.length * 200}px` : '100%',
              tableLayout: processedColumns.length <= 7 ? 'auto' : 'fixed'
            }}
          >
            <thead className="bg-gradient-to-r from-dark-100 to-dark-100/80 sticky top-0 z-30 shadow-sm">
              <tr>
                {processedColumns.map((column, index) => (
                  <th
                    key={column.key}
                    className={`px-6 py-2.5 text-left ${
                      column.sortable ? 'cursor-pointer hover:bg-dark-100/50 transition-colors' : ''
                    } ${processedColumns.length > 7 ? 'min-w-[200px]' : ''} ${
                      index === 0 ? 'sticky left-0 z-40 bg-dark-100 shadow-r' : ''
                    }`}
                    style={{
                      width: processedColumns.length > 7 ? '200px' : (column.width || 'auto'),
                      textAlign: column.align || 'left',
                      color: '#37352F',
                      font: "500 13px / 18px 'Inter', 'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif",
                      outline: 0,
                      backgroundColor: '#FFFFFF'
                    }}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >
                    <div className="flex items-center justify-start">
                      <span className="select-none">{column.title}</span>
                      <div className="flex items-center ml-3 space-x-1">
                        {column.sortable && (
                          <div className="text-dark-600 hover:text-dark-700 transition-colors">
                            {renderSortIcon(column.key)}
                          </div>
                        )}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-dark-100 divide-y divide-dark-400">
              {filteredAndSortedData.map((record, index) => {
                const recordId = getRowKey(record, index);
                const isEditing = inlineEditable && editingRow === recordId;
                const isDragging = draggedIndex === index;
                const isDragOver = dragOverIndex === index;

                return (
                  <React.Fragment key={recordId}>
                    {/* Drop indicator line */}
                    {isDragOver && draggedIndex !== null && (
                      <tr className="relative pointer-events-none">
                        <td colSpan={columns.length} className="p-0 h-0">
                          <div className="absolute left-0 right-0 h-1 bg-dark-1000 shadow-sm z-50 animate-pulse"
                               style={{
                                 top: '-2px',
                                 boxShadow: '0 0 8px rgba(107, 114, 128, 0.5)'
                               }}
                          />
                        </td>
                      </tr>
                    )}
                    <tr
                      draggable={allowReordering && !isEditing}
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                      onClick={() => !isEditing && onRowClick?.(record)}
                      className={`group transition-all duration-200 ${
                        isDragging
                          ? 'opacity-40 scale-[0.98] bg-dark-100'
                          : isDragOver
                            ? 'bg-dark-100/50'
                            : ''
                      } ${
                        isEditing
                          ? 'bg-dark-100/30'
                          : allowReordering && !isEditing
                            ? 'cursor-move hover:bg-dark-100/40 hover:shadow-sm'
                            : onRowClick
                              ? 'cursor-pointer hover:bg-gradient-to-r hover:from-dark-50/30 hover:to-transparent hover:shadow-sm'
                              : 'hover:bg-dark-100/30'
                      }`}
                    >
                    {processedColumns.map((column, colIndex) => {
                      // ============================================================================
                      // ACTIONS COLUMN - INLINE EDITING PATTERN (Matches SettingsDataTable)
                      // ============================================================================
                      // When row is being edited:
                      //   - Edit icon (✏️) transforms into Check icon (✓)
                      //   - Cancel (✗) icon appears
                      //   - Other action icons are hidden
                      // When row is NOT being edited:
                      //   - Show all action icons (Edit, Delete, Share, etc.)
                      // ============================================================================
                      if (column.key === '_actions') {
                        return (
                          <td
                            key={column.key}
                            className={`px-6 py-2.5 ${
                              colIndex === 0 ? 'sticky left-0 z-20 bg-dark-100 shadow-r' : ''
                            }`}
                            style={{
                              textAlign: column.align || 'center',
                              boxSizing: 'border-box'
                            }}
                          >
                            <div className="flex items-center justify-center gap-1">
                              {isEditing ? (
                                <>
                                  {/* When editing: Show Check (Save) and X (Cancel) icons */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onSaveInlineEdit?.(record);
                                    }}
                                    className="p-1.5 text-dark-700 hover:text-dark-600 hover:bg-dark-100 rounded transition-colors"
                                    title="Save"
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onCancelInlineEdit?.();
                                    }}
                                    className="p-1.5 text-dark-700 hover:text-dark-600 hover:bg-dark-100 rounded transition-colors"
                                    title="Cancel"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  {/* When not editing: Show all action icons */}
                                  {allActions.map((action) => {
                                    const isDisabled = action.disabled ? action.disabled(record) : false;

                                    const buttonVariants = {
                                      default: 'text-dark-700 hover:text-dark-600 hover:bg-dark-100',
                                      primary: 'text-dark-600 hover:text-dark-600 hover:bg-dark-100',
                                      danger: 'text-red-600 hover:text-red-900 hover:bg-red-50'};

                                    return (
                                      <button
                                        key={action.key}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (!isDisabled) {
                                            action.onClick(record);
                                          }
                                        }}
                                        disabled={isDisabled}
                                        className={`p-1.5 rounded transition-colors ${
                                          isDisabled
                                            ? 'text-gray-300 cursor-not-allowed'
                                            : buttonVariants[action.variant || 'default']
                                        } ${action.className || ''}`}
                                        title={action.label}
                                      >
                                        {action.icon}
                                      </button>
                                    );
                                  })}
                                </>
                              )}
                            </div>
                          </td>
                        );
                      }

                      // Regular data columns
                      // ============================================================================
                      // CENTRALIZED CAPABILITY-BASED RENDERING (TRUE DRY)
                      // ============================================================================

                      // Get auto-detected capability for this field
                      const capability = columnCapabilities.get(column.key);
                      const fieldEditable = capability?.inlineEditable || false;
                      const editType = capability?.editType || 'text';
                      const isFileField = capability?.isFileUpload || false;

                      // Get settings options if available
                      const hasSettingOptions = settingOptions.has(column.key);
                      const columnOptions = hasSettingOptions ? settingOptions.get(column.key)! : [];

                      return (
                        <td
                          key={column.key}
                          className={`px-6 py-2.5 ${
                            colIndex === 0 ? 'sticky left-0 z-20 bg-dark-100 shadow-r' : ''
                          }`}
                          style={{
                            textAlign: column.align || 'left',
                            boxSizing: 'border-box'
                          }}
                          onClick={(e) => isEditing && e.stopPropagation()}
                        >
                          {isEditing && fieldEditable ? (
                            // ============================================================================
                            // EDIT MODE - Universal Field Renderer
                            // ============================================================================
                            // Special cases that need custom components
                            editType === 'file' ? (
                              // FILE UPLOAD - Complex drag-drop component
                              <InlineFileUploadCell
                                value={(record as any)[column.key]}
                                entityCode={onEdit ? 'artifact' : 'cost'}
                                entityId={(record as any).id}
                                fieldName={column.key}
                                accept={capability?.acceptedFileTypes}
                                onUploadComplete={(fileUrl) => onInlineEdit?.(recordId, column.key, fileUrl)}
                                disabled={false}
                              />
                            ) : column.key === 'color_code' && colorOptions ? (
                              // COLOR PICKER - Entity-specific field for settings tables
                              <div className="relative w-full">
                                <select
                                  value={editedData[column.key] ?? (record as any)[column.key] ?? ''}
                                  onChange={(e) => onInlineEdit?.(recordId, column.key, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full px-2.5 py-1.5 pr-8 border border-dark-400 rounded-md focus:ring-2 focus:ring-dark-700/30 focus:border-dark-400 bg-dark-100 shadow-sm hover:border-dark-400 transition-colors cursor-pointer appearance-none"
                                  style={{
                                    fontFamily: "'Inter', 'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif",
                                    fontSize: '14px',
                                    color: '#37352F',
                                    minHeight: '32px',
                                    maxHeight: '32px',
                                    lineHeight: '1.2'
                                  }}
                                >
                                  <option value="" className="text-dark-600">Select color...</option>
                                  {colorOptions.map(opt => (
                                    <option key={opt.value} value={opt.value} className="text-dark-600 py-1.5">
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown className="h-4 w-4 text-dark-700 absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                              </div>
                            ) : editType === 'select' && hasSettingOptions ? (
                              // SETTINGS DROPDOWN - ColoredDropdown component for dl__* fields
                              <ColoredDropdown
                                value={editedData[column.key] ?? (record as any)[column.key] ?? ''}
                                options={columnOptions}
                                onChange={(value) => onInlineEdit?.(recordId, column.key, value)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              // ALL OTHER FIELDS - Universal renderer handles text, number, date, boolean, etc.
                              <div onClick={(e) => e.stopPropagation()}>
                                {renderField({
                                  fieldKey: column.key,
                                  value: editedData[column.key] ?? (record as any)[column.key],
                                  mode: 'edit',
                                  onChange: (key, val) => onInlineEdit?.(recordId, key, val),
                                  inlineMode: true,
                                  data: record
                                })}
                              </div>
                            )
                          ) : (
                            // ============================================================================
                            // VIEW MODE - Universal Field Renderer
                            // ============================================================================
                            <div
                              style={{
                                position: 'relative',
                                zIndex: 1,
                                textOverflow: 'ellipsis',
                                padding: '2px 8px',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                fontFamily: "'Inter', 'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif",
                                fontSize: '14px',
                                color: '#37352F',
                                userSelect: 'none',
                                cursor: 'inherit'
                              } as React.CSSProperties}
                            >
                              {renderField({
                                fieldKey: column.key,
                                value: (record as any)[column.key],
                                mode: 'view',
                                customRender: column.render,
                                data: record,
                                loadDataLabels: column.loadDataLabels
                              })}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredAndSortedData.length === 0 && !loading && !allowAddRow && (
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

      {/* Add Row Button - Adds inline editable row */}
      {allowAddRow && (
        <div className="border-t border-dark-300 bg-dark-100">
          <button
            onClick={handleStartAddRow}
            className="w-full px-6 py-3 text-left text-sm text-dark-700 hover:bg-dark-100 transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add new row</span>
          </button>
        </div>
      )}

      <div className="flex-shrink-0 mt-4">
        <PaginationComponent />
      </div>
    </div>
  );
}

// ============================================================================
// BACKWARDS COMPATIBILITY EXPORTS
// ============================================================================
// For existing code that imports "DataTable" - will be deprecated later
export const DataTable = EntityDataTable;
export type DataTableProps<T = any> = EntityDataTableProps<T>;