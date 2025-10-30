import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/shared';
import { useSettings } from '../../contexts/SettingsContext';
import {
  Settings,
  Tag,
  Link as LinkIcon,
  Zap,
  Plug,
  GitBranch,
  Target,
  Users,
  Building2,
  Briefcase,
  TrendingUp,
  ArrowLeft,
  Search,
  FolderOpen,
  CheckSquare,
  MapPin,
  FileText,
  BookOpen
} from 'lucide-react';
import { groupDatalabelsByEntity, ENTITY_METADATA } from '../../lib/entityDatalabelMapping';

interface SettingCard {
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  href: string;
  category: string;
  entityGroup?: string;
}

// Icon mapping for dynamic icons
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  FolderOpen,
  CheckSquare,
  Users,
  Building2,
  Briefcase,
  MapPin,
  FileText,
  BookOpen,
  GitBranch,
  Target,
  TrendingUp,
  Tag
};

export function SettingsOverviewPage() {
  const navigate = useNavigate();
  const { exitSettingsMode } = useSettings();
  const [datalabelSettings, setDatalabelSettings] = useState<SettingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [mainSearchQuery, setMainSearchQuery] = useState('');
  const [dataLabelsSearchQuery, setDataLabelsSearchQuery] = useState('');

  // Static configuration settings
  const configurationSettings: SettingCard[] = [
    {
      title: 'Entity Mapping',
      description: 'Configure relationships and connections between different entities',
      icon: LinkIcon,
      href: '/linkage',
      category: 'Configuration'
    },
    {
      title: 'Workflow Automation',
      description: 'Set up automated workflows and business process rules',
      icon: Zap,
      href: '/workflow-automation',
      category: 'Configuration'
    },
    {
      title: 'Integrations',
      description: 'Connect external services and manage API integrations',
      icon: Plug,
      href: '/integrations',
      category: 'Configuration'
    },
  ];

  // Fetch datalabel settings from API
  useEffect(() => {
    async function fetchDatalabels() {
      try {
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
        const grouped = groupDatalabelsByEntity(result.data);

        // Convert grouped datalabels to settings cards
        const cards: SettingCard[] = [];

        for (const [entityCode, datalabels] of Object.entries(grouped)) {
          const entityMeta = ENTITY_METADATA[entityCode];
          if (!entityMeta) continue;

          for (const datalabel of datalabels) {
            const iconComponent = ICON_MAP[datalabel.ui_icon] || Tag;

            cards.push({
              title: datalabel.ui_label,
              description: `Manage ${datalabel.ui_label.toLowerCase()} settings`,
              icon: iconComponent,
              href: `/setting/${datalabel.urlFormat}`,
              category: 'Data Labels',
              entityGroup: entityMeta.name
            });
          }
        }

        setDatalabelSettings(cards);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching datalabels:', error);
        setLoading(false);
      }
    }

    fetchDatalabels();
  }, []);

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

    // Sort groups by entity order
    const sortedGroups: Record<string, SettingCard[]> = {};
    const entityOrder = Object.values(ENTITY_METADATA).sort((a, b) => a.order - b.order);

    for (const entity of entityOrder) {
      if (groups[entity.name]) {
        sortedGroups[entity.name] = groups[entity.name];
      }
    }

    return sortedGroups;
  }, [filteredDataLabels]);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center mb-2">
            <button
              onClick={exitSettingsMode}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200 mr-3"
              title="Exit Settings"
            >
              <ArrowLeft className="h-4 w-4 stroke-[1.5]" />
            </button>
            <Settings className="h-6 w-6 text-gray-600 stroke-[1.5] mr-3" />
            <h1 className="text-lg font-normal text-gray-900">Settings</h1>
          </div>
          <p className="text-sm text-gray-600 ml-12">Manage your platform configuration, data labels, and integrations</p>
        </div>

        {/* Configuration Settings Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-normal text-gray-700">Configuration</h2>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search configuration..."
                value={mainSearchQuery}
                onChange={(e) => setMainSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400/30 focus:border-gray-300"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMainSettings.map((card) => {
              const IconComponent = card.icon;
              return (
                <button
                  key={card.href}
                  onClick={() => navigate(card.href)}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-all text-left"
                >
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-gray-50 rounded-lg">
                      <IconComponent className="h-5 w-5 text-gray-600 stroke-[1.5]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-normal text-gray-900 mb-1">{card.title}</h3>
                      <p className="text-xs text-gray-500">{card.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {filteredMainSettings.length === 0 && (
            <div className="text-center py-8 text-sm text-gray-500">
              No configuration settings found for "{mainSearchQuery}"
            </div>
          )}
        </div>

        {/* Data Labels Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-normal text-gray-700">Data Labels</h2>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search data labels..."
                value={dataLabelsSearchQuery}
                onChange={(e) => setDataLabelsSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400/30 focus:border-gray-300"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300"></div>
              <p className="text-sm text-gray-600 mt-2">Loading data labels...</p>
            </div>
          ) : Object.keys(groupedDataLabels).length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500">
              No data labels found for "{dataLabelsSearchQuery}"
            </div>
          ) : (
            Object.entries(groupedDataLabels).map(([entityName, cards]) => (
              <div key={entityName} className="mb-6">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  {entityName}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {cards.map((card) => {
                    const IconComponent = card.icon;
                    return (
                      <button
                        key={card.href}
                        onClick={() => navigate(card.href)}
                        className="bg-white border border-gray-200 rounded-lg p-3 hover:border-gray-300 hover:shadow-sm transition-all text-left"
                      >
                        <div className="flex items-center space-x-3">
                          <IconComponent className="h-4 w-4 text-gray-500 stroke-[1.5] flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-normal text-gray-900">{card.title}</h3>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
