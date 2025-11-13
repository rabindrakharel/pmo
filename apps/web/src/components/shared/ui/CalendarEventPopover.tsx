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
    const popoverWidth = 360;
    const popoverHeight = 400;
    const padding = 16;

    let x = position.x + 10;
    let y = position.y;

    // Adjust if too far right
    if (x + popoverWidth > window.innerWidth - padding) {
      x = position.x - popoverWidth - 10;
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
        className={`${colors.bg} ${colors.border} border-2 rounded-md shadow-sm w-[360px] overflow-hidden z-[1000]`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`${colors.badge} px-4 py-3 flex items-start justify-between border-b ${colors.border}`}>
          <div className="flex-1 pr-2">
            <h3 className={`${colors.text} font-semibold text-base leading-tight`}>
              {isAvailable ? 'Available Slot' : (event.title || 'Booked Appointment')}
            </h3>
            {!isAvailable && event.title && (
              <p className={`${colors.text} opacity-75 text-sm mt-0.5`}>
                {isBooked ? 'Appointment' : 'Event'}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className={`${colors.text} hover:opacity-70 transition-opacity flex-shrink-0`}
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 bg-white">
          {/* Time Information */}
          <div className="flex items-start gap-3">
            <Clock className={`h-5 w-5 ${colors.text} flex-shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-dark-600">
                {formatDateTime(event.from_ts)}
              </div>
              <div className="text-sm text-dark-700 mt-1">
                {formatTime(event.from_ts)} - {formatTime(event.to_ts)}
              </div>
              <div className="text-xs text-dark-700 mt-0.5">
                Duration: {formatDuration(event.from_ts, event.to_ts)}
              </div>
            </div>
          </div>

          {/* Person Information */}
          {person && (
            <div className="flex items-start gap-3">
              <User className={`h-5 w-5 ${colors.text} flex-shrink-0 mt-0.5`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-dark-600">
                  {person.name}
                </div>
                <div className="text-xs text-dark-700 mt-0.5">
                  {person.type === 'employee' ? 'Employee' : 'Customer'}
                  {person.email && ` • ${person.email}`}
                </div>
              </div>
            </div>
          )}

          {/* Location/Medium (for booked appointments) */}
          {!isAvailable && (
            <>
              {event.appointment_medium && (
                <div className="flex items-start gap-3">
                  {event.appointment_medium === 'onsite' ? (
                    <MapPin className={`h-5 w-5 ${colors.text} flex-shrink-0 mt-0.5`} />
                  ) : (
                    <Video className={`h-5 w-5 ${colors.text} flex-shrink-0 mt-0.5`} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-dark-600">
                      {event.appointment_medium === 'onsite' ? 'On-site Meeting' : 'Virtual Meeting'}
                    </div>
                    {event.appointment_addr && (
                      <div className="text-xs text-dark-700 mt-0.5 break-words">
                        {event.appointment_addr}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Instructions */}
              {event.instructions && (
                <div className="flex items-start gap-3">
                  <FileText className={`h-5 w-5 ${colors.text} flex-shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-dark-600">
                      Special Instructions
                    </div>
                    <div className="text-xs text-dark-700 mt-0.5 whitespace-pre-wrap">
                      {event.instructions}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Status Badge */}
          <div className="pt-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colors.badge}`}>
              {isAvailable ? '🟢 Available' : '🔴 Booked'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 p-3 bg-dark-50 border-t border-dark-200">
          <button
            onClick={() => onEdit(event)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 transition-colors text-sm font-medium"
          >
            <Edit2 className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            onClick={() => onDelete(event.id)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </div>
    </>
  );
}
