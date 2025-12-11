/**
 * ============================================================================
 * SPLIT ADD BUTTON (v11.5.0)
 * ============================================================================
 *
 * Purpose: Context-aware add button for entity tables.
 * - Standalone mode: Left tab only "Create New {Entity}"
 * - Parent context mode: Both tabs "Create New {Entity}" | "Add Existing {Entity}"
 *
 * Features:
 * - Dynamic entity label display
 * - Tab-style layout
 * - Keyboard accessible
 *
 * Styling: Adheres to docs/design_pattern/styling_patterns.md (v13.1)
 *
 * Usage:
 * ```tsx
 * // Standalone mode (no parent context) - left tab only
 * <SplitAddButton
 *   entityLabel="Customer"
 *   onAddNew={handleAddNew}
 * />
 *
 * // Parent context mode (child entity tab) - both tabs
 * <SplitAddButton
 *   entityLabel="Task"
 *   onAddNew={handleAddNew}
 *   onLinkExisting={handleLinkExisting}
 *   showLinkOption={true}
 * />
 * ```
 *
 * ============================================================================
 */

import { useCallback } from 'react';
import { Plus, Link2 } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface SplitAddButtonProps {
  /** Entity display label (e.g., 'Customer', 'Task') */
  entityLabel: string;
  /** Handler for "Create New" action */
  onAddNew: () => void;
  /** Handler for "Add Existing" action (only used if showLinkOption is true) */
  onLinkExisting?: () => void;
  /** Whether to show the "Add Existing" tab */
  showLinkOption?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SplitAddButton({
  entityLabel,
  onAddNew,
  onLinkExisting,
  showLinkOption = false,
  className = '',
  disabled = false
}: SplitAddButtonProps) {

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleCreateNewClick = useCallback(() => {
    if (disabled) return;
    onAddNew();
  }, [disabled, onAddNew]);

  const handleAddExistingClick = useCallback(() => {
    if (disabled) return;
    onLinkExisting?.();
  }, [disabled, onLinkExisting]);

  // ============================================================================
  // RENDER - Tabbed layout (shows 1 or 2 tabs based on context)
  // ============================================================================

  return (
    <div className={`flex ${className}`}>
      {/* Tab 1: Create New (always visible) */}
      <button
        onClick={handleCreateNewClick}
        disabled={disabled}
        className={`flex-1 px-4 py-3 text-sm text-dark-700 hover:bg-dark-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-500/30 focus-visible:outline-none ${showLinkOption ? 'border-r border-dark-300' : ''}`}
      >
        <Plus className="h-4 w-4" />
        <span>Create New {entityLabel}</span>
      </button>

      {/* Tab 2: Add Existing (only in parent context) */}
      {showLinkOption && (
        <button
          onClick={handleAddExistingClick}
          disabled={disabled}
          className="flex-1 px-4 py-3 text-sm text-dark-700 hover:bg-dark-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-500/30 focus-visible:outline-none"
        >
          <Link2 className="h-4 w-4" />
          <span>Add Existing {entityLabel}</span>
        </button>
      )}
    </div>
  );
}

export default SplitAddButton;
