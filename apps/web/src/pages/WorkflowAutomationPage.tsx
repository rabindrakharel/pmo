import React, { useState } from 'react';
import { Zap, Plus, Settings, Play, Pause, Trash2 } from 'lucide-react';
import { Layout } from '../components/shared/layout/Layout';

interface WorkflowRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  enabled: boolean;
  created: string;
}

export function WorkflowAutomationPage() {
  const [workflows, setWorkflows] = useState<WorkflowRule[]>([
    {
      id: '1',
      name: 'Task Assignment Notification',
      trigger: 'When task is assigned',
      action: 'Send email to assignee',
      enabled: true,
      created: '2025-01-15'
    },
    {
      id: '2',
      name: 'Project Status Update',
      trigger: 'When project status changes',
      action: 'Notify stakeholders',
      enabled: true,
      created: '2025-01-14'
    },
    {
      id: '3',
      name: 'Invoice Approval',
      trigger: 'When invoice exceeds $10,000',
      action: 'Request manager approval',
      enabled: false,
      created: '2025-01-10'
    }
  ]);

  const toggleWorkflow = (id: string) => {
    setWorkflows(workflows.map(w =>
      w.id === id ? { ...w, enabled: !w.enabled } : w
    ));
  };

  const deleteWorkflow = (id: string) => {
    if (confirm('Are you sure you want to delete this workflow?')) {
      setWorkflows(workflows.filter(w => w.id !== id));
    }
  };

  return (
    <Layout>
      <div className="h-full flex flex-col bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="h-6 w-6 text-blue-600 stroke-[1.5]" />
              <div>
                <h1 className="text-lg font-medium text-gray-900">Workflow Automation</h1>
                <p className="text-sm text-gray-500">Automate repetitive tasks and streamline your processes</p>
              </div>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
              <Plus className="h-4 w-4" />
              Create Workflow
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Workflows</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-1">{workflows.length}</p>
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Zap className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Active</p>
                  <p className="text-2xl font-semibold text-green-600 mt-1">
                    {workflows.filter(w => w.enabled).length}
                  </p>
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Play className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Inactive</p>
                  <p className="text-2xl font-semibold text-gray-400 mt-1">
                    {workflows.filter(w => !w.enabled).length}
                  </p>
                </div>
                <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Pause className="h-6 w-6 text-gray-400" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Workflows Table */}
        <div className="flex-1 px-6 pb-6 overflow-auto">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Workflow Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Trigger
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {workflows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <Zap className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">No workflows created yet</p>
                        <p className="text-xs text-gray-400 mt-1">Click "Create Workflow" to get started</p>
                      </td>
                    </tr>
                  ) : (
                    workflows.map((workflow) => (
                      <tr key={workflow.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Zap className="h-5 w-5 text-blue-600 mr-2" />
                            <span className="text-sm font-medium text-gray-900">{workflow.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">{workflow.trigger}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">{workflow.action}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {workflow.enabled ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <span className="h-1.5 w-1.5 bg-green-600 rounded-full mr-1.5"></span>
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              <span className="h-1.5 w-1.5 bg-gray-600 rounded-full mr-1.5"></span>
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(workflow.created).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => toggleWorkflow(workflow.id)}
                              className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                              title={workflow.enabled ? 'Disable' : 'Enable'}
                            >
                              {workflow.enabled ? (
                                <Pause className="h-4 w-4 text-gray-600" />
                              ) : (
                                <Play className="h-4 w-4 text-green-600" />
                              )}
                            </button>
                            <button
                              className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                              title="Edit"
                            >
                              <Settings className="h-4 w-4 text-gray-600" />
                            </button>
                            <button
                              onClick={() => deleteWorkflow(workflow.id)}
                              className="p-1.5 rounded hover:bg-red-100 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
