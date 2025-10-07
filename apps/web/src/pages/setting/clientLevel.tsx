import React from 'react';
import { MetaDataTable } from '../../components/meta/MetaDataTable';

/**
 * ClientLevel Page
 *
 * Displays and manages meta_client_level table data.
 * Defines client organization hierarchy levels (CEO, Director, Senior Manager, Manager, Technical Lead).
 *
 * Database: app.meta_client_level
 * Schema: db/V_meta_client_level.ddl
 */

export const ClientLevelPage: React.FC = () => {
  return (
    <MetaDataTable
      entityType="clientLevel"
      title="Client Hierarchy Levels"
      description="Client organization authority structure from CEO to Technical Lead for engagement management"
      createLabel="Add Client Level"
    />
  );
};

export default ClientLevelPage;
