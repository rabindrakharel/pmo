import React from 'react';
import { MetaDataTable } from '../../components/meta/MetaDataTable';

/**
 * TaskStatus Page
 *
 * Displays and manages task status configuration data.
 * Defines task workflow states for task management.
 */

export const TaskStatusPage: React.FC = () => {
  return (
    <MetaDataTable
      entityType="taskStatus"
      title="Task Status"
      description="Task status workflow states for task management"
      createLabel="Add Task Status"
    />
  );
};

export default TaskStatusPage;