import React from 'react';
import { Layout } from '../../components/layout/Layout';
import { FilteredDataTable } from '../../components/FilteredDataTable';

/**
 * OrgLevel Page (Office Level)
 *
 * Displays and manages meta_office_level table data.
 * Defines office hierarchy levels (Office, District, Region, Corporate).
 *
 * Database: app.meta_office_level
 * Schema: db/I_meta_office_level.ddl
 */

export const OrgLevelPage: React.FC = () => {
  return (
    <Layout
      createButton={{
        label: 'Add Office Level',
        href: '/setting/orgLevel/new',
        entityType: 'orgLevel'
      }}
    >
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 p-6 border-b border-gray-200">
          <h1 className="text-sm font-normal text-gray-500">
            Office Hierarchy Levels
          </h1>
          <p className="mt-1 text-xs font-light text-gray-500">
            Geographic hierarchy levels from Office to District to Region to Corporate
          </p>
        </div>
        <div className="flex-1 overflow-hidden">
          <FilteredDataTable entityType="orgLevel" />
        </div>
      </div>
    </Layout>
  );
};

export default OrgLevelPage;