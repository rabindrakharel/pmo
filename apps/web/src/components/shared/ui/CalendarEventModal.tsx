import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, Video, User, Save } from 'lucide-react';

/**
 * CalendarEventModal Component
 *
 * Modal for creating and editing calendar events with full event details.
 * Supports both available slots and booked appointments.
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
}

export interface EventFormData {
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
}

interface PersonEntity {
  id: string;
  name: string;
  type: 'employee' | 'customer';
  email?: string;
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
  const [formData, setFormData] = useState<EventFormData>({
    person_entity_type: 'employee',
    person_entity_id: '',
    from_ts: '',
    to_ts: '',
    timezone: 'America/Toronto',
    availability_flag: true,
    title: '',
    appointment_medium: 'onsite',
    appointment_addr: '',
    instructions: ''
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        person_entity_type: initialData.person_entity_type,
        person_entity_id: initialData.person_entity_id,
        from_ts: initialData.from_ts,
        to_ts: initialData.to_ts,
        timezone: initialData.timezone || 'America/Toronto',
        availability_flag: initialData.availability_flag,
        title: initialData.title || '',
        appointment_medium: initialData.appointment_medium || 'onsite',
        appointment_addr: initialData.appointment_addr || '',
        instructions: initialData.instructions || ''
      });
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
      newErrors.person_entity_id = 'Please select a person';
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
    if (!formData.availability_flag && !formData.title) {
      newErrors.title = 'Title is required for booked appointments';
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
      await onSave(formData);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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

          {/* Person Selection */}
          <div>
            <label className="block text-sm font-medium text-dark-600 mb-2">
              Select Person *
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

          {/* Availability Status */}
          <div>
            <label className="block text-sm font-medium text-dark-600 mb-2">
              Status
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={formData.availability_flag === true}
                  onChange={() => handleChange('availability_flag', true)}
                  className="text-green-600 focus:ring-green-500"
                />
                <span className="text-sm text-dark-600">Available (Open Slot)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={formData.availability_flag === false}
                  onChange={() => handleChange('availability_flag', false)}
                  className="text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-dark-600">Booked (Appointment)</span>
              </label>
            </div>
          </div>

          {/* Appointment Details (shown when booked) */}
          {!formData.availability_flag && (
            <>
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-dark-600 mb-2">
                  Appointment Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder="e.g., HVAC Consultation"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.title ? 'border-red-500' : 'border-dark-400'
                  }`}
                />
                {errors.title && (
                  <p className="text-red-600 text-xs mt-1">{errors.title}</p>
                )}
              </div>

              {/* Appointment Medium */}
              <div>
                <label className="block text-sm font-medium text-dark-600 mb-2">
                  Meeting Type
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="onsite"
                      checked={formData.appointment_medium === 'onsite'}
                      onChange={(e) => handleChange('appointment_medium', e.target.value)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <MapPin className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-dark-600">On-site</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="virtual"
                      checked={formData.appointment_medium === 'virtual'}
                      onChange={(e) => handleChange('appointment_medium', e.target.value)}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <Video className="h-4 w-4 text-purple-600" />
                    <span className="text-sm text-dark-600">Virtual</span>
                  </label>
                </div>
              </div>

              {/* Location/Address */}
              <div>
                <label className="block text-sm font-medium text-dark-600 mb-2">
                  {formData.appointment_medium === 'onsite' ? (
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
                  value={formData.appointment_addr}
                  onChange={(e) => handleChange('appointment_addr', e.target.value)}
                  placeholder={
                    formData.appointment_medium === 'onsite'
                      ? '123 Main Street, Toronto, ON'
                      : 'https://zoom.us/j/meeting-id'
                  }
                  className="w-full px-3 py-2 border border-dark-400 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Instructions */}
              <div>
                <label className="block text-sm font-medium text-dark-600 mb-2">
                  Special Instructions
                </label>
                <textarea
                  value={formData.instructions}
                  onChange={(e) => handleChange('instructions', e.target.value)}
                  placeholder="Access codes, parking info, preparation notes..."
                  rows={3}
                  className="w-full px-3 py-2 border border-dark-400 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
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
              {saving ? 'Saving...' : mode === 'create' ? 'Create Event' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
