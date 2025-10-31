import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/shared';
import { useSettings } from '../../contexts/SettingsContext';
import { AddDatalabelModal } from '../../components/shared/modals/AddDatalabelModal';
import * as LucideIcons from 'lucide-react';
import { getIconComponent } from '../../lib/iconMapping';

// Available icons for picker (must match iconMapping.ts)
const AVAILABLE_ICON_NAMES = [
  'Building2', 'MapPin', 'FolderOpen', 'UserCheck', 'FileText',
  'BookOpen', 'CheckSquare', 'Users', 'Package', 'Warehouse',
  'ShoppingCart', 'Truck', 'Receipt', 'Briefcase', 'BarChart',
  'DollarSign', 'TrendingUp'
].sort();
// Utility: Extract entity code from datalabel (dl__task_stage → task)
function getEntityCode(datalabelName: string): string {
  return datalabelName.replace(/^dl__/, '').split('_')[0];
}

// Utility: Convert to camelCase for URL (dl__task_stage → taskStage)
function toCamelCase(datalabelName: string): string {
  const withoutPrefix = datalabelName.replace(/^dl__/, '');
  const parts = withoutPrefix.split('_');
  return parts[0] + parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

// Utility: Capitalize first letter
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

interface SettingCard {
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  iconName?: string; // Store icon name for dynamic rendering
  href: string;
  category: string;
  entityGroup?: string;
}

interface ChildEntity {
  entity: string;
  ui_icon: string;
  ui_label: string;
  order: number;
}

interface EntityRow {
  code: string;
  name: string;
  ui_label: string;
  ui_icon?: string;
  display_order: number;
  active_flag: boolean;
  child_entities?: ChildEntity[];
}

export function SettingsOverviewPage() {
  const navigate = useNavigate();
  const { exitSettingsMode } = useSettings();
  const [datalabelSettings, setDatalabelSettings] = useState<SettingCard[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [entitiesLoading, setEntitiesLoading] = useState(true);
  const [mainSearchQuery, setMainSearchQuery] = useState('');
  const [dataLabelsSearchQuery, setDataLabelsSearchQuery] = useState('');
  const [entitiesSearchQuery, setEntitiesSearchQuery] = useState('');
  const [configExpanded, setConfigExpanded] = useState(true);
  const [dataLabelsExpanded, setDataLabelsExpanded] = useState(true);
  const [entitiesExpanded, setEntitiesExpanded] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalEntityCode, setModalEntityCode] = useState<string | undefined>(undefined);
  const [modalEntityName, setModalEntityName] = useState<string | undefined>(undefined);
  const [isAddingEntity, setIsAddingEntity] = useState(false);
  const [newEntityData, setNewEntityData] = useState<Partial<EntityRow>>({
    code: '',
    name: '',
    ui_label: '',
    ui_icon: '',
  });
  const [editingEntityCode, setEditingEntityCode] = useState<string | null>(null);
  const [editingEntityData, setEditingEntityData] = useState<Partial<EntityRow>>({});

  // Child entities management
  const [childEntitiesModalOpen, setChildEntitiesModalOpen] = useState(false);
  const [selectedEntityForChildren, setSelectedEntityForChildren] = useState<EntityRow | null>(null);
  const [childSearchQuery, setChildSearchQuery] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [selectedChildForIconChange, setSelectedChildForIconChange] = useState<string | null>(null);

  // Icon picker for entity edit mode
  const [showEntityIconPicker, setShowEntityIconPicker] = useState(false);
  const [iconSearchQuery, setIconSearchQuery] = useState('');

  // Icon picker for new entity row
  const [showNewEntityIconPicker, setShowNewEntityIconPicker] = useState(false);
  const [newIconSearchQuery, setNewIconSearchQuery] = useState('');

  // Static configuration settings
  const configurationSettings: SettingCard[] = [
    {
      title: 'Entity Mapping',
      description: 'Configure relationships and connections between different entities',
      icon: LucideIcons.Link,
      href: '/linkage',
      category: 'Configuration'
    },
    {
      title: 'Workflow Automation',
      description: 'Set up automated workflows and business process rules',
      icon: LucideIcons.Zap,
      href: '/workflow-automation',
      category: 'Configuration'
    },
    {
      title: 'Integrations',
      description: 'Connect external services and manage API integrations',
      icon: LucideIcons.Plug,
      href: '/integrations',
      category: 'Configuration'
    },
  ];

  // Fetch datalabel settings from API
  const fetchDatalabels = async () => {
    try {
      setLoading(true);
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

      // Convert to settings cards with dynamic entity grouping
      const cards: SettingCard[] = result.data.map((datalabel: any) => {
        const entityCode = getEntityCode(datalabel.datalabel_name);
        const iconComponent = getIconComponent(datalabel.ui_icon);

        return {
          title: datalabel.ui_label,
          description: `Manage ${datalabel.ui_label.toLowerCase()} settings`,
          icon: iconComponent,
          iconName: datalabel.ui_icon, // Store the original icon name
          href: `/setting/${toCamelCase(datalabel.datalabel_name)}`,
          category: 'Data Labels',
          entityGroup: capitalize(entityCode)
        };
      });

      console.log('[fetchDatalabels] Loaded', cards.length, 'datalabel cards');

      setDatalabelSettings(cards);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching datalabels:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatalabels();
    fetchEntities();
  }, []);

  // Fetch entities from API
  const fetchEntities = async () => {
    try {
      setEntitiesLoading(true);
      const token = localStorage.getItem('auth_token');
      const response = await fetch('http://localhost:4000/api/v1/entity/types', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch entities');
      }

      const result = await response.json();
      setEntities(result);
      setEntitiesLoading(false);
    } catch (error) {
      console.error('Error fetching entities:', error);
      setEntitiesLoading(false);
    }
  };

  // Handle adding new datalabel
  const handleAddDatalabel = async (data: {
    entity_code: string;
    label_name: string;
    ui_label: string;
    ui_icon?: string;
  }) => {
    const token = localStorage.getItem('auth_token');
    const response = await fetch('http://localhost:4000/api/v1/setting/category', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create datalabel');
    }

    const result = await response.json();
    const createdDatalabelName = result.data.datalabel_name; // e.g., "dl__product_product_category"

    // Refresh the list
    await fetchDatalabels();

    // Navigate to the newly created data label's data table view
    const camelCaseName = toCamelCase(createdDatalabelName); // e.g., "productProductCategory"
    navigate(`/setting/${camelCaseName}`);
  };

  // Open modal for new entity datalabel
  const handleOpenAddModal = (entityCode?: string, entityName?: string) => {
    setModalEntityCode(entityCode);
    setModalEntityName(entityName);
    setIsAddModalOpen(true);
  };

  // Handle adding new entity
  const handleAddEntity = async () => {
    if (!newEntityData.code || !newEntityData.name || !newEntityData.ui_label) {
      alert('Please fill in code, name, and UI label');
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('http://localhost:4000/api/v1/entity', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newEntityData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create entity');
      }

      // Reset form and refresh list
      setNewEntityData({ code: '', name: '', ui_label: '', ui_icon: '' });
      setIsAddingEntity(false);
      await fetchEntities();
    } catch (error: any) {
      alert(error.message || 'Failed to create entity');
    }
  };

  // Handle updating entity
  const handleUpdateEntity = async (code: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`http://localhost:4000/api/v1/entity/${code}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editingEntityData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update entity');
      }

      // Reset edit state and refresh list
      setEditingEntityCode(null);
      setEditingEntityData({});
      await fetchEntities();
    } catch (error: any) {
      alert(error.message || 'Failed to update entity');
    }
  };

  // Handle deleting entity (soft delete)
  const handleDeleteEntity = async (code: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the entity type "${name}" (${code})? This will deactivate it from the system.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`http://localhost:4000/api/v1/entity/${code}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete entity');
      }

      // Refresh list after deletion
      await fetchEntities();
    } catch (error: any) {
      alert(error.message || 'Failed to delete entity');
    }
  };

  // Handle opening child entities modal
  const handleManageChildren = (entity: EntityRow) => {
    setSelectedEntityForChildren(entity);
    setChildEntitiesModalOpen(true);
  };

  // Handle updating child entities
  const handleUpdateChildEntities = async (code: string, childEntities: ChildEntity[]) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`http://localhost:4000/api/v1/entity/${code}/children`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ child_entities: childEntities })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update child entities');
      }

      // Refresh list after update
      await fetchEntities();
    } catch (error: any) {
      alert(error.message || 'Failed to update child entities');
    }
  };

  // Handle removing a child entity
  const handleRemoveChild = async (parentCode: string, childEntity: string) => {
    const parent = entities.find(e => e.code === parentCode);
    if (!parent) return;

    const updatedChildren = (parent.child_entities || []).filter(c => c.entity !== childEntity);
    await handleUpdateChildEntities(parentCode, updatedChildren);

    // Update selected entity for modal
    if (selectedEntityForChildren && selectedEntityForChildren.code === parentCode) {
      setSelectedEntityForChildren({ ...parent, child_entities: updatedChildren });
    }
  };

  // Handle adding a child entity
  const handleAddChild = async (parentCode: string, childCode: string) => {
    const parent = entities.find(e => e.code === parentCode);
    const child = entities.find(e => e.code === childCode);
    if (!parent || !child) return;

    // Check if already exists
    if ((parent.child_entities || []).some(c => c.entity === childCode)) {
      alert('This child entity is already added');
      return;
    }

    const newChild: ChildEntity = {
      entity: child.code,
      ui_icon: child.ui_icon || 'Tag',
      ui_label: child.ui_label,
      order: (parent.child_entities || []).length + 1
    };

    const updatedChildren = [...(parent.child_entities || []), newChild];
    await handleUpdateChildEntities(parentCode, updatedChildren);

    // Update selected entity for modal
    if (selectedEntityForChildren && selectedEntityForChildren.code === parentCode) {
      setSelectedEntityForChildren({ ...parent, child_entities: updatedChildren });
    }

    setChildSearchQuery('');
  };

  // Handle changing child entity icon
  const handleChangeChildIcon = async (parentCode: string, childEntity: string, newIcon: string) => {
    const parent = entities.find(e => e.code === parentCode);
    if (!parent) return;

    const updatedChildren = (parent.child_entities || []).map(c =>
      c.entity === childEntity ? { ...c, ui_icon: newIcon } : c
    );

    await handleUpdateChildEntities(parentCode, updatedChildren);

    // Update selected entity for modal
    if (selectedEntityForChildren && selectedEntityForChildren.code === parentCode) {
      setSelectedEntityForChildren({ ...parent, child_entities: updatedChildren });
    }

    setShowIconPicker(false);
    setSelectedChildForIconChange(null);
  };

  // Filter main settings by search query
  const filteredMainSettings = useMemo(() => {
    if (!mainSearchQuery.trim()) return configurationSettings;

    const query = mainSearchQuery.toLowerCase();
    return configurationSettings.filter(card =>
      card.title.toLowerCase().includes(query) ||
      card.description.toLowerCase().includes(query)
    );
  }, [mainSearchQuery, configurationSettings]);

  // Filter and group data labels by search query
  const filteredDataLabels = useMemo(() => {
    if (!dataLabelsSearchQuery.trim()) return datalabelSettings;

    const query = dataLabelsSearchQuery.toLowerCase();
    return datalabelSettings.filter(card =>
      card.title.toLowerCase().includes(query) ||
      card.description.toLowerCase().includes(query) ||
      card.entityGroup?.toLowerCase().includes(query)
    );
  }, [dataLabelsSearchQuery, datalabelSettings]);

  // Group data labels by entity
  const groupedDataLabels = useMemo(() => {
    const groups: Record<string, SettingCard[]> = {};

    filteredDataLabels.forEach(card => {
      if (card.entityGroup) {
        const groupKey = card.entityGroup;
        if (!groups[groupKey]) {
          groups[groupKey] = [];
        }
        groups[groupKey].push(card);
      }
    });

    // Sort groups alphabetically by entity name
    const sortedGroups: Record<string, SettingCard[]> = {};
    Object.keys(groups).sort().forEach(key => {
      sortedGroups[key] = groups[key];
    });

    return sortedGroups;
  }, [filteredDataLabels]);

  // Filter entities by search query
  const filteredEntities = useMemo(() => {
    if (!entitiesSearchQuery.trim()) return entities;

    const query = entitiesSearchQuery.toLowerCase();
    return entities.filter(entity =>
      entity.code.toLowerCase().includes(query) ||
      entity.name.toLowerCase().includes(query) ||
      entity.ui_label.toLowerCase().includes(query)
    );
  }, [entitiesSearchQuery, entities]);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6">
        {/* Compact header */}
        <div className="mb-6">
          <div className="flex items-center gap-2.5">
            <button
              onClick={exitSettingsMode}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
              title="Exit Settings"
            >
              <LucideIcons.ArrowLeft className="h-4 w-4 stroke-[1.5]" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200">
                <LucideIcons.Settings className="h-5 w-5 text-gray-700 stroke-[1.5]" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
                <p className="text-xs text-gray-500">Manage configuration and data labels</p>
              </div>
            </div>
          </div>
        </div>

        {/* Compact Configuration Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setConfigExpanded(!configExpanded)}
              className="flex items-center gap-2 hover:opacity-70 transition-opacity"
            >
              <h2 className="text-sm font-semibold text-gray-900">Configuration</h2>
              <span className="px-1.5 py-0.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
                {filteredMainSettings.length}
              </span>
              <LucideIcons.ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${configExpanded ? '' : '-rotate-90'}`} />
            </button>
            {configExpanded && (
              <div className="relative w-56">
                <LucideIcons.Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={mainSearchQuery}
                  onChange={(e) => setMainSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-300/50 focus:border-gray-300 transition-all"
                />
              </div>
            )}
          </div>
          {configExpanded && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredMainSettings.map((card) => {
              const IconComponent = card.icon;
              return (
                <button
                  key={card.href}
                  onClick={() => navigate(card.href)}
                  className="group bg-white border border-gray-200 rounded-lg p-3.5 hover:border-gray-300 hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-50 to-blue-100 rounded-md group-hover:from-blue-100 group-hover:to-blue-200 transition-all">
                      <IconComponent className="h-4 w-4 text-blue-700 stroke-[1.5]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 mb-0.5 group-hover:text-gray-700 transition-colors">
                        {card.title}
                      </h3>
                      <p className="text-xs text-gray-500 line-clamp-2">{card.description}</p>
                    </div>
                  </div>
                </button>
              );
              })}
            </div>
          )}
          {configExpanded && filteredMainSettings.length === 0 && (
            <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
              <LucideIcons.Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-xs text-gray-500">No results for "{mainSearchQuery}"</p>
            </div>
          )}
        </div>

        {/* Entities Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setEntitiesExpanded(!entitiesExpanded)}
              className="flex items-center gap-2 hover:opacity-70 transition-opacity"
            >
              <h2 className="text-sm font-semibold text-gray-900">Entities</h2>
              <span className="px-1.5 py-0.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
                {entities.length}
              </span>
              <LucideIcons.ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${entitiesExpanded ? '' : '-rotate-90'}`} />
            </button>
            {entitiesExpanded && (
              <div className="relative w-56">
                <LucideIcons.Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={entitiesSearchQuery}
                  onChange={(e) => setEntitiesSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-300/50 focus:border-gray-300 transition-all"
                />
              </div>
            )}
          </div>

          {entitiesExpanded && entitiesLoading ? (
            <div className="text-center py-10 bg-gray-50 rounded-lg border border-gray-200">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-gray-400"></div>
              <p className="text-xs text-gray-600 mt-2 font-medium">Loading...</p>
            </div>
          ) : entitiesExpanded && filteredEntities.length === 0 && !isAddingEntity ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
              <LucideIcons.Tag className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-xs text-gray-500">No entities found</p>
            </div>
          ) : entitiesExpanded ? (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/80">
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Code</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">UI Label</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Icon</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Order</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Children</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredEntities.map((entity) => {
                    const isEditing = editingEntityCode === entity.code;
                    return (
                      <tr key={entity.code} className={isEditing ? 'bg-blue-50/30' : 'hover:bg-gray-50/50 transition-colors'}>
                        <td className="px-3 py-2.5">
                          <span className="text-[11px] font-mono font-medium text-gray-700">{entity.code}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingEntityData.name ?? entity.name}
                              onChange={(e) => setEditingEntityData({ ...editingEntityData, name: e.target.value })}
                              className="w-full px-2 py-1 text-[11px] border border-gray-300 rounded focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
                            />
                          ) : (
                            <span className="text-[11px] font-medium text-gray-900">{entity.name}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingEntityData.ui_label ?? entity.ui_label}
                              onChange={(e) => setEditingEntityData({ ...editingEntityData, ui_label: e.target.value })}
                              className="w-full px-2 py-1 text-[11px] border border-gray-300 rounded focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
                            />
                          ) : (
                            <span className="text-[11px] text-gray-700">{entity.ui_label}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {isEditing ? (
                            <div className="relative">
                              <button
                                onClick={() => setShowEntityIconPicker(!showEntityIconPicker)}
                                className="flex items-center gap-2 px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                                type="button"
                              >
                                {(() => {
                                  const EditIcon = getIconComponent(editingEntityData.ui_icon ?? entity.ui_icon);
                                  return <EditIcon className="h-4 w-4 text-blue-600" />;
                                })()}
                                <span className="text-xs text-gray-600">{(editingEntityData.ui_icon ?? entity.ui_icon) || 'Select'}</span>
                                <LucideIcons.ChevronDown className="h-3 w-3" />
                              </button>

                              {/* Icon Picker Dropdown */}
                              {showEntityIconPicker && (
                                <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3 w-96">
                                  <div className="mb-2">
                                    <div className="relative">
                                      <LucideIcons.Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                                      <input
                                        type="text"
                                        value={iconSearchQuery}
                                        onChange={(e) => setIconSearchQuery(e.target.value)}
                                        placeholder="Search icons..."
                                        className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-400/30"
                                        autoFocus
                                      />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-8 gap-1 max-h-64 overflow-y-auto">
                                    {AVAILABLE_ICON_NAMES
                                      .filter(iconName =>
                                        iconSearchQuery === '' ||
                                        iconName.toLowerCase().includes(iconSearchQuery.toLowerCase())
                                      )
                                      .map((iconName) => {
                                        const IconComponent = getIconComponent(iconName);
                                        const isSelected = (editingEntityData.ui_icon ?? entity.ui_icon) === iconName;
                                        return (
                                          <button
                                            key={iconName}
                                            onClick={() => {
                                              setEditingEntityData({ ...editingEntityData, ui_icon: iconName });
                                              setShowEntityIconPicker(false);
                                              setIconSearchQuery('');
                                            }}
                                            className={`p-2 rounded hover:bg-blue-50 transition-colors ${isSelected ? 'bg-blue-100 ring-2 ring-blue-400' : ''}`}
                                            title={iconName}
                                            type="button"
                                          >
                                            <IconComponent className="h-4 w-4 text-gray-700" />
                                          </button>
                                        );
                                      })}
                                  </div>
                                  <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2">
                                    <span className="text-xs text-gray-500">
                                      {AVAILABLE_ICON_NAMES.filter(name =>
                                        iconSearchQuery === '' || name.toLowerCase().includes(iconSearchQuery.toLowerCase())
                                      ).length} icons
                                    </span>
                                    <button
                                      onClick={() => {
                                        setShowEntityIconPicker(false);
                                        setIconSearchQuery('');
                                      }}
                                      className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                                      type="button"
                                    >
                                      Close
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {React.createElement(getIconComponent(entity.ui_icon), {
                                className: "h-4 w-4 text-gray-600"
                              })}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editingEntityData.display_order ?? entity.display_order}
                              onChange={(e) => setEditingEntityData({ ...editingEntityData, display_order: parseInt(e.target.value) })}
                              className="w-16 px-2 py-1 text-[11px] border border-gray-300 rounded focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 text-center"
                            />
                          ) : (
                            <span className="text-[11px] font-medium text-gray-700">{entity.display_order}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="group relative">
                            <button
                              onClick={() => handleManageChildren(entity)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] text-blue-600 hover:bg-blue-50 rounded border border-blue-200/60 transition-colors font-medium"
                              title="Manage child entities"
                            >
                              <LucideIcons.GitBranch className="h-3 w-3" />
                              <span>{(entity.child_entities || []).length}</span>
                            </button>

                            {/* Tooltip showing child icons */}
                            {(entity.child_entities || []).length > 0 && (
                              <div className="invisible group-hover:visible absolute left-0 top-8 z-10 bg-gray-900 text-white text-[10px] rounded-lg py-2 px-3 shadow-lg whitespace-nowrap">
                                <div className="space-y-1">
                                  {(entity.child_entities || []).slice(0, 5).map((child) => {
                                    return (
                                      <div key={child.entity} className="flex items-center gap-2">
                                        {(() => {
                                          const ChildIcon = getIconComponent(child.ui_icon);
                                          return <ChildIcon className="h-3 w-3" />;
                                        })()}
                                        <span>{child.ui_label}</span>
                                      </div>
                                    );
                                  })}
                                  {(entity.child_entities || []).length > 5 && (
                                    <div className="text-gray-400 text-[10px]">
                                      +{(entity.child_entities || []).length - 5} more...
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-center gap-1">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => handleUpdateEntity(entity.code)}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                                  title="Save"
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingEntityCode(null);
                                    setEditingEntityData({});
                                  }}
                                  className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                                  title="Cancel"
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingEntityCode(entity.code);
                                    setEditingEntityData(entity);
                                  }}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                  title="Edit"
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteEntity(entity.code, entity.name)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  title="Delete"
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Add new entity row */}
                  {isAddingEntity && (
                    <tr className="bg-blue-50/40">
                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          value={newEntityData.code}
                          onChange={(e) => setNewEntityData({ ...newEntityData, code: e.target.value.toLowerCase() })}
                          placeholder="code"
                          className="w-full px-2 py-1 text-[11px] border border-gray-300 rounded focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          value={newEntityData.name}
                          onChange={(e) => setNewEntityData({ ...newEntityData, name: e.target.value })}
                          placeholder="Name"
                          className="w-full px-2 py-1 text-[11px] border border-gray-300 rounded focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          value={newEntityData.ui_label}
                          onChange={(e) => setNewEntityData({ ...newEntityData, ui_label: e.target.value })}
                          placeholder="UI Label"
                          className="w-full px-2 py-1 text-[11px] border border-gray-300 rounded focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="relative">
                          <button
                            onClick={() => setShowNewEntityIconPicker(!showNewEntityIconPicker)}
                            className="flex items-center gap-1.5 px-2 py-1 text-[11px] border border-gray-300 rounded hover:bg-white transition-colors"
                            type="button"
                          >
                            {newEntityData.ui_icon ? (
                              (() => {
                                const NewIcon = getIconComponent(newEntityData.ui_icon);
                                return <NewIcon className="h-3.5 w-3.5 text-blue-600" />;
                              })()
                            ) : (
                              <LucideIcons.Tag className="h-3.5 w-3.5 text-gray-400" />
                            )}
                            <span className="text-[10px] text-gray-600">{newEntityData.ui_icon || 'Select'}</span>
                            <LucideIcons.ChevronDown className="h-3 w-3" />
                          </button>

                          {/* Icon Picker Dropdown */}
                          {showNewEntityIconPicker && (
                            <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3 w-96">
                              <div className="mb-2">
                                <div className="relative">
                                  <LucideIcons.Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                                  <input
                                    type="text"
                                    value={newIconSearchQuery}
                                    onChange={(e) => setNewIconSearchQuery(e.target.value)}
                                    placeholder="Search icons..."
                                    className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-400/30"
                                    autoFocus
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-8 gap-1 max-h-64 overflow-y-auto">
                                {AVAILABLE_ICON_NAMES
                                  .filter(iconName =>
                                    newIconSearchQuery === '' ||
                                    iconName.toLowerCase().includes(newIconSearchQuery.toLowerCase())
                                  )
                                  .map((iconName) => {
                                    const IconComponent = getIconComponent(iconName);
                                    const isSelected = newEntityData.ui_icon === iconName;
                                    return (
                                      <button
                                        key={iconName}
                                        onClick={() => {
                                          setNewEntityData({ ...newEntityData, ui_icon: iconName });
                                          setShowNewEntityIconPicker(false);
                                          setNewIconSearchQuery('');
                                        }}
                                        className={`p-2 rounded hover:bg-blue-50 transition-colors ${isSelected ? 'bg-blue-100 ring-2 ring-blue-400' : ''}`}
                                        title={iconName}
                                        type="button"
                                      >
                                        <IconComponent className="h-4 w-4 text-gray-700" />
                                      </button>
                                    );
                                  })}
                              </div>
                              <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2">
                                <span className="text-xs text-gray-500">
                                  {AVAILABLE_ICON_NAMES.filter(name =>
                                    newIconSearchQuery === '' || name.toLowerCase().includes(newIconSearchQuery.toLowerCase())
                                  ).length} icons
                                </span>
                                <button
                                  onClick={() => {
                                    setShowNewEntityIconPicker(false);
                                    setNewIconSearchQuery('');
                                  }}
                                  className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                                  type="button"
                                >
                                  Close
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="number"
                          value={newEntityData.display_order || ''}
                          onChange={(e) => setNewEntityData({ ...newEntityData, display_order: parseInt(e.target.value) || undefined })}
                          placeholder="Auto"
                          className="w-16 px-2 py-1 text-[11px] border border-gray-300 rounded focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 text-center"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="text-[10px] text-gray-400">-</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            onClick={handleAddEntity}
                            className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Save"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              setIsAddingEntity(false);
                              setNewEntityData({ code: '', name: '', ui_label: '', ui_icon: '' });
                            }}
                            className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                            title="Cancel"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Add Entity Button */}
              {!isAddingEntity && (
                <div className="border-t border-gray-200 bg-gray-50/50">
                  <button
                    onClick={() => setIsAddingEntity(true)}
                    className="w-full px-3 py-2 text-left text-[11px] font-semibold text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2"
                  >
                    <LucideIcons.Plus className="h-3.5 w-3.5" />
                    <span>Add Entity</span>
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Compact Data Labels Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setDataLabelsExpanded(!dataLabelsExpanded)}
              className="flex items-center gap-2 hover:opacity-70 transition-opacity"
            >
              <h2 className="text-sm font-semibold text-gray-900">Data Labels</h2>
              <span className="px-1.5 py-0.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
                {datalabelSettings.length}
              </span>
              <LucideIcons.ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${dataLabelsExpanded ? '' : '-rotate-90'}`} />
            </button>
            {dataLabelsExpanded && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenAddModal()}
                  className="p-1.5 rounded-md text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-all"
                  title="Add New Datalabel or Entity"
                >
                  <LucideIcons.Plus className="h-4 w-4 stroke-[2]" />
                </button>
                <div className="relative w-56">
                  <LucideIcons.Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={dataLabelsSearchQuery}
                    onChange={(e) => setDataLabelsSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-300/50 focus:border-gray-300 transition-all"
                  />
                </div>
              </div>
            )}
          </div>

          {dataLabelsExpanded && loading ? (
            <div className="text-center py-10 bg-gray-50 rounded-lg border border-gray-200">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-gray-400"></div>
              <p className="text-xs text-gray-600 mt-2 font-medium">Loading...</p>
            </div>
          ) : dataLabelsExpanded && Object.keys(groupedDataLabels).length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
              <LucideIcons.Tag className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-xs text-gray-500">No results for "{dataLabelsSearchQuery}"</p>
            </div>
          ) : dataLabelsExpanded ? (
            <div className="space-y-4">
              {Object.entries(groupedDataLabels).map(([entityName, cards]) => {
                // Get entity code from the first card in this group
                const firstCard = cards[0];
                const entityCodeForGroup = firstCard ? getEntityCode(
                  firstCard.href.replace('/setting/', '').replace(/([A-Z])/g, '_$1').toLowerCase()
                ) : entityName.toLowerCase();

                return (
                  <div key={entityName} className="bg-white border border-gray-200 rounded-lg p-3.5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                          {entityName}
                        </h3>
                        <span className="px-1.5 py-0.5 text-xs font-medium text-gray-500 bg-gray-50 rounded-full">
                          {cards.length}
                        </span>
                      </div>
                      <button
                        onClick={() => handleOpenAddModal(entityCodeForGroup, entityName)}
                        className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                        title={`Add datalabel to ${entityName}`}
                      >
                        <LucideIcons.Plus className="h-3.5 w-3.5 stroke-[2]" />
                      </button>
                    </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                    {cards.map((card) => {
                      // Get icon component dynamically using the stored icon name
                      const IconComponent = card.iconName ? getIconComponent(card.iconName) : card.icon;
                      return (
                        <button
                          key={card.href}
                          onClick={() => navigate(card.href)}
                          className="group bg-gray-50 border border-gray-200 rounded-md p-2.5 hover:bg-white hover:border-gray-300 hover:shadow-sm transition-all text-left"
                        >
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-white rounded border border-gray-200 group-hover:border-gray-300 transition-all">
                              <IconComponent className="h-3.5 w-3.5 text-gray-600 stroke-[1.5] flex-shrink-0" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs font-medium text-gray-900 group-hover:text-gray-700 transition-colors truncate">
                                {card.title}
                              </h4>
                            </div>
                          </div>
                        </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {/* Add Datalabel Modal */}
      <AddDatalabelModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setModalEntityCode(undefined);
          setModalEntityName(undefined);
        }}
        onSubmit={handleAddDatalabel}
        entityCode={modalEntityCode}
        entityName={modalEntityName}
      />

      {/* Child Entities Management Modal */}
      {childEntitiesModalOpen && selectedEntityForChildren && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <LucideIcons.GitBranch className="h-5 w-5 text-blue-700" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Manage Child Entities
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {selectedEntityForChildren.ui_label} ({selectedEntityForChildren.code})
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setChildEntitiesModalOpen(false);
                  setSelectedEntityForChildren(null);
                  setChildSearchQuery('');
                }}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Current Children */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Current Child Entities</h3>
                {(selectedEntityForChildren.child_entities || []).length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No child entities configured</p>
                ) : (
                  <div className="space-y-1">
                    {(selectedEntityForChildren.child_entities || []).map((child) => {
                      return (
                        <div
                          key={child.entity}
                          className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <button
                                onClick={() => {
                                  setSelectedChildForIconChange(child.entity);
                                  setShowIconPicker(true);
                                }}
                                className="p-1 hover:bg-gray-200 rounded transition-colors"
                                title="Change icon"
                              >
                                {(() => {
                                  const ChildIconBtn = getIconComponent(child.ui_icon);
                                  return <ChildIconBtn className="h-4 w-4 text-blue-600" />;
                                })()}
                              </button>

                              {/* Icon Picker Dropdown */}
                              {showIconPicker && selectedChildForIconChange === child.entity && (
                                <div className="absolute left-0 top-8 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-2 w-64">
                                  <div className="mb-2">
                                    <p className="text-xs font-medium text-gray-700 mb-1">Select Icon</p>
                                  </div>
                                  <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto">
                                    {AVAILABLE_ICON_NAMES.map((iconName) => {
                                      const IconComponent = getIconComponent(iconName);
                                      return (
                                        <button
                                          key={iconName}
                                          onClick={() => handleChangeChildIcon(selectedEntityForChildren.code, child.entity, iconName)}
                                          className={`p-2 rounded hover:bg-blue-50 transition-colors ${child.ui_icon === iconName ? 'bg-blue-100 ring-2 ring-blue-400' : ''}`}
                                          title={iconName}
                                        >
                                          <IconComponent className="h-4 w-4 text-gray-700" />
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <button
                                    onClick={() => {
                                      setShowIconPicker(false);
                                      setSelectedChildForIconChange(null);
                                    }}
                                    className="mt-2 w-full px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                                  >
                                    Close
                                  </button>
                                </div>
                              )}
                            </div>
                            <span className="text-xs font-medium text-gray-700">{child.ui_label}</span>
                            <span className="text-xs text-gray-400">({child.entity})</span>
                          </div>
                          <button
                            onClick={() => handleRemoveChild(selectedEntityForChildren.code, child.entity)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="Remove"
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add Child Search */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Add Child Entity</h3>
                <div className="relative mb-2">
                  <LucideIcons.Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                  <input
                    type="text"
                    value={childSearchQuery}
                    onChange={(e) => setChildSearchQuery(e.target.value)}
                    placeholder="Search entities..."
                    className="w-full pl-8 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {entities
                    .filter(e =>
                      e.code !== selectedEntityForChildren.code && // Not self
                      !(selectedEntityForChildren.child_entities || []).some(c => c.entity === e.code) && // Not already added
                      (childSearchQuery === '' ||
                        e.code.toLowerCase().includes(childSearchQuery.toLowerCase()) ||
                        e.ui_label.toLowerCase().includes(childSearchQuery.toLowerCase()))
                    )
                    .map((entity) => {
                      return (
                        <button
                          key={entity.code}
                          onClick={() => handleAddChild(selectedEntityForChildren.code, entity.code)}
                          className="w-full flex items-center justify-between px-3 py-2 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2">
                            {(() => {
                              const EntityIcon = getIconComponent(entity.ui_icon);
                              return <EntityIcon className="h-4 w-4 text-gray-600" />;
                            })()}
                            <span className="text-xs font-medium text-gray-700">{entity.ui_label}</span>
                            <span className="text-xs text-gray-400">({entity.code})</span>
                          </div>
                          <LucideIcons.Plus className="h-3 w-3 text-green-500" />
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setChildEntitiesModalOpen(false);
                  setSelectedEntityForChildren(null);
                  setChildSearchQuery('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
