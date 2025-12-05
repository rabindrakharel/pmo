import React from 'react';
import { X, Edit2, Trash2, User, Clock, MapPin, Video, FileText } from 'lucide-react';

/**
 * CalendarEventPopover Component
 *
 * Popover that displays event details when clicking on a calendar event.
 * Provides quick actions for editing and deleting events, similar to Google Calendar.
 */

interface CalendarEventPopoverProps {
  event: any;
  person: { id: string; name: string; type: string; email?: string } | undefined;
  position: { x: number; y: number };
  onClose: () => void;
  onEdit: (event: any) => void;
  onDelete: (eventId: string) => void;
}

export function CalendarEventPopover({
  event,
  person,
  position,
  onClose,
  onEdit,
  onDelete
}: CalendarEventPopoverProps) {
  const isAvailable = event.availability_flag === true;
  const isBooked = event.availability_flag === false;

  // Format date and time
  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDuration = (fromTs: string, toTs: string) => {
    const from = new Date(fromTs);
    const to = new Date(toTs);
    const durationMs = to.getTime() - from.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0 && minutes > 0) {
      return `${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${minutes}m`;
    }
  };

  // Color scheme based on person type
  const getColorScheme = () => {
    if (isAvailable) {
      return {
        bg: 'bg-green-50',
        border: 'border-green-300',
        text: 'text-green-800',
        badge: 'bg-green-100 text-green-700'
      };
    }

    if (person?.type === 'employee') {
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-300',
        text: 'text-blue-800',
        badge: 'bg-blue-100 text-blue-700'
      };
    }

    return {
      bg: 'bg-purple-50',
      border: 'border-purple-300',
      text: 'text-purple-800',
      badge: 'bg-purple-100 text-purple-700'
    };
  };

  const colors = getColorScheme();

  // Calculate position to keep popover on screen
  const getPopoverStyle = (): React.CSSProperties => {
    const popoverWidth = 280;
    const popoverHeight = 300;
    const padding = 12;

    let x = position.x + 8;
    let y = position.y;

    // Adjust if too far right
    if (x + popoverWidth > window.innerWidth - padding) {
      x = position.x - popoverWidth - 8;
    }

    // Adjust if too far down
    if (y + popoverHeight > window.innerHeight - padding) {
      y = window.innerHeight - popoverHeight - padding;
    }

    // Adjust if too far up
    if (y < padding) {
      y = padding;
    }

    return {
      position: 'fixed',
      top: `${y}px`,
      left: `${x}px`,
      zIndex: 1000
    };
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[999]"
        onClick={onClose}
      />

      {/* Popover */}
      <div
        style={getPopoverStyle()}
        className={`${colors.bg} ${colors.border} border rounded-md shadow-lg w-[280px] overflow-hidden z-[1000]`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`${colors.badge} px-3 py-2 flex items-center justify-between border-b ${colors.border}`}>
          <h3 className={`${colors.text} font-medium text-xs truncate flex-1`}>
            {isAvailable ? 'Available' : (event.title || 'Booked')}
          </h3>
          <button
            onClick={onClose}
            className={`${colors.text} hover:opacity-70 transition-opacity ml-2`}
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-2.5 space-y-2 bg-white">
          {/* Time Information */}
          <div className="flex items-center gap-2">
            <Clock className={`h-3.5 w-3.5 ${colors.text} flex-shrink-0`} />
            <div className="flex-1 min-w-0 text-xs">
              <span className="text-dark-600 font-medium">{formatTime(event.from_ts)} - {formatTime(event.to_ts)}</span>
              <span className="text-dark-500 ml-1">({formatDuration(event.from_ts, event.to_ts)})</span>
            </div>
          </div>

          {/* Person Information */}
          {person && (
            <div className="flex items-center gap-2">
              <User className={`h-3.5 w-3.5 ${colors.text} flex-shrink-0`} />
              <div className="flex-1 min-w-0 text-xs truncate">
                <span className="text-dark-600 font-medium">{person.name}</span>
                <span className="text-dark-500 ml-1">({person.type === 'employee' ? 'Emp' : 'Cust'})</span>
              </div>
            </div>
          )}

          {/* Location/Medium (for booked appointments) */}
          {!isAvailable && event.appointment_medium && (
            <div className="flex items-center gap-2">
              {event.appointment_medium === 'onsite' ? (
                <MapPin className={`h-3.5 w-3.5 ${colors.text} flex-shrink-0`} />
              ) : (
                <Video className={`h-3.5 w-3.5 ${colors.text} flex-shrink-0`} />
              )}
              <div className="flex-1 min-w-0 text-xs truncate text-dark-600">
                {event.appointment_medium === 'onsite' ? 'On-site' : 'Virtual'}
                {event.appointment_addr && ` • ${event.appointment_addr}`}
              </div>
            </div>
          )}

          {/* Instructions */}
          {!isAvailable && event.instructions && (
            <div className="flex items-start gap-2">
              <FileText className={`h-3.5 w-3.5 ${colors.text} flex-shrink-0 mt-0.5`} />
              <div className="flex-1 min-w-0 text-xs text-dark-600 line-clamp-2">
                {event.instructions}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 p-2 bg-dark-50 border-t border-dark-200">
          <button
            onClick={() => onEdit(event)}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-slate-600 text-white rounded hover:bg-slate-700 transition-colors text-xs font-medium"
          >
            <Edit2 className="h-3 w-3" />
            Edit
          </button>
          <button
            onClick={() => onDelete(event.id)}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-xs font-medium"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
        </div>
      </div>
    </>
  );
}
