import React, { useState, useEffect } from 'react';
import { Layout } from '../../components/shared';
import { useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, Link as LinkIcon, Database, Sliders, Search } from 'lucide-react';
import { EntityConfigurationModal } from '../../components/settings/EntityConfigurationModal';
import * as LucideIcons from 'lucide-react';

interface Entity {
  code: string;
  name: string;
  ui_label: string;
  ui_icon: string;
  display_order: number;
  active_flag: boolean;
  child_entities?: any[];
}

export function SettingsPage() {
  const navigate = useNavigate();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [filteredEntities, setFilteredEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Fetch all entities
  useEffect(() => {
    const fetchEntities = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

        const response = await fetch(`${apiBaseUrl}/api/v1/entity/types`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          const entityList = Array.isArray(data) ? data : data.data || [];
          setEntities(entityList);
          setFilteredEntities(entityList);
        }
      } catch (error) {
        console.error('Error fetching entities:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEntities();
  }, []);

  // Filter entities based on search
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredEntities(entities);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = entities.filter(
        (entity) =>
          entity.code.toLowerCase().includes(query) ||
          entity.name.toLowerCase().includes(query) ||
          entity.ui_label.toLowerCase().includes(query)
      );
      setFilteredEntities(filtered);
    }
  }, [searchQuery, entities]);

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

  const getIcon = (iconName: string) => {
    const Icon = (LucideIcons as any)[iconName] || LucideIcons.FileText;
    return <Icon className="h-5 w-5" />;
  };

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
          <p className="text-sm text-dark-600 mb-4">
            Configure entity columns, metadata, and display settings for all {entities.length} entities in the system.
          </p>

          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search entities by code or name..."
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
            <div className="text-center py-12">
              <p className="text-dark-600">
                {searchQuery ? 'No entities found matching your search.' : 'No entities available.'}
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
                    <th className="w-24 px-4 py-3 text-center text-xs font-medium text-dark-600 uppercase">Children</th>
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
                        {entity.child_entities?.length || 0}
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
