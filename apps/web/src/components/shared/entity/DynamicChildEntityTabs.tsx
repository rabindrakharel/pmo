import React from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getIconComponent } from '../../../lib/iconMapping';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

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
    <div className={`bg-dark-100 rounded-xl p-4 border border-dark-300 ${className}`}>
      {/* Tab Navigation - Following design system v10.0 */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const isActive = activeTab?.id === tab.id;
          const IconComponent = tab.icon || getIconComponent(null);

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab)}
              disabled={tab.disabled}
              title={tab.tooltip}
              className={[
                'flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-all',
                isActive
                  ? 'bg-slate-600 text-white shadow-sm'
                  : tab.disabled
                  ? 'bg-white text-dark-500 border border-dark-300 cursor-not-allowed opacity-50'
                  : 'bg-white text-dark-700 border border-dark-300 hover:border-dark-400 cursor-pointer'
              ].join(' ')}
            >
              {/* Icon */}
              <IconComponent className="h-4 w-4" aria-hidden="true" />

              {/* Label */}
              <span>{tab.label}</span>

              {/* Count badge */}
              {tab.count !== undefined && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full text-xs font-medium bg-white/20 text-current">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
          console.warn('No valid auth token found, showing overview only');
          setTabs([
            {
              id: 'overview',
              label: 'Overview',
              path: `/${parentType}/${parentId}`,
              icon: getIconComponent(null),
            }
          ]);
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
                icon: getIconComponent(data.parent_ui_icon),
              }
            ]);
            setLoading(false);
            return;
          }

          // Convert API data to tab format - tabs are already ordered from API by order field
          // API sorts by order field, so we preserve that order here
          // IMPORTANT: Use ui_icon from API response (from d_entity table)
          const generatedTabs: HeaderTab[] = data.tabs.map((tab: any) => ({
            id: tab.entity,
            label: tab.ui_label,
            count: tab.count,
            icon: getIconComponent(tab.ui_icon), // ✅ Uses API-provided icon from d_entity.ui_icon
            path: `/${parentType}/${parentId}/${tab.entity}`,
            disabled: false,
            order: tab.order || 999
          }));

          // Add overview tab at the beginning with parent icon from API
          setTabs([
            {
              id: 'overview',
              label: 'Overview',
              path: `/${parentType}/${parentId}`,
              icon: getIconComponent(data.parent_ui_icon), // ✅ Uses parent icon from API
            },
            ...generatedTabs
          ]);
        } else {
          // Fallback: show overview only if API call fails
          console.warn(`API call failed with status ${response.status}: ${response.statusText}, showing overview only`);

          // If unauthorized, the token might be invalid
          if (response.status === 401) {
            console.warn('Unauthorized - token might be expired or invalid');
          }

          setTabs([
            {
              id: 'overview',
              label: 'Overview',
              path: `/${parentType}/${parentId}`,
              icon: getIconComponent(null),
            }
          ]);
        }
      } catch (error) {
        // Fallback: show overview only if API call fails
        console.warn('Error fetching child tabs from entity metadata API, showing overview only:', error);
        setTabs([
          {
            id: 'overview',
            label: 'Overview',
            path: `/${parentType}/${parentId}`,
            icon: getIconComponent(null),
          }
        ]);
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
