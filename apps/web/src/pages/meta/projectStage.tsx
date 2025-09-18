import React from 'react';
import { Layout } from '../../components/layout/Layout';
import { FilteredDataTable } from '../../components/FilteredDataTable';

export const ProjectStagePage: React.FC = () => {
  return (
    <Layout
      createButton={{
        label: "Add Project Stage",
        href: "/meta/projectStage/new"
      }}
    >
      <div className="flex flex-col h-full">
      <div className="flex-shrink-0 p-6 border-b border-gray-200">
        <h1 className="text-2xl font-semibold text-gray-900">
          Project Stage
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Project lifecycle stages for project phase management
        </p>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <FilteredDataTable entityType="projectStage" />
      </div>
    </div>
    </Layout>
  );
};

export default ProjectStagePage;