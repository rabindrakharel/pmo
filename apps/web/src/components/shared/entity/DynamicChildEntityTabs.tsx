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
  order?: number;
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
    <div className={`bg-dark-100 ${className}`}>
      {/* Tab Navigation */}
      <div className="px-6 py-1.5">
        <nav className="flex items-center gap-6" aria-label="Tabs">
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
                  'group inline-flex items-center gap-1.5 px-1 py-1.5 border-b-2 font-normal text-xs transition-all duration-200',
                  isActive
                    ? 'border-dark-400 text-dark-600'
                    : tab.disabled
                    ? 'border-transparent text-dark-600 cursor-not-allowed'
                    : 'border-transparent text-dark-700 hover:border-dark-400 cursor-pointer'
                ].join(' ')}
              >
                {/* Icon */}
                <IconComponent className="h-3.5 w-3.5 stroke-[1.5]" />

                {/* Label */}
                <span>{tab.label}</span>

                {/* Count badge */}
                {tab.count !== undefined && (
                  <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-normal bg-dark-100 text-dark-700">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom border */}
      <div className="h-px bg-dark-200" />
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

// Hook for generating tabs from centralized entity metadata API
export function useDynamicChildEntityTabs(parentType: string, parentId: string) {
  const [tabs, setTabs] = React.useState<HeaderTab[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchChildTabs = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('auth_token');

        if (!token || token === 'no-auth-needed') {
          console.warn('No valid auth token found, using default tabs');
          setTabs(getDefaultTabs(parentType, parentId));
          setLoading(false);
          return;
        }

        // Fetch child tabs from centralized entity metadata API
        const response = await fetch(`${API_BASE_URL}/api/v1/entity/child-tabs/${parentType}/${parentId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();

          // If no tabs returned (leaf entity or no children), show overview only
          if (!data.tabs || data.tabs.length === 0) {
            setTabs([
              {
                id: 'overview',
                label: 'Overview',
                path: `/${parentType}/${parentId}`,
                icon: getEntityIcon(parentType),
              }
            ]);
            setLoading(false);
            return;
          }

          // Convert API data to tab format - tabs are already ordered from API by order field
          // API sorts by order field, so we preserve that order here
          const generatedTabs: HeaderTab[] = data.tabs.map((tab: any) => ({
            id: tab.entity,
            label: tab.ui_label,
            count: tab.count,
            icon: getEntityIcon(tab.entity),
            path: `/${parentType}/${parentId}/${tab.entity}`,
            disabled: false,
            order: tab.order || 999
          }));

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
        console.warn('Error fetching child tabs from entity metadata API, using default tabs:', error);
        setTabs(getDefaultTabs(parentType, parentId));
      } finally {
        setLoading(false);
      }
    };

    if (parentId) {
      fetchChildTabs();
    }
  }, [parentType, parentId]);

  return { tabs, loading };
}
