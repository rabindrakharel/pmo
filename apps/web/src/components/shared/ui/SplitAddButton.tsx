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
  // RENDER - v14.6.0: Minimal tab style matching DynamicChildEntityTabs
  // ============================================================================

  return (
    <nav className={`flex items-center gap-1 ${className}`} aria-label="Add actions">
      {/* Tab 1: Create New (always visible) */}
      <button
        onClick={handleCreateNewClick}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none text-dark-text-tertiary hover:text-dark-text-secondary disabled:text-dark-text-disabled disabled:cursor-not-allowed"
      >
        <Plus className="h-4 w-4" />
        <span>New {entityLabel}</span>
      </button>

      {/* Tab 2: Link Existing (only in parent context) */}
      {showLinkOption && (
        <button
          onClick={handleAddExistingClick}
          disabled={disabled}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none text-dark-text-tertiary hover:text-dark-text-secondary disabled:text-dark-text-disabled disabled:cursor-not-allowed"
        >
          <Link2 className="h-4 w-4" />
          <span>Link Existing</span>
        </button>
      )}
    </nav>
  );
}

export default SplitAddButton;
