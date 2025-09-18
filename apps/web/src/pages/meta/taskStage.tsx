import React from 'react';
import { Layout } from '../../components/layout/Layout';
import { FilteredDataTable } from '../../components/FilteredDataTable';

export const TaskStagePage: React.FC = () => {
  return (
    <Layout
      createButton={{
        label: "Add Task Stage",
        href: "/meta/taskStage/new"
      }}
    >
      <div className="flex flex-col h-full">
      <div className="flex-shrink-0 p-6 border-b border-gray-200">
        <h1 className="text-2xl font-semibold text-gray-900">
          Task Stage
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Task workflow stages for task lifecycle management
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