import React from 'react';
import { Layout } from '../../components/layout/Layout';
import { FilteredDataTable } from '../../components/FilteredDataTable';

/**
 * HrLevel Page
 *
 * Displays and manages HR hierarchy level configuration data.
 * Defines human resources hierarchy levels with salary bands and management indicators.
 */

export const HrLevelPage: React.FC = () => {
  return (
    <Layout
      createButton={{
        label: 'Add HR Level',
        href: '/setting/hrLevel/new',
        entityType: 'hrLevel'
      }}
    >
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 p-6 border-b border-gray-200">
          <h1 className="text-sm font-normal text-gray-500">
            HR Hierarchy Levels
          </h1>
          <p className="mt-1 text-xs font-light text-gray-500">
            Human resources hierarchy levels with salary bands and management indicators
          </p>
        </div>
        <div className="flex-1 overflow-hidden">
          <FilteredDataTable
            entityType="hrLevel"
            inlineEditable={true}
            showEditIcon={true}
            showDeleteIcon={true}
            showActionIcons={false}
          />
        </div>
      </div>
    </Layout>
  );
};

export default HrLevelPage;