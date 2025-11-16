import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, FilteredDataTable } from '../../components/shared';
import { useSettings } from '../../contexts/SettingsContext';
import { AddDatalabelModal } from '../../components/shared/modals/AddDatalabelModal';
import { EntityConfigurationModal } from '../../components/settings/EntityConfigurationModal';
import { PermissionManagementModal } from '../../components/settings/PermissionManagementModal';
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
  child_entities?: string[]; // Simple array of entity codes
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
      const response = await fetch('http://localhost:4000/api/v1/entity/types?include_inactive=true', {
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
  const handleUpdateChildEntities = async (code: string, childEntities: string[]) => {
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

    const updatedChildren = (parent.child_entities || []).filter(c => c !== childEntity);
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
    if ((parent.child_entities || []).includes(childCode)) {
      alert('This child entity is already added');
      return;
    }

    const updatedChildren = [...(parent.child_entities || []), childCode];
    await handleUpdateChildEntities(parentCode, updatedChildren);

    // Update selected entity for modal
    if (selectedEntityForChildren && selectedEntityForChildren.code === parentCode) {
      setSelectedEntityForChildren({ ...parent, child_entities: updatedChildren });
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
              className="p-2 rounded-md text-dark-700 hover:bg-dark-200 transition-all hover:scale-105"
              title="Exit Settings"
            >
              <LucideIcons.ArrowLeft className="h-5 w-5 stroke-[2]" />
            </button>
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-purple-200 shadow-sm">
                <LucideIcons.Settings className="h-6 w-6 text-purple-600 stroke-[1.5]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-dark-700 tracking-tight">Settings</h1>
                <p className="text-sm text-dark-600 mt-0.5">Manage your system configuration and data labels</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Tabs */}
        <div className="bg-dark-100 rounded-xl p-4 border border-dark-300 mb-8">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveMainTab('entities')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-all ${
                activeMainTab === 'entities'
                  ? 'bg-slate-600 text-white shadow-sm'
                  : 'bg-white text-dark-700 border border-dark-300 hover:border-dark-400'
              }`}
            >
              <LucideIcons.Database className="h-3.5 w-3.5" />
              Entities ({entities.length})
            </button>

            <button
              onClick={() => setActiveMainTab('entityMapping')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-all ${
                activeMainTab === 'entityMapping'
                  ? 'bg-slate-600 text-white shadow-sm'
                  : 'bg-white text-dark-700 border border-dark-300 hover:border-dark-400'
              }`}
            >
              <LucideIcons.Link className="h-3.5 w-3.5" />
              Entity Mapping
            </button>


            <button
              onClick={() => setActiveMainTab('secretsVault')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-all ${
                activeMainTab === 'secretsVault'
                  ? 'bg-slate-600 text-white shadow-sm'
                  : 'bg-white text-dark-700 border border-dark-300 hover:border-dark-400'
              }`}
            >
              <LucideIcons.Lock className="h-3.5 w-3.5" />
              Secrets Vault
            </button>

            <button
              onClick={() => setActiveMainTab('integrations')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-all ${
                activeMainTab === 'integrations'
                  ? 'bg-slate-600 text-white shadow-sm'
                  : 'bg-white text-dark-700 border border-dark-300 hover:border-dark-400'
              }`}
            >
              <LucideIcons.Plug className="h-3.5 w-3.5" />
              Integrations
            </button>

            <button
              onClick={() => setActiveMainTab('accessControl')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-all ${
                activeMainTab === 'accessControl'
                  ? 'bg-slate-600 text-white shadow-sm'
                  : 'bg-white text-dark-700 border border-dark-300 hover:border-dark-400'
              }`}
            >
              <LucideIcons.Shield className="h-4 w-4" />
              Access Control
            </button>
          </div>
        </div>

        {/* Entity Mapping Tab */}
        {activeMainTab === 'entityMapping' && (
          <div className="bg-white border border-dark-300 rounded-md p-6">
            <h2 className="text-lg font-semibold text-dark-900 mb-3 flex items-center gap-2">
              <LucideIcons.Link className="h-5 w-5" />
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
                    className="group bg-dark-100 border border-dark-300 rounded-xl p-4 hover:border-purple-400 hover:shadow-lg transition-all duration-200 text-left hover:scale-[1.02]"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="p-2.5 bg-gradient-to-br from-purple-50 to-blue-50 rounded-md group-hover:from-purple-100 group-hover:to-blue-100 transition-all duration-200 border border-purple-200 group-hover:border-purple-300">
                        <IconComponent className="h-5 w-5 text-purple-600 stroke-[1.5]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-dark-700 mb-1 group-hover:text-purple-700 transition-colors">
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
          <div className="bg-white border border-dark-300 rounded-md p-6">
            <h2 className="text-lg font-semibold text-dark-900 mb-3 flex items-center gap-2">
              <LucideIcons.Plug className="h-5 w-5" />
              Integrations
            </h2>
            <p className="text-sm text-dark-600 mb-4">
              Manage external service integrations, API connections, and third-party system configurations.
              Configure webhooks, OAuth providers, and external data sources.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-sm text-blue-900">
              <p className="font-medium mb-2">Integration Features</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
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
          <div className="bg-white border border-dark-300 rounded-md p-6">
            <h2 className="text-lg font-semibold text-dark-900 mb-3 flex items-center gap-2">
              <LucideIcons.Lock className="h-5 w-5" />
              Secrets Vault
            </h2>
            <p className="text-sm text-dark-600 mb-4">
              Securely manage API keys, passwords, certificates, and other sensitive credentials.
              All secrets are encrypted and stored with audit logging for compliance.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-md p-4 text-sm text-green-900">
              <p className="font-medium mb-2">Secrets Management Features</p>
              <ul className="list-disc list-inside space-y-1 text-green-700">
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
            <div className="bg-white border border-dark-300 rounded-md p-6">
              <h2 className="text-lg font-semibold text-dark-900 mb-3 flex items-center gap-2">
                <LucideIcons.Shield className="h-5 w-5" />
                Access Control - RBAC Management
              </h2>
              <p className="text-sm text-dark-600">
                Manage roles, assign employees to roles, and grant entity-level permissions using the Person-Based RBAC system.
                All changes affect the <strong>d_role</strong>, <strong>d_entity_id_map</strong>, and <strong>entity_id_rbac_map</strong> tables.
              </p>
            </div>

            {/* Three Sub-Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 1. Roles Management */}
              <div className="bg-white border border-dark-300 rounded-md p-6">
                <h3 className="text-base font-semibold text-dark-900 mb-3 flex items-center gap-2">
                  <LucideIcons.Users className="h-4 w-4" />
                  Roles Management
                </h3>
                <p className="text-sm text-dark-600 mb-4">
                  Create, edit, and delete roles. Click on a role to view employees assigned to it.
                </p>
                <button
                  onClick={() => navigate('/role')}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Manage Roles →
                </button>
                <div className="mt-4 text-xs text-dark-500">
                  <p className="font-medium mb-1">Quick Stats:</p>
                  <ul className="list-disc list-inside space-y-1 text-dark-600">
                    <li>Total Roles: {roleStats.loading ? 'Loading...' : roleStats.total}</li>
                    <li>Active Roles: {roleStats.loading ? 'Loading...' : roleStats.active}</li>
                  </ul>
                </div>
              </div>

              {/* 2. Employee Role Assignment */}
              <div className="bg-white border border-dark-300 rounded-md p-6">
                <h3 className="text-base font-semibold text-dark-900 mb-3 flex items-center gap-2">
                  <LucideIcons.Users className="h-4 w-4" />
                  Employee ↔ Role Assignment
                </h3>
                <p className="text-sm text-dark-600 mb-4">
                  Assign employees to roles. Uses <strong>d_entity_id_map</strong> with parent_entity_type='role' and child_entity_type='employee'.
                </p>
                <button
                  onClick={() => navigate('/role')}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  Assign Employees →
                </button>
                <div className="mt-4 text-xs text-dark-500">
                  <p className="font-medium mb-1">How it works:</p>
                  <ul className="list-disc list-inside space-y-1 text-dark-600">
                    <li>Navigate to a role</li>
                    <li>View "Employees" tab</li>
                    <li>Click "Assign Employee"</li>
                  </ul>
                </div>
              </div>

              {/* 3. Permission Management */}
              <div className="bg-white border border-dark-300 rounded-md p-6">
                <h3 className="text-base font-semibold text-dark-900 mb-3 flex items-center gap-2">
                  <LucideIcons.Shield className="h-4 w-4" />
                  Permission Management
                </h3>
                <p className="text-sm text-dark-600 mb-4">
                  Grant entity permissions to roles and employees. Uses <strong>entity_id_rbac_map</strong> with permission levels 0-5.
                </p>
                <button
                  onClick={() => setShowPermissionModal(true)}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm font-medium"
                >
                  Grant Permissions →
                </button>
                <div className="mt-4 text-xs text-dark-500">
                  <p className="font-medium mb-1">Permission Levels:</p>
                  <ul className="list-disc list-inside space-y-1 text-dark-600">
                    <li>0: View | 1: Edit | 2: Share</li>
                    <li>3: Delete | 4: Create | 5: Owner</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* RBAC Records Data Table */}
            <div className="bg-white border border-dark-300 rounded-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-dark-900 flex items-center gap-2">
                  <LucideIcons.Shield className="h-4 w-4" />
                  All RBAC Permissions
                </h3>
                <button
                  onClick={() => setShowPermissionModal(true)}
                  className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 transition-colors font-medium flex items-center gap-2"
                >
                  <LucideIcons.Plus className="h-3.5 w-3.5" />
                  Grant Permission
                </button>
              </div>
              <p className="text-sm text-dark-600 mb-4">
                View and manage all permissions across roles and employees. Click any row to edit or delete permissions.
              </p>
              <FilteredDataTable
                entityType="rbac"
                showActionButtons={false}
                showActionIcons={true}
                showEditIcon={true}
                inlineEditable={true}
                onRowClick={() => {
                  // Navigate to detail page if needed
                  // navigate(`/rbac/${item.id}`);
                }}
              />
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
                    <li><code>d_role</code> - Role definitions</li>
                    <li><code>d_employee</code> - Employee records</li>
                    <li><code>d_entity_id_map</code> - Role ↔ Employee links</li>
                    <li><code>entity_id_rbac_map</code> - Permissions (0-5)</li>
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
            <h2 className="text-base font-bold text-dark-700 tracking-tight">Entities ({entities.length})</h2>
            <div className="relative w-64">
              <LucideIcons.Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-dark-600" />
              <input
                type="text"
                placeholder="Search entities..."
                value={entitiesSearchQuery}
                onChange={(e) => setEntitiesSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-dark-300 rounded-md bg-dark-100 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 transition-all placeholder:text-dark-500"
              />
            </div>
          </div>

          {entitiesLoading ? (
            <div className="flex flex-col items-center justify-center py-16 bg-dark-100 rounded-xl border border-dark-300">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-3 border-dark-300 border-t-green-500"></div>
              <p className="text-sm font-medium text-dark-700 mt-4">Loading entities...</p>
            </div>
          ) : filteredEntities.length === 0 && !isAddingEntity ? (
            <div className="flex flex-col items-center justify-center py-12 bg-dark-100 rounded-xl border border-dark-300">
              <LucideIcons.Tag className="h-10 w-10 text-dark-500 mb-3" />
              <p className="text-sm font-medium text-dark-700">No entities found</p>
              <p className="text-xs text-dark-600 mt-1">Try adjusting your search</p>
            </div>
          ) : (
            <div className="bg-dark-100 border border-dark-300 rounded-xl overflow-hidden shadow-sm">
              <table className="min-w-full divide-y divide-dark-300">
                <thead className="bg-dark-50">
                  <tr className="border-b border-dark-300">
                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-600 uppercase">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-600 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-600 uppercase">UI Label</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-600 uppercase">Domain</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-600 uppercase">Icon</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-dark-600 uppercase">Order</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-dark-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-600 uppercase">Children</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-dark-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-dark-100 divide-y divide-dark-300">
                  {filteredEntities.map((entity) => {
                    const isEditing = editingEntityCode === entity.code;
                    return (
                      <tr
                        key={entity.code}
                        onClick={() => !isEditing && handleConfigureEntity(entity)}
                        className={isEditing ? 'bg-dark-100/30' : 'hover:bg-blue-50 cursor-pointer transition-colors'}
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
                              className="w-full px-2 py-1 text-sm border border-dark-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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
                              className="w-full px-2 py-1 text-sm border border-dark-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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
                              className="w-full px-2 py-1 text-sm border border-dark-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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
                                className="flex items-center gap-2 px-2 py-1 text-xs border border-dark-400 rounded hover:bg-dark-100 transition-colors"
                                type="button"
                              >
                                {(() => {
                                  const EditIcon = getIconComponent(editingEntityData.ui_icon ?? entity.ui_icon);
                                  return <EditIcon className="h-4 w-4 text-dark-700" />;
                                })()}
                                <span className="text-xs text-dark-700">{(editingEntityData.ui_icon ?? entity.ui_icon) || 'Select'}</span>
                                <LucideIcons.ChevronDown className="h-3 w-3" />
                              </button>

                              {/* Icon Picker Dropdown */}
                              {showEntityIconPicker && (
                                <div className="absolute left-0 top-full mt-1 z-50 bg-dark-100 rounded-md shadow-xl border border-dark-300 p-3 w-96">
                                  <div className="mb-2">
                                    <div className="relative">
                                      <LucideIcons.Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-dark-600" />
                                      <input
                                        type="text"
                                        value={iconSearchQuery}
                                        onChange={(e) => setIconSearchQuery(e.target.value)}
                                        placeholder="Search icons..."
                                        className="w-full pl-7 pr-3 py-1.5 text-xs border border-dark-400 rounded focus:ring-2 focus:ring-dark-700/30"
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
                                            className={`p-2 rounded hover:bg-dark-100 transition-colors ${isSelected ? 'bg-dark-100 ring-2 ring-dark-700' : ''}`}
                                            title={iconName}
                                            type="button"
                                          >
                                            <IconComponent className="h-4 w-4 text-dark-600" />
                                          </button>
                                        );
                                      })}
                                  </div>
                                  <div className="mt-2 flex items-center justify-between border-t border-dark-300 pt-2">
                                    <span className="text-xs text-dark-700">
                                      {AVAILABLE_ICON_NAMES.filter(name =>
                                        iconSearchQuery === '' || name.toLowerCase().includes(iconSearchQuery.toLowerCase())
                                      ).length} icons
                                    </span>
                                    <button
                                      onClick={() => {
                                        setShowEntityIconPicker(false);
                                        setIconSearchQuery('');
                                      }}
                                      className="px-2 py-1 text-xs text-dark-700 hover:bg-dark-100 rounded"
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
                                className: "h-4 w-4 text-dark-700"
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
                              className="w-16 px-2 py-1 text-sm border border-dark-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
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
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                              entity.active_flag ? 'bg-green-500' : 'bg-dark-300'
                            }`}
                            title={entity.active_flag ? 'Enabled - Click to disable' : 'Disabled - Click to enable'}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
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
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-dark-700 hover:bg-dark-100 rounded border border-dark-300 transition-colors font-medium"
                              title="Manage child entities"
                            >
                              <LucideIcons.GitBranch className="h-3.5 w-3.5" />
                              <span>{(entity.child_entities || []).length}</span>
                            </button>

                            {/* Tooltip showing child icons */}
                            {(entity.child_entities || []).length > 0 && (
                              <div className="invisible group-hover:visible absolute left-0 top-8 z-10 bg-dark-900 text-white text-xs rounded-md py-2 px-3 shadow-lg whitespace-nowrap">
                                <div className="space-y-1">
                                  {(entity.child_entities || []).slice(0, 5).map((childCode) => {
                                    const childMetadata = getEntityMetadata(childCode);
                                    if (!childMetadata) return null;
                                    return (
                                      <div key={childCode} className="flex items-center gap-2">
                                        {(() => {
                                          const ChildIcon = getIconComponent(childMetadata.ui_icon || 'Tag');
                                          return <ChildIcon className="h-3 w-3" />;
                                        })()}
                                        <span>{childMetadata.ui_label}</span>
                                      </div>
                                    );
                                  })}
                                  {(entity.child_entities || []).length > 5 && (
                                    <div className="text-dark-600 text-xs">
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
                                  className="p-1 text-green-600 hover:bg-green-50 rounded"
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
                                  className="p-1 text-dark-700 hover:bg-dark-100 rounded"
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
                                  className="p-1 text-dark-700 hover:bg-dark-100 rounded"
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
                    <tr className="bg-dark-100/40">
                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          value={newEntityData.code}
                          onChange={(e) => setNewEntityData({ ...newEntityData, code: e.target.value.toLowerCase() })}
                          placeholder="code"
                          className="w-full px-2 py-1 text-[11px] border border-dark-400 rounded focus:ring-2 focus:ring-dark-700/30 focus:border-dark-600"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          value={newEntityData.name}
                          onChange={(e) => setNewEntityData({ ...newEntityData, name: e.target.value })}
                          placeholder="Name"
                          className="w-full px-2 py-1 text-[11px] border border-dark-400 rounded focus:ring-2 focus:ring-dark-700/30 focus:border-dark-600"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          value={newEntityData.ui_label}
                          onChange={(e) => setNewEntityData({ ...newEntityData, ui_label: e.target.value })}
                          placeholder="UI Label"
                          className="w-full px-2 py-1 text-[11px] border border-dark-400 rounded focus:ring-2 focus:ring-dark-700/30 focus:border-dark-600"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="relative">
                          <button
                            onClick={() => setShowNewEntityIconPicker(!showNewEntityIconPicker)}
                            className="flex items-center gap-1.5 px-2 py-1 text-[11px] border border-dark-400 rounded hover:bg-dark-100 transition-colors"
                            type="button"
                          >
                            {newEntityData.ui_icon ? (
                              (() => {
                                const NewIcon = getIconComponent(newEntityData.ui_icon);
                                return <NewIcon className="h-3.5 w-3.5 text-dark-700" />;
                              })()
                            ) : (
                              <LucideIcons.Tag className="h-3.5 w-3.5 text-dark-600" />
                            )}
                            <span className="text-[10px] text-dark-700">{newEntityData.ui_icon || 'Select'}</span>
                            <LucideIcons.ChevronDown className="h-3 w-3" />
                          </button>

                          {/* Icon Picker Dropdown */}
                          {showNewEntityIconPicker && (
                            <div className="absolute left-0 top-full mt-1 z-50 bg-dark-100 rounded-md shadow-xl border border-dark-300 p-3 w-96">
                              <div className="mb-2">
                                <div className="relative">
                                  <LucideIcons.Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-dark-600" />
                                  <input
                                    type="text"
                                    value={newIconSearchQuery}
                                    onChange={(e) => setNewIconSearchQuery(e.target.value)}
                                    placeholder="Search icons..."
                                    className="w-full pl-7 pr-3 py-1.5 text-xs border border-dark-400 rounded focus:ring-2 focus:ring-dark-700/30"
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
                                        className={`p-2 rounded hover:bg-dark-100 transition-colors ${isSelected ? 'bg-dark-100 ring-2 ring-dark-700' : ''}`}
                                        title={iconName}
                                        type="button"
                                      >
                                        <IconComponent className="h-4 w-4 text-dark-600" />
                                      </button>
                                    );
                                  })}
                              </div>
                              <div className="mt-2 flex items-center justify-between border-t border-dark-300 pt-2">
                                <span className="text-xs text-dark-700">
                                  {AVAILABLE_ICON_NAMES.filter(name =>
                                    newIconSearchQuery === '' || name.toLowerCase().includes(newIconSearchQuery.toLowerCase())
                                  ).length} icons
                                </span>
                                <button
                                  onClick={() => {
                                    setShowNewEntityIconPicker(false);
                                    setNewIconSearchQuery('');
                                  }}
                                  className="px-2 py-1 text-xs text-dark-700 hover:bg-dark-100 rounded"
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
                          className="w-16 px-2 py-1 text-[11px] border border-dark-400 rounded focus:ring-2 focus:ring-dark-700/30 focus:border-dark-600 text-center"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="text-[10px] text-green-600 font-medium">Enabled</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="text-[10px] text-dark-600">-</span>
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
                            className="p-1 text-dark-700 hover:bg-dark-100 rounded transition-colors"
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
                <div className="border-t border-dark-300 bg-dark-100/50">
                  <button
                    onClick={() => setIsAddingEntity(true)}
                    className="w-full px-3 py-2 text-left text-[11px] font-semibold text-dark-700 hover:bg-dark-100 hover:text-dark-700 transition-colors flex items-center gap-2"
                  >
                    <LucideIcons.Plus className="h-3.5 w-3.5" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-dark-100 rounded-xl shadow-2xl w-full max-w-md mx-4">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-dark-300">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-dark-100 rounded-md">
                  <LucideIcons.GitBranch className="h-5 w-5 text-dark-700" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-dark-600">
                    Manage Child Entities
                  </h2>
                  <p className="text-xs text-dark-700 mt-0.5">
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
                className="p-2 rounded-md text-dark-600 hover:text-dark-700 hover:bg-dark-100 transition-colors"
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
                <h3 className="text-sm font-medium text-dark-600 mb-2">Current Child Entities</h3>
                {(selectedEntityForChildren.child_entities || []).length === 0 ? (
                  <p className="text-xs text-dark-700 italic">No child entities configured</p>
                ) : (
                  <div className="space-y-1">
                    {(selectedEntityForChildren.child_entities || []).map((childCode) => {
                      const childMetadata = getEntityMetadata(childCode);
                      if (!childMetadata) return null; // Skip if entity not found

                      return (
                        <div
                          key={childCode}
                          className="flex items-center justify-between px-3 py-2 bg-dark-100 rounded-md border border-dark-300"
                        >
                          <div className="flex items-center gap-2">
                            {(() => {
                              const ChildIcon = getIconComponent(childMetadata.ui_icon || 'Tag');
                              return <ChildIcon className="h-4 w-4 text-dark-700" />;
                            })()}
                            <span className="text-xs font-medium text-dark-600">{childMetadata.ui_label}</span>
                            <span className="text-xs text-dark-600">({childCode})</span>
                          </div>
                          <button
                            onClick={() => handleRemoveChild(selectedEntityForChildren.code, childCode)}
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
                <h3 className="text-sm font-medium text-dark-600 mb-2">Add Child Entity</h3>
                <div className="relative mb-2">
                  <LucideIcons.Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-dark-600" />
                  <input
                    type="text"
                    value={childSearchQuery}
                    onChange={(e) => setChildSearchQuery(e.target.value)}
                    placeholder="Search entities..."
                    className="w-full pl-8 pr-3 py-2 text-xs border border-dark-400 rounded-md focus:ring-2 focus:ring-dark-700/30 focus:border-dark-600"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {entities
                    .filter(e =>
                      e.code !== selectedEntityForChildren.code && // Not self
                      !(selectedEntityForChildren.child_entities || []).includes(e.code) && // Not already added
                      (childSearchQuery === '' ||
                        e.code.toLowerCase().includes(childSearchQuery.toLowerCase()) ||
                        e.ui_label.toLowerCase().includes(childSearchQuery.toLowerCase()))
                    )
                    .map((entity) => {
                      return (
                        <button
                          key={entity.code}
                          onClick={() => handleAddChild(selectedEntityForChildren.code, entity.code)}
                          className="w-full flex items-center justify-between px-3 py-2 bg-dark-100 hover:bg-dark-100 rounded-md border border-dark-300 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2">
                            {(() => {
                              const EntityIcon = getIconComponent(entity.ui_icon);
                              return <EntityIcon className="h-4 w-4 text-dark-700" />;
                            })()}
                            <span className="text-xs font-medium text-dark-600">{entity.ui_label}</span>
                            <span className="text-xs text-dark-600">({entity.code})</span>
                          </div>
                          <LucideIcons.Plus className="h-3 w-3 text-green-500" />
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-dark-300 bg-dark-100">
              <button
                onClick={() => {
                  setChildEntitiesModalOpen(false);
                  setSelectedEntityForChildren(null);
                  setChildSearchQuery('');
                }}
                className="px-4 py-2 text-sm font-medium text-dark-600 hover:bg-dark-100 rounded-md transition-colors"
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
