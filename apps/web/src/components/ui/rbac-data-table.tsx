/**
 * RBAC-Enabled Data Table Component
 * 
 * This component provides a sortable, filterable, paginated data table with
 * permission-based action buttons. Each row shows only the actions the current
 * employee has permission to perform based on the RBAC system.
 * 
 * Features:
 * - Permission-gated action buttons (view, edit, share, delete)
 * - Sortable columns
 * - Search/filtering
 * - Pagination
 * - Responsive design
 * - Icon-based actions with tooltips
 */

import * as React from "react"
import { useState, useMemo } from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  SortingState,
  ColumnFiltersState,
  PaginationState,
} from "@tanstack/react-table"
import {
  Eye,
  Edit3,
  Share2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useRBACPermissions } from "@/hooks/useRBACPermissions"

// Action button configuration
interface ActionConfig {
  key: 'view' | 'edit' | 'share' | 'delete'
  icon: React.ComponentType<{ className?: string }>
  label: string
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  className?: string
}

const ACTION_CONFIGS: ActionConfig[] = [
  {
    key: 'view',
    icon: Eye,
    label: 'View Details',
    variant: 'ghost',
    className: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
  },
  {
    key: 'edit',
    icon: Edit3,
    label: 'Edit',
    variant: 'ghost',
    className: 'text-green-600 hover:text-green-700 hover:bg-green-50'
  },
  {
    key: 'share',
    icon: Share2,
    label: 'Share',
    variant: 'ghost',
    className: 'text-purple-600 hover:text-purple-700 hover:bg-purple-50'
  },
  {
    key: 'delete',
    icon: Trash2,
    label: 'Delete',
    variant: 'ghost',
    className: 'text-red-600 hover:text-red-700 hover:bg-red-50'
  }
]

// Permission mapping from RBAC system
const PERMISSION_MAPPING = {
  view: 0,   // Permission.VIEW
  edit: 1,   // Permission.MODIFY  
  share: 2,  // Permission.SHARE
  delete: 3, // Permission.DELETE
} as const

interface RBACDataTableProps<TData> {
  columns: ColumnDef<TData>[]
  data: TData[]
  scopeType: string // e.g., 'project', 'task', 'business', 'hr', 'location', 'worksite'
  getRowId: (row: TData) => string // Function to extract the ID from row data
  onAction?: (action: string, rowId: string, rowData: TData) => void
  searchPlaceholder?: string
  pageSize?: number
  showSearch?: boolean
  showPagination?: boolean
  enabledActions?: Array<'view' | 'edit' | 'share' | 'delete'>
  className?: string
}

export function RBACDataTable<TData>({
  columns,
  data,
  scopeType,
  getRowId,
  onAction,
  searchPlaceholder = "Search...",
  pageSize = 10,
  showSearch = true,
  showPagination = true,
  enabledActions = ['view', 'edit', 'share', 'delete'],
  className,
}: RBACDataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  })

  // Fetch employee permissions for this scope type
  const { permissions, isLoading } = useRBACPermissions(scopeType)

  // Create actions column with RBAC gating
  const actionsColumn: ColumnDef<TData> = useMemo(() => ({
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => {
      const rowId = getRowId(row.original)
      const rowPermissions = permissions[rowId] || []

      // Filter actions based on permissions
      const availableActions = ACTION_CONFIGS.filter(action => {
        if (!enabledActions.includes(action.key)) return false
        
        const requiredPermission = PERMISSION_MAPPING[action.key]
        return rowPermissions.includes(requiredPermission)
      })

      if (availableActions.length === 0) {
        return (
          <div className="text-sm text-muted-foreground">
            No actions available
          </div>
        )
      }

      return (
        <div className="flex items-center gap-1">
          <TooltipProvider>
            {availableActions.map((action) => {
              const Icon = action.icon
              return (
                <Tooltip key={action.key}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={action.variant}
                      size="sm"
                      className={cn(
                        "h-8 w-8 p-0 transition-colors",
                        action.className
                      )}
                      onClick={() => onAction?.(action.key, rowId, row.original)}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="sr-only">{action.label}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{action.label}</p>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </TooltipProvider>
        </div>
      )
    },
  }), [permissions, enabledActions, getRowId, onAction])

  // Combine user columns with actions column
  const allColumns = useMemo(() => [
    ...columns,
    actionsColumn
  ], [columns, actionsColumn])

  const table = useReactTable({
    data,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    state: {
      sorting,
      columnFilters,
      pagination,
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Loading permissions...</span>
      </div>
    )
  }

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Search */}
      {showSearch && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={(table.getColumn('name')?.getFilterValue() as string) ?? ""}
              onChange={(event) =>
                table.getColumn('name')?.setFilterValue(event.target.value)
              }
              className="pl-8"
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : (
                      <div
                        {...{
                          className: header.column.getCanSort()
                            ? "cursor-pointer select-none flex items-center gap-1"
                            : "",
                          onClick: header.column.getToggleSortingHandler(),
                        }}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {header.column.getCanSort() && (
                          <div className="flex flex-col">
                            {header.column.getIsSorted() === "asc" ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : header.column.getIsSorted() === "desc" ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <div className="h-4 w-4" />
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-muted/50"
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
                <TableCell colSpan={allColumns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {showPagination && (
        <div className="flex items-center justify-between px-2">
          <div className="flex-1 text-sm text-muted-foreground">
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
          <div className="flex items-center gap-6 lg:gap-8">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Rows per page</p>
              <select
                value={table.getState().pagination.pageSize}
                onChange={(e) => {
                  table.setPageSize(Number(e.target.value))
                }}
                className="h-8 w-[70px] rounded border border-input bg-background px-2 text-sm"
              >
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <option key={pageSize} value={pageSize}>
                    {pageSize}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex w-[100px] items-center justify-center text-sm font-medium">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}