import React, { useEffect, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { useNavigate, useParams } from 'react-router-dom';
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

export function FormEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [descr, setDescr] = useState('');
  const [taskId, setTaskId] = useState('');
  const [fields, setFields] = useState<BuilderField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Multi-step form state
  const [steps, setSteps] = useState<FormStep[]>([
    { id: crypto.randomUUID(), name: 'step_1', title: 'Step 1', description: 'First step of the form' }
  ]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [savingDraft, setSavingDraft] = useState(false);
  const [originalData, setOriginalData] = useState<any>(null);

  const palette = [
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
  ] as const;

  const filteredPalette = searchTerm 
    ? palette.filter(p => 
        p.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.hint.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : palette;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  // Computed values for current step
  const currentStep = steps[currentStepIndex];
  const currentStepFields = fields.filter(f => f.stepId === currentStep?.id || (!f.stepId && currentStepIndex === 0));

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const form = await formApi.get(id);
        setOriginalData(form);
        setTitle(form?.name || '');
        setDescr(form?.descr || '');
        if (form?.taskId) setTaskId(form.taskId);
        
        const schema = form?.schema || {};
        
        // Handle multi-step forms
        if (schema.steps && Array.isArray(schema.steps)) {
          const formSteps = schema.steps.map((step: any, index: number) => ({
            id: step.id || crypto.randomUUID(),
            name: step.name || `step_${index + 1}`,
            title: step.title || `Step ${index + 1}`,
            description: step.description || `Step ${index + 1} of the form`
          }));
          setSteps(formSteps);
          setCurrentStepIndex(schema.currentStepIndex || 0);
          
          // Rebuild fields with step associations
          const allFields: BuilderField[] = [];
          formSteps.forEach((step: FormStep) => {
            const stepFromSchema = schema.steps.find((s: any) => s.id === step.id);
            if (stepFromSchema && stepFromSchema.fields) {
              stepFromSchema.fields.forEach((f: any, fieldIndex: number) => {
                allFields.push({
                  ...f,
                  id: crypto.randomUUID(),
                  stepId: step.id
                });
              });
            }
          });
          setFields(allFields);
        } else {
          // Handle legacy single-step forms
          const schemaFields: any[] = Array.isArray(schema.fields) ? schema.fields : [];
          const builtinId = () => crypto.randomUUID();
          const formFields = schemaFields.map((f, idx) => ({ 
            id: builtinId(), 
            stepId: steps[0].id, // Assign to first step
            ...f 
          }));
          setFields(formFields);
        }
        
        // Restore form builder state if available
        if (form.formBuilderState) {
          const builderState = form.formBuilderState;
          if (builderState.steps) setSteps(builderState.steps);
          if (builderState.fields) {
            const stateFields = builderState.fields.map((f: any) => ({
              ...f,
              id: f.id || crypto.randomUUID()
            }));
            setFields(stateFields);
          }
          if (typeof builderState.currentStepIndex === 'number') {
            setCurrentStepIndex(builderState.currentStepIndex);
          }
        }
      } catch (e) {
        console.error('Failed to load form for edit', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

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
    if (steps.length <= 1) return;
    setSteps(prev => prev.filter(s => s.id !== stepId));
    setFields(prev => prev.filter(f => f.stepId !== stepId));
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

  const addField = (type: FieldType) => {
    const newField: BuilderField = {
      id: crypto.randomUUID(),
      name: `${type}_${fields.length + 1}`,
      label: `${type.charAt(0).toUpperCase() + type.slice(1)} Field`,
      type,
      required: false,
      stepId: currentStep?.id,
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
    };
    setFields(prev => [...prev, newField]);
    setActiveId(newField.id);
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
    if (!id) return;
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
      
      const payload: any = {
        name: title,
        descr: descr || undefined,
        schema: multiStepSchema,
        is_draft: true,
        draft_saved_at: new Date().toISOString(),
        form_builder_state: {
          steps,
          fields,
          currentStepIndex,
          title,
          descr
        },
        is_multi_step: steps.length > 1,
        total_steps: steps.length,
        step_configuration: steps,
        field_sequence: fields.map(f => ({ id: f.id, stepId: f.stepId, order: fields.indexOf(f) }))
      };
      
      if (taskId) {
        payload.task_specific = true;
        payload.task_id = taskId;
      }
      
      await formApi.update(id, payload);
      console.log('Draft saved successfully');
    } catch (e) {
      console.error('Failed to save draft', e);
    } finally {
      setSavingDraft(false);
    }
  };

  const save = async () => {
    if (!id) return;
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
      
      const payload: any = {
        name: title,
        descr: descr || undefined,
        schema: multiStepSchema,
        is_draft: false,
        last_modified_by: localStorage.getItem('user_id'),
        form_version_hash: JSON.stringify(multiStepSchema).substring(0, 32),
        is_multi_step: steps.length > 1,
        total_steps: steps.length,
        step_configuration: steps,
        field_sequence: fields.map(f => ({ id: f.id, stepId: f.stepId, order: fields.indexOf(f) })),
        validation_rules: {
          requiredFields: fields.filter(f => f.required).map(f => f.name),
          fieldTypes: Object.fromEntries(fields.map(f => [f.name, f.type]))
        }
      };
      
      if (taskId) {
        payload.task_specific = true;
        payload.task_id = taskId;
      }
      
      await formApi.update(id, payload);
      navigate(`/form/${id}`);
    } catch (e) {
      console.error('Failed to update form', e);
      alert('Failed to update form');
    } finally {
      setSaving(false);
    }
  };

  // Auto-save draft every 30 seconds
  useEffect(() => {
    if (loading) return;
    
    const interval = setInterval(() => {
      if (title && fields.length > 0) {
        saveDraft();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [title, fields, steps, descr, taskId, currentStepIndex, loading, id]);

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-4 max-w-full mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/form')}
              className="h-10 w-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-50"
              title="Back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Edit Multi-Step Form</h1>
              <p className="mt-1 text-gray-600">
                Update fields, order, and settings • Step {currentStepIndex + 1} of {steps.length}
                {savingDraft && <span className="text-blue-600 ml-2">• Draft saving...</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={saveDraft}
              disabled={savingDraft || loading || !title}
              className="inline-flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              <Save className="h-4 w-4 mr-2" />
              {savingDraft ? 'Saving Draft..' : 'Save Draft'}
            </button>
            <button
              onClick={save}
              disabled={saving || loading || !title || fields.length === 0}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg disabled:opacity-50 hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-gray-600">Loading form...</div>
        ) : (
          <>
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
                  title="Previous step"
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
                  title="Next step"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1 min-h-0">
                {/* Palette */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:col-span-1 flex flex-col overflow-hidden">
                  <div className="text-sm font-semibold text-gray-700 mb-3">Add Field</div>
                  
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

                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="text-sm font-semibold text-gray-700 mb-2">Task Attachment</div>
                    <input
                      placeholder="Task ID (optional)"
                      value={taskId}
                      onChange={(e) => setTaskId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">If provided, this form is task-specific.</p>
                  </div>
                </div>

                {/* Canvas + Config */}
                <div className="md:col-span-3 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
                  {/* Form Canvas */}
                  <section className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-700">
                          {currentStep?.title || 'Step'} - Form Fields
                        </div>
                        <div className="text-xs text-gray-500">
                          Edit existing fields or add new ones from the palette
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
                              <p className="text-xs text-gray-400">Add fields from the left panel</p>
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
          </>
        )}
      </div>
    </Layout>
  );
}

export default FormEditPage;