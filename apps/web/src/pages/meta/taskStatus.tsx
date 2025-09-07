import React from 'react';
import { Layout } from '../../components/layout/Layout';
import { MetaDataTable } from '../../components/MetaDataTable';

export const TaskStatusPage: React.FC = () => {
  return (
    <Layout
      createButton={{
        label: "Add Task Status",
        href: "/meta/taskStatus/new"
      }}
    >
      <div className="flex flex-col h-full">
      <div className="flex-shrink-0 p-6 border-b border-gray-200">
        <h1 className="text-2xl font-semibold text-gray-900">
          Task Status
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Task status workflow states for task management
        </p>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <MetaDataTable entityType="taskStatus" />
      </div>
    </div>
    </Layout>
  );
};

export default TaskStatusPage;