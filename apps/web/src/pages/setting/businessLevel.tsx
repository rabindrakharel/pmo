import React from 'react';
import { MetaDataTable } from '../../components/meta/MetaDataTable';

/**
 * BusinessLevel Page
 *
 * Displays and manages meta_business_level table data.
 * Defines business hierarchy levels (Department, Division, Corporate).
 *
 * Database: app.meta_business_level
 * Schema: db/II_meta_business_level.ddl
 */

export const BusinessLevelPage: React.FC = () => {
  return (
    <MetaDataTable
      entityType="businessLevel"
      title="Business Hierarchy Levels"
      description="Organizational hierarchy levels from Department to Division to Corporate"
      createLabel="Add Business Level"
    />
  );
};

export default BusinessLevelPage;