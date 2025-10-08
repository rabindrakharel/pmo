import React from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
import {
  FileText,
  CheckSquare,
  BookOpen,
  FolderOpen,
  Building2,
  Users,
  UserCheck,
  MapPin,
  Crown,
  Star,
  ArrowLeft
} from 'lucide-react';

export interface HeaderTab {
  id: string;
  label: string;
  count?: number;
  icon?: React.ComponentType<any>;
  path: string;
  disabled?: boolean;
  tooltip?: string;
}

interface DynamicChildEntityTabsProps {
  title: string;
  parentType: string;
  parentId: string;
  parentName?: string;
  tabs: HeaderTab[];
  className?: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
}

const getEntityIcon = (entityType: string) => {
  const iconMap = {
    task: CheckSquare,
    tasks: CheckSquare,
    artifact: FileText,
    artifacts: FileText,
    wiki: BookOpen,
    form: FileText,
    forms: FileText,
    project: FolderOpen,
    projects: FolderOpen,
    biz: Building2,
    employee: Users,
    employees: Users,
    role: UserCheck,
    roles: UserCheck,
    org: MapPin,
    hr: Crown,
    client: Star,
    worksite: Building2,
  };
  return iconMap[entityType as keyof typeof iconMap] || FileText;
};

export function DynamicChildEntityTabs({
  title,
  parentType,
  parentId,
  parentName,
  tabs,
  className = '',
  showBackButton = false,
  onBackClick,
}: DynamicChildEntityTabsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const handleTabClick = (tab: HeaderTab) => {
    if (tab.disabled) return;
    navigate(tab.path);
  };

  // Determine active tab - exact path match only
  const activeTab = tabs.find(tab => currentPath === tab.path);

  return (
    <div className={`bg-white border-b border-gray-200 ${className}`}>
      {/* Tab Navigation */}
      <div className="px-6 pt-4">
        <nav className="flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab?.id === tab.id;
            const IconComponent = tab.icon || getEntityIcon(tab.id);
            
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                disabled={tab.disabled}
                title={tab.tooltip}
                className={[
                  'group inline-flex items-center space-x-2 py-4 px-1 border-b-2 font-normal text-sm transition-colors duration-200',
                  isActive
                    ? 'border-gray-800 text-gray-800'
                    : tab.disabled
                    ? 'border-transparent text-gray-400 cursor-not-allowed'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 cursor-pointer'
                ].join(' ')}
              >
                <IconComponent className={[
                  'h-3.5 w-3.5 transition-colors duration-200 stroke-[1.5]',
                  isActive
                    ? 'text-gray-600'
                    : tab.disabled
                    ? 'text-gray-400'
                    : 'text-gray-400 group-hover:text-gray-500'
                ].join(' ')} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={[
                    'inline-flex items-center px-2 py-0.5 rounded text-xs font-normal transition-colors duration-200',
                    isActive
                      ? 'bg-gray-100 text-gray-700'
                      : tab.disabled
                      ? 'bg-gray-100 text-gray-400'
                      : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'
                  ].join(' ')}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

// Default action entity configuration for fallback
const getDefaultTabs = (parentType: string, parentId: string): HeaderTab[] => {
  // Helper function to get the correct route path for each entity type
  const getEntityRoutePath = (parentType: string, parentId: string, entityType: string): string => {
    // Handle entity type to route mapping with singular naming
    const entityRouteMap: Record<string, string> = {
      'task': 'task',
      'tasks': 'task',
      'wiki': 'wiki',
      'form': 'form',
      'forms': 'form',
      'artifact': 'artifact',
      'artifacts': 'artifact',
      'project': 'project',
      'projects': 'project',
      'employee': 'employee',
      'employees': 'employee',
      'worksite': 'worksite',
      'worksites': 'worksite',
      'role': 'role',
      'roles': 'role',
    };

    const routeSegment = entityRouteMap[entityType] || entityType;
    return `/${parentType}/${parentId}/${routeSegment}`;
  };

  const entityConfig: Record<string, Array<{ id: string; label: string; icon?: React.ComponentType<any> }>> = {
    project: [
      { id: 'wiki', label: 'Wiki', icon: BookOpen },
      { id: 'form', label: 'Form', icon: FileText },
      { id: 'task', label: 'Task', icon: CheckSquare },
      { id: 'artifact', label: 'Artifact', icon: FileText },
    ],
    biz: [
      { id: 'wiki', label: 'Wiki', icon: BookOpen },
      { id: 'form', label: 'Form', icon: FileText },
      { id: 'task', label: 'Task', icon: CheckSquare },
      { id: 'project', label: 'Project', icon: FolderOpen },
      { id: 'artifact', label: 'Artifact', icon: FileText },
    ],
    org: [
      { id: 'worksite', label: 'Worksite', icon: Building2 },
      { id: 'employee', label: 'Employee', icon: Users },
    ],
    hr: [
      { id: 'employee', label: 'Employee', icon: Users },
      { id: 'role', label: 'Role', icon: UserCheck },
    ],
    client: [
      { id: 'project', label: 'Project', icon: FolderOpen },
      { id: 'task', label: 'Task', icon: CheckSquare },
    ],
    worksite: [
      { id: 'task', label: 'Task', icon: CheckSquare },
      { id: 'form', label: 'Form', icon: FileText },
    ],
    role: [
      { id: 'employee', label: 'Employee', icon: Users },
    ],
    task: [
      { id: 'form', label: 'Form', icon: FileText },
      { id: 'artifact', label: 'Artifact', icon: FileText },
    ],
    employee: [], // Employee typically has no child entities
  };

  const actionEntities = entityConfig[parentType] || [];

  const tabs: HeaderTab[] = [
    // Overview tab
    {
      id: 'overview',
      label: 'Overview',
      path: `/${parentType}/${parentId}`,
      icon: getEntityIcon(parentType),
    },
    // Action entity tabs with corrected paths
    ...actionEntities.map(entity => ({
      id: entity.id,
      label: entity.label,
      path: getEntityRoutePath(parentType, parentId, entity.id),
      icon: entity.icon,
    }))
  ];

  return tabs;
};

// Hook for generating tabs from API data
export function useDynamicChildEntityTabs(parentType: string, parentId: string) {
  const [tabs, setTabs] = React.useState<HeaderTab[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchActionSummaries = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('auth_token');

        if (!token || token === 'no-auth-needed') {
          console.warn('No valid auth token found, using default tabs');
          setTabs(getDefaultTabs(parentType, parentId));
          setLoading(false);
          return;
        }

        // Check if this entity type has children (leaf entities like employee, role, client don't)
        const leafEntities = ['employee', 'role', 'client', 'position', 'form'];
        if (leafEntities.includes(parentType)) {
          // Don't fetch tabs for leaf entities
          setTabs([]);
          setLoading(false);
          return;
        }

        // Fetch dynamic child entity tabs
        const response = await fetch(`${API_BASE_URL}/api/v1/${parentType}/${parentId}/dynamic-child-entity-tabs`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();

          // Helper function to get the correct route path for API-generated tabs
          const getApiEntityRoutePath = (parentType: string, parentId: string, entityTypeCode: string): string => {
            // Handle entity type code to route mapping with singular naming
            const entityRouteMap: Record<string, string> = {
              'task': 'task',
              'tasks': 'task',
              'wiki': 'wiki',
              'form': 'form',
              'forms': 'form',
              'artifact': 'artifact',
              'artifacts': 'artifact',
              'project': 'project',
              'projects': 'project',
              'employee': 'employee',
              'employees': 'employee',
              'worksite': 'worksite',
              'worksites': 'worksite',
              'role': 'role',
              'roles': 'role',
            };

            const routeSegment = entityRouteMap[entityTypeCode] || entityTypeCode;
            return `/${parentType}/${parentId}/${routeSegment}`;
          };

          // Process action entities - all tabs are always accessible

          // Convert API data to tabs - all tabs are always accessible
          const generatedTabs: HeaderTab[] = data.action_entities.map((entity: any) => {
            const entityRouteMap: Record<string, string> = {
              'task': 'task',
              'tasks': 'task',
              'wiki': 'wiki',
              'form': 'form',
              'forms': 'form',
              'artifact': 'artifact',
              'artifacts': 'artifact',
              'project': 'project',
              'projects': 'project',
              'employee': 'employee',
              'employees': 'employee',
              'worksite': 'worksite',
              'worksites': 'worksite',
              'role': 'role',
              'roles': 'role',
            };

            const routeSegment = entityRouteMap[entity.actionEntity] || entity.actionEntity;

            return {
              id: routeSegment, // Use consistent route segment as ID
              label: entity.label,
              count: entity.count,
              icon: getEntityIcon(entity.actionEntity),
              path: getApiEntityRoutePath(parentType, parentId, entity.actionEntity),
              disabled: false, // All tabs are always enabled
              tooltip: undefined, // No permission-based tooltips
            };
          });

          // Add overview tab at the beginning
          setTabs([
            {
              id: 'overview',
              label: 'Overview',
              path: `/${parentType}/${parentId}`,
              icon: getEntityIcon(parentType),
            },
            ...generatedTabs
          ]);
        } else {
          // Fallback to default tabs if API call fails
          console.warn(`API call failed with status ${response.status}: ${response.statusText}, using default tabs`);

          // If unauthorized, the token might be invalid
          if (response.status === 401) {
            console.warn('Unauthorized - token might be expired or invalid');
          }

          setTabs(getDefaultTabs(parentType, parentId));
        }
      } catch (error) {
        // Fallback to default tabs if API call fails
        console.warn('Error fetching action summaries, using default tabs:', error);
        setTabs(getDefaultTabs(parentType, parentId));
      } finally {
        setLoading(false);
      }
    };

    if (parentId) {
      fetchActionSummaries();
    }
  }, [parentType, parentId]);

  return { tabs, loading };
}
