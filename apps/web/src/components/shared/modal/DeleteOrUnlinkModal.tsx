/**
 * ============================================================================
 * DELETE OR UNLINK MODAL (v9.5.4)
 * ============================================================================
 *
 * Purpose: Unified modal for entity removal with context-aware behavior.
 * Features stepper progress indicator during processing.
 *
 * Styling: Adheres to docs/design_pattern/styling_patterns.md (v13.1)
 * - Modal: bg-dark-100, border-dark-300, rounded-xl, shadow-2xl
 * - Buttons: px-3 py-2 rounded-md (minimalistic)
 * - Text: text-dark-700 (primary), text-dark-600 (secondary)
 * - Focus: focus-visible:ring-2 focus-visible:ring-slate-500/30
 *
 * MODE 1: With parentContext (Child Entity Tab - e.g., /project/abc/task)
 * - Shows Unlink + Delete radio selection
 * - Unlink: Removes entity_instance_link only (requires EDIT on parent)
 * - Delete: Permanently deletes entity (requires DELETE on child)
 *
 * MODE 2: Without parentContext (Standalone List - e.g., /project)
 * - Shows Delete confirmation only (no Unlink option)
 * - Delete: Permanently deletes entity (requires DELETE on entity)
 *
 * Replaces window.confirm() with proper modal UX in all cases.
 *
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Link2Off, Trash2, AlertTriangle, Check, Loader2 } from 'lucide-react';

export interface ParentContext {
  entityCode: string;
  entityId: string;
  entityName?: string;
  entityLabel?: string;
}

interface Step {
  id: string;
  label: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

interface DeleteOrUnlinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Entity type being deleted (e.g., 'task', 'project') */
  entityCode: string;
  /** Entity display label (e.g., 'Task', 'Project') */
  entityLabel?: string;
  /** Name of the entity instance being removed */
  entityName: string;
  /**
   * Parent context - OPTIONAL
   * When provided: Modal shows Unlink + Delete options (radio selection)
   * When undefined: Modal shows Delete confirmation only
   */
  parentContext?: ParentContext;
  /** Unlink handler - only called when parentContext exists and user selects Unlink */
  onUnlink?: () => Promise<void>;
  /** Delete handler - always required */
  onDelete: () => Promise<void>;
}

// Step definitions for different operations
const getUnlinkSteps = (): Step[] => [
  { id: 'processing', label: 'Processing the request', status: 'pending' },
  { id: 'unlink', label: 'Unlinking', status: 'pending' },
  { id: 'completed', label: 'Completed', status: 'pending' },
];

const getDeleteSteps = (): Step[] => [
  { id: 'processing', label: 'Processing the request', status: 'pending' },
  { id: 'delete', label: 'Deleting', status: 'pending' },
  { id: 'completed', label: 'Completed', status: 'pending' },
];

// Simulated step delays (ms) - gives visual feedback
const STEP_DELAYS = {
  processing: 500,
  unlink: 0, // Actual API call happens here
  delete: 0, // Actual API call happens here
  completed: 400,
};

export const DeleteOrUnlinkModal: React.FC<DeleteOrUnlinkModalProps> = ({
  isOpen,
  onClose,
  entityCode,
  entityLabel,
  entityName,
  parentContext,
  onUnlink,
  onDelete,
}) => {
  // In standalone mode (no parentContext), default to 'delete'
  // In child entity tab mode, default to 'unlink'
  const [selectedAction, setSelectedAction] = useState<'unlink' | 'delete'>(
    parentContext ? 'unlink' : 'delete'
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Determine display labels
  const displayEntityLabel = entityLabel || entityCode || 'Record';

  // Reset state when modal opens/closes or parentContext changes
  useEffect(() => {
    if (isOpen) {
      setSelectedAction(parentContext ? 'unlink' : 'delete');
      setError(null);
      setIsProcessing(false);
      setSteps([]);
    }
  }, [isOpen, parentContext]);

  // Helper to update a step's status
  const updateStepStatus = useCallback((stepId: string, status: Step['status']) => {
    setSteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...step, status } : step))
    );
  }, []);

  // Helper to delay for visual feedback
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Process steps sequentially with visual feedback
  const processWithSteps = useCallback(
    async (stepsToProcess: Step[], apiCall: () => Promise<void>, apiStepId: string) => {
      setSteps(stepsToProcess);
      setIsProcessing(true);
      setError(null);

      try {
        for (const step of stepsToProcess) {
          // Mark step as processing
          updateStepStatus(step.id, 'processing');

          if (step.id === apiStepId) {
            // This is the actual API call step
            await apiCall();
          } else {
            // Simulated delay for visual feedback
            await delay(STEP_DELAYS[step.id as keyof typeof STEP_DELAYS] || 300);
          }

          // Mark step as completed
          updateStepStatus(step.id, 'completed');
        }

        // Brief pause to show completion before closing
        await delay(400);
        onClose();
      } catch (err: any) {
        // Mark current processing step as error
        setSteps((prev) =>
          prev.map((step) =>
            step.status === 'processing' ? { ...step, status: 'error' } : step
          )
        );
        setError(err.message || 'Operation failed');
        setIsProcessing(false);
      }
    },
    [updateStepStatus, onClose]
  );

  const handleConfirm = useCallback(async () => {
    if (selectedAction === 'unlink' && onUnlink) {
      const unlinkSteps = getUnlinkSteps();
      await processWithSteps(unlinkSteps, onUnlink, 'unlink');
    } else {
      const deleteSteps = getDeleteSteps();
      await processWithSteps(deleteSteps, onDelete, 'delete');
    }
  }, [selectedAction, onUnlink, onDelete, processWithSteps]);

  if (!isOpen) return null;

  // Render step indicator with connected timeline (follows styling_patterns.md)
  const renderSteps = () => {
    // Calculate progress percentage based on completed steps
    const completedCount = steps.filter((s) => s.status === 'completed').length;
    const processingIndex = steps.findIndex((s) => s.status === 'processing');
    // Progress: completed steps + half of processing step
    const progressPercent =
      processingIndex >= 0
        ? ((processingIndex + 0.5) / (steps.length - 1)) * 100
        : (completedCount / (steps.length - 1)) * 100;

    // Node size = 20px (w-5), center at 10px
    // Container padding: py-3 (12px top), pl-2 (8px left)
    // Line should start at center of first node: 8px (pl-2) + 10px (half node) = 18px from left, but we use left-[10px] relative to node container
    // Each step has pb-5 (20px) bottom padding except last
    // Line starts from center of first node to center of last node

    const nodeSize = 20; // w-5 = 20px
    const stepSpacing = 20; // pb-5 = 20px
    const totalLineHeight = (steps.length - 1) * (nodeSize + stepSpacing);

    return (
      <div className="py-3 pl-2 relative">
        {/* Background line (gray) - connects center of first node to center of last node */}
        <div
          className="absolute w-0.5 bg-dark-200"
          style={{
            left: '18px', // 8px (pl-2) + 10px (center of 20px node)
            top: '22px', // 12px (py-3) + 10px (center of first node)
            height: `${totalLineHeight}px`,
          }}
        />

        {/* Progress line (green) - fills as steps complete */}
        <div
          className="absolute w-0.5 bg-green-500 transition-all duration-500 ease-out"
          style={{
            left: '18px',
            top: '22px',
            height: `${totalLineHeight * Math.min(progressPercent, 100) / 100}px`,
          }}
        />

        {/* Steps */}
        {steps.map((step, index) => {
          const isCompleted = step.status === 'completed';
          const isProcessing = step.status === 'processing';
          const isError = step.status === 'error';
          const isPending = step.status === 'pending';

          return (
            <div key={step.id} className="relative flex items-start gap-4 pb-5 last:pb-0">
              {/* Node */}
              <div className="flex-shrink-0 w-5 h-5 relative z-10">
                {isPending && (
                  <div className="w-5 h-5 rounded-full border-2 border-dark-300 bg-white" />
                )}
                {isProcessing && (
                  <div className="w-5 h-5 rounded-full bg-white border-2 border-slate-500 flex items-center justify-center">
                    <Loader2 className="w-3 h-3 text-slate-600 animate-spin" />
                  </div>
                )}
                {isCompleted && (
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </div>
                )}
                {isError && (
                  <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                    <X className="w-3 h-3 text-white" strokeWidth={3} />
                  </div>
                )}
              </div>

              {/* Label */}
              <span
                className={`text-sm leading-5 transition-colors duration-200 ${
                  isProcessing
                    ? 'text-slate-700 font-medium'
                    : isCompleted
                      ? 'text-green-700 font-medium'
                      : isError
                        ? 'text-red-700 font-medium'
                        : 'text-dark-500'
                }`}
              >
                {step.label}
                {isProcessing && '...'}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const parentDisplayLabel = parentContext?.entityName
    ? `"${parentContext.entityName}"`
    : parentContext?.entityLabel
      ? `this ${parentContext.entityLabel}`
      : parentContext
        ? `this ${parentContext.entityCode}`
        : '';

  // ============================================================================
  // MODE 2: Standalone delete confirmation (no parentContext)
  // URL: /project, /task, etc.
  // ============================================================================
  if (!parentContext) {
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={isProcessing ? undefined : onClose}
        />

        {/* Modal Container - follows styling_patterns.md section 3.7 */}
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="bg-dark-100 rounded-xl shadow-2xl w-full max-w-md border border-dark-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-dark-300">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <h2 className="text-lg font-semibold text-dark-700">
                  Delete {displayEntityLabel}
                </h2>
              </div>
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="p-1.5 hover:bg-dark-200 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="h-5 w-5 text-dark-500" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-4 space-y-4">
              {!isProcessing ? (
                <>
                  <p className="text-sm text-dark-600">
                    Are you sure you want to delete{' '}
                    <span className="font-medium text-dark-700">"{entityName}"</span>?
                  </p>
                  <p className="text-sm text-dark-500">
                    This action cannot be undone. The {displayEntityLabel.toLowerCase()} will be
                    permanently removed from the system.
                  </p>
                </>
              ) : (
                renderSteps()
              )}

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-100 border border-red-200 rounded-md text-sm text-red-800">
                  {error}
                </div>
              )}
            </div>

            {/* Footer - follows styling_patterns.md button patterns */}
            <div className="px-6 py-4 border-t border-dark-300 bg-dark-50 rounded-b-xl flex justify-end gap-2">
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="px-3 py-2 text-sm font-medium text-dark-600 bg-white border border-dark-300 rounded-md hover:border-dark-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isProcessing}
                className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Processing...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ============================================================================
  // MODE 1: Child entity tab with Unlink + Delete radio selection
  // URL: /project/abc-123/task
  // ============================================================================
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={isProcessing ? undefined : onClose}
      />

      {/* Modal Container - follows styling_patterns.md section 3.7 */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-dark-100 rounded-xl shadow-2xl w-full max-w-md border border-dark-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-dark-300">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <h2 className="text-lg font-semibold text-dark-700">Remove {displayEntityLabel}</h2>
            </div>
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="p-1.5 hover:bg-dark-200 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="h-5 w-5 text-dark-500" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-4">
            {!isProcessing ? (
              <>
                <p className="text-sm text-dark-600">
                  Choose how to remove{' '}
                  <span className="font-medium text-dark-700">"{entityName}"</span> from{' '}
                  {parentDisplayLabel}:
                </p>

                {/* Option: Unlink - uses slate accent per styling_patterns.md */}
                <label
                  className={`
                    block p-4 rounded-md border-2 cursor-pointer transition-all
                    ${
                      selectedAction === 'unlink'
                        ? 'border-slate-500 bg-slate-50'
                        : 'border-dark-300 hover:border-dark-400 bg-white'
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
                      className="mt-1 text-slate-600 focus:ring-slate-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Link2Off className="h-4 w-4 text-slate-600" />
                        <span className="font-medium text-dark-700">
                          Unlink from {parentContext.entityLabel || parentContext.entityCode}
                        </span>
                      </div>
                      <p className="text-sm text-dark-500 mt-1">
                        Remove from this{' '}
                        {parentContext.entityLabel?.toLowerCase() || parentContext.entityCode} only.
                        The {displayEntityLabel.toLowerCase()} will remain in the system and can be
                        linked to other entities.
                      </p>
                    </div>
                  </div>
                </label>

                {/* Option: Delete - uses red for danger action */}
                <label
                  className={`
                    block p-4 rounded-md border-2 cursor-pointer transition-all
                    ${
                      selectedAction === 'delete'
                        ? 'border-red-500 bg-red-50'
                        : 'border-dark-300 hover:border-dark-400 bg-white'
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
                      className="mt-1 text-red-600 focus:ring-red-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Trash2 className="h-4 w-4 text-red-600" />
                        <span className="font-medium text-dark-700">Delete permanently</span>
                      </div>
                      <p className="text-sm text-dark-500 mt-1">
                        Remove from entire system. This action cannot be undone and will remove all
                        associated data.
                      </p>
                    </div>
                  </div>
                </label>
              </>
            ) : (
              renderSteps()
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-100 border border-red-200 rounded-md text-sm text-red-800">
                {error}
              </div>
            )}
          </div>

          {/* Footer - follows styling_patterns.md button patterns */}
          <div className="px-6 py-4 border-t border-dark-300 bg-dark-50 rounded-b-xl flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-3 py-2 text-sm font-medium text-dark-600 bg-white border border-dark-300 rounded-md hover:border-dark-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isProcessing}
              className={`
                px-3 py-2 text-sm font-medium text-white rounded-md shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                ${
                  selectedAction === 'unlink'
                    ? 'bg-slate-600 hover:bg-slate-700'
                    : 'bg-red-600 hover:bg-red-700'
                }
              `}
            >
              {isProcessing
                ? 'Processing...'
                : selectedAction === 'unlink'
                  ? 'Unlink'
                  : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
