import React, { useMemo, useState, useEffect } from 'react';
import { Layout } from '../components/layout/Layout';
import { useNavigate } from 'react-router-dom';
import { formApi } from '../lib/api';
import { ArrowLeft, Save, Plus, Search, ChevronLeft, ChevronRight, Layers, X } from 'lucide-react';
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors, DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { 
  FieldType, 
  BuilderField, 
  FormStep,
  getFieldIcon,
  DraggableFieldType,
  DroppableFormCanvas,
  SortableFieldCard
} from '../components/forms/FormBuilder';
import { FormPreview } from '../components/forms/FormPreview';

export function FormBuilderPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('Untitled Form');
  const [descr, setDescr] = useState('');
  const [taskId] = useState('');
  const [fields, setFields] = useState<BuilderField[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Multi-step form state
  const [steps, setSteps] = useState<FormStep[]>([
    { id: crypto.randomUUID(), name: 'step_1', title: 'Step 1', description: 'First step of the form' }
  ]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [savingDraft, setSavingDraft] = useState(false);

  const palette: { type: FieldType; label: string; hint: string; icon: React.ReactNode }[] = useMemo(() => ([
    { type: 'text', label: 'Text', hint: 'Single-line input', icon: getFieldIcon('text') },
    { type: 'textarea', label: 'Textarea', hint: 'Multi-line text', icon: getFieldIcon('textarea') },
    { type: 'number', label: 'Number', hint: 'Numeric input', icon: getFieldIcon('number') },
    { type: 'email', label: 'Email', hint: 'Email address', icon: getFieldIcon('email') },
    { type: 'phone', label: 'Phone', hint: 'Phone number', icon: getFieldIcon('phone') },
    { type: 'url', label: 'URL', hint: 'Website address', icon: getFieldIcon('url') },
    { type: 'select', label: 'Select', hint: 'Dropdown options', icon: getFieldIcon('select') },
    { type: 'radio', label: 'Radio', hint: 'Single choice', icon: getFieldIcon('radio') },
    { type: 'checkbox', label: 'Checkbox', hint: 'Yes/No or multiple', icon: getFieldIcon('checkbox') },
    { type: 'datetime', label: 'Date & Time', hint: 'Date/time picker', icon: getFieldIcon('datetime') },
    { type: 'file', label: 'File', hint: 'File upload', icon: getFieldIcon('file') },
    { type: 'range', label: 'Range', hint: 'Slider input', icon: getFieldIcon('range') },
    { type: 'signature', label: 'Signature', hint: 'Drawing canvas for signatures', icon: getFieldIcon('signature') },
    { type: 'initials', label: 'Initials', hint: 'Small canvas for initials', icon: getFieldIcon('initials') },
    { type: 'address', label: 'Address', hint: 'Street address fields', icon: getFieldIcon('address') },
    { type: 'geolocation', label: 'Location', hint: 'GPS coordinates', icon: getFieldIcon('geolocation') },
    { type: 'image_capture', label: 'Image Capture', hint: 'Take photo with camera', icon: getFieldIcon('image_capture') },
    { type: 'video_capture', label: 'Video Capture', hint: 'Record video with camera', icon: getFieldIcon('video_capture') },
    { type: 'qr_scanner', label: 'QR Scanner', hint: 'Scan QR codes with camera', icon: getFieldIcon('qr_scanner') },
    { type: 'barcode_scanner', label: 'Barcode Scanner', hint: 'Scan barcodes with camera', icon: getFieldIcon('barcode_scanner') },
    { type: 'wiki', label: 'Rich Text Wiki', hint: 'Rich text editor for documentation', icon: getFieldIcon('wiki') },
  ]), []);

  const filteredPalette = useMemo(() => {
    if (!searchTerm) return palette;
    return palette.filter(p => 
      p.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.hint.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [palette, searchTerm]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  // Computed values for current step
  const currentStep = steps[currentStepIndex];
  const currentStepFields = fields.filter(f => f.stepId === currentStep?.id || (!f.stepId && currentStepIndex === 0));

  // Step management functions
  const addStep = () => {
    const newStep: FormStep = {
      id: crypto.randomUUID(),
      name: `step_${steps.length + 1}`,
      title: `Step ${steps.length + 1}`,
      description: `Step ${steps.length + 1} of the form`
    };
    setSteps(prev => [...prev, newStep]);
  };

  const removeStep = (stepId: string) => {
    if (steps.length <= 1) return; // Can't remove the last step
    setSteps(prev => prev.filter(s => s.id !== stepId));
    // Remove fields from this step
    setFields(prev => prev.filter(f => f.stepId !== stepId));
    // Adjust current step index if needed
    if (currentStepIndex >= steps.length - 1) {
      setCurrentStepIndex(steps.length - 2);
    }
  };

  const updateStepName = (stepId: string, title: string) => {
    setSteps(prev => prev.map(s => s.id === stepId ? { ...s, title } : s));
  };

  const navigateToStep = (index: number) => {
    if (index >= 0 && index < steps.length) {
      setCurrentStepIndex(index);
    }
  };

  // Keyboard navigation and shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            if (currentStepIndex > 0) {
              setCurrentStepIndex(prev => prev - 1);
            }
            break;
          case 'ArrowRight':
            e.preventDefault();
            if (currentStepIndex < steps.length - 1) {
              setCurrentStepIndex(prev => prev + 1);
            }
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentStepIndex, steps.length]);

  const addField = (type: FieldType) => {
    const id = crypto.randomUUID();
    const base: BuilderField = {
      id,
      name: `${type}_${fields.length + 1}`,
      label: `${type.charAt(0).toUpperCase() + type.slice(1)} Field`,
      type,
      required: false,
      stepId: currentStep?.id, // Assign to current step
      ...(type === 'select' || type === 'radio' ? { options: ['Option 1', 'Option 2'] } : {}),
      ...(type === 'checkbox' ? { options: ['Checkbox option'] } : {}),
      ...(type === 'range' ? { min: 0, max: 100, step: 1 } : {}),
      ...(type === 'file' ? { accept: '*', multiple: false } : {}),
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
    } as BuilderField;
    setFields(prev => [...prev, base]);
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
      // Set activeId for field types to show drag overlay
      setActiveId(active.id as string);
      return;
    }
    setActiveId(active.id as string);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    // Handle dropping a field type from palette to canvas
    if (active.data.current?.type === 'field-type' && over?.id === 'form-canvas') {
      const fieldType = active.data.current.fieldType as FieldType;
      addField(fieldType);
      return;
    }
    
    // Handle reordering existing fields
    if (!over || active.id === over.id) return;
    const activeField = currentStepFields.find(f => f.id === active.id);
    const overField = currentStepFields.find(f => f.id === over.id);
    if (!activeField || !overField) return;
    
    const oldIndex = currentStepFields.findIndex(f => f.id === active.id);
    const newIndex = currentStepFields.findIndex(f => f.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    
    // Reorder within the current step's fields
    const reorderedStepFields = arrayMove(currentStepFields, oldIndex, newIndex);
    const otherFields = fields.filter(f => f.stepId !== currentStep?.id);
    setFields([...otherFields, ...reorderedStepFields]);
  };

  // Draft saving functionality
  const saveDraft = async () => {
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
      
      const attr = { 
        createdByName: localStorage.getItem('user_name') || undefined,
        isDraft: true,
        lastModified: new Date().toISOString()
      };
      
      const payload: any = {
        name: title,
        descr: descr || undefined,
        taskSpecific: !!taskId,
        schema: multiStepSchema,
        attr,
        isDraft: true,
        formBuilderState: {
          steps,
          fields,
          currentStepIndex,
          title,
          descr
        }
      };
      
      if (taskId) payload.taskId = taskId;
      
      // Save as draft (we'll use the same API endpoint but with isDraft flag)
      await formApi.create(payload);
      console.log('Draft saved successfully');
    } catch (e) {
      console.error('Failed to save draft', e);
    } finally {
      setSavingDraft(false);
    }
  };

  // Auto-save draft every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (title && (fields.length > 0 || steps.length > 1)) {
        saveDraft();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [title, fields, steps, descr, taskId, currentStepIndex]);

  const saveForm = async () => {
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
        currentStepIndex: 0 // Reset to first step when saving final form
      };
      
      const attr = { 
        createdByName: localStorage.getItem('user_name') || undefined,
        isDraft: false,
        isMultiStep: true,
        totalSteps: steps.length
      };
      
      const payload: any = {
        name: title,
        descr: descr || undefined,
        taskSpecific: !!taskId,
        schema: multiStepSchema,
        attr,
        isMultiStep: steps.length > 1,
        totalSteps: steps.length,
        stepConfiguration: steps,
        fieldSequence: fields.map(f => ({ id: f.id, stepId: f.stepId, order: fields.indexOf(f) }))
      };
      
      if (taskId) payload.taskId = taskId;
      const created = await formApi.create(payload);
      navigate(`/forms/${created.id}`);
    } catch (e) {
      console.error('Failed to save form', e);
      alert('Failed to save form');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col space-y-4 max-w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/forms')}
              className="h-10 w-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-50"
              title="Back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create Multi-Step Form</h1>
              <p className="mt-1 text-gray-600">
                Composable, drag-and-drop form builder • Step {currentStepIndex + 1} of {steps.length}
                {savingDraft && <span className="text-blue-600 ml-2">• Draft saving...</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={saveDraft}
              disabled={savingDraft || !title}
              className="inline-flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              <Save className="h-4 w-4 mr-2" />
              {savingDraft ? 'Saving Draft..' : 'Save Draft'}
            </button>
            <button
              onClick={saveForm}
              disabled={saving || !title || fields.length === 0}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg disabled:opacity-50 hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Publishing...' : 'Publish Form'}
            </button>
          </div>
        </div>

        {/* Step Navigation */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Layers className="h-5 w-5 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-700">Form Steps</h3>
              <span className="text-xs text-gray-500">Use Ctrl+← / Ctrl+→ to navigate</span>
            </div>
            <button
              onClick={addStep}
              className="inline-flex items-center px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm transition-colors"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Step
            </button>
          </div>
          
          <div className="flex items-center space-x-2 overflow-x-auto pb-2">
            <button
              onClick={() => navigateToStep(currentStepIndex - 1)}
              disabled={currentStepIndex === 0}
              className="p-1.5 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Previous step (Ctrl+←)"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            <div className="flex space-x-1 min-w-0 flex-1">
              {steps.map((step, index) => (
                <div key={step.id} className="relative group">
                  <button
                    onClick={() => navigateToStep(index)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors min-w-0 flex items-center space-x-2 ${
                      index === currentStepIndex
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    <span className="truncate">{step.title}</span>
                    <span className="text-xs bg-white bg-opacity-70 px-1.5 py-0.5 rounded">
                      {fields.filter(f => f.stepId === step.id).length}
                    </span>
                  </button>
                  
                  {index === currentStepIndex && (
                    <div className="absolute top-full left-0 mt-1 z-10 min-w-max group-hover:block hidden">
                      <input
                        value={step.title}
                        onChange={(e) => updateStepName(step.id, e.target.value)}
                        className="px-2 py-1 text-xs border border-gray-300 rounded bg-white shadow-sm"
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
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            <button
              onClick={() => navigateToStep(currentStepIndex + 1)}
              disabled={currentStepIndex === steps.length - 1}
              className="p-1.5 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Next step (Ctrl+→)"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
          {/* Fullscreen Layout: Field Types and Form Builder side by side */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
            {/* Left: Field Types Palette - Smaller in fullscreen */}
            <aside className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col overflow-hidden">
              <div className="text-sm font-semibold text-gray-700 mb-3">Field Types</div>
              
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search field types..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {filteredPalette.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No field types found
                  </div>
                ) : (
                  filteredPalette.map(p => (
                    <div key={p.type} onClick={() => addField(p.type)}>
                      <DraggableFieldType fieldType={p} />
                    </div>
                  ))
                )}
              </div>
            </aside>

            {/* Center & Right: Form Builder and Preview - Expanded in fullscreen */}
            <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
              {/* Form Canvas - Larger in fullscreen */}
              <section className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-700">
                      {currentStep?.title || 'Step'} - Form Fields
                    </div>
                    <div className="text-xs text-gray-500">
                      Add fields to this step by selecting from the palette
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {currentStepFields.length} field{currentStepFields.length !== 1 ? 's' : ''}
                  </div>
                </div>
                
                {currentStepIndex === 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    <div className="flex flex-col">
                      <label className="text-sm font-medium text-gray-700 mb-1">Form Title</label>
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-sm font-medium text-gray-700 mb-1">Description</label>
                      <input
                        value={descr}
                        onChange={(e) => setDescr(e.target.value)}
                        placeholder="Optional"
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto">
                  <SortableContext items={currentStepFields.map(f => f.id)} strategy={rectSortingStrategy}>
                    <DroppableFormCanvas>
                      {currentStepFields.length === 0 ? (
                        <div className="h-40 border border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500">
                          <Layers className="h-8 w-8 mb-2 text-gray-400" />
                          <p className="text-sm">No fields in this step yet</p>
                          <p className="text-xs text-gray-400">Drag field types from the palette or click to add them to {currentStep?.title}</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {currentStepFields.map((f) => (
                            <SortableFieldCard
                              key={f.id}
                              field={f}
                              selected={activeId === f.id}
                              onSelect={() => setActiveId(f.id)}
                              onChange={(patch) => setFields(prev => prev.map(p => p.id === f.id ? { ...p, ...patch } : p))}
                              onRemove={() => removeField(f.id)}
                            />
                          ))}
                        </div>
                      )}
                    </DroppableFormCanvas>
                  </SortableContext>
                </div>
              </section>

              {/* Live Preview */}
              <aside className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-gray-700">Live Preview</div>
                  <div className="text-xs text-gray-500">
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
          
          <DragOverlay dropAnimation={null}>
            {activeId ? (
              <div className="px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-lg text-sm text-gray-700">
                {activeId.includes('field-type-') ? 'Creating field...' : 'Reordering...'}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </Layout>
  );
}

export default FormBuilderPage;