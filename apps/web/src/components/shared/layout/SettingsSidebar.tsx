import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  Tag,
  Link as LinkIcon,
  Zap,
  Plug,
  GitBranch,
  Palette,
  Target,
  Users,
  Building2,
  Briefcase,
  TrendingUp
} from 'lucide-react';

interface SettingsItem {
  id: string;
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  category?: string;
}

export function SettingsSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');

  // All settings items with data labels expanded
  const allSettingsItems: SettingsItem[] = [
    // Data Labels Category
    { id: 'project-stage', name: 'Project Stage', href: '/setting/projectStage', icon: GitBranch, category: 'Data Labels' },
    { id: 'task-stage', name: 'Task Stage', href: '/setting/taskStage', icon: Target, category: 'Data Labels' },
    { id: 'task-priority', name: 'Task Priority', href: '/setting/taskPriority', icon: TrendingUp, category: 'Data Labels' },
    { id: 'business-level', name: 'Business Level', href: '/setting/businessLevel', icon: Building2, category: 'Data Labels' },
    { id: 'office-level', name: 'Office Level', href: '/setting/orgLevel', icon: Building2, category: 'Data Labels' },
    { id: 'position-level', name: 'Position Level', href: '/setting/positionLevel', icon: Users, category: 'Data Labels' },
    { id: 'customer-tier', name: 'Customer Tier', href: '/setting/customerTier', icon: Users, category: 'Data Labels' },
    { id: 'opportunity-funnel', name: 'Opportunity Funnel', href: '/setting/opportunityFunnelLevel', icon: TrendingUp, category: 'Data Labels' },
    { id: 'industry-sector', name: 'Industry Sector', href: '/setting/industrySector', icon: Briefcase, category: 'Data Labels' },
    { id: 'acquisition-channel', name: 'Acquisition Channel', href: '/setting/acquisitionChannel', icon: TrendingUp, category: 'Data Labels' },

    // Other Settings
    { id: 'data-linkage', name: 'Data Linkage', href: '/linkage', icon: LinkIcon, category: 'Configuration' },
    { id: 'workflow-automation', name: 'Workflow Automation', href: '/workflow-automation', icon: Zap, category: 'Configuration' },
    { id: 'integrations', name: 'Integrations', href: '/integrations', icon: Plug, category: 'Configuration' },
  ];

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return allSettingsItems;

    const query = searchQuery.toLowerCase();
    return allSettingsItems.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.category?.toLowerCase().includes(query)
    );
  }, [searchQuery, allSettingsItems]);

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, SettingsItem[]> = {};
    filteredItems.forEach(item => {
      const category = item.category || 'Other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
    });
    return groups;
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
