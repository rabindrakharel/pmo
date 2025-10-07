import React from 'react';
import { MetaDataTable } from '../../components/meta/MetaDataTable';

/**
 * OrgLevel Page (Office Level)
 *
 * Displays and manages meta_office_level table data.
 * Defines office hierarchy levels (Office, District, Region, Corporate).
 *
 * Database: app.meta_office_level
 * Schema: db/I_meta_office_level.ddl
 */

export const OrgLevelPage: React.FC = () => {
  return (
    <MetaDataTable
      entityType="orgLevel"
      title="Office Hierarchy Levels"
      description="Geographic hierarchy levels from Office to District to Region to Corporate"
      createLabel="Add Office Level"
    />
  );
};

export default OrgLevelPage;