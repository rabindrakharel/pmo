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
  Zap
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

export function SettingsPage() {
  const navigate = useNavigate();
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
        <div className="bg-white border border-dark-300 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <SettingsIcon className="h-6 w-6 text-dark-700" />
            <h1 className="text-2xl font-bold text-dark-900">Settings</h1>
          </div>
        </div>

        {/* Entity Configuration Section */}
        <div className="bg-white border border-dark-300 rounded-lg p-6">
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
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                  selectedDomain === 'Overview'
                    ? 'bg-slate-600 text-white shadow-md'
                    : 'bg-dark-100 text-dark-700 border border-dark-300 hover:border-dark-400'
                }`}
              >
                {getDomainIcon('Overview')}
                Overview
              </button>

              {/* Dynamic Domain Tabs */}
              {loading ? (
                <div className="flex items-center gap-2 px-4 py-2.5 text-dark-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  Loading domains...
                </div>
              ) : (
                domains.map((domain) => (
                  <button
                    key={domain.domain}
                    onClick={() => setSelectedDomain(domain.domain)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                      selectedDomain === domain.domain
                        ? 'bg-slate-600 text-white shadow-md'
                        : 'bg-dark-100 text-dark-700 border border-dark-300 hover:border-dark-400'
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
                className="w-full pl-10 pr-4 py-2 border border-dark-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Entities Table */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredEntities.length === 0 ? (
            <div className="text-center py-12 bg-dark-50 rounded-lg border border-dark-300">
              <p className="text-dark-600">
                {searchQuery
                  ? `No entities found matching "${searchQuery}" in ${selectedDomain}.`
                  : `No entities available in ${selectedDomain}.`}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-dark-300 overflow-hidden">
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
                    <tr key={entity.code} className="hover:bg-dark-50">
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
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {entity.column_metadata?.length || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => handleConfigureEntity(entity)}
                            className="flex items-center gap-2 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors text-sm font-medium"
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

        {/* Entity Linkage Section */}
        <div className="bg-white border border-dark-300 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-dark-900 mb-3 flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Entity Linkage System
          </h2>
          <p className="text-sm text-dark-600 mb-4">
            Entity linkage management has been unified into a reusable modal component.
            Use the <strong>UnifiedLinkageModal</strong> component throughout the application
            to manage parent-child relationships between entities.
          </p>
          <button
            onClick={() => navigate('/test/linkage')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Test Linkage Modal
          </button>
        </div>
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
