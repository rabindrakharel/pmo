/**
 * ============================================================================
 * LINK EXISTING ENTITY INSTANCE TO DATATABLE MODAL (v11.0.0)
 * ============================================================================
 *
 * Purpose: Reusable modal for linking existing entities to a parent entity.
 * Used in child entity tabs to link existing records without creating new ones.
 *
 * Features:
 * - Multi-select with search capability
 * - Displays: code, name, description (universal entity fields)
 * - Excludes already-linked entities automatically
 * - Bulk link support via API
 * - RBAC-aware (respects VIEW permissions)
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

import React, { useState, useCallback, useEffect } from 'react';
import { Search, Link2, Loader2, Check } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal';
import { apiClient } from '@/lib/api';

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
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIds(new Set());
    }
  }, [isOpen]);

  // ============================================================================
  // DATA FETCHING - Get linkable entities
  // ============================================================================
  const {
    data: entities = [],
    isLoading,
    error
  } = useQuery<LinkableEntity[]>({
    queryKey: ['linkable-entities', parentEntity, parentId, childEntity, search],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: LinkableEntity[] }>(
        `/api/v1/${parentEntity}/${parentId}/${childEntity}/linkable`,
        { params: { search: search || undefined, limit: 50 } }
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

  const handleToggle = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === entities.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(entities.map(e => e.id)));
    }
  }, [entities, selectedIds.size]);

  const handleLink = useCallback(() => {
    if (selectedIds.size === 0) return;
    linkMutation.mutate(Array.from(selectedIds));
  }, [selectedIds, linkMutation]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  }, []);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const allSelected = entities.length > 0 && selectedIds.size === entities.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < entities.length;

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
        disabled={selectedIds.size === 0 || linkMutation.isPending}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:outline-none"
      >
        {linkMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Link2 className="h-4 w-4" />
        )}
        Link{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
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
      size="md"
      footer={footerContent}
    >
      <div className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-400" />
          <input
            type="text"
            placeholder={`Search ${childEntityLabel.toLowerCase()}s...`}
            value={search}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 text-sm border border-dark-300 rounded-md focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-none bg-white text-dark-900 placeholder:text-dark-400"
            autoFocus
          />
        </div>

        {/* Select All Header */}
        {entities.length > 0 && (
          <div className="flex items-center gap-3 py-2 border-b border-dark-200">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-2 text-sm text-dark-600 hover:text-dark-900 transition-colors"
            >
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  allSelected
                    ? 'bg-blue-600 border-blue-600'
                    : someSelected
                    ? 'bg-blue-100 border-blue-400'
                    : 'border-dark-300 bg-white'
                }`}
              >
                {(allSelected || someSelected) && (
                  <Check className={`h-3 w-3 ${allSelected ? 'text-white' : 'text-blue-600'}`} />
                )}
              </div>
              <span>
                {allSelected ? 'Deselect all' : 'Select all'} ({entities.length})
              </span>
            </button>
          </div>
        )}

        {/* Entity List */}
        <div className="max-h-[300px] overflow-y-auto space-y-1 -mx-2 px-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-dark-400" />
              <span className="ml-2 text-sm text-dark-500">Loading...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-500">
              <p className="text-sm">Failed to load {childEntityLabel.toLowerCase()}s</p>
              <p className="text-xs mt-1">{(error as Error).message}</p>
            </div>
          ) : entities.length === 0 ? (
            <div className="text-center py-12 text-dark-500">
              <Link2 className="h-8 w-8 mx-auto mb-2 text-dark-300" />
              <p className="text-sm">
                {search
                  ? `No ${childEntityLabel.toLowerCase()}s found matching "${search}"`
                  : `All ${childEntityLabel.toLowerCase()}s are already linked`}
              </p>
            </div>
          ) : (
            entities.map((entity) => {
              const isSelected = selectedIds.has(entity.id);
              return (
                <button
                  key={entity.id}
                  onClick={() => handleToggle(entity.id)}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors ${
                    isSelected
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-dark-50 border border-transparent'
                  }`}
                >
                  {/* Checkbox */}
                  <div
                    className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600'
                        : 'border-dark-300 bg-white'
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3 text-white" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {entity.code && (
                        <span className="text-xs font-mono text-dark-500 bg-dark-100 px-1.5 py-0.5 rounded flex-shrink-0">
                          {entity.code}
                        </span>
                      )}
                      <span className="font-medium text-dark-900 truncate">
                        {entity.name}
                      </span>
                    </div>
                    {entity.descr && (
                      <p className="text-sm text-dark-500 truncate mt-0.5">
                        {entity.descr}
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Selection Summary */}
        {selectedIds.size > 0 && (
          <div className="text-xs text-dark-500 text-center pt-2 border-t border-dark-200">
            {selectedIds.size} {childEntityLabel.toLowerCase()}{selectedIds.size > 1 ? 's' : ''} selected
          </div>
        )}
      </div>
    </Modal>
  );
}

export default Modal_LinkExistingEntityInstanceToDataTable;
