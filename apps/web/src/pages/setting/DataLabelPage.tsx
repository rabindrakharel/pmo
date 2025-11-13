import React, { useState, useRef, useEffect } from 'react';
import { Tag, Search, ChevronDown, X, Wrench } from 'lucide-react';
import { Layout } from '../../components/shared';
import { FilteredDataTable } from '../../components/shared';
import { ENTITY_ICONS, ENTITY_GROUPS } from '../../lib/entityIcons';

type SettingTab =
  | 'projectStage'
  | 'taskStage'
  | 'businessLevel'
  | 'orgLevel'
  | 'positionLevel'
  | 'opportunityFunnelLevel'
  | 'industrySector'
  | 'acquisitionChannel'
  | 'customerTier';

interface SettingItem {
  id: SettingTab;
  label: string;
  icon: React.ElementType;
  entity: string;
}

interface EntityGroup {
  name: string;
  icon: React.ElementType;
  color: string;
  settings: SettingItem[];
}

export function DataLabelPage() {
  const [selectedSettings, setSelectedSettings] = useState<SettingTab[]>(['projectStage']);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Entity-grouped settings configuration using centralized icons
  const entityGroups: EntityGroup[] = [
    {
      name: ENTITY_GROUPS.project.name,
      icon: ENTITY_GROUPS.project.icon,
      color: ENTITY_GROUPS.project.color,
      settings: [
        { id: 'projectStage', label: 'Project Stage', icon: ENTITY_ICONS.projectStage, entity: 'project' },
      ],
    },
    {
      name: ENTITY_GROUPS.task.name,
      icon: ENTITY_GROUPS.task.icon,
      color: ENTITY_GROUPS.task.color,
      settings: [
        { id: 'taskStage', label: 'Task Stage', icon: ENTITY_ICONS.taskStage, entity: 'task' },
      ],
    },
    {
      name: ENTITY_GROUPS.business.name,
      icon: ENTITY_GROUPS.business.icon,
      color: ENTITY_GROUPS.business.color,
      settings: [
        { id: 'businessLevel', label: 'Business Level', icon: ENTITY_ICONS.businessLevel, entity: 'business' },
        { id: 'orgLevel', label: 'Org Level', icon: ENTITY_ICONS.orgLevel, entity: 'business' },
      ],
    },
    {
      name: ENTITY_GROUPS.employee.name,
      icon: ENTITY_GROUPS.employee.icon,
      color: ENTITY_GROUPS.employee.color,
      settings: [
        { id: 'positionLevel', label: 'Position Level', icon: ENTITY_ICONS.positionLevel, entity: 'employee' },
      ],
    },
    {
      name: ENTITY_GROUPS.client.name,
      icon: ENTITY_GROUPS.client.icon,
      color: ENTITY_GROUPS.client.color,
      settings: [
        { id: 'opportunityFunnelLevel', label: 'Opportunity Funnel', icon: ENTITY_ICONS.opportunityFunnelLevel, entity: 'client' },
        { id: 'industrySector', label: 'Industry Sector', icon: ENTITY_ICONS.industrySector, entity: 'client' },
        { id: 'acquisitionChannel', label: 'Acquisition Channel', icon: ENTITY_ICONS.acquisitionChannel, entity: 'client' },
        { id: 'customerTier', label: 'Customer Tier', icon: ENTITY_ICONS.customerTier, entity: 'client' },
      ],
    },
  ];

  // Flatten all settings for search
  const allSettings = entityGroups.flatMap(group => group.settings);

  // Filter settings based on search
  const filteredGroups = entityGroups.map(group => ({
    ...group,
    settings: group.settings.filter(setting =>
      setting.label.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter(group => group.settings.length > 0);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleSetting = (settingId: SettingTab) => {
    setSelectedSettings(prev => {
      if (prev.includes(settingId)) {
        // Don't allow removing all settings
        if (prev.length === 1) return prev;
        return prev.filter(id => id !== settingId);
      } else {
        return [...prev, settingId];
      }
    });
  };

  const getSettingLabel = (settingId: SettingTab): string => {
    const setting = allSettings.find(s => s.id === settingId);
    return setting?.label || settingId;
  };

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      blue: { bg: 'bg-dark-100', text: 'text-dark-700', border: 'border-dark-400' },
      purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
      green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
      orange: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
      pink: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
    };
    return colors[color] || colors.blue;
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="bg-dark-100 shadow rounded-md">
          <div className="px-4 py-5 sm:p-6">
            {/* Header */}
            <div className="flex items-center mb-6">
              <Tag className="h-5 w-5 text-dark-700 stroke-[1.5] mr-3" />
              <div className="flex-1">
                <h1 className="text-sm font-normal text-dark-600">Data Labels</h1>
                <p className="text-sm text-dark-700">Manage system labels, stages, and dropdown options</p>
              </div>
            </div>

            {/* Searchable Dropdown Selector */}
            <div className="mb-6">
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 border border-dark-400 rounded-md bg-dark-100 hover:bg-dark-100 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Wrench className="h-5 w-5 text-dark-600 stroke-[1.5]" />
                    {selectedSettings.length === 0 ? (
                      <span className="text-dark-700">Select settings to manage...</span>
                    ) : (
                      <>
                        {selectedSettings.map(settingId => (
                          <span
                            key={settingId}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-dark-100 text-dark-700 rounded text-sm"
                          >
                            {getSettingLabel(settingId)}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSetting(settingId);
                              }}
                              className="hover:bg-dark-200 rounded-full p-0.5 cursor-pointer"
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.stopPropagation();
                                  toggleSetting(settingId);
                                }
                              }}
                            >
                              <X className="h-3 w-3 stroke-[1.5]" />
                            </div>
                          </span>
                        ))}
                      </>
                    )}
                  </div>
                  <ChevronDown className={`h-5 w-5 text-dark-600 stroke-[1.5] transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Panel */}
                {isDropdownOpen && (
                  <div className="absolute z-50 w-full mt-2 bg-dark-100 border border-dark-300 rounded-md shadow-lg max-h-96 overflow-hidden">
                    {/* Search Bar */}
                    <div className="p-3 border-b border-dark-300 sticky top-0 bg-dark-100">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-dark-600 stroke-[1.5]" />
                        <input
                          type="text"
                          placeholder="Search settings..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-dark-400 rounded-md focus:ring-2 focus:ring-dark-7000 focus:border-transparent"
                        />
                      </div>
                    </div>

                    {/* Entity Groups */}
                    <div className="overflow-y-auto max-h-80">
                      {filteredGroups.length === 0 ? (
                        <div className="p-4 text-center text-dark-700">
                          No settings found matching "{searchQuery}"
                        </div>
                      ) : (
                        filteredGroups.map((group, idx) => {
                          const colorClasses = getColorClasses(group.color);
                          const GroupIcon = group.icon;

                          return (
                            <div key={idx} className="border-b border-dark-300 last:border-b-0">
                              {/* Entity Group Header */}
                              <div className={`px-4 py-2 ${colorClasses.bg} ${colorClasses.border} border-b`}>
                                <div className="flex items-center gap-2">
                                  <GroupIcon className={`h-4 w-4 ${colorClasses.text}`} />
                                  <span className={`font-normal text-sm ${colorClasses.text}`}>
                                    {group.name}
                                  </span>
                                </div>
                              </div>

                              {/* Settings Checkboxes */}
                              <div className="py-1">
                                {group.settings.map((setting) => {
                                  const SettingIcon = setting.icon;
                                  const isSelected = selectedSettings.includes(setting.id);

                                  return (
                                    <label
                                      key={setting.id}
                                      className="flex items-center gap-3 px-4 py-2 hover:bg-dark-100 cursor-pointer transition-colors"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleSetting(setting.id)}
                                        className="h-4 w-4 text-dark-700 border-dark-400 rounded focus:ring-dark-7000"
                                      />
                                      <SettingIcon className="h-4 w-4 text-dark-600" />
                                      <span className="text-sm text-dark-600">{setting.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Settings Tables */}
            {selectedSettings.length === 0 ? (
              <div className="text-center py-12 text-dark-700">
                <Tag className="h-12 w-12 mx-auto mb-3 text-gray-300 stroke-[1.5]" />
                <p className="text-sm font-normal">No labels selected</p>
                <p className="text-sm">Use the dropdown above to select labels to manage</p>
              </div>
            ) : (
              <div className="space-y-8">
                {selectedSettings.map((settingId) => {
                  const setting = allSettings.find(s => s.id === settingId);
                  const SettingIcon = setting?.icon || Tag;

                  return (
                    <div key={settingId} className="border border-dark-300 rounded-md overflow-hidden">
                      {/* Section Header */}
                      <div className="bg-dark-100 px-4 py-3 border-b border-dark-300">
                        <div className="flex items-center gap-2">
                          <SettingIcon className="h-5 w-5 text-dark-700 stroke-[1.5]" />
                          <h2 className="text-sm font-normal text-dark-600">{setting?.label}</h2>
                        </div>
                      </div>

                      {/* Data Table */}
                      <div className="p-4">
                        <FilteredDataTable
                          entityType={settingId}
                          showActionIcons={true}
                          showEditIcon={true}
                          inlineEditable={true}
                          allowAddRow={true}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
