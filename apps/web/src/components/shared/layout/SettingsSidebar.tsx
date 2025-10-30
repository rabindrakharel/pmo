import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  Link as LinkIcon,
  Zap,
  Plug,
  FolderOpen,
  CheckSquare,
  Users,
  Building2,
  Briefcase,
  MapPin,
  FileText,
  BookOpen
} from 'lucide-react';
import { groupDatalabelsByEntity, ENTITY_METADATA, convertDatalabelToCamelCase } from '../../../lib/entityDatalabelMapping';

interface SettingsItem {
  id: string;
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  category?: string;
  entityGroup?: string;
}

// Icon mapping for dynamic icons
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  FolderOpen,
  CheckSquare,
  Users,
  Building2,
  Briefcase,
  MapPin,
  FileText,
  BookOpen,
  LinkIcon,
  Zap,
  Plug
};

export function SettingsSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [datalabelSettings, setDatalabelSettings] = useState<SettingsItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch datalabel settings from API
  useEffect(() => {
    async function fetchDatalabels() {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch('http://localhost:4000/api/v1/setting/categories', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch settings categories');
        }

        const result = await response.json();
        const grouped = groupDatalabelsByEntity(result.data);

        // Convert grouped datalabels to settings items
        const items: SettingsItem[] = [];

        for (const [entityCode, datalabels] of Object.entries(grouped)) {
          const entityMeta = ENTITY_METADATA[entityCode];
          if (!entityMeta) continue;

          for (const datalabel of datalabels) {
            const iconComponent = ICON_MAP[datalabel.ui_icon] || FileText;

            items.push({
              id: datalabel.datalabel_name,
              name: datalabel.ui_label,
              href: `/setting/${datalabel.urlFormat}`,
              icon: iconComponent,
              category: 'Data Labels',
              entityGroup: entityMeta.name
            });
          }
        }

        setDatalabelSettings(items);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching datalabels:', error);
        setLoading(false);
      }
    }

    fetchDatalabels();
  }, []);

  // Static configuration settings
  const configurationSettings: SettingsItem[] = [
    { id: 'entity-mapping', name: 'Entity Mapping', href: '/linkage', icon: LinkIcon, category: 'Configuration' },
    { id: 'workflow-automation', name: 'Workflow Automation', href: '/workflow-automation', icon: Zap, category: 'Configuration' },
    { id: 'integrations', name: 'Integrations', href: '/integrations', icon: Plug, category: 'Configuration' },
  ];

  // Combine all settings items
  const allSettingsItems: SettingsItem[] = [...datalabelSettings, ...configurationSettings];

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return allSettingsItems;

    const query = searchQuery.toLowerCase();
    return allSettingsItems.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.category?.toLowerCase().includes(query) ||
      item.entityGroup?.toLowerCase().includes(query)
    );
  }, [searchQuery, allSettingsItems]);

  // Group items by entity or category
  const groupedItems = useMemo(() => {
    const groups: Record<string, SettingsItem[]> = {};

    filteredItems.forEach(item => {
      // Group data labels by their entity
      if (item.entityGroup) {
        const groupKey = `${item.entityGroup} Labels`;
        if (!groups[groupKey]) {
          groups[groupKey] = [];
        }
        groups[groupKey].push(item);
      } else {
        // Group other items by category
        const category = item.category || 'Other';
        if (!groups[category]) {
          groups[category] = [];
        }
        groups[category].push(item);
      }
    });

    // Sort groups by entity order
    const sortedGroups: Record<string, SettingsItem[]> = {};
    const entityOrder = Object.values(ENTITY_METADATA).sort((a, b) => a.order - b.order);

    // Add entity groups first
    for (const entity of entityOrder) {
      const groupKey = `${entity.name} Labels`;
      if (groups[groupKey]) {
        sortedGroups[groupKey] = groups[groupKey];
      }
    }

    // Add configuration and other groups
    if (groups['Configuration']) {
      sortedGroups['Configuration'] = groups['Configuration'];
    }
    if (groups['Other']) {
      sortedGroups['Other'] = groups['Other'];
    }

    return sortedGroups;
  }, [filteredItems]);

  const handleItemClick = (href: string) => {
    navigate(href);
  };

  const isActive = (href: string) => {
    return location.pathname === href;
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center h-14 px-4 border-b border-gray-200">
        <div className="flex items-center">
          <div className="h-7 w-7 border border-gray-300 rounded flex items-center justify-center">
            <span className="text-gray-700 font-normal text-xs">PMO</span>
          </div>
          <span className="ml-3 text-sm font-normal text-gray-800">Settings</span>
        </div>
      </div>

      {/* Search Box */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search settings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400/30 focus:border-gray-300"
          />
        </div>
      </div>

      {/* Settings Items List */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto">
        {Object.entries(groupedItems).map(([category, items]) => (
          <div key={category} className="mb-4">
            {/* Category Header */}
            <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
              {category}
            </div>

            {/* Category Items */}
            <div className="mt-1 space-y-0.5">
              {items.map((item) => {
                const IconComponent = item.icon;
                const active = isActive(item.href);

                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item.href)}
                    className={`${
                      active
                        ? 'bg-gray-100 text-gray-900 border-r-2 border-gray-300'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                    } w-full group flex items-center px-3 py-1.5 text-sm font-normal rounded-l-lg transition-all duration-200`}
                  >
                    <IconComponent className={`${
                      active ? 'text-gray-700' : 'text-gray-500 group-hover:text-gray-600'
                    } mr-3 h-4 w-4 stroke-[1.5] flex-shrink-0`} />
                    <span className="text-left">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* No Results Message */}
        {filteredItems.length === 0 && (
          <div className="px-3 py-8 text-center">
            <p className="text-sm text-gray-500">No settings found</p>
            <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
          </div>
        )}
      </nav>

      {/* Footer Info */}
      <div className="px-4 py-3 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          {filteredItems.length} setting{filteredItems.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}
