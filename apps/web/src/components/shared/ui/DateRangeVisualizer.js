import React from 'react';
import { Calendar } from 'lucide-react';
import { formatFriendlyDate } from '../../../lib/frontEndFormatterService';
import { parseDateSafe } from '../../../lib/utils/dateUtils';
// Inline calculateDateRangeProgress (UI-specific utility)
function calculateDateRangeProgress(startDateString, endDateString) {
    if (!startDateString || !endDateString)
        return null;
    // Use date-fns parseISO for safe date parsing (handles YYYY-MM-DD as local dates)
    const startDate = parseDateSafe(startDateString);
    const endDate = parseDateSafe(endDateString);
    if (!startDate || !endDate)
        return null;
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
/**
 * DateRangeVisualizer - Simple Linear Timeline
 *
 * A minimal, clean visualization featuring:
 * - Simple horizontal line (solid for passed, dotted for remaining)
 * - Total duration in weeks, days, and hours
 * - Calendar dates at start and end
 */
export function DateRangeVisualizer({ startDate, endDate, className = '' }) {
    const progress = calculateDateRangeProgress(startDate, endDate);
    // Single date handling
    if (!progress) {
        return (React.createElement("div", { className: `text-sm text-dark-600 ${className}` },
            startDate && !endDate && (React.createElement("div", { className: "flex items-center gap-2" },
                React.createElement(Calendar, { className: "h-4 w-4" }),
                React.createElement("span", null, formatFriendlyDate(startDate)))),
            !startDate && endDate && (React.createElement("div", { className: "flex items-center gap-2" },
                React.createElement(Calendar, { className: "h-4 w-4" }),
                React.createElement("span", null,
                    "Due: ",
                    formatFriendlyDate(endDate)))),
            !startDate && !endDate && React.createElement("span", null, "-")));
    }
    const { progressPercent, daysPassed, daysRemaining, totalDays } = progress;
    // Calculate weeks and hours
    const totalWeeks = Math.floor(totalDays / 7);
    const totalHours = totalDays * 24;
    const passedHours = daysPassed * 24;
    const remainingHours = daysRemaining * 24;
    return (React.createElement("div", { className: `${className}` },
        React.createElement("div", { className: "space-y-2" },
            React.createElement("div", { className: "flex items-center justify-between text-xs text-dark-700 font-medium" },
                React.createElement("div", { className: "flex items-center gap-1" },
                    React.createElement(Calendar, { className: "h-3.5 w-3.5" }),
                    React.createElement("span", null, formatFriendlyDate(startDate))),
                React.createElement("div", { className: "flex items-center gap-3" },
                    React.createElement("span", null,
                        totalWeeks,
                        " weeks"),
                    React.createElement("span", null, "\u2022"),
                    React.createElement("span", null,
                        totalDays,
                        " days"),
                    React.createElement("span", null, "\u2022"),
                    React.createElement("span", null,
                        totalHours.toLocaleString(),
                        " hours")),
                React.createElement("div", { className: "flex items-center gap-1" },
                    React.createElement("span", null, formatFriendlyDate(endDate)),
                    React.createElement(Calendar, { className: "h-3.5 w-3.5" }))),
            React.createElement("div", { className: "relative flex items-center" },
                React.createElement("div", { style: {
                        flex: progressPercent,
                        height: '2px',
                        borderTop: '2px solid #D1D5DB',
                    } }),
                React.createElement("div", { style: {
                        flex: 100 - progressPercent,
                        height: '2px',
                        borderTop: '2px dotted #D1D5DB',
                    } })),
            React.createElement("div", { className: "flex items-center justify-between text-xs text-dark-700" },
                React.createElement("span", null,
                    daysPassed,
                    " days passed \u2022 ",
                    passedHours.toLocaleString(),
                    " hours"),
                React.createElement("span", null,
                    daysRemaining,
                    " days remaining \u2022 ",
                    remainingHours.toLocaleString(),
                    " hours")))));
}
