import React from 'react';

/**
 * SequentialStateVisualizer
 *
 * Displays a horizontal timeline visualization for sequential states (stages, funnels, etc.)
 * Shows all available states connected by dotted lines with the current state highlighted
 *
 * Used for:
 * - Project stages (Initiation → Planning → Execution → Monitoring → Closure)
 * - Task stages (Backlog → To Do → In Progress → In Review → Done → Blocked)
 * - Opportunity funnel (Lead → Qualified → Proposal Sent → Contract Signed, etc.)
 */

export interface StateOption {
  value: string | number;
  label: string;
  sort_order?: number;
  metadata?: {
    sort_order?: number;
    [key: string]: any;
  };
}

interface SequentialStateVisualizerProps {
  /** All possible states in order */
  states: StateOption[];
  /** Current active state value */
  currentState: string;
  /** Optional: custom class name */
  className?: string;
  /** Optional: enable interactive mode where states can be clicked */
  editable?: boolean;
  /** Optional: callback when a state is clicked (only works if editable=true) */
  onStateChange?: (newState: string | number) => void;
}

export function SequentialStateVisualizer({
  states,
  currentState,
  className = '',
  editable = false,
  onStateChange
}: SequentialStateVisualizerProps) {
  // Sort states by sort_order if available
  const sortedStates = [...states].sort((a, b) => {
    const orderA = a.sort_order ?? a.metadata?.sort_order ?? 999;
    const orderB = b.sort_order ?? b.metadata?.sort_order ?? 999;
    return orderA - orderB;
  });

  // Find current state index
  const currentIndex = sortedStates.findIndex(
    state => String(state.value) === String(currentState)
  );

  if (sortedStates.length === 0) {
    return null;
  }

  // Handle state click
  const handleStateClick = (state: StateOption) => {
    if (editable && onStateChange) {
      onStateChange(state.value);
    }
  };

  return (
    <div className={`py-4 ${className}`}>
      <div className="flex items-center justify-between">
        {sortedStates.map((state, index) => {
          const isActive = index === currentIndex;
          const isPast = currentIndex >= 0 && index < currentIndex;
          const isFuture = currentIndex >= 0 && index > currentIndex;

          return (
            <React.Fragment key={state.value}>
              {/* State Node */}
              <div className="flex flex-col items-center flex-1 min-w-0">
                {/* Circle */}
                <div
                  onClick={() => handleStateClick(state)}
                  className={`
                    w-4 h-4 rounded-full flex items-center justify-center
                    transition-all duration-200
                    ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md scale-110 ring-2 ring-blue-200'
                        : isPast
                        ? 'bg-blue-400 text-white'
                        : 'bg-gray-200 text-gray-400'
                    }
                    ${
                      editable
                        ? 'cursor-pointer hover:scale-125 hover:shadow-lg active:scale-105'
                        : ''
                    }
                  `}
                  title={editable ? `Click to set state to "${state.label}"` : state.label}
                >
                  {isActive ? (
                    <svg
                      className="w-2.5 h-2.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : isPast ? (
                    <svg
                      className="w-2 h-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
                  )}
                </div>

                {/* Label */}
                <div
                  onClick={() => handleStateClick(state)}
                  className={`
                    mt-2 text-xs text-center px-2 py-1 rounded transition-all duration-200
                    ${
                      isActive
                        ? 'font-semibold text-blue-900 bg-blue-50'
                        : isPast
                        ? 'font-medium text-blue-700'
                        : 'text-gray-400'
                    }
                    ${
                      editable
                        ? 'cursor-pointer hover:bg-blue-100 hover:text-blue-800'
                        : ''
                    }
                  `}
                  style={{
                    fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
                    fontSize: isActive ? '13px' : '11px',
                    maxWidth: '120px',
                    wordBreak: 'break-word'
                  }}
                >
                  {state.label}
                </div>
              </div>

              {/* Connector Line (except after last item) */}
              {index < sortedStates.length - 1 && (
                <div
                  className={`
                    h-0.5 flex-1 mx-2 transition-all duration-200
                    ${
                      isPast || (isActive && index < currentIndex)
                        ? 'bg-blue-400'
                        : 'border-t-2 border-dashed border-gray-300'
                    }
                  `}
                  style={{
                    minWidth: '40px',
                    maxWidth: '80px'
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
