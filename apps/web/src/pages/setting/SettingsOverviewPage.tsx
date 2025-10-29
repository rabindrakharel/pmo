import React from 'react';
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
  X
} from 'lucide-react';

interface SettingCard {
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  href: string;
  category: string;
}

export function SettingsOverviewPage() {
  const navigate = useNavigate();
  const { exitSettingsMode } = useSettings();

  const settingCards: SettingCard[] = [
    {
      title: 'Data Labels',
      description: 'Manage all data labels, stages, and dropdown options across the platform',
      icon: Tag,
      href: '/setting/projectStage',
      category: 'Configuration'
    },
    {
      title: 'Data Linkage',
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
      category: 'Automation'
    },
    {
      title: 'Integrations',
      description: 'Connect external services and manage API integrations',
      icon: Plug,
      href: '/integrations',
      category: 'Connections'
    },
  ];

  const dataLabelCards: SettingCard[] = [
    { title: 'Project Stage', description: 'Manage project lifecycle stages', icon: GitBranch, href: '/setting/projectStage', category: 'Data Labels' },
    { title: 'Task Stage', description: 'Configure task workflow stages', icon: Target, href: '/setting/taskStage', category: 'Data Labels' },
    { title: 'Task Priority', description: 'Set up task priority levels', icon: TrendingUp, href: '/setting/taskPriority', category: 'Data Labels' },
    { title: 'Business Level', description: 'Define business hierarchy levels', icon: Building2, href: '/setting/businessLevel', category: 'Data Labels' },
    { title: 'Office Level', description: 'Configure office organization levels', icon: Building2, href: '/setting/orgLevel', category: 'Data Labels' },
    { title: 'Position Level', description: 'Set up employee position tiers', icon: Users, href: '/setting/positionLevel', category: 'Data Labels' },
    { title: 'Customer Tier', description: 'Define customer segmentation tiers', icon: Users, href: '/setting/customerTier', category: 'Data Labels' },
    { title: 'Opportunity Funnel', description: 'Configure sales funnel stages', icon: TrendingUp, href: '/setting/opportunityFunnelLevel', category: 'Data Labels' },
    { title: 'Industry Sector', description: 'Manage industry classifications', icon: Briefcase, href: '/setting/industrySector', category: 'Data Labels' },
    { title: 'Acquisition Channel', description: 'Track customer acquisition sources', icon: TrendingUp, href: '/setting/acquisitionChannel', category: 'Data Labels' },
  ];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <Settings className="h-6 w-6 text-gray-600 stroke-[1.5] mr-3" />
              <h1 className="text-lg font-normal text-gray-900">Settings Overview</h1>
            </div>
            <button
              onClick={exitSettingsMode}
              className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200"
              title="Exit Settings"
            >
              <X className="h-5 w-5 stroke-[1.5]" />
            </button>
          </div>
          <p className="text-sm text-gray-600">Manage your platform configuration, data labels, and integrations</p>
        </div>

        {/* Main Settings Cards */}
        <div className="mb-8">
          <h2 className="text-sm font-normal text-gray-700 mb-3">Main Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {settingCards.map((card) => {
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
        </div>

        {/* Data Labels Grid */}
        <div>
          <h2 className="text-sm font-normal text-gray-700 mb-3">Data Labels</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {dataLabelCards.map((card) => {
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
                      <p className="text-xs text-gray-500 truncate">{card.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}
