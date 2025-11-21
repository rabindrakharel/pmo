import React from 'react';
import { EntityListOfInstancesPage } from './shared';

/**
 * RBAC Management Page
 * Uses the universal EntityListOfInstancesPage with entityCode="rbac"
 * Provides inline editing, filtering, and CRUD operations for permissions
 */
export function RBACManagementPage() {
  return <EntityListOfInstancesPage entityCode="rbac" />;
}
