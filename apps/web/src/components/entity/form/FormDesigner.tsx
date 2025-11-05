import React, { useState, useCallback, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay, useDroppable } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Save, FileText, Plus, LogOut, Layers, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { produce } from 'immer';
import { UniversalDesigner, DesignerAction } from '../../shared/designer';
import { FormFieldTypesToolbar } from './designer/FormFieldTypesToolbar';
import { FormPropertiesPanel } from './designer/FormPropertiesPanel';
import { FormPreview } from './FormPreview';
import { BuilderField, FormStep, FieldType } from './FormBuilder';
import { SortableFieldCard } from './FormBuilder';

// Droppable form canvas component
function DroppableFormCanvas({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'form-canvas',
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[400px] transition-colors ${isOver ? 'bg-dark-100 border-2 border-dark-500 border-dashed rounded-lg' : ''}`}
    >
      {children}
    </div>
  );
}

export interface FormDesignerProps {
  formData?: {
    id?: string;
    name: string;
    descr?: string;
    form_schema?: {
      steps: any[];
      fields?: any[];
    };
  };
  onSave: (formData: any) => Promise<void>;
  onSaveDraft?: (formData: any) => Promise<void>;
  onExit?: () => void;
  actions?: DesignerAction[];
}

export function FormDesigner({ formData, onSave, onSaveDraft, onExit, actions = [] }: FormDesignerProps) {
  // Form state
  const [title, setTitle] = useState(formData?.name || '');
  const [description, setDescription] = useState(formData?.descr || '');
  const [steps, setSteps] = useState<FormStep[]>(() => {
    if (formData?.form_schema?.steps && formData.form_schema.steps.length > 0) {
      return formData.form_schema.steps.map((step, idx) => ({
        id: step.id || `step-${idx + 1}`,
        name: step.name || `step_${idx + 1}`,
        title: step.title || `Step ${idx + 1}`,
        description: step.description || '',
      }));
    }
    return [{ id: 'step-1', name: 'step_1', title: 'General Information', description: '' }];
  });

  const [fields, setFields] = useState<BuilderField[]>(() => {
    if (formData?.form_schema?.steps) {
      const restoredFields: BuilderField[] = [];
      formData.form_schema.steps.forEach((step: any, stepIdx: number) => {
        if (step.fields && Array.isArray(step.fields)) {
          step.fields.forEach((field: any, fieldIdx: number) => {
            restoredFields.push({
              ...field,
              id: field.id || `field-${step.id || stepIdx}-${fieldIdx}`,
              stepId: step.id || `step-${stepIdx + 1}`,
            });
          });
        }
      });
      return restoredFields;
    }
    return [];
  });

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'design' | 'preview'>('design');
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [updatedDate, setUpdatedDate] = useState<string>(new Date().toISOString());
  const [activeId, setActiveId] = useState<string | null>(null);

  const currentStep = steps[currentStepIndex];
  const currentStepFields = fields.filter((f) => f.stepId === currentStep?.id);
  const selectedField = fields.find((f) => f.id === selectedFieldId);

  // Drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const onDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
  };

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      // Check if dragging a field type from toolbar to canvas
      if (active.data.current?.type === 'field-type' && over?.id === 'form-canvas') {
        const fieldType = active.data.current.fieldType as FieldType;
        handleAddField(fieldType);
        return;
      }

      // Reorder fields within the canvas
      if (over && active.id !== over.id) {
        const activeField = currentStepFields.find(f => f.id === active.id);
        const overField = currentStepFields.find(f => f.id === over.id);

        if (activeField && overField) {
          setFields(
            produce((draft) => {
              const allOtherFields = draft.filter(f => f.stepId !== currentStep?.id);
              const currentFields = draft.filter(f => f.stepId === currentStep?.id);
              const oldIndex = currentFields.findIndex((f) => f.id === active.id);
              const newIndex = currentFields.findIndex((f) => f.id === over.id);
              const reordered = arrayMove(currentFields, oldIndex, newIndex);
              return [...allOtherFields, ...reordered];
            })
          );
          setUpdatedDate(new Date().toISOString());
        }
      }
    },
    [currentStep, currentStepFields]
  );

  // Field operations
  const handleAddField = useCallback(
    (type: FieldType) => {
      const newField: BuilderField = {
        id: `field-${Date.now()}`,
        name: `${type}_${Date.now()}`,
        label: type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        type,
        stepId: currentStep?.id,
        required: false,
        ...(type === 'select' || type === 'select_multiple' || type === 'radio' || type === 'checkbox'
          ? { options: ['Option 1', 'Option 2', 'Option 3'] }
          : {}),
        ...(type === 'range' ? { min: 0, max: 100, step: 1 } : {}),
      };

      setFields(
        produce((draft) => {
          draft.push(newField);
        })
      );
      setSelectedFieldId(newField.id);
      setUpdatedDate(new Date().toISOString());
    },
    [currentStep]
  );

  const handleUpdateField = useCallback((fieldId: string, updates: Partial<BuilderField>) => {
    setFields(
      produce((draft) => {
        const field = draft.find((f) => f.id === fieldId);
        if (field) {
          Object.assign(field, updates);
        }
      })
    );
    setUpdatedDate(new Date().toISOString());
  }, []);

  const handleDeleteField = useCallback(
    (fieldId: string) => {
      setFields(produce((draft) => draft.filter((f) => f.id !== fieldId)));
      if (selectedFieldId === fieldId) {
        setSelectedFieldId(null);
      }
      setUpdatedDate(new Date().toISOString());
    },
    [selectedFieldId]
  );

  const handleDuplicateField = useCallback((fieldId: string) => {
    setFields(
      produce((draft) => {
        const field = draft.find((f) => f.id === fieldId);
        if (field) {
          const newField = { ...field, id: `field-${Date.now()}` };
          const index = draft.findIndex((f) => f.id === fieldId);
          draft.splice(index + 1, 0, newField);
        }
      })
    );
    setUpdatedDate(new Date().toISOString());
  }, []);

  // Step management
  const addStep = () => {
    const newStepNumber = steps.length + 1;
    const newStep: FormStep = {
      id: `step-${Date.now()}`,
      name: `step_${newStepNumber}`,
      title: `Step ${newStepNumber}`,
      description: '',
    };
    setSteps((prev) => [...prev, newStep]);
    setCurrentStepIndex(steps.length);
    setUpdatedDate(new Date().toISOString());
  };

  const removeStep = (stepId: string) => {
    if (steps.length === 1) return;
    const stepIndex = steps.findIndex((s) => s.id === stepId);
    const newSteps = steps.filter((s) => s.id !== stepId);
    setSteps(newSteps);
    setFields((prev) => prev.filter((f) => f.stepId !== stepId));
    if (currentStepIndex >= stepIndex && currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
    setUpdatedDate(new Date().toISOString());
  };

  const updateStep = (updates: Partial<FormStep>) => {
    setSteps((prev) => prev.map((s) => (s.id === currentStep?.id ? { ...s, ...updates } : s)));
    setUpdatedDate(new Date().toISOString());
  };

  // Save Draft
  const handleSaveDraft = async () => {
    if (!onSaveDraft) return;

    setIsSavingDraft(true);
    try {
      const multiStepSchema = {
        steps: steps.map((step) => ({
          id: step.id,
          name: step.name,
          title: step.title,
          description: step.description,
          fields: fields.filter((f) => f.stepId === step.id).map(({ id, stepId, ...f }) => f),
        })),
        currentStepIndex: 0,
      };

      const payload = {
        name: title || 'Untitled Form (Draft)',
        descr: description || undefined,
        form_type: 'multi_step',
        form_schema: multiStepSchema,
        isMultiStep: steps.length > 1,
        totalSteps: steps.length,
        isDraft: true,
      };

      await onSaveDraft(payload);
    } catch (error) {
      console.error('Failed to save draft:', error);
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Publish
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const multiStepSchema = {
        steps: steps.map((step) => ({
          id: step.id,
          name: step.name,
          title: step.title,
          description: step.description,
          fields: fields.filter((f) => f.stepId === step.id).map(({ id, stepId, ...f }) => f),
        })),
        currentStepIndex: 0,
      };

      const payload = {
        name: title,
        descr: description || undefined,
        form_type: 'multi_step',
        form_schema: multiStepSchema,
        isMultiStep: steps.length > 1,
        totalSteps: steps.length,
        isDraft: false,
      };

      await onSave(payload);
    } catch (error) {
      console.error('Failed to save form:', error);
      alert('Failed to save form. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Render canvas
  const renderCanvas = () => {
    if (viewMode === 'preview') {
      return (
        <div className="max-w-4xl mx-auto">
          <div className="bg-dark-100 rounded-xl shadow-lg p-12">
            <h1 className="text-3xl font-bold text-dark-600 mb-3">{title || 'Untitled Form'}</h1>
            {description && <p className="text-base text-dark-700 mb-8">{description}</p>}

            {/* Step Progress Indicator */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Layers className="h-5 w-5 text-dark-700" />
                  <span className="text-sm font-medium text-dark-600">
                    {steps.length > 1 ? `Step ${currentStepIndex + 1} of ${steps.length}` : 'Single Step Form'}
                  </span>
                </div>
              </div>

              {steps.length > 1 && (
                <>
                  {/* Step Pills */}
                  <div className="flex items-center space-x-2 mb-4">
                    {steps.map((step, index) => (
                      <button
                        key={step.id}
                        onClick={() => setCurrentStepIndex(index)}
                        className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                          index === currentStepIndex
                            ? 'bg-dark-700 text-white shadow-md'
                            : index < currentStepIndex
                            ? 'bg-green-100 text-green-700 border border-green-200'
                            : 'bg-dark-100 text-dark-700 border border-dark-300'
                        }`}
                      >
                        <div className="flex items-center justify-center space-x-2">
                          <span className="text-xs font-bold">
                            {index + 1}
                          </span>
                          <span className="text-sm">{step.title}</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Progress Bar */}
                  <div className="relative h-2 bg-dark-200 rounded-full overflow-hidden mb-4">
                    <div
                      className="absolute top-0 left-0 h-full bg-dark-700 transition-all duration-300"
                      style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
                    />
                  </div>
                </>
              )}
            </div>

            <FormPreview
              fields={currentStepFields}
              steps={steps}
              currentStepIndex={currentStepIndex}
              showStepProgress={false}
            />

            {steps.length > 1 && (
              <div className="mt-8 flex justify-between">
                <button
                  disabled={currentStepIndex === 0}
                  onClick={() => setCurrentStepIndex((i) => i - 1)}
                  className="px-4 py-2 bg-dark-200 text-dark-600 text-sm font-medium rounded-lg hover:bg-dark-300 disabled:opacity-50 transition-colors"
                >
                  Previous
                </button>
                <button
                  disabled={currentStepIndex === steps.length - 1}
                  onClick={() => setCurrentStepIndex((i) => i + 1)}
                  className="px-4 py-2 bg-dark-700 text-white text-sm font-medium rounded-lg hover:bg-dark-800 disabled:opacity-50 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Design mode
    return (
      <div className="max-w-5xl mx-auto bg-dark-100 rounded-lg shadow-lg overflow-hidden">
        {/* Header Section */}
        <div className="px-16 pt-12 pb-6 border-b border-dark-300">
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setUpdatedDate(new Date().toISOString());
            }}
            placeholder="Untitled Form"
            className="w-full text-3xl font-bold text-dark-600 bg-transparent border-none outline-none placeholder-gray-300 focus:outline-none"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setUpdatedDate(new Date().toISOString());
            }}
            placeholder="Optional description"
            className="w-full mt-3 text-base text-dark-700 bg-transparent border-none outline-none placeholder-gray-300 focus:outline-none"
          />
          <div className="flex items-center gap-4 mt-4 text-sm text-dark-700">
            <span>Step {currentStepIndex + 1} of {steps.length}</span>
            <span>•</span>
            <span>Updated {new Date(updatedDate).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Multi-Step Navigation */}
        <div className="px-16 py-4 bg-dark-100 border-b border-dark-300">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Layers className="h-4 w-4 text-dark-700" />
              <h3 className="text-sm font-medium text-dark-600">Form Steps</h3>
              {steps.length > 1 && (
                <span className="text-xs text-dark-700">
                  Step {currentStepIndex + 1} of {steps.length}
                </span>
              )}
            </div>
            <button
              onClick={addStep}
              className="px-3 py-1.5 bg-dark-700 text-white rounded-lg text-xs font-medium hover:bg-dark-800 flex items-center space-x-1 transition-colors"
            >
              <Plus className="h-3 w-3" />
              <span>Add Step</span>
            </button>
          </div>

          <div className="flex items-center space-x-2 overflow-x-auto pb-2">
            {steps.map((step, index) => {
              const fieldCount = fields.filter((f) => f.stepId === step.id).length;
              return (
                <div key={step.id} className="relative group">
                  <button
                    onClick={() => setCurrentStepIndex(index)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                      index === currentStepIndex
                        ? 'bg-dark-100 text-dark-700 border-2 border-dark-500 shadow-sm'
                        : 'bg-dark-100 text-dark-700 hover:bg-dark-100 border-2 border-dark-300'
                    }`}
                  >
                    <span className="text-sm">{step.title}</span>
                    <span className="ml-2 text-xs bg-dark-100 px-1.5 py-0.5 rounded font-normal">
                      {fieldCount}
                    </span>
                  </button>

                  {steps.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeStep(step.id);
                      }}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs hover:bg-red-600 transition-all shadow-sm"
                      title="Remove step"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Navigation Buttons for Multiple Steps */}
          {steps.length > 1 && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-dark-300">
              <button
                onClick={() => setCurrentStepIndex((i) => Math.max(0, i - 1))}
                disabled={currentStepIndex === 0}
                className="px-3 py-1.5 text-sm font-medium text-dark-600 bg-dark-100 rounded-lg hover:bg-dark-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center space-x-1"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Previous</span>
              </button>
              <span className="text-xs text-dark-700">
                {currentStep.title}
              </span>
              <button
                onClick={() => setCurrentStepIndex((i) => Math.min(steps.length - 1, i + 1))}
                disabled={currentStepIndex === steps.length - 1}
                className="px-3 py-1.5 text-sm font-medium text-dark-600 bg-dark-100 rounded-lg hover:bg-dark-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center space-x-1"
              >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Form Fields Section */}
        <div className="px-16 py-8">
          <DroppableFormCanvas>
            <SortableContext items={currentStepFields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              {currentStepFields.length === 0 ? (
                <div className="text-center py-20 text-dark-600">
                  <FileText className="h-14 w-14 mx-auto mb-4 opacity-50" />
                  <p className="text-base font-medium">Start building your form</p>
                  <p className="text-sm mt-2">Drag field types from the left or click to add</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {currentStepFields.map((field) => (
                    <SortableFieldCard
                      key={field.id}
                      field={field}
                      selected={selectedFieldId === field.id}
                      onSelect={() => setSelectedFieldId(field.id)}
                      onChange={(patch) => handleUpdateField(field.id, patch)}
                      onRemove={() => handleDeleteField(field.id)}
                      allFields={currentStepFields}
                    />
                  ))}
                </div>
              )}
            </SortableContext>
          </DroppableFormCanvas>
        </div>
      </div>
    );
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={handleDragEnd}>
      <UniversalDesigner
        // Header
        title={title || 'Untitled Form'}
        subtitle={`Last updated ${new Date(updatedDate).toLocaleDateString()}`}
        icon={<FileText className="h-6 w-6" />}
        titleEditable
        onTitleChange={setTitle}

        // View Modes
        currentViewMode={viewMode}
        onViewModeChange={(mode) => setViewMode(mode as 'design' | 'preview')}
        viewModes={[
          { id: 'design', label: 'Design' },
          { id: 'preview', label: 'Preview' },
        ]}

        // Layout Panels
        toolbar={viewMode === 'design' ? <FormFieldTypesToolbar onAddField={handleAddField} /> : undefined}
        toolbarTitle="Field Types"
        toolbarDefaultCollapsed={false}

        canvas={renderCanvas()}
        canvasBackground="bg-dark-100"
        canvasMaxWidth="max-w-full"

        properties={
          viewMode === 'design' ? (
            <FormPropertiesPanel
              title={title}
              description={description}
              currentStep={currentStep}
              steps={steps}
              selectedField={selectedField}
              onUpdateTitle={setTitle}
              onUpdateDescription={setDescription}
              onUpdateStep={updateStep}
              onUpdateField={(updates) => selectedField && handleUpdateField(selectedField.id, updates)}
            />
          ) : undefined
        }
        propertiesTitle={selectedField ? 'Field Properties' : 'Form Properties'}
        propertiesDefaultCollapsed={false}

        // Actions
        actions={[
          ...(onSaveDraft ? [{
            id: 'save-draft',
            label: isSavingDraft ? 'Saving...' : 'Save Draft',
            icon: <Save className="h-4 w-4" />,
            onClick: handleSaveDraft,
            disabled: isSavingDraft || !title.trim(),
            loading: isSavingDraft,
            variant: 'secondary' as const,
          }] : []),
          ...actions,
        ]}
        primaryAction={{
          id: 'publish',
          label: isSaving ? 'Publishing...' : 'Publish Form',
          icon: <Save className="h-4 w-4" />,
          onClick: handleSave,
          disabled: isSaving || !title.trim() || fields.length === 0,
          loading: isSaving,
        }}
        trailingActions={
          onExit
            ? [
                {
                  id: 'exit',
                  label: 'Exit',
                  icon: <LogOut className="h-4 w-4" />,
                  onClick: onExit,
                  variant: 'secondary' as const,
                },
              ]
            : []
        }
      />

      {/* Drag Overlay */}
      <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
        {activeId && activeId.startsWith('field-type-') ? (
          <div className="px-4 py-3 rounded-lg bg-dark-100 border-2 border-dark-600 shadow-2xl">
            <div className="flex items-center space-x-2 text-sm font-medium text-dark-700">
              <Plus className="h-4 w-4" />
              <span>Adding field...</span>
            </div>
          </div>
        ) : activeId ? (
          <div className="px-4 py-3 rounded-lg bg-dark-100 border-2 border-dark-600 shadow-2xl">
            <div className="text-sm font-medium text-dark-600">Moving field...</div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
