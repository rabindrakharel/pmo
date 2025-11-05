import React from 'react';
import { Layout, FilteredDataTable } from '../../components/shared';

/**
 * Client Page
 *
 * Displays and manages d_client table data.
 * Client relationship management including residential, commercial, municipal, and industrial clients.
 *
 * Database: app.d_client
 * Schema: db/XIV_d_client.ddl
 */

export const ClientPage: React.FC = () => {
  return (
    <Layout
      createButton={{
        label: 'Add Client',
        href: '/client/new',
        entityType: 'client'
      }}
    >
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 p-6 border-b border-dark-300">
          <h1 className="text-sm font-normal text-dark-700">
            Clients
          </h1>
          <p className="mt-1 text-xs font-light text-dark-700">
            Customer relationship management across all service categories
          </p>
        </div>
        <div className="flex-1 overflow-hidden">
          <FilteredDataTable
            entityType="client"
            inlineEditable={true}
            allowAddRow={true}
            showEditIcon={true}
            showDeleteIcon={true}
            showActionIcons={true}
          />
        </div>
      </div>
    </Layout>
  );
};

export default ClientPage;
