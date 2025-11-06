/**
 * State Machine Service
 * Manages workflow state transitions for calendar booking
 * @module orchestrator/state/state-machine
 */

/**
 * Workflow States
 * Represents all possible states in the booking workflow
 */
export enum WorkflowState {
  // Initial states
  GREETING = 'greeting',

  // Problem identification
  ASK_PROBLEM = 'ask_problem',
  CAPTURE_INTENT = 'capture_intent',
  MAP_SERVICE = 'map_service',
  EMPATHIZE = 'empathize',

  // Customer identification
  ASK_PHONE = 'ask_phone',
  LOOKUP_CUSTOMER = 'lookup_customer',

  // Customer creation flow
  CREATE_CUSTOMER = 'create_customer',
  ASK_NAME = 'ask_name',
  ASK_CITY = 'ask_city',
  ASK_ADDRESS = 'ask_address',

  // Existing customer flow
  WELCOMING_EXISTING = 'welcoming_existing',

  // Booking flow
  ASK_AVAILABILITY = 'ask_availability',
  CREATE_TASK = 'create_task',
  CREATE_BOOKING = 'create_booking',

  // Terminal states
  CONFIRMATION = 'confirmation',
  DONE = 'done',

  // Error states
  ERROR = 'error',
  FALLBACK = 'fallback',
}

/**
 * Valid state transitions
 * Defines which states can transition to which other states
 */
const VALID_TRANSITIONS: Record<WorkflowState, WorkflowState[]> = {
  [WorkflowState.GREETING]: [
    WorkflowState.ASK_PROBLEM,
    WorkflowState.ERROR,
  ],

  [WorkflowState.ASK_PROBLEM]: [
    WorkflowState.CAPTURE_INTENT,
    WorkflowState.ASK_PROBLEM, // Can stay if unclear
    WorkflowState.ERROR,
  ],

  [WorkflowState.CAPTURE_INTENT]: [
    WorkflowState.MAP_SERVICE,
    WorkflowState.ASK_PROBLEM, // Loop back if no clear intent
    WorkflowState.ERROR,
  ],

  [WorkflowState.MAP_SERVICE]: [
    WorkflowState.EMPATHIZE,
    WorkflowState.ASK_PROBLEM, // Loop back if service unclear
    WorkflowState.ERROR,
  ],

  [WorkflowState.EMPATHIZE]: [
    WorkflowState.ASK_PHONE,
    WorkflowState.ERROR,
  ],

  [WorkflowState.ASK_PHONE]: [
    WorkflowState.LOOKUP_CUSTOMER,
    WorkflowState.ASK_PHONE, // Can stay if phone invalid
    WorkflowState.ERROR,
  ],

  [WorkflowState.LOOKUP_CUSTOMER]: [
    WorkflowState.WELCOMING_EXISTING,  // Customer found
    WorkflowState.CREATE_CUSTOMER,     // Customer not found
    WorkflowState.ASK_PHONE,           // Invalid phone, ask again
    WorkflowState.ERROR,
  ],

  [WorkflowState.CREATE_CUSTOMER]: [
    WorkflowState.ASK_NAME,
    WorkflowState.ERROR,
  ],

  [WorkflowState.ASK_NAME]: [
    WorkflowState.ASK_CITY,
    WorkflowState.ASK_NAME, // Can stay if name unclear
    WorkflowState.ERROR,
  ],

  [WorkflowState.ASK_CITY]: [
    WorkflowState.ASK_ADDRESS,
    WorkflowState.ASK_CITY, // Can stay if city unclear
    WorkflowState.ERROR,
  ],

  [WorkflowState.ASK_ADDRESS]: [
    WorkflowState.ASK_AVAILABILITY,
    WorkflowState.ASK_ADDRESS, // Can stay if address unclear
    WorkflowState.ERROR,
  ],

  [WorkflowState.WELCOMING_EXISTING]: [
    WorkflowState.ASK_AVAILABILITY,
    WorkflowState.ERROR,
  ],

  [WorkflowState.ASK_AVAILABILITY]: [
    WorkflowState.CREATE_TASK,
    WorkflowState.ASK_AVAILABILITY, // Can stay if time slot unavailable
    WorkflowState.ERROR,
  ],

  [WorkflowState.CREATE_TASK]: [
    WorkflowState.CREATE_BOOKING,
    WorkflowState.ASK_AVAILABILITY, // Retry if task creation fails
    WorkflowState.ERROR,
  ],

  [WorkflowState.CREATE_BOOKING]: [
    WorkflowState.CONFIRMATION,
    WorkflowState.ASK_AVAILABILITY, // Retry if booking fails
    WorkflowState.ERROR,
  ],

  [WorkflowState.CONFIRMATION]: [
    WorkflowState.DONE,
  ],

  [WorkflowState.DONE]: [
    // Terminal state - no transitions
  ],

  [WorkflowState.ERROR]: [
    WorkflowState.FALLBACK,
    WorkflowState.DONE,
  ],

  [WorkflowState.FALLBACK]: [
    WorkflowState.DONE,
  ],
};

/**
 * State Machine Service
 */
export class StateMachineService {
  /**
   * Validate state transition
   */
  isValidTransition(fromState: WorkflowState, toState: WorkflowState): boolean {
    const allowedTransitions = VALID_TRANSITIONS[fromState];
    return allowedTransitions ? allowedTransitions.includes(toState) : false;
  }

  /**
   * Get allowed transitions from current state
   */
  getAllowedTransitions(currentState: WorkflowState): WorkflowState[] {
    return VALID_TRANSITIONS[currentState] || [];
  }

  /**
   * Validate and execute state transition
   * @throws Error if transition is invalid
   */
  transition(fromState: WorkflowState, toState: WorkflowState): WorkflowState {
    if (!this.isValidTransition(fromState, toState)) {
      throw new Error(
        `Invalid state transition: ${fromState} -> ${toState}. ` +
        `Allowed transitions: ${this.getAllowedTransitions(fromState).join(', ')}`
      );
    }

    console.log(`[StateMachine] Transitioning: ${fromState} → ${toState}`);
    return toState;
  }

  /**
   * Check if state is terminal
   */
  isTerminalState(state: WorkflowState): boolean {
    return state === WorkflowState.DONE || state === WorkflowState.FALLBACK;
  }

  /**
   * Check if state is error state
   */
  isErrorState(state: WorkflowState): boolean {
    return state === WorkflowState.ERROR || state === WorkflowState.FALLBACK;
  }

  /**
   * Get next logical state based on current state and conditions
   */
  getNextState(args: {
    currentState: WorkflowState;
    hasCustomer?: boolean;
    hasService?: boolean;
    hasPhone?: boolean;
    hasName?: boolean;
    hasAddress?: boolean;
    hasAvailability?: boolean;
    taskCreated?: boolean;
    bookingCreated?: boolean;
    error?: boolean;
  }): WorkflowState {
    const { currentState } = args;

    // Handle errors
    if (args.error) {
      return WorkflowState.ERROR;
    }

    // State-specific logic
    switch (currentState) {
      case WorkflowState.GREETING:
        return WorkflowState.ASK_PROBLEM;

      case WorkflowState.ASK_PROBLEM:
        return WorkflowState.CAPTURE_INTENT;

      case WorkflowState.CAPTURE_INTENT:
        return WorkflowState.MAP_SERVICE;

      case WorkflowState.MAP_SERVICE:
        if (args.hasService) {
          return WorkflowState.EMPATHIZE;
        }
        return WorkflowState.ASK_PROBLEM;

      case WorkflowState.EMPATHIZE:
        return WorkflowState.ASK_PHONE;

      case WorkflowState.ASK_PHONE:
        if (args.hasPhone) {
          return WorkflowState.LOOKUP_CUSTOMER;
        }
        return WorkflowState.ASK_PHONE;

      case WorkflowState.LOOKUP_CUSTOMER:
        if (args.hasCustomer) {
          return WorkflowState.WELCOMING_EXISTING;
        }
        return WorkflowState.CREATE_CUSTOMER;

      case WorkflowState.CREATE_CUSTOMER:
        return WorkflowState.ASK_NAME;

      case WorkflowState.ASK_NAME:
        if (args.hasName) {
          return WorkflowState.ASK_CITY;
        }
        return WorkflowState.ASK_NAME;

      case WorkflowState.ASK_CITY:
        return WorkflowState.ASK_ADDRESS;

      case WorkflowState.ASK_ADDRESS:
        if (args.hasAddress) {
          return WorkflowState.ASK_AVAILABILITY;
        }
        return WorkflowState.ASK_ADDRESS;

      case WorkflowState.WELCOMING_EXISTING:
        return WorkflowState.ASK_AVAILABILITY;

      case WorkflowState.ASK_AVAILABILITY:
        if (args.hasAvailability) {
          return WorkflowState.CREATE_TASK;
        }
        return WorkflowState.ASK_AVAILABILITY;

      case WorkflowState.CREATE_TASK:
        if (args.taskCreated) {
          return WorkflowState.CREATE_BOOKING;
        }
        return WorkflowState.ASK_AVAILABILITY;

      case WorkflowState.CREATE_BOOKING:
        if (args.bookingCreated) {
          return WorkflowState.CONFIRMATION;
        }
        return WorkflowState.ASK_AVAILABILITY;

      case WorkflowState.CONFIRMATION:
        return WorkflowState.DONE;

      case WorkflowState.ERROR:
        return WorkflowState.FALLBACK;

      case WorkflowState.FALLBACK:
      case WorkflowState.DONE:
        return currentState;

      default:
        console.warn(`[StateMachine] Unknown state: ${currentState}`);
        return WorkflowState.ERROR;
    }
  }

  /**
   * Get state description for logging/debugging
   */
  getStateDescription(state: WorkflowState): string {
    const descriptions: Record<WorkflowState, string> = {
      [WorkflowState.GREETING]: 'Initial greeting and welcome',
      [WorkflowState.ASK_PROBLEM]: 'Asking customer what problem they have',
      [WorkflowState.CAPTURE_INTENT]: 'Capturing customer intent from description',
      [WorkflowState.MAP_SERVICE]: 'Mapping problem to available service category',
      [WorkflowState.EMPATHIZE]: 'Empathizing with customer problem',
      [WorkflowState.ASK_PHONE]: 'Asking for customer phone number',
      [WorkflowState.LOOKUP_CUSTOMER]: 'Looking up customer in database',
      [WorkflowState.CREATE_CUSTOMER]: 'Creating new customer record',
      [WorkflowState.ASK_NAME]: 'Asking for customer name',
      [WorkflowState.ASK_CITY]: 'Asking for customer city',
      [WorkflowState.ASK_ADDRESS]: 'Asking for street address',
      [WorkflowState.WELCOMING_EXISTING]: 'Welcoming returning customer',
      [WorkflowState.ASK_AVAILABILITY]: 'Asking for preferred date/time',
      [WorkflowState.CREATE_TASK]: 'Creating service task',
      [WorkflowState.CREATE_BOOKING]: 'Creating calendar booking',
      [WorkflowState.CONFIRMATION]: 'Confirming booking details',
      [WorkflowState.DONE]: 'Workflow completed successfully',
      [WorkflowState.ERROR]: 'Error occurred during workflow',
      [WorkflowState.FALLBACK]: 'Fallback to manual handling',
    };

    return descriptions[state] || 'Unknown state';
  }
}

/**
 * Singleton instance
 */
let instance: StateMachineService | null = null;

export function getStateMachineService(): StateMachineService {
  if (!instance) {
    instance = new StateMachineService();
  }
  return instance;
}
