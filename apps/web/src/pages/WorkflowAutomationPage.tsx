import React from 'react';
import { EntityMainPage } from './shared';

/**
 * Workflow Automation Page
 *
 * Uses the universal EntityMainPage component with workflow_automation entity configuration.
 * Displays workflows in table format with columns for:
 * - Workflow Name & Description
 * - Active/Inactive Status
 * - Trigger Entity & Action Type
 * - Action Entity
 * - Execution Count
 * - Last Executed Date
 *
 * Supports full CRUD operations via the entity configuration system.
 */
export function WorkflowAutomationPage() {
  return <EntityMainPage entityType="workflow_automation" />;
}
