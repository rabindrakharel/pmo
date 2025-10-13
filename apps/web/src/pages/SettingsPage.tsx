import React, { useState } from 'react';
import { Settings, KanbanSquare, ListChecks, Building2, Users, Briefcase, Target, TrendingUp, Factory, Radio } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { FilteredDataTable } from '../components/FilteredDataTable';

type SettingTab =
  | 'projectStatus'
  | 'projectStage'
  | 'taskStatus'
  | 'taskStage'
  | 'businessLevel'
  | 'orgLevel'
  | 'hrLevel'
  | 'clientLevel'
  | 'positionLevel'
  | 'opportunityFunnelLevel'
  | 'industrySector'
  | 'acquisitionChannel';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingTab>('projectStatus');

  const tabs: Array<{ id: SettingTab; label: string; icon: React.ElementType }> = [
    { id: 'projectStatus', label: 'Project Status', icon: KanbanSquare },
    { id: 'projectStage', label: 'Project Stage', icon: ListChecks },
    { id: 'taskStatus', label: 'Task Status', icon: KanbanSquare },
    { id: 'taskStage', label: 'Task Stage', icon: ListChecks },
    { id: 'businessLevel', label: 'Business Level', icon: Building2 },
    { id: 'orgLevel', label: 'Org Level', icon: Building2 },
    { id: 'hrLevel', label: 'HR Level', icon: Users },
    { id: 'clientLevel', label: 'Client Level', icon: Briefcase },
    { id: 'positionLevel', label: 'Position Level', icon: Target },
    { id: 'opportunityFunnelLevel', label: 'Opportunity Funnel', icon: TrendingUp },
    { id: 'industrySector', label: 'Industry Sector', icon: Factory },
    { id: 'acquisitionChannel', label: 'Acquisition Channel', icon: Radio },
  ];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center mb-6">
              <div className="h-12 w-12 bg-blue-600 rounded-full flex items-center justify-center">
                <Settings className="h-5 w-5 text-white" />
              </div>
              <div className="ml-4">
                <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
                <p className="text-gray-600">Manage system configuration and metadata</p>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex space-x-2 overflow-x-auto" aria-label="Tabs">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`
                        flex items-center whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors
                        ${
                          activeTab === tab.id
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }
                      `}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="mt-6">
              <FilteredDataTable
                entityType={activeTab}
                inlineEditable={true}
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
