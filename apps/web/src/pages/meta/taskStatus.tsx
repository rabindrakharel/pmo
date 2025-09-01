import React from 'react';
import { MetaDataTable } from '../../components/MetaDataTable';

export const TaskStatusPage: React.FC = () => {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 p-6 border-b border-gray-200">
        <h1 className="text-2xl font-semibold text-gray-900">
          taskStatus
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Task status workflow states for task management
        </p>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <MetaDataTable entityType="taskStatus" />
      </div>
    </div>
  );
};

export default TaskStatusPage;