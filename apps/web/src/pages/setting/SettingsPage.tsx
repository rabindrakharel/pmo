import React from 'react';
import { Layout } from '../../components/shared';
import { SimplifiedLinkageManager } from '../../components/shared/settings/SimplifiedLinkageManager';

export function SettingsPage() {
  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6">
        <SimplifiedLinkageManager />
      </div>
    </Layout>
  );
}
