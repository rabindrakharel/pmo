import React, { useState, useEffect } from 'react';
import { Layout } from '../../components/shared';
import { useNavigate } from 'react-router-dom';
import {
  Settings as SettingsIcon,
  Link as LinkIcon,
  Database,
  Sliders,
  Search,
  Home,
  FolderKanban,
  Users,
  Building2,
  SquareCheckBig,
  Globe,
  Package,
  ShoppingCart,
  FileText,
  Zap,
  Cable,
  Tag
} from 'lucide-react';
import { EntityConfigurationModal } from '../../components/settings/EntityConfigurationModal';
import * as LucideIcons from 'lucide-react';

interface Entity {
  code: string;
  name: string;
  ui_label: string;
  ui_icon?: string;
  display_order: number;
  active_flag?: boolean;
  child_entities?: any[];
  column_metadata?: any[];
}

interface Domain {
  domain: string;
  entities: Entity[];
}

// Map domain names to icons
const DOMAIN_ICONS: Record<string, any> = {
  'Overview': Home,
  'Core Management': FolderKanban,
  'Organization': Users,
  'Business': Building2,
  'Operations': SquareCheckBig,
  'Customers': Globe,
  'Retail': Package,
  'Sales & Finance': ShoppingCart,
  'Content & Docs': FileText,
  'Advanced': Zap,
};

type MainTab = 'entityMapping' | 'workflowAutomation' | 'integrations' | 'entities' | 'dataLabels';

export function SettingsPage() {
  const navigate = useNavigate();
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('entities');
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>('Overview');
  const [filteredEntities, setFilteredEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Fetch all entities grouped by domain
  useEffect(() => {
    const fetchDomains = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

        const response = await fetch(`${apiBaseUrl}/api/v1/entity/domains`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          const domainsList = data.domains || [];
          setDomains(domainsList);

          // Set initial filtered entities to first domain or all
          if (domainsList.length > 0) {
            const allEntities = domainsList.flatMap((d: Domain) => d.entities);
            setFilteredEntities(allEntities);
          }
        }
      } catch (error) {
        console.error('Error fetching entity domains:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDomains();
  }, []);

  // Filter entities based on selected domain and search
  useEffect(() => {
    if (selectedDomain === 'Overview') {
      // Show all entities
      const allEntities = domains.flatMap(d => d.entities);
      if (searchQuery.trim() === '') {
        setFilteredEntities(allEntities);
      } else {
        const query = searchQuery.toLowerCase();
        const filtered = allEntities.filter(
          (entity) =>
            entity.code.toLowerCase().includes(query) ||
            entity.name.toLowerCase().includes(query) ||
            entity.ui_label.toLowerCase().includes(query)
        );
        setFilteredEntities(filtered);
      }
    } else {
      // Show entities for selected domain
      const domainData = domains.find(d => d.domain === selectedDomain);
      if (domainData) {
        if (searchQuery.trim() === '') {
          setFilteredEntities(domainData.entities);
        } else {
          const query = searchQuery.toLowerCase();
          const filtered = domainData.entities.filter(
            (entity) =>
              entity.code.toLowerCase().includes(query) ||
              entity.name.toLowerCase().includes(query) ||
              entity.ui_label.toLowerCase().includes(query)
          );
          setFilteredEntities(filtered);
        }
      }
    }
  }, [selectedDomain, searchQuery, domains]);

  const handleConfigureEntity = (entity: Entity) => {
    setSelectedEntity(entity);
    setShowConfigModal(true);
  };

  const handleCloseConfigModal = () => {
    setShowConfigModal(false);
    setSelectedEntity(null);
  };

  const handleSaveEntity = () => {
    // Refresh entities list after save
    setShowConfigModal(false);
    setSelectedEntity(null);
    // Optionally refetch entities
    window.location.reload();
  };

  const getIcon = (iconName?: string) => {
    if (!iconName) return <LucideIcons.FileText className="h-5 w-5" />;
    const Icon = (LucideIcons as any)[iconName] || LucideIcons.FileText;
    return <Icon className="h-5 w-5" />;
  };

  const getDomainIcon = (domainName: string) => {
    const Icon = DOMAIN_ICONS[domainName] || FileText;
    return <Icon className="h-4 w-4" />;
  };

  const totalEntities = domains.flatMap(d => d.entities).length;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="bg-white border border-dark-300 rounded-md p-6">
          <div className="flex items-center gap-3">
            <SettingsIcon className="h-6 w-6 text-dark-700" />
            <h1 className="text-2xl font-bold text-dark-900">Settings</h1>
          </div>
        </div>

        {/* Main Tabs */}
        <div className="bg-dark-100 rounded-xl p-4 border border-dark-300">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveMainTab('entityMapping')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-all ${
                activeMainTab === 'entityMapping'
                  ? 'bg-slate-600 text-white shadow-sm'
                  : 'bg-white text-dark-700 border border-dark-300 hover:border-dark-400'
              }`}
            >
              <LinkIcon className="h-3.5 w-3.5" />
              Entity Mapping
            </button>

            <button
              onClick={() => setActiveMainTab('workflowAutomation')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-all ${
                activeMainTab === 'workflowAutomation'
                  ? 'bg-slate-600 text-white shadow-sm'
                  : 'bg-white text-dark-700 border border-dark-300 hover:border-dark-400'
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              Workflow Automation
            </button>

            <button
              onClick={() => setActiveMainTab('integrations')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-all ${
                activeMainTab === 'integrations'
                  ? 'bg-slate-600 text-white shadow-sm'
                  : 'bg-white text-dark-700 border border-dark-300 hover:border-dark-400'
              }`}
            >
              <Cable className="h-3.5 w-3.5" />
              Integrations
            </button>

            <button
              onClick={() => setActiveMainTab('entities')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-all ${
                activeMainTab === 'entities'
                  ? 'bg-slate-600 text-white shadow-sm'
                  : 'bg-white text-dark-700 border border-dark-300 hover:border-dark-400'
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              Entities ({totalEntities})
            </button>

            <button
              onClick={() => setActiveMainTab('dataLabels')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-all ${
                activeMainTab === 'dataLabels'
                  ? 'bg-slate-600 text-white shadow-sm'
                  : 'bg-white text-dark-700 border border-dark-300 hover:border-dark-400'
              }`}
            >
              <Tag className="h-4 w-4" />
              Data Labels (57)
            </button>
          </div>
        </div>

        {/* Entity Mapping Tab */}
        {activeMainTab === 'entityMapping' && (
          <div className="bg-white border border-dark-300 rounded-md p-6">
            <h2 className="text-lg font-semibold text-dark-900 mb-3 flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              Entity Mapping
            </h2>
            <p className="text-sm text-dark-600 mb-4">
              Configure parent-child relationships and entity linkages using the <strong>d_entity_id_map</strong> table.
              Define how entities connect and interact with each other across the system.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-sm text-blue-900">
              <p className="font-medium mb-2">Entity Mapping Configuration</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>View and edit parent-child entity relationships</li>
                <li>Configure entity linkage rules and constraints</li>
                <li>Manage entity hierarchy and navigation paths</li>
              </ul>
            </div>
            <button
              onClick={() => navigate('/test/linkage')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Test Linkage Modal
            </button>
          </div>
        )}

        {/* Workflow Automation Tab */}
        {activeMainTab === 'workflowAutomation' && (
          <div className="bg-white border border-dark-300 rounded-md p-6">
            <h2 className="text-lg font-semibold text-dark-900 mb-3 flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Workflow Automation
            </h2>
            <p className="text-sm text-dark-600 mb-4">
              Configure automated workflows, business process rules, and event-driven actions.
              Set up triggers, conditions, and actions to automate routine tasks.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-sm text-amber-900">
              <p className="font-medium mb-2">Workflow Automation Features</p>
              <ul className="list-disc list-inside space-y-1 text-amber-700">
                <li>Create automated workflows for entity state transitions</li>
                <li>Configure event triggers and action rules</li>
                <li>Set up approval chains and notification flows</li>
                <li>Define business process automation logic</li>
              </ul>
            </div>
          </div>
        )}

        {/* Integrations Tab */}
        {activeMainTab === 'integrations' && (
          <div className="bg-white border border-dark-300 rounded-md p-6">
            <h2 className="text-lg font-semibold text-dark-900 mb-3 flex items-center gap-2">
              <Cable className="h-5 w-5" />
              Integrations
            </h2>
            <p className="text-sm text-dark-600 mb-4">
              Manage external service integrations, API connections, and third-party system configurations.
              Configure webhooks, OAuth providers, and external data sources.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-md p-4 text-sm text-green-900">
              <p className="font-medium mb-2">Available Integrations</p>
              <ul className="list-disc list-inside space-y-1 text-green-700">
                <li>AWS Services (S3, SES, SNS, Lambda)</li>
                <li>Authentication providers (OAuth, SAML, LDAP)</li>
                <li>External APIs and webhooks</li>
                <li>MinIO object storage configuration</li>
                <li>Email service integration (MailHog/SMTP)</li>
              </ul>
            </div>
          </div>
        )}

        {/* Entities Tab */}
        {activeMainTab === 'entities' && (
          <div className="bg-white border border-dark-300 rounded-md p-6">
          <div className="flex items-center gap-3 mb-4">
            <Database className="h-5 w-5 text-dark-700" />
            <h2 className="text-lg font-semibold text-dark-900">Entity Configuration</h2>
          </div>
          <p className="text-sm text-dark-600 mb-6">
            Configure entity columns, metadata, and display settings for all {totalEntities} entities in the system.
          </p>

          {/* Domain Tabs */}
          <div className="bg-dark-100 rounded-xl p-4 border border-dark-300 mb-6">
            <div className="flex flex-wrap gap-2">
              {/* Overview Tab - Shows All */}
              <button
                onClick={() => setSelectedDomain('Overview')}
                className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-all ${
                  selectedDomain === 'Overview'
                    ? 'bg-slate-600 text-white shadow-sm'
                    : 'bg-white text-dark-700 border border-dark-300 hover:border-dark-400'
                }`}
              >
                {getDomainIcon('Overview')}
                Overview
              </button>

              {/* Dynamic Domain Tabs */}
              {loading ? (
                <div className="flex items-center gap-2 px-3 py-2 text-dark-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  Loading domains...
                </div>
              ) : (
                domains.map((domain) => (
                  <button
                    key={domain.domain}
                    onClick={() => setSelectedDomain(domain.domain)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-all ${
                      selectedDomain === domain.domain
                        ? 'bg-slate-600 text-white shadow-sm'
                        : 'bg-white text-dark-700 border border-dark-300 hover:border-dark-400'
                    }`}
                  >
                    {getDomainIcon(domain.domain)}
                    {domain.domain}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search entities in ${selectedDomain}...`}
                className="w-full pl-10 pr-4 py-2 border border-dark-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Help Text */}
          {!loading && filteredEntities.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex items-start gap-2 mb-4">
              <Database className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-900">
                <p className="font-medium">Entity Configuration</p>
                <p className="mt-1 text-blue-700">
                  <strong>Click on any row</strong> to configure the entity's column metadata, display settings, and more.
                  You can add, edit, delete, and reorder database columns.
                </p>
              </div>
            </div>
          )}

          {/* Entities Table */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredEntities.length === 0 ? (
            <div className="text-center py-12 bg-dark-50 rounded-md border border-dark-300">
              <p className="text-dark-600">
                {searchQuery
                  ? `No entities found matching "${searchQuery}" in ${selectedDomain}.`
                  : `No entities available in ${selectedDomain}.`}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-md border border-dark-300 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-dark-50 border-b border-dark-300">
                  <tr>
                    <th className="w-12 px-4 py-3 text-left text-xs font-medium text-dark-600 uppercase">Icon</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-600 uppercase">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-600 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-600 uppercase">UI Label</th>
                    <th className="w-24 px-4 py-3 text-center text-xs font-medium text-dark-600 uppercase">Order</th>
                    <th className="w-24 px-4 py-3 text-center text-xs font-medium text-dark-600 uppercase">Columns</th>
                    <th className="w-32 px-4 py-3 text-center text-xs font-medium text-dark-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-200">
                  {filteredEntities.map((entity) => (
                    <tr
                      key={entity.code}
                      onClick={() => handleConfigureEntity(entity)}
                      className="hover:bg-blue-50 cursor-pointer transition-colors group"
                      title={`Click to configure ${entity.name}`}
                    >
                      <td className="px-4 py-3 text-dark-700">
                        {getIcon(entity.ui_icon)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-dark-700">
                        {entity.code}
                      </td>
                      <td className="px-4 py-3 text-dark-900 font-medium">
                        {entity.name}
                      </td>
                      <td className="px-4 py-3 text-dark-700">
                        {entity.ui_label}
                      </td>
                      <td className="px-4 py-3 text-center text-dark-600">
                        {entity.display_order}
                      </td>
                      <td className="px-4 py-3 text-center text-dark-600">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 group-hover:bg-blue-200 transition-colors">
                          {entity.column_metadata?.length || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConfigureEntity(entity);
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors text-sm font-medium"
                            title={`Configure ${entity.name}`}
                          >
                            <Sliders className="h-4 w-4" />
                            Configure
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Summary */}
          {!loading && (
            <div className="mt-4 text-sm text-dark-600">
              Showing {filteredEntities.length} {filteredEntities.length === 1 ? 'entity' : 'entities'}
              {selectedDomain !== 'Overview' && ` in ${selectedDomain}`}
              {searchQuery && ` matching "${searchQuery}"`}
            </div>
          )}
          </div>
        )}

        {/* Data Labels Tab */}
        {activeMainTab === 'dataLabels' && (
          <div className="bg-white border border-dark-300 rounded-md p-6">
            <h2 className="text-lg font-semibold text-dark-900 mb-3 flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Data Labels
            </h2>
            <p className="text-sm text-dark-600 mb-4">
              Manage dropdown options, status workflows, and sequential states for all entity types.
              Configure data labels stored in the <strong>setting_datalabel</strong> table.
            </p>
            <div className="bg-purple-50 border border-purple-200 rounded-md p-4 text-sm text-purple-900 mb-6">
              <p className="font-medium mb-2">Data Label Categories</p>
              <div className="grid grid-cols-2 gap-2 text-purple-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>Project stages and status workflows</li>
                  <li>Task priority and update types</li>
                  <li>Client levels and status</li>
                  <li>Office and business hierarchies</li>
                  <li>Position and role levels</li>
                </ul>
                <ul className="list-disc list-inside space-y-1">
                  <li>Opportunity funnel stages</li>
                  <li>Industry sectors and acquisition channels</li>
                  <li>Customer tier classifications</li>
                  <li>Form approval and submission status</li>
                  <li>Wiki publication status</li>
                </ul>
              </div>
            </div>

            <div className="bg-white rounded-md border border-dark-300 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-dark-50 border-b border-dark-300">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-600 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-600 uppercase">Description</th>
                    <th className="w-24 px-4 py-3 text-center text-xs font-medium text-dark-600 uppercase">Count</th>
                    <th className="w-32 px-4 py-3 text-center text-xs font-medium text-dark-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-200">
                  <tr className="hover:bg-blue-50">
                    <td className="px-4 py-3 font-medium text-dark-900">Project Stage</td>
                    <td className="px-4 py-3 text-dark-600">Sequential workflow stages for projects</td>
                    <td className="px-4 py-3 text-center text-dark-600">5</td>
                    <td className="px-4 py-3 text-center">
                      <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">Configure</button>
                    </td>
                  </tr>
                  <tr className="hover:bg-blue-50">
                    <td className="px-4 py-3 font-medium text-dark-900">Task Priority</td>
                    <td className="px-4 py-3 text-dark-600">Priority levels for task management</td>
                    <td className="px-4 py-3 text-center text-dark-600">4</td>
                    <td className="px-4 py-3 text-center">
                      <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">Configure</button>
                    </td>
                  </tr>
                  <tr className="hover:bg-blue-50">
                    <td className="px-4 py-3 font-medium text-dark-900">Client Status</td>
                    <td className="px-4 py-3 text-dark-600">Client lifecycle status values</td>
                    <td className="px-4 py-3 text-center text-dark-600">6</td>
                    <td className="px-4 py-3 text-center">
                      <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">Configure</button>
                    </td>
                  </tr>
                  <tr className="hover:bg-blue-50">
                    <td className="px-4 py-3 font-medium text-dark-900">Customer Tier</td>
                    <td className="px-4 py-3 text-dark-600">Customer segmentation tiers</td>
                    <td className="px-4 py-3 text-center text-dark-600">5</td>
                    <td className="px-4 py-3 text-center">
                      <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">Configure</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-sm text-dark-600">
              Showing 4 of 57 data label categories
            </div>
          </div>
        )}
      </div>

      {/* Entity Configuration Modal */}
      {selectedEntity && (
        <EntityConfigurationModal
          isOpen={showConfigModal}
          onClose={handleCloseConfigModal}
          entityCode={selectedEntity.code}
          entityName={selectedEntity.name}
          onSave={handleSaveEntity}
        />
      )}
    </Layout>
  );
}
