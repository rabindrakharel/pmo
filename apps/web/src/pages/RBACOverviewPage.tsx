import React from 'react';
import { EntityMainPage } from './shared';

/**
 * RBAC Overview & Management Page
 * Combines overview statistics with inline-editable permission table
 * Uses universal EntityMainPage with entityCode="rbac"
 */
export function RBACOverviewPage() {
  return <EntityMainPage entityCode="rbac" />;
}
