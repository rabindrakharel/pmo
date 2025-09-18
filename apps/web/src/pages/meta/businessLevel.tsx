import React from 'react';
import { Layout } from '../../components/layout/Layout';
import { FilteredDataTable } from '../../components/FilteredDataTable';

export const BusinessLevelPage: React.FC = () => {
  return (
    <Layout
      createButton={{
        label: "Add Business Level",
        href: "/meta/businessLevel/new"
      }}
    >
      <div className="flex flex-col h-full">
      <div className="flex-shrink-0 p-6 border-b border-gray-200">
        <h1 className="text-2xl font-semibold text-gray-900">
          Business Level
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Organizational hierarchy levels for business unit structure
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