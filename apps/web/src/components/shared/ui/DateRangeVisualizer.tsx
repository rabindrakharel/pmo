import React from 'react';
import { Calendar } from 'lucide-react';
import { formatFriendlyDate } from '../../../lib/universalFormatterService';

// Inline calculateDateRangeProgress (UI-specific utility)
function calculateDateRangeProgress(
  startDateString: string | Date | null | undefined,
  endDateString: string | Date | null | undefined
) {
  if (!startDateString || !endDateString) return null;

  const startDate = typeof startDateString === 'string' ? new Date(startDateString) : startDateString;
  const endDate = typeof endDateString === 'string' ? new Date(endDateString) : endDateString;
  const today = new Date();

  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysPassed = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const progressPercent = totalDays > 0 ? Math.max(0, Math.min(100, (daysPassed / totalDays) * 100)) : 0;

  const isBeforeStart = today < startDate;
  const isAfterEnd = today > endDate;
  const isActive = !isBeforeStart && !isAfterEnd;

  return {
    startDate,
    endDate,
    today,
    totalDays,
    daysPassed: Math.max(0, daysPassed),
    daysRemaining: Math.max(0, daysRemaining),
    progressPercent,
    isBeforeStart,
    isAfterEnd,
    isActive
  };
}

interface DateRangeVisualizerProps {
  startDate: string | Date | null | undefined;
  endDate: string | Date | null | undefined;
  className?: string;
}

/**
 * DateRangeVisualizer - Simple Linear Timeline
 *
 * A minimal, clean visualization featuring:
 * - Simple horizontal line (solid for passed, dotted for remaining)
 * - Total duration in weeks, days, and hours
 * - Calendar dates at start and end
 */
export function DateRangeVisualizer({ startDate, endDate, className = '' }: DateRangeVisualizerProps) {
  const progress = calculateDateRangeProgress(startDate, endDate);

  // Single date handling
  if (!progress) {
    return (
      <div className={`text-sm text-dark-600 ${className}`}>
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

  const { progressPercent, daysPassed, daysRemaining, totalDays } = progress;

  // Calculate weeks and hours
  const totalWeeks = Math.floor(totalDays / 7);
  const totalHours = totalDays * 24;
  const passedHours = daysPassed * 24;
  const remainingHours = daysRemaining * 24;

  return (
    <div className={`${className}`}>
      <div className="space-y-2">
        {/* Duration Summary */}
        <div className="flex items-center justify-between text-xs text-dark-700 font-medium">
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>{formatFriendlyDate(startDate)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span>{totalWeeks} weeks</span>
            <span>•</span>
            <span>{totalDays} days</span>
            <span>•</span>
            <span>{totalHours.toLocaleString()} hours</span>
          </div>
          <div className="flex items-center gap-1">
            <span>{formatFriendlyDate(endDate)}</span>
            <Calendar className="h-3.5 w-3.5" />
          </div>
        </div>

        {/* Timeline Bar */}
        <div className="relative flex items-center">
          {/* Passed - Solid Line */}
          <div
            style={{
              flex: progressPercent,
              height: '2px',
              borderTop: '2px solid #D1D5DB',
            }}
          />
          {/* Remaining - Dotted Line */}
          <div
            style={{
              flex: 100 - progressPercent,
              height: '2px',
              borderTop: '2px dotted #D1D5DB',
            }}
          />
        </div>

        {/* Progress Details */}
        <div className="flex items-center justify-between text-xs text-dark-700">
          <span>{daysPassed} days passed • {passedHours.toLocaleString()} hours</span>
          <span>{daysRemaining} days remaining • {remainingHours.toLocaleString()} hours</span>
        </div>
      </div>
    </div>
  );
}
