import React from 'react';
import { MetaDataTable } from '../../components/meta/MetaDataTable';

/**
 * PositionLevel Page
 *
 * Displays and manages meta_position_level table data.
 * Defines organizational position hierarchy levels from CEO/President to Associate Director.
 *
 * Database: app.meta_position_level
 * Schema: db/VI_meta_position_level.ddl
 */

export const PositionLevelPage: React.FC = () => {
  return (
    <MetaDataTable
      entityType="positionLevel"
      title="Position Hierarchy Levels"
      description="Organizational authority levels and career progression paths from CEO to Associate Director"
      createLabel="Add Position Level"
    />
  );
};

export default PositionLevelPage;
