import React from 'react';
import { Layout } from '../../components/layout/Layout';
import { FilteredDataTable } from '../../components/FilteredDataTable';

/**
 * ProjectStage Page
 *
 * Displays and manages meta_project_stage table data.
 * Defines project lifecycle stages (Initiation, Planning, Execution, Monitoring, Closure, On Hold, Cancelled).
 *
 * Database: app.meta_project_stage
 * Schema: db/III_meta_project_stage.ddl
 */

export const ProjectStagePage: React.FC = () => {
  return (
    <Layout
      createButton={{
        label: 'Add Project Stage',
        href: '/setting/projectStage/new',
        entityType: 'projectStage'
      }}
    >
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 p-6 border-b border-gray-200">
          <h1 className="text-sm font-normal text-gray-500">
            Project Lifecycle Stages
          </h1>
          <p className="mt-1 text-xs font-light text-gray-500">
            Project workflow stages with UI color coding for phase management
          </p>
        </div>
        <div className="flex-1 overflow-hidden">
          <FilteredDataTable
            entityType="projectStage"
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

export default ProjectStagePage;