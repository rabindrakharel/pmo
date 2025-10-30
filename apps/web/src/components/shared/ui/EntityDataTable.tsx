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
import { ChevronDown, ChevronUp, Search, Filter, Columns, ChevronLeft, ChevronRight, Edit, Share, Trash2, X, Plus, Check } from 'lucide-react';
import {
  isSettingField,
  loadFieldOptions,
  type SettingOption
} from '../../../lib/settingsLoader';
import {
  detectColumnCapabilities,
  type FieldCapability,
  formatCurrency,
  isCurrencyField,
  renderSettingBadge,
  COLOR_MAP,
  getSettingColor,
  loadSettingsColors
} from '../../../lib/data_transform_render';
import { InlineFileUploadCell } from '../file/InlineFileUploadCell';
import { getColumnWidth } from '../../../lib/entityConfig';

/**
 * Helper function to render cell value with automatic currency formatting
 */
function renderCellValue(column: Column, value: any): React.ReactNode {
  // Return empty state if no value
  if (value === null || value === undefined || value === '') {
    return <span className="text-gray-400 italic">—</span>;
  }

  // Auto-format currency fields
  if (isCurrencyField(column.key) && typeof value === 'number') {
    return formatCurrency(value);
  }

  // Default: toString
  return value.toString();
}

/**
 * Extract settings datalabel from column key
 * Examples: 'project_stage' -> 'project_stage', 'opportunity_funnel_stage_name' -> 'opportunity_funnel_stage'
 */
function extractSettingsDatalabel(columnKey: string): string {
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

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);
  const selectedColor = selectedOption?.metadata?.color_code;

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Selected value display */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick(e);
          setDropdownOpen(!dropdownOpen);
        }}
        className="w-full px-2.5 py-1.5 pr-8 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400/30 focus:border-gray-300 bg-white shadow-sm hover:border-gray-300 transition-colors cursor-pointer text-left"
        style={{
          fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
          fontSize: '13px',
          minHeight: '32px',
          maxHeight: '32px',
        }}
      >
        {selectedOption ? (
          renderSettingBadge(selectedColor, String(selectedOption.label))
        ) : (
          <span className="text-gray-400">Select...</span>
        )}
      </button>
      <ChevronDown className="h-4 w-4 text-gray-500 absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none" />

      {/* Dropdown menu */}
      {dropdownOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
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
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors flex items-center"
                >
                  {renderSettingBadge(optionColor, String(opt.label))}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export interface Column<T = any> {
  key: string;
  title: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: any, record: T, allData?: T[]) => React.ReactNode;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  // For inline editing with dynamic options
  editable?: boolean;
  editType?: 'text' | 'select' | 'number' | 'date';
  loadOptionsFromSettings?: boolean;
  /**
   * Static options for inline editing dropdowns (alternative to loadOptionsFromSettings)
   * Use this when options are hardcoded (e.g., color_code field in settings tables)
   */
  options?: SettingOption[];
  /**
   * When true, this column can be edited inline in the DataTable.
   * Fields with loadOptionsFromSettings automatically become editable with dropdowns.
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
  columns: Column<T>[];
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
  // Note: Permission checking removed - handled at API level via RBAC joins
}

export function EntityDataTable<T = any>({
  data,
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
}: EntityDataTableProps<T>) {
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(initialColumns.map(col => col.key))
  );
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [dropdownFilters, setDropdownFilters] = useState<Record<string, string[]>>({});
  const [selectedFilterColumn, setSelectedFilterColumn] = useState<string>('');
  const [filterSearchTerm, setFilterSearchTerm] = useState<string>('');
  const [showFilterDropdown, setShowFilterDropdown] = useState<boolean>(false);
  const filterContainerRef = useRef<HTMLDivElement | null>(null);
  const columnSelectorRef = useRef<HTMLDivElement | null>(null);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Add row state
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [newRowData, setNewRowData] = useState<Partial<T>>({});

  // ============================================================================
  // CENTRALIZED CAPABILITY DETECTION - TRUE DRY SYSTEM
  // ============================================================================

  // Auto-detect field capabilities based on naming conventions (Convention over Configuration)
  const columnCapabilities = useMemo(() => detectColumnCapabilities(initialColumns), [initialColumns]);

  // State for dynamically loaded setting options
  const [settingOptions, setSettingOptions] = useState<Map<string, SettingOption[]>>(new Map());

  // Load setting options for columns that need them (auto-detected)
  useEffect(() => {
    const loadAllSettingOptions = async () => {
      const optionsMap = new Map<string, SettingOption[]>();

      // First, add static options from column definitions
      initialColumns.forEach(col => {
        if (col.options && col.options.length > 0) {
          optionsMap.set(col.key, col.options);
        }
      });

      // Find all columns that need dynamic settings using capability detection
      const columnsNeedingSettings = initialColumns.filter(col => {
        const capability = columnCapabilities.get(col.key);
        return capability?.loadOptionsFromSettings;
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
  }, [initialColumns, inlineEditable, columnCapabilities]);

  // Preload colors for all settings columns (for filter dropdowns and inline edit)
  useEffect(() => {
    const preloadColors = async () => {
      // Find all columns with loadOptionsFromSettings
      const settingsColumns = initialColumns.filter(col => {
        const capability = columnCapabilities.get(col.key);
        return col.loadOptionsFromSettings || capability?.loadOptionsFromSettings;
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
  }, [initialColumns, columnCapabilities, filterable, inlineEditable]);

  // Selection functionality - only one row at a time (radio behavior)
  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    // Clear selection when "select all" is unchecked
    onSelectionChange([]);
  };

  const handleSelectRow = (rowKey: string, checked: boolean) => {
    if (!onSelectionChange) return;

    // Only allow one selection at a time (radio button behavior)
    if (checked) {
      onSelectionChange([rowKey]);
    } else {
      onSelectionChange([]);
    }
  };

  const isAllSelected = false; // Disabled "select all" for single-selection mode
  const isIndeterminate = false;

  const getRowKey = (record: T, index: number): string => {
    if (typeof rowKey === 'function') {
      return rowKey(record);
    }
    return (record as any)[rowKey] || index.toString();
  };

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
        variant: 'primary',
      });
    }

    if (onShare) {
      actions.push({
        key: 'share',
        label: 'Share',
        icon: <Share className="h-4 w-4" />,
        onClick: onShare,
        variant: 'default',
      });
    }

    if (onDelete) {
      actions.push({
        key: 'delete',
        label: 'Delete',
        icon: <Trash2 className="h-4 w-4" />,
        onClick: onDelete,
        variant: 'danger',
      });
    }

    return actions;
  }, [onEdit, onShare, onDelete]);

  const allActions = useMemo(() => {
    return showDefaultActions ? [...defaultActions, ...rowActions] : rowActions;
  }, [defaultActions, rowActions, showDefaultActions]);

  const columns = useMemo(() => {
    let processedColumns = initialColumns.filter(col => visibleColumns.has(col.key));

    // Add selection column if selectable
    if (selectable) {
      const selectionColumn: Column<T> = {
        key: '_selection',
        title: '',
        width: 50,
        align: 'center',
        render: (_, record) => {
          const recordId = getRowKey(record, 0);
          const isSelected = selectedRows.includes(recordId);
          return (
            <input
              type="radio"
              checked={isSelected}
              onChange={(e) => handleSelectRow(recordId, e.target.checked)}
              className="h-4 w-4 text-gray-600 border-gray-300 focus:ring-gray-500 cursor-pointer"
              onClick={(e) => e.stopPropagation()}
              name="row-selection"
            />
          );
        },
      };
      processedColumns = [selectionColumn, ...processedColumns];
    }

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
                  default: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
                  primary: 'text-gray-700 hover:text-gray-900 hover:bg-gray-100',
                  danger: 'text-red-600 hover:text-red-900 hover:bg-red-50',
                };

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
        },
      };

      processedColumns = [...processedColumns, actionsColumn];
    }

    return processedColumns;
  }, [initialColumns, visibleColumns, allActions, selectable, selectedRows, handleSelectRow, handleSelectAll, isAllSelected, isIndeterminate]);

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
    return initialColumns.find(col => col.key === columnKey)?.title || columnKey;
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

  // Add row handlers
  const handleStartAddRow = () => {
    setIsAddingRow(true);
    setNewRowData({});
  };

  const handleSaveNewRow = () => {
    // Basic validation - ensure at least one field is filled
    const hasData = Object.values(newRowData).some(val => val !== null && val !== undefined && val !== '');
    if (!hasData) {
      alert('Please fill in at least one field');
      return;
    }
    onAddRow?.(newRowData);
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
      <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gradient-to-r from-gray-50/50 to-white">
        <div className="flex items-center text-sm text-gray-600">
          <span className="font-normal">
            {loading ? (
              <>Loading...</>
            ) : (
              <>Showing <span className="text-gray-900">{startRecord}</span> to <span className="text-gray-900">{endRecord}</span> of <span className="text-gray-900">{actualTotal}</span> results</>
            )}
          </span>
          {showSizeChanger && (
            <select
              value={pageSize}
              onChange={(e) => onChange?.(1, Number(e.target.value))}
              className="ml-6 px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-gray-400/30 focus:border-gray-300 transition-all duration-200"
            >
              {pageSizeOptions.map(size => (
                <option key={size} value={size}>{size} per page</option>
              ))}
            </select>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onChange?.(current - 1, pageSize)}
            disabled={current <= 1 || actualTotal === 0}
            className="p-2 border border-gray-200 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white hover:border-gray-300 hover:shadow-sm transition-all duration-200 bg-white/50"
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
                  key={pageNum}
                  onClick={() => onChange?.(pageNum, pageSize)}
                  className={`px-3 py-1.5 text-sm border rounded-lg font-normal transition-all duration-200 ${
                    current === pageNum
                      ? 'bg-gray-100 text-gray-900 border-gray-300 shadow-sm'
                      : 'border-gray-200 bg-white/70 hover:bg-white hover:border-gray-300 hover:shadow-sm text-gray-700'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => onChange?.(current + 1, pageSize)}
            disabled={current >= totalPages || actualTotal === 0}
            className="p-2 border border-gray-200 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white hover:border-gray-300 hover:shadow-sm transition-all duration-200 bg-white/50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300"></div>
          <span className="ml-3 text-gray-600">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col m-1 h-full ${className}`}>
      {(filterable || columnSelection) && (
        <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-50/50 border-b border-gray-100">
          {filterable && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="flex items-center text-sm text-gray-700">
                  <Filter className="h-4 w-4 text-gray-500 stroke-[1.5] mr-2" />
                  <span className="font-normal text-sm text-gray-600">Filter by:</span>
                </div>
                
                <div className="relative">
                  <select
                    value={selectedFilterColumn}
                    onChange={(e) => setSelectedFilterColumn(e.target.value)}
                    className="appearance-none px-4 py-1.5 pr-10 w-48 border border-gray-300 rounded-xl text-sm bg-white hover:bg-gray-50 focus:ring-2 focus:ring-gray-400/30 focus:border-gray-300 transition-all duration-200 shadow-sm font-normal text-gray-700"
                  >
                    <option value="" className="text-gray-500">Select column...</option>
                    {initialColumns.filter(col => col.filterable).map(column => (
                      <option key={column.key} value={column.key}>
                        {column.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="h-4 w-4 text-gray-400 absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                </div>

                {selectedFilterColumn && (
                  <div className="relative" ref={filterContainerRef}>
                    <div className="relative">
                      <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Type to filter values..."
                        value={filterSearchTerm}
                        onChange={(e) => {
                          setFilterSearchTerm(e.target.value);
                          setShowFilterDropdown(true);
                        }}
                        onFocus={() => setShowFilterDropdown(true)}
                        className="pl-10 pr-4 py-1.5 w-64 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-gray-400/30 focus:border-gray-300 transition-all duration-200"
                      />
                    </div>

                    {showFilterDropdown && (
                      <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 backdrop-blur-sm max-h-64 overflow-y-auto">
                        <div className="p-2">
                          {getColumnOptions(selectedFilterColumn)
                            .filter(option =>
                              option.toLowerCase().includes(filterSearchTerm.toLowerCase())
                            )
                            .map((option) => {
                              // Check if this column has settings options loaded
                              const selectedColumn = initialColumns.find(col => col.key === selectedFilterColumn);
                              const capability = columnCapabilities.get(selectedFilterColumn);
                              const isSettingsField = selectedColumn?.loadOptionsFromSettings || capability?.loadOptionsFromSettings;

                              // If this is a settings field, look up the color from centralized cache
                              let colorCode: string | undefined;
                              if (isSettingsField) {
                                const datalabel = extractSettingsDatalabel(selectedFilterColumn);
                                colorCode = getSettingColor(datalabel, option);
                              }

                              return (
                                <label
                                  key={option}
                                  className="flex items-center px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group"
                                >
                                  <input
                                    type="checkbox"
                                    checked={(dropdownFilters[selectedFilterColumn] || []).includes(option)}
                                    onChange={(e) => handleDropdownFilter(selectedFilterColumn, option, e.target.checked)}
                                    className="mr-3 text-gray-600 rounded focus:ring-gray-500 focus:ring-offset-0 flex-shrink-0"
                                  />
                                  <div className="flex-1 min-w-0">
                                    {isSettingsField ? (
                                      // Settings field - always render badge (with or without color)
                                      colorCode ? renderSettingBadge(colorCode, option) : renderSettingBadge(undefined, option)
                                    ) : (
                                      // Non-settings field - render text
                                      <span className="text-sm text-gray-700 group-hover:text-gray-900 truncate">{option}</span>
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
                            <div className="px-2 py-1.5 text-xs text-gray-500 text-center">
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
                    className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {columnSelection && (
                <div className="relative" ref={columnSelectorRef}>
                  <button
                    onClick={() => setShowColumnSelector(!showColumnSelector)}
                    className="flex items-center px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-50 hover:border-gray-300 transition-colors"
                  >
                    <Columns className="h-4 w-4 mr-2 stroke-[1.5]" />
                    Columns
                  </button>

                  {showColumnSelector && (
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                      <div className="p-2">
                        <div className="text-sm font-normal text-gray-500 mb-2 px-1">Show Columns</div>
                        {initialColumns.map(column => (
                          <label key={column.key} className="flex items-center px-3 py-1.5 hover:bg-gray-50 rounded cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={visibleColumns.has(column.key)}
                              onChange={() => toggleColumnVisibility(column.key)}
                              className="mr-3 text-gray-600 rounded focus:ring-gray-400"
                            />
                            <span className="text-sm text-gray-700">{column.title}</span>
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
                  className="flex items-center px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-50 hover:border-gray-300 transition-colors"
                >
                  <Columns className="h-4 w-4 mr-2 stroke-[1.5]" />
                  Columns
                </button>

                {showColumnSelector && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                    <div className="p-2">
                      <div className="text-sm font-normal text-gray-500 mb-2 px-1">Show Columns</div>
                      {initialColumns.map(column => (
                        <label key={column.key} className="flex items-center px-3 py-1.5 hover:bg-gray-50 rounded cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={visibleColumns.has(column.key)}
                            onChange={() => toggleColumnVisibility(column.key)}
                            className="mr-3 text-gray-600 rounded focus:ring-gray-400"
                          />
                          <span className="text-sm text-gray-700">{column.title}</span>
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
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-xs text-gray-500 font-medium">Active filters:</span>
                {Object.entries(dropdownFilters).map(([columnKey, values]) =>
                  values.map((value) => {
                    // Check if this column is a settings field
                    const column = initialColumns.find(col => col.key === columnKey);
                    const capability = columnCapabilities.get(columnKey);
                    const isSettingsField = column?.loadOptionsFromSettings || capability?.loadOptionsFromSettings;

                    // If this is a settings field, look up the color from centralized cache
                    let colorCode: string | undefined;
                    if (isSettingsField) {
                      const datalabel = extractSettingsDatalabel(columnKey);
                      colorCode = getSettingColor(datalabel, value);
                    }

                    const chipColorClass = colorCode ? (COLOR_MAP[colorCode] || COLOR_MAP.gray) : 'bg-gray-100 text-gray-800';

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
        <div className={`overflow-y-auto ${
          columns.length > 7 
            ? 'overflow-x-scroll scrollbar-always-visible' 
            : 'overflow-x-auto scrollbar-elegant'
        }`} style={{ maxHeight: 'calc(100% - 100px)' }}>
          <table 
            className="w-full" 
            style={{ 
              minWidth: columns.length > 7 ? `${columns.length * 200}px` : '100%',
              tableLayout: columns.length <= 7 ? 'auto' : 'fixed'
            }}
          >
            <thead className="bg-gradient-to-r from-gray-50 to-gray-50/80 sticky top-0 z-30 shadow-sm">
              <tr>
                {columns.map((column, index) => (
                  <th
                    key={column.key}
                    className={`px-6 py-2.5 text-left border-r border-gray-200 ${
                      column.sortable ? 'cursor-pointer hover:bg-gray-100/50 transition-colors' : ''
                    } ${columns.length > 7 ? 'min-w-[200px]' : ''} ${
                      index === 0 ? 'sticky left-0 z-40 bg-gray-50 shadow-r' : ''
                    }`}
                    style={{
                      width: columns.length > 7 ? '200px' : (getColumnWidth(column.key, column.width) || 'auto'),
                      textAlign: column.align || 'left',
                      color: '#6b6d70',
                      font: "400 12px / 16px 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
                      outline: 0,
                      backgroundColor: '#fff'
                    }}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >
                    {column.key === '_selection' ? (
                      <div className="flex items-center justify-center">
                        {/* Empty header for single-selection mode */}
                      </div>
                    ) : (
                      <div className="flex items-center justify-start">
                        <span className="select-none">{column.title}</span>
                        <div className="flex items-center ml-3 space-x-1">
                          {column.sortable && (
                            <div className="text-gray-400 hover:text-gray-600 transition-colors">
                              {renderSortIcon(column.key)}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
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
                          <div className="absolute left-0 right-0 h-1 bg-gray-500 shadow-lg z-50 animate-pulse"
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
                          ? 'opacity-40 scale-[0.98] bg-gray-100'
                          : isDragOver
                            ? 'bg-gray-100/50'
                            : ''
                      } ${
                        isEditing
                          ? 'bg-gray-50/30'
                          : allowReordering && !isEditing
                            ? 'cursor-move hover:bg-gray-100/40 hover:shadow-md'
                            : onRowClick
                              ? 'cursor-pointer hover:bg-gradient-to-r hover:from-gray-50/30 hover:to-transparent hover:shadow-sm'
                              : 'hover:bg-gray-50/30'
                      }`}
                    >
                    {columns.map((column, colIndex) => {
                      // Special handling for selection column
                      if (column.key === '_selection') {
                        return (
                          <td
                            key={column.key}
                            className={`px-6 py-2.5 ${
                              colIndex === 0 ? 'sticky left-0 z-20 bg-white shadow-r' : ''
                            }`}
                            style={{
                              textAlign: column.align || 'left',
                              boxSizing: 'border-box'
                            }}
                          >
                            <div
                              style={{
                                position: 'relative',
                                zIndex: 1,
                                textOverflow: 'ellipsis',
                                padding: '2px 8px',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
                                fontSize: '13px',
                                color: '#333'
                              }}
                            >
                              {column.render
                                ? column.render((record as any)[column.key], record, data)
                                : renderCellValue(column, (record as any)[column.key])
                              }
                            </div>
                          </td>
                        );
                      }

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
                              colIndex === 0 ? 'sticky left-0 z-20 bg-white shadow-r' : ''
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
                                    className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                                    title="Save"
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onCancelInlineEdit?.();
                                    }}
                                    className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
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
                                      default: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
                                      primary: 'text-gray-700 hover:text-gray-900 hover:bg-gray-100',
                                      danger: 'text-red-600 hover:text-red-900 hover:bg-red-50',
                                    };

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
                            colIndex === 0 ? 'sticky left-0 z-20 bg-white shadow-r' : ''
                          }`}
                          style={{
                            textAlign: column.align || 'left',
                            boxSizing: 'border-box'
                          }}
                          onClick={(e) => isEditing && e.stopPropagation()}
                        >
                          {isEditing && fieldEditable ? (
                            // FILE UPLOAD FIELD (drag-drop)
                            editType === 'file' ? (
                              <InlineFileUploadCell
                                value={(record as any)[column.key]}
                                entityType={onEdit ? 'artifact' : 'cost'} // Inferred from context
                                entityId={(record as any).id}
                                fieldName={column.key}
                                accept={capability?.acceptedFileTypes}
                                onUploadComplete={(fileUrl) => onInlineEdit?.(recordId, column.key, fileUrl)}
                                disabled={false}
                              />
                            ) :
                            // COLOR PICKER FIELD (for settings entities)
                            column.key === 'color_code' && colorOptions ? (
                              <div className="relative w-full">
                                <select
                                  value={editedData[column.key] ?? (record as any)[column.key] ?? ''}
                                  onChange={(e) => onInlineEdit?.(recordId, column.key, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full px-2.5 py-1.5 pr-8 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400/30 focus:border-gray-300 bg-white shadow-sm hover:border-gray-300 transition-colors cursor-pointer appearance-none"
                                  style={{
                                    fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
                                    fontSize: '13px',
                                    color: '#333',
                                    minHeight: '32px',
                                    maxHeight: '32px',
                                    lineHeight: '1.2'
                                  }}
                                >
                                  <option value="" className="text-gray-400">Select color...</option>
                                  {colorOptions.map(opt => (
                                    <option key={opt.value} value={opt.value} className="text-gray-900 py-1.5">
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                                {/* Custom dropdown arrow */}
                                <ChevronDown className="h-4 w-4 text-gray-500 absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                              </div>
                            ) :
                            // SETTINGS DROPDOWN FIELD WITH COLORED BADGES
                            editType === 'select' && hasSettingOptions ? (
                              <ColoredDropdown
                                value={editedData[column.key] ?? (record as any)[column.key] ?? ''}
                                options={columnOptions}
                                onChange={(value) => onInlineEdit?.(recordId, column.key, value)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) :
                            // TAGS FIELD (comma-separated text)
                            editType === 'tags' ? (
                              <input
                                type="text"
                                value={editedData[column.key] ?? (record as any)[column.key] ?? ''}
                                onChange={(e) => onInlineEdit?.(recordId, column.key, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="Enter tags (comma-separated)"
                                className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-gray-500 focus:border-gray-300"
                                style={{
                                  fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
                                  fontSize: '13px',
                                  color: '#333'
                                }}
                              />
                            ) :
                            // NUMBER FIELD
                            editType === 'number' ? (
                              <input
                                type="number"
                                value={editedData[column.key] ?? (record as any)[column.key] ?? ''}
                                onChange={(e) => onInlineEdit?.(recordId, column.key, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-gray-500 focus:border-gray-300"
                                style={{
                                  fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
                                  fontSize: '13px',
                                  color: '#333'
                                }}
                              />
                            ) :
                            // DATE FIELD
                            editType === 'date' ? (
                              <input
                                type="date"
                                value={(() => {
                                  const dateValue = editedData[column.key] ?? (record as any)[column.key];
                                  if (!dateValue) return '';
                                  // Format to yyyy-MM-dd if it's a full ISO timestamp
                                  try {
                                    const date = new Date(dateValue);
                                    if (isNaN(date.getTime())) return '';
                                    return date.toISOString().split('T')[0];
                                  } catch {
                                    return '';
                                  }
                                })()}
                                onChange={(e) => onInlineEdit?.(recordId, column.key, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-gray-500 focus:border-gray-300"
                                style={{
                                  fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
                                  fontSize: '13px',
                                  color: '#333'
                                }}
                              />
                            ) : (
                              // TEXT FIELD (default)
                              <input
                                type="text"
                                value={editedData[column.key] ?? (record as any)[column.key] ?? ''}
                                onChange={(e) => onInlineEdit?.(recordId, column.key, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-gray-500 focus:border-gray-300"
                                style={{
                                  fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
                                  fontSize: '13px',
                                  color: '#333'
                                }}
                              />
                            )
                          ) : (
                            // Display mode for all fields (editable or not)
                            <div
                              style={{
                                position: 'relative',
                                zIndex: 1,
                                textOverflow: 'ellipsis',
                                padding: '2px 8px',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
                                fontSize: '13px',
                                color: '#333',
                                userSelect: 'none',
                                cursor: 'default'
                              } as React.CSSProperties}
                            >
                              {column.render
                                ? column.render((record as any)[column.key], record, data)
                                : renderCellValue(column, (record as any)[column.key])
                              }
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
            <p className="text-gray-500">No data found</p>
          </div>
        )}
      </div>

      {/* Add Row Button/Form - Match SettingsDataTable styling */}
      {allowAddRow && (
        <div className="border-t border-gray-200 bg-white">
          {!isAddingRow ? (
            <button
              onClick={handleStartAddRow}
              className="w-full px-6 py-3 text-left text-sm text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add new row</span>
            </button>
          ) : (
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {columns
                  .filter(col => col.key !== '_selection' && col.key !== '_actions')
                  .filter(col => visibleColumns.has(col.key))
                  .map(column => {
                    const capability = columnCapabilities.get(column.key);
                    const editType = capability?.editType || 'text';
                    const hasSettingOptions = settingOptions.has(column.key);
                    const columnOptions = hasSettingOptions ? settingOptions.get(column.key)! : [];

                    return (
                      <div key={column.key}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {column.title}
                        </label>

                        {/* Render appropriate input based on edit type */}
                        {editType === 'select' && hasSettingOptions ? (
                          <ColoredDropdown
                            value={(newRowData as any)[column.key] ?? ''}
                            options={columnOptions}
                            onChange={(value) => setNewRowData({ ...newRowData, [column.key]: value } as Partial<T>)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : editType === 'number' ? (
                          <input
                            type="number"
                            value={(newRowData as any)[column.key] ?? ''}
                            onChange={(e) => setNewRowData({ ...newRowData, [column.key]: e.target.value } as Partial<T>)}
                            placeholder={`Enter ${column.title.toLowerCase()}`}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400/30 focus:border-blue-300 text-sm"
                          />
                        ) : editType === 'date' ? (
                          <input
                            type="date"
                            value={(newRowData as any)[column.key] ?? ''}
                            onChange={(e) => setNewRowData({ ...newRowData, [column.key]: e.target.value } as Partial<T>)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400/30 focus:border-blue-300 text-sm"
                          />
                        ) : column.key === 'color_code' && colorOptions ? (
                          <select
                            value={(newRowData as any)[column.key] ?? ''}
                            onChange={(e) => setNewRowData({ ...newRowData, [column.key]: e.target.value } as Partial<T>)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400/30 focus:border-blue-300 text-sm"
                          >
                            <option value="">Select color...</option>
                            {colorOptions.map(opt => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={(newRowData as any)[column.key] ?? ''}
                            onChange={(e) => setNewRowData({ ...newRowData, [column.key]: e.target.value } as Partial<T>)}
                            placeholder={`Enter ${column.title.toLowerCase()}`}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400/30 focus:border-blue-300 text-sm"
                          />
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* Action Buttons - Match SettingsDataTable styling */}
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={handleSaveNewRow}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-md hover:bg-gray-50 hover:border-gray-400 transition-colors text-sm shadow-sm"
                >
                  <Check className="h-4 w-4" />
                  Save
                </button>
                <button
                  onClick={handleCancelAddRow}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-600 bg-white rounded-md hover:bg-gray-50 hover:border-gray-400 transition-colors text-sm"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
              </div>
            </div>
          )}
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