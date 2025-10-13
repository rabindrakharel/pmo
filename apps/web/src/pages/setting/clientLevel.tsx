import React from 'react';
import { Layout } from '../../components/layout/Layout';
import { FilteredDataTable } from '../../components/FilteredDataTable';

/**
 * ClientLevel Page
 *
 * Displays and manages meta_client_level table data.
 * Defines client organization hierarchy levels (CEO, Director, Senior Manager, Manager, Technical Lead).
 *
 * Database: app.meta_client_level
 * Schema: db/V_meta_client_level.ddl
 */

export const ClientLevelPage: React.FC = () => {
  return (
    <Layout
      createButton={{
        label: 'Add Client Level',
        href: '/setting/clientLevel/new',
        entityType: 'clientLevel'
      }}
    >
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 p-6 border-b border-gray-200">
          <h1 className="text-sm font-normal text-gray-500">
            Client Hierarchy Levels
          </h1>
          <p className="mt-1 text-xs font-light text-gray-500">
            Client organization authority structure from CEO to Technical Lead for engagement management
          </p>
        </div>
        <div className="flex-1 overflow-hidden">
          <FilteredDataTable entityType="clientLevel" />
        </div>
      </div>
    </Layout>
  );
};

export default ClientLevelPage;
