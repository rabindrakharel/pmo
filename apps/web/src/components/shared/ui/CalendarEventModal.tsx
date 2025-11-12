import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, Video, User, Save, Users, Link, Plus, FileText } from 'lucide-react';
import { SearchableMultiSelect } from './SearchableMultiSelect';

/**
 * CalendarEventModal Component
 *
 * Modal for creating calendar events with full event details or attaching existing events.
 * Supports unified booking service with event, calendar, RSVP, and notifications.
 */

interface CalendarEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventData: EventFormData) => Promise<void>;
  initialData?: CalendarEvent | null;
  mode: 'create' | 'edit';
  employees?: PersonEntity[];
  customers?: PersonEntity[];
}

export interface CalendarEvent {
  id?: string;
  person_entity_type: 'employee' | 'customer';
  person_entity_id: string;
  from_ts: string;
  to_ts: string;
  timezone?: string;
  availability_flag: boolean;
  title?: string;
  appointment_medium?: 'onsite' | 'virtual';
  appointment_addr?: string;
  instructions?: string;
  metadata?: Record<string, any>;
  event_id?: string;
}

export interface EventFormData {
  // Mode selection
  creation_mode?: 'new_event' | 'attach_existing';

  // Calendar slot fields
  person_entity_type: 'employee' | 'customer';
  person_entity_id: string;
  from_ts: string;
  to_ts: string;
  timezone?: string;
  availability_flag: boolean;

  // Event fields (when creating new event)
  event_code?: string;
  event_name?: string;
  event_descr?: string;
  event_type?: 'onsite' | 'virtual';
  event_platform_provider_name?: string;
  event_addr?: string;
  event_instructions?: string;
  event_metadata?: Record<string, any>;

  // Legacy fields (for compatibility)
  title?: string;
  appointment_medium?: 'onsite' | 'virtual';
  appointment_addr?: string;
  instructions?: string;

  // Attendees
  employee_ids?: string[];
  attendee_ids?: string[];

  // Attach existing event
  existing_event_id?: string;
}

interface PersonEntity {
  id: string;
  name: string;
  type: 'employee' | 'customer';
  email?: string;
}

interface ExistingEvent {
  id: string;
  code: string;
  name: string;
  descr: string;
  event_type: string;
  event_platform_provider_name: string;
  from_ts: string;
  to_ts: string;
}

export function CalendarEventModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  mode,
  employees = [],
  customers = []
}: CalendarEventModalProps) {
  const [activeTab, setActiveTab] = useState<'new_event' | 'attach_existing'>('new_event');
  const [formData, setFormData] = useState<EventFormData>({
    creation_mode: 'new_event',
    person_entity_type: 'employee',
    person_entity_id: '',
    from_ts: '',
    to_ts: '',
    timezone: 'America/Toronto',
    availability_flag: false, // Default to booked
    event_name: '',
    event_descr: '',
    event_type: 'onsite',
    event_platform_provider_name: 'office',
    event_addr: '',
    event_instructions: '',
    event_metadata: {},
    employee_ids: [],
    attendee_ids: []
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [existingEvents, setExistingEvents] = useState<ExistingEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Load existing events when tab switches to attach
  useEffect(() => {
    if (activeTab === 'attach_existing' && existingEvents.length === 0) {
      fetchExistingEvents();
    }
  }, [activeTab]);

  const fetchExistingEvents = async () => {
    setLoadingEvents(true);
    try {
      const token = localStorage.getItem('auth_token');
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

      const response = await fetch(`${apiBaseUrl}/api/v1/event?page=1&limit=100`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setExistingEvents(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch existing events:', error);
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    if (initialData) {
      setFormData({
        creation_mode: initialData.event_id ? 'attach_existing' : 'new_event',
        person_entity_type: initialData.person_entity_type,
        person_entity_id: initialData.person_entity_id,
        from_ts: initialData.from_ts,
        to_ts: initialData.to_ts,
        timezone: initialData.timezone || 'America/Toronto',
        availability_flag: initialData.availability_flag,
        event_name: initialData.title || '',
        event_descr: '',
        event_type: initialData.appointment_medium || 'onsite',
        event_platform_provider_name: 'office',
        event_addr: initialData.appointment_addr || '',
        event_instructions: initialData.instructions || '',
        event_metadata: initialData.metadata || {},
        employee_ids: initialData.metadata?.employee_ids || [],
        attendee_ids: initialData.metadata?.attendee_ids || [],
        existing_event_id: initialData.event_id
      });

      if (initialData.event_id) {
        setActiveTab('attach_existing');
      }
    }
  }, [initialData]);

  const handleChange = (field: keyof EventFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when field changes
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.person_entity_id) {
      newErrors.person_entity_id = 'Please select a primary person';
    }

    if (!formData.from_ts) {
      newErrors.from_ts = 'Start time is required';
    }
    if (!formData.to_ts) {
      newErrors.to_ts = 'End time is required';
    }
    if (formData.from_ts && formData.to_ts && new Date(formData.from_ts) >= new Date(formData.to_ts)) {
      newErrors.to_ts = 'End time must be after start time';
    }

    if (activeTab === 'new_event') {
      // Validate event creation fields
      if (!formData.event_name) {
        newErrors.event_name = 'Event name is required';
      }
      if (!formData.event_type) {
        newErrors.event_type = 'Event type is required';
      }
      if (!formData.event_platform_provider_name) {
        newErrors.event_platform_provider_name = 'Platform/venue is required';
      }

      // Require at least one attendee
      const hasEmployees = formData.employee_ids && formData.employee_ids.length > 0;
      const hasAttendees = formData.attendee_ids && formData.attendee_ids.length > 0;
      if (!hasEmployees && !hasAttendees) {
        newErrors.attendee_ids = 'Please select at least one employee or attendee';
      }
    } else {
      // Validate attach existing event
      if (!formData.existing_event_id) {
        newErrors.existing_event_id = 'Please select an event to attach';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      const dataToSave = {
        ...formData,
        creation_mode: activeTab
      };

      await onSave(dataToSave);
      onClose();
    } catch (error) {
      console.error('Failed to save event:', error);
      setErrors({ submit: 'Failed to save event. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const getPeople = () => {
    return formData.person_entity_type === 'employee' ? employees : customers;
  };

  // Get employee options for multi-select
  const getEmployeeOptions = () => {
    return employees.map(emp => ({
      value: emp.id,
      label: `${emp.name}${emp.email ? ' - ' + emp.email : ''}`
    }));
  };

  // Get all people (employees + customers) as options for multi-select
  const getAllPeopleOptions = () => {
    const employeeOptions = employees.map(emp => ({
      value: emp.id,
      label: `${emp.name} (Employee)${emp.email ? ' - ' + emp.email : ''}`
    }));
    const customerOptions = customers.map(cust => ({
      value: cust.id,
      label: `${cust.name} (Customer)${cust.email ? ' - ' + cust.email : ''}`
    }));
    return [...employeeOptions, ...customerOptions];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-300">
          <h2 className="text-xl font-semibold text-dark-600">
            {mode === 'create' ? 'Create Calendar Event' : 'Edit Calendar Event'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-dark-100 transition-colors"
          >
            <X className="h-5 w-5 text-dark-700" />
          </button>
        </div>

        {/* Tabs (only for create mode) */}
        {mode === 'create' && (
          <div className="flex border-b border-dark-300 px-6">
            <button
              onClick={() => setActiveTab('new_event')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'new_event'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-dark-600 hover:text-dark-700'
              }`}
            >
              <Plus className="inline h-4 w-4 mr-1" />
              Create New Event
            </button>
            <button
              onClick={() => setActiveTab('attach_existing')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'attach_existing'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-dark-600 hover:text-dark-700'
              }`}
            >
              <Link className="inline h-4 w-4 mr-1" />
              Attach Existing Event
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Person Type Selection */}
          <div>
            <label className="block text-sm font-medium text-dark-600 mb-2">
              Person Type
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="employee"
                  checked={formData.person_entity_type === 'employee'}
                  onChange={(e) => {
                    handleChange('person_entity_type', e.target.value as 'employee');
                    handleChange('person_entity_id', ''); // Reset person selection
                  }}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <User className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-dark-600">Employee</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="customer"
                  checked={formData.person_entity_type === 'customer'}
                  onChange={(e) => {
                    handleChange('person_entity_type', e.target.value as 'customer');
                    handleChange('person_entity_id', ''); // Reset person selection
                  }}
                  className="text-purple-600 focus:ring-purple-500"
                />
                <User className="h-4 w-4 text-purple-600" />
                <span className="text-sm text-dark-600">Customer</span>
              </label>
            </div>
          </div>

          {/* Primary Person Selection */}
          <div>
            <label className="block text-sm font-medium text-dark-600 mb-2">
              <User className="inline h-4 w-4 mr-1" />
              Primary Person *
            </label>
            <select
              value={formData.person_entity_id}
              onChange={(e) => handleChange('person_entity_id', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.person_entity_id ? 'border-red-500' : 'border-dark-400'
              }`}
            >
              <option value="">-- Select {formData.person_entity_type} --</option>
              {getPeople().map(person => (
                <option key={person.id} value={person.id}>
                  {person.name} {person.email ? `(${person.email})` : ''}
                </option>
              ))}
            </select>
            {errors.person_entity_id && (
              <p className="text-red-600 text-xs mt-1">{errors.person_entity_id}</p>
            )}
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-600 mb-2">
                <Clock className="inline h-4 w-4 mr-1" />
                Start Time *
              </label>
              <input
                type="datetime-local"
                value={formData.from_ts ? new Date(formData.from_ts).toISOString().slice(0, 16) : ''}
                onChange={(e) => handleChange('from_ts', new Date(e.target.value).toISOString())}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  errors.from_ts ? 'border-red-500' : 'border-dark-400'
                }`}
              />
              {errors.from_ts && (
                <p className="text-red-600 text-xs mt-1">{errors.from_ts}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-600 mb-2">
                <Clock className="inline h-4 w-4 mr-1" />
                End Time *
              </label>
              <input
                type="datetime-local"
                value={formData.to_ts ? new Date(formData.to_ts).toISOString().slice(0, 16) : ''}
                onChange={(e) => handleChange('to_ts', new Date(e.target.value).toISOString())}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  errors.to_ts ? 'border-red-500' : 'border-dark-400'
                }`}
              />
              {errors.to_ts && (
                <p className="text-red-600 text-xs mt-1">{errors.to_ts}</p>
              )}
            </div>
          </div>

          {/* TAB: Create New Event */}
          {activeTab === 'new_event' && (
            <>
              {/* Event Name */}
              <div>
                <label className="block text-sm font-medium text-dark-600 mb-2">
                  <Calendar className="inline h-4 w-4 mr-1" />
                  Event Name *
                </label>
                <input
                  type="text"
                  value={formData.event_name}
                  onChange={(e) => handleChange('event_name', e.target.value)}
                  placeholder="e.g., HVAC Consultation - Thompson Residence"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.event_name ? 'border-red-500' : 'border-dark-400'
                  }`}
                />
                {errors.event_name && (
                  <p className="text-red-600 text-xs mt-1">{errors.event_name}</p>
                )}
              </div>

              {/* Event Description */}
              <div>
                <label className="block text-sm font-medium text-dark-600 mb-2">
                  <FileText className="inline h-4 w-4 mr-1" />
                  Event Description
                </label>
                <textarea
                  value={formData.event_descr}
                  onChange={(e) => handleChange('event_descr', e.target.value)}
                  placeholder="Detailed description of the event..."
                  rows={3}
                  className="w-full px-3 py-2 border border-dark-400 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Event Type */}
              <div>
                <label className="block text-sm font-medium text-dark-600 mb-2">
                  Event Type *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="onsite"
                      checked={formData.event_type === 'onsite'}
                      onChange={(e) => handleChange('event_type', e.target.value)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <MapPin className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-dark-600">On-site</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="virtual"
                      checked={formData.event_type === 'virtual'}
                      onChange={(e) => handleChange('event_type', e.target.value)}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <Video className="h-4 w-4 text-purple-600" />
                    <span className="text-sm text-dark-600">Virtual</span>
                  </label>
                </div>
                {errors.event_type && (
                  <p className="text-red-600 text-xs mt-1">{errors.event_type}</p>
                )}
              </div>

              {/* Event Platform/Venue */}
              <div>
                <label className="block text-sm font-medium text-dark-600 mb-2">
                  Platform/Venue *
                </label>
                <select
                  value={formData.event_platform_provider_name}
                  onChange={(e) => handleChange('event_platform_provider_name', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.event_platform_provider_name ? 'border-red-500' : 'border-dark-400'
                  }`}
                >
                  <option value="">-- Select Platform/Venue --</option>
                  <option value="zoom">Zoom</option>
                  <option value="teams">Microsoft Teams</option>
                  <option value="google_meet">Google Meet</option>
                  <option value="physical_hall">Physical Hall</option>
                  <option value="office">Office</option>
                  <option value="customer_location">Customer Location</option>
                  <option value="other">Other</option>
                </select>
                {errors.event_platform_provider_name && (
                  <p className="text-red-600 text-xs mt-1">{errors.event_platform_provider_name}</p>
                )}
              </div>

              {/* Event Address/URL */}
              <div>
                <label className="block text-sm font-medium text-dark-600 mb-2">
                  {formData.event_type === 'onsite' ? (
                    <>
                      <MapPin className="inline h-4 w-4 mr-1" />
                      Location Address
                    </>
                  ) : (
                    <>
                      <Video className="inline h-4 w-4 mr-1" />
                      Meeting URL
                    </>
                  )}
                </label>
                <input
                  type="text"
                  value={formData.event_addr}
                  onChange={(e) => handleChange('event_addr', e.target.value)}
                  placeholder={
                    formData.event_type === 'onsite'
                      ? '123 Main Street, Toronto, ON'
                      : 'https://zoom.us/j/meeting-id'
                  }
                  className="w-full px-3 py-2 border border-dark-400 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Event Instructions */}
              <div>
                <label className="block text-sm font-medium text-dark-600 mb-2">
                  Special Instructions
                </label>
                <textarea
                  value={formData.event_instructions}
                  onChange={(e) => handleChange('event_instructions', e.target.value)}
                  placeholder="Access codes, parking info, preparation notes, equipment needed..."
                  rows={3}
                  className="w-full px-3 py-2 border border-dark-400 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Multi-Select Employees */}
              <div>
                <label className="block text-sm font-medium text-dark-600 mb-2">
                  <Users className="inline h-4 w-4 mr-1 text-blue-600" />
                  Employees *
                </label>
                <SearchableMultiSelect
                  options={getEmployeeOptions()}
                  value={formData.employee_ids || []}
                  onChange={(value) => handleChange('employee_ids', value)}
                  placeholder="Search and select employees..."
                />
                {errors.attendee_ids && (
                  <p className="text-red-600 text-xs mt-1">{errors.attendee_ids}</p>
                )}
                <p className="text-xs text-dark-600 mt-1">
                  Select employees who will attend this event
                </p>
              </div>

              {/* Multi-Select All Attendees */}
              <div>
                <label className="block text-sm font-medium text-dark-600 mb-2">
                  <Users className="inline h-4 w-4 mr-1 text-purple-600" />
                  Other Attendees (Optional)
                </label>
                <SearchableMultiSelect
                  options={getAllPeopleOptions()}
                  value={formData.attendee_ids || []}
                  onChange={(value) => handleChange('attendee_ids', value)}
                  placeholder="Search and select additional attendees..."
                />
                <p className="text-xs text-dark-600 mt-1">
                  Select additional employees and/or customers to attend this event
                </p>
              </div>
            </>
          )}

          {/* TAB: Attach Existing Event */}
          {activeTab === 'attach_existing' && (
            <>
              <div>
                <label className="block text-sm font-medium text-dark-600 mb-2">
                  <Link className="inline h-4 w-4 mr-1" />
                  Select Existing Event *
                </label>

                {loadingEvents ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />
                    <p className="text-sm text-dark-600 mt-2">Loading events...</p>
                  </div>
                ) : (
                  <select
                    value={formData.existing_event_id}
                    onChange={(e) => handleChange('existing_event_id', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.existing_event_id ? 'border-red-500' : 'border-dark-400'
                    }`}
                  >
                    <option value="">-- Select Event --</option>
                    {existingEvents.map(event => (
                      <option key={event.id} value={event.id}>
                        {event.name} - {event.code} ({new Date(event.from_ts).toLocaleString()})
                      </option>
                    ))}
                  </select>
                )}

                {errors.existing_event_id && (
                  <p className="text-red-600 text-xs mt-1">{errors.existing_event_id}</p>
                )}
                <p className="text-xs text-dark-600 mt-1">
                  Attach this calendar slot to an existing event
                </p>
              </div>

              {/* Display selected event details */}
              {formData.existing_event_id && existingEvents.find(e => e.id === formData.existing_event_id) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Selected Event Details</h4>
                  {(() => {
                    const selectedEvent = existingEvents.find(e => e.id === formData.existing_event_id);
                    return selectedEvent ? (
                      <div className="text-sm text-blue-800 space-y-1">
                        <p><strong>Name:</strong> {selectedEvent.name}</p>
                        <p><strong>Type:</strong> {selectedEvent.event_type}</p>
                        <p><strong>Platform:</strong> {selectedEvent.event_platform_provider_name}</p>
                        <p><strong>Time:</strong> {new Date(selectedEvent.from_ts).toLocaleString()} - {new Date(selectedEvent.to_ts).toLocaleString()}</p>
                        {selectedEvent.descr && <p><strong>Description:</strong> {selectedEvent.descr}</p>}
                      </div>
                    ) : null;
                  })()}
                </div>
              )}
            </>
          )}

          {/* Submit Error */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {errors.submit}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-dark-300">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-dark-600 hover:bg-dark-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : mode === 'create' ? 'Create Calendar Event' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
