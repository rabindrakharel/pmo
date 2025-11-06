import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ChevronDown, ChevronUp, User, Users, Building, Edit2, Trash2 } from 'lucide-react';
import type { EntityConfig } from '../../../lib/entityConfig';
import { CalendarEventModal, type CalendarEvent, type EventFormData } from './CalendarEventModal';

/**
 * CalendarView Component with Drag-and-Drop
 *
 * Displays calendar slots in a weekly calendar grid format with person entity filtering.
 * Designed for the person-calendar entity to show availability and bookings.
 *
 * Features:
 * - Week-based calendar view
 * - Multi-select person filter with checkboxes (employees, customers)
 * - Collapsible sidebar for person selection
 * - Color-coded availability (green=available, red=booked)
 * - Drag-and-drop to create new events
 * - Drag-and-drop to move existing events
 * - Click to edit event details
 * - Visual feedback during drag operations
 */

interface CalendarViewProps {
  /** Entity configuration */
  config: EntityConfig;

  /** Array of calendar slot items */
  data: any[];

  /** Callback when slot is clicked */
  onSlotClick?: (slot: any) => void;

  /** Custom empty message */
  emptyMessage?: string;
}

interface PersonEntity {
  id: string;
  name: string;
  type: 'employee' | 'customer';
  email?: string;
}

interface DragState {
  isCreating: boolean;
  isMoving: boolean;
  dragStartSlot: { date: Date; hour: number; minute: number; personId?: string } | null;
  dragEndSlot: { date: Date; hour: number; minute: number } | null;
  movingEventId: string | null;
}

const PERSON_TYPE_COLORS = {
  employee: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300', dot: 'bg-blue-500' },
  customer: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300', dot: 'bg-purple-500' }
};

export function CalendarView({
  config,
  data,
  onSlotClick,
  emptyMessage = 'No calendar slots available'
}: CalendarViewProps) {
  const [selectedPersonIds, setSelectedPersonIds] = useState<Set<string>>(new Set());
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
    return new Date(today.setDate(diff));
  });
  const [people, setPeople] = useState<PersonEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['employee']));

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [modalData, setModalData] = useState<CalendarEvent | null>(null);

  // Drag state
  const [dragState, setDragState] = useState<DragState>({
    isCreating: false,
    isMoving: false,
    dragStartSlot: null,
    dragEndSlot: null,
    movingEventId: null
  });
  const [dragOverSlot, setDragOverSlot] = useState<{ date: Date; hour: number; minute: number } | null>(null);

  // Fetch all person entities (employees, clients, customers)
  useEffect(() => {
    const fetchPeople = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

        const [employeesRes, customersRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/v1/employee?page=1&limit=100`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
          }),
          fetch(`${apiBaseUrl}/api/v1/cust?page=1&limit=100`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
          }).catch(() => ({ ok: false }))
        ]);

        const allPeople: PersonEntity[] = [];

        if (employeesRes.ok) {
          const empData = await employeesRes.json();
          const employees = (empData.data || []).map((emp: any) => ({
            id: emp.id,
            name: emp.name,
            type: 'employee' as const,
            email: emp.email
          }));
          allPeople.push(...employees);
        }

        if (customersRes.ok) {
          const custData = await customersRes.json();
          const customers = (custData.data || []).map((cust: any) => ({
            id: cust.id,
            name: cust.name,
            type: 'customer' as const
          }));
          allPeople.push(...customers);
        }

        setPeople(allPeople);

        // Auto-select first few people
        if (allPeople.length > 0) {
          const initialSelected = new Set(allPeople.slice(0, Math.min(3, allPeople.length)).map(p => p.id));
          setSelectedPersonIds(initialSelected);
        }
      } catch (error) {
        console.error('Failed to fetch people:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPeople();
  }, []);

  // Toggle person selection
  const togglePerson = (personId: string) => {
    setSelectedPersonIds(prev => {
      const next = new Set(prev);
      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.add(personId);
      }
      return next;
    });
  };

  // Toggle all people in a type
  const toggleAllType = (type: 'employee' | 'customer') => {
    const typePeople = people.filter(p => p.type === type);
    const allSelected = typePeople.every(p => selectedPersonIds.has(p.id));

    setSelectedPersonIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        typePeople.forEach(p => next.delete(p.id));
      } else {
        typePeople.forEach(p => next.add(p.id));
      }
      return next;
    });
  };

  // Toggle section expand/collapse
  const toggleSection = (type: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // Filter data by selected people
  const filteredData = useMemo(() => {
    if (selectedPersonIds.size === 0) return data;
    return data.filter(slot => selectedPersonIds.has(slot.person_entity_id));
  }, [data, selectedPersonIds]);

  // Group people by type
  const peopleByType = useMemo(() => {
    return people.reduce((acc, person) => {
      if (!acc[person.type]) acc[person.type] = [];
      acc[person.type].push(person);
      return acc;
    }, {} as Record<string, PersonEntity[]>);
  }, [people]);

  // Generate week days array
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 5; i++) { // Monday to Friday
      const day = new Date(currentWeekStart);
      day.setDate(currentWeekStart.getDate() + i);
      days.push(day);
    }
    return days;
  }, [currentWeekStart]);

  // Generate time slots (9 AM to 8 PM, 15-minute increments)
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 9; hour <= 19; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        slots.push({ hour, minute });
      }
    }
    return slots;
  }, []);

  // Group slots by date and time
  const slotsByDateTime = useMemo(() => {
    const grouped: Record<string, Record<string, any[]>> = {};

    filteredData.forEach(slot => {
      const fromDate = new Date(slot.from_ts);
      const dateKey = fromDate.toISOString().split('T')[0];
      const timeKey = `${fromDate.getHours()}:${fromDate.getMinutes().toString().padStart(2, '0')}`;

      if (!grouped[dateKey]) {
        grouped[dateKey] = {};
      }
      if (!grouped[dateKey][timeKey]) {
        grouped[dateKey][timeKey] = [];
      }
      grouped[dateKey][timeKey].push(slot);
    });

    return grouped;
  }, [filteredData]);

  // Navigate weeks
  const goToPreviousWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeekStart(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeekStart(newDate);
  };

  const goToToday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    setCurrentWeekStart(new Date(today.setDate(diff)));
  };

  // Format helpers
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTimeSlot = (hour: number, minute: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  // Get slots for a specific date and time
  const getSlots = (date: Date, hour: number, minute: number) => {
    const dateKey = date.toISOString().split('T')[0];
    const timeKey = `${hour}:${minute.toString().padStart(2, '0')}`;
    return slotsByDateTime[dateKey]?.[timeKey] || [];
  };

  // Get person by ID
  const getPersonById = (id: string) => people.find(p => p.id === id);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'employee': return <User className="h-4 w-4" />;
      case 'client': return <Building className="h-4 w-4" />;
      case 'customer': return <Users className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  // Drag-and-drop handlers
  const handleMouseDown = (date: Date, hour: number, minute: number, existingSlot?: any) => {
    if (existingSlot && !existingSlot.availability_flag) {
      // Start moving an existing booked event
      setDragState({
        isCreating: false,
        isMoving: true,
        dragStartSlot: { date, hour, minute },
        dragEndSlot: null,
        movingEventId: existingSlot.id
      });
    } else {
      // Start creating a new event
      // Use the first selected person, or the first available person
      const firstSelectedPerson = Array.from(selectedPersonIds)[0] || people[0]?.id;
      setDragState({
        isCreating: true,
        isMoving: false,
        dragStartSlot: { date, hour, minute, personId: firstSelectedPerson },
        dragEndSlot: { date, hour, minute },
        movingEventId: null
      });
    }
  };

  const handleMouseEnter = (date: Date, hour: number, minute: number) => {
    if (dragState.isCreating && dragState.dragStartSlot) {
      setDragState(prev => ({
        ...prev,
        dragEndSlot: { date, hour, minute }
      }));
    }
    if (dragState.isMoving) {
      setDragOverSlot({ date, hour, minute });
    }
  };

  const handleMouseUp = async (date: Date, hour: number, minute: number) => {
    if (dragState.isCreating && dragState.dragStartSlot) {
      // Create new event
      const { dragStartSlot, dragEndSlot } = dragState;
      if (dragEndSlot) {
        const startTime = new Date(dragStartSlot.date);
        startTime.setHours(dragStartSlot.hour, dragStartSlot.minute, 0, 0);

        const endTime = new Date(dragEndSlot.date);
        endTime.setHours(dragEndSlot.hour, dragEndSlot.minute + 15, 0, 0); // Add 15 minutes to include the end slot

        // Open modal to fill in details
        const person = getPersonById(dragStartSlot.personId || Array.from(selectedPersonIds)[0] || people[0]?.id);
        setModalData({
          person_entity_type: person?.type || 'employee',
          person_entity_id: person?.id || '',
          from_ts: startTime.toISOString(),
          to_ts: endTime.toISOString(),
          timezone: 'America/Toronto',
          availability_flag: false, // Default to booking
          title: '',
          appointment_medium: 'onsite',
          appointment_addr: '',
          instructions: ''
        });
        setModalMode('create');
        setModalOpen(true);
      }
    } else if (dragState.isMoving && dragState.movingEventId && dragOverSlot) {
      // Move existing event
      await handleMoveEvent(dragState.movingEventId, dragOverSlot);
    }

    // Reset drag state
    setDragState({
      isCreating: false,
      isMoving: false,
      dragStartSlot: null,
      dragEndSlot: null,
      movingEventId: null
    });
    setDragOverSlot(null);
  };

  const handleMoveEvent = async (eventId: string, newSlot: { date: Date; hour: number; minute: number }) => {
    try {
      const token = localStorage.getItem('auth_token');
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

      // Find the original event
      const originalEvent = filteredData.find(slot => slot.id === eventId);
      if (!originalEvent) return;

      // Calculate the duration of the original event
      const originalStart = new Date(originalEvent.from_ts);
      const originalEnd = new Date(originalEvent.to_ts);
      const durationMs = originalEnd.getTime() - originalStart.getTime();

      // Calculate new start and end times
      const newStart = new Date(newSlot.date);
      newStart.setHours(newSlot.hour, newSlot.minute, 0, 0);
      const newEnd = new Date(newStart.getTime() + durationMs);

      // Update the event
      const response = await fetch(`${apiBaseUrl}/api/v1/person-calendar/${eventId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from_ts: newStart.toISOString(),
          to_ts: newEnd.toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to move event');
      }

      // Refresh data
      window.location.reload();
    } catch (error) {
      console.error('Failed to move event:', error);
      alert('Failed to move event. Please try again.');
    }
  };

  const handleEditSlot = (slot: any) => {
    setModalData({
      id: slot.id,
      person_entity_type: slot.person_entity_type,
      person_entity_id: slot.person_entity_id,
      from_ts: slot.from_ts,
      to_ts: slot.to_ts,
      timezone: slot.timezone || 'America/Toronto',
      availability_flag: slot.availability_flag,
      title: slot.title || '',
      appointment_medium: slot.appointment_medium || 'onsite',
      appointment_addr: slot.appointment_addr || '',
      instructions: slot.instructions || ''
    });
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!window.confirm('Are you sure you want to delete this calendar slot?')) {
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

      const response = await fetch(`${apiBaseUrl}/api/v1/person-calendar/${slotId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete slot');
      }

      // Refresh data
      window.location.reload();
    } catch (error) {
      console.error('Failed to delete slot:', error);
      alert('Failed to delete slot. Please try again.');
    }
  };

  const handleSaveEvent = async (eventData: EventFormData) => {
    try {
      const token = localStorage.getItem('auth_token');
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

      const url = modalMode === 'create'
        ? `${apiBaseUrl}/api/v1/person-calendar`
        : `${apiBaseUrl}/api/v1/person-calendar/${modalData?.id}`;

      const method = modalMode === 'create' ? 'POST' : 'PATCH';

      // Generate unique code for new events
      const code = modalMode === 'create'
        ? `${eventData.person_entity_type.toUpperCase().slice(0, 3)}-CAL-${Date.now()}`
        : undefined;

      const body = modalMode === 'create'
        ? { ...eventData, code, name: eventData.title || 'Calendar Slot' }
        : eventData;

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`Failed to ${modalMode} event`);
      }

      // Refresh data
      window.location.reload();
    } catch (error) {
      console.error(`Failed to ${modalMode} event:`, error);
      throw error;
    }
  };

  // Check if a slot is in the drag selection
  const isInDragSelection = (date: Date, hour: number, minute: number): boolean => {
    if (!dragState.isCreating || !dragState.dragStartSlot || !dragState.dragEndSlot) {
      return false;
    }

    const { dragStartSlot, dragEndSlot } = dragState;
    const currentTime = new Date(date);
    currentTime.setHours(hour, minute, 0, 0);

    const startTime = new Date(dragStartSlot.date);
    startTime.setHours(dragStartSlot.hour, dragStartSlot.minute, 0, 0);

    const endTime = new Date(dragEndSlot.date);
    endTime.setHours(dragEndSlot.hour, dragEndSlot.minute, 0, 0);

    const minTime = startTime < endTime ? startTime : endTime;
    const maxTime = startTime > endTime ? startTime : endTime;

    return currentTime >= minTime && currentTime <= maxTime;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dark-700 mx-auto mb-2" />
          <p className="text-dark-700 text-sm">Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Sidebar with Person Filters */}
      <div className={`${sidebarCollapsed ? 'w-12' : 'w-64'} border-r border-dark-300 bg-white transition-all duration-200 flex-shrink-0`}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-3 border-b border-dark-300">
          {!sidebarCollapsed && (
            <h3 className="text-sm font-medium text-dark-600">Filter by Person</h3>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1 rounded hover:bg-dark-100 transition-colors"
            title={sidebarCollapsed ? 'Expand' : 'Collapse'}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {!sidebarCollapsed && (
          <div className="overflow-y-auto h-[calc(100%-57px)]">
            {/* Employee Section */}
            {peopleByType.employee && peopleByType.employee.length > 0 && (
              <div className="border-b border-dark-200">
                <button
                  onClick={() => toggleSection('employee')}
                  className="w-full flex items-center justify-between p-3 hover:bg-dark-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-dark-600">Employees ({peopleByType.employee.length})</span>
                  </div>
                  {expandedSections.has('employee') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {expandedSections.has('employee') && (
                  <div className="px-3 py-2 space-y-1">
                    <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-dark-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={peopleByType.employee.every(p => selectedPersonIds.has(p.id))}
                        onChange={() => toggleAllType('employee')}
                        className="rounded border-dark-400 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-medium text-dark-600">Select All</span>
                    </label>
                    {peopleByType.employee.map(person => (
                      <label key={person.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-dark-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedPersonIds.has(person.id)}
                          onChange={() => togglePerson(person.id)}
                          className="rounded border-dark-400 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs text-dark-600 truncate flex-1">{person.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Customer Section */}
            {peopleByType.customer && peopleByType.customer.length > 0 && (
              <div className="border-b border-dark-200">
                <button
                  onClick={() => toggleSection('customer')}
                  className="w-full flex items-center justify-between p-3 hover:bg-dark-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-medium text-dark-600">Customers ({peopleByType.customer.length})</span>
                  </div>
                  {expandedSections.has('customer') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {expandedSections.has('customer') && (
                  <div className="px-3 py-2 space-y-1">
                    <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-dark-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={peopleByType.customer.every(p => selectedPersonIds.has(p.id))}
                        onChange={() => toggleAllType('customer')}
                        className="rounded border-dark-400 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-xs font-medium text-dark-600">Select All</span>
                    </label>
                    {peopleByType.customer.map(person => (
                      <label key={person.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-dark-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedPersonIds.has(person.id)}
                          onChange={() => togglePerson(person.id)}
                          className="rounded border-dark-400 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-xs text-dark-600 truncate flex-1">{person.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Calendar Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="p-4 space-y-4">
          {/* Header with Week Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-dark-600">
              <CalendarIcon className="h-5 w-5" />
              <span className="font-medium">
                {selectedPersonIds.size} {selectedPersonIds.size === 1 ? 'person' : 'people'} selected
              </span>
              <span className="text-xs text-dark-700 ml-2">
                (Drag on empty slots to create events, drag events to move them)
              </span>
            </div>

            {/* Week Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={goToPreviousWeek}
                className="p-1.5 rounded-md hover:bg-dark-100 transition-colors"
                title="Previous Week"
              >
                <ChevronLeft className="h-5 w-5 text-dark-600" />
              </button>

              <button
                onClick={goToToday}
                className="px-3 py-1.5 text-sm font-medium text-dark-600 hover:bg-dark-100 rounded-md transition-colors"
              >
                Today
              </button>

              <span className="text-sm font-medium text-dark-600 px-3">
                {formatDate(weekDays[0])} - {formatDate(weekDays[4])}
              </span>

              <button
                onClick={goToNextWeek}
                className="p-1.5 rounded-md hover:bg-dark-100 transition-colors"
                title="Next Week"
              >
                <ChevronRight className="h-5 w-5 text-dark-600" />
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="border border-dark-300 rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-[calc(100vh-220px)]">
              <table className="w-full border-collapse select-none">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-dark-100">
                    <th className="border border-dark-300 px-3 py-2 text-left text-sm font-medium text-dark-600 w-24 sticky left-0 bg-dark-100">
                      Time
                    </th>
                    {weekDays.map((day, idx) => (
                      <th key={idx} className="border border-dark-300 px-3 py-2 text-center text-sm font-medium text-dark-600 min-w-[120px]">
                        <div>{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                        <div className="text-xs font-normal text-dark-700">{formatDate(day)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.map(({ hour, minute }, timeIdx) => (
                    <tr key={timeIdx} className="hover:bg-dark-50">
                      <td className="border border-dark-300 px-3 py-2 text-xs text-dark-700 font-medium sticky left-0 bg-white">
                        {formatTimeSlot(hour, minute)}
                      </td>
                      {weekDays.map((day, dayIdx) => {
                        const slots = getSlots(day, hour, minute);
                        const isInSelection = isInDragSelection(day, hour, minute);
                        const isDragOver = dragOverSlot &&
                          dragOverSlot.date.toISOString().split('T')[0] === day.toISOString().split('T')[0] &&
                          dragOverSlot.hour === hour &&
                          dragOverSlot.minute === minute;

                        return (
                          <td
                            key={dayIdx}
                            className={`border border-dark-300 px-1 py-1 text-xs align-top ${
                              isInSelection ? 'bg-blue-100 border-blue-400' : ''
                            } ${isDragOver ? 'bg-yellow-100 border-yellow-400' : ''} cursor-pointer`}
                            onMouseDown={() => handleMouseDown(day, hour, minute, slots[0])}
                            onMouseEnter={() => handleMouseEnter(day, hour, minute)}
                            onMouseUp={() => handleMouseUp(day, hour, minute)}
                          >
                            {slots.length > 0 && (
                              <div className="space-y-0.5">
                                {slots.map((slot, slotIdx) => {
                                  const person = getPersonById(slot.person_entity_id);
                                  const isAvailable = slot.availability_flag === true;
                                  const isBooked = slot.availability_flag === false;
                                  const colors = PERSON_TYPE_COLORS[person?.type || 'employee'];

                                  return (
                                    <div
                                      key={slotIdx}
                                      className={`px-1.5 py-1 rounded group relative ${
                                        isAvailable ? 'bg-green-50 hover:bg-green-100' :
                                        isBooked ? colors.bg + ' hover:opacity-80' :
                                        'bg-dark-50'
                                      } border ${
                                        isAvailable ? 'border-green-200' :
                                        isBooked ? colors.border :
                                        'border-dark-200'
                                      } transition-colors cursor-move`}
                                      title={`${person?.name || 'Unknown'}: ${slot.title || (isAvailable ? 'Available' : 'Booked')}`}
                                      draggable={isBooked}
                                    >
                                      <div className="flex items-center gap-1">
                                        <div className={`w-1.5 h-1.5 rounded-full ${colors.dot} flex-shrink-0`} />
                                        {isBooked && slot.title && (
                                          <div className={`font-medium ${colors.text} truncate text-xs flex-1`}>
                                            {slot.title}
                                          </div>
                                        )}
                                        {isAvailable && (
                                          <div className="text-green-700 text-xs">Available</div>
                                        )}
                                      </div>
                                      {/* Action buttons (show on hover) */}
                                      <div className="absolute right-1 top-1 hidden group-hover:flex gap-1">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleEditSlot(slot);
                                          }}
                                          className="p-0.5 bg-white rounded shadow hover:bg-blue-50"
                                          title="Edit"
                                        >
                                          <Edit2 className="h-3 w-3 text-blue-600" />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteSlot(slot.id);
                                          }}
                                          className="p-0.5 bg-white rounded shadow hover:bg-red-50"
                                          title="Delete"
                                        >
                                          <Trash2 className="h-3 w-3 text-red-600" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-dark-700 flex-wrap">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-100 border border-green-200 rounded" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded" />
              <span>Employee Booked</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-purple-100 border border-purple-300 rounded" />
              <span>Customer Booked</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-100 border border-blue-400 rounded" />
              <span>Drag Selection</span>
            </div>
          </div>

          {/* Empty State */}
          {filteredData.length === 0 && (
            <div className="text-center py-12">
              <CalendarIcon className="h-12 w-12 text-dark-400 mx-auto mb-3" />
              <p className="text-dark-600 text-sm">{emptyMessage}</p>
              {selectedPersonIds.size > 0 && (
                <p className="text-dark-700 text-xs mt-1">
                  No calendar slots found for the selected {selectedPersonIds.size === 1 ? 'person' : 'people'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Event Modal */}
      <CalendarEventModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setModalData(null);
        }}
        onSave={handleSaveEvent}
        initialData={modalData}
        mode={modalMode}
        employees={peopleByType.employee || []}
        customers={peopleByType.customer || []}
      />
    </div>
  );
}
