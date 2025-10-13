import React from 'react';
import { Layout } from '../../components/layout/Layout';
import { FilteredDataTable } from '../../components/FilteredDataTable';

/**
 * TaskStatus Page
 *
 * Displays and manages task status configuration data.
 * Defines task workflow states for task management.
 */

export const TaskStatusPage: React.FC = () => {
  return (
    <Layout
      createButton={{
        label: 'Add Task Status',
        href: '/setting/taskStatus/new',
        entityType: 'taskStatus'
      }}
    >
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 p-6 border-b border-gray-200">
          <h1 className="text-sm font-normal text-gray-500">
            Task Status
          </h1>
          <p className="mt-1 text-xs font-light text-gray-500">
            Task status workflow states for task management
          </p>
        </div>
        <div className="flex-1 overflow-hidden">
          <FilteredDataTable entityType="taskStatus" />
        </div>
      </div>
    </Layout>
  );
};

export default TaskStatusPage;