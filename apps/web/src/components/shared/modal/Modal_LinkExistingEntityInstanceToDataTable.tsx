/**
 * ============================================================================
 * LINK EXISTING ENTITY INSTANCE TO DATATABLE MODAL (v11.1.0)
 * ============================================================================
 *
 * Purpose: Reusable modal for linking existing entities to a parent entity.
 * Used in child entity tabs to link existing records without creating new ones.
 *
 * Features:
 * - Uses EntityListOfInstancesTable for consistent data table styling
 * - Multi-select with checkbox column
 * - Search capability with debounce
 * - Excludes already-linked entities automatically
 * - Bulk link support via API
 * - RBAC-aware (respects VIEW permissions)
 *
 * v11.1.0: Refactored to use EntityListOfInstancesTable component
 *
 * Styling: Adheres to docs/design_pattern/styling_patterns.md (v13.1)
 *
 * Usage:
 * ```tsx
 * <Modal_LinkExistingEntityInstanceToDataTable
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   parentEntity="project"
 *   parentId={projectId}
 *   childEntity="task"
 *   childEntityLabel="Task"
 *   onSuccess={() => refetchChildData()}
 * />
 * ```
 *
 * ============================================================================
 */

import { useState, useCallback, useEffect } from 'react';
import { Link2, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal';
import { apiClient } from '@/lib/api';
import { EntityListOfInstancesTable, type Column } from '../ui/EntityListOfInstancesTable';

// ============================================================================
// TYPES
// ============================================================================

export interface Modal_LinkExistingEntityInstanceToDataTableProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Parent entity type code (e.g., 'project') */
  parentEntity: string;
  /** Parent entity instance UUID */
  parentId: string;
  /** Child entity type code (e.g., 'task') */
  childEntity: string;
  /** Child entity display label (e.g., 'Task') */
  childEntityLabel: string;
  /** Callback after successful linking */
  onSuccess?: () => void;
}

interface LinkableEntity {
  id: string;
  code: string | null;
  name: string;
  descr: string | null;
}

interface LinkResponse {
  success: boolean;
  linked: number;
  skipped: number;
  skippedIds?: string[];
  links?: Array<{ parent_id: string; child_id: string; link_id: string }>;
}

// ============================================================================
// COLUMN DEFINITIONS
// ============================================================================

const COLUMNS: Column<LinkableEntity>[] = [
  {
    key: 'code',
    title: 'Code',
    width: 120,
    render: (value) => (
      <span className="font-mono text-dark-600">{value || '-'}</span>
    ),
  },
  {
    key: 'name',
    title: 'Name',
    width: 200,
    render: (value) => (
      <span className="font-medium text-dark-900 truncate block">{value}</span>
    ),
  },
  {
    key: 'descr',
    title: 'Description',
    render: (value) => (
      <span className="text-dark-500 truncate block" title={value || undefined}>
        {value || '-'}
      </span>
    ),
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function Modal_LinkExistingEntityInstanceToDataTable({
  isOpen,
  onClose,
  parentEntity,
  parentId,
  childEntity,
  childEntityLabel,
  onSuccess
}: Modal_LinkExistingEntityInstanceToDataTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedIds([]);
    }
  }, [isOpen]);

  // ============================================================================
  // DATA FETCHING - Get linkable entities (fetch all, filter client-side via table)
  // ============================================================================
  const {
    data: entities = [],
    isLoading,
    error
  } = useQuery<LinkableEntity[]>({
    queryKey: ['linkable-entities', parentEntity, parentId, childEntity],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: LinkableEntity[] }>(
        `/api/v1/${parentEntity}/${parentId}/${childEntity}/linkable`,
        { params: { limit: 100 } }  // API max limit is 100
      );
      return response.data?.data || [];
    },
    enabled: isOpen && !!parentEntity && !!parentId && !!childEntity,
    staleTime: 30000, // 30 seconds
  });

  // ============================================================================
  // MUTATION - Bulk link entities
  // ============================================================================
  const linkMutation = useMutation<LinkResponse, Error, string[]>({
    mutationFn: async (entityIds: string[]) => {
      const response = await apiClient.post<LinkResponse>(
        `/api/v1/${parentEntity}/${parentId}/${childEntity}/link`,
        { entityIds }
      );
      return response.data;
    },
    onSuccess: (result) => {
      // Log success (no toast library in codebase)
      if (result.linked > 0) {
        console.log(`✅ Linked ${result.linked} ${childEntityLabel}${result.linked > 1 ? 's' : ''}`);
      }
      if (result.skipped > 0) {
        console.log(`ℹ️ ${result.skipped} already linked (skipped)`);
      }

      // Invalidate relevant caches
      queryClient.invalidateQueries({
        queryKey: ['entity-list', childEntity]
      });
      queryClient.invalidateQueries({
        queryKey: ['linkable-entities', parentEntity, parentId, childEntity]
      });

      // Call success callback
      onSuccess?.();

      // Close modal
      onClose();
    },
    onError: (error) => {
      alert(`Failed to link: ${error.message}`);
    }
  });

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleSelectionChange = useCallback((newSelectedIds: string[]) => {
    setSelectedIds(newSelectedIds);
  }, []);

  const handleLink = useCallback(() => {
    if (selectedIds.length === 0) return;
    linkMutation.mutate(selectedIds);
  }, [selectedIds, linkMutation]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  // Footer buttons using Modal's footer prop pattern
  const footerContent = (
    <>
      <button
        onClick={onClose}
        className="px-4 py-2 text-sm font-medium text-dark-700 bg-white border border-dark-300 rounded-md hover:bg-dark-50 transition-colors focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none"
      >
        Cancel
      </button>
      <button
        onClick={handleLink}
        disabled={selectedIds.length === 0 || linkMutation.isPending}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:outline-none"
      >
        {linkMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Link2 className="h-4 w-4" />
        )}
        Link{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
      </button>
    </>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Link Existing ${childEntityLabel}`}
      size="lg"
      footer={footerContent}
    >
      <div className="space-y-3">
        {/* Entity Data Table with selection, search, and filter */}
        <EntityListOfInstancesTable
          data={entities}
          columns={COLUMNS}
          loading={isLoading}
          selectable={true}
          selectedRows={selectedIds}
          onSelectionChange={handleSelectionChange}
          searchable={true}
          filterable={true}
          columnSelection={false}
          showDefaultActions={false}
          density="compact"
          className="max-h-[400px]"
          rowKey="id"
        />

        {/* Summary & Help */}
        {!isLoading && (
          <div className="text-xs text-dark-500 text-center space-y-1">
            {error ? (
              <span className="text-red-500">Failed to load {childEntityLabel.toLowerCase()}s</span>
            ) : entities.length === 0 ? (
              <span>All {childEntityLabel.toLowerCase()}s are already linked</span>
            ) : (
              <>
                <div className="text-dark-700">
                  {entities.length} {childEntityLabel.toLowerCase()}{entities.length !== 1 ? 's' : ''} available
                  {selectedIds.length > 0 && ` • ${selectedIds.length} selected`}
                </div>
                <div className="text-dark-400">
                  <kbd className="px-1 py-0.5 bg-dark-100 border border-dark-200 rounded text-[10px]">Ctrl</kbd>+Click to select • <kbd className="px-1 py-0.5 bg-dark-100 border border-dark-200 rounded text-[10px]">Ctrl</kbd>+<kbd className="px-1 py-0.5 bg-dark-100 border border-dark-200 rounded text-[10px]">Shift</kbd>+↑↓ to extend
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

export default Modal_LinkExistingEntityInstanceToDataTable;
