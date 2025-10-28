import React from 'react';
import { Calendar, TrendingUp } from 'lucide-react';
import { calculateDateRangeProgress, formatFriendlyDate } from '../../../lib/dataTransformers';

interface DateRangeVisualizerProps {
  startDate: string | Date | null | undefined;
  endDate: string | Date | null | undefined;
  className?: string;
}

/**
 * DateRangeVisualizer Component
 *
 * Displays an elegant visualization of a date range with:
 * - Start and end date points
 * - Current progress indicator
 * - Days passed and remaining
 * - Visual progress bar
 *
 * Used for project timelines, task durations, etc.
 */
export function DateRangeVisualizer({ startDate, endDate, className = '' }: DateRangeVisualizerProps) {
  const progress = calculateDateRangeProgress(startDate, endDate);

  if (!progress) {
    return (
      <div className={`text-sm text-gray-400 ${className}`}>
        {startDate && !endDate && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>{formatFriendlyDate(startDate)}</span>
          </div>
        )}
        {!startDate && endDate && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>Due: {formatFriendlyDate(endDate)}</span>
          </div>
        )}
        {!startDate && !endDate && <span>-</span>}
      </div>
    );
  }

  const { progressPercent, daysPassed, daysRemaining, isBeforeStart, isAfterEnd, isActive } = progress;

  // Determine status color
  let statusColor = 'bg-blue-500';
  let statusText = 'Active';
  let textColor = 'text-blue-700';
  let bgColor = 'bg-blue-50';
  let borderColor = 'border-blue-200';

  if (isBeforeStart) {
    statusColor = 'bg-gray-400';
    statusText = 'Not Started';
    textColor = 'text-gray-600';
    bgColor = 'bg-gray-50';
    borderColor = 'border-gray-200';
  } else if (isAfterEnd) {
    statusColor = 'bg-gray-500';
    statusText = 'Completed';
    textColor = 'text-gray-700';
    bgColor = 'bg-gray-50';
    borderColor = 'border-gray-300';
  } else if (progressPercent > 75) {
    statusColor = 'bg-amber-500';
    textColor = 'text-amber-700';
    bgColor = 'bg-amber-50';
    borderColor = 'border-amber-200';
  }

  return (
    <div className={`${bgColor} ${borderColor} border rounded-lg p-3 ${className}`}>
      {/* Header with dates */}
      <div className="flex items-center justify-between mb-2.5 text-xs">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-gray-500" />
          <span className="font-medium text-gray-700">{formatFriendlyDate(startDate)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-gray-700">{formatFriendlyDate(endDate)}</span>
          <Calendar className="h-3.5 w-3.5 text-gray-500" />
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 bg-gray-200 rounded-full mb-2 overflow-hidden">
        <div
          className={`absolute top-0 left-0 h-full ${statusColor} transition-all duration-300 rounded-full`}
          style={{ width: `${progressPercent}%` }}
        />
        {/* Today marker */}
        {isActive && (
          <div
            className="absolute top-0 h-full w-0.5 bg-gray-800"
            style={{ left: `${progressPercent}%` }}
          >
            <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-gray-800 rounded-full border-2 border-white" />
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className={`font-medium ${textColor}`}>
            {daysPassed} {daysPassed === 1 ? 'day' : 'days'} passed
          </span>
          <span className="text-gray-400">·</span>
          <span className={`font-medium ${textColor}`}>
            {isAfterEnd ? '0 days' : `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}`} remaining
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-gray-500" />
          <span className="font-semibold text-gray-700">{Math.round(progressPercent)}%</span>
        </div>
      </div>
    </div>
  );
}
