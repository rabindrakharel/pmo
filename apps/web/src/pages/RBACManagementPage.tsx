import React from 'react';
import { EntityMainPage } from './shared';

/**
 * RBAC Management Page
 * Uses the universal EntityMainPage with entityType="rbac"
 * Provides inline editing, filtering, and CRUD operations for permissions
 */
export function RBACManagementPage() {
  return <EntityMainPage entityType="rbac" />;
}
