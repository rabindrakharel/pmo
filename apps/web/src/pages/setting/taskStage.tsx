import React from 'react';
import { MetaDataTable } from '../../components/meta/MetaDataTable';

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
    <MetaDataTable
      entityType="taskStage"
      title="Task Workflow Stages"
      description="Task lifecycle stages with UI color coding for task management"
      createLabel="Add Task Stage"
    />
  );
};

export default TaskStagePage;