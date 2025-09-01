import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Search, Filter, Columns, ChevronLeft, ChevronRight, Eye, Edit, Share, Trash2, X } from 'lucide-react';

export interface Column<T = any> {
  key: string;
  title: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: any, record: T) => React.ReactNode;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
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
}: DataTableProps<T>) {
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(initialColumns.map(col => col.key))
  );
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [dropdownFilters, setDropdownFilters] = useState<Record<string, string[]>>({});
  const [dropdownSearchTerms, setDropdownSearchTerms] = useState<Record<string, string>>({});
  const filterRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

  // Handle clicking outside dropdown to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeFilter && filterRefs.current[activeFilter]) {
        const filterElement = filterRefs.current[activeFilter];
        if (filterElement && !filterElement.contains(event.target as Node)) {
          setActiveFilter(null);
        }
      }
    };

    if (activeFilter) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [activeFilter]);

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
    const filteredColumns = initialColumns.filter(col => visibleColumns.has(col.key));
    
    // Add actions column if there are any actions
    if (allActions.length > 0) {
      const actionsColumn: Column<T> = {
        key: '_actions',
        title: 'Actions',
        width: allActions.length > 3 ? 120 : allActions.length * 40,
        align: 'center',
        render: (_, record) => (
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
        ),
      };
      
      return [...filteredColumns, actionsColumn];
    }
    
    return filteredColumns;
  }, [initialColumns, visibleColumns, allActions]);

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    if (searchTerm && searchable) {
      result = result.filter(record => 
        Object.values(record as any).some(value => 
          value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    if (filterable) {
      // Handle text filters
      Object.entries(columnFilters).forEach(([key, filterValue]) => {
        if (filterValue) {
          result = result.filter(record => 
            (record as any)[key]?.toString().toLowerCase().includes(filterValue.toLowerCase())
          );
        }
      });

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
  }, [data, searchTerm, columnFilters, dropdownFilters, sortField, sortDirection, searchable, filterable]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleColumnFilter = (key: string, value: string) => {
    setColumnFilters(prev => ({ ...prev, [key]: value }));
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

  const clearDropdownFilter = (columnKey: string) => {
    setDropdownFilters(prev => ({ ...prev, [columnKey]: [] }));
    setDropdownSearchTerms(prev => ({ ...prev, [columnKey]: '' }));
    setActiveFilter(null);
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

    const { current, pageSize, total, showSizeChanger = true, pageSizeOptions = [10, 20, 50, 100], onChange } = pagination;
    const totalPages = Math.ceil(total / pageSize);
    const startRecord = (current - 1) * pageSize + 1;
    const endRecord = Math.min(current * pageSize, total);

    return (
      <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gradient-to-r from-gray-50/50 to-white">
        <div className="flex items-center text-sm text-gray-600">
          <span className="font-medium">
            Showing <span className="text-gray-900">{startRecord}</span> to <span className="text-gray-900">{endRecord}</span> of <span className="text-gray-900">{total}</span> results
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
            disabled={current <= 1}
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
                  className={`px-3 py-1.5 text-sm border rounded-lg font-medium transition-all duration-200 ${
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
            disabled={current >= totalPages}
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
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${className}`}>
      {(searchable || filterable || columnSelection) && (
        <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-50/50 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {searchable && (
                <div className="relative">
                  <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search across all data..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2.5 w-80 border border-gray-200 rounded-xl text-sm bg-white/50 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 focus:bg-white transition-all duration-200 placeholder:text-gray-400"
                  />
                </div>
              )}
            </div>
            
            {columnSelection && (
              <div className="relative">
                <button
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className="flex items-center px-4 py-2.5 text-sm text-gray-600 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-xl hover:bg-white hover:border-gray-300 transition-all duration-200 shadow-sm"
                >
                  <Columns className="h-4 w-4 mr-2" />
                  Columns
                </button>
                
                {showColumnSelector && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-50 backdrop-blur-sm">
                    <div className="p-3">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 px-1">Show Columns</div>
                      {initialColumns.map(column => (
                        <label key={column.key} className="flex items-center px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={visibleColumns.has(column.key)}
                            onChange={() => toggleColumnVisibility(column.key)}
                            className="mr-3 text-blue-600 rounded focus:ring-blue-500"
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
        </div>
      )}

      <div className="relative">
        <div className="overflow-x-auto overflow-y-auto scrollbar-elegant" style={{ height: '60vh', minHeight: '60vh' }}>
          <table 
            className="w-full h-full" 
            style={{ 
              minWidth: columns.length > 7 ? `${columns.length * 200}px` : '100%',
              tableLayout: columns.length <= 7 ? 'auto' : 'fixed',
              minHeight: '100%'
            }}
          >
            <thead className="bg-gradient-to-r from-gray-50 to-gray-50/80 sticky top-0 z-10 shadow-sm">
              <tr>
                {columns.map((column, index) => (
                  <th
                    key={column.key}
                    className={`px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-100 ${
                      column.sortable ? 'cursor-pointer hover:bg-gray-100/50 transition-colors' : ''
                    } ${columns.length > 7 ? 'min-w-[200px]' : ''} ${
                      index === 0 ? 'sticky left-0 z-30 bg-gray-50 shadow-r' : ''
                    }`}
                    style={{ 
                      width: columns.length > 7 ? '200px' : (column.width || 'auto'), 
                      textAlign: 'left' 
                    }}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >
                    <div className="flex items-center justify-start">
                      <span className="select-none">{column.title}</span>
                      <div className="flex items-center ml-3 space-x-1">
                        {column.sortable && (
                          <div className="text-gray-400 hover:text-gray-600 transition-colors">
                            {renderSortIcon(column.key)}
                          </div>
                        )}
                        {column.filterable && filterable && (
                          <div 
                            className="relative" 
                            ref={(el) => {
                              filterRefs.current[column.key] = el;
                            }}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveFilter(activeFilter === column.key ? null : column.key);
                              }}
                              className={`p-1.5 rounded-md hover:bg-white/80 transition-all duration-200 ${
                                (dropdownFilters[column.key]?.length > 0) 
                                  ? 'text-blue-600 bg-blue-50 shadow-sm' 
                                  : 'text-gray-400 hover:text-gray-600'
                              }`}
                              title="Filter"
                            >
                              <Filter className="h-3 w-3" />
                            </button>
                            
                            {activeFilter === column.key && (
                              <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 backdrop-blur-sm">
                                <div className="p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-semibold text-gray-800">Filter {column.title}</span>
                                    <button
                                      onClick={() => clearDropdownFilter(column.key)}
                                      className="text-xs text-gray-500 hover:text-red-600 flex items-center px-2 py-1 rounded-md hover:bg-red-50 transition-colors"
                                    >
                                      <X className="h-3 w-3 mr-1" />
                                      Clear
                                    </button>
                                  </div>
                                  
                                  <div className="relative mb-3">
                                    <Search className="h-3.5 w-3.5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                                    <input
                                      type="text"
                                      placeholder="Search options..."
                                      value={dropdownSearchTerms[column.key] || ''}
                                      onChange={(e) => setDropdownSearchTerms(prev => ({ ...prev, [column.key]: e.target.value }))}
                                      className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50/50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 focus:bg-white transition-all duration-200"
                                    />
                                  </div>
                                  
                                  <div className="max-h-48 overflow-y-auto">
                                    {getColumnOptions(column.key)
                                      .filter(option => {
                                        const searchTerm = dropdownSearchTerms[column.key] || '';
                                        return option.toLowerCase().includes(searchTerm.toLowerCase());
                                      })
                                      .map((option) => (
                                        <label
                                          key={option}
                                          className="flex items-center px-3 py-2 hover:bg-blue-50/50 rounded-lg cursor-pointer transition-colors group"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={(dropdownFilters[column.key] || []).includes(option)}
                                            onChange={(e) => handleDropdownFilter(column.key, option, e.target.checked)}
                                            className="mr-3 text-blue-600 rounded focus:ring-blue-500 focus:ring-offset-0"
                                          />
                                          <span className="text-sm text-gray-700 truncate group-hover:text-gray-900">{option}</span>
                                        </label>
                                      ))
                                    }
                                    {getColumnOptions(column.key)
                                      .filter(option => {
                                        const searchTerm = dropdownSearchTerms[column.key] || '';
                                        return option.toLowerCase().includes(searchTerm.toLowerCase());
                                      }).length === 0 && (
                                      <div className="px-2 py-3 text-xs text-gray-500 text-center">
                                        No options found
                                      </div>
                                    )}
                                  </div>
                                  
                                  {(dropdownFilters[column.key]?.length > 0) && (
                                    <div className="mt-2 pt-2 border-t border-gray-200">
                                      <div className="text-xs text-gray-500">
                                        {dropdownFilters[column.key].length} selected
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100" style={{ height: '100%' }}>
              {filteredAndSortedData.map((record, index) => (
                <tr
                  key={getRowKey(record, index)}
                  onClick={() => onRowClick?.(record)}
                  className={`group transition-all duration-150 ${
                    onRowClick 
                      ? 'cursor-pointer hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-transparent hover:shadow-sm' 
                      : 'hover:bg-gray-50/30'
                  }`}
                >
                  {columns.map((column, index) => (
                    <td
                      key={column.key}
                      className={`px-6 py-4 text-sm text-gray-700 group-hover:text-gray-900 transition-colors ${
                        index === 0 ? 'sticky left-0 z-20 bg-white shadow-r' : ''
                      }`}
                      style={{ textAlign: 'left' }}
                    >
                      {column.render 
                        ? column.render((record as any)[column.key], record)
                        : (record as any)[column.key]?.toString() || (
                          <span className="text-gray-400 italic">—</span>
                        )
                      }
                    </td>
                  ))}
                </tr>
              ))}
              {/* Spacer row to maintain table height */}
              <tr style={{ height: '100%' }}>
                {columns.map((column, index) => (
                  <td
                    key={`spacer-${column.key}`}
                    className={index === 0 ? 'sticky left-0 z-20 bg-white' : ''}
                    style={{ border: 'none', padding: 0 }}
                  >
                    &nbsp;
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        
        {filteredAndSortedData.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No data found</p>
          </div>
        )}
      </div>

      <PaginationComponent />
    </div>
  );
}