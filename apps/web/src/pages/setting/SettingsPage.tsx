import React from 'react';
import { Layout } from '../../components/shared';
import { useNavigate } from 'react-router-dom';
import { Settings, Link as LinkIcon } from 'lucide-react';

export function SettingsPage() {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-dark-100 border border-dark-300 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-6">
            <Settings className="h-6 w-6 text-dark-700" />
            <h1 className="text-2xl font-bold text-dark-600">Settings</h1>
          </div>

          <div className="bg-dark-100 border border-dark-400 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-dark-600 mb-3 flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              Entity Linkage System
            </h2>
            <p className="text-sm text-dark-600 mb-4">
              Entity linkage management has been unified into a reusable modal component.
              Use the <strong>UnifiedLinkageModal</strong> component throughout the application
              to manage parent-child relationships between entities.
            </p>
            <button
              onClick={() => navigate('/test/linkage')}
              className="px-4 py-2 bg-dark-700 text-white rounded-lg hover:bg-dark-800 transition-colors text-sm font-medium"
            >
              Test Linkage Modal
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
