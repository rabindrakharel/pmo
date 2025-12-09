/**
 * ============================================================================
 * DELETE OR UNLINK MODAL (v9.5.0)
 * ============================================================================
 *
 * Purpose: Provides context-aware removal options in child entity tabs.
 * When removing a child from a parent context, user chooses between:
 *
 * 1. UNLINK: Remove relationship only (child entity remains in system)
 *    - Deletes entity_instance_link record
 *    - Requires EDIT permission on parent
 *
 * 2. DELETE: Permanently delete the child entity
 *    - Deletes primary table + entity_instance + links + rbac
 *    - Requires DELETE permission on child
 *
 * ============================================================================
 */

import React, { useState } from 'react';
import { X, Link2Off, Trash2, AlertTriangle } from 'lucide-react';

export interface ParentContext {
  entityCode: string;
  entityId: string;
  entityName?: string;
}

interface DeleteOrUnlinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentContext: ParentContext;
  childEntity: string;
  childEntityName: string;
  childEntityId: string;
  onUnlink: () => Promise<void>;
  onDelete: () => Promise<void>;
}

export const DeleteOrUnlinkModal: React.FC<DeleteOrUnlinkModalProps> = ({
  isOpen,
  onClose,
  parentContext,
  childEntity,
  childEntityName,
  childEntityId,
  onUnlink,
  onDelete,
}) => {
  const [selectedAction, setSelectedAction] = useState<'unlink' | 'delete'>('unlink');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      if (selectedAction === 'unlink') {
        await onUnlink();
      } else {
        await onDelete();
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Operation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const parentLabel = parentContext.entityName
    ? `"${parentContext.entityName}"`
    : `this ${parentContext.entityCode}`;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-xl shadow-2xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-dark-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-dark-800">
                Remove {childEntity}
              </h2>
            </div>
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="p-1.5 hover:bg-dark-100 rounded-md focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none transition-colors disabled:opacity-50"
            >
              <X className="h-5 w-5 text-dark-500" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-4">
            <p className="text-dark-600 text-sm">
              You are removing <span className="font-medium text-dark-800">"{childEntityName}"</span> from {parentLabel}.
              Choose how you want to remove it:
            </p>

            {/* Option: Unlink */}
            <label
              className={`
                block p-4 rounded-lg border-2 cursor-pointer transition-all
                ${selectedAction === 'unlink'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-dark-200 hover:border-dark-300 bg-white'
                }
              `}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="action"
                  value="unlink"
                  checked={selectedAction === 'unlink'}
                  onChange={() => setSelectedAction('unlink')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Link2Off className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-dark-800">Unlink Only</span>
                  </div>
                  <p className="text-sm text-dark-500 mt-1">
                    Remove the connection between this {childEntity} and {parentLabel}.
                    The {childEntity} will remain in the system and can be linked to other entities.
                  </p>
                </div>
              </div>
            </label>

            {/* Option: Delete */}
            <label
              className={`
                block p-4 rounded-lg border-2 cursor-pointer transition-all
                ${selectedAction === 'delete'
                  ? 'border-red-500 bg-red-50'
                  : 'border-dark-200 hover:border-dark-300 bg-white'
                }
              `}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="action"
                  value="delete"
                  checked={selectedAction === 'delete'}
                  onChange={() => setSelectedAction('delete')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4 text-red-600" />
                    <span className="font-medium text-dark-800">Delete Permanently</span>
                  </div>
                  <p className="text-sm text-dark-500 mt-1">
                    Permanently delete this {childEntity} from the system.
                    This action cannot be undone and will remove all associated data.
                  </p>
                </div>
              </div>
            </label>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-dark-200 bg-dark-50 rounded-b-xl flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-sm font-medium text-dark-700 hover:bg-dark-100 rounded-md transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isProcessing}
              className={`
                px-4 py-2 text-sm font-medium text-white rounded-md transition-colors disabled:opacity-50
                ${selectedAction === 'unlink'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-red-600 hover:bg-red-700'
                }
              `}
            >
              {isProcessing
                ? 'Processing...'
                : selectedAction === 'unlink'
                  ? 'Unlink'
                  : 'Delete'
              }
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
