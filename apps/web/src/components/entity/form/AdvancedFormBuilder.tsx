import React, { useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Plus, Search, ChevronLeft, ChevronRight, Layers, X,
  Type, MessageSquare, Hash, Mail, Phone, Globe, ChevronDown, Radio,
  CheckSquare, Calendar, Upload, Sliders, PenTool, Home, Navigation,
  Camera, Video, QrCode, Barcode, BookOpen, Table, DollarSign, CalendarDays,
  Clock, ToggleLeft, Star, Timer, Calculator, Percent, Menu
} from 'lucide-react';
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors, DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import {
  BuilderField, FieldType, FormStep,
  DraggableFieldType, DroppableFormCanvas, SortableFieldCard, getFieldIcon
} from './FormBuilder';
import { FormPreview } from './FormPreview';

// Field types palette configuration
const FIELD_TYPES_PALETTE = [
  { type: 'text' as FieldType, label: 'Text Input', hint: 'Single line text field', icon: <Type className="h-4 w-4" /> },
  { type: 'textarea' as FieldType, label: 'Text Area', hint: 'Multi-line text field', icon: <MessageSquare className="h-4 w-4" /> },
  { type: 'number' as FieldType, label: 'Number', hint: 'Numeric input', icon: <Hash className="h-4 w-4" /> },
  { type: 'email' as FieldType, label: 'Email', hint: 'Email address', icon: <Mail className="h-4 w-4" /> },
  { type: 'phone' as FieldType, label: 'Phone', hint: 'Phone number', icon: <Phone className="h-4 w-4" /> },
  { type: 'url' as FieldType, label: 'URL', hint: 'Website URL', icon: <Globe className="h-4 w-4" /> },
  { type: 'select' as FieldType, label: 'Select (Single)', hint: 'Dropdown - single value', icon: <ChevronDown className="h-4 w-4" /> },
  { type: 'select_multiple' as FieldType, label: 'Select (Multiple)', hint: 'Dropdown - multiple values', icon: <CheckSquare className="h-4 w-4" /> },
  { type: 'radio' as FieldType, label: 'Radio Buttons', hint: 'Single choice', icon: <Radio className="h-4 w-4" /> },
  { type: 'checkbox' as FieldType, label: 'Checkboxes', hint: 'Multiple choices', icon: <CheckSquare className="h-4 w-4" /> },
  { type: 'taskcheck' as FieldType, label: 'Task Checkbox', hint: 'Single checkbox with timestamp', icon: <CheckSquare className="h-4 w-4" /> },
  { type: 'datetime' as FieldType, label: 'Date/Time', hint: 'Date and time picker', icon: <Calendar className="h-4 w-4" /> },
  { type: 'file' as FieldType, label: 'File Upload', hint: 'Upload files', icon: <Upload className="h-4 w-4" /> },
  { type: 'range' as FieldType, label: 'Range Slider', hint: 'Numeric range', icon: <Sliders className="h-4 w-4" /> },
  { type: 'signature' as FieldType, label: 'Signature', hint: 'Digital signature', icon: <PenTool className="h-4 w-4" /> },
  { type: 'initials' as FieldType, label: 'Initials', hint: 'Initial signature', icon: <PenTool className="h-4 w-4" /> },
  { type: 'address' as FieldType, label: 'Address', hint: 'Full address input', icon: <Home className="h-4 w-4" /> },
  { type: 'geolocation' as FieldType, label: 'Geolocation', hint: 'GPS coordinates', icon: <Navigation className="h-4 w-4" /> },
  { type: 'image_capture' as FieldType, label: 'Image Capture', hint: 'Take a photo', icon: <Camera className="h-4 w-4" /> },
  { type: 'video_capture' as FieldType, label: 'Video Capture', hint: 'Record video', icon: <Video className="h-4 w-4" /> },
  { type: 'qr_scanner' as FieldType, label: 'QR Scanner', hint: 'Scan QR codes', icon: <QrCode className="h-4 w-4" /> },
  { type: 'barcode_scanner' as FieldType, label: 'Barcode Scanner', hint: 'Scan barcodes', icon: <Barcode className="h-4 w-4" /> },
  { type: 'wiki' as FieldType, label: 'Rich Text / Wiki', hint: 'Advanced text editor', icon: <BookOpen className="h-4 w-4" /> },
  { type: 'datatable' as FieldType, label: 'Data Table', hint: 'Dynamic row/column table', icon: <Table className="h-4 w-4" /> },
  { type: 'currency' as FieldType, label: 'Currency', hint: 'Money with formatting', icon: <DollarSign className="h-4 w-4" /> },
  { type: 'date' as FieldType, label: 'Date Only', hint: 'Date without time', icon: <CalendarDays className="h-4 w-4" /> },
  { type: 'time' as FieldType, label: 'Time Only', hint: 'Time without date', icon: <Clock className="h-4 w-4" /> },
  { type: 'toggle' as FieldType, label: 'Toggle Switch', hint: 'On/off switch', icon: <ToggleLeft className="h-4 w-4" /> },
  { type: 'rating' as FieldType, label: 'Star Rating', hint: 'Rating with stars', icon: <Star className="h-4 w-4" /> },
  { type: 'duration' as FieldType, label: 'Duration', hint: 'Hours and minutes', icon: <Timer className="h-4 w-4" /> },
  { type: 'percentage' as FieldType, label: 'Percentage', hint: 'Number with %', icon: <Percent className="h-4 w-4" /> },
  { type: 'calculation' as FieldType, label: 'Calculation', hint: 'Auto-calculated value', icon: <Calculator className="h-4 w-4" /> },
  { type: 'menu_button' as FieldType, label: 'Menu Button', hint: 'Single menu or dropdown with links', icon: <Menu className="h-4 w-4" /> },
];

interface AdvancedFormBuilderProps {
  title?: string;
  description?: string;
  taskId?: string;
  initialFormData?: any; // For loading existing forms
  onSave?: (formData: any) => Promise<void>;
  onSaveDraft?: (formData: any) => Promise<void>;
  onCancel?: () => void;
  backLink?: string;
  headerTitle?: string;
  autoSaveInterval?: number; // in milliseconds, default 30000
  headerActions?: ReactNode; // Additional action buttons (e.g., Share, Link)
}

export function AdvancedFormBuilder({
  title: initialTitle = '',
  description: initialDescription = '',
  taskId,
  initialFormData,
  onSave,
  onSaveDraft,
  onCancel,
  backLink = '/form',
  headerTitle = 'Create Multi-Step Form',
  autoSaveInterval = 30000,
  headerActions,
}: AdvancedFormBuilderProps) {
  const navigate = useNavigate();

  // Helper to restore form state from saved schema
  const restoreFormState = (formData: any) => {
    if (!formData || !formData.form_schema) return null;

    const schema = formData.form_schema;

    if (schema?.steps && Array.isArray(schema.steps)) {
      // Restore steps
      const restoredSteps = schema.steps.map((s: any, idx: number) => ({
        id: s.id || `step-${idx + 1}`,
        name: s.name || `step_${idx + 1}`,
        title: s.title || `Step ${idx + 1}`,
        description: s.description || ''
      }));

      // Restore fields from steps
      const restoredFields: BuilderField[] = [];
      schema.steps.forEach((step: any) => {
        if (step.fields && Array.isArray(step.fields)) {
          step.fields.forEach((field: any, idx: number) => {
            restoredFields.push({
              ...field,
              id: field.id || `field-${step.id}-${idx}`,
              stepId: step.id,
            });
          });
        }
      });

      return {
        steps: restoredSteps,
        fields: restoredFields,
        currentStepIndex: 0
      };
    }

    return null;
  };

  const restored = initialFormData ? restoreFormState(initialFormData) : null;

  const [title, setTitle] = useState(initialFormData?.name || initialTitle);
  const [descr, setDescr] = useState(initialFormData?.descr || initialDescription);
  const [steps, setSteps] = useState<FormStep[]>(
    restored?.steps || [{ id: 'step-1', name: 'step_1', title: 'General Information', description: '' }]
  );
  const [fields, setFields] = useState<BuilderField[]>(restored?.fields || []);
  const [currentStepIndex, setCurrentStepIndex] = useState(restored?.currentStepIndex || 0);

  // Re-restore form state when initialFormData changes (for async loading)
  useEffect(() => {
    if (initialFormData) {
      const restored = restoreFormState(initialFormData);
      if (restored) {
        setSteps(restored.steps);
        setFields(restored.fields);
        setCurrentStepIndex(restored.currentStepIndex);
      }
      // Also update title and description from loaded form
      if (initialFormData.name) setTitle(initialFormData.name);
      if (initialFormData.descr) setDescr(initialFormData.descr);
    }
  }, [initialFormData]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const currentStep = steps[currentStepIndex];
  const currentStepFields = fields.filter(f => f.stepId === currentStep?.id);

  const filteredPalette = FIELD_TYPES_PALETTE.filter(p =>
    p.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.hint.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // DnD sensors - reduced activation distance for smoother dragging
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 3 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  // Keyboard navigation for steps
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateToStep(currentStepIndex - 1);
      } else if (e.ctrlKey && e.key === 'ArrowRight') {
        e.preventDefault();
        navigateToStep(currentStepIndex + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStepIndex, steps]);

  const navigateToStep = (index: number) => {
    if (index >= 0 && index < steps.length) {
      setCurrentStepIndex(index);
    }
  };

  const addStep = () => {
    const newStepNumber = steps.length + 1;
    const newStep: FormStep = {
      id: `step-${Date.now()}`,
      name: `step_${newStepNumber}`,
      title: `Step ${newStepNumber}`,
      description: '',
    };
    setSteps(prev => [...prev, newStep]);
    setCurrentStepIndex(steps.length);
  };

  const removeStep = (stepId: string) => {
    if (steps.length === 1) return;
    const stepIndex = steps.findIndex(s => s.id === stepId);
    const newSteps = steps.filter(s => s.id !== stepId);
    setSteps(newSteps);
    setFields(prev => prev.filter(f => f.stepId !== stepId));
    if (currentStepIndex >= stepIndex && currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const updateStepName = (stepId: string, newTitle: string) => {
    setSteps(prev => prev.map(s => s.id === stepId ? { ...s, title: newTitle } : s));
  };

  const addField = (type: FieldType, insertAfterFieldId?: string) => {
    const id = `field-${Date.now()}`;
    const base = {
      id,
      name: `${type}_${Date.now()}`,
      label: FIELD_TYPES_PALETTE.find(p => p.type === type)?.label || type,
      type,
      stepId: currentStep?.id,
      required: false,
      ...(type === 'select' || type === 'select_multiple' || type === 'radio' || type === 'checkbox' ? {
        options: ['Option 1', 'Option 2', 'Option 3']
      } : {}),
      ...(type === 'range' ? {
        min: 0,
        max: 100,
        step: 1
      } : {}),
      ...(type === 'datetime' ? {
        showTimeSelect: true,
        dateFormat: 'MMM d, yyyy h:mm aa',
        placeholder: 'Select date and time'
      } : {}),
      ...(type === 'wiki' ? {
        wikiTitle: 'Documentation',
        wikiHeight: 400,
        wikiContent: '<h1>Welcome</h1><p>Start creating your documentation...</p>'
      } : {}),
      ...(type === 'datatable' ? {
        dataTableName: `table_${Date.now()}`,
        dataTableColumns: [
          { name: 'col1', label: 'Column 1' },
          { name: 'col2', label: 'Column 2' },
          { name: 'col3', label: 'Column 3' }
        ],
        dataTableDefaultRows: 1
      } : {}),
      ...(type === 'currency' ? {
        currencySymbol: '$',
        currencyCode: 'USD',
        placeholder: '0.00'
      } : {}),
      ...(type === 'date' ? {
        placeholder: 'Select date'
      } : {}),
      ...(type === 'time' ? {
        placeholder: 'Select time'
      } : {}),
      ...(type === 'toggle' ? {
        placeholder: 'Enable this option'
      } : {}),
      ...(type === 'rating' ? {
        maxRating: 5,
        ratingIcon: 'star'
      } : {}),
      ...(type === 'duration' ? {
        durationFormat: 'hours_minutes',
        placeholder: 'Enter duration'
      } : {}),
      ...(type === 'percentage' ? {
        percentageMin: 0,
        percentageMax: 100,
        placeholder: '0'
      } : {}),
      ...(type === 'calculation' ? {
        calculationMode: 'simple',
        calculationOperation: 'sum',
        calculationFields: [],
        calculationExpression: '',
        currencySymbol: '$'
      } : {}),
      ...(type === 'menu_button' ? {
        menuButtonType: 'single',
        menuButtonItems: [
          { id: `item-${Date.now()}`, label: 'Menu Item 1', url: '/path', icon: '', openInNewTab: false }
        ],
        menuButtonStyle: 'primary',
        menuButtonSize: 'md'
      } : {}),
    } as BuilderField;

    // If insertAfterFieldId is provided, insert after that field
    if (insertAfterFieldId) {
      setFields(prev => {
        const insertIndex = prev.findIndex(f => f.id === insertAfterFieldId);
        if (insertIndex !== -1) {
          const newFields = [...prev];
          newFields.splice(insertIndex + 1, 0, base);
          return newFields;
        }
        return [...prev, base];
      });
    } else {
      setFields(prev => [...prev, base]);
    }
    setActiveId(id);
  };

  const removeField = (fieldId: string) => {
    setFields(prev => prev.filter(f => f.id !== fieldId));
    if (activeId === fieldId) {
      setActiveId(null);
    }
  };

  const onDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === 'field-type') {
      setActiveId(active.id as string);
      return;
    }
    setActiveId(active.id as string);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (active.data.current?.type === 'field-type' && over?.id === 'form-canvas') {
      const fieldType = active.data.current.fieldType as FieldType;
      addField(fieldType);
      return;
    }

    if (!over || active.id === over.id) return;
    const activeField = currentStepFields.find(f => f.id === active.id);
    const overField = currentStepFields.find(f => f.id === over.id);
    if (!activeField || !overField) return;

    const oldIndex = currentStepFields.findIndex(f => f.id === active.id);
    const newIndex = currentStepFields.findIndex(f => f.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedStepFields = arrayMove(currentStepFields, oldIndex, newIndex);
    const otherFields = fields.filter(f => f.stepId !== currentStep?.id);
    setFields([...otherFields, ...reorderedStepFields]);
  };

  // Draft saving functionality
  const saveDraft = async () => {
    if (!onSaveDraft) return;

    setSavingDraft(true);
    try {
      const multiStepSchema = {
        steps: steps.map(step => ({
          id: step.id,
          name: step.name,
          title: step.title,
          description: step.description,
          fields: fields.filter(f => f.stepId === step.id).map(({ id, stepId, ...f }) => f)
        })),
        currentStepIndex
      };

      const formData = {
        name: title,
        descr: descr || undefined,
        taskSpecific: !!taskId,
        taskId,
        form_schema: multiStepSchema,
        isDraft: true,
        formBuilderState: {
          steps,
          fields,
          currentStepIndex,
          title,
          descr
        }
      };

      await onSaveDraft(formData);
    } catch (e) {
      console.error('Failed to save draft', e);
    } finally {
      setSavingDraft(false);
    }
  };

  // Auto-save draft
  useEffect(() => {
    if (!onSaveDraft) return;

    const interval = setInterval(() => {
      if (title && (fields.length > 0 || steps.length > 1)) {
        saveDraft();
      }
    }, autoSaveInterval);

    return () => clearInterval(interval);
  }, [title, fields, steps, descr, taskId, currentStepIndex, onSaveDraft]);

  const handleSaveForm = async () => {
    if (!onSave) return;

    setSaving(true);
    try {
      const multiStepSchema = {
        steps: steps.map(step => ({
          id: step.id,
          name: step.name,
          title: step.title,
          description: step.description,
          fields: fields.filter(f => f.stepId === step.id).map(({ id, stepId, ...f }) => f)
        })),
        currentStepIndex: 0
      };

      const formData = {
        name: title,
        descr: descr || undefined,
        taskSpecific: !!taskId,
        taskId,
        form_schema: multiStepSchema,
        isMultiStep: steps.length > 1,
        totalSteps: steps.length,
        stepConfiguration: steps,
        fieldSequence: fields.map(f => ({ id: f.id, stepId: f.stepId, order: fields.indexOf(f) }))
      };

      await onSave(formData);
    } catch (e) {
      console.error('Failed to save form', e);
      alert('Failed to save form');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate(backLink);
    }
  };

  return (
    <div className="flex flex-col space-y-4 max-w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={handleCancel}
            className="h-10 w-10 bg-dark-100 border border-dark-300 rounded-lg flex items-center justify-center hover:bg-dark-100"
            title="Back"
          >
            <ArrowLeft className="h-5 w-5 text-dark-600 stroke-[1.5]" />
          </button>
          <div>
            <h1 className="text-sm font-normal text-dark-600">{headerTitle}</h1>
            <p className="mt-1 text-xs font-light text-dark-700">
              Composable, drag-and-drop form builder • Step {currentStepIndex + 1} of {steps.length}
              {savingDraft && <span className="text-dark-700 ml-2">• Draft saving...</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {headerActions}
          {onSaveDraft && (
            <button
              onClick={saveDraft}
              disabled={savingDraft || !title}
              className="inline-flex items-center px-3 py-1.5 border border-dark-400 text-sm font-normal rounded text-dark-600 bg-dark-100 hover:bg-dark-100 hover:border-dark-400 disabled:opacity-50 transition-colors"
            >
              <Save className="h-4 w-4 mr-2 stroke-[1.5]" />
              {savingDraft ? 'Saving Draft..' : 'Save Draft'}
            </button>
          )}
          {onSave && (
            <button
              onClick={handleSaveForm}
              disabled={saving || !title || fields.length === 0}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-normal rounded text-white bg-dark-700 hover:bg-dark-800 disabled:opacity-50 transition-colors"
            >
              <Save className="h-4 w-4 mr-2 stroke-[1.5]" />
              {saving ? 'Publishing...' : 'Publish Form'}
            </button>
          )}
        </div>
      </div>

      {/* Step Navigation */}
      <div className="bg-dark-100 rounded-xl shadow-sm border border-dark-300 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Layers className="h-5 w-5 text-dark-700 stroke-[1.5]" />
            <h3 className="text-sm font-normal text-dark-600">Form Steps</h3>
            <span className="text-xs font-light text-dark-700">Use Ctrl+← / Ctrl+→ to navigate</span>
          </div>
          <button
            onClick={addStep}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-normal rounded text-white bg-dark-700 hover:bg-dark-800 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2 stroke-[1.5]" />
            Add Step
          </button>
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto pb-2">
          <button
            onClick={() => navigateToStep(currentStepIndex - 1)}
            disabled={currentStepIndex === 0}
            className="p-1.5 rounded-md border border-dark-300 hover:bg-dark-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Previous step (Ctrl+←)"
          >
            <ChevronLeft className="h-4 w-4 stroke-[1.5]" />
          </button>

          <div className="flex space-x-1 min-w-0 flex-1">
            {steps.map((step, index) => (
              <div key={step.id} className="relative group">
                <button
                  onClick={() => navigateToStep(index)}
                  className={`px-3 py-2 rounded-lg text-sm font-normal transition-colors min-w-0 flex items-center space-x-2 ${
                    index === currentStepIndex
                      ? 'bg-dark-100 text-dark-700 border border-dark-400'
                      : 'bg-dark-100 text-dark-700 hover:bg-dark-100 border border-dark-300'
                  }`}
                >
                  <span className="truncate">{step.title}</span>
                  <span className="text-xs bg-dark-100 bg-opacity-70 px-1.5 py-0.5 rounded">
                    {fields.filter(f => f.stepId === step.id).length}
                  </span>
                </button>

                {index === currentStepIndex && (
                  <div className="absolute top-full left-0 mt-1 z-10 min-w-max group-hover:block hidden">
                    <input
                      value={step.title}
                      onChange={(e) => updateStepName(step.id, e.target.value)}
                      className="px-2 py-1 text-xs border border-dark-400 rounded bg-dark-100 shadow-sm"
                      placeholder="Step name"
                    />
                  </div>
                )}

                {steps.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeStep(step.id);
                    }}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs hover:bg-red-600 transition-all"
                    title="Remove step"
                  >
                    <X className="h-2.5 w-2.5 stroke-[1.5]" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={() => navigateToStep(currentStepIndex + 1)}
            disabled={currentStepIndex === steps.length - 1}
            className="p-1.5 rounded-md border border-dark-300 hover:bg-dark-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Next step (Ctrl+→)"
          >
            <ChevronRight className="h-4 w-4 stroke-[1.5]" />
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        {/* Fullscreen Layout: Field Types and Form Builder side by side */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
          {/* Left: Field Types Palette */}
          <aside className="lg:col-span-1 bg-dark-100 rounded-xl shadow-sm border border-dark-300 p-4 flex flex-col overflow-hidden">
            <div className="text-sm font-normal text-dark-600 mb-3">Field Types</div>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-dark-600 stroke-[1.5]" />
              <input
                type="text"
                placeholder="Search field types..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-dark-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-7000 focus:border-transparent"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredPalette.length === 0 ? (
                <div className="text-center py-8 text-dark-700 text-sm">
                  No field types found
                </div>
              ) : (
                filteredPalette.map(p => (
                  <DraggableFieldType
                    key={p.type}
                    fieldType={p}
                    onAddField={(type) => addField(type, activeId || undefined)}
                  />
                ))
              )}
            </div>
          </aside>

          {/* Center & Right: Form Builder and Preview */}
          <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
            {/* Form Canvas */}
            <section className="lg:col-span-2 bg-dark-100 rounded-xl shadow-sm border border-dark-300 p-4 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-normal text-dark-600">
                    {currentStep?.title || 'Step'} - Form Fields
                  </div>
                  <div className="text-xs font-light text-dark-700">
                    Add fields to this step by selecting from the palette
                  </div>
                </div>
                <div className="text-xs font-light text-dark-700">
                  {currentStepFields.length} field{currentStepFields.length !== 1 ? 's' : ''}
                </div>
              </div>

              {currentStepIndex === 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <div className="flex flex-col">
                    <label className="text-sm font-normal text-dark-700 mb-1">Form Title</label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="px-3 py-2 text-sm border border-dark-400 rounded-lg"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-sm font-normal text-dark-700 mb-1">Description</label>
                    <input
                      value={descr}
                      onChange={(e) => setDescr(e.target.value)}
                      placeholder="Optional"
                      className="px-3 py-2 text-sm border border-dark-400 rounded-lg"
                    />
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto">
                <SortableContext items={currentStepFields.map(f => f.id)} strategy={rectSortingStrategy}>
                  <DroppableFormCanvas>
                    {currentStepFields.length === 0 ? (
                      <div className="h-96 border border-dashed border-dark-400 rounded-lg flex flex-col items-center justify-center text-dark-700">
                        <Layers className="h-8 w-8 mb-2 text-dark-600 stroke-[1.5]" />
                        <p className="text-sm">No fields in this step yet</p>
                        <p className="text-xs text-dark-600">Drag field types from the palette or click to add them to {currentStep?.title}</p>
                      </div>
                    ) : (
                      <div className="space-y-3 pb-32">
                        {currentStepFields.map((f) => (
                          <SortableFieldCard
                            key={f.id}
                            field={f}
                            selected={activeId === f.id}
                            onSelect={() => setActiveId(f.id)}
                            onChange={(patch) => setFields(prev => prev.map(p => p.id === f.id ? { ...p, ...patch } : p))}
                            onRemove={() => removeField(f.id)}
                            allFields={currentStepFields}
                          />
                        ))}
                      </div>
                    )}
                  </DroppableFormCanvas>
                </SortableContext>
              </div>
            </section>

            {/* Live Preview */}
            <aside className="lg:col-span-1 bg-dark-100 rounded-xl shadow-sm border border-dark-300 p-4 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-normal text-dark-600">Live Preview</div>
                <div className="text-xs font-light text-dark-700">
                  {currentStep?.title} ({currentStepIndex + 1}/{steps.length})
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                <FormPreview
                  fields={currentStepFields}
                  steps={steps}
                  currentStepIndex={currentStepIndex}
                  showStepProgress={steps.length > 1}
                  onStepClick={navigateToStep}
                />
              </div>
            </aside>
          </div>
        </div>

        <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
          {activeId ? (
            <div className="px-4 py-3 rounded-lg bg-dark-100 border-2 border-dark-600 shadow-2xl">
              {activeId.includes('field-type-') ? (
                <div className="flex items-center space-x-2 text-sm font-normal text-dark-700">
                  <Plus className="h-4 w-4 stroke-[1.5]" />
                  <span>Adding field...</span>
                </div>
              ) : (
                <div className="text-sm font-normal text-dark-600">Moving field...</div>
              )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
