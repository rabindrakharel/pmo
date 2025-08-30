/**
 * Project List Page Component
 * 
 * Advanced project management interface with multiple view modes:
 * - Table View: Sortable, filterable data table
 * - Grid View: Card-based project grid 
 * - Kanban View: Project status board with drag-and-drop
 * 
 * Features:
 * - Real-time filtering and search
 * - Project status management
 * - Bulk operations
 * - Export capabilities
 * - Permission-aware UI
 */

'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Progress,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  Textarea,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Separator,
  Label,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui';
import {
  Calendar,
  DollarSign,
  Users,
  Clock,
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Share,
  Copy,
  Eye,
  Grid3X3,
  List,
  Kanban,
  Download,
  Settings,
  RefreshCw,
} from 'lucide-react';
import { EnhancedDataTable } from '@/lib/enhanced-data-table';
import { UniversalPermissions } from '@/lib/universal-schema-components';

// Project data structure based on ops_project_head table
interface Project {
  id: string;
  name: string;
  descr?: string;
  project_code?: string;
  project_type: string;
  priority_level: string;
  slug?: string;
  budget_allocated?: number;
  budget_currency: string;
  business_id?: string;
  locations: string[];
  worksites: string[];
  project_managers: string[];
  project_sponsors: string[];
  project_leads: string[];
  clients: any[];
  approvers: string[];
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  milestones: any[];
  deliverables: any[];
  estimated_hours?: number;
  actual_hours?: number;
  project_stage?: string;
  project_status?: string;
  security_classification: string;
  compliance_requirements: any[];
  risk_assessment: any;
  tags: string[];
  attr: any;
  created: string;
  updated: string;
  active: boolean;
}

// Kanban column configuration
interface KanbanColumn {
  id: string;
  title: string;
  status: string[];
  color: string;
  icon: React.ReactNode;
  limit?: number;
}

const KANBAN_COLUMNS: KanbanColumn[] = [
  {
    id: 'planning',
    title: 'Planning',
    status: ['draft', 'planning', 'pending'],
    color: 'bg-gray-100 border-gray-200',
    icon: <Target className="h-4 w-4" />,
    limit: 10,
  },
  {
    id: 'active',
    title: 'In Progress', 
    status: ['active', 'in_progress', 'development'],
    color: 'bg-blue-50 border-blue-200',
    icon: <TrendingUp className="h-4 w-4" />,
    limit: 8,
  },
  {
    id: 'review',
    title: 'Under Review',
    status: ['review', 'testing', 'qa'],
    color: 'bg-yellow-50 border-yellow-200',
    icon: <Clock className="h-4 w-4" />,
    limit: 5,
  },
  {
    id: 'at_risk',
    title: 'At Risk',
    status: ['at_risk', 'critical', 'blocked'],
    color: 'bg-red-50 border-red-200',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  {
    id: 'completed',
    title: 'Completed',
    status: ['completed', 'delivered', 'closed'],
    color: 'bg-green-50 border-green-200',
    icon: <CheckCircle className="h-4 w-4" />,
  },
];

const PRIORITY_COLORS = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

const PROJECT_TYPE_COLORS = {
  development: 'bg-blue-100 text-blue-800',
  infrastructure: 'bg-purple-100 text-purple-800',
  maintenance: 'bg-gray-100 text-gray-800',
  research: 'bg-indigo-100 text-indigo-800',
  seasonal: 'bg-emerald-100 text-emerald-800',
};

interface ProjectListPageProps {
  // Data and loading state
  projects?: Project[];
  loading?: boolean;
  error?: string | null;
  
  // Permissions
  permissions?: UniversalPermissions;
  
  // Event handlers
  onProjectAction?: (action: string, project?: Project) => void;
  onBulkAction?: (action: string, projectIds: string[]) => void;
  onRefresh?: () => void;
  onExport?: (format: 'csv' | 'json' | 'xlsx') => void;
  
  // Configuration
  defaultView?: 'table' | 'grid' | 'kanban';
  enableKanban?: boolean;
  showMetrics?: boolean;
}

export const ProjectListPage: React.FC<ProjectListPageProps> = ({
  projects = [],
  loading = false,
  error = null,
  permissions,
  onProjectAction,
  onBulkAction,
  onRefresh,
  onExport,
  defaultView = 'table',
  enableKanban = true,
  showMetrics = true,
}) => {
  const [currentView, setCurrentView] = useState(defaultView);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Filter projects based on current filters
  const filteredProjects = useMemo(() => {
    let filtered = projects;

    if (filterStatus !== 'all') {
      filtered = filtered.filter(p => p.project_status === filterStatus);
    }
    
    if (filterType !== 'all') {
      filtered = filtered.filter(p => p.project_type === filterType);
    }
    
    if (filterPriority !== 'all') {
      filtered = filtered.filter(p => p.priority_level === filterPriority);
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(term) ||
        p.descr?.toLowerCase().includes(term) ||
        p.project_code?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [projects, filterStatus, filterType, filterPriority, searchTerm]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const total = projects.length;
    const active = projects.filter(p => ['active', 'in_progress'].includes(p.project_status || '')).length;
    const completed = projects.filter(p => ['completed', 'delivered'].includes(p.project_status || '')).length;
    const atRisk = projects.filter(p => ['at_risk', 'critical', 'blocked'].includes(p.project_status || '')).length;
    const totalBudget = projects.reduce((sum, p) => sum + (p.budget_allocated || 0), 0);
    const totalHours = projects.reduce((sum, p) => sum + (p.actual_hours || 0), 0);
    
    return {
      total,
      active,
      completed,
      atRisk,
      totalBudget,
      totalHours,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [projects]);

  // Get unique values for filters
  const uniqueStatuses = useMemo(() => 
    [...new Set(projects.map(p => p.project_status).filter(Boolean))],
    [projects]
  );
  const uniqueTypes = useMemo(() => 
    [...new Set(projects.map(p => p.project_type))],
    [projects]
  );
  const uniquePriorities = useMemo(() => 
    [...new Set(projects.map(p => p.priority_level))],
    [projects]
  );

  // Group projects for Kanban view
  const kanbanData = useMemo(() => {
    const grouped = KANBAN_COLUMNS.reduce((acc, column) => {
      acc[column.id] = filteredProjects.filter(project => 
        column.status.includes(project.project_status?.toLowerCase() || '')
      );
      return acc;
    }, {} as Record<string, Project[]>);
    
    return grouped;
  }, [filteredProjects]);

  // Handle project actions
  const handleProjectAction = useCallback((action: string, project?: Project) => {
    if (action === 'view' && project) {
      setSelectedProject(project);
      setShowProjectDialog(true);
    } else {
      onProjectAction?.(action, project);
    }
  }, [onProjectAction]);

  // Render project progress
  const renderProgress = (project: Project) => {
    const progress = project.actual_hours && project.estimated_hours 
      ? Math.min((project.actual_hours / project.estimated_hours) * 100, 100)
      : 0;
    
    return (
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
    );
  };

  // Render project card for grid/kanban views
  const renderProjectCard = (project: Project, isKanban = false) => (
    <Card key={project.id} className={`hover:shadow-md transition-shadow cursor-pointer ${isKanban ? 'mb-3' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-semibold truncate">
              {project.name}
            </CardTitle>
            {project.project_code && (
              <p className="text-xs text-muted-foreground mt-1">
                {project.project_code}
              </p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleProjectAction('view', project)}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              {permissions?.canEdit && (
                <DropdownMenuItem onClick={() => handleProjectAction('edit', project)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => handleProjectAction('share', project)}>
                <Share className="h-4 w-4 mr-2" />
                Share
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleProjectAction('copy', project)}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {permissions?.canDelete && (
                <DropdownMenuItem 
                  onClick={() => handleProjectAction('delete', project)}
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
      <CardContent className="space-y-4">
        {project.descr && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {project.descr}
          </p>
        )}
        
        <div className="flex flex-wrap gap-2">
          <Badge className={PROJECT_TYPE_COLORS[project.project_type as keyof typeof PROJECT_TYPE_COLORS] || 'bg-gray-100 text-gray-800'}>
            {project.project_type}
          </Badge>
          <Badge className={PRIORITY_COLORS[project.priority_level as keyof typeof PRIORITY_COLORS] || 'bg-gray-100 text-gray-800'}>
            {project.priority_level}
          </Badge>
          {project.project_status && (
            <Badge variant="outline">
              {project.project_status}
            </Badge>
          )}
        </div>

        {/* Project metrics */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          {project.budget_allocated && (
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-muted-foreground">
                {new Intl.NumberFormat('en-CA', { 
                  style: 'currency', 
                  currency: project.budget_currency || 'CAD',
                  minimumFractionDigits: 0,
                }).format(project.budget_allocated)}
              </span>
            </div>
          )}
          
          {project.project_managers.length > 0 && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-muted-foreground">
                {project.project_managers.length} manager{project.project_managers.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          
          {project.planned_end_date && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-orange-600" />
              <span className="text-muted-foreground">
                {new Date(project.planned_end_date).toLocaleDateString()}
              </span>
            </div>
          )}
          
          {project.estimated_hours && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-600" />
              <span className="text-muted-foreground">
                {project.estimated_hours}h est.
              </span>
            </div>
          )}
        </div>

        {project.estimated_hours && project.actual_hours && (
          <div className="pt-2">
            {renderProgress(project)}
          </div>
        )}

        {/* Team avatars */}
        {project.project_managers.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Team:</span>
            <div className="flex -space-x-2">
              {project.project_managers.slice(0, 3).map((managerId, index) => (
                <Avatar key={managerId} className="h-6 w-6 border-2 border-background">
                  <AvatarFallback className="text-xs">
                    {String.fromCharCode(65 + index)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {project.project_managers.length > 3 && (
                <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">
                    +{project.project_managers.length - 3}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Manage and track all your projects in one place
          </p>
        </div>
        <div className="flex items-center gap-2">
          {permissions?.canCreate && (
            <Button onClick={() => handleProjectAction('create')}>
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          )}
        </div>
      </div>

      {/* Metrics Cards */}
      {showMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Projects</p>
                  <p className="text-2xl font-bold">{metrics.total}</p>
                </div>
                <Target className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Projects</p>
                  <p className="text-2xl font-bold">{metrics.active}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">At Risk</p>
                  <p className="text-2xl font-bold">{metrics.atRisk}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completion Rate</p>
                  <p className="text-2xl font-bold">{metrics.completionRate}%</p>
                </div>
                <CheckCircle className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              {/* Search */}
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filters */}
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {uniqueStatuses.map(status => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {uniqueTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  {uniquePriorities.map(priority => (
                    <SelectItem key={priority} value={priority}>
                      {priority}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              {/* Refresh */}
              <Button variant="outline" size="sm" onClick={onRefresh}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>

              {/* Export */}
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

              {/* View Toggle */}
              <div className="flex border rounded-md">
                <Button
                  variant={currentView === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setCurrentView('table')}
                  className="rounded-r-none"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={currentView === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setCurrentView('grid')}
                  className="rounded-none"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                {enableKanban && (
                  <Button
                    variant={currentView === 'kanban' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setCurrentView('kanban')}
                    className="rounded-l-none"
                  >
                    <Kanban className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Views */}
      <div className="min-h-96">
        {currentView === 'table' && (
          <EnhancedDataTable
            tableName="app.ops_project_head"
            data={filteredProjects}
            loading={loading}
            error={error}
            permissions={permissions}
            title="Projects"
            searchable={false} // We handle search in the toolbar
            onAction={handleProjectAction}
            onBulkAction={onBulkAction}
            onRefresh={onRefresh}
            onExport={onExport}
            hideColumns={['id', 'tenant_id']}
            pinnedColumns={['name', 'project_status']}
          />
        )}

        {currentView === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {loading ? (
              <div className="col-span-full text-center py-12">Loading...</div>
            ) : filteredProjects.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No projects found
              </div>
            ) : (
              filteredProjects.map(project => renderProjectCard(project))
            )}
          </div>
        )}

        {currentView === 'kanban' && enableKanban && (
          <div className="flex gap-6 overflow-x-auto pb-4">
            {KANBAN_COLUMNS.map(column => (
              <Card key={column.id} className={`min-w-80 ${column.color}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {column.icon}
                      <CardTitle className="text-sm font-medium">
                        {column.title}
                      </CardTitle>
                      <Badge variant="secondary">
                        {kanbanData[column.id]?.length || 0}
                      </Badge>
                    </div>
                    {column.limit && (
                      <Badge variant="outline" className="text-xs">
                        Limit: {column.limit}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                  ) : kanbanData[column.id]?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No projects in {column.title.toLowerCase()}
                    </div>
                  ) : (
                    kanbanData[column.id]?.map(project => renderProjectCard(project, true))
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Project Details Dialog */}
      <Dialog open={showProjectDialog} onOpenChange={setShowProjectDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedProject?.name}
              {selectedProject?.project_code && (
                <Badge variant="outline">{selectedProject.project_code}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedProject && (
            <div className="space-y-6">
              {/* Project Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Description</Label>
                    <p className="mt-1">{selectedProject.descr || 'No description provided'}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Type</Label>
                      <Badge className={`mt-1 ${PROJECT_TYPE_COLORS[selectedProject.project_type as keyof typeof PROJECT_TYPE_COLORS]}`}>
                        {selectedProject.project_type}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Priority</Label>
                      <Badge className={`mt-1 ${PRIORITY_COLORS[selectedProject.priority_level as keyof typeof PRIORITY_COLORS]}`}>
                        {selectedProject.priority_level}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Start Date</Label>
                      <p className="mt-1">
                        {selectedProject.planned_start_date 
                          ? new Date(selectedProject.planned_start_date).toLocaleDateString()
                          : 'Not set'
                        }
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">End Date</Label>
                      <p className="mt-1">
                        {selectedProject.planned_end_date 
                          ? new Date(selectedProject.planned_end_date).toLocaleDateString()
                          : 'Not set'
                        }
                      </p>
                    </div>
                  </div>

                  {selectedProject.budget_allocated && (
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Budget</Label>
                      <p className="mt-1 text-lg font-semibold">
                        {new Intl.NumberFormat('en-CA', { 
                          style: 'currency', 
                          currency: selectedProject.budget_currency || 'CAD',
                        }).format(selectedProject.budget_allocated)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Progress and Metrics */}
              {(selectedProject.estimated_hours || selectedProject.actual_hours) && (
                <>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground mb-3 block">Project Progress</Label>
                    {renderProgress(selectedProject)}
                    
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold">{selectedProject.estimated_hours || 0}</p>
                        <p className="text-sm text-muted-foreground">Estimated Hours</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{selectedProject.actual_hours || 0}</p>
                        <p className="text-sm text-muted-foreground">Actual Hours</p>
                      </div>
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Team Information */}
              {(selectedProject.project_managers.length > 0 || selectedProject.project_sponsors.length > 0) && (
                <>
                  <div className="space-y-4">
                    <Label className="text-sm font-medium text-muted-foreground">Project Team</Label>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedProject.project_managers.length > 0 && (
                        <div>
                          <p className="text-sm font-medium">Project Managers ({selectedProject.project_managers.length})</p>
                          <div className="mt-2">
                            {selectedProject.project_managers.map(managerId => (
                              <Badge key={managerId} variant="secondary" className="mr-2 mb-2">
                                Manager {managerId.slice(-4)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {selectedProject.project_sponsors.length > 0 && (
                        <div>
                          <p className="text-sm font-medium">Project Sponsors ({selectedProject.project_sponsors.length})</p>
                          <div className="mt-2">
                            {selectedProject.project_sponsors.map(sponsorId => (
                              <Badge key={sponsorId} variant="secondary" className="mr-2 mb-2">
                                Sponsor {sponsorId.slice(-4)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Additional Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {selectedProject.tags.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Tags</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedProject.tags.map(tag => (
                        <Badge key={tag} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Last Updated</Label>
                  <p className="mt-1">
                    {new Date(selectedProject.updated).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                {permissions?.canEdit && (
                  <Button onClick={() => handleProjectAction('edit', selectedProject)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Project
                  </Button>
                )}
                <Button variant="outline" onClick={() => setShowProjectDialog(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectListPage;