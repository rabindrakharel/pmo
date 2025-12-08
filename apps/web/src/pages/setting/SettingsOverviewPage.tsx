import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/shared';
import { useSettings } from '../../contexts/SettingsContext';
import { AddDatalabelModal } from '../../components/shared/modals/AddDatalabelModal';
import { EntityConfigurationModal } from '../../components/settings/EntityConfigurationModal';
import { PermissionManagementModal } from '../../components/settings/PermissionManagementModal';
import { API_CONFIG } from '../../lib/config/api';
import * as LucideIcons from 'lucide-react';
import { getIconComponent } from '../../lib/iconMapping';
import { InlineSpinner } from '../../components/shared/ui/EllipsisBounce';

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
  child_entity_codes?: string[]; // Simple array of entity codes
  child_entities?: Array<{
    entity: string;
    ui_icon: string;
    ui_label: string;
    order: number;
  }>; // Enriched child metadata (from API)
}

type MainTab = 'entities' | 'entityMapping' | 'secretsVault' | 'integrations' | 'accessControl';

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

  // Permission management modal
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  // RBAC overview data (using /api/v1/entity_rbac/overview endpoint)
  const [rbacOverview, setRbacOverview] = useState<any>(null);
  const [rbacLoading, setRbacLoading] = useState(true);

  // Fetch RBAC overview data
  const fetchRbacOverview = useCallback(async () => {
    try {
      setRbacLoading(true);
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1/entity_rbac/overview`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRbacOverview(data);
      }
    } catch (error) {
      console.error('Error fetching RBAC overview:', error);
    } finally {
      setRbacLoading(false);
    }
  }, []);

  // Fetch RBAC overview when Access Control tab is active
  useEffect(() => {
    if (activeMainTab === 'accessControl') {
      fetchRbacOverview();
    }
  }, [activeMainTab, fetchRbacOverview]);

  // Role statistics
  const [roleStats, setRoleStats] = useState({ total: 0, active: 0, loading: true });

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

  // Handle updating child entities
  const handleUpdateChildEntities = async (code: string, childEntityCodes: string[], mode: 'append' | 'replace' = 'append') => {
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

    const updatedChildren = (parent.child_entity_codes || []).filter(c => c !== childEntity);
    // Use 'replace' mode to set the exact list (with item removed)
    await handleUpdateChildEntities(parentCode, updatedChildren, 'replace');

    // Update selected entity for modal
    if (selectedEntityForChildren && selectedEntityForChildren.code === parentCode) {
      setSelectedEntityForChildren({ ...parent, child_entity_codes: updatedChildren });
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

            <button
              onClick={() => setActiveMainTab('accessControl')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none ${
                activeMainTab === 'accessControl'
                  ? 'bg-slate-600 text-white shadow-sm'
                  : 'bg-dark-50 text-dark-700 border border-dark-200 hover:bg-dark-100 hover:border-dark-300'
              }`}
            >
              <LucideIcons.Shield className="h-4 w-4" />
              Access Control
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

        {/* Access Control Tab */}
        {activeMainTab === 'accessControl' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-white border border-dark-200 rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-dark-800 flex items-center gap-2">
                  <LucideIcons.Shield className="h-5 w-5 text-slate-600" />
                  Access Control - RBAC Management
                </h2>
                <button
                  onClick={() => navigate('/settings/access-control')}
                  className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none transition-colors text-sm font-medium shadow-sm flex items-center gap-2"
                >
                  <LucideIcons.ExternalLink className="h-4 w-4" />
                  Open Full Access Control Page
                </button>
              </div>
              <p className="text-sm text-dark-600">
                Manage roles, assign employees to roles, and grant entity-level permissions using the Person-Based RBAC system.
                All changes affect the <strong>role</strong>, <strong>entity_instance</strong>, and <strong>entity_rbac</strong> tables.
              </p>
            </div>

            {/* Three Sub-Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 1. Roles Management */}
              <div className="bg-white border border-dark-200 rounded-lg shadow-sm p-6">
                <h3 className="text-base font-semibold text-dark-800 mb-3 flex items-center gap-2">
                  <LucideIcons.Users className="h-4 w-4 text-slate-600" />
                  Roles Management
                </h3>
                <p className="text-sm text-dark-600 mb-4">
                  Create, edit, and delete roles. Click on a role to view employees assigned to it.
                </p>
                <button
                  onClick={() => navigate('/role')}
                  className="w-full px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none transition-colors text-sm font-medium shadow-sm"
                >
                  Manage Roles →
                </button>
                <div className="mt-4 text-xs text-dark-500">
                  <p className="font-medium text-dark-700 mb-1">Quick Stats:</p>
                  <ul className="list-disc list-inside space-y-1 text-dark-600">
                    <li>Total Roles: {roleStats.loading ? <InlineSpinner /> : roleStats.total}</li>
                    <li>Active Roles: {roleStats.loading ? <InlineSpinner /> : roleStats.active}</li>
                  </ul>
                </div>
              </div>

              {/* 2. Employee Role Assignment */}
              <div className="bg-white border border-dark-200 rounded-lg shadow-sm p-6">
                <h3 className="text-base font-semibold text-dark-800 mb-3 flex items-center gap-2">
                  <LucideIcons.Users className="h-4 w-4 text-slate-600" />
                  Employee ↔ Role Assignment
                </h3>
                <p className="text-sm text-dark-600 mb-4">
                  Assign employees to roles. Uses <strong>d_entity_id_map</strong> with parent_entity_type='role' and child_entity_type='employee'.
                </p>
                <button
                  onClick={() => navigate('/role')}
                  className="w-full px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:outline-none transition-colors text-sm font-medium shadow-sm"
                >
                  Assign Employees →
                </button>
                <div className="mt-4 text-xs text-dark-500">
                  <p className="font-medium text-dark-700 mb-1">How it works:</p>
                  <ul className="list-disc list-inside space-y-1 text-dark-600">
                    <li>Navigate to a role</li>
                    <li>View "Employees" tab</li>
                    <li>Click "Assign Employee"</li>
                  </ul>
                </div>
              </div>

              {/* 3. Permission Management */}
              <div className="bg-white border border-dark-200 rounded-lg shadow-sm p-6">
                <h3 className="text-base font-semibold text-dark-800 mb-3 flex items-center gap-2">
                  <LucideIcons.Shield className="h-4 w-4 text-slate-600" />
                  Permission Management
                </h3>
                <p className="text-sm text-dark-600 mb-4">
                  Grant entity permissions to roles and employees. Uses <strong>entity_id_rbac_map</strong> with permission levels 0-5.
                </p>
                <button
                  onClick={() => setShowPermissionModal(true)}
                  className="w-full px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none transition-colors text-sm font-medium shadow-sm"
                >
                  Grant Permissions →
                </button>
                <div className="mt-4 text-xs text-dark-500">
                  <p className="font-medium text-dark-700 mb-1">Permission Levels:</p>
                  <ul className="list-disc list-inside space-y-1 text-dark-600">
                    <li>0: View | 1: Edit | 2: Share</li>
                    <li>3: Delete | 4: Create | 5: Owner</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* RBAC Overview Summary */}
            <div className="bg-white border border-dark-200 rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-dark-800 flex items-center gap-2">
                  <LucideIcons.Shield className="h-4 w-4 text-slate-600" />
                  Permissions Overview
                </h3>
                <button
                  onClick={() => setShowPermissionModal(true)}
                  className="px-3 py-1.5 bg-slate-600 text-white text-sm rounded-md hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none transition-colors font-medium flex items-center gap-2 shadow-sm"
                >
                  <LucideIcons.Plus className="h-3.5 w-3.5" />
                  Grant Permission
                </button>
              </div>

              {rbacLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-dark-700" />
                </div>
              ) : rbacOverview ? (
                <div className="space-y-6">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-center">
                      <div className="text-2xl font-bold text-blue-700">{rbacOverview.summary?.total_permissions || 0}</div>
                      <div className="text-xs text-blue-600">Total Permissions</div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-md p-3 text-center">
                      <div className="text-2xl font-bold text-green-700">{rbacOverview.summary?.role_based_permissions || 0}</div>
                      <div className="text-xs text-green-600">Role-Based</div>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-md p-3 text-center">
                      <div className="text-2xl font-bold text-purple-700">{rbacOverview.summary?.employee_permissions || 0}</div>
                      <div className="text-xs text-purple-600">Employee Direct</div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-center">
                      <div className="text-2xl font-bold text-amber-700">{rbacOverview.summary?.unique_persons || 0}</div>
                      <div className="text-xs text-amber-600">Unique Persons</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-center">
                      <div className="text-2xl font-bold text-slate-700">{rbacOverview.summary?.unique_entities || 0}</div>
                      <div className="text-xs text-slate-600">Entity Types</div>
                    </div>
                  </div>

                  {/* Permissions by Person */}
                  <div>
                    <h4 className="text-sm font-semibold text-dark-800 mb-3 flex items-center gap-2">
                      <LucideIcons.Users className="h-4 w-4" />
                      Permissions by Person
                    </h4>
                    <div className="max-h-64 overflow-y-auto border border-dark-200 rounded-md">
                      <table className="w-full text-sm">
                        <thead className="bg-dark-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-dark-600">Person</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-dark-600">Type</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-dark-600">Permissions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-200">
                          {(rbacOverview.permissions_by_person || []).map((person: any, idx: number) => (
                            <tr key={idx} className="hover:bg-dark-50">
                              <td className="px-3 py-2 text-dark-700">{person.person_name}</td>
                              <td className="px-3 py-2">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                  person.person_type === 'role' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                }`}>
                                  {person.person_type}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-dark-600 text-xs">
                                {person.permissions?.length || 0} permission(s)
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Permissions by Entity */}
                  <div>
                    <h4 className="text-sm font-semibold text-dark-800 mb-3 flex items-center gap-2">
                      <LucideIcons.Database className="h-4 w-4" />
                      Permissions by Entity Type
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {(rbacOverview.permissions_by_entity || []).map((entity: any, idx: number) => (
                        <div
                          key={idx}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-dark-100 border border-dark-200 rounded-md"
                        >
                          <span className="text-sm font-medium text-dark-700">{entity.entity_code}</span>
                          <span className="text-xs text-dark-500">({entity.permissions?.length || 0})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-dark-500">
                  <LucideIcons.AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>Failed to load RBAC overview</p>
                </div>
              )}
            </div>

            {/* RBAC Architecture Overview */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-md p-6">
              <h3 className="text-base font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <LucideIcons.Database className="h-4 w-4" />
                RBAC Architecture Overview
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
                <div>
                  <p className="font-medium mb-2">Permission Resolution:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-700">
                    <li>Employees inherit permissions from assigned roles</li>
                    <li>Direct employee permissions override role permissions</li>
                    <li>System takes MAX(role_permission, employee_permission)</li>
                    <li>Higher permission levels inherit all lower permissions</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium mb-2">Database Tables:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-700">
                    <li><code>role</code> - Role definitions</li>
                    <li><code>employee</code> - Employee records</li>
                    <li><code>entity_instance</code> - Entity instance registry</li>
                    <li><code>entity_rbac</code> - Permissions (0-7)</li>
                  </ul>
                </div>
              </div>
              <div className="mt-4 p-3 bg-white/50 rounded border border-blue-200">
                <p className="text-xs text-blue-900 font-medium mb-2">Example Permission Grant (SQL):</p>
                <pre className="text-xs text-blue-800 font-mono whitespace-pre-wrap">
{`INSERT INTO entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
VALUES ('role', '{role_uuid}', 'project', 'all', 4);  -- Grant Create permission to all projects

INSERT INTO d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
VALUES ('role', '{role_uuid}', 'employee', '{employee_uuid}');  -- Assign employee to role`}
                </pre>
              </div>
            </div>

            {/* Documentation Reference */}
            <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
              <p className="text-sm text-amber-900 font-medium mb-2">
                📖 Documentation Reference
              </p>
              <p className="text-xs text-amber-700">
                For complete RBAC documentation, see{' '}
                <code className="bg-amber-100 px-1 py-0.5 rounded">/docs/entity_design_pattern/rbac.md</code>
              </p>
            </div>
          </div>
        )}

        {/* Entities Tab */}
        {activeMainTab === 'entities' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-dark-800 tracking-tight">Entities ({entities.length})</h2>
            <div className="relative w-64">
              <LucideIcons.Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-dark-400" />
              <input
                type="text"
                placeholder="Search entities..."
                value={entitiesSearchQuery}
                onChange={(e) => setEntitiesSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-dark-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400 transition-all placeholder:text-dark-400"
              />
            </div>
          </div>

          {entitiesLoading ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-lg border border-dark-200 shadow-sm">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-dark-200 border-t-slate-600"></div>
              <p className="text-sm font-medium text-dark-600 mt-4">Loading entities...</p>
            </div>
          ) : filteredEntities.length === 0 && !isAddingEntity ? (
            <div className="flex flex-col items-center justify-center py-12 bg-white rounded-lg border border-dark-200 shadow-sm">
              <LucideIcons.Tag className="h-10 w-10 text-dark-400 mb-3" />
              <p className="text-sm font-medium text-dark-700">No entities found</p>
              <p className="text-xs text-dark-500 mt-1">Try adjusting your search</p>
            </div>
          ) : (
            <div className="bg-white border border-dark-200 rounded-lg overflow-hidden shadow-sm">
              <table className="min-w-full divide-y divide-dark-200">
                <thead className="bg-dark-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider">UI Label</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider">Domain</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider">Icon</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-dark-600 uppercase tracking-wider">Order</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-dark-600 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider">Children</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-dark-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-dark-100">
                  {filteredEntities.map((entity) => {
                    const isEditing = editingEntityCode === entity.code;
                    return (
                      <tr
                        key={entity.code}
                        onClick={() => !isEditing && handleConfigureEntity(entity)}
                        className={isEditing ? 'bg-slate-50 ring-1 ring-inset ring-slate-200' : 'hover:bg-dark-50 cursor-pointer transition-colors'}
                        title={!isEditing ? `Click to configure ${entity.name}` : ''}
                      >
                        <td className="px-4 py-3">
                          <span className="text-sm text-dark-700">{entity.code}</span>
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingEntityData.name ?? entity.name}
                              onChange={(e) => setEditingEntityData({ ...editingEntityData, name: e.target.value })}
                              className="w-full px-2 py-1.5 text-sm border border-dark-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400"
                            />
                          ) : (
                            <span className="text-sm text-dark-700">{entity.name}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingEntityData.ui_label ?? entity.ui_label}
                              onChange={(e) => setEditingEntityData({ ...editingEntityData, ui_label: e.target.value })}
                              className="w-full px-2 py-1.5 text-sm border border-dark-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400"
                            />
                          ) : (
                            <span className="text-sm text-dark-700">{entity.ui_label}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <select
                              value={editingEntityData.dl_entity_domain ?? entity.dl_entity_domain ?? ''}
                              onChange={(e) => setEditingEntityData({ ...editingEntityData, dl_entity_domain: e.target.value || undefined })}
                              className="w-full px-2 py-1.5 text-sm border border-dark-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400"
                            >
                              <option value="">-- None --</option>
                              <option value="Core Management">Core Management</option>
                              <option value="Organization">Organization</option>
                              <option value="Business">Business</option>
                              <option value="Operations">Operations</option>
                              <option value="Customers">Customers</option>
                              <option value="Retail">Retail</option>
                              <option value="Sales & Finance">Sales & Finance</option>
                              <option value="Content & Docs">Content & Docs</option>
                              <option value="Advanced">Advanced</option>
                            </select>
                          ) : (
                            entity.dl_entity_domain ? (
                              <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                {entity.dl_entity_domain}
                              </span>
                            ) : (
                              <span className="text-sm text-dark-400">—</span>
                            )
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="relative">
                              <button
                                onClick={() => setShowEntityIconPicker(!showEntityIconPicker)}
                                className="flex items-center gap-2 px-2.5 py-1.5 text-sm border border-dark-200 rounded-md bg-white hover:bg-dark-50 hover:border-dark-300 focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none transition-colors"
                                type="button"
                              >
                                {(() => {
                                  const EditIcon = getIconComponent(editingEntityData.ui_icon ?? entity.ui_icon);
                                  return <EditIcon className="h-4 w-4 text-dark-600" />;
                                })()}
                                <span className="text-sm text-dark-700">{(editingEntityData.ui_icon ?? entity.ui_icon) || 'Select'}</span>
                                <LucideIcons.ChevronDown className="h-3.5 w-3.5 text-dark-400" />
                              </button>

                              {/* Icon Picker Dropdown */}
                              {showEntityIconPicker && (
                                <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-dark-200 p-3 w-96">
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
                                            className={`p-2 rounded-md hover:bg-dark-100 transition-colors ${isSelected ? 'bg-slate-100 ring-2 ring-slate-500' : ''}`}
                                            title={iconName}
                                            type="button"
                                          >
                                            <IconComponent className="h-4 w-4 text-dark-600" />
                                          </button>
                                        );
                                      })}
                                  </div>
                                  <div className="mt-2 flex items-center justify-between border-t border-dark-200 pt-2">
                                    <span className="text-xs text-dark-500">
                                      {AVAILABLE_ICON_NAMES.filter(name =>
                                        iconSearchQuery === '' || name.toLowerCase().includes(iconSearchQuery.toLowerCase())
                                      ).length} icons
                                    </span>
                                    <button
                                      onClick={() => {
                                        setShowEntityIconPicker(false);
                                        setIconSearchQuery('');
                                      }}
                                      className="px-2.5 py-1 text-sm text-dark-600 hover:bg-dark-100 rounded-md transition-colors"
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
                                className: "h-4 w-4 text-dark-600"
                              })}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editingEntityData.display_order ?? entity.display_order}
                              onChange={(e) => setEditingEntityData({ ...editingEntityData, display_order: parseInt(e.target.value) })}
                              className="w-16 px-2 py-1.5 text-sm border border-dark-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400 text-center"
                            />
                          ) : (
                            <span className="text-sm text-dark-700">{entity.display_order}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleEntityActive(entity.code, entity.active_flag);
                            }}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:ring-offset-2 ${
                              entity.active_flag ? 'bg-emerald-500' : 'bg-dark-300'
                            }`}
                            title={entity.active_flag ? 'Enabled - Click to disable' : 'Disabled - Click to enable'}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                                entity.active_flag ? 'translate-x-5' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="group relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleManageChildren(entity);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-dark-600 hover:bg-dark-100 hover:text-dark-800 rounded-md border border-dark-200 transition-colors font-medium"
                              title="Manage child entities"
                            >
                              <LucideIcons.GitBranch className="h-3.5 w-3.5" />
                              <span>{(entity.child_entity_codes || []).length}</span>
                            </button>

                            {/* Tooltip showing enriched child entities with icons & labels */}
                            {(entity.child_entities || []).length > 0 && (
                              <div className="invisible group-hover:visible absolute left-0 top-8 z-10 bg-dark-800 text-white text-xs rounded-md py-2 px-3 shadow-lg whitespace-nowrap">
                                <div className="space-y-1.5">
                                  {(entity.child_entities || []).slice(0, 5).map((child) => {
                                    const ChildIcon = getIconComponent(child.ui_icon || 'Tag');
                                    return (
                                      <div key={child.entity} className="flex items-center gap-2">
                                        <ChildIcon className="h-3 w-3" />
                                        <span>{child.ui_label}</span>
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
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateEntity(entity.code);
                                  }}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:outline-none transition-colors"
                                  title="Save"
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingEntityCode(null);
                                    setEditingEntityData({});
                                  }}
                                  className="p-1.5 text-dark-500 hover:text-dark-700 hover:bg-dark-100 rounded-md focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none transition-colors"
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingEntityCode(entity.code);
                                    setEditingEntityData(entity);
                                  }}
                                  className="p-1.5 text-dark-500 hover:text-dark-700 hover:bg-dark-100 rounded-md focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none transition-colors"
                                  title="Edit"
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteEntity(entity.code, entity.name);
                                  }}
                                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md focus-visible:ring-2 focus-visible:ring-red-500/30 focus-visible:outline-none transition-colors"
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
                    <tr className="bg-slate-50">
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={newEntityData.code}
                          onChange={(e) => setNewEntityData({ ...newEntityData, code: e.target.value.toLowerCase() })}
                          placeholder="code"
                          className="w-full px-2 py-1.5 text-sm border border-dark-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={newEntityData.name}
                          onChange={(e) => setNewEntityData({ ...newEntityData, name: e.target.value })}
                          placeholder="Name"
                          className="w-full px-2 py-1.5 text-sm border border-dark-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={newEntityData.ui_label}
                          onChange={(e) => setNewEntityData({ ...newEntityData, ui_label: e.target.value })}
                          placeholder="UI Label"
                          className="w-full px-2 py-1.5 text-sm border border-dark-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <button
                            onClick={() => setShowNewEntityIconPicker(!showNewEntityIconPicker)}
                            className="flex items-center gap-2 px-2.5 py-1.5 text-sm border border-dark-200 rounded-md bg-white hover:bg-dark-50 hover:border-dark-300 focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none transition-colors"
                            type="button"
                          >
                            {newEntityData.ui_icon ? (
                              (() => {
                                const NewIcon = getIconComponent(newEntityData.ui_icon);
                                return <NewIcon className="h-4 w-4 text-dark-600" />;
                              })()
                            ) : (
                              <LucideIcons.Tag className="h-4 w-4 text-dark-400" />
                            )}
                            <span className="text-sm text-dark-700">{newEntityData.ui_icon || 'Select'}</span>
                            <LucideIcons.ChevronDown className="h-3.5 w-3.5 text-dark-400" />
                          </button>

                          {/* Icon Picker Dropdown */}
                          {showNewEntityIconPicker && (
                            <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-dark-200 p-3 w-96">
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
                                        className={`p-2 rounded-md hover:bg-dark-100 transition-colors ${isSelected ? 'bg-slate-100 ring-2 ring-slate-500' : ''}`}
                                        title={iconName}
                                        type="button"
                                      >
                                        <IconComponent className="h-4 w-4 text-dark-600" />
                                      </button>
                                    );
                                  })}
                              </div>
                              <div className="mt-2 flex items-center justify-between border-t border-dark-200 pt-2">
                                <span className="text-xs text-dark-500">
                                  {AVAILABLE_ICON_NAMES.filter(name =>
                                    newIconSearchQuery === '' || name.toLowerCase().includes(newIconSearchQuery.toLowerCase())
                                  ).length} icons
                                </span>
                                <button
                                  onClick={() => {
                                    setShowNewEntityIconPicker(false);
                                    setNewIconSearchQuery('');
                                  }}
                                  className="px-2.5 py-1 text-sm text-dark-600 hover:bg-dark-100 rounded-md transition-colors"
                                  type="button"
                                >
                                  Close
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          value={newEntityData.display_order || ''}
                          onChange={(e) => setNewEntityData({ ...newEntityData, display_order: parseInt(e.target.value) || undefined })}
                          placeholder="Auto"
                          className="w-16 px-2 py-1.5 text-sm border border-dark-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400 text-center"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs text-emerald-600 font-medium">Enabled</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs text-dark-400">—</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={handleAddEntity}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:outline-none transition-colors"
                            title="Save"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              setIsAddingEntity(false);
                              setNewEntityData({ code: '', name: '', ui_label: '', ui_icon: '' });
                            }}
                            className="p-1.5 text-dark-500 hover:text-dark-700 hover:bg-dark-100 rounded-md focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none transition-colors"
                            title="Cancel"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                {(selectedEntityForChildren.child_entity_codes || []).length === 0 ? (
                  <p className="text-sm text-dark-500 italic">No child entities configured</p>
                ) : (
                  <div className="space-y-1.5">
                    {(selectedEntityForChildren.child_entity_codes || []).map((childCode) => {
                      const childMetadata = getEntityMetadata(childCode);
                      if (!childMetadata) return null; // Skip if entity not found

                      return (
                        <div
                          key={childCode}
                          className="flex items-center justify-between px-3 py-2 bg-dark-50 rounded-md border border-dark-200"
                        >
                          <div className="flex items-center gap-2">
                            {(() => {
                              const ChildIcon = getIconComponent(childMetadata.ui_icon || 'Tag');
                              return <ChildIcon className="h-4 w-4 text-dark-600" />;
                            })()}
                            <span className="text-sm font-medium text-dark-700">{childMetadata.ui_label}</span>
                            <span className="text-sm text-dark-500">({childCode})</span>
                          </div>
                          <button
                            onClick={() => handleRemoveChild(selectedEntityForChildren.code, childCode)}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md focus-visible:ring-2 focus-visible:ring-red-500/30 focus-visible:outline-none transition-colors"
                            title="Remove"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

      {/* Permission Management Modal */}
      <PermissionManagementModal
        isOpen={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        onSave={() => {
          setShowPermissionModal(false);
          // Optionally refresh data
        }}
      />
    </Layout>
  );
}
