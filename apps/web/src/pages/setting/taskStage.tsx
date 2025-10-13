import React from 'react';
import { Layout } from '../../components/layout/Layout';
import { FilteredDataTable } from '../../components/FilteredDataTable';

/**
 * TaskStage Page
 *
 * Displays and manages meta_task_stage table data.
 * Defines task workflow stages (Backlog, To Do, In Progress, In Review, Blocked, Done, Cancelled).
 *
 * Database: app.meta_task_stage
 * Schema: db/IV_meta_task_stage.ddl
 */

export const TaskStagePage: React.FC = () => {
  return (
    <Layout
      createButton={{
        label: 'Add Task Stage',
        href: '/setting/taskStage/new',
        entityType: 'taskStage'
      }}
    >
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 p-6 border-b border-gray-200">
          <h1 className="text-sm font-normal text-gray-500">
            Task Workflow Stages
          </h1>
          <p className="mt-1 text-xs font-light text-gray-500">
            Task lifecycle stages with UI color coding for task management
          </p>
        </div>
        <div className="flex-1 overflow-hidden">
          <FilteredDataTable entityType="taskStage" />
        </div>
      </div>
    </Layout>
  );
};

export default TaskStagePage;