import React from 'react';
import { Layout } from '../../components/layout/Layout';
import { FilteredDataTable } from '../../components/FilteredDataTable';

export const LocationLevelPage: React.FC = () => {
  return (
    <Layout
      createButton={{
        label: "Add Location Level",
        href: "/meta/locationLevel/new"
      }}
    >
      <div className="flex flex-col h-full">
      <div className="flex-shrink-0 p-6 border-b border-gray-200">
        <h1 className="text-2xl font-semibold text-gray-900">
          Location Level
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Geographic hierarchy levels for location organization structure
        </p>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <FilteredDataTable entityType="locationLevel" />
      </div>
    </div>
    </Layout>
  );
};

export default LocationLevelPage;