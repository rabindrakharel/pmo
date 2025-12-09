import React from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getIconComponent } from '../../../lib/iconMapping';
// v9.0.0: Use TanStack Query + Dexie for entity codes
import { useEntityCodes } from '../../../db/tanstack-index';

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
    <div className={className}>
      {/* Tab Navigation - Minimalistic style per styling_patterns.md Section 3.2 */}
      <nav className="flex items-center gap-2" aria-label="Project navigation">
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
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none',
                isActive
                  ? 'bg-slate-600 text-white shadow-sm'
                  : tab.disabled
                  ? 'text-dark-400 cursor-not-allowed'
                  : 'bg-white text-dark-600 border border-dark-300 hover:border-dark-400 cursor-pointer'
              ].join(' ')}
            >
              {/* Icon - h-3.5 w-3.5 per design system */}
              <IconComponent className="h-3.5 w-3.5" aria-hidden="true" />

              {/* Label */}
              <span>{tab.label}</span>

              {/* Count badge per styling_patterns.md Section 3.6 */}
              {tab.count !== undefined && (
                <span className={[
                  'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-xs font-medium',
                  isActive ? 'bg-white/20 text-white' : 'bg-dark-200 text-dark-600'
                ].join(' ')}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// Hook for generating tabs from centralized entity metadata API
// v9.0.0: Uses TanStack Query + Dexie cache (IndexedDB) for offline-first entity codes
export function useDynamicChildEntityTabs(parentType: string, parentId: string) {
  const [tabs, setTabs] = React.useState<HeaderTab[]>([]);
  const [loading, setLoading] = React.useState(true);

  // v9.0.0: Use TanStack Query hook for entity codes
  const { getEntityByCode, isLoading: isEntityCodesLoading } = useEntityCodes();

  React.useEffect(() => {
    // Wait for entity codes to load
    if (isEntityCodesLoading) {
      return;
    }

    // Guard against undefined or invalid parentId to prevent /entity/undefined URLs
    if (!parentId || parentId === 'undefined') {
      setTabs([]);
      setLoading(false);
      return;
    }

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

        // v9.0.0: Check Dexie cache first (offline-first)
        const cachedEntity = getEntityByCode(parentType);
        if (cachedEntity && cachedEntity.child_entity_codes) {
          console.log(`%c[DynamicChildEntityTabs] Dexie Cache HIT for ${parentType}`, 'color: #51cf66; font-weight: bold');

          // Build enriched child_entities from cached entity codes
          const enrichedChildEntities = cachedEntity.child_entity_codes
            .map((childCode: string) => {
              const childEntity = getEntityByCode(childCode);
              if (childEntity) {
                return {
                  entity: childEntity.code,
                  ui_label: childEntity.ui_label || childEntity.name,
                  ui_icon: childEntity.ui_icon,
                  order: 999
                };
              }
              return null;
            })
            .filter(Boolean);

          // Build data object with enriched child_entities
          const enrichedData = {
            ...cachedEntity,
            ui_icon: cachedEntity.ui_icon,
            child_entities: enrichedChildEntities
          };

          buildTabsFromData(enrichedData, parentType, parentId, setTabs, setLoading);
          return;
        }

        // CACHE MISS: Fetch from API (should rarely happen as Dexie is populated at login)
        console.log(`%c[DynamicChildEntityTabs] Cache MISS for ${parentType}, fetching from API`, 'color: #fcc419');
        const response = await fetch(`${API_BASE_URL}/api/v1/entity/codes/${parentType}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          buildTabsFromData(data, parentType, parentId, setTabs, setLoading);
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
          setLoading(false);
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
        setLoading(false);
      }
    };

    if (parentId) {
      fetchChildTabs();
    }
  }, [parentType, parentId, getEntityByCode, isEntityCodesLoading]);

  return { tabs, loading };
}

// Helper function to build tabs from entity data (cached or fetched)
function buildTabsFromData(
  data: any,
  parentType: string,
  parentId: string,
  setTabs: React.Dispatch<React.SetStateAction<HeaderTab[]>>,
  setLoading: React.Dispatch<React.SetStateAction<boolean>>
) {
  // If no child entities defined, show overview only
  if (!data.child_entities || data.child_entities.length === 0) {
    // Check for custom tabs even when no child entities
    const customTabs = getCustomTabsForEntity(parentType, parentId);
    setTabs([
      {
        id: 'overview',
        label: 'Overview',
        path: `/${parentType}/${parentId}`,
        icon: getIconComponent(data.ui_icon || data.icon),
      },
      ...customTabs
    ]);
    setLoading(false);
    return;
  }

  // Convert API data to tab format - child_entities are already ordered
  // IMPORTANT: Use ui_icon from child_entities (from entity table)
  const generatedTabs: HeaderTab[] = data.child_entities.map((tab: any) => ({
    id: tab.entity,
    label: tab.ui_label,
    icon: getIconComponent(tab.ui_icon), // ✅ Uses API-provided icon from entity.ui_icon
    path: `/${parentType}/${parentId}/${tab.entity}`,
    disabled: false,
    order: tab.order || 999
  }));

  // Get custom tabs for this entity type (non-entity tabs like Access Controls)
  const customTabs = getCustomTabsForEntity(parentType, parentId);

  // Add overview tab at the beginning with parent icon from API
  setTabs([
    {
      id: 'overview',
      label: 'Overview',
      path: `/${parentType}/${parentId}`,
      icon: getIconComponent(data.ui_icon || data.icon), // ✅ Uses parent icon from API
    },
    ...generatedTabs,
    ...customTabs
  ]);
  setLoading(false);
}

/**
 * Get custom (non-entity) tabs for specific entity types.
 * These tabs render custom components instead of EntityListOfInstancesTable.
 *
 * v9.5.0: Added 'Access Controls' tab for role entity
 */
function getCustomTabsForEntity(parentType: string, parentId: string): HeaderTab[] {
  const customTabs: HeaderTab[] = [];

  // Role entity: Add "Access Controls" tab for RBAC management
  if (parentType === 'role') {
    customTabs.push({
      id: 'access-control',
      label: 'Access Controls',
      path: `/${parentType}/${parentId}/access-control`,
      icon: getIconComponent('shield'),
      order: 1000 // After entity tabs
    });
  }

  return customTabs;
}
