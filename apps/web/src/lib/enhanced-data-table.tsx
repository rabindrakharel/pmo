/**
 * Enhanced Data Table Component
 * 
 * Advanced sortable, searchable, paginated data table component
 * Built on top of the Universal Schema system for automatic field inference
 * Supports grid/card view toggle, filtering, selection, and bulk operations
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Input,
  Button,
  Badge,
  Checkbox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui';
import {
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Grid3X3,
  List,
  Settings,
  Download,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Edit,
  Trash2,
  Share,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { UniversalField, type UniversalPermissions } from './universal-schema-components';
import { inferTableMetadataFromSample, type TableMetadata } from './schema-inference';

export type SortDirection = 'asc' | 'desc' | null;
export type ViewMode = 'table' | 'grid';

export interface SortConfig {
  column: string;
  direction: SortDirection;
}

export interface FilterConfig {
  column: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan' | 'isEmpty' | 'isNotEmpty';
  value: any;
}

export interface PaginationConfig {
  page: number;
  pageSize: number;
  total: number;
}

export interface SelectionConfig {
  selectedIds: string[];
  selectAll: boolean;
}

export interface EnhancedDataTableProps {
  // Core data
  tableName: string;
  data: Record<string, any>[];
  loading?: boolean;
  error?: string | null;
  
  // Permissions
  permissions?: UniversalPermissions;
  
  // Configuration
  title?: string;
  description?: string;
  searchable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  selectable?: boolean;
  paginated?: boolean;
  exportable?: boolean;
  refreshable?: boolean;
  
  // Display options
  defaultViewMode?: ViewMode;
  defaultPageSize?: number;
  availablePageSizes?: number[];
  hideColumns?: string[];
  pinnedColumns?: string[];
  
  // Actions
  onAction?: (action: string, data?: any) => void;
  onBulkAction?: (action: string, selectedIds: string[]) => void;
  onRefresh?: () => void;
  onExport?: (format: 'csv' | 'json' | 'xlsx') => void;
  
  // Custom components
  customActions?: React.ReactNode;
  customFilters?: React.ReactNode;
  customToolbar?: React.ReactNode;
}

export const EnhancedDataTable: React.FC<EnhancedDataTableProps> = ({
  tableName,
  data,
  loading = false,
  error = null,
  permissions,
  title,
  description,
  searchable = true,
  sortable = true,
  filterable = true,
  selectable = false,
  paginated = true,
  exportable = false,
  refreshable = false,
  defaultViewMode = 'table',
  defaultPageSize = 25,
  availablePageSizes = [10, 25, 50, 100],
  hideColumns = [],
  pinnedColumns = [],
  onAction,
  onBulkAction,
  onRefresh,
  onExport,
  customActions,
  customFilters,
  customToolbar,
}) => {
  // State management
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: '', direction: null });
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [pagination, setPagination] = useState<PaginationConfig>({
    page: 1,
    pageSize: defaultPageSize,
    total: 0,
  });
  const [selection, setSelection] = useState<SelectionConfig>({
    selectedIds: [],
    selectAll: false,
  });
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Infer table metadata from sample data
  const tableMetadata = useMemo<TableMetadata | undefined>(() => {
    if (!data || data.length === 0) return undefined;
    return inferTableMetadataFromSample(tableName, data);
  }, [tableName, data]);

  // Get available columns and their properties
  const availableColumns = useMemo(() => {
    if (!data || data.length === 0) return [];
    const sampleRow = data[0];
    return Object.keys(sampleRow)
      .filter(column => !hideColumns.includes(column))
      .filter(column => {
        const meta = tableMetadata?.columns?.[column];
        return !meta?.['ui:invisible'] && !meta?.['api:auth_field'];
      })
      .map(column => ({
        key: column,
        label: column.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        sortable: sortable && (tableMetadata?.columns?.[column]?.['ui:sort'] || ['name', 'created', 'updated'].includes(column)),
        searchable: searchable && (tableMetadata?.columns?.[column]?.['ui:search'] || ['name', 'description', 'title'].includes(column)),
        filterable: filterable,
        pinned: pinnedColumns.includes(column),
      }));
  }, [data, hideColumns, tableMetadata, sortable, searchable, filterable, pinnedColumns]);

  // Initialize visible columns
  React.useEffect(() => {
    if (availableColumns.length > 0 && visibleColumns.length === 0) {
      setVisibleColumns(availableColumns.map(col => col.key));
    }
  }, [availableColumns, visibleColumns.length]);

  // Get searchable columns
  const searchableColumns = useMemo(() => {
    return availableColumns.filter(col => col.searchable).map(col => col.key);
  }, [availableColumns]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig.column || !sortConfig.direction) return data;
    
    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.column];
      const bValue = b[sortConfig.column];
      
      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      
      const result = aValue < bValue ? -1 : 1;
      return sortConfig.direction === 'asc' ? result : -result;
    });
  }, [data, sortConfig]);

  // Filter data
  const filteredData = useMemo(() => {
    let result = sortedData;

    // Apply search query
    if (searchQuery && searchableColumns.length > 0) {
      const query = searchQuery.toLowerCase();
      result = result.filter(row =>
        searchableColumns.some(column => {
          const value = row[column];
          return String(value || '').toLowerCase().includes(query);
        })
      );
    }

    // Apply filters
    filters.forEach(filter => {
      result = result.filter(row => {
        const value = row[filter.column];
        const filterValue = filter.value;

        switch (filter.operator) {
          case 'equals':
            return value === filterValue;
          case 'contains':
            return String(value || '').toLowerCase().includes(String(filterValue || '').toLowerCase());
          case 'startsWith':
            return String(value || '').toLowerCase().startsWith(String(filterValue || '').toLowerCase());
          case 'endsWith':
            return String(value || '').toLowerCase().endsWith(String(filterValue || '').toLowerCase());
          case 'greaterThan':
            return Number(value) > Number(filterValue);
          case 'lessThan':
            return Number(value) < Number(filterValue);
          case 'isEmpty':
            return !value || value === '' || (Array.isArray(value) && value.length === 0);
          case 'isNotEmpty':
            return value && value !== '' && (!Array.isArray(value) || value.length > 0);
          default:
            return true;
        }
      });
    });

    return result;
  }, [sortedData, searchQuery, searchableColumns, filters]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!paginated) return filteredData;
    
    const startIndex = (pagination.page - 1) * pagination.pageSize;
    const endIndex = startIndex + pagination.pageSize;
    
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, pagination.page, pagination.pageSize, paginated]);

  // Update pagination total when filtered data changes
  React.useEffect(() => {
    setPagination(prev => ({
      ...prev,
      total: filteredData.length,
    }));
  }, [filteredData.length]);

  // Sorting handlers
  const handleSort = useCallback((column: string) => {
    setSortConfig(prev => {
      if (prev.column === column) {
        // Cycle through: asc -> desc -> null
        const direction = prev.direction === 'asc' ? 'desc' : prev.direction === 'desc' ? null : 'asc';
        return { column: direction ? column : '', direction };
      } else {
        return { column, direction: 'asc' };
      }
    });
  }, []);

  // Filter handlers
  const addFilter = useCallback((column: string) => {
    setFilters(prev => [
      ...prev,
      { column, operator: 'contains', value: '' }
    ]);
  }, []);

  const updateFilter = useCallback((index: number, updates: Partial<FilterConfig>) => {
    setFilters(prev => prev.map((filter, i) => 
      i === index ? { ...filter, ...updates } : filter
    ));
  }, []);

  const removeFilter = useCallback((index: number) => {
    setFilters(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Selection handlers
  const toggleSelection = useCallback((id: string) => {
    setSelection(prev => ({
      ...prev,
      selectedIds: prev.selectedIds.includes(id)
        ? prev.selectedIds.filter(selectedId => selectedId !== id)
        : [...prev.selectedIds, id]
    }));
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelection(prev => ({
      selectAll: !prev.selectAll,
      selectedIds: prev.selectAll ? [] : paginatedData.map(row => row.id).filter(Boolean)
    }));
  }, [paginatedData]);

  // Pagination handlers
  const handlePageChange = useCallback((newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  }, []);

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPagination(prev => ({ ...prev, pageSize: newPageSize, page: 1 }));
  }, []);

  // Column visibility handlers
  const toggleColumnVisibility = useCallback((column: string) => {
    setVisibleColumns(prev => 
      prev.includes(column)
        ? prev.filter(col => col !== column)
        : [...prev, column]
    );
  }, []);

  // Action handlers
  const handleAction = useCallback((action: string, data?: any) => {
    onAction?.(action, data);
  }, [onAction]);

  const handleBulkAction = useCallback((action: string) => {
    onBulkAction?.(action, selection.selectedIds);
    setSelection({ selectedIds: [], selectAll: false });
  }, [onBulkAction, selection.selectedIds]);

  // Render sort icon
  const renderSortIcon = (column: string) => {
    if (sortConfig.column !== column) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="h-4 w-4 text-blue-600" />
      : <ArrowDown className="h-4 w-4 text-blue-600" />;
  };

  // Calculate pagination info
  const totalPages = Math.ceil(pagination.total / pagination.pageSize);
  const startItem = (pagination.page - 1) * pagination.pageSize + 1;
  const endItem = Math.min(pagination.page * pagination.pageSize, pagination.total);

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-red-600">
            Error: {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">
              {title || `${tableName.split('.').pop()?.replace(/_/g, ' ')} Management`}
            </h2>
            {description && (
              <p className="text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {permissions?.canCreate && (
              <Button onClick={() => handleAction('create')}>
                <Plus className="h-4 w-4 mr-2" />
                Add New
              </Button>
            )}
            {customActions}
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            {/* Search */}
            {searchable && searchableColumns.length > 0 && (
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={`Search ${searchableColumns.join(', ')}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            )}

            {/* Filters Toggle */}
            {filterable && (
              <Button 
                variant="outline" 
                onClick={() => setShowFilters(!showFilters)}
                className={showFilters ? 'bg-blue-50 border-blue-200' : ''}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {filters.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {filters.length}
                  </Badge>
                )}
              </Button>
            )}

            {/* Bulk Actions */}
            {selectable && selection.selectedIds.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    {selection.selectedIds.length} selected
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleBulkAction('delete')}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkAction('export')}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Selected
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {customFilters}
          </div>

          <div className="flex items-center gap-2">
            {/* Refresh */}
            {refreshable && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={onRefresh}>
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh</TooltipContent>
              </Tooltip>
            )}

            {/* View Mode Toggle */}
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className="rounded-r-none"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-l-none"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
            </div>

            {/* Column Settings */}
            <Popover open={showColumnSettings} onOpenChange={setShowColumnSettings}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Show Columns</h4>
                  {availableColumns.map(column => (
                    <div key={column.key} className="flex items-center space-x-2">
                      <Checkbox
                        checked={visibleColumns.includes(column.key)}
                        onCheckedChange={() => toggleColumnVisibility(column.key)}
                      />
                      <label className="text-sm">{column.label}</label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Export */}
            {exportable && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => onExport?.('csv')}>
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onExport?.('json')}>
                    Export as JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onExport?.('xlsx')}>
                    Export as Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {customToolbar}
          </div>
        </div>

        {/* Active Filters */}
        {showFilters && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Active Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {filters.map((filter, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Select
                    value={filter.column}
                    onValueChange={(value) => updateFilter(index, { column: value })}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableColumns.map(column => (
                        <SelectItem key={column.key} value={column.key}>
                          {column.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={filter.operator}
                    onValueChange={(value: any) => updateFilter(index, { operator: value })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contains">Contains</SelectItem>
                      <SelectItem value="equals">Equals</SelectItem>
                      <SelectItem value="startsWith">Starts with</SelectItem>
                      <SelectItem value="endsWith">Ends with</SelectItem>
                      <SelectItem value="greaterThan">Greater than</SelectItem>
                      <SelectItem value="lessThan">Less than</SelectItem>
                      <SelectItem value="isEmpty">Is empty</SelectItem>
                      <SelectItem value="isNotEmpty">Is not empty</SelectItem>
                    </SelectContent>
                  </Select>

                  {!['isEmpty', 'isNotEmpty'].includes(filter.operator) && (
                    <Input
                      value={filter.value}
                      onChange={(e) => updateFilter(index, { value: e.target.value })}
                      placeholder="Filter value"
                      className="flex-1"
                    />
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFilter(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => addFilter(availableColumns[0]?.key || '')}
                disabled={availableColumns.length === 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Filter
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Data Display */}
        {viewMode === 'table' ? (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    {selectable && (
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selection.selectAll}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                    )}
                    {availableColumns
                      .filter(column => visibleColumns.includes(column.key))
                      .map(column => (
                        <TableHead key={column.key}>
                          <div className="flex items-center gap-2">
                            <span>{column.label}</span>
                            {column.sortable && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSort(column.key)}
                                className="p-0 h-auto"
                              >
                                {renderSortIcon(column.key)}
                              </Button>
                            )}
                          </div>
                        </TableHead>
                      ))}
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={visibleColumns.length + (selectable ? 1 : 0) + 1}>
                        <div className="text-center py-8">Loading...</div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={visibleColumns.length + (selectable ? 1 : 0) + 1}>
                        <div className="text-center py-8 text-muted-foreground">
                          No data found
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedData.map((row, index) => (
                      <TableRow key={row.id || index}>
                        {selectable && (
                          <TableCell>
                            <Checkbox
                              checked={selection.selectedIds.includes(row.id)}
                              onCheckedChange={() => toggleSelection(row.id)}
                            />
                          </TableCell>
                        )}
                        {availableColumns
                          .filter(column => visibleColumns.includes(column.key))
                          .map(column => (
                            <TableCell key={column.key}>
                              <UniversalField
                                tableName={tableName}
                                column={column.key}
                                value={row[column.key]}
                                meta={tableMetadata}
                                permissions={permissions}
                              />
                            </TableCell>
                          ))}
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onClick={() => handleAction('view', row)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </DropdownMenuItem>
                              {permissions?.canEdit && (
                                <DropdownMenuItem onClick={() => handleAction('edit', row)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleAction('share', row)}>
                                <Share className="h-4 w-4 mr-2" />
                                Share
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {permissions?.canDelete && (
                                <DropdownMenuItem 
                                  onClick={() => handleAction('delete', row)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {loading ? (
              <div className="col-span-full text-center py-8">Loading...</div>
            ) : paginatedData.length === 0 ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                No data found
              </div>
            ) : (
              paginatedData.map((row, index) => (
                <Card key={row.id || index} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium truncate">
                        {row.name || row.title || `Item ${index + 1}`}
                      </CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => handleAction('view', row)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          {permissions?.canEdit && (
                            <DropdownMenuItem onClick={() => handleAction('edit', row)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {permissions?.canDelete && (
                            <DropdownMenuItem 
                              onClick={() => handleAction('delete', row)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {availableColumns
                      .filter(column => visibleColumns.includes(column.key))
                      .slice(0, 4) // Show only first 4 fields in card view
                      .map(column => (
                        <div key={column.key} className="text-sm">
                          <div className="text-muted-foreground font-medium mb-1">
                            {column.label}
                          </div>
                          <UniversalField
                            tableName={tableName}
                            column={column.key}
                            value={row[column.key]}
                            meta={tableMetadata}
                            permissions={permissions}
                          />
                        </div>
                      ))}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Pagination */}
        {paginated && pagination.total > 0 && (
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {startItem} to {endItem} of {pagination.total} entries
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Rows per page:</span>
                    <Select
                      value={pagination.pageSize.toString()}
                      onValueChange={(value) => handlePageSizeChange(Number(value))}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePageSizes.map(size => (
                          <SelectItem key={size} value={size.toString()}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(1)}
                    disabled={pagination.page === 1}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (pagination.page <= 3) {
                        pageNum = i + 1;
                      } else if (pagination.page >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = pagination.page - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={pageNum === pagination.page ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                          className="w-8 h-8 p-0"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(totalPages)}
                    disabled={pagination.page === totalPages}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
};

export default EnhancedDataTable;