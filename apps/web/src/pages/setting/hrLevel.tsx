import React from 'react';
import { MetaDataTable } from '../../components/meta/MetaDataTable';

/**
 * HrLevel Page
 *
 * Displays and manages HR hierarchy level configuration data.
 * Defines human resources hierarchy levels with salary bands and management indicators.
 */

export const HrLevelPage: React.FC = () => {
  return (
    <MetaDataTable
      entityType="hrLevel"
      title="HR Hierarchy Levels"
      description="Human resources hierarchy levels with salary bands and management indicators"
      createLabel="Add HR Level"
    />
  );
};

export default HrLevelPage;