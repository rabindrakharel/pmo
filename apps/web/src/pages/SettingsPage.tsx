import React from 'react';
import { Link as LinkIcon } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { LinkageManager } from '../components/settings/LinkageManager';

export function SettingsPage() {
  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            {/* Header */}
            <div className="flex items-center mb-6">
              <LinkIcon className="h-5 w-5 text-gray-600 stroke-[1.5] mr-3" />
              <div className="flex-1">
                <h1 className="text-sm font-normal text-gray-900">Linkage Management</h1>
                <p className="text-sm text-gray-600">Manage entity relationships and hierarchies</p>
              </div>
            </div>

            {/* Linkage Section */}
            <div className="border border-gray-200 rounded-lg p-6">
              <LinkageManager />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
