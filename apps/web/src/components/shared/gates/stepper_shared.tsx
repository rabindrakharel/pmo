/**
 * ============================================================================
 * SHARED STEPPER UTILITIES (stepper_shared.tsx)
 * ============================================================================
 *
 * Common types, constants, and rendering functions for all stepper components.
 * Used by stepper_login.tsx, stepper_logout.tsx, and other stepper components.
 *
 * v14.3.0: Extracted shared utilities
 *
 * Pattern: Linear, Notion, Vercel
 * @see docs/design_pattern/FRONTEND_DESIGN_PATTERN.md
 *
 * @version 14.3.0
 */

import React from 'react';
import { Check, Loader2 } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export type StepStatus = 'pending' | 'processing' | 'completed';

export interface LoadingStep {
  id: string;
  label: string;
  status: StepStatus;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Normal step duration (when real loading is still in progress) */
export const STEP_DURATION_NORMAL_MS = 5000;

/** Fast step duration (when real loading is done, animate remaining steps quickly) */
export const STEP_DURATION_FAST_MS = 400;

/** Fast step duration for logout (400ms per step = 2s total) */
export const LOGOUT_STEP_DURATION_MS = 400;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get status icon for a loading step
 * Reuses the same visual pattern from DeleteOrUnlinkModal
 */
export const getStatusIcon = (status: StepStatus): React.ReactNode => {
  switch (status) {
    case 'pending':
      return <div className="w-5 h-5 rounded-full border-2 border-dark-300 bg-white" />;
    case 'processing':
      return (
        <div className="w-5 h-5 rounded-full bg-white border-2 border-slate-500 flex items-center justify-center">
          <Loader2 className="w-3 h-3 text-slate-600 animate-spin" />
        </div>
      );
    case 'completed':
      return (
        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
          <Check className="w-3 h-3 text-white" strokeWidth={3} />
        </div>
      );
  }
};

/**
 * Get text color for step label based on status
 */
export const getStepTextColor = (status: StepStatus): string => {
  switch (status) {
    case 'processing':
      return 'text-slate-700 font-medium';
    case 'completed':
      return 'text-green-700 font-medium';
    default:
      return 'text-dark-500';
  }
};

// ============================================================================
// TIMELINE STEPPER RENDERER
// ============================================================================

/**
 * Render connected timeline stepper
 * Same visual pattern as DeleteOrUnlinkModal
 */
export const renderTimelineStepper = (steps: LoadingStep[]): React.ReactNode => {
  // Calculate progress percentage based on completed steps
  const completedCount = steps.filter((s) => s.status === 'completed').length;
  const processingIndex = steps.findIndex((s) => s.status === 'processing');
  // Progress: completed steps + half of processing step
  const progressPercent =
    processingIndex >= 0
      ? ((processingIndex + 0.5) / (steps.length - 1)) * 100
      : (completedCount / (steps.length - 1)) * 100;

  // Node size = 20px (w-5), center at 10px
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
          height: `${(totalLineHeight * Math.min(progressPercent, 100)) / 100}px`,
        }}
      />

      {/* Steps */}
      {steps.map((step) => (
        <div key={step.id} className="relative flex items-start gap-4 pb-5 last:pb-0">
          {/* Node */}
          <div className="flex-shrink-0 w-5 h-5 relative z-10">{getStatusIcon(step.status)}</div>

          {/* Label */}
          <span
            className={`text-sm leading-5 transition-colors duration-200 ${getStepTextColor(step.status)}`}
          >
            {step.label}
            {step.status === 'processing' && '...'}
          </span>
        </div>
      ))}
    </div>
  );
};
