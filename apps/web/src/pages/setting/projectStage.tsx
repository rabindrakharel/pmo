import React from 'react';
import { MetaDataTable } from '../../components/meta/MetaDataTable';

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
    <MetaDataTable
      entityType="projectStage"
      title="Project Lifecycle Stages"
      description="Project workflow stages with UI color coding for phase management"
      createLabel="Add Project Stage"
    />
  );
};

export default ProjectStagePage;