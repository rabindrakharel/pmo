import React from 'react';
import { Layout } from '../../components/layout/Layout';
import { FilteredDataTable } from '../../components/FilteredDataTable';

/**
 * ProjectStatus Page
 *
 * Displays and manages project status configuration data.
 * Defines project workflow states and status progression.
 */

export const ProjectStatusPage: React.FC = () => {
  return (
    <Layout
      createButton={{
        label: 'Add Project Status',
        href: '/setting/projectStatus/new',
        entityType: 'projectStatus'
      }}
    >
      <div className="flex flex-col h-full">
        {/* Page Header */}
        <div className="flex-shrink-0 p-6 border-b border-gray-200">
          <h1 className="text-sm font-normal text-gray-500">
            Project Status
          </h1>
          <p className="mt-1 text-xs font-light text-gray-500">
            Manage project workflow states and status progression
          </p>
        </div>

        {/* Data Table - Scrollable content area */}
        <div className="flex-1 overflow-hidden">
          <FilteredDataTable entityType="projectStatus" />
        </div>
      </div>
    </Layout>
  );
};

export default ProjectStatusPage;