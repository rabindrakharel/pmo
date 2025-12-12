/**
 * Gates - Components that control rendering based on application state
 *
 * Stepper components follow naming convention: stepper_{name}.tsx
 */

// Login stepper (MetadataGate)
export { MetadataGate, useMetadataReady } from './stepper_login';

// Logout stepper (LogoutGate)
export { LogoutGate } from './stepper_logout';

// Shared stepper utilities (for building custom steppers)
export {
  type StepStatus,
  type LoadingStep,
  getStatusIcon,
  getStepTextColor,
  renderTimelineStepper,
  STEP_DURATION_NORMAL_MS,
  STEP_DURATION_FAST_MS,
  LOGOUT_STEP_DURATION_MS,
} from './stepper_shared';
