/**
 * ============================================================================
 * LOGOUT STEPPER (stepper_logout.tsx)
 * ============================================================================
 *
 * LogoutGate: Progress UI for logout
 * - Shows fake stepper progress UI (5 steps) during logout
 * - Calls onLogoutComplete when animation finishes
 *
 * v14.2.0: Added logout stepper UI
 * v14.3.0: Extracted to stepper_logout.tsx
 *
 * Pattern: Linear, Notion, Vercel
 * @see docs/design_pattern/FRONTEND_DESIGN_PATTERN.md
 *
 * @version 14.3.0
 */

import { type ReactNode, useState, useEffect, useRef } from 'react';
import { useCacheContext } from '../../../db/Provider';
import { Building2 } from 'lucide-react';
import {
  type LoadingStep,
  type StepStatus,
  renderTimelineStepper,
  LOGOUT_STEP_DURATION_MS,
} from './stepper_shared';

interface LogoutGateProps {
  children: ReactNode;
  /** Callback when logout animation completes */
  onLogoutComplete: () => void;
}

/**
 * Logout steps for the fake progress display
 * 5 steps - animate through all before completing logout
 */
const getLogoutSteps = (): LoadingStep[] => [
  { id: 'logging-off', label: 'Logging off', status: 'pending' },
  { id: 'processing', label: 'Processing', status: 'pending' },
  { id: 'clearing-session', label: 'Clearing the session', status: 'pending' },
  { id: 'clearing-completed', label: 'Clearing completed', status: 'pending' },
  { id: 'logged-out', label: 'Logged out', status: 'pending' },
];

/**
 * LogoutGate Component
 *
 * Shows a stepper UI during logout process.
 * Renders children normally until isLoggingOut becomes true,
 * then shows the logout stepper and calls onLogoutComplete when done.
 *
 * @example
 * ```tsx
 * // In App.tsx - wrap the entire app
 * <LogoutGate onLogoutComplete={handleLogoutComplete}>
 *   <Routes>...</Routes>
 * </LogoutGate>
 * ```
 */
export function LogoutGate({ children, onLogoutComplete }: LogoutGateProps) {
  const { isLoggingOut, setLoggingOut } = useCacheContext();
  const [steps, setSteps] = useState<LoadingStep[]>(getLogoutSteps);
  const currentStepRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const completedRef = useRef(false);
  const isRunningRef = useRef(false);

  // Total number of logout steps (constant)
  const totalLogoutSteps = 5;

  // Start/reset logout animation when isLoggingOut changes
  useEffect(() => {
    if (!isLoggingOut) {
      // Clean up when not logging out
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      isRunningRef.current = false;
      return;
    }

    // Reset and start animation
    setSteps(getLogoutSteps());
    currentStepRef.current = 0;
    completedRef.current = false;

    if (isRunningRef.current) return;
    isRunningRef.current = true;

    const advanceStep = () => {
      const stepIndex = currentStepRef.current;

      // All steps done - trigger logout completion
      if (stepIndex >= totalLogoutSteps) {
        if (!completedRef.current) {
          completedRef.current = true;
          timerRef.current = setTimeout(() => {
            setLoggingOut(false);
            onLogoutComplete();
          }, 300);
        }
        isRunningRef.current = false;
        return;
      }

      // Mark current step as processing
      setSteps((prev) =>
        prev.map((step, idx) =>
          idx === stepIndex ? { ...step, status: 'processing' as StepStatus } : step
        )
      );

      // After duration, mark as completed and advance
      timerRef.current = setTimeout(() => {
        setSteps((prev) =>
          prev.map((step, idx) =>
            idx === stepIndex ? { ...step, status: 'completed' as StepStatus } : step
          )
        );
        currentStepRef.current = stepIndex + 1;
        advanceStep(); // Recursively advance to next step
      }, LOGOUT_STEP_DURATION_MS);
    };

    advanceStep();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      isRunningRef.current = false;
    };
  }, [isLoggingOut, totalLogoutSteps, setLoggingOut, onLogoutComplete]);

  // Show logout stepper when logging out
  if (isLoggingOut) {
    const completedSteps = steps.filter((s) => s.status === 'completed').length;
    const totalSteps = steps.length;
    const currentStep = steps.find((s) => s.status === 'processing');
    const progressPercent = Math.round((completedSteps / totalSteps) * 100);

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-dark-100 rounded-xl shadow-2xl w-full max-w-md border border-dark-300 mx-4">
          {/* Header */}
          <div className="px-6 py-4 border-b border-dark-300">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-dark-700">Signing out</h2>
              <span className="text-sm text-dark-500 font-medium">{progressPercent}%</span>
            </div>
            {currentStep && <p className="text-sm text-dark-500 mt-1">{currentStep.label}...</p>}
          </div>

          {/* Steps List - Connected Timeline */}
          <div className="px-4 max-h-80 overflow-y-auto">{renderTimelineStepper(steps)}</div>

          {/* Branding Footer */}
          <div className="px-6 py-3 border-t border-dark-300 bg-dark-50 rounded-b-xl">
            <div className="flex items-center justify-center gap-2 text-xs text-dark-500">
              <Building2 className="w-3.5 h-3.5" />
              <span>Huron Home Services Platform</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not logging out - render children normally
  return <>{children}</>;
}
