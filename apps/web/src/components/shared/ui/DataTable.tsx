import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Search, Filter, Columns, ChevronLeft, ChevronRight, Eye, Edit, Share, Trash2, X } from 'lucide-react';
import {
  isSettingField,
  loadFieldOptions,
  type SettingOption
} from '../../../lib/settingsLoader';
import { detectColumnCapabilities, type FieldCapability } from '../../../lib/fieldCapabilities';
import { InlineFileUploadCell } from '../file/InlineFileUploadCell';

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

export interface DataTableProps<T = any> {
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
  onView?: (record: T) => void;
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
  // Note: Permission checking removed - handled at API level via RBAC joins
}

export function DataTable<T = any>({
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
  onView,
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
}: DataTableProps<T>) {
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
            const category = capability.settingsCategory || col.key;
            const options = await loadFieldOptions(category);
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
  const defaultActions: RowAction<T>[] = useMemo(() => {
    const actions: RowAction<T>[] = [];
    
    if (onView) {
      actions.push({
        key: 'view',
        label: 'View',
        icon: <Eye className="h-4 w-4" />,
        onClick: onView,
        variant: 'default',
      });
    }
    
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
  }, [onView, onEdit, onShare, onDelete]);

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
              className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
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
                  primary: 'text-blue-600 hover:text-blue-900 hover:bg-blue-50',
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
              className="ml-6 px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all duration-200"
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
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col m-1 ${className}`}>
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
                    className="appearance-none px-4 py-1.5 pr-10 w-48 border border-gray-300 rounded-xl text-sm bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all duration-200 shadow-sm font-normal text-gray-700"
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
                        className="pl-10 pr-4 py-1.5 w-64 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all duration-200"
                      />
                    </div>

                    {showFilterDropdown && (
                      <div className="absolute top-full left-0 mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-xl z-50 backdrop-blur-sm max-h-48 overflow-y-auto">
                        <div className="p-2">
                          {getColumnOptions(selectedFilterColumn)
                            .filter(option => 
                              option.toLowerCase().includes(filterSearchTerm.toLowerCase())
                            )
                            .map((option) => (
                              <label
                                key={option}
                                className="flex items-center px-3 py-1.5 hover:bg-blue-50/50 rounded-lg cursor-pointer transition-colors group"
                              >
                                <input
                                  type="checkbox"
                                  checked={(dropdownFilters[selectedFilterColumn] || []).includes(option)}
                                  onChange={(e) => handleDropdownFilter(selectedFilterColumn, option, e.target.checked)}
                                  className="mr-3 text-blue-600 rounded focus:ring-blue-500 focus:ring-offset-0"
                                />
                                <span className="text-sm text-gray-700 truncate group-hover:text-gray-900">{option}</span>
                              </label>
                            ))
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
                  values.map((value) => (
                    <div
                      key={`${columnKey}-${value}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium"
                    >
                      <span className="text-blue-600">{getColumnTitle(columnKey)}:</span>
                      <span className="max-w-32 truncate" title={value}>
                        {value}
                      </span>
                      <button
                        onClick={() => removeFilterChip(columnKey, value)}
                        className="ml-1 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                        title={`Remove ${value} filter`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))
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
                      width: columns.length > 7 ? '200px' : (column.width || 'auto'),
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

                return (
                  <tr
                    key={recordId}
                    onClick={() => !isEditing && onRowClick?.(record)}
                    className={`group transition-all duration-150 ${
                      isEditing
                        ? 'bg-blue-50/30'
                        : onRowClick
                          ? 'cursor-pointer hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-transparent hover:shadow-sm'
                          : 'hover:bg-gray-50/30'
                    }`}
                  >
                    {columns.map((column, colIndex) => {
                      // Special handling for selection and actions columns
                      if (column.key === '_selection' || column.key === '_actions') {
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
                                : (record as any)[column.key]?.toString() || (
                                  <span className="text-gray-400 italic">—</span>
                                )
                              }
                            </div>
                            {/* Add Save/Cancel buttons for editing row in actions column */}
                            {isEditing && column.key === '_actions' && (
                              <div className="flex items-center gap-2 mt-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSaveInlineEdit?.(record);
                                  }}
                                  className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                  title="Save"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onCancelInlineEdit?.();
                                  }}
                                  className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                                  title="Cancel"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
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
                                accept={capability.acceptedFileTypes}
                                onUploadComplete={(fileUrl) => onInlineEdit?.(recordId, column.key, fileUrl)}
                                disabled={false}
                              />
                            ) :
                            // SETTINGS DROPDOWN FIELD
                            editType === 'select' && hasSettingOptions ? (
                              // Render elegant select dropdown for setting fields
                              <div className="relative w-full">
                                <select
                                  value={editedData[column.key] ?? (record as any)[column.key] ?? ''}
                                  onChange={(e) => onInlineEdit?.(recordId, column.key, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full px-2.5 py-1.5 pr-8 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white shadow-sm hover:border-blue-400 transition-colors cursor-pointer appearance-none"
                                  style={{
                                    fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
                                    fontSize: '13px',
                                    color: '#333',
                                    minHeight: '32px',
                                    maxHeight: '32px',
                                    lineHeight: '1.2'
                                  }}
                                >
                                  <option value="" className="text-gray-400">Select...</option>
                                  {columnOptions.map(opt => (
                                    <option key={opt.value} value={opt.value} className="text-gray-900 py-1.5">
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                                {/* Custom dropdown arrow */}
                                <ChevronDown className="h-4 w-4 text-gray-500 absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                              </div>
                            ) :
                            // TAGS FIELD (comma-separated text)
                            editType === 'tags' ? (
                              <input
                                type="text"
                                value={editedData[column.key] ?? (record as any)[column.key] ?? ''}
                                onChange={(e) => onInlineEdit?.(recordId, column.key, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="Enter tags (comma-separated)"
                                className="w-full px-2 py-1.5 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                                className="w-full px-2 py-1.5 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                                className="w-full px-2 py-1.5 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                                className="w-full px-2 py-1.5 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                                WebkitUserSelect: 'none',
                                MozUserSelect: 'none',
                                msUserSelect: 'none',
                                WebkitTapHighlightColor: 'transparent',
                                WebkitUserDrag: 'none',
                                cursor: 'default'
                              }}
                            >
                              {column.render
                                ? column.render((record as any)[column.key], record, data)
                                : (record as any)[column.key]?.toString() || (
                                  <span className="text-gray-400 italic">—</span>
                                )
                              }
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
        
        {filteredAndSortedData.length === 0 && !loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-gray-500">No data found</p>
          </div>
        )}
      </div>
      
      <div className="flex-shrink-0 mt-4">
        <PaginationComponent />
      </div>
    </div>
  );
}