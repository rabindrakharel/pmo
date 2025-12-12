/**
 * ============================================================================
 * LOGIN STEPPER (stepper_login.tsx)
 * ============================================================================
 *
 * MetadataGate: Hydration Gate Pattern for login
 * - Blocks rendering until ALL session-level metadata is loaded
 * - Shows fake stepper progress UI (5 steps) during login
 *
 * GUARANTEES after MetadataGate passes:
 * - getDatalabelSync() will NEVER return null for session datalabels
 * - getEntityCodesSync() will NEVER return null
 * - getEntityInstanceNameSync() will return names for prefetched entities
 * - All formatters have access to complete lookup data
 *
 * v13.1.0: Added stepper progress UI during loading
 * v14.2.0: Parallel loading - steps animate while real loading happens
 * v14.3.0: Extracted to stepper_login.tsx
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
  STEP_DURATION_NORMAL_MS,
  STEP_DURATION_FAST_MS,
} from './stepper_shared';

interface MetadataGateProps {
  children: ReactNode;
  /**
   * Optional loading message displayed while metadata loads
   * @default "Loading application data"
   */
  loadingMessage?: string;
  /**
   * Optional secondary message displayed below the spinner
   */
  loadingSubMessage?: string;
}

/**
 * Default loading steps for the fake progress display
 * 5 steps - duration varies based on whether real loading is done
 */
const getInitialSteps = (): LoadingStep[] => [
  { id: 'logging-in', label: 'Logging in', status: 'pending' },
  { id: 'authenticating', label: 'Authenticating', status: 'pending' },
  { id: 'resolving', label: 'Resolving', status: 'pending' },
  { id: 'gathering', label: 'Gathering Information', status: 'pending' },
  { id: 'redirecting', label: 'Redirecting', status: 'pending' },
];

/** Minimum steps to show before allowing gate to open (all 5 steps) */
const MIN_STEPS_BEFORE_COMPLETE = 5;

/**
 * MetadataGate Component
 *
 * Blocks rendering of children until session-level metadata is fully loaded.
 * This ensures sync accessors (getDatalabelSync, etc.) always return data.
 *
 * @example
 * ```tsx
 * // In App.tsx - wrap authenticated routes
 * <Route element={<ProtectedRoute />}>
 *   <Route element={<MetadataGate><Layout /></MetadataGate>}>
 *     <Route path="/project" element={<ProjectListPage />} />
 *   </Route>
 * </Route>
 * ```
 */
export function MetadataGate({
  children,
  loadingMessage = 'Loading application data',
  loadingSubMessage,
}: MetadataGateProps) {
  const { isMetadataLoaded } = useCacheContext();
  const [steps, setSteps] = useState<LoadingStep[]>(getInitialSteps);
  const [animationComplete, setAnimationComplete] = useState(false);
  const currentStepRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(false);

  // Reset steps when gate closes (logout or fresh load)
  useEffect(() => {
    if (!isMetadataLoaded) {
      // Reset to initial state when loading starts
      setSteps(getInitialSteps());
      currentStepRef.current = 0;
      setAnimationComplete(false);
      isRunningRef.current = false;
    }
  }, [isMetadataLoaded]);

  // Total number of steps (constant, doesn't change)
  const totalSteps = 5;

  // Auto-advance steps with fake progress using recursive setTimeout
  // This avoids useEffect dependency issues by using refs
  useEffect(() => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    const advanceStep = () => {
      const stepIndex = currentStepRef.current;

      // All steps done - mark animation complete
      if (stepIndex >= totalSteps) {
        setAnimationComplete(true);
        isRunningRef.current = false;
        return;
      }

      // Mark current step as processing
      setSteps((prev) =>
        prev.map((step, idx) =>
          idx === stepIndex ? { ...step, status: 'processing' as StepStatus } : step
        )
      );

      // Determine step duration based on current loading state
      const stepDuration = isMetadataLoaded ? STEP_DURATION_FAST_MS : STEP_DURATION_NORMAL_MS;

      // After duration, mark as completed and advance
      timerRef.current = setTimeout(() => {
        setSteps((prev) =>
          prev.map((step, idx) =>
            idx === stepIndex ? { ...step, status: 'completed' as StepStatus } : step
          )
        );
        currentStepRef.current = stepIndex + 1;
        advanceStep(); // Recursively advance to next step
      }, stepDuration);
    };

    advanceStep();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      isRunningRef.current = false;
    };
  }, []); // Empty deps - runs once, uses refs for state

  // When metadata loads, speed up remaining steps
  useEffect(() => {
    if (isMetadataLoaded && timerRef.current) {
      // Clear current slow timer and restart with fast timing
      clearTimeout(timerRef.current);
      isRunningRef.current = false;

      const speedUpSteps = () => {
        const stepIndex = currentStepRef.current;

        if (stepIndex >= totalSteps) {
          setAnimationComplete(true);
          return;
        }

        // Mark current step as processing (might already be)
        setSteps((prev) =>
          prev.map((step, idx) =>
            idx === stepIndex ? { ...step, status: 'processing' as StepStatus } : step
          )
        );

        timerRef.current = setTimeout(() => {
          setSteps((prev) =>
            prev.map((step, idx) =>
              idx === stepIndex ? { ...step, status: 'completed' as StepStatus } : step
            )
          );
          currentStepRef.current = stepIndex + 1;
          speedUpSteps();
        }, STEP_DURATION_FAST_MS);
      };

      speedUpSteps();
    }
  }, [isMetadataLoaded, totalSteps]);

  // Gate conditions:
  // 1. Real loading must be done (isMetadataLoaded)
  // 2. Animation must either be complete OR at least MIN_STEPS_BEFORE_COMPLETE steps done
  const completedStepsCount = steps.filter((s) => s.status === 'completed').length;
  const canOpenGate =
    isMetadataLoaded && (animationComplete || completedStepsCount >= MIN_STEPS_BEFORE_COMPLETE);

  // Gate: Block rendering until both conditions are met
  if (!canOpenGate) {
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
              <h2 className="text-lg font-semibold text-dark-700">{loadingMessage}</h2>
              <span className="text-sm text-dark-500 font-medium">{progressPercent}%</span>
            </div>
            {currentStep && <p className="text-sm text-dark-500 mt-1">{currentStep.label}...</p>}
            {loadingSubMessage && !currentStep && (
              <p className="text-sm text-dark-500 mt-1">{loadingSubMessage}</p>
            )}
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

  // Gate passed - metadata is guaranteed available
  return <>{children}</>;
}

/**
 * useMetadataReady Hook
 *
 * Returns true when metadata is loaded and sync accessors are safe to use.
 * Use this in components that need to know if metadata is ready without
 * blocking the entire component tree.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const isReady = useMetadataReady();
 *   if (!isReady) return <Skeleton />;
 *   // Safe to use getDatalabelSync() here
 * }
 * ```
 */
export function useMetadataReady(): boolean {
  const { isMetadataLoaded } = useCacheContext();
  return isMetadataLoaded;
}
