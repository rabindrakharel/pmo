import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/shared';
import { useSettings } from '../../contexts/SettingsContext';
import { AddDatalabelModal } from '../../components/shared/modals/AddDatalabelModal';
import { EntityConfigurationModal } from '../../components/settings/EntityConfigurationModal';
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

interface EntityRow {
  code: string;
  name: string;
  ui_label: string;
  ui_icon?: string;
  display_order: number;
  active_flag: boolean;
  dl_entity_domain?: string;
  // New columns from entity table v10.2.0
  db_table?: string;
  db_model_type?: 'd' | 'dh' | 'f' | 'fh' | 'fd' | string; // d=dimension, dh=dim hierarchy, f=fact, fh=fact head, fd=fact data
  config_datatable?: {
    defaultSort?: string;
    defaultSortOrder?: 'asc' | 'desc';
    itemsPerPage?: number;
  };
  root_level_entity_flag?: boolean;
  domain_id?: number;
  domain_code?: string;
  domain_name?: string;
  child_entity_codes?: string[]; // Simple array of entity codes
  child_entities?: Array<{
    entity: string;
    ui_icon: string;
    ui_label: string;
    order: number;
    ownership_flag?: boolean;
  }>; // Enriched child metadata (from API)
}

type MainTab = 'entities' | 'entityMapping' | 'secretsVault' | 'integrations';

export function SettingsOverviewPage() {
  const navigate = useNavigate();
  const { exitSettingsMode } = useSettings();
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('entities');
  const [datalabelSettings, setDatalabelSettings] = useState<SettingCard[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [entitiesLoading, setEntitiesLoading] = useState(true);
  const [mainSearchQuery, setMainSearchQuery] = useState('');
  const [dataLabelsSearchQuery, setDataLabelsSearchQuery] = useState('');
  const [entitiesSearchQuery, setEntitiesSearchQuery] = useState('');
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

  // Entity configuration modal
  const [selectedEntityForConfig, setSelectedEntityForConfig] = useState<EntityRow | null>(null);
  const [showEntityConfigModal, setShowEntityConfigModal] = useState(false);

  // Child entities management
  const [childEntitiesModalOpen, setChildEntitiesModalOpen] = useState(false);
  const [selectedEntityForChildren, setSelectedEntityForChildren] = useState<EntityRow | null>(null);
  const [childSearchQuery, setChildSearchQuery] = useState('');

  // Icon picker for entity edit mode
  const [showEntityIconPicker, setShowEntityIconPicker] = useState(false);
  const [iconSearchQuery, setIconSearchQuery] = useState('');



  // Icon picker for new entity row
  const [showNewEntityIconPicker, setShowNewEntityIconPicker] = useState(false);
  const [newIconSearchQuery, setNewIconSearchQuery] = useState('');

  // Role statistics for display
  const [roleStats, setRoleStats] = useState<{ total: number; active: number; loading: boolean }>({
    total: 0,
    active: 0,
    loading: true
  });

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
      const response = await fetch('http://localhost:4000/api/v1/datalabel/types', {
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

  // Fetch role statistics
  const fetchRoleStats = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

      const response = await fetch(`${apiBaseUrl}/api/v1/role?limit=100`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const activeRoles = data.data?.filter((r: any) => r.active_flag === true) || [];
        setRoleStats({
          total: data.total || 0,
          active: activeRoles.length,
          loading: false
        });
      } else {
        setRoleStats({ total: 0, active: 0, loading: false });
      }
    } catch (error) {
      console.error('Error fetching role stats:', error);
      setRoleStats({ total: 0, active: 0, loading: false });
    }
  };

  useEffect(() => {
    fetchDatalabels();
    fetchEntities();
    fetchRoleStats();
  }, []);

  // Fetch entities from API
  const fetchEntities = async () => {
    try {
      setEntitiesLoading(true);
      const token = localStorage.getItem('auth_token');
      // ✅ UNIFIED ENDPOINT: /api/v1/entity/codes (no param = all entities)
      const response = await fetch('http://localhost:4000/api/v1/entity/codes?include_inactive=true', {
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
    const response = await fetch('http://localhost:4000/api/v1/datalabel', {
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

  // Handle toggling entity active_flag
  const handleToggleEntityActive = async (code: string, currentActiveFlag: boolean) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`http://localhost:4000/api/v1/entity/${code}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ active_flag: !currentActiveFlag })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to toggle entity status');
      }

      // Refresh list after toggle
      await fetchEntities();
    } catch (error: any) {
      alert(error.message || 'Failed to toggle entity status');
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
          'Authorization': `Bearer ${token}`
          // No Content-Type needed for DELETE requests
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

  // Handle opening entity configuration modal
  const handleConfigureEntity = (entity: EntityRow) => {
    setSelectedEntityForConfig(entity);
    setShowEntityConfigModal(true);
  };

  // Handle closing entity configuration modal
  const handleCloseEntityConfigModal = () => {
    setShowEntityConfigModal(false);
    setSelectedEntityForConfig(null);
  };

  // Handle saving entity configuration
  const handleSaveEntityConfig = async () => {
    setShowEntityConfigModal(false);
    setSelectedEntityForConfig(null);
    // Refresh entities list
    await fetchEntities();
  };

  // Handle opening child entities modal
  const handleManageChildren = (entity: EntityRow) => {
    setSelectedEntityForChildren(entity);
    setChildEntitiesModalOpen(true);
  };

  // Handle updating child entities (accepts both string[] and object[] with ownership_flag)
  const handleUpdateChildEntities = async (
    code: string,
    childEntityCodes: Array<string | { entity: string; ownership_flag?: boolean; ui_label?: string; ui_icon?: string; order?: number }>,
    mode: 'append' | 'replace' = 'append'
  ) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`http://localhost:4000/api/v1/entity/${code}/children`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ child_entity_codes: childEntityCodes, mode })
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

    // Build updated children list preserving object format
    const currentChildEntities = parent.child_entities || [];
    const updatedChildEntities = currentChildEntities.filter(c => c.entity !== childEntity);

    // Use 'replace' mode to set the exact list (with item removed)
    await handleUpdateChildEntities(parentCode, updatedChildEntities, 'replace');

    // Update selected entity for modal
    if (selectedEntityForChildren && selectedEntityForChildren.code === parentCode) {
      setSelectedEntityForChildren({
        ...parent,
        child_entity_codes: updatedChildEntities.map(c => c.entity),
        child_entities: updatedChildEntities
      });
    }
  };

  // Handle toggling ownership_flag for a child entity
  const handleToggleOwnership = async (parentCode: string, childEntity: string) => {
    const parent = entities.find(e => e.code === parentCode);
    if (!parent) return;

    // Build updated children list with toggled ownership_flag
    const currentChildEntities = parent.child_entities || [];
    const updatedChildEntities = currentChildEntities.map(c => {
      if (c.entity === childEntity) {
        return { ...c, ownership_flag: !c.ownership_flag };
      }
      return c;
    });

    // Use 'replace' mode to update the entire list
    await handleUpdateChildEntities(parentCode, updatedChildEntities, 'replace');

    // Update selected entity for modal
    if (selectedEntityForChildren && selectedEntityForChildren.code === parentCode) {
      setSelectedEntityForChildren({
        ...parent,
        child_entities: updatedChildEntities
      });
    }
  };

  // Handle adding a child entity
  const handleAddChild = async (parentCode: string, childCode: string) => {
    const parent = entities.find(e => e.code === parentCode);
    const child = entities.find(e => e.code === childCode);
    if (!parent || !child) return;

    // Check if already exists
    if ((parent.child_entity_codes || []).includes(childCode)) {
      alert('This child entity is already added');
      return;
    }

    const updatedChildren = [...(parent.child_entity_codes || []), childCode];
    // Use 'append' mode to add new child (default behavior)
    await handleUpdateChildEntities(parentCode, updatedChildren, 'append');

    // Update selected entity for modal
    if (selectedEntityForChildren && selectedEntityForChildren.code === parentCode) {
      setSelectedEntityForChildren({ ...parent, child_entity_codes: updatedChildren });
    }

    setChildSearchQuery('');
  };

  // Get entity metadata by code
  const getEntityMetadata = (code: string) => {
    return entities.find(e => e.code === code);
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
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Modern header with gradient and better spacing */}
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={exitSettingsMode}
              className="p-2 rounded-md text-dark-500 hover:text-dark-700 hover:bg-dark-100 focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none transition-all"
              title="Exit Settings"
            >
              <LucideIcons.ArrowLeft className="h-5 w-5 stroke-[2]" />
            </button>
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-slate-100 rounded-xl border border-dark-200 shadow-sm">
                <LucideIcons.Settings className="h-6 w-6 text-slate-600 stroke-[1.5]" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-dark-800 tracking-tight">Settings</h1>
                <p className="text-sm text-dark-600 mt-0.5">Manage your system configuration and data labels</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Tabs */}
        <div className="bg-white rounded-xl p-4 border border-dark-200 shadow-sm mb-8">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveMainTab('entities')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none ${
                activeMainTab === 'entities'
                  ? 'bg-slate-600 text-white shadow-sm'
                  : 'bg-dark-50 text-dark-700 border border-dark-200 hover:bg-dark-100 hover:border-dark-300'
              }`}
            >
              <LucideIcons.Database className="h-3.5 w-3.5" />
              Entities ({entities.length})
            </button>

            <button
              onClick={() => setActiveMainTab('entityMapping')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none ${
                activeMainTab === 'entityMapping'
                  ? 'bg-slate-600 text-white shadow-sm'
                  : 'bg-dark-50 text-dark-700 border border-dark-200 hover:bg-dark-100 hover:border-dark-300'
              }`}
            >
              <LucideIcons.Link className="h-3.5 w-3.5" />
              Entity Mapping
            </button>


            <button
              onClick={() => setActiveMainTab('secretsVault')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none ${
                activeMainTab === 'secretsVault'
                  ? 'bg-slate-600 text-white shadow-sm'
                  : 'bg-dark-50 text-dark-700 border border-dark-200 hover:bg-dark-100 hover:border-dark-300'
              }`}
            >
              <LucideIcons.Lock className="h-3.5 w-3.5" />
              Secrets Vault
            </button>

            <button
              onClick={() => setActiveMainTab('integrations')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none ${
                activeMainTab === 'integrations'
                  ? 'bg-slate-600 text-white shadow-sm'
                  : 'bg-dark-50 text-dark-700 border border-dark-200 hover:bg-dark-100 hover:border-dark-300'
              }`}
            >
              <LucideIcons.Plug className="h-3.5 w-3.5" />
              Integrations
            </button>
          </div>
        </div>

        {/* Entity Mapping Tab */}
        {activeMainTab === 'entityMapping' && (
          <div className="bg-white border border-dark-200 rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-dark-800 mb-3 flex items-center gap-2">
              <LucideIcons.Link className="h-5 w-5 text-slate-600" />
              Entity Mapping
            </h2>
            <p className="text-sm text-dark-600 mb-4">
              Configure parent-child relationships and entity linkages using the <strong>d_entity_id_map</strong> table.
              Define how entities connect and interact with each other across the system.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMainSettings.map((card) => {
                const IconComponent = card.icon;
                return (
                  <button
                    key={card.href}
                    onClick={() => navigate(card.href)}
                    className="group bg-dark-50 border border-dark-200 rounded-lg p-4 hover:bg-white hover:border-slate-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none transition-all duration-200 text-left"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="p-2.5 bg-white rounded-md border border-dark-200 group-hover:border-slate-300 transition-all duration-200">
                        <IconComponent className="h-5 w-5 text-slate-600 stroke-[1.5]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-dark-800 mb-1 group-hover:text-slate-700 transition-colors">
                          {card.title}
                        </h3>
                        <p className="text-xs text-dark-600 line-clamp-2 leading-relaxed">{card.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}


        {/* Integrations Tab */}
        {activeMainTab === 'integrations' && (
          <div className="bg-white border border-dark-200 rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-dark-800 mb-3 flex items-center gap-2">
              <LucideIcons.Plug className="h-5 w-5 text-slate-600" />
              Integrations
            </h2>
            <p className="text-sm text-dark-600 mb-4">
              Manage external service integrations, API connections, and third-party system configurations.
              Configure webhooks, OAuth providers, and external data sources.
            </p>
            <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 text-sm text-sky-900">
              <p className="font-semibold mb-2">Integration Features</p>
              <ul className="list-disc list-inside space-y-1 text-sky-700">
                <li>Connect to third-party APIs and services</li>
                <li>Configure webhooks for real-time events</li>
                <li>Set up OAuth providers for authentication</li>
                <li>Manage API keys and credentials</li>
                <li>Configure data synchronization schedules</li>
              </ul>
            </div>
          </div>
        )}

        {/* Secrets Vault Tab */}
        {activeMainTab === 'secretsVault' && (
          <div className="bg-white border border-dark-200 rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-dark-800 mb-3 flex items-center gap-2">
              <LucideIcons.Lock className="h-5 w-5 text-slate-600" />
              Secrets Vault
            </h2>
            <p className="text-sm text-dark-600 mb-4">
              Securely manage API keys, passwords, certificates, and other sensitive credentials.
              All secrets are encrypted and stored with audit logging for compliance.
            </p>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-900">
              <p className="font-semibold mb-2">Secrets Management Features</p>
              <ul className="list-disc list-inside space-y-1 text-emerald-700">
                <li>Store API keys and tokens securely</li>
                <li>Manage database connection strings</li>
                <li>Store SSL certificates and private keys</li>
                <li>Environment-specific secret management</li>
                <li>Audit trail for all secret access</li>
                <li>Automatic secret rotation policies</li>
              </ul>
            </div>
          </div>
        )}

        {/* Entities Tab - Modern Card-Based Design */}
        {activeMainTab === 'entities' && (
        <div>
          {/* Header with Search and Filters */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-dark-800 tracking-tight">Entities</h2>
              <span className="px-2 py-0.5 text-xs font-medium bg-dark-100 text-dark-600 rounded-full">
                {entities.length}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative w-72">
                <LucideIcons.Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-dark-400" />
                <input
                  type="text"
                  placeholder="Search by code, name, or domain..."
                  value={entitiesSearchQuery}
                  onChange={(e) => setEntitiesSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-dark-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400 transition-all placeholder:text-dark-400"
                />
              </div>
              {/* Add Entity Button */}
              <button
                onClick={() => setIsAddingEntity(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors shadow-sm"
              >
                <LucideIcons.Plus className="h-4 w-4" />
                Add Entity
              </button>
            </div>
          </div>

          {entitiesLoading ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-dark-200 shadow-sm">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-dark-200 border-t-slate-600"></div>
              <p className="text-sm font-medium text-dark-600 mt-4">Loading entities...</p>
            </div>
          ) : filteredEntities.length === 0 && !isAddingEntity ? (
            <div className="flex flex-col items-center justify-center py-12 bg-white rounded-xl border border-dark-200 shadow-sm">
              <LucideIcons.Database className="h-10 w-10 text-dark-300 mb-3" />
              <p className="text-sm font-medium text-dark-700">No entities found</p>
              <p className="text-xs text-dark-500 mt-1">Try adjusting your search or add a new entity</p>
            </div>
          ) : (
            <div className="bg-white border border-dark-200 rounded-xl overflow-hidden shadow-sm">
              {/* Modern Compact Table with Horizontal Scroll */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-dark-200">
                  <thead className="bg-dark-50/80">
                    <tr>
                      <th className="px-4 py-3 text-left text-2xs font-semibold text-dark-500 uppercase tracking-wider w-10"></th>
                      <th className="px-4 py-3 text-left text-2xs font-semibold text-dark-500 uppercase tracking-wider">Entity</th>
                      <th className="px-4 py-3 text-left text-2xs font-semibold text-dark-500 uppercase tracking-wider">DB Table</th>
                      <th className="px-4 py-3 text-center text-2xs font-semibold text-dark-500 uppercase tracking-wider">Model</th>
                      <th className="px-4 py-3 text-left text-2xs font-semibold text-dark-500 uppercase tracking-wider">Domain</th>
                      <th className="px-4 py-3 text-center text-2xs font-semibold text-dark-500 uppercase tracking-wider">List Config</th>
                      <th className="px-4 py-3 text-center text-2xs font-semibold text-dark-500 uppercase tracking-wider">Flags</th>
                      <th className="px-4 py-3 text-center text-2xs font-semibold text-dark-500 uppercase tracking-wider">Children</th>
                      <th className="px-4 py-3 text-center text-2xs font-semibold text-dark-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-center text-2xs font-semibold text-dark-500 uppercase tracking-wider w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-dark-100">
                  {filteredEntities.map((entity) => {
                    const isEditing = editingEntityCode === entity.code;
                    const EntityIcon = getIconComponent(entity.ui_icon);

                    // Model type badge colors
                    const modelTypeBadge: Record<string, { bg: string; text: string; label: string }> = {
                      'd': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Dim' },
                      'dh': { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Dim-H' },
                      'f': { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Fact' },
                      'fh': { bg: 'bg-violet-100', text: 'text-violet-700', label: 'Fact-H' },
                      'fd': { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700', label: 'Fact-D' },
                    };
                    const modelInfo = modelTypeBadge[entity.db_model_type || ''] || { bg: 'bg-dark-100', text: 'text-dark-500', label: entity.db_model_type || '—' };

                    return (
                      <tr
                        key={entity.code}
                        onClick={() => !isEditing && handleConfigureEntity(entity)}
                        className={isEditing ? 'bg-slate-50 ring-1 ring-inset ring-slate-200' : 'hover:bg-dark-50/50 cursor-pointer transition-colors group'}
                        title={!isEditing ? `Click to configure ${entity.name}` : ''}
                      >
                        {/* Icon Column - Editable */}
                        <td className="px-4 py-2.5">
                          {isEditing ? (
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowEntityIconPicker(!showEntityIconPicker);
                                }}
                                className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-dark-200 hover:bg-dark-50 hover:border-slate-400 transition-colors ring-2 ring-slate-200"
                                type="button"
                                title="Change icon"
                              >
                                {editingEntityData.ui_icon ? (
                                  (() => {
                                    const EditIcon = getIconComponent(editingEntityData.ui_icon);
                                    return <EditIcon className="h-4 w-4 text-dark-600" />;
                                  })()
                                ) : (
                                  <EntityIcon className="h-4 w-4 text-dark-600" />
                                )}
                              </button>
                              {/* Icon Picker Dropdown */}
                              {showEntityIconPicker && (
                                <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-dark-200 p-3 w-80">
                                  <div className="mb-2">
                                    <div className="relative">
                                      <LucideIcons.Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-dark-400" />
                                      <input
                                        type="text"
                                        value={iconSearchQuery}
                                        onChange={(e) => setIconSearchQuery(e.target.value)}
                                        placeholder="Search icons..."
                                        className="w-full pl-8 pr-3 py-1.5 text-sm border border-dark-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400"
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto">
                                    {AVAILABLE_ICON_NAMES
                                      .filter(iconName =>
                                        iconSearchQuery === '' ||
                                        iconName.toLowerCase().includes(iconSearchQuery.toLowerCase())
                                      )
                                      .map((iconName) => {
                                        const IconComponent = getIconComponent(iconName);
                                        const isSelected = (editingEntityData.ui_icon || entity.ui_icon) === iconName;
                                        return (
                                          <button
                                            key={iconName}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingEntityData({ ...editingEntityData, ui_icon: iconName });
                                              setShowEntityIconPicker(false);
                                              setIconSearchQuery('');
                                            }}
                                            className={`p-2 rounded-md hover:bg-dark-100 transition-colors ${isSelected ? 'bg-slate-100 ring-2 ring-slate-500' : ''}`}
                                            title={iconName}
                                            type="button"
                                          >
                                            <IconComponent className="h-4 w-4 text-dark-600" />
                                          </button>
                                        );
                                      })}
                                  </div>
                                  <div className="mt-2 flex justify-end border-t border-dark-200 pt-2">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setShowEntityIconPicker(false); setIconSearchQuery(''); }}
                                      className="px-2 py-1 text-xs text-dark-600 hover:bg-dark-100 rounded transition-colors"
                                      type="button"
                                    >
                                      Close
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-dark-50 group-hover:bg-dark-100 transition-colors">
                              <EntityIcon className="h-4 w-4 text-dark-500" />
                            </div>
                          )}
                        </td>

                        {/* Entity Info (Code + Name + UI Label) - Editable */}
                        <td className="px-4 py-2.5">
                          {isEditing ? (
                            <div className="min-w-[200px] space-y-1.5" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editingEntityData.ui_label ?? entity.ui_label}
                                  onChange={(e) => setEditingEntityData({ ...editingEntityData, ui_label: e.target.value })}
                                  placeholder="UI Label"
                                  className="flex-1 px-2 py-1 text-sm font-medium border border-dark-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400"
                                />
                                <span className="text-2xs font-mono px-1.5 py-0.5 bg-dark-100 text-dark-500 rounded">{entity.code}</span>
                              </div>
                              <input
                                type="text"
                                value={editingEntityData.name ?? entity.name}
                                onChange={(e) => setEditingEntityData({ ...editingEntityData, name: e.target.value })}
                                placeholder="Internal Name"
                                className="w-full px-2 py-1 text-xs border border-dark-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400"
                              />
                            </div>
                          ) : (
                            <div className="min-w-[180px]">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-dark-800">{entity.ui_label}</span>
                                <span className="text-2xs font-mono px-1.5 py-0.5 bg-dark-100 text-dark-500 rounded">{entity.code}</span>
                              </div>
                              <div className="text-xs text-dark-500 mt-0.5">{entity.name}</div>
                            </div>
                          )}
                        </td>

                        {/* DB Table */}
                        <td className="px-4 py-2.5">
                          {entity.db_table ? (
                            <span className="text-xs font-mono text-dark-600 bg-dark-50 px-2 py-1 rounded">
                              {entity.db_table}
                            </span>
                          ) : (
                            <span className="text-xs text-dark-400">—</span>
                          )}
                        </td>

                        {/* Model Type */}
                        <td className="px-4 py-2.5 text-center">
                          <span className={`inline-flex px-2 py-0.5 text-2xs font-medium rounded-full ${modelInfo.bg} ${modelInfo.text}`}>
                            {modelInfo.label}
                          </span>
                        </td>

                        {/* Domain */}
                        <td className="px-4 py-2.5">
                          {entity.dl_entity_domain || entity.domain_name ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-sky-50 text-sky-700 rounded-full">
                              <LucideIcons.Layers className="h-3 w-3" />
                              {entity.dl_entity_domain || entity.domain_name}
                            </span>
                          ) : (
                            <span className="text-xs text-dark-400">—</span>
                          )}
                        </td>

                        {/* List Config (config_datatable) */}
                        <td className="px-4 py-2.5 text-center">
                          {entity.config_datatable ? (
                            <div className="group/config relative inline-flex">
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-dark-50 hover:bg-dark-100 rounded-md transition-colors"
                                title="List view configuration"
                              >
                                <LucideIcons.TableProperties className="h-3 w-3 text-dark-500" />
                                <span className="text-dark-600">{entity.config_datatable.itemsPerPage || 25}/pg</span>
                              </button>
                              {/* Tooltip with full config */}
                              <div className="invisible group-hover/config:visible absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-20 bg-dark-800 text-white text-xs rounded-lg py-2 px-3 shadow-lg whitespace-nowrap">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-dark-400">Sort:</span>
                                    <span className="font-mono">{entity.config_datatable.defaultSort || 'updated_ts'}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-dark-400">Order:</span>
                                    <span>{entity.config_datatable.defaultSortOrder || 'desc'}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-dark-400">Per Page:</span>
                                    <span>{entity.config_datatable.itemsPerPage || 25}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-dark-400">Default</span>
                          )}
                        </td>

                        {/* Flags (root_level_entity_flag) */}
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {entity.root_level_entity_flag && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-2xs font-medium bg-amber-100 text-amber-700 rounded"
                                title="Root Level Entity - Permission inheritance boundary"
                              >
                                <LucideIcons.Crown className="h-3 w-3" />
                                ROOT
                              </span>
                            )}
                            {!entity.root_level_entity_flag && (
                              <span className="text-xs text-dark-400">—</span>
                            )}
                          </div>
                        </td>

                        {/* Children */}
                        <td className="px-4 py-2.5 text-center">
                          <div className="group/children relative inline-flex">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleManageChildren(entity);
                              }}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-dark-50 hover:bg-dark-100 rounded-md transition-colors"
                              title="Manage child entities"
                            >
                              <LucideIcons.GitBranch className="h-3 w-3 text-dark-500" />
                              <span className="text-dark-600 font-medium">{(entity.child_entity_codes || []).length}</span>
                            </button>
                            {/* Tooltip showing child entities */}
                            {(entity.child_entities || []).length > 0 && (
                              <div className="invisible group-hover/children:visible absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-20 bg-dark-800 text-white text-xs rounded-lg py-2 px-3 shadow-lg whitespace-nowrap">
                                <div className="space-y-1.5">
                                  {(entity.child_entities || []).slice(0, 5).map((child) => {
                                    const ChildIcon = getIconComponent(child.ui_icon || 'Tag');
                                    return (
                                      <div key={child.entity} className="flex items-center gap-2">
                                        <ChildIcon className="h-3 w-3" />
                                        <span>{child.ui_label}</span>
                                        {child.ownership_flag && (
                                          <span className="text-2xs px-1 py-0.5 bg-emerald-500/20 text-emerald-300 rounded">owned</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                  {(entity.child_entities || []).length > 5 && (
                                    <div className="text-dark-400 text-xs mt-1">
                                      +{(entity.child_entities || []).length - 5} more...
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Status Toggle */}
                        <td className="px-4 py-2.5 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleEntityActive(entity.code, entity.active_flag);
                            }}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:ring-offset-1 ${
                              entity.active_flag ? 'bg-emerald-500' : 'bg-dark-300'
                            }`}
                            title={entity.active_flag ? 'Active - Click to disable' : 'Inactive - Click to enable'}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                                entity.active_flag ? 'translate-x-4' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-2.5">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleUpdateEntity(entity.code)}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors shadow-sm"
                                title="Save changes"
                              >
                                <LucideIcons.Check className="h-3.5 w-3.5" />
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingEntityCode(null);
                                  setEditingEntityData({});
                                  setShowEntityIconPicker(false);
                                  setIconSearchQuery('');
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-dark-100 text-dark-600 rounded-md hover:bg-dark-200 transition-colors"
                                title="Cancel"
                              >
                                <LucideIcons.X className="h-3.5 w-3.5" />
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleConfigureEntity(entity);
                                }}
                                className="p-1.5 text-dark-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                                title="Configure"
                              >
                                <LucideIcons.Settings2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingEntityCode(entity.code);
                                  setEditingEntityData({ ...entity });
                                }}
                                className="p-1.5 text-dark-400 hover:text-dark-600 hover:bg-dark-100 rounded-md transition-colors"
                                title="Quick Edit"
                              >
                                <LucideIcons.Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteEntity(entity.code, entity.name);
                                }}
                                className="p-1.5 text-dark-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                title="Delete"
                              >
                                <LucideIcons.Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Add new entity row - matches 10-column structure */}
                  {isAddingEntity && (
                    <tr className="bg-slate-50 ring-1 ring-inset ring-slate-200">
                      {/* Icon Column */}
                      <td className="px-4 py-2.5">
                        <div className="relative">
                          <button
                            onClick={() => setShowNewEntityIconPicker(!showNewEntityIconPicker)}
                            className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-dark-200 hover:bg-dark-50 hover:border-dark-300 transition-colors"
                            type="button"
                            title="Select icon"
                          >
                            {newEntityData.ui_icon ? (
                              (() => {
                                const NewIcon = getIconComponent(newEntityData.ui_icon);
                                return <NewIcon className="h-4 w-4 text-dark-600" />;
                              })()
                            ) : (
                              <LucideIcons.ImagePlus className="h-4 w-4 text-dark-400" />
                            )}
                          </button>
                          {/* Icon Picker Dropdown */}
                          {showNewEntityIconPicker && (
                            <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-dark-200 p-3 w-80">
                              <div className="mb-2">
                                <div className="relative">
                                  <LucideIcons.Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-dark-400" />
                                  <input
                                    type="text"
                                    value={newIconSearchQuery}
                                    onChange={(e) => setNewIconSearchQuery(e.target.value)}
                                    placeholder="Search icons..."
                                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-dark-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400"
                                    autoFocus
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto">
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
                                        className={`p-2 rounded-md hover:bg-dark-100 transition-colors ${isSelected ? 'bg-slate-100 ring-2 ring-slate-500' : ''}`}
                                        title={iconName}
                                        type="button"
                                      >
                                        <IconComponent className="h-4 w-4 text-dark-600" />
                                      </button>
                                    );
                                  })}
                              </div>
                              <div className="mt-2 flex justify-end border-t border-dark-200 pt-2">
                                <button
                                  onClick={() => { setShowNewEntityIconPicker(false); setNewIconSearchQuery(''); }}
                                  className="px-2 py-1 text-xs text-dark-600 hover:bg-dark-100 rounded transition-colors"
                                  type="button"
                                >
                                  Close
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Entity Info */}
                      <td className="px-4 py-2.5">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={newEntityData.ui_label}
                              onChange={(e) => setNewEntityData({ ...newEntityData, ui_label: e.target.value })}
                              placeholder="UI Label"
                              className="flex-1 px-2 py-1 text-sm border border-dark-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400"
                            />
                            <input
                              type="text"
                              value={newEntityData.code}
                              onChange={(e) => setNewEntityData({ ...newEntityData, code: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                              placeholder="code"
                              className="w-24 px-2 py-1 text-2xs font-mono border border-dark-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400 bg-dark-50"
                            />
                          </div>
                          <input
                            type="text"
                            value={newEntityData.name}
                            onChange={(e) => setNewEntityData({ ...newEntityData, name: e.target.value })}
                            placeholder="Display Name"
                            className="w-full px-2 py-1 text-xs border border-dark-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400"
                          />
                        </div>
                      </td>

                      {/* DB Table - Auto generated */}
                      <td className="px-4 py-2.5">
                        <span className="text-xs text-dark-400 italic">Auto</span>
                      </td>

                      {/* Model Type */}
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex px-2 py-0.5 text-2xs font-medium rounded-full bg-blue-100 text-blue-700">Dim</span>
                      </td>

                      {/* Domain - will be set later */}
                      <td className="px-4 py-2.5">
                        <span className="text-xs text-dark-400">—</span>
                      </td>

                      {/* List Config */}
                      <td className="px-4 py-2.5 text-center">
                        <span className="text-xs text-dark-400">Default</span>
                      </td>

                      {/* Flags */}
                      <td className="px-4 py-2.5 text-center">
                        <span className="text-xs text-dark-400">—</span>
                      </td>

                      {/* Children */}
                      <td className="px-4 py-2.5 text-center">
                        <span className="text-xs text-dark-400">0</span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex h-5 w-9 items-center rounded-full bg-emerald-500">
                          <span className="inline-block h-4 w-4 translate-x-4 transform rounded-full bg-white shadow-sm" />
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={handleAddEntity}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                            title="Save"
                          >
                            <LucideIcons.Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              setIsAddingEntity(false);
                              setNewEntityData({ code: '', name: '', ui_label: '', ui_icon: '' });
                            }}
                            className="p-1.5 text-dark-500 hover:text-dark-700 hover:bg-dark-100 rounded-md transition-colors"
                            title="Cancel"
                          >
                            <LucideIcons.X className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>

              {/* Add Entity Button */}
              {!isAddingEntity && (
                <div className="border-t border-dark-200 bg-dark-50">
                  <button
                    onClick={() => setIsAddingEntity(true)}
                    className="w-full px-4 py-3 text-left text-sm font-medium text-dark-600 hover:bg-dark-100 hover:text-dark-800 transition-colors flex items-center gap-2"
                  >
                    <LucideIcons.Plus className="h-4 w-4" />
                    <span>Add Entity</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        )}

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 border border-dark-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-dark-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <LucideIcons.GitBranch className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-dark-800">
                    Manage Child Entities
                  </h2>
                  <p className="text-sm text-dark-500 mt-0.5">
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
                className="p-2 rounded-md text-dark-400 hover:text-dark-600 hover:bg-dark-100 focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Current Children */}
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-dark-700 mb-2">Current Child Entities</h3>
                {(selectedEntityForChildren.child_entities || []).length === 0 ? (
                  <p className="text-sm text-dark-500 italic">No child entities configured</p>
                ) : (
                  <div className="space-y-1.5">
                    {(selectedEntityForChildren.child_entities || []).map((childEntity) => {
                      const childMetadata = getEntityMetadata(childEntity.entity);
                      if (!childMetadata) return null; // Skip if entity not found

                      const isOwned = childEntity.ownership_flag !== false;

                      return (
                        <div
                          key={childEntity.entity}
                          className="flex items-center justify-between px-3 py-2 bg-dark-50 rounded-md border border-dark-200"
                        >
                          <div className="flex items-center gap-2">
                            {(() => {
                              const ChildIcon = getIconComponent(childMetadata.ui_icon || 'Tag');
                              return <ChildIcon className="h-4 w-4 text-dark-600" />;
                            })()}
                            <span className="text-sm font-medium text-dark-700">{childMetadata.ui_label}</span>
                            <span className="text-sm text-dark-500">({childEntity.entity})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Ownership Toggle */}
                            <button
                              onClick={() => handleToggleOwnership(selectedEntityForChildren.code, childEntity.entity)}
                              className={`px-2 py-1 text-2xs font-medium rounded-md border transition-colors ${
                                isOwned
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                              }`}
                              title={isOwned ? 'Owned: Full cascade delete. Click to change to Lookup.' : 'Lookup: Reference only. Click to change to Owned.'}
                            >
                              {isOwned ? (
                                <span className="flex items-center gap-1">
                                  <LucideIcons.Link className="h-3 w-3" />
                                  Owned
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <LucideIcons.ExternalLink className="h-3 w-3" />
                                  Lookup
                                </span>
                              )}
                            </button>
                            {/* Remove Button */}
                            <button
                              onClick={() => handleRemoveChild(selectedEntityForChildren.code, childEntity.entity)}
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md focus-visible:ring-2 focus-visible:ring-red-500/30 focus-visible:outline-none transition-colors"
                              title="Remove"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add Child Search */}
              <div>
                <h3 className="text-sm font-semibold text-dark-700 mb-2">Add Child Entity</h3>
                <div className="relative mb-2">
                  <LucideIcons.Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-400" />
                  <input
                    type="text"
                    value={childSearchQuery}
                    onChange={(e) => setChildSearchQuery(e.target.value)}
                    placeholder="Search entities..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-dark-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1.5">
                  {entities
                    .filter(e =>
                      e.code !== selectedEntityForChildren.code && // Not self
                      !(selectedEntityForChildren.child_entity_codes || []).includes(e.code) && // Not already added
                      (childSearchQuery === '' ||
                        e.code.toLowerCase().includes(childSearchQuery.toLowerCase()) ||
                        e.ui_label.toLowerCase().includes(childSearchQuery.toLowerCase()))
                    )
                    .map((entity) => {
                      return (
                        <button
                          key={entity.code}
                          onClick={() => handleAddChild(selectedEntityForChildren.code, entity.code)}
                          className="w-full flex items-center justify-between px-3 py-2 bg-white hover:bg-dark-50 rounded-md border border-dark-200 hover:border-dark-300 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2">
                            {(() => {
                              const EntityIcon = getIconComponent(entity.ui_icon);
                              return <EntityIcon className="h-4 w-4 text-dark-600" />;
                            })()}
                            <span className="text-sm font-medium text-dark-700">{entity.ui_label}</span>
                            <span className="text-sm text-dark-500">({entity.code})</span>
                          </div>
                          <LucideIcons.Plus className="h-4 w-4 text-emerald-500" />
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-dark-200 bg-dark-50">
              <button
                onClick={() => {
                  setChildEntitiesModalOpen(false);
                  setSelectedEntityForChildren(null);
                  setChildSearchQuery('');
                }}
                className="px-4 py-2 text-sm font-medium bg-slate-600 text-white rounded-md hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-slate-500/50 focus-visible:outline-none shadow-sm transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entity Configuration Modal */}
      {selectedEntityForConfig && (
        <EntityConfigurationModal
          isOpen={showEntityConfigModal}
          onClose={handleCloseEntityConfigModal}
          entityCode={selectedEntityForConfig.code}
          entityName={selectedEntityForConfig.name}
          onSave={handleSaveEntityConfig}
        />
      )}
    </Layout>
  );
}
