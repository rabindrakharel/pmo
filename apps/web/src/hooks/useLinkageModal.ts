import { useState, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type LinkageMode = 'assign-parent' | 'manage-children';

export interface UseLinkageModalOptions {
  onLinkageChange?: () => void;
}

export interface LinkageModalState {
  isOpen: boolean;
  mode: LinkageMode;
  childEntityType?: string;
  childEntityId?: string;
  childEntityName?: string;
  parentEntityType?: string;
  parentEntityId?: string;
  parentEntityName?: string;
  allowedEntityTypes?: string[];
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Custom hook for managing the Unified Linkage Modal state
 *
 * @example
 * // Assign parent to a child entity
 * const linkageModal = useLinkageModal();
 *
 * <Button onClick={() => linkageModal.openAssignParent({
 *   childEntityType: 'task',
 *   childEntityId: task.id,
 *   childEntityName: task.name
 * })}>
 *   Assign to Project
 * </Button>
 *
 * <UnifiedLinkageModal {...linkageModal.modalProps} />
 *
 * @example
 * // Manage children of a parent entity
 * const linkageModal = useLinkageModal({
 *   onLinkageChange: () => refetchChildData()
 * });
 *
 * <Button onClick={() => linkageModal.openManageChildren({
 *   parentEntityType: 'project',
 *   parentEntityId: project.id,
 *   parentEntityName: project.name,
 *   allowedEntityTypes: ['task', 'wiki', 'artifact']
 * })}>
 *   Manage Tasks
 * </Button>
 *
 * <UnifiedLinkageModal {...linkageModal.modalProps} />
 */
export function useLinkageModal(options: UseLinkageModalOptions = {}) {
  const [modalState, setModalState] = useState<LinkageModalState>({
    isOpen: false,
    mode: 'assign-parent'
  });

  /**
   * Open modal in "assign-parent" mode
   * Use this when you want to assign/change the parent of a child entity
   */
  const openAssignParent = useCallback((params: {
    childEntityType: string;
    childEntityId: string;
    childEntityName?: string;
    allowedEntityTypes?: string[];
  }) => {
    setModalState({
      isOpen: true,
      mode: 'assign-parent',
      childEntityType: params.childEntityType,
      childEntityId: params.childEntityId,
      childEntityName: params.childEntityName,
      allowedEntityTypes: params.allowedEntityTypes
    });
  }, []);

  /**
   * Open modal in "manage-children" mode
   * Use this when you want to add/remove children of a parent entity
   */
  const openManageChildren = useCallback((params: {
    parentEntityType: string;
    parentEntityId: string;
    parentEntityName?: string;
    allowedEntityTypes?: string[];
  }) => {
    setModalState({
      isOpen: true,
      mode: 'manage-children',
      parentEntityType: params.parentEntityType,
      parentEntityId: params.parentEntityId,
      parentEntityName: params.parentEntityName,
      allowedEntityTypes: params.allowedEntityTypes
    });
  }, []);

  /**
   * Close the modal
   */
  const close = useCallback(() => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  }, []);

  /**
   * Handle linkage change event
   */
  const handleLinkageChange = useCallback(() => {
    options.onLinkageChange?.();
  }, [options.onLinkageChange]);

  return {
    // State
    isOpen: modalState.isOpen,
    mode: modalState.mode,

    // Actions
    openAssignParent,
    openManageChildren,
    close,

    // Props to spread onto UnifiedLinkageModal
    modalProps: {
      isOpen: modalState.isOpen,
      onClose: close,
      mode: modalState.mode,
      childEntityType: modalState.childEntityType,
      childEntityId: modalState.childEntityId,
      childEntityName: modalState.childEntityName,
      parentEntityType: modalState.parentEntityType,
      parentEntityId: modalState.parentEntityId,
      parentEntityName: modalState.parentEntityName,
      allowedEntityTypes: modalState.allowedEntityTypes,
      onLinkageChange: handleLinkageChange
    }
  };
}
