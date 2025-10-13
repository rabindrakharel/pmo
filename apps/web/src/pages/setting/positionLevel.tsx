import React from 'react';
import { Layout } from '../../components/layout/Layout';
import { FilteredDataTable } from '../../components/FilteredDataTable';

/**
 * PositionLevel Page
 *
 * Displays and manages meta_position_level table data.
 * Defines organizational position hierarchy levels from CEO/President to Associate Director.
 *
 * Database: app.meta_position_level
 * Schema: db/VI_meta_position_level.ddl
 */

export const PositionLevelPage: React.FC = () => {
  return (
    <Layout
      createButton={{
        label: 'Add Position Level',
        href: '/setting/positionLevel/new',
        entityType: 'positionLevel'
      }}
    >
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 p-6 border-b border-gray-200">
          <h1 className="text-sm font-normal text-gray-500">
            Position Hierarchy Levels
          </h1>
          <p className="mt-1 text-xs font-light text-gray-500">
            Organizational authority levels and career progression paths from CEO to Associate Director
          </p>
        </div>
        <div className="flex-1 overflow-hidden">
          <FilteredDataTable
            entityType="positionLevel"
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

export default PositionLevelPage;
