import React from 'react';
import { EntityListOfInstancesPage } from './shared';

/**
 * RBAC Overview & Management Page
 * Combines overview statistics with inline-editable permission table
 * Uses universal EntityListOfInstancesPage with entityCode="rbac"
 */
export function RBACOverviewPage() {
  return <EntityListOfInstancesPage entityCode="rbac" />;
}
