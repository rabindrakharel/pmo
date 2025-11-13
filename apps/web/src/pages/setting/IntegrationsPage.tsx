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
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-dark-100 text-dark-600">
            Inactive
          </span>
        );
      case 'available':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-dark-100 text-dark-600">
            Available
          </span>
        );
    }
  };

  const getCategoryColor = (category: Integration['category']) => {
    const colors = {
      api: 'border-dark-300 bg-dark-100',
      webhook: 'border-dark-300 bg-dark-100',
      database: 'border-dark-300 bg-dark-100',
      service: 'border-dark-300 bg-dark-100'
    };
    return colors[category] || 'border-dark-300 bg-dark-100';
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="bg-dark-100 shadow rounded-md">
          <div className="px-4 py-5 sm:p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="p-2 bg-dark-100 border border-dark-400 rounded-md mr-3">
                  <Plug className="h-5 w-5 text-dark-600 stroke-[1.5]" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-dark-600">Integrations</h1>
                  <p className="text-sm text-dark-700">Connect external services and manage API access</p>
                </div>
              </div>
              <button
                className="inline-flex items-center gap-2 px-3 py-1.5 border border-dark-400 text-sm font-normal rounded text-dark-600 bg-dark-100 hover:bg-dark-100 hover:border-dark-400 transition-colors disabled:bg-dark-100 disabled:text-dark-600"
                disabled
              >
                <Plus className="h-4 w-4" />
                Add Integration
              </button>
            </div>

            {/* Info Banner */}
            <div className="bg-dark-100 border border-dark-300 rounded-md p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-dark-700 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-dark-600 mb-1">Integration Platform</h3>
                  <p className="text-sm text-dark-600">
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
                    className={`border rounded-md p-5 transition-all hover:shadow-sm ${getCategoryColor(integration.category)}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-dark-100 rounded-md shadow-sm">
                          <IntegrationIcon className="h-5 w-5 text-dark-600" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-dark-600">{integration.name}</h3>
                          {getStatusBadge(integration.status)}
                        </div>
                      </div>
                      <button
                        className="p-1 text-dark-600 hover:text-dark-700 transition-colors"
                        title="Configure"
                      >
                        <Settings className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-sm text-dark-700 mb-4">{integration.description}</p>
                    <button
                      className="w-full px-3 py-1.5 border border-dark-400 text-sm font-normal rounded text-dark-600 bg-dark-100 hover:bg-dark-100 hover:border-dark-400 transition-colors disabled:bg-dark-100 disabled:text-dark-600"
                      disabled
                    >
                      Configure Integration
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Coming Soon Notice */}
            <div className="mt-8 text-center py-8 border-t border-dark-300">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-dark-100 mb-3">
                <Plug className="h-6 w-6 text-dark-600" />
              </div>
              <h3 className="text-sm font-medium text-dark-600 mb-1">Integration Features Coming Soon</h3>
              <p className="text-sm text-dark-700 max-w-md mx-auto">
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
