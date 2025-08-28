import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import {
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
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Calendar,
  MapPin,
  Building,
  Users,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable, DataTableColumnHeader, FilterConfig } from '@/components/ui/data-table';
import { AccessBoundary, CanCreate, CanModify, CanDelete, usePermissions } from '@/components/auth/AccessBoundary';

// Base interface for all entities
export interface BaseEntity {
  id: string;
  name: string;
  active?: boolean;
  created: string;
  updated: string;
}

// Configuration for entity management
export interface EntityConfig<T extends BaseEntity> {
  // Basic info
  entityName: string;
  entityNamePlural: string;
  resource: 'project' | 'task' | 'tasklog' | 'form' | 'meta' | 'location' | 'business' | 'hr' | 'worksite' | 'employee' | 'client';
  
  // API functions
  listFn: (params?: any) => Promise<{ data: T[]; total?: number }>;
  getFn: (id: string) => Promise<T>;
  createFn: (data: Partial<T>) => Promise<T>;
  updateFn: (id: string, data: Partial<T>) => Promise<T>;
  deleteFn: (id: string) => Promise<void>;
  
  // Table configuration
  columns: ColumnDef<T, any>[];
  filters?: FilterConfig[];
  searchKey?: string;
  defaultSort?: { key: string; direction: 'asc' | 'desc' };
  
  // Form configuration
  CreateForm?: React.ComponentType<{ onSubmit: (data: Partial<T>) => void; onCancel: () => void }>;
  EditForm?: React.ComponentType<{ entity: T; onSubmit: (data: Partial<T>) => void; onCancel: () => void }>;
  ViewDetails?: React.ComponentType<{ entity: T; onEdit?: () => void; onDelete?: () => void }>;
  
  // Custom actions
  customActions?: Array<{
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    action: (entity: T) => void;
    permission?: 'view' | 'create' | 'modify' | 'delete';
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost';
  }>;
  
  // Bulk operations
  bulkActions?: Array<{
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    action: (entities: T[]) => void;
    permission?: 'view' | 'create' | 'modify' | 'delete';
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost';
  }>;
}

export interface EntityManagementPageProps<T extends BaseEntity> {
  config: EntityConfig<T>;
  title?: string;
  subtitle?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}

export function EntityManagementPage<T extends BaseEntity>({
  config,
  title,
  subtitle,
  breadcrumbs,
}: EntityManagementPageProps<T>) {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  
  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25 });
  const [selectedEntity, setSelectedEntity] = useState<T | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<T[]>([]);

  // Build query key
  const queryKey = [
    config.entityNamePlural,
    searchQuery,
    activeFilters,
    pagination,
  ];

  // Data fetching
  const {
    data: entitiesData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => config.listFn({
      search: searchQuery,
      ...activeFilters,
      page: pagination.page,
      pageSize: pagination.pageSize,
    }),
    keepPreviousData: true,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: config.createFn,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [config.entityNamePlural] });
      toast.success(`${config.entityName} created successfully`);
      setShowCreateDialog(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create ${config.entityName.toLowerCase()}: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<T> }) => 
      config.updateFn(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [config.entityNamePlural] });
      toast.success(`${config.entityName} updated successfully`);
      setShowEditDialog(false);
      setSelectedEntity(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update ${config.entityName.toLowerCase()}: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: config.deleteFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [config.entityNamePlural] });
      toast.success(`${config.entityName} deleted successfully`);
      setShowDeleteDialog(false);
      setSelectedEntity(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete ${config.entityName.toLowerCase()}: ${error.message}`);
    },
  });

  // Event handlers
  const handleCreate = useCallback((data: Partial<T>) => {
    createMutation.mutate(data);
  }, [createMutation]);

  const handleEdit = useCallback((entity: T) => {
    setSelectedEntity(entity);
    setShowEditDialog(true);
  }, []);

  const handleUpdate = useCallback((data: Partial<T>) => {
    if (selectedEntity) {
      updateMutation.mutate({ id: selectedEntity.id, data });
    }
  }, [selectedEntity, updateMutation]);

  const handleDelete = useCallback((entity: T) => {
    setSelectedEntity(entity);
    setShowDeleteDialog(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (selectedEntity) {
      deleteMutation.mutate(selectedEntity.id);
    }
  }, [selectedEntity, deleteMutation]);

  const handleView = useCallback((entity: T) => {
    setSelectedEntity(entity);
    setShowViewDialog(true);
  }, []);

  const handleShare = useCallback((entity: T) => {
    // TODO: Implement sharing functionality
    toast.info('Sharing functionality coming soon');
  }, []);

  // Enhanced columns with standard actions
  const enhancedColumns = React.useMemo(() => {
    return [
      ...config.columns,
      {
        id: 'actions',
        enableHiding: false,
        cell: ({ row }) => {
          const entity = row.original;
          return (
            <div className="flex items-center gap-2">
              {config.customActions?.map((action, index) => (
                <AccessBoundary 
                  key={index}
                  action={action.permission || 'view'} 
                  resource={config.resource}
                >
                  <Button
                    variant={action.variant || 'ghost'}
                    size="sm"
                    onClick={() => action.action(entity)}
                  >
                    {action.icon && <action.icon className="h-4 w-4" />}
                    {action.label}
                  </Button>
                </AccessBoundary>
              ))}
            </div>
          );
        },
      },
    ];
  }, [config.columns, config.customActions, config.resource]);

  const entities = entitiesData?.data || [];
  const totalCount = entitiesData?.total || entities.length;

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      {breadcrumbs && (
        <nav className="flex" aria-label="Breadcrumb">
          <ol className="inline-flex items-center space-x-1 md:space-x-2 rtl:space-x-reverse">
            {breadcrumbs.map((crumb, index) => (
              <li key={index} className="inline-flex items-center">
                {index > 0 && (
                  <svg className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 9 4-4-4-4"/>
                  </svg>
                )}
                {crumb.href ? (
                  <a href={crumb.href} className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600">
                    {crumb.label}
                  </a>
                ) : (
                  <span className="text-sm font-medium text-gray-500">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {title || config.entityNamePlural}
          </h1>
          {subtitle && (
            <p className="text-muted-foreground mt-2">{subtitle}</p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Bulk Actions */}
          {bulkSelected.length > 0 && config.bulkActions && (
            <div className="flex items-center gap-2 mr-4">
              <span className="text-sm text-muted-foreground">
                {bulkSelected.length} selected
              </span>
              {config.bulkActions.map((action, index) => (
                <AccessBoundary
                  key={index}
                  action={action.permission || 'modify'}
                  resource={config.resource}
                >
                  <Button
                    variant={action.variant || 'outline'}
                    size="sm"
                    onClick={() => action.action(bulkSelected)}
                  >
                    {action.icon && <action.icon className="h-4 w-4 mr-2" />}
                    {action.label}
                  </Button>
                </AccessBoundary>
              ))}
            </div>
          )}

          {/* Standard Actions */}
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <CanCreate resource={config.resource}>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create {config.entityName}
            </Button>
          </CanCreate>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={enhancedColumns}
        data={entities}
        searchKey={config.searchKey || 'name'}
        searchPlaceholder={`Search ${config.entityNamePlural.toLowerCase()}...`}
        loading={isLoading}
        error={error?.message || null}
        onRefresh={refetch}
        onCreateNew={() => setShowCreateDialog(true)}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onShare={handleShare}
        onView={handleView}
        resource={config.resource}
        pageSize={pagination.pageSize}
        totalCount={totalCount}
        currentPage={pagination.page}
        onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
        onPageSizeChange={(pageSize) => setPagination(prev => ({ ...prev, pageSize }))}
        filters={config.filters}
        activeFilters={activeFilters}
        onFiltersChange={setActiveFilters}
        title={`${config.entityNamePlural} (${totalCount})`}
      />

      {/* Create Dialog */}
      {config.CreateForm && (
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New {config.entityName}</DialogTitle>
              <DialogDescription>
                Add a new {config.entityName.toLowerCase()} to the system.
              </DialogDescription>
            </DialogHeader>
            <config.CreateForm
              onSubmit={handleCreate}
              onCancel={() => setShowCreateDialog(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Dialog */}
      {config.EditForm && selectedEntity && (
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit {config.entityName}</DialogTitle>
              <DialogDescription>
                Update the {config.entityName.toLowerCase()} information.
              </DialogDescription>
            </DialogHeader>
            <config.EditForm
              entity={selectedEntity}
              onSubmit={handleUpdate}
              onCancel={() => {
                setShowEditDialog(false);
                setSelectedEntity(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* View Dialog */}
      {config.ViewDetails && selectedEntity && (
        <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{config.entityName} Details</DialogTitle>
              <DialogDescription>
                View detailed information about this {config.entityName.toLowerCase()}.
              </DialogDescription>
            </DialogHeader>
            <config.ViewDetails
              entity={selectedEntity}
              onEdit={() => {
                setShowViewDialog(false);
                setShowEditDialog(true);
              }}
              onDelete={() => {
                setShowViewDialog(false);
                setShowDeleteDialog(true);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {config.entityName}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this {config.entityName.toLowerCase()}? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedEntity && (
            <div className="py-4">
              <p className="text-sm">
                <strong>Name:</strong> {selectedEntity.name}
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>ID:</strong> {selectedEntity.id}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setSelectedEntity(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isLoading}
            >
              {deleteMutation.isLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Utility function to create standard columns
export function createStandardColumns<T extends BaseEntity>(): ColumnDef<T, any>[] {
  return [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => (
        <div className="flex items-center">
          <div>
            <div className="font-medium">{row.getValue('name')}</div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'active',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const isActive = row.getValue('active');
        return (
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {isActive ? 'Active' : 'Inactive'}
          </Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: 'created',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created" />
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue('created'));
        return (
          <div className="flex items-center">
            <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{date.toLocaleDateString()}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'updated',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Updated" />
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue('updated'));
        return (
          <div className="flex items-center">
            <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{date.toLocaleDateString()}</span>
          </div>
        );
      },
    },
  ];
}
