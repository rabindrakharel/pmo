import React from 'react';
import { MetaDataTable } from '../../components/meta/MetaDataTable';

/**
 * ProjectStatus Page
 *
 * Displays and manages project status configuration data.
 * Defines project workflow states and status progression.
 */

export const ProjectStatusPage: React.FC = () => {
  return (
    <MetaDataTable
      entityType="projectStatus"
      title="Project Status"
      description="Manage project workflow states and status progression"
      createLabel="Add Project Status"
    />
  );
};

export default ProjectStatusPage;