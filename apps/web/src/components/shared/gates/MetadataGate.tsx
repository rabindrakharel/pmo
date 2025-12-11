/**
 * ============================================================================
 * Gate Components - Login & Logout Progress UI
 * ============================================================================
 *
 * MetadataGate: Hydration Gate Pattern for login
 * - Blocks rendering until ALL session-level metadata is loaded
 * - Shows fake stepper progress UI (5 steps) during login
 *
 * LogoutGate: Progress UI for logout
 * - Shows fake stepper progress UI (5 steps) during logout
 * - Calls onLogoutComplete when animation finishes
 *
 * GUARANTEES after MetadataGate passes:
 * - getDatalabelSync() will NEVER return null for session datalabels
 * - getEntityCodesSync() will NEVER return null
 * - getEntityInstanceNameSync() will return names for prefetched entities
 * - All formatters have access to complete lookup data
 *
 * v13.1.0: Added stepper progress UI during loading
 * - Shows each loading step with status icons (same pattern as DeleteOrUnlinkModal)
 * - Self-contained fake progress animation (no deep integration needed)
 * - Steps auto-advance on a timer for visual feedback
 *
 * v14.2.0: Parallel loading + LogoutGate
 * - Real cache loading runs in background (parallel with animation)
 * - Steps animate at normal speed (5s each) while loading
 * - Once loading completes, remaining steps animate at fast speed (400ms each)
 * - Gate opens when BOTH: real loading done AND all 5 steps completed
 * - Added LogoutGate component with same stepper UI pattern
 *
 * Pattern: Linear, Notion, Vercel
 * @see docs/design_pattern/FRONTEND_DESIGN_PATTERN.md
 *
 * @version 14.2.0
 */

import { type ReactNode, useState, useEffect, useRef } from 'react';
import { useCacheContext } from '../../../db/Provider';
import { Check, Loader2, Building2 } from 'lucide-react';

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

type StepStatus = 'pending' | 'processing' | 'completed';

interface LoadingStep {
  id: string;
  label: string;
  status: StepStatus;
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

/** Normal step duration (when real loading is still in progress) */
const STEP_DURATION_NORMAL_MS = 5000;

/** Fast step duration (when real loading is done, animate remaining steps quickly) */
const STEP_DURATION_FAST_MS = 400;

/** Minimum steps to show before allowing gate to open (all 5 steps) */
const MIN_STEPS_BEFORE_COMPLETE = 5;

/**
 * Get status icon for a loading step
 * Reuses the same visual pattern from DeleteOrUnlinkModal
 */
const getStatusIcon = (status: StepStatus): React.ReactNode => {
  switch (status) {
    case 'pending':
      return (
        <div className="w-5 h-5 rounded-full border-2 border-dark-300 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-dark-300" />
        </div>
      );
    case 'processing':
      return (
        <div className="w-5 h-5 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-slate-600 animate-spin" />
        </div>
      );
    case 'completed':
      return (
        <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center">
          <Check className="w-3 h-3 text-white" strokeWidth={3} />
        </div>
      );
  }
};

/**
 * Get background color for step row based on status
 */
const getStepBackground = (status: StepStatus): string => {
  switch (status) {
    case 'processing':
      return 'bg-slate-100';
    case 'completed':
      return 'bg-green-50';
    default:
      return 'bg-dark-50';
  }
};

/**
 * Get text color for step label based on status
 */
const getStepTextColor = (status: StepStatus): string => {
  switch (status) {
    case 'processing':
      return 'text-slate-700 font-medium';
    case 'completed':
      return 'text-green-700';
    default:
      return 'text-dark-500';
  }
};

/**
 * MetadataGate Component
 *
 * Blocks rendering of children until session-level metadata is fully loaded.
 * This ensures sync accessors (getDatalabelSync, etc.) always return data.
 *
 * v13.1.0: Now shows a stepper UI with fake loading progress
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
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [animationComplete, setAnimationComplete] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset steps when gate closes (logout or fresh load)
  useEffect(() => {
    if (!isMetadataLoaded) {
      // Reset to initial state when loading starts
      setSteps(getInitialSteps());
      setCurrentStepIndex(0);
      setAnimationComplete(false);
    }
  }, [isMetadataLoaded]);

  // Auto-advance steps with fake progress
  // Runs in parallel with real loading - speed depends on whether real loading is done
  useEffect(() => {
    // All steps done - mark animation complete
    if (currentStepIndex >= steps.length) {
      setAnimationComplete(true);
      return;
    }

    // Determine step duration:
    // - Fast (400ms) if real loading is done (catch up quickly)
    // - Normal (5000ms) if real loading still in progress
    const stepDuration = isMetadataLoaded ? STEP_DURATION_FAST_MS : STEP_DURATION_NORMAL_MS;

    // Mark current step as processing
    setSteps((prev) =>
      prev.map((step, idx) =>
        idx === currentStepIndex ? { ...step, status: 'processing' as StepStatus } : step
      )
    );

    // After duration, mark as completed and move to next
    timerRef.current = setTimeout(() => {
      setSteps((prev) =>
        prev.map((step, idx) =>
          idx === currentStepIndex ? { ...step, status: 'completed' as StepStatus } : step
        )
      );
      setCurrentStepIndex((prev) => prev + 1);
    }, stepDuration);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isMetadataLoaded, currentStepIndex, steps.length]);

  // Gate conditions:
  // 1. Real loading must be done (isMetadataLoaded)
  // 2. Animation must either be complete OR at least MIN_STEPS_BEFORE_COMPLETE steps done
  const completedStepsCount = steps.filter((s) => s.status === 'completed').length;
  const canOpenGate = isMetadataLoaded && (animationComplete || completedStepsCount >= MIN_STEPS_BEFORE_COMPLETE);

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
            {currentStep && (
              <p className="text-sm text-dark-500 mt-1">{currentStep.label}...</p>
            )}
            {loadingSubMessage && !currentStep && (
              <p className="text-sm text-dark-500 mt-1">{loadingSubMessage}</p>
            )}
          </div>

          {/* Progress Bar */}
          <div className="h-1 bg-dark-200">
            <div
              className="h-full transition-all duration-300 ease-out bg-slate-600"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Steps List */}
          <div className="px-4 py-3 space-y-1 max-h-80 overflow-y-auto">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 ${getStepBackground(step.status)}`}
              >
                {/* Status Icon */}
                <div className="flex-shrink-0">{getStatusIcon(step.status)}</div>

                {/* Step Label */}
                <span className={`text-sm ${getStepTextColor(step.status)}`}>
                  {step.label}
                  {step.status === 'processing' && (
                    <span className="animate-pulse">...</span>
                  )}
                </span>
              </div>
            ))}
          </div>

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

// ============================================================================
// LogoutGate - Logout Progress UI
// ============================================================================

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

/** Fast step duration for logout (400ms per step = 2s total) */
const LOGOUT_STEP_DURATION_MS = 400;

interface LogoutGateProps {
  children: ReactNode;
  /** Callback when logout animation completes */
  onLogoutComplete: () => void;
}

/**
 * LogoutGate Component
 *
 * Shows a stepper UI during logout process.
 * Renders children normally until isLoggingOut becomes true,
 * then shows the logout stepper and calls onLogoutComplete when done.
 *
 * v14.2.0: Added logout stepper UI
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
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const completedRef = useRef(false);

  // Reset steps when logout starts
  useEffect(() => {
    if (isLoggingOut) {
      setSteps(getLogoutSteps());
      setCurrentStepIndex(0);
      completedRef.current = false;
    }
  }, [isLoggingOut]);

  // Auto-advance steps during logout
  useEffect(() => {
    if (!isLoggingOut) return;

    // All steps done - trigger logout completion
    if (currentStepIndex >= steps.length) {
      if (!completedRef.current) {
        completedRef.current = true;
        // Small delay before completing to show final state
        timerRef.current = setTimeout(() => {
          setLoggingOut(false);
          onLogoutComplete();
        }, 300);
      }
      return;
    }

    // Mark current step as processing
    setSteps((prev) =>
      prev.map((step, idx) =>
        idx === currentStepIndex ? { ...step, status: 'processing' as StepStatus } : step
      )
    );

    // After duration, mark as completed and move to next
    timerRef.current = setTimeout(() => {
      setSteps((prev) =>
        prev.map((step, idx) =>
          idx === currentStepIndex ? { ...step, status: 'completed' as StepStatus } : step
        )
      );
      setCurrentStepIndex((prev) => prev + 1);
    }, LOGOUT_STEP_DURATION_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isLoggingOut, currentStepIndex, steps.length, setLoggingOut, onLogoutComplete]);

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
            {currentStep && (
              <p className="text-sm text-dark-500 mt-1">{currentStep.label}...</p>
            )}
          </div>

          {/* Progress Bar */}
          <div className="h-1 bg-dark-200">
            <div
              className="h-full transition-all duration-300 ease-out bg-slate-600"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Steps List */}
          <div className="px-4 py-3 space-y-1 max-h-80 overflow-y-auto">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 ${getStepBackground(step.status)}`}
              >
                {/* Status Icon */}
                <div className="flex-shrink-0">{getStatusIcon(step.status)}</div>

                {/* Step Label */}
                <span className={`text-sm ${getStepTextColor(step.status)}`}>
                  {step.label}
                  {step.status === 'processing' && (
                    <span className="animate-pulse">...</span>
                  )}
                </span>
              </div>
            ))}
          </div>

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
