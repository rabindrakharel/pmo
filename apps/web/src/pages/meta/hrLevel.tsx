import React from 'react';
import { Layout } from '../../components/layout/Layout';
import { FilteredDataTable } from '../../components/FilteredDataTable';

export const HrLevelPage: React.FC = () => {
  return (
    <Layout
      createButton={{
        label: "Add HR Level",
        href: "/meta/hrLevel/new"
      }}
    >
      <div className="flex flex-col h-full">
      <div className="flex-shrink-0 p-6 border-b border-gray-200">
        <h1 className="text-2xl font-semibold text-gray-900">
          HR Level
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Human resources hierarchy levels with salary bands and management indicators
        </p>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <FilteredDataTable entityType="hrLevel" />
      </div>
    </div>
    </Layout>
  );
};

export default HrLevelPage;