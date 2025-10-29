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
export { ExitButton } from './button/ExitButton';
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
export { MetadataField, MetadataRow, MetadataSeparator } from '../../lib/data_transform_render';

// ============================================================================
// FILE COMPONENTS
// ============================================================================
export { FilePreview } from './file/FilePreview';
export { DragDropFileUpload } from './file/DragDropFileUpload';

// ============================================================================
// SEARCH COMPONENTS
// ============================================================================
export { ScopeFilters } from './search/ScopeFilters';

// ============================================================================
// SHARE COMPONENTS
// ============================================================================
export { ShareURLSection } from './share/ShareURLSection';

// ============================================================================
// SETTINGS COMPONENTS
// ============================================================================
// LinkageManager removed - use UnifiedLinkageModal instead

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
// EditableTags component removed - tags field no longer in use
// export { EditableTags } from './ui/EditableTags';
export { GridView } from './ui/GridView';
export { KanbanBoard } from './ui/KanbanBoard';
export { TreeView } from './ui/TreeView';

// ============================================================================
// MODAL COMPONENTS
// ============================================================================
export { EntityEditModal } from './modal/EntityEditModal';

// ============================================================================
// DESIGNER COMPONENTS - Unified Design System
// ============================================================================
export { UniversalDesigner } from './designer/UniversalDesigner';
export type { UniversalDesignerProps, DesignerViewMode, DesignerAction } from './designer/UniversalDesigner';

export { UniversalBlock, UniversalBlockContainer } from './designer/UniversalBlock';
export type { UniversalBlockProps, UniversalBlockContainerProps } from './designer/UniversalBlock';

export {
  InlineText,
  InlineTextarea,
  InlineSelect,
  InlineNumber,
  InlineDate,
} from './designer/InlineEdit';
