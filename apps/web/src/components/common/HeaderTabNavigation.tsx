import React from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
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
  Star
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

interface HeaderTabNavigationProps {
  title: string;
  parentType: string;
  parentId: string;
  parentName?: string;
  tabs: HeaderTab[];
  className?: string;
}

const getEntityIcon = (entityType: string) => {
  const iconMap = {
    tasks: CheckSquare,
    artifacts: FileText,
    wiki: BookOpen,
    forms: FileText,
    projects: FolderOpen,
    biz: Building2,
    employees: Users,
    roles: UserCheck,
    org: MapPin,
    hr: Crown,
    client: Star,
    worksite: Building2,
  };
  return iconMap[entityType as keyof typeof iconMap] || FileText;
};

export function HeaderTabNavigation({
  title,
  parentType,
  parentId,
  parentName,
  tabs,
  className = '',
}: HeaderTabNavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const handleTabClick = (tab: HeaderTab) => {
    if (tab.disabled) return;
    navigate(tab.path);
  };

  // Determine active tab
  const activeTab = tabs.find(tab => 
    currentPath === tab.path || currentPath.startsWith(tab.path + '/')
  );

  return (
    <div className={`bg-white border-b border-gray-200 ${className}`}>
      {/* Header Section */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center">
              {React.createElement(getEntityIcon(parentType), {
                className: "h-4 w-4 text-gray-600"
              })}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
              {parentName && (
                <p className="text-sm text-gray-500">
                  {parentType.charAt(0).toUpperCase() + parentType.slice(1)}: {parentName}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-6">
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
                className={`
                  group inline-flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200
                  ${isActive
                    ? 'border-blue-500 text-blue-600'
                    : tab.disabled
                    ? 'border-transparent text-gray-400 cursor-not-allowed'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 cursor-pointer'
                  }
                `}
              >
                <IconComponent className={`h-4 w-4 transition-colors duration-200 ${
                  isActive
                    ? 'text-blue-500'
                    : tab.disabled
                    ? 'text-gray-400'
                    : 'text-gray-400 group-hover:text-gray-500'
                }`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`
                    inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors duration-200
                    ${isActive
                      ? 'bg-blue-100 text-blue-600'
                      : tab.disabled
                      ? 'bg-gray-100 text-gray-400'
                      : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
                    }
                  `}>
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
  const entityConfig: Record<string, Array<{ id: string; label: string; icon?: React.ComponentType<any> }>> = {
    project: [
      { id: 'wiki', label: 'Wiki', icon: BookOpen },
      { id: 'forms', label: 'Forms', icon: FileText },
      { id: 'task', label: 'Tasks', icon: CheckSquare },
      { id: 'artifact', label: 'Artifacts', icon: FileText },
    ],
    biz: [
      { id: 'wiki', label: 'Wiki', icon: BookOpen },
      { id: 'forms', label: 'Forms', icon: FileText },
      { id: 'task', label: 'Tasks', icon: CheckSquare },
      { id: 'project', label: 'Projects', icon: FolderOpen },
      { id: 'artifact', label: 'Artifacts', icon: FileText },
    ],
    org: [
      { id: 'worksite', label: 'Worksites', icon: Building2 },
      { id: 'employee', label: 'Employees', icon: Users },
    ],
    hr: [
      { id: 'employee', label: 'Employees', icon: Users },
      { id: 'role', label: 'Roles', icon: UserCheck },
    ],
    client: [
      { id: 'project', label: 'Projects', icon: FolderOpen },
      { id: 'task', label: 'Tasks', icon: CheckSquare },
    ],
    worksite: [
      { id: 'task', label: 'Tasks', icon: CheckSquare },
      { id: 'forms', label: 'Forms', icon: FileText },
    ],
    role: [
      { id: 'employee', label: 'Employees', icon: Users },
    ],
    task: [
      { id: 'forms', label: 'Forms', icon: FileText },
      { id: 'artifact', label: 'Artifacts', icon: FileText },
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
    // Action entity tabs
    ...actionEntities.map(entity => ({
      id: entity.id,
      label: entity.label,
      path: `/${parentType}/${parentId}/${entity.id}`,
      icon: entity.icon,
    }))
  ];

  return tabs;
};

// Hook for generating tabs from API data
export function useHeaderTabs(parentType: string, parentId: string) {
  const [tabs, setTabs] = React.useState<HeaderTab[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchActionSummaries = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('accessToken');
        const response = await fetch(`/api/v1/${parentType}/${parentId}/action-summaries`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          
          // Convert API data to tabs
          const generatedTabs: HeaderTab[] = data.action_entities.map((entity: any) => ({
            id: entity.entity_type_code,
            label: entity.display_name,
            count: entity.total_accessible,
            path: `/${parentType}/${parentId}/${entity.entity_type_code}`,
            disabled: !entity.permission_actions.includes('view'),
            tooltip: entity.permission_actions.includes('view') 
              ? undefined 
              : `You need view permission on ${entity.display_name}`,
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
          console.warn('API call failed, using default tabs');
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