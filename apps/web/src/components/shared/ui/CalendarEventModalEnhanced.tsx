import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, Video, User, Save, Users, UserCheck, UserX, UserPlus, FileText, Crown } from 'lucide-react';
import { SearchableMultiSelect } from './SearchableMultiSelect';

/**
 * Enhanced CalendarEventModal Component
 *
 * Modal for creating/editing calendar events with clear sections:
 * - Organizer Section
 * - Attendees Section with RSVP status
 * - Event Details Section
 */

interface CalendarEventModalEnhancedProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventData: EventFormData) => Promise<void>;
  initialData?: CalendarEvent | null;
  mode: 'create' | 'edit';
  employees?: PersonEntity[];
  customers?: PersonEntity[];
  currentUserId?: string; // Current logged in user's ID
}

export interface CalendarEvent {
  id?: string;
  code?: string;
  name?: string;
  descr?: string;
  event_type?: 'onsite' | 'virtual';
  event_platform_provider_name?: string;
  event_addr?: string;
  event_instructions?: string;
  from_ts: string;
  to_ts: string;
  timezone?: string;
  organizer_id?: string;
  organizer_type?: 'employee' | 'customer' | 'client';
  organizer_name?: string;
  organizer_email?: string;
  attendees?: Attendee[];
}

export interface Attendee {
  person_entity_id: string;
  person_entity_type: 'employee' | 'customer' | 'client';
  person_name?: string;
  person_email?: string;
  event_rsvp_status: 'pending' | 'accepted' | 'declined';
}

export interface EventFormData extends CalendarEvent {
  attendees: Attendee[];
}

interface PersonEntity {
  id: string;
  name: string;
  type: 'employee' | 'customer';
  email?: string;
}

const RSVPBadge = ({ status }: { status: string }) => {
  const styles = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    accepted: 'bg-green-100 text-green-800 border-green-300',
    declined: 'bg-red-100 text-red-800 border-red-300'
  };

  const icons = {
    pending: '⏳',
    accepted: '✓',
    declined: '✗'
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${styles[status] || styles.pending}`}>
      <span className="mr-1">{icons[status] || icons.pending}</span>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

export function CalendarEventModalEnhanced({
  isOpen,
  onClose,
  onSave,
  initialData,
  mode,
  employees = [],
  customers = [],
  currentUserId
}: CalendarEventModalEnhancedProps) {
  const [formData, setFormData] = useState<EventFormData>({
    code: '',
    name: '',
    descr: '',
    event_type: 'onsite',
    event_platform_provider_name: 'office',
    event_addr: '',
    event_instructions: '',
    from_ts: '',
    to_ts: '',
    timezone: 'America/Toronto',
    organizer_id: currentUserId || '',
    organizer_type: 'employee',
    attendees: []
  });

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showAddAttendee, setShowAddAttendee] = useState(false);
  const [newAttendee, setNewAttendee] = useState<Attendee>({
    person_entity_id: '',
    person_entity_type: 'employee',
    person_name: '',
    event_rsvp_status: 'pending'
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        attendees: initialData.attendees || []
      });
    } else if (currentUserId) {
      // Set current user as default organizer for new events
      const currentUser = employees.find(e => e.id === currentUserId);
      if (currentUser) {
        setFormData(prev => ({
          ...prev,
          organizer_id: currentUserId,
          organizer_type: 'employee',
          organizer_name: currentUser.name,
          organizer_email: currentUser.email
        }));
      }
    }
  }, [initialData, currentUserId, employees]);

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

  const handleOrganizerChange = (organizerId: string, organizerType: 'employee' | 'customer') => {
    const people = organizerType === 'employee' ? employees : customers;
    const organizer = people.find(p => p.id === organizerId);

    setFormData(prev => ({
      ...prev,
      organizer_id: organizerId,
      organizer_type: organizerType,
      organizer_name: organizer?.name || '',
      organizer_email: organizer?.email || ''
    }));
  };

  const addAttendee = () => {
    if (!newAttendee.person_entity_id) {
      setErrors({ newAttendee: 'Please select a person to add' });
      return;
    }

    const people = newAttendee.person_entity_type === 'employee' ? employees : customers;
    const person = people.find(p => p.id === newAttendee.person_entity_id);

    const attendee: Attendee = {
      ...newAttendee,
      person_name: person?.name || '',
      person_email: person?.email || ''
    };

    setFormData(prev => ({
      ...prev,
      attendees: [...prev.attendees, attendee]
    }));

    // Reset new attendee form
    setNewAttendee({
      person_entity_id: '',
      person_entity_type: 'employee',
      person_name: '',
      event_rsvp_status: 'pending'
    });
    setShowAddAttendee(false);
  };

  const removeAttendee = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attendees: prev.attendees.filter((_, i) => i !== index)
    }));
  };

  const updateAttendeeRSVP = (index: number, status: 'pending' | 'accepted' | 'declined') => {
    setFormData(prev => ({
      ...prev,
      attendees: prev.attendees.map((a, i) =>
        i === index ? { ...a, event_rsvp_status: status } : a
      )
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name) {
      newErrors.name = 'Event name is required';
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
    if (!formData.organizer_id) {
      newErrors.organizer_id = 'Organizer is required';
    }
    if (!formData.event_type) {
      newErrors.event_type = 'Event type is required';
    }
    if (!formData.event_platform_provider_name) {
      newErrors.event_platform_provider_name = 'Platform/venue is required';
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
      // Generate event code if not present
      if (!formData.code && mode === 'create') {
        const timestamp = Date.now().toString(36).toUpperCase();
        formData.code = `EVT-${timestamp}`;
      }

      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Failed to save event:', error);
      setErrors({ submit: 'Failed to save event. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <h2 className="text-2xl font-bold text-gray-800">
            <Calendar className="inline h-6 w-6 mr-2 text-blue-600" />
            {mode === 'create' ? 'Create Calendar Event' : 'Edit Calendar Event'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">

            {/* SECTION 1: Event Details */}
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-blue-600" />
                Event Details
              </h3>

              <div className="grid gap-4">
                {/* Event Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Event Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="e.g., HVAC Consultation - Thompson Residence"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.name ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.name && (
                    <p className="text-red-600 text-xs mt-1">{errors.name}</p>
                  )}
                </div>

                {/* Event Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.descr}
                    onChange={(e) => handleChange('descr', e.target.value)}
                    placeholder="Detailed description of the event..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Time Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Clock className="inline h-4 w-4 mr-1" />
                      Start Time *
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.from_ts ? new Date(formData.from_ts).toISOString().slice(0, 16) : ''}
                      onChange={(e) => handleChange('from_ts', new Date(e.target.value).toISOString())}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        errors.from_ts ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.from_ts && (
                      <p className="text-red-600 text-xs mt-1">{errors.from_ts}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Clock className="inline h-4 w-4 mr-1" />
                      End Time *
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.to_ts ? new Date(formData.to_ts).toISOString().slice(0, 16) : ''}
                      onChange={(e) => handleChange('to_ts', new Date(e.target.value).toISOString())}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        errors.to_ts ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.to_ts && (
                      <p className="text-red-600 text-xs mt-1">{errors.to_ts}</p>
                    )}
                  </div>
                </div>

                {/* Event Type and Platform */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Event Type *
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value="onsite"
                          checked={formData.event_type === 'onsite'}
                          onChange={(e) => handleChange('event_type', e.target.value)}
                          className="text-blue-600"
                        />
                        <MapPin className="h-4 w-4 text-blue-600" />
                        <span className="text-sm">On-site</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value="virtual"
                          checked={formData.event_type === 'virtual'}
                          onChange={(e) => handleChange('event_type', e.target.value)}
                          className="text-purple-600"
                        />
                        <Video className="h-4 w-4 text-purple-600" />
                        <span className="text-sm">Virtual</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Platform/Venue *
                    </label>
                    <select
                      value={formData.event_platform_provider_name}
                      onChange={(e) => handleChange('event_platform_provider_name', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        errors.event_platform_provider_name ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="zoom">Zoom</option>
                      <option value="teams">Microsoft Teams</option>
                      <option value="google_meet">Google Meet</option>
                      <option value="physical_hall">Physical Hall</option>
                      <option value="office">Office</option>
                      <option value="customer_location">Customer Location</option>
                    </select>
                  </div>
                </div>

                {/* Location/URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Instructions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Special Instructions
                  </label>
                  <textarea
                    value={formData.event_instructions}
                    onChange={(e) => handleChange('event_instructions', e.target.value)}
                    placeholder="Access codes, parking info, preparation notes..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: Organizer */}
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-5">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <Crown className="h-5 w-5 mr-2 text-amber-600" />
                Event Organizer
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Organizer Type *
                  </label>
                  <select
                    value={formData.organizer_type}
                    onChange={(e) => {
                      const type = e.target.value as 'employee' | 'customer';
                      handleChange('organizer_type', type);
                      handleChange('organizer_id', '');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="employee">Employee</option>
                    <option value="customer">Customer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Organizer *
                  </label>
                  <select
                    value={formData.organizer_id}
                    onChange={(e) => handleOrganizerChange(e.target.value, formData.organizer_type!)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 ${
                      errors.organizer_id ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">-- Select {formData.organizer_type} --</option>
                    {(formData.organizer_type === 'employee' ? employees : customers).map(person => (
                      <option key={person.id} value={person.id}>
                        {person.name} {person.email ? `(${person.email})` : ''}
                      </option>
                    ))}
                  </select>
                  {errors.organizer_id && (
                    <p className="text-red-600 text-xs mt-1">{errors.organizer_id}</p>
                  )}
                </div>
              </div>

              {formData.organizer_name && (
                <div className="mt-3 p-3 bg-white rounded-lg border border-amber-200">
                  <p className="text-sm font-medium text-gray-700">
                    <User className="inline h-4 w-4 mr-1" />
                    {formData.organizer_name}
                  </p>
                  {formData.organizer_email && (
                    <p className="text-xs text-gray-500 mt-1">{formData.organizer_email}</p>
                  )}
                </div>
              )}
            </div>

            {/* SECTION 3: Attendees with RSVP */}
            <div className="bg-gradient-to-r from-green-50 to-teal-50 border border-green-200 rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                  <Users className="h-5 w-5 mr-2 text-green-600" />
                  Attendees & RSVP Status
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddAttendee(!showAddAttendee)}
                  className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1 text-sm"
                >
                  <UserPlus className="h-4 w-4" />
                  Add Attendee
                </button>
              </div>

              {/* Add Attendee Form */}
              {showAddAttendee && (
                <div className="mb-4 p-3 bg-white rounded-lg border border-green-200">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                      <select
                        value={newAttendee.person_entity_type}
                        onChange={(e) => setNewAttendee({ ...newAttendee, person_entity_type: e.target.value as any, person_entity_id: '' })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                      >
                        <option value="employee">Employee</option>
                        <option value="customer">Customer</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Person</label>
                      <select
                        value={newAttendee.person_entity_id}
                        onChange={(e) => setNewAttendee({ ...newAttendee, person_entity_id: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">-- Select --</option>
                        {(newAttendee.person_entity_type === 'employee' ? employees : customers).map(person => (
                          <option key={person.id} value={person.id}>
                            {person.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Initial RSVP</label>
                      <select
                        value={newAttendee.event_rsvp_status}
                        onChange={(e) => setNewAttendee({ ...newAttendee, event_rsvp_status: e.target.value as any })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                      >
                        <option value="pending">Pending</option>
                        <option value="accepted">Accepted</option>
                        <option value="declined">Declined</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={addAttendee}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddAttendee(false)}
                      className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                  {errors.newAttendee && (
                    <p className="text-red-600 text-xs mt-1">{errors.newAttendee}</p>
                  )}
                </div>
              )}

              {/* Attendees List */}
              <div className="space-y-2">
                {formData.attendees.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <Users className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No attendees added yet</p>
                    <p className="text-xs mt-1">Click "Add Attendee" to invite people to this event</p>
                  </div>
                ) : (
                  formData.attendees.map((attendee, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-100">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          attendee.person_entity_type === 'employee' ? 'bg-blue-100' : 'bg-purple-100'
                        }`}>
                          <User className={`h-4 w-4 ${
                            attendee.person_entity_type === 'employee' ? 'text-blue-600' : 'text-purple-600'
                          }`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {attendee.person_name || 'Unknown'}
                            <span className="ml-2 text-xs text-gray-500">
                              ({attendee.person_entity_type})
                            </span>
                          </p>
                          {attendee.person_email && (
                            <p className="text-xs text-gray-500">{attendee.person_email}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={attendee.event_rsvp_status}
                          onChange={(e) => updateAttendeeRSVP(index, e.target.value as any)}
                          className="text-xs px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                        >
                          <option value="pending">Pending</option>
                          <option value="accepted">Accepted</option>
                          <option value="declined">Declined</option>
                        </select>
                        <RSVPBadge status={attendee.event_rsvp_status} />
                        <button
                          type="button"
                          onClick={() => removeAttendee(index)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* RSVP Summary */}
              {formData.attendees.length > 0 && (
                <div className="mt-4 p-3 bg-white rounded-lg border border-green-100">
                  <p className="text-xs font-medium text-gray-700 mb-2">RSVP Summary</p>
                  <div className="flex gap-4 text-xs">
                    <span className="flex items-center gap-1">
                      <UserCheck className="h-3 w-3 text-green-600" />
                      Accepted: {formData.attendees.filter(a => a.event_rsvp_status === 'accepted').length}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-yellow-600" />
                      Pending: {formData.attendees.filter(a => a.event_rsvp_status === 'pending').length}
                    </span>
                    <span className="flex items-center gap-1">
                      <UserX className="h-3 w-3 text-red-600" />
                      Declined: {formData.attendees.filter(a => a.event_rsvp_status === 'declined').length}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {errors.submit}
              </div>
            )}
          </form>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : mode === 'create' ? 'Create Event' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}