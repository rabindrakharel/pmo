import React, { useState } from 'react';
import { Plug, Plus, Settings, AlertCircle, Check, Globe, Key, Webhook, Database } from 'lucide-react';
import { Layout } from '../../components/shared';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  status: 'active' | 'inactive' | 'available';
  category: 'api' | 'webhook' | 'database' | 'service';
}

export function IntegrationsPage() {
  const [integrations] = useState<Integration[]>([
    {
      id: 'api-keys',
      name: 'API Keys',
      description: 'Manage API keys for external access to your PMO data',
      icon: Key,
      status: 'available',
      category: 'api'
    },
    {
      id: 'webhooks',
      name: 'Webhooks',
      description: 'Configure webhooks for real-time event notifications',
      icon: Webhook,
      status: 'available',
      category: 'webhook'
    },
    {
      id: 'external-db',
      name: 'External Database',
      description: 'Connect to external databases for data sync',
      icon: Database,
      status: 'available',
      category: 'database'
    },
    {
      id: 'third-party',
      name: 'Third-Party Services',
      description: 'Integrate with external services and platforms',
      icon: Globe,
      status: 'available',
      category: 'service'
    }
  ]);

  const getStatusBadge = (status: Integration['status']) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <Check className="h-3 w-3 mr-1" />
            Active
          </span>
        );
      case 'inactive':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Inactive
          </span>
        );
      case 'available':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Available
          </span>
        );
    }
  };

  const getCategoryColor = (category: Integration['category']) => {
    const colors = {
      api: 'border-gray-200 bg-gray-50',
      webhook: 'border-gray-200 bg-gray-50',
      database: 'border-gray-200 bg-gray-50',
      service: 'border-gray-200 bg-gray-50'
    };
    return colors[category] || 'border-gray-200 bg-gray-50';
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="p-2 bg-gray-100 border border-gray-300 rounded-lg mr-3">
                  <Plug className="h-5 w-5 text-gray-700 stroke-[1.5]" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Integrations</h1>
                  <p className="text-sm text-gray-600">Connect external services and manage API access</p>
                </div>
              </div>
              <button
                className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 text-sm font-normal rounded text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:bg-gray-100 disabled:text-gray-400"
                disabled
              >
                <Plus className="h-4 w-4" />
                Add Integration
              </button>
            </div>

            {/* Info Banner */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-gray-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900 mb-1">Integration Platform</h3>
                  <p className="text-sm text-gray-700">
                    Connect your PMO platform with external services, APIs, and databases.
                    Configure webhooks for real-time notifications and manage API keys for secure access.
                  </p>
                </div>
              </div>
            </div>

            {/* Integrations Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {integrations.map((integration) => {
                const IntegrationIcon = integration.icon;
                return (
                  <div
                    key={integration.id}
                    className={`border rounded-lg p-5 transition-all hover:shadow-md ${getCategoryColor(integration.category)}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg shadow-sm">
                          <IntegrationIcon className="h-5 w-5 text-gray-700" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900">{integration.name}</h3>
                          {getStatusBadge(integration.status)}
                        </div>
                      </div>
                      <button
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Configure"
                      >
                        <Settings className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">{integration.description}</p>
                    <button
                      className="w-full px-3 py-1.5 border border-gray-300 text-sm font-normal rounded text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:bg-gray-100 disabled:text-gray-400"
                      disabled
                    >
                      Configure Integration
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Coming Soon Notice */}
            <div className="mt-8 text-center py-8 border-t border-gray-200">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-3">
                <Plug className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-sm font-medium text-gray-900 mb-1">Integration Features Coming Soon</h3>
              <p className="text-sm text-gray-600 max-w-md mx-auto">
                Advanced integration capabilities including API key management, webhook configuration,
                and third-party service connectors are currently under development.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
