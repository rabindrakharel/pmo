/**
 * Shared Components
 *
 * Reusable components used across multiple entities and pages.
 * Organized by functionality for better maintainability.
 */

// ============================================================================
// BUTTON COMPONENTS
// ============================================================================
export { EditButton, ShareButton, SaveButton, BackButton, CancelButton } from './button/ActionButtons';
export { ActionButtonsBar } from './button/ActionButtonsBar';
export { Button } from './button/Button';
export { CreateButton } from './button/CreateButton';
export { RBACButton } from './button/RBACButton';

// ============================================================================
// DATA TABLE COMPONENTS
// ============================================================================
export { EntityAssignmentDataTable } from './dataTable/EntityAssignmentDataTable';
export { FilteredDataTable } from './dataTable/FilteredDataTable';

// ============================================================================
// ENTITY COMPONENTS
// ============================================================================
export { DynamicChildEntityTabs, useDynamicChildEntityTabs } from './entity/DynamicChildEntityTabs';
export { EntityFormContainer } from './entity/EntityFormContainer';

// ============================================================================
// SEARCH COMPONENTS
// ============================================================================
export { ScopeFilters } from './search/ScopeFilters';

// ============================================================================
// SETTINGS COMPONENTS
// ============================================================================
export { LinkageManager } from './settings/LinkageManager';

// ============================================================================
// TOGGLE COMPONENTS
// ============================================================================
export { FloatingFullscreenToggle } from './toggle/FloatingFullscreenToggle';
export { FullscreenToggle } from './toggle/FullscreenToggle';

// ============================================================================
// VIEW COMPONENTS
// ============================================================================
export { InlineEditField } from './view/InlineEditField';
export { StatsGrid } from './view/StatsGrid';
export { ViewSwitcher } from './view/ViewSwitcher';

// ============================================================================
// AUTH COMPONENTS
// ============================================================================
export { LoginForm } from './auth/LoginForm';

// ============================================================================
// LAYOUT COMPONENTS
// ============================================================================
export { Layout } from './layout/Layout';

// ============================================================================
// EDITOR COMPONENTS
// ============================================================================
export { CodeBlock } from './editor/CodeBlock';
export { ModularEditor } from './editor/ModularEditor';

// ============================================================================
// UI COMPONENTS
// ============================================================================
export { DataTable } from './ui/DataTable';
export { GridView } from './ui/GridView';
export { KanbanBoard } from './ui/KanbanBoard';
export { TreeView } from './ui/TreeView';

// ============================================================================
// MODAL COMPONENTS
// ============================================================================
export { EntityEditModal } from './modal/EntityEditModal';
