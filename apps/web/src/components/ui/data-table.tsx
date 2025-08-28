import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ChevronDown,
  MoreHorizontal,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  Share,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AccessBoundary, CanCreate, CanModify, CanDelete, usePermissions } from "@/components/auth/AccessBoundary";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  searchPlaceholder?: string;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  
  // CRUD operations
  onCreateNew?: () => void;
  onEdit?: (row: TData) => void;
  onDelete?: (row: TData) => void;
  onShare?: (row: TData) => void;
  onView?: (row: TData) => void;
  
  // Permissions
  resource: 'project' | 'task' | 'tasklog' | 'form' | 'meta' | 'location' | 'business' | 'hr' | 'worksite' | 'employee' | 'client';
  
  // Pagination
  pageSize?: number;
  totalCount?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  
  // Filters
  filters?: FilterConfig[];
  activeFilters?: Record<string, any>;
  onFiltersChange?: (filters: Record<string, any>) => void;
  
  // Title and actions
  title?: string;
  subtitle?: string;
  customActions?: React.ReactNode;
}

export interface FilterConfig {
  key: string;
  label: string;
  type: 'text' | 'select' | 'multiselect' | 'date' | 'boolean';
  options?: { label: string; value: any }[];
  placeholder?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey = "name",
  searchPlaceholder = "Search...",
  loading = false,
  error = null,
  onRefresh,
  onCreateNew,
  onEdit,
  onDelete,
  onShare,
  onView,
  resource,
  pageSize = 25,
  totalCount,
  currentPage = 1,
  onPageChange,
  onPageSizeChange,
  filters = [],
  activeFilters = {},
  onFiltersChange,
  title,
  subtitle,
  customActions,
}: DataTableProps<TData, TValue>) {
  const { can } = usePermissions();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [showFilters, setShowFilters] = React.useState(false);

  // Add action column if any CRUD operations are available
  const enhancedColumns = React.useMemo(() => {
    const hasActions = onEdit || onDelete || onShare || onView;
    
    if (!hasActions) return columns;

    const actionColumn: ColumnDef<TData, TValue> = {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const data = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              
              {onView && (
                <AccessBoundary action="view" resource={resource}>
                  <DropdownMenuItem onClick={() => onView(data)}>
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                  </DropdownMenuItem>
                </AccessBoundary>
              )}
              
              {onEdit && (
                <AccessBoundary action="modify" resource={resource}>
                  <DropdownMenuItem onClick={() => onEdit(data)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                </AccessBoundary>
              )}
              
              {onShare && (
                <AccessBoundary action="modify" resource={resource}>
                  <DropdownMenuItem onClick={() => onShare(data)}>
                    <Share className="mr-2 h-4 w-4" />
                    Share
                  </DropdownMenuItem>
                </AccessBoundary>
              )}
              
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <AccessBoundary action="delete" resource={resource}>
                    <DropdownMenuItem 
                      onClick={() => onDelete(data)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </AccessBoundary>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    };

    return [...columns, actionColumn];
  }, [columns, onEdit, onDelete, onShare, onView, resource]);

  const table = useReactTable({
    data,
    columns: enhancedColumns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    globalFilterFn: 'includesString',
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize,
      },
    },
  });

  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...activeFilters, [key]: value };
    if (value === undefined || value === '' || value === null) {
      delete newFilters[key];
    }
    onFiltersChange?.(newFilters);
  };

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <div className="text-center">
            <p className="text-red-600 mb-4">Error loading data: {error}</p>
            {onRefresh && (
              <Button onClick={onRefresh} variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      {(title || subtitle || onCreateNew || customActions) && (
        <div className="flex items-center justify-between">
          <div>
            {title && <h2 className="text-2xl font-bold tracking-tight">{title}</h2>}
            {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {customActions}
            <CanCreate resource={resource}>
              {onCreateNew && (
                <Button onClick={onCreateNew}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create New
                </Button>
              )}
            </CanCreate>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {/* Global Search */}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={globalFilter ?? ""}
              onChange={(event) => setGlobalFilter(String(event.target.value))}
              className="pl-8 max-w-sm"
            />
          </div>

          {/* Filters Toggle */}
          {filters.length > 0 && (
            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters
              {Object.keys(activeFilters).length > 0 && (
                <Badge variant="secondary" className="ml-2 px-1 py-0 text-xs">
                  {Object.keys(activeFilters).length}
                </Badge>
              )}
            </Button>
          )}

          {/* Active Filters */}
          {Object.keys(activeFilters).length > 0 && (
            <div className="flex items-center gap-1">
              {Object.entries(activeFilters).map(([key, value]) => {
                const filter = filters.find(f => f.key === key);
                if (!filter || !value) return null;
                
                return (
                  <Badge key={key} variant="outline" className="gap-1">
                    {filter.label}: {String(value)}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => handleFilterChange(key, undefined)}
                    />
                  </Badge>
                );
              })}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onFiltersChange?.({})}
              >
                Clear all
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Refresh */}
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}

          {/* Column Visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="ml-auto">
                Columns <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Advanced Filters */}
      {showFilters && filters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Advanced Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filters.map((filter) => (
                <div key={filter.key} className="space-y-2">
                  <label className="text-sm font-medium">{filter.label}</label>
                  {filter.type === 'text' && (
                    <Input
                      placeholder={filter.placeholder}
                      value={activeFilters[filter.key] || ''}
                      onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                    />
                  )}
                  {filter.type === 'select' && (
                    <Select
                      value={activeFilters[filter.key] || ''}
                      onValueChange={(value) => handleFilterChange(filter.key, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={filter.placeholder} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All</SelectItem>
                        {filter.options?.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {filter.type === 'boolean' && (
                    <Select
                      value={activeFilters[filter.key] || ''}
                      onValueChange={(value) => handleFilterChange(filter.key, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={filter.placeholder} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All</SelectItem>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={enhancedColumns.length} className="h-24 text-center">
                  <div className="flex items-center justify-center">
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={enhancedColumns.length} className="h-24 text-center">
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center space-x-6 lg:space-x-8">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Rows per page</p>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                table.setPageSize(Number(value));
                onPageSizeChange?.(Number(value));
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={table.getState().pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50, 100].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to first page</span>
              <ChevronDown className="h-4 w-4 rotate-90" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronDown className="h-4 w-4 rotate-90" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronDown className="h-4 w-4 -rotate-90" />
            </Button>
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to last page</span>
              <ChevronDown className="h-4 w-4 -rotate-90" />
            </Button>
          </div>
        </div>
      </div>

      {/* Row Selection Info */}
      {Object.keys(rowSelection).length > 0 && (
        <div className="flex items-center justify-center">
          <p className="text-sm text-muted-foreground">
            {Object.keys(rowSelection).length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </p>
        </div>
      )}
    </div>
  );
}

// Sortable column header component
export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: {
  column: any;
  title: string;
  className?: string;
}) {
  if (!column.getCanSort()) {
    return <div className={className}>{title}</div>;
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 data-[state=open]:bg-accent"
          >
            <span>{title}</span>
            {column.getIsSorted() === "desc" ? (
              <ArrowUpDown className="ml-2 h-4 w-4 rotate-180" />
            ) : column.getIsSorted() === "asc" ? (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
            <ArrowUpDown className="mr-2 h-3.5 w-3.5" />
            Asc
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
            <ArrowUpDown className="mr-2 h-3.5 w-3.5 rotate-180" />
            Desc
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => column.clearSorting()}>
            <X className="mr-2 h-3.5 w-3.5" />
            Clear Sort
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
