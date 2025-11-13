import React, { useState, useEffect } from 'react';
import {
  X, Calendar, Clock, MapPin, Video, Save, Users,
  FileText, Crown, Building,
  ChevronDown, ChevronUp,
  Globe, Home, Briefcase
} from 'lucide-react';
import { SearchableMultiSelect } from './SearchableMultiSelect';

/**
 * Revamped Calendar Event Modal
 *
 * Clean, intuitive interface with clear sections for:
 * - Event Information
 * - Event Organizers (multiple supported via RBAC)
 * - Event Attendees with RSVP management
 */

interface CalendarEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventData: EventFormData) => Promise<void>;
  initialData?: CalendarEvent | null;
  mode: 'create' | 'edit';
  employees?: PersonEntity[];
  customers?: PersonEntity[];
  currentUser?: {
    id: string;
    name: string;
    email: string;
  };
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
  organizers?: Array<{
    empid: string;
    name: string;
    email: string;
  }>;
  attendees?: Array<{
    person_entity_id: string;
    person_entity_type: 'employee' | 'customer';
    person_name?: string;
    person_email?: string;
    event_rsvp_status: 'pending' | 'accepted' | 'declined';
  }>;

  // Legacy fields for compatibility
  person_entity_type?: 'employee' | 'customer';
  person_entity_id?: string;
  availability_flag?: boolean;
  title?: string;
  appointment_medium?: 'onsite' | 'virtual';
  appointment_addr?: string;
  instructions?: string;
  metadata?: Record<string, any>;
  event_id?: string;
}

export interface EventFormData extends CalendarEvent {
  additional_organizers?: Array<{ empid: string }>;
  creation_mode?: 'new_event' | 'attach_existing';
  employee_ids?: string[];
  attendee_ids?: string[];
  existing_event_id?: string;
  event_name?: string;
  event_code?: string;
  event_descr?: string;
  event_metadata?: Record<string, any>;
}

interface PersonEntity {
  id: string;
  name: string;
  type: 'employee' | 'customer';
  email?: string;
  phone?: string;
  department?: string;
}

const PlatformOptions = {
  virtual: [
    { value: 'zoom', label: 'Zoom', icon: <Video className="h-4 w-4" /> },
    { value: 'teams', label: 'Microsoft Teams', icon: <Briefcase className="h-4 w-4" /> },
    { value: 'google_meet', label: 'Google Meet', icon: <Globe className="h-4 w-4" /> },
    { value: 'webex', label: 'Webex', icon: <Video className="h-4 w-4" /> },
  ],
  onsite: [
    { value: 'office', label: 'Office', icon: <Building className="h-4 w-4" /> },
    { value: 'customer_location', label: 'Customer Location', icon: <Home className="h-4 w-4" /> },
    { value: 'physical_hall', label: 'Conference Hall', icon: <Building className="h-4 w-4" /> },
    { value: 'outdoor', label: 'Outdoor Location', icon: <MapPin className="h-4 w-4" /> },
  ]
};

export function CalendarEventModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  mode,
  employees = [],
  customers = [],
  currentUser
}: CalendarEventModalProps) {
  // Form State
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
    organizers: [],
    additional_organizers: [],
    attendees: []
  });

  // UI State
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expandedSections, setExpandedSections] = useState({
    details: true,
    organizers: true,
    attendees: true
  });
  const [selectedOrganizers, setSelectedOrganizers] = useState<string[]>([]);
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);

  // Get current user from localStorage if not provided
  const getCurrentUser = () => {
    if (currentUser) return currentUser;

    // Try to get from localStorage (assuming it's stored after login)
    const token = localStorage.getItem('auth_token');
    if (token) {
      try {
        // Parse JWT token to get user ID (this is a simple example, adjust as needed)
        const payload = JSON.parse(atob(token.split('.')[1]));
        return {
          id: payload.sub || '',
          name: payload.name || 'Current User',
          email: payload.email || ''
        };
      } catch (e) {
        console.error('Failed to parse token:', e);
      }
    }
    return null;
  };

  const effectiveCurrentUser = getCurrentUser();

  // Initialize form data only when modal opens
  useEffect(() => {
    // Only run when modal is actually open
    if (!isOpen) return;

    if (initialData) {
      // Handle both new format and legacy format
      const mappedData: EventFormData = {
        ...initialData,
        name: initialData.name || initialData.title || '',
        event_type: initialData.event_type || initialData.appointment_medium || 'onsite',
        event_addr: initialData.event_addr || initialData.appointment_addr || '',
        event_instructions: initialData.event_instructions || initialData.instructions || '',
      };

      setFormData(mappedData);
      if (initialData.organizers) {
        const organizerIds = initialData.organizers.map(o => o.empid);
        // Always ensure current user is included as organizer
        if (effectiveCurrentUser && !organizerIds.includes(effectiveCurrentUser.id)) {
          organizerIds.push(effectiveCurrentUser.id);
        }
        setSelectedOrganizers(organizerIds);
      }
      if (initialData.attendees) {
        setSelectedAttendees(initialData.attendees.map(a => a.person_entity_id));
      }
    } else if (effectiveCurrentUser && mode === 'create') {
      // Set current user as default organizer for new events
      setSelectedOrganizers([effectiveCurrentUser.id]);
      setFormData(prev => ({
        ...prev,
        organizers: [{
          empid: effectiveCurrentUser.id,
          name: effectiveCurrentUser.name,
          email: effectiveCurrentUser.email
        }]
      }));
    }
  }, [isOpen, mode, initialData?.id]); // Use stable dependencies

  // Toggle section expansion
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Handle form field changes
  const handleChange = (field: keyof EventFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when field is modified
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Handle organizer change - ensure current user is always included
  const handleOrganizerChange = (newOrganizers: string[]) => {
    // Always include current user if creating
    let finalOrganizers = newOrganizers;
    if (effectiveCurrentUser && !finalOrganizers.includes(effectiveCurrentUser.id)) {
      finalOrganizers = [...finalOrganizers, effectiveCurrentUser.id];
    }

    setSelectedOrganizers(finalOrganizers);

    // Update form data with organizers details
    const organizersList = finalOrganizers.map(id => {
      const emp = employees.find(e => e.id === id);
      return emp ? {
        empid: id,
        name: emp.name,
        email: emp.email || ''
      } : null;
    }).filter(Boolean) as any[];

    setFormData(prevData => ({
      ...prevData,
      organizers: organizersList,
      additional_organizers: organizersList
        .filter(o => o.empid !== effectiveCurrentUser?.id)
        .map(o => ({ empid: o.empid }))
    }));
  };

  // Handle attendee selection
  const handleAttendeeChange = (newAttendeeIds: string[]) => {
    setSelectedAttendees(newAttendeeIds);

    // Build attendee list from all people (employees + customers)
    const allPeople = [...employees, ...customers];
    const attendeesList = newAttendeeIds.map(id => {
      const person = allPeople.find(p => p.id === id);
      return person ? {
        person_entity_id: id,
        person_entity_type: person.type as 'employee' | 'customer',
        person_name: person.name,
        person_email: person.email,
        event_rsvp_status: 'pending' as const
      } : null;
    }).filter(Boolean) as any[];

    setFormData(prev => ({
      ...prev,
      attendees: attendeesList
    }));
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = 'Event name is required';
    }
    if (!formData.from_ts) {
      newErrors.from_ts = 'Start time is required';
    }
    if (!formData.to_ts) {
      newErrors.to_ts = 'End time is required';
    }
    if (formData.from_ts && formData.to_ts) {
      const start = new Date(formData.from_ts);
      const end = new Date(formData.to_ts);
      if (start >= end) {
        newErrors.to_ts = 'End time must be after start time';
      }
    }
    if (selectedOrganizers.length === 0) {
      newErrors.organizers = 'At least one organizer is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
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

      // Map data for compatibility with existing API
      const dataToSave: EventFormData = {
        ...formData,
        event_name: formData.name,
        event_code: formData.code,
        event_descr: formData.descr,
        event_metadata: formData.metadata,
        creation_mode: 'new_event'
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-md shadow-sm max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-600" />
                {mode === 'create' ? 'Create Event' : 'Edit Event'}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Schedule meetings and appointments with organizers and attendees
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-6 space-y-4">

            {/* SECTION 1: Event Information */}
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('details')}
                className="w-full px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
              >
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-gray-600" />
                  Event Information
                </h3>
                {expandedSections.details ? (
                  <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                )}
              </button>

              {expandedSections.details && (
                <div className="p-6 space-y-3">
                  {/* Line 1: Event Name + Start Date */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Event Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        placeholder="e.g., HVAC System Consultation"
                        className={`w-full px-3 py-1.5 text-sm border rounded focus:ring-1 focus:ring-slate-500 focus:border-slate-500 ${
                          errors.name ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.name && (
                        <p className="text-red-600 text-xs mt-0.5">{errors.name}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        <Clock className="inline h-3 w-3 mr-1" />
                        Start Date & Time *
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.from_ts ? new Date(formData.from_ts).toISOString().slice(0, 16) : ''}
                        onChange={(e) => handleChange('from_ts', new Date(e.target.value).toISOString())}
                        className={`w-full px-2.5 py-1.5 text-sm border rounded focus:ring-1 focus:ring-slate-500 ${
                          errors.from_ts ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.from_ts && (
                        <p className="text-red-600 text-xs mt-0.5">{errors.from_ts}</p>
                      )}
                    </div>
                  </div>

                  {/* Line 2: Description + End Date */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={formData.descr}
                        onChange={(e) => handleChange('descr', e.target.value)}
                        placeholder="Event details..."
                        rows={1}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-slate-500 focus:border-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        <Clock className="inline h-3 w-3 mr-1" />
                        End Date & Time *
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.to_ts ? new Date(formData.to_ts).toISOString().slice(0, 16) : ''}
                        onChange={(e) => handleChange('to_ts', new Date(e.target.value).toISOString())}
                        className={`w-full px-2.5 py-1.5 text-sm border rounded focus:ring-1 focus:ring-slate-500 ${
                          errors.to_ts ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.to_ts && (
                        <p className="text-red-600 text-xs mt-0.5">{errors.to_ts}</p>
                      )}
                    </div>
                  </div>

                  {/* Line 3: Event Type + Platform */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Event Type *
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleChange('event_type', 'onsite')}
                          className={`inline-flex items-center gap-1 py-1.5 px-2.5 rounded border transition-all ${
                            formData.event_type === 'onsite'
                              ? 'border-slate-500 bg-slate-50 text-slate-700'
                              : 'border-gray-300 hover:border-gray-400 text-gray-600'
                          }`}
                        >
                          <MapPin className="h-3 w-3" />
                          <span className="text-xs font-medium">On-site</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChange('event_type', 'virtual')}
                          className={`inline-flex items-center gap-1 py-1.5 px-2.5 rounded border transition-all ${
                            formData.event_type === 'virtual'
                              ? 'border-slate-500 bg-slate-50 text-slate-700'
                              : 'border-gray-300 hover:border-gray-400 text-gray-600'
                          }`}
                        >
                          <Video className="h-3 w-3" />
                          <span className="text-xs font-medium">Virtual</span>
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        {formData.event_type === 'virtual' ? 'Platform' : 'Venue'} *
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {(formData.event_type === 'virtual' ? PlatformOptions.virtual : PlatformOptions.onsite).map(option => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleChange('event_platform_provider_name', option.value)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded border transition-all ${
                              formData.event_platform_provider_name === option.value
                                ? 'border-slate-500 bg-slate-50 text-slate-700'
                                : 'border-gray-300 hover:border-gray-400 text-gray-600'
                            }`}
                          >
                            {React.cloneElement(option.icon, { className: "h-3 w-3" })}
                            <span className="text-xs font-medium">{option.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Line 4: Location/URL + Instructions */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        {formData.event_type === 'onsite' ? (
                          <>
                            <MapPin className="inline h-3 w-3 mr-1" />
                            Location
                          </>
                        ) : (
                          <>
                            <Globe className="inline h-3 w-3 mr-1" />
                            Meeting Link
                          </>
                        )}
                      </label>
                      <input
                        type="text"
                        value={formData.event_addr}
                        onChange={(e) => handleChange('event_addr', e.target.value)}
                        placeholder={
                          formData.event_type === 'onsite'
                            ? '123 Main Street...'
                            : 'https://zoom.us/...'
                        }
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Special Instructions
                      </label>
                      <input
                        type="text"
                        value={formData.event_instructions}
                        onChange={(e) => handleChange('event_instructions', e.target.value)}
                        placeholder="Access codes, parking info..."
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-slate-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 2: Event Organizers */}
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('organizers')}
                className="w-full px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
              >
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Crown className="h-3.5 w-3.5 text-gray-600" />
                  Event Organizers
                  {selectedOrganizers.length > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 bg-gray-200 text-gray-700 text-xs rounded-full">
                      {selectedOrganizers.length}
                    </span>
                  )}
                </h3>
                {expandedSections.organizers ? (
                  <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                )}
              </button>

              {expandedSections.organizers && (
                <div className="p-4">
                  {errors.organizers && (
                    <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 rounded text-xs">
                      {errors.organizers}
                    </div>
                  )}

                  <p className="text-xs text-gray-600 mb-2.5">
                    Select organizers who will manage this event
                  </p>

                  {/* Use SearchableMultiSelect for better tag-like visualization */}
                  <SearchableMultiSelect
                    options={employees.map(emp => ({
                      value: emp.id,
                      label: emp.name + (emp.id === effectiveCurrentUser?.id ? ' (You)' : '')
                    }))}
                    value={selectedOrganizers}
                    onChange={handleOrganizerChange}
                    placeholder="Search and select organizers..."
                    showTooltips={true}
                  />
                </div>
              )}
            </div>

            {/* SECTION 3: Event Attendees */}
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('attendees')}
                className="w-full px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
              >
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-gray-600" />
                  Event Attendees
                  {formData.attendees && formData.attendees.length > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 bg-gray-200 text-gray-700 text-xs rounded-full">
                      {formData.attendees.length}
                    </span>
                  )}
                </h3>
                {expandedSections.attendees ? (
                  <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                )}
              </button>

              {expandedSections.attendees && (
                <div className="p-4">
                  <p className="text-xs text-gray-600 mb-2.5">
                    Select attendees (employees and customers) for this event
                  </p>

                  {/* Combined Employees + Customers Multiselect */}
                  <SearchableMultiSelect
                    options={[
                      ...employees
                        .filter(emp => !selectedOrganizers.includes(emp.id)) // Exclude organizers
                        .map(emp => ({
                          value: emp.id,
                          label: `${emp.name} (Employee)`
                        })),
                      ...customers.map(cust => ({
                        value: cust.id,
                        label: `${cust.name} (Customer)`
                      }))
                    ]}
                    value={selectedAttendees}
                    onChange={handleAttendeeChange}
                    placeholder="Search and select attendees..."
                    showTooltips={true}
                  />

                  {/* Summary - shows attendee count breakdown */}
                  {formData.attendees && formData.attendees.length > 0 && (
                    <div className="mt-3 p-3 bg-gray-50 rounded text-xs text-gray-600">
                      <div className="flex items-center justify-between">
                        <span>
                          <strong>{formData.attendees.length} attendee(s) selected</strong>
                        </span>
                        <span className="text-gray-500">
                          {formData.attendees.filter(a => a.person_entity_type === 'employee').length} employees, {' '}
                          {formData.attendees.filter(a => a.person_entity_type === 'customer').length} customers
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Error Message */}
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                {errors.submit}
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {mode === 'create' ? 'Creating new event' : `Editing: ${formData.code || 'Event'}`}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-200 rounded border border-gray-300 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm bg-slate-600 text-white rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    {mode === 'create' ? 'Create Event' : 'Save Changes'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}