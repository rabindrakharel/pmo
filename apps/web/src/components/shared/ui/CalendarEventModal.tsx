import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Calendar, Clock, MapPin, Video, Save, Users,
  FileText, Crown, Building, ChevronRight,
  Globe, Home, Briefcase, Check, AlertCircle
} from 'lucide-react';
import { SearchableMultiSelect } from './SearchableMultiSelect';

/**
 * CalendarEventModal v2.0 - Futuristic Design System
 *
 * Design Principles (inspired by Linear, Vercel, Apple):
 * - Glassmorphism with subtle backdrop blur
 * - Smooth micro-animations and transitions
 * - Minimal visual noise, maximum clarity
 * - Dark theme with refined color hierarchy
 * - Floating labels and progressive disclosure
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
    { value: 'zoom', label: 'Zoom', icon: Video },
    { value: 'teams', label: 'Teams', icon: Briefcase },
    { value: 'google_meet', label: 'Meet', icon: Globe },
    { value: 'webex', label: 'Webex', icon: Video },
  ],
  onsite: [
    { value: 'office', label: 'Office', icon: Building },
    { value: 'customer_location', label: 'Client Site', icon: Home },
    { value: 'physical_hall', label: 'Conference', icon: Building },
    { value: 'outdoor', label: 'Outdoor', icon: MapPin },
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
    attendees: false
  });
  const [selectedOrganizers, setSelectedOrganizers] = useState<string[]>([]);
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  // Animation: Fade in on mount
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  // Get current user from localStorage if not provided
  const getCurrentUser = () => {
    if (currentUser) return currentUser;
    const token = localStorage.getItem('auth_token');
    if (token) {
      try {
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
    if (!isOpen) return;

    if (initialData) {
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
        if (effectiveCurrentUser && !organizerIds.includes(effectiveCurrentUser.id)) {
          organizerIds.push(effectiveCurrentUser.id);
        }
        setSelectedOrganizers(organizerIds);
      }
      if (initialData.attendees) {
        setSelectedAttendees(initialData.attendees.map(a => a.person_entity_id));
      }
    } else if (effectiveCurrentUser && mode === 'create') {
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
  }, [isOpen, mode, initialData?.id]);

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
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Handle organizer change
  const handleOrganizerChange = (newOrganizers: string[]) => {
    let finalOrganizers = newOrganizers;
    if (effectiveCurrentUser && !finalOrganizers.includes(effectiveCurrentUser.id)) {
      finalOrganizers = [...finalOrganizers, effectiveCurrentUser.id];
    }

    setSelectedOrganizers(finalOrganizers);

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
      if (!formData.code && mode === 'create') {
        const timestamp = Date.now().toString(36).toUpperCase();
        formData.code = `EVT-${timestamp}`;
      }

      const dataToSave: EventFormData = {
        ...formData,
        event_name: formData.name,
        event_code: formData.code,
        event_descr: formData.descr,
        event_metadata: formData.metadata,
        creation_mode: 'new_event'
      };

      await onSave(dataToSave);
      handleClose();
    } catch (error) {
      console.error('Failed to save event:', error);
      setErrors({ submit: 'Failed to save event. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  // Handle close with animation
  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 200);
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal Container */}
      <div
        className={`relative bg-dark-100 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-dark-300/50 transition-all duration-300 ${
          isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Compact */}
        <div className="relative px-4 py-3 border-b border-dark-300/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-dark-600" strokeWidth={1.5} />
              <h2 className="text-sm font-medium text-dark-700">
                {mode === 'create' ? 'Create Event' : 'Edit Event'}
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="p-1 -mr-1 rounded text-dark-500 hover:text-dark-600 hover:bg-dark-200/50 transition-colors"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-4 space-y-3">

            {/* SECTION 1: Event Details */}
            <div className="rounded-lg border border-dark-300/50 overflow-hidden bg-dark-100/50">
              <button
                type="button"
                onClick={() => toggleSection('details')}
                className="w-full px-3 py-2 flex items-center justify-between hover:bg-dark-200/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-dark-600" strokeWidth={1.5} />
                  <span className="text-xs font-medium text-dark-600">Event Details</span>
                </div>
                <ChevronRight
                  className={`h-3.5 w-3.5 text-dark-500 transition-transform duration-200 ${
                    expandedSections.details ? 'rotate-90' : ''
                  }`}
                  strokeWidth={1.5}
                />
              </button>

              <div className={`transition-all duration-300 ease-out overflow-hidden ${
                expandedSections.details ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
              }`}>
                <div className="px-3 pb-3 pt-2 space-y-3 border-t border-dark-300/30">

                  {/* Event Name */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-medium text-dark-500 uppercase tracking-wider">
                      Event Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      placeholder="e.g., HVAC System Consultation"
                      className={`w-full h-7 px-2.5 text-xs bg-dark-200/40 border rounded text-dark-700 placeholder:text-dark-500/60 focus:outline-none focus:ring-1 focus:ring-dark-400/50 focus:border-dark-400 transition-colors ${
                        errors.name ? 'border-red-500/50' : 'border-dark-300/50'
                      }`}
                    />
                    {errors.name && (
                      <p className="text-red-400 text-[10px] flex items-center gap-1">
                        <AlertCircle className="h-2.5 w-2.5" />
                        {errors.name}
                      </p>
                    )}
                  </div>

                  {/* Date & Time Row */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-medium text-dark-500 uppercase tracking-wider flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" strokeWidth={1.5} />
                        Start
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.from_ts ? new Date(formData.from_ts).toISOString().slice(0, 16) : ''}
                        onChange={(e) => handleChange('from_ts', new Date(e.target.value).toISOString())}
                        className={`w-full h-7 px-2.5 text-xs bg-dark-200/40 border rounded text-dark-700 focus:outline-none focus:ring-1 focus:ring-dark-400/50 focus:border-dark-400 transition-colors ${
                          errors.from_ts ? 'border-red-500/50' : 'border-dark-300/50'
                        }`}
                      />
                      {errors.from_ts && (
                        <p className="text-red-400 text-[10px]">{errors.from_ts}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-medium text-dark-500 uppercase tracking-wider flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" strokeWidth={1.5} />
                        End
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.to_ts ? new Date(formData.to_ts).toISOString().slice(0, 16) : ''}
                        onChange={(e) => handleChange('to_ts', new Date(e.target.value).toISOString())}
                        className={`w-full h-7 px-2.5 text-xs bg-dark-200/40 border rounded text-dark-700 focus:outline-none focus:ring-1 focus:ring-dark-400/50 focus:border-dark-400 transition-colors ${
                          errors.to_ts ? 'border-red-500/50' : 'border-dark-300/50'
                        }`}
                      />
                      {errors.to_ts && (
                        <p className="text-red-400 text-[10px]">{errors.to_ts}</p>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-medium text-dark-500 uppercase tracking-wider">
                      Description
                    </label>
                    <textarea
                      value={formData.descr}
                      onChange={(e) => handleChange('descr', e.target.value)}
                      placeholder="Add event details..."
                      rows={2}
                      className="w-full px-2.5 py-1.5 text-xs bg-dark-200/40 border border-dark-300/50 rounded text-dark-700 placeholder:text-dark-500/60 focus:outline-none focus:ring-1 focus:ring-dark-400/50 focus:border-dark-400 transition-colors resize-none leading-tight"
                    />
                  </div>

                  {/* Event Type Toggle */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-medium text-dark-500 uppercase tracking-wider">
                      Event Type
                    </label>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          handleChange('event_type', 'onsite');
                          handleChange('event_platform_provider_name', 'office');
                        }}
                        className={`flex-1 h-7 flex items-center justify-center gap-1.5 px-2.5 rounded border transition-colors ${
                          formData.event_type === 'onsite'
                            ? 'bg-dark-200/80 border-dark-400 text-dark-700'
                            : 'bg-dark-200/30 border-dark-300/50 text-dark-500 hover:border-dark-400/50'
                        }`}
                      >
                        <MapPin className="h-3 w-3" strokeWidth={1.5} />
                        <span className="text-xs">On-site</span>
                        {formData.event_type === 'onsite' && (
                          <Check className="h-3 w-3" strokeWidth={2} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleChange('event_type', 'virtual');
                          handleChange('event_platform_provider_name', 'zoom');
                        }}
                        className={`flex-1 h-7 flex items-center justify-center gap-1.5 px-2.5 rounded border transition-colors ${
                          formData.event_type === 'virtual'
                            ? 'bg-dark-200/80 border-dark-400 text-dark-700'
                            : 'bg-dark-200/30 border-dark-300/50 text-dark-500 hover:border-dark-400/50'
                        }`}
                      >
                        <Video className="h-3 w-3" strokeWidth={1.5} />
                        <span className="text-xs">Virtual</span>
                        {formData.event_type === 'virtual' && (
                          <Check className="h-3 w-3" strokeWidth={2} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Platform/Venue Selection */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-medium text-dark-500 uppercase tracking-wider">
                      {formData.event_type === 'virtual' ? 'Platform' : 'Venue Type'}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {(formData.event_type === 'virtual' ? PlatformOptions.virtual : PlatformOptions.onsite).map(option => {
                        const IconComponent = option.icon;
                        const isSelected = formData.event_platform_provider_name === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleChange('event_platform_provider_name', option.value)}
                            className={`h-6 inline-flex items-center gap-1 px-2 rounded border transition-colors ${
                              isSelected
                                ? 'bg-dark-200/80 border-dark-400 text-dark-700'
                                : 'bg-dark-200/30 border-dark-300/50 text-dark-500 hover:border-dark-400/50'
                            }`}
                          >
                            <IconComponent className="h-3 w-3" strokeWidth={1.5} />
                            <span className="text-[10px] font-medium">{option.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Location/Link + Instructions */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-medium text-dark-500 uppercase tracking-wider flex items-center gap-1">
                        {formData.event_type === 'onsite' ? (
                          <><MapPin className="h-2.5 w-2.5" strokeWidth={1.5} /> Location</>
                        ) : (
                          <><Globe className="h-2.5 w-2.5" strokeWidth={1.5} /> Meeting Link</>
                        )}
                      </label>
                      <input
                        type="text"
                        value={formData.event_addr}
                        onChange={(e) => handleChange('event_addr', e.target.value)}
                        placeholder={formData.event_type === 'onsite' ? '123 Main Street...' : 'https://zoom.us/...'}
                        className="w-full h-7 px-2.5 text-xs bg-dark-200/40 border border-dark-300/50 rounded text-dark-700 placeholder:text-dark-500/60 focus:outline-none focus:ring-1 focus:ring-dark-400/50 focus:border-dark-400 transition-colors"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-medium text-dark-500 uppercase tracking-wider">
                        Instructions
                      </label>
                      <input
                        type="text"
                        value={formData.event_instructions}
                        onChange={(e) => handleChange('event_instructions', e.target.value)}
                        placeholder="Access codes, parking..."
                        className="w-full h-7 px-2.5 text-xs bg-dark-200/40 border border-dark-300/50 rounded text-dark-700 placeholder:text-dark-500/60 focus:outline-none focus:ring-1 focus:ring-dark-400/50 focus:border-dark-400 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: Organizers */}
            <div className="rounded-lg border border-dark-300/50 overflow-hidden bg-dark-100/50">
              <button
                type="button"
                onClick={() => toggleSection('organizers')}
                className="w-full px-3 py-2 flex items-center justify-between hover:bg-dark-200/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Crown className="h-3.5 w-3.5 text-dark-600" strokeWidth={1.5} />
                  <span className="text-xs font-medium text-dark-600">Organizers</span>
                  {selectedOrganizers.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] font-medium bg-dark-200/80 text-dark-600 rounded-full">
                      {selectedOrganizers.length}
                    </span>
                  )}
                </div>
                <ChevronRight
                  className={`h-3.5 w-3.5 text-dark-500 transition-transform duration-200 ${
                    expandedSections.organizers ? 'rotate-90' : ''
                  }`}
                  strokeWidth={1.5}
                />
              </button>

              <div className={`transition-all duration-300 ease-out overflow-hidden ${
                expandedSections.organizers ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'
              }`}>
                <div className="px-3 pb-3 pt-2 border-t border-dark-300/30">
                  {errors.organizers && (
                    <div className="mb-2 p-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded text-[10px] flex items-center gap-1.5">
                      <AlertCircle className="h-3 w-3" />
                      {errors.organizers}
                    </div>
                  )}

                  <SearchableMultiSelect
                    options={employees.map(emp => ({
                      value: emp.id,
                      label: emp.name + (emp.id === effectiveCurrentUser?.id ? ' (You)' : '')
                    }))}
                    value={selectedOrganizers}
                    onChange={handleOrganizerChange}
                    placeholder="Search organizers..."
                    showTooltips={true}
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: Attendees */}
            <div className="rounded-lg border border-dark-300/50 overflow-hidden bg-dark-100/50">
              <button
                type="button"
                onClick={() => toggleSection('attendees')}
                className="w-full px-3 py-2 flex items-center justify-between hover:bg-dark-200/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-dark-600" strokeWidth={1.5} />
                  <span className="text-xs font-medium text-dark-600">Attendees</span>
                  {formData.attendees && formData.attendees.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] font-medium bg-dark-200/80 text-dark-600 rounded-full">
                      {formData.attendees.length}
                    </span>
                  )}
                </div>
                <ChevronRight
                  className={`h-3.5 w-3.5 text-dark-500 transition-transform duration-200 ${
                    expandedSections.attendees ? 'rotate-90' : ''
                  }`}
                  strokeWidth={1.5}
                />
              </button>

              <div className={`transition-all duration-300 ease-out overflow-hidden ${
                expandedSections.attendees ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
              }`}>
                <div className="px-3 pb-3 pt-2 border-t border-dark-300/30">
                  <SearchableMultiSelect
                    options={[
                      ...employees
                        .filter(emp => !selectedOrganizers.includes(emp.id))
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
                    placeholder="Search attendees..."
                    showTooltips={true}
                  />

                  {/* Attendee Summary */}
                  {formData.attendees && formData.attendees.length > 0 && (
                    <div className="mt-2 p-2 bg-dark-200/40 rounded text-[10px] flex items-center justify-between">
                      <span className="text-dark-600 font-medium">
                        {formData.attendees.length} attendee{formData.attendees.length !== 1 ? 's' : ''}
                      </span>
                      <span className="text-dark-500">
                        {formData.attendees.filter(a => a.person_entity_type === 'employee').length} emp, {' '}
                        {formData.attendees.filter(a => a.person_entity_type === 'customer').length} cust
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Error Message */}
            {errors.submit && (
              <div className="p-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded text-xs flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3 flex-shrink-0" />
                {errors.submit}
              </div>
            )}
          </form>
        </div>

        {/* Footer - Compact */}
        <div className="px-4 py-2 border-t border-dark-300/50 bg-dark-100/80 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="h-7 px-3 text-xs font-medium text-dark-600 hover:text-dark-700 bg-dark-200/50 hover:bg-dark-200 rounded border border-dark-300/50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="h-7 inline-flex items-center gap-1.5 px-3 text-xs font-medium bg-dark-700 text-dark-100 rounded hover:bg-dark-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <>
                <div className="h-3 w-3 border-2 border-dark-100/30 border-t-dark-100 rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-3 w-3" strokeWidth={1.5} />
                <span>{mode === 'create' ? 'Create' : 'Save'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
