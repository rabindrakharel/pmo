import React from 'react';
import { Database } from 'lucide-react';
import { Layout } from '../components/layout/Layout';

export function MetaPage() {
  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Database className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Meta Configuration</h1>
              <p className="mt-2 text-gray-600">Manage system metadata and configuration settings.</p>
            </div>
          </div>
        </div>

        {/* Meta Configuration Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Business Levels</h3>
            <p className="text-gray-600 mb-4">Configure organizational hierarchy levels and structures.</p>
            <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">
              Manage Levels →
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Location Levels</h3>
            <p className="text-gray-600 mb-4">Define geographic hierarchy and location structures.</p>
            <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">
              Manage Locations →
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">HR Levels</h3>
            <p className="text-gray-600 mb-4">Configure human resources hierarchy and positions.</p>
            <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">
              Manage HR →
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Project Status</h3>
            <p className="text-gray-600 mb-4">Define project status types and workflow stages.</p>
            <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">
              Manage Status →
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Task Status</h3>
            <p className="text-gray-600 mb-4">Configure task statuses and development lifecycle.</p>
            <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">
              Manage Tasks →
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">System Settings</h3>
            <p className="text-gray-600 mb-4">Global system configuration and preferences.</p>
            <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">
              Configure →
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}