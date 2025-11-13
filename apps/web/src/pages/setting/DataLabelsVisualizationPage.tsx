import React, { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { apiClient } from '../../lib/api';
import { Layout } from '../../components/shared';

interface DataLabel {
  datalabel_name: string;
  ui_label: string;
  ui_icon: string;
  metadata: Array<{
    id: number;
    name: string;
    descr: string;
    color_code: string;
    parent_ids: number[];
  }>;
}

interface GroupedDataLabels {
  [domain: string]: DataLabel[];
}

export default function DataLabelsVisualizationPage() {
  const [dataLabels, setDataLabels] = useState<DataLabel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDataLabels();
  }, []);

  const fetchDataLabels = async () => {
    try {
      const response = await apiClient.get('/api/v1/setting/datalabels');
      setDataLabels(response.data);
    } catch (error) {
      console.error('Failed to fetch data labels:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group data labels by domain (extracted from dl__<domain>_*)
  const groupByDomain = (labels: DataLabel[]): GroupedDataLabels => {
    const grouped: GroupedDataLabels = {};

    labels.forEach(label => {
      // Extract domain from dl__<domain>_<attribute> pattern
      const match = label.datalabel_name.match(/^dl__([^_]+)_/);
      if (match) {
        const domain = match[1];
        if (!grouped[domain]) {
          grouped[domain] = [];
        }
        grouped[domain].push(label);
      }
    });

    return grouped;
  };

  const getIcon = (iconName: string) => {
    const Icon = (Icons as any)[iconName] || Icons.Tag;
    return Icon;
  };

  const capitalizeWords = (str: string) => {
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-lg text-gray-500">Loading data labels...</div>
        </div>
      </Layout>
    );
  }

  const groupedLabels = groupByDomain(dataLabels);
  const domains = Object.keys(groupedLabels).sort();

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Data Labels Visualization
          </h1>
          <p className="text-gray-600">
            {dataLabels.length} data labels across {domains.length} domains
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
          {domains.map(domain => {
            const domainLabels = groupedLabels[domain];
            const totalOptions = domainLabels.reduce(
              (sum, label) => sum + label.metadata.length,
              0
            );

            return (
              <div
                key={domain}
                className="bg-white rounded-md shadow-sm border border-gray-200 p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <div className="text-blue-600 mt-1">
                    {React.createElement(
                      getIcon(domainLabels[0]?.ui_icon || 'Tag'),
                      { size: 20 }
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">
                      {capitalizeWords(domain)}
                    </h3>
                    <div className="text-xs text-gray-500">
                      {domainLabels.length} label{domainLabels.length !== 1 ? 's' : ''}
                    </div>
                    <div className="text-xs text-gray-400">
                      {totalOptions} option{totalOptions !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detailed View */}
        <div className="space-y-8">
          {domains.map(domain => {
            const domainLabels = groupedLabels[domain];

            return (
              <div key={domain} className="bg-white rounded-md shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  {React.createElement(
                    getIcon(domainLabels[0]?.ui_icon || 'Tag'),
                    { size: 24, className: 'text-blue-600' }
                  )}
                  {capitalizeWords(domain)}
                </h2>

                <div className="space-y-4">
                  {domainLabels.map(label => {
                    const Icon = getIcon(label.ui_icon);

                    return (
                      <div
                        key={label.datalabel_name}
                        className="border-l-4 border-blue-500 pl-4 py-2"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Icon size={16} className="text-gray-600" />
                          <span className="font-medium text-gray-900">
                            {label.ui_label}
                          </span>
                          <span className="text-xs text-gray-400 font-mono">
                            ({label.datalabel_name})
                          </span>
                        </div>

                        {/* Options */}
                        <div className="flex flex-wrap gap-2 ml-6">
                          {label.metadata.map(option => (
                            <div
                              key={option.id}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 rounded text-xs"
                            >
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{
                                  backgroundColor: getColorCode(option.color_code)
                                }}
                              />
                              <span className="text-gray-700">{option.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </Layout>
  );
}

// Helper function to convert color names to hex codes
function getColorCode(colorName: string): string {
  const colorMap: { [key: string]: string } = {
    gray: '#9CA3AF',
    blue: '#3B82F6',
    green: '#10B981',
    yellow: '#F59E0B',
    red: '#EF4444',
    purple: '#8B5CF6',
    orange: '#F97316',
    cyan: '#06B6D4',
    indigo: '#6366F1',
    pink: '#EC4899',
    amber: '#F59E0B',
  };
  return colorMap[colorName.toLowerCase()] || '#9CA3AF';
}
