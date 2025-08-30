import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, FilterConfig, DataTableColumnHeader } from '@/components/ui/data-table';
import { api, Project } from '@/lib/api';
import { Plus, Calendar, FolderKanban, Building, MapPin } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import type { ColumnDef } from '@tanstack/react-table';
import { TableActionButtons } from '@/components/ui/action-buttons';

export function ProjectsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(
    (searchParams.get('view') as 'table' | 'grid') || 'table'
  );

  // Extract query parameters for table state
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '25', 10);
  // const searchQuery = searchParams.get('q') || ''; // Unused for now
  const activeFilter = searchParams.get('active');
  const statusFilter = searchParams.get('status');
  const locationFilter = searchParams.get('location');
  const businessFilter = searchParams.get('business');

  // Build API query parameters
  const queryParams = useMemo(() => ({
    limit: pageSize,
    offset: (currentPage - 1) * pageSize,
    ...(activeFilter !== null && { active: activeFilter === 'true' }),
    ...(statusFilter && { status: statusFilter }),
    ...(locationFilter && { locationId: locationFilter }),
    ...(businessFilter && { bizId: businessFilter }),
  }), [currentPage, pageSize, activeFilter, statusFilter, locationFilter, businessFilter]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['projects', queryParams],
    queryFn: () => api.getProjects(queryParams),
  });

  const projects = data?.data || [];
  const totalCount = data?.total || 0;

  // Update URL when filters change
  const updateFilters = (filters: Record<string, any>) => {
    const newParams = new URLSearchParams(searchParams);
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && value !== null) {
        newParams.set(key, String(value));
      } else {
        newParams.delete(key);
      }
    });
    
    // Reset to page 1 when filters change
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  // Update search query (unused for now)
  // const updateSearch = (query: string) => {
  //   updateFilters({ q: query });
  // };

  // Update page
  const updatePage = (page: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', String(page));
    setSearchParams(newParams);
  };

  // Update page size
  const updatePageSize = (size: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('pageSize', String(size));
    newParams.set('page', '1'); // Reset to page 1
    setSearchParams(newParams);
  };

  // Column definitions for DataTable
  const columns: ColumnDef<Project>[] = useMemo(() => [
    {
      accessorKey: 'name',
      header: ({ column }: any) => (
        <DataTableColumnHeader column={column} title="Project Name" />
      ),
      cell: ({ row }: any) => {
        const project = row.original;
        return (
          <div className="space-y-1">
            <div className="font-medium cursor-pointer hover:text-blue-600" onClick={() => handleView(project)}>
              {project.name}
            </div>
            {project.project_code && (
              <div className="text-sm text-muted-foreground">{project.project_code}</div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'project_type',
      header: ({ column }: any) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      cell: ({ row }: any) => (
        <Badge variant="outline">{row.original.project_type}</Badge>
      ),
    },
    {
      accessorKey: 'priority_level',
      header: ({ column }: any) => (
        <DataTableColumnHeader column={column} title="Priority" />
      ),
      cell: ({ row }: any) => {
        const priority = row.original.priority_level;
        return (
          <Badge 
            variant={
              priority === 'high' ? 'destructive' :
              priority === 'medium' ? 'default' :
              'secondary'
            }
          >
            {priority}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'project_status',
      header: ({ column }: any) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }: any) => {
        const project = row.original;
        const status = project.project_status || (project.active ? 'active' : 'inactive');
        return (
          <Badge 
            variant={
              status === 'completed' ? 'secondary' :
              status === 'active' || status === 'in_progress' ? 'default' :
              'outline'
            }
          >
            {status}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'project_stage',
      header: ({ column }: any) => (
        <DataTableColumnHeader column={column} title="Stage" />
      ),
      cell: ({ row }: any) => (
        <Badge variant="outline">{row.original.project_stage}</Badge>
      ),
    },
    {
      accessorKey: 'budget_allocated',
      header: ({ column }: any) => (
        <DataTableColumnHeader column={column} title="Budget" />
      ),
      cell: ({ row }: any) => {
        const project = row.original;
        if (!project.budget_allocated) return <span className="text-muted-foreground">-</span>;
        return (
          <div className="text-sm">
            ${project.budget_allocated.toLocaleString()} {project.budget_currency}
          </div>
        );
      },
    },
    {
      accessorKey: 'timeline',
      header: 'Timeline',
      cell: ({ row }: any) => {
        const project = row.original;
        return (
          <div className="text-sm space-y-1">
            {project.planned_start_date && (
              <div>Start: {new Date(project.planned_start_date).toLocaleDateString()}</div>
            )}
            {project.planned_end_date && (
              <div>End: {new Date(project.planned_end_date).toLocaleDateString()}</div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'progress',
      header: 'Progress',
      cell: ({ row }: any) => {
        const project = row.original;
        if (!project.estimated_hours) return <span className="text-muted-foreground">-</span>;
        const progress = project.actual_hours ? Math.round((project.actual_hours / project.estimated_hours) * 100) : 0;
        return (
          <div className="text-sm">
            {project.actual_hours || 0}h / {project.estimated_hours}h ({progress}%)
          </div>
        );
      },
    },
    {
      accessorKey: 'created',
      header: ({ column }: any) => (
        <DataTableColumnHeader column={column} title="Created" />
      ),
      cell: ({ row }: any) => {
        return (
          <div className="text-sm text-muted-foreground">
            {formatRelativeTime(row.original.created)}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => {
        const project = row.original;
        return (
          <TableActionButtons
            resource="project"
            itemId={project.id}
            item={project}
            onView={() => handleView(project)}
            onEdit={() => handleEdit(project)}
            onShare={() => handleShare(project)}
            onDelete={() => handleDelete(project)}
          />
        );
      },
    },
  ], []);

  // Filter configurations
  const filters: FilterConfig[] = [
    {
      key: 'active',
      label: 'Status',
      type: 'select',
      options: [
        { label: 'Active', value: 'true' },
        { label: 'Inactive', value: 'false' },
      ],
      placeholder: 'Filter by status',
    },
    {
      key: 'businessSpecific',
      label: 'Business Specific',
      type: 'boolean',
      placeholder: 'Filter by business scope',
    },
    {
      key: 'locationSpecific',
      label: 'Location Specific', 
      type: 'boolean',
      placeholder: 'Filter by location scope',
    },
    {
      key: 'worksiteSpecific',
      label: 'Worksite Specific',
      type: 'boolean', 
      placeholder: 'Filter by worksite scope',
    },
  ];

  // Current active filters
  const activeFilters = {
    ...(activeFilter && { active: activeFilter }),
    ...(statusFilter && { status: statusFilter }),
    ...(locationFilter && { location: locationFilter }),
    ...(businessFilter && { business: businessFilter }),
  };

  // Action handlers
  const handleView = (project: Project) => {
    navigate(`/projects/${project.id}`);
  };

  const handleEdit = (project: Project) => {
    // TODO: Open edit modal or navigate to edit page
    console.log('Edit project:', project);
  };

  const handleShare = (project: Project) => {
    // TODO: Open share modal
    console.log('Share project:', project);
  };

  const handleDelete = (project: Project) => {
    // TODO: Show confirmation dialog and delete
    console.log('Delete project:', project);
  };

  const handleCreateNew = () => {
    // TODO: Open create project modal or navigate to create page
    console.log('Create new project');
  };

  if (viewMode === 'grid') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Projects</h1>
            <p className="text-muted-foreground">
              Manage your projects and track their progress
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant={viewMode === 'table' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setViewMode('table');
                updateFilters({ view: 'table' });
              }}
            >
              Table
            </Button>
            <Button 
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setViewMode('grid');
                updateFilters({ view: 'grid' });
              }}
            >
              Grid
            </Button>
            <Button onClick={handleCreateNew}>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { name: 'Total Projects', value: totalCount, icon: FolderKanban },
            { 
              name: 'Active', 
              value: projects.filter(p => p.active === true).length, 
              icon: Calendar 
            },
            { 
              name: 'Completed', 
              value: projects.filter(p => p.status === 'completed').length, 
              icon: FolderKanban 
            },
            { 
              name: 'Inactive', 
              value: projects.filter(p => p.active === false).length, 
              icon: Calendar 
            },
          ].map((stat) => (
            <Card key={stat.name}>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <stat.icon className="h-8 w-8 text-muted-foreground" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">{stat.name}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Projects Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded w-3/4 mb-3"></div>
                  <div className="h-3 bg-muted rounded w-1/2 mb-4"></div>
                  <div className="h-6 bg-muted rounded w-20"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No projects yet</h3>
              <p className="text-muted-foreground mb-4">
                Get started by creating your first project
              </p>
              <Button onClick={handleCreateNew}>
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card 
                key={project.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleView(project)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <Badge 
                      variant={
                        project.active === true ? 'default' :
                        project.status === 'completed' ? 'secondary' :
                        'outline'
                      }
                    >
                      {project.status || (project.active ? 'Active' : 'Inactive')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Calendar className="mr-2 h-4 w-4" />
                      Created {formatRelativeTime(project.created)}
                    </div>
                    
                    {project.slug && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <FolderKanban className="mr-2 h-4 w-4" />
                        {project.slug}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Table view
  return (
    <div className="space-y-6">
      <DataTable
        title="Projects"
        subtitle="Manage your projects and track their progress"
        columns={columns}
        data={projects}
        loading={isLoading}
        error={error ? String(error) : null}
        onRefresh={refetch}
        searchKey="name"
        searchPlaceholder="Search projects..."
        resource="project"
        onCreateNew={handleCreateNew}
        pageSize={pageSize}
        totalCount={totalCount}
        currentPage={currentPage}
        onPageChange={updatePage}
        onPageSizeChange={updatePageSize}
        filters={filters}
        activeFilters={activeFilters}
        onFiltersChange={updateFilters}
        customActions={
          <div className="flex items-center gap-2">
            <Button 
              variant={viewMode === 'table' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setViewMode('table');
                updateFilters({ view: 'table' });
              }}
            >
              Table
            </Button>
            <Button 
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setViewMode('grid');
                updateFilters({ view: 'grid' });
              }}
            >
              Grid
            </Button>
          </div>
        }
      />
    </div>
  );
}