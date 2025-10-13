import React from 'react';
import { Layout } from '../../components/layout/Layout';
import { FilteredDataTable } from '../../components/FilteredDataTable';

/**
 * BusinessLevel Page
 *
 * Displays and manages meta_business_level table data.
 * Defines business hierarchy levels (Department, Division, Corporate).
 *
 * Database: app.meta_business_level
 * Schema: db/II_meta_business_level.ddl
 */

export const BusinessLevelPage: React.FC = () => {
  return (
    <Layout
      createButton={{
        label: 'Add Business Level',
        href: '/setting/businessLevel/new',
        entityType: 'businessLevel'
      }}
    >
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 p-6 border-b border-gray-200">
          <h1 className="text-sm font-normal text-gray-500">
            Business Hierarchy Levels
          </h1>
          <p className="mt-1 text-xs font-light text-gray-500">
            Organizational hierarchy levels from Department to Division to Corporate
          </p>
        </div>
        <div className="flex-1 overflow-hidden">
          <FilteredDataTable entityType="businessLevel" />
        </div>
      </div>
    </Layout>
  );
};

export default BusinessLevelPage;