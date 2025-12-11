/**
 * RBAC Components
 * Role-Only RBAC Model v2.3.0
 *
 * Simplified component structure:
 * - HierarchicalRbacMatrix: Main permission matrix with entity sections
 * - EntityPermissionSection: Individual entity type section
 * - PermissionMatrixTable: Reusable matrix table with rotated headers
 * - GrantPermissionModal: Modal to grant new permissions
 * - PermissionLevelSelector: Permission level selection/display
 * - InheritanceModeSelector: Inheritance mode selection
 * - ChildPermissionMapper: Child entity permission configuration
 * - RoleAccessControlPanel: Simplified panel for role detail page
 */

// Permission Level
export { PermissionLevelSelector, PermissionBadge, getPermissionLabel, getPermissionColor, PERMISSION_LEVELS } from './PermissionLevelSelector';

// Inheritance Mode
export { InheritanceModeSelector, InheritanceModeBadge } from './InheritanceModeSelector';
export type { InheritanceMode } from './InheritanceModeSelector';

// Child Permission Mapping
export { ChildPermissionMapper } from './ChildPermissionMapper';

// Permission Matrix Components
export { HierarchicalRbacMatrix, HierarchicalRbacMatrixSkeleton } from './HierarchicalRbacMatrix';
export { PermissionMatrixTable, PermissionMatrixTableSkeleton } from './PermissionMatrixTable';
export { EntityPermissionSection } from './EntityPermissionSection';

// Modals
export { GrantPermissionModal } from './GrantPermissionModal';

// Panels
export { RoleAccessControlPanel } from './RoleAccessControlPanel';
