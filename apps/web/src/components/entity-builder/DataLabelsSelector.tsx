import React, { useState, useEffect } from 'react';
import { Tag, Check, ChevronDown, ChevronRight } from 'lucide-react';
import * as Icons from 'lucide-react';
import { apiClient } from '../../lib/api';

interface DataLabel {
  datalabel_name: string;
  ui_label: string;
  ui_icon: string | null;
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

interface DataLabelsSelectorProps {
  selectedDataLabels: string[];
  onChange: (dataLabels: string[]) => void;
  entityCode: string;
}

export function DataLabelsSelector({
  selectedDataLabels,
  onChange,
  entityCode,
}: DataLabelsSelectorProps) {
  const [allDataLabels, setAllDataLabels] = useState<DataLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchDataLabels();
  }, []);

  const fetchDataLabels = async () => {
    try {
      const response = await apiClient.get('/api/v1/datalabel/all');

      // Filter to only show data labels that match the entity code
      // e.g., for entity "workflow_automation", only show "dl__workflow_automation_*"
      const filteredLabels = response.data.filter((label: DataLabel) => {
        const domain = extractDomain(label.datalabel_name);
        return domain === entityCode;
      });

      setAllDataLabels(filteredLabels);

      // Auto-expand the domain that matches the entity code
      const matchingDomain = extractDomain(entityCode);
      if (matchingDomain) {
        setExpandedDomains(new Set([matchingDomain]));
      }
    } catch (error) {
      console.error('Failed to fetch data labels:', error);
    } finally {
      setLoading(false);
    }
  };

  const extractDomain = (datalabelName: string): string | null => {
    const match = datalabelName.match(/^dl__([^_]+)_/);
    return match ? match[1] : null;
  };

  const groupByDomain = (labels: DataLabel[]): GroupedDataLabels => {
    const grouped: GroupedDataLabels = {};

    labels.forEach(label => {
      const domain = extractDomain(label.datalabel_name);
      if (domain) {
        if (!grouped[domain]) {
          grouped[domain] = [];
        }
        grouped[domain].push(label);
      }
    });

    return grouped;
  };

  const toggleDataLabel = (datalabelName: string) => {
    const newSelected = selectedDataLabels.includes(datalabelName)
      ? selectedDataLabels.filter(dl => dl !== datalabelName)
      : [...selectedDataLabels, datalabelName];

    onChange(newSelected);
  };

  const toggleDomain = (domain: string) => {
    const newExpanded = new Set(expandedDomains);
    if (newExpanded.has(domain)) {
      newExpanded.delete(domain);
    } else {
      newExpanded.add(domain);
    }
    setExpandedDomains(newExpanded);
  };

  const selectAllInDomain = (domain: string, labels: DataLabel[]) => {
    const domainDataLabels = labels.map(l => l.datalabel_name);
    const allSelected = domainDataLabels.every(dl => selectedDataLabels.includes(dl));

    let newSelected: string[];
    if (allSelected) {
      // Deselect all in domain
      newSelected = selectedDataLabels.filter(dl => !domainDataLabels.includes(dl));
    } else {
      // Select all in domain
      const toAdd = domainDataLabels.filter(dl => !selectedDataLabels.includes(dl));
      newSelected = [...selectedDataLabels, ...toAdd];
    }

    onChange(newSelected);
  };

  const getIcon = (iconName: string | null) => {
    if (!iconName) return Tag;
    const Icon = (Icons as any)[iconName] || Tag;
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
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
      </div>
    );
  }

  const filteredLabels = searchTerm
    ? allDataLabels.filter(
        label =>
          label.ui_label.toLowerCase().includes(searchTerm.toLowerCase()) ||
          label.datalabel_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : allDataLabels;

  const groupedLabels = groupByDomain(filteredLabels);
  const domains = Object.keys(groupedLabels).sort();

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
        <div className="flex items-start gap-2">
          <Tag className="h-4 w-4 text-slate-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-slate-900">
            <strong>Filtered for this entity:</strong> Showing only data labels for <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{entityCode}</span>
            {allDataLabels.length === 0 && (
              <span className="block mt-1 text-slate-700">
                No data labels found for this entity. Data labels must be named <span className="font-mono">dl__{entityCode}_*</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Header Stats */}
      {allDataLabels.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-dark-600">
            {selectedDataLabels.length} of {allDataLabels.length} data labels selected
          </div>
          {selectedDataLabels.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Clear All
            </button>
          )}
        </div>
      )}

      {/* Search */}
      {allDataLabels.length > 0 && (
        <div className="relative">
          <input
            type="text"
            placeholder="Search data labels..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 pl-10 border border-dark-300 rounded-md focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
          />
          <Tag className="absolute left-3 top-2.5 h-5 w-5 text-dark-400" />
        </div>
      )}

      {/* Data Labels List */}
      {allDataLabels.length > 0 && (
        <div className="border border-dark-300 rounded-md divide-y divide-dark-200 max-h-96 overflow-y-auto">
          {domains.length === 0 ? (
            <div className="p-8 text-center text-dark-500">
              No data labels found matching "{searchTerm}"
            </div>
          ) : (
          domains.map(domain => {
            const domainLabels = groupedLabels[domain];
            const isExpanded = expandedDomains.has(domain);
            const allSelected = domainLabels.every(dl => selectedDataLabels.includes(dl.datalabel_name));
            const someSelected = domainLabels.some(dl => selectedDataLabels.includes(dl.datalabel_name));

            return (
              <div key={domain} className="bg-white">
                {/* Domain Header */}
                <div className="flex items-center justify-between p-3 hover:bg-dark-50">
                  <button
                    onClick={() => toggleDomain(domain)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-dark-600" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-dark-600" />
                    )}
                    <span className="font-medium text-dark-900">
                      {capitalizeWords(domain)}
                    </span>
                    <span className="text-xs text-dark-500">
                      ({domainLabels.length})
                    </span>
                  </button>
                  <button
                    onClick={() => selectAllInDomain(domain, domainLabels)}
                    className={`text-xs font-medium px-2 py-1 rounded ${
                      allSelected
                        ? 'text-slate-700 bg-slate-100 hover:bg-slate-200'
                        : someSelected
                        ? 'text-slate-600 bg-slate-50 hover:bg-slate-100'
                        : 'text-dark-600 bg-dark-100 hover:bg-dark-200'
                    }`}
                  >
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                {/* Domain Data Labels */}
                {isExpanded && (
                  <div className="bg-dark-50 border-t border-dark-200">
                    {domainLabels.map(label => {
                      const isSelected = selectedDataLabels.includes(label.datalabel_name);
                      const Icon = getIcon(label.ui_icon);

                      return (
                        <button
                          key={label.datalabel_name}
                          onClick={() => toggleDataLabel(label.datalabel_name)}
                          className={`w-full flex items-center gap-3 p-3 hover:bg-white transition-colors border-b border-dark-200 last:border-b-0 ${
                            isSelected ? 'bg-slate-50' : ''
                          }`}
                        >
                          {/* Checkbox */}
                          <div
                            className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
                              isSelected
                                ? 'bg-slate-600 border-slate-600'
                                : 'border-dark-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3 text-white" />}
                          </div>

                          {/* Icon */}
                          <Icon className="h-4 w-4 text-dark-600 flex-shrink-0" />

                          {/* Label Info */}
                          <div className="flex-1 text-left min-w-0">
                            <div className="font-medium text-dark-900 text-sm">
                              {label.ui_label}
                            </div>
                            <div className="text-xs text-dark-500 font-mono">
                              {label.datalabel_name}
                            </div>
                          </div>

                          {/* Option Count */}
                          <div className="flex-shrink-0 text-xs text-dark-500 bg-dark-100 px-2 py-1 rounded">
                            {label.metadata.length} option{label.metadata.length !== 1 ? 's' : ''}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
        </div>
      )}

      {/* Selected Data Labels Summary */}
      {selectedDataLabels.length > 0 && (
        <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-md">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="h-4 w-4 text-slate-600" />
            <span className="text-sm font-medium text-slate-900">
              Selected Data Labels ({selectedDataLabels.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedDataLabels.map(datalabelName => {
              const label = allDataLabels.find(dl => dl.datalabel_name === datalabelName);
              if (!label) return null;

              const Icon = getIcon(label.ui_icon);

              return (
                <div
                  key={datalabelName}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                >
                  <Icon className="h-3 w-3 text-slate-600" />
                  <span className="text-dark-900">{label.ui_label}</span>
                  <button
                    onClick={() => toggleDataLabel(datalabelName)}
                    className="ml-1 text-dark-400 hover:text-red-600"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
