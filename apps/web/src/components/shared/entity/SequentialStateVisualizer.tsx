import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * SequentialStateVisualizer
 *
 * Displays sequential states (stages, funnels, etc.) with consistent styling
 * Shows all available states connected by lines with the current state highlighted
 *
 * Display Modes:
 * - 'horizontal' - Horizontal timeline with solid/dotted lines (default)
 * - 'compact' - Compact bar with progress indicator
 * - 'arc' - Circular arc progress indicator
 * - 'segmented' - Segmented progress bar
 * - 'vertical' - Vertical timeline (space-efficient)
 *
 * Visualization Features:
 * - Consistent blue color scheme for all states
 * - Filled nodes for completed/current stages
 * - Hollow nodes for future stages
 * - Solid lines for completed progression, dotted for future
 * - Checkmark icon on current stage
 * - No bold text or shapes for clean appearance
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

export type DisplayMode = 'horizontal' | 'compact' | 'arc' | 'segmented' | 'vertical';

interface SequentialStateVisualizerProps {
  /** All possible states in order */
  states: StateOption[];
  /** Current active state value */
  currentState: string;
  /** Display mode - defaults to 'compact' for better space usage */
  mode?: DisplayMode;
  /** Optional: custom class name */
  className?: string;
  /** Optional: enable interactive mode where states can be clicked */
  editable?: boolean;
  /** Optional: callback when a state is clicked (only works if editable=true) */
  onStateChange?: (newState: string | number) => void;
  /** Optional: Field label to display */
  label?: string;
}

export function SequentialStateVisualizer({
  states,
  currentState,
  mode = 'horizontal',
  className = '',
  editable = false,
  onStateChange,
  label
}: SequentialStateVisualizerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

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

  // Calculate progress percentage
  const progressPercent = currentIndex >= 0 ? ((currentIndex + 1) / sortedStates.length) * 100 : 0;

  // Handle state click
  const handleStateClick = (state: StateOption) => {
    if (editable && onStateChange) {
      onStateChange(state.value);
    }
  };

  // Render based on mode
  switch (mode) {
    case 'compact':
      return <CompactMode
        sortedStates={sortedStates}
        currentIndex={currentIndex}
        progressPercent={progressPercent}
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
        handleStateClick={handleStateClick}
        editable={editable}
        className={className}
        label={label}
      />;

    case 'arc':
      return <ArcMode
        sortedStates={sortedStates}
        currentIndex={currentIndex}
        progressPercent={progressPercent}
        handleStateClick={handleStateClick}
        editable={editable}
        className={className}
        label={label}
      />;

    case 'segmented':
      return <SegmentedMode
        sortedStates={sortedStates}
        currentIndex={currentIndex}
        handleStateClick={handleStateClick}
        editable={editable}
        className={className}
        label={label}
      />;

    case 'vertical':
      return <VerticalMode
        sortedStates={sortedStates}
        currentIndex={currentIndex}
        handleStateClick={handleStateClick}
        editable={editable}
        className={className}
        label={label}
      />;

    case 'horizontal':
    default:
      return <HorizontalMode
        sortedStates={sortedStates}
        currentIndex={currentIndex}
        handleStateClick={handleStateClick}
        editable={editable}
        className={className}
      />;
  }
}

// ============================================================================
// Mode Components
// ============================================================================

interface ModeProps {
  sortedStates: StateOption[];
  currentIndex: number;
  handleStateClick: (state: StateOption) => void;
  editable: boolean;
  className: string;
  progressPercent?: number;
  isExpanded?: boolean;
  setIsExpanded?: (value: boolean) => void;
  label?: string;
}

/**
 * Compact Mode - Space-efficient with expandable details
 */
function CompactMode({
  sortedStates,
  currentIndex,
  progressPercent = 0,
  isExpanded = false,
  setIsExpanded,
  handleStateClick,
  editable,
  className,
  label
}: ModeProps) {
  const currentState = sortedStates[currentIndex];

  return (
    <div className={`space-y-2 ${className}`}>
      {label && <div className="text-xs font-medium text-gray-600 mb-1">{label}</div>}

      {/* Compact Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 shadow-sm border border-blue-100">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3">
              {/* Progress Circle */}
              <div className="relative w-12 h-12">
                <svg className="w-12 h-12 transform -rotate-90">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="#e5e7eb"
                    strokeWidth="3"
                    fill="none"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="#3b82f6"
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 20}`}
                    strokeDashoffset={`${2 * Math.PI * 20 * (1 - progressPercent / 100)}`}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-600">
                    {Math.round(progressPercent)}%
                  </span>
                </div>
              </div>

              {/* Current State Info */}
              <div className="flex-1">
                <div className="text-xs text-gray-500">
                  Stage {currentIndex + 1} of {sortedStates.length}
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  {currentState?.label || 'Unknown'}
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-3 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Expand/Collapse Button */}
          <button
            onClick={() => setIsExpanded?.(!isExpanded)}
            className="ml-3 p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-600" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 space-y-2">
          {sortedStates.map((state, index) => {
            const isActive = index === currentIndex;
            const isPast = currentIndex >= 0 && index < currentIndex;

            return (
              <div
                key={state.value}
                onClick={() => handleStateClick(state)}
                className={`
                  flex items-center space-x-3 p-2 rounded-lg transition-all duration-200
                  ${isActive ? 'bg-blue-50 border border-blue-200' : ''}
                  ${isPast ? 'bg-gray-50' : ''}
                  ${editable ? 'cursor-pointer hover:bg-blue-100' : ''}
                `}
              >
                {/* Step Number */}
                <div
                  className={`
                    flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium
                    ${isActive ? 'bg-blue-600 text-white' : ''}
                    ${isPast ? 'bg-blue-400 text-white' : ''}
                    ${!isActive && !isPast ? 'bg-gray-200 text-gray-500' : ''}
                  `}
                >
                  {isPast || isActive ? '✓' : index + 1}
                </div>

                {/* State Label */}
                <div className="flex-1">
                  <div
                    className={`
                      text-sm
                      ${isActive ? 'font-semibold text-blue-900' : ''}
                      ${isPast ? 'font-medium text-gray-700' : ''}
                      ${!isActive && !isPast ? 'text-gray-400' : ''}
                    `}
                  >
                    {state.label}
                  </div>
                </div>

                {/* Status Badge */}
                {isActive && (
                  <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                    Current
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Arc Mode - Circular progress indicator
 */
function ArcMode({
  sortedStates,
  currentIndex,
  progressPercent = 0,
  handleStateClick,
  editable,
  className,
  label
}: ModeProps) {
  const currentState = sortedStates[currentIndex];
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className={`flex flex-col items-center space-y-4 ${className}`}>
      {label && <div className="text-xs font-medium text-gray-600">{label}</div>}

      {/* Arc Circle */}
      <div className="relative">
        <svg width="160" height="160" className="transform -rotate-90">
          {/* Background Circle */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke="#e5e7eb"
            strokeWidth="12"
            fill="none"
          />
          {/* Progress Circle */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke="url(#gradient)"
            strokeWidth="12"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-3xl font-bold text-blue-600">
            {Math.round(progressPercent)}%
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {currentIndex + 1}/{sortedStates.length}
          </div>
        </div>
      </div>

      {/* Current State Label */}
      <div className="text-center">
        <div className="text-sm font-semibold text-gray-900">
          {currentState?.label || 'Unknown'}
        </div>
        <div className="text-xs text-gray-500 mt-1">Current Stage</div>
      </div>

      {/* State Pills */}
      <div className="flex flex-wrap gap-2 justify-center max-w-md">
        {sortedStates.map((state, index) => {
          const isActive = index === currentIndex;
          const isPast = currentIndex >= 0 && index < currentIndex;

          return (
            <button
              key={state.value}
              onClick={() => handleStateClick(state)}
              disabled={!editable}
              className={`
                px-3 py-1 rounded-full text-xs font-medium transition-all duration-200
                ${isActive ? 'bg-blue-600 text-white shadow-md' : ''}
                ${isPast ? 'bg-blue-100 text-blue-700' : ''}
                ${!isActive && !isPast ? 'bg-gray-100 text-gray-500' : ''}
                ${editable ? 'hover:scale-105 cursor-pointer' : 'cursor-default'}
              `}
            >
              {state.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Segmented Mode - Progress bar divided into segments
 */
function SegmentedMode({
  sortedStates,
  currentIndex,
  handleStateClick,
  editable,
  className,
  label
}: ModeProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {label && <div className="text-xs font-medium text-gray-600 mb-1">{label}</div>}

      <div className="flex items-center space-x-1">
        {sortedStates.map((state, index) => {
          const isActive = index === currentIndex;
          const isPast = currentIndex >= 0 && index < currentIndex;

          return (
            <div
              key={state.value}
              onClick={() => handleStateClick(state)}
              className={`
                flex-1 h-8 rounded-lg flex items-center justify-center text-xs font-medium
                transition-all duration-300 relative overflow-hidden
                ${isActive ? 'bg-blue-600 text-white shadow-lg scale-105 z-10' : ''}
                ${isPast ? 'bg-blue-400 text-white' : ''}
                ${!isActive && !isPast ? 'bg-gray-200 text-gray-500' : ''}
                ${editable ? 'cursor-pointer hover:scale-105 hover:z-20' : ''}
              `}
              title={state.label}
            >
              <div className="truncate px-2">{state.label}</div>
              {isActive && (
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              )}
            </div>
          );
        })}
      </div>

      {/* Current State Info */}
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>Stage {currentIndex + 1} of {sortedStates.length}</span>
        <span className="font-medium text-blue-600">
          {sortedStates[currentIndex]?.label}
        </span>
      </div>
    </div>
  );
}

/**
 * Vertical Mode - Vertical timeline (space-efficient)
 */
function VerticalMode({
  sortedStates,
  currentIndex,
  handleStateClick,
  editable,
  className,
  label
}: ModeProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {label && <div className="text-xs font-medium text-gray-600 mb-2">{label}</div>}

      <div className="relative pl-8">
        {/* Vertical Line */}
        <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200" />

        {sortedStates.map((state, index) => {
          const isActive = index === currentIndex;
          const isPast = currentIndex >= 0 && index < currentIndex;

          return (
            <div
              key={state.value}
              onClick={() => handleStateClick(state)}
              className={`
                relative flex items-center space-x-3 pb-4 transition-all duration-200
                ${editable ? 'cursor-pointer' : ''}
              `}
            >
              {/* Circle */}
              <div
                className={`
                  absolute left-[-1.375rem] w-5 h-5 rounded-full flex items-center justify-center
                  transition-all duration-200 border-2 bg-white
                  ${isActive ? 'border-blue-600 shadow-md scale-110' : ''}
                  ${isPast ? 'border-blue-400' : ''}
                  ${!isActive && !isPast ? 'border-gray-300' : ''}
                `}
              >
                {isPast || isActive ? (
                  <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-blue-600' : 'bg-blue-400'}`} />
                ) : null}
              </div>

              {/* Label */}
              <div
                className={`
                  text-sm px-3 py-1.5 rounded-lg transition-all duration-200
                  ${isActive ? 'font-semibold text-blue-900 bg-blue-50 border border-blue-200' : ''}
                  ${isPast ? 'font-medium text-gray-700' : ''}
                  ${!isActive && !isPast ? 'text-gray-400' : ''}
                  ${editable ? 'hover:bg-blue-100' : ''}
                `}
              >
                {state.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Horizontal Mode - Horizontal timeline with consistent styling
 */
function HorizontalMode({
  sortedStates,
  currentIndex,
  handleStateClick,
  editable,
  className
}: ModeProps) {
  // Single consistent color for all states
  const STATE_COLOR = '#6B7280'; // Gray for all states

  return (
    <div className={`py-4 ${className}`}>
      <div className="flex flex-col">
        {/* Top Row: Circles and Lines */}
        <div className="flex items-center mb-2">
          {sortedStates.map((state, index) => {
            const isActive = index === currentIndex;
            const isPast = currentIndex >= 0 && index < currentIndex;

            return (
              <React.Fragment key={state.value}>
                {/* Circle - Hollow with consistent color border */}
                <div
                  onClick={() => handleStateClick(state)}
                  className={`
                    w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0
                    transition-all duration-200 border-2
                    ${editable ? 'cursor-pointer hover:scale-110 active:scale-95' : ''}
                  `}
                  style={{
                    backgroundColor: isActive ? STATE_COLOR : 'white',
                    borderColor: STATE_COLOR,
                  }}
                  title={editable ? `Click to set state to "${state.label}"` : state.label}
                >
                  {isActive && (
                    <svg
                      className="w-2.5 h-2.5"
                      fill="none"
                      stroke="white"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>

                {/* Connector Line - Solid for completed, Dotted for future */}
                {index < sortedStates.length - 1 && (
                  <div
                    className="flex-1 transition-all duration-200"
                    style={{
                      height: '2px',
                      borderTop: isPast
                        ? `2px solid ${STATE_COLOR}`
                        : `2px dotted ${STATE_COLOR}`,
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Bottom Row: Labels */}
        <div className="flex items-start">
          {sortedStates.map((state, index) => {
            const isActive = index === currentIndex;

            return (
              <React.Fragment key={`label-${state.value}`}>
                {/* Label below circle - centered */}
                <div className="flex flex-col items-center" style={{ width: '16px', flexShrink: 0 }}>
                  <div
                    onClick={() => handleStateClick(state)}
                    className={`
                      text-xs text-center transition-all duration-200 text-gray-600
                      ${editable ? 'cursor-pointer hover:opacity-80' : ''}
                    `}
                    style={{
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {state.label}
                  </div>
                </div>

                {/* Spacer for alignment with connector lines */}
                {index < sortedStates.length - 1 && (
                  <div className="flex-1" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
