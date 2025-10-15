import React, { useState } from 'react';
import { getFieldIcon, SignatureCanvas, AddressInput, GeoLocationInput, ModernDateTimePicker, StepProgressIndicator, DataTableInput } from './FormBuilder';
import { BuilderField, FormStep } from './FormBuilder';
import { BookOpen, Upload, Layers, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { ModularEditor } from '../../shared/editor/ModularEditor';

interface InteractiveFormProps {
  formId: string;
  submissionId?: string;
  fields: BuilderField[];
  steps?: FormStep[];
  initialData?: Record<string, any>;
  isEditMode?: boolean;
  onSubmitSuccess?: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export function InteractiveForm({
  formId,
  submissionId,
  fields,
  steps = [],
  initialData = {},
  isEditMode = false,
  onSubmitSuccess
}: InteractiveFormProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');

  // Update formData when initialData changes (for edit mode)
  React.useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      console.log('📥 InteractiveForm: Loading initial data', initialData);
      setFormData(initialData);
    }
  }, [initialData]);

  // If we have steps, filter fields by the current step
  const currentStep = steps[currentStepIndex];
  const displayFields = steps.length > 0
    ? fields.filter(f => f.stepId === currentStep?.id || (!f.stepId && currentStepIndex === 0))
    : fields;

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    // Clear error for this field
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  const validateCurrentStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    displayFields.forEach(field => {
      if (field.required && !formData[field.name]) {
        newErrors[field.name] = `${field.label || field.name} is required`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateCurrentStep() && currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate current step (or all fields if no steps)
    if (!validateCurrentStep()) {
      return;
    }

    // If there are more steps, go to next step instead of submitting
    if (steps.length > 0 && currentStepIndex < steps.length - 1) {
      handleNext();
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const token = localStorage.getItem('auth_token');

      // Use PUT for edit mode, POST for new submissions
      const url = isEditMode && submissionId
        ? `${API_BASE_URL}/api/v1/form/${formId}/data/${submissionId}`
        : `${API_BASE_URL}/api/v1/form/${formId}/submit`;

      const method = isEditMode && submissionId ? 'PUT' : 'POST';

      console.log(`📤 Submitting form (${method}):`, { url, formData });

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          submissionData: formData,
          submissionStatus: 'submitted'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to ${isEditMode ? 'update' : 'submit'} form: ${response.statusText}`);
      }

      const result = await response.json();
      setSubmitStatus('success');
      setSubmitMessage(isEditMode ? 'Form updated successfully!' : 'Form submitted successfully!');

      // Reset or callback after 2 seconds
      setTimeout(() => {
        if (!isEditMode) {
          setFormData({});
          setCurrentStepIndex(0);
        }
        setSubmitStatus('idle');
        if (onSubmitSuccess) {
          onSubmitSuccess();
        }
      }, 2000);
    } catch (err) {
      console.error('Error submitting form:', err);
      setSubmitStatus('error');
      setSubmitMessage(err instanceof Error ? err.message : `Failed to ${isEditMode ? 'update' : 'submit'} form`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: BuilderField) => {
    const value = formData[field.name];
    const hasError = !!errors[field.name];

    console.log(`🎨 Rendering field "${field.name}":`, {
      value,
      hasValue: value !== undefined && value !== null && value !== '',
      allFormData: formData,
      fieldType: field.type
    });

    const baseInputClass = `w-full px-3 py-2 border rounded-lg text-sm transition-colors ${
      hasError
        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
    } focus:ring-2 focus:outline-none`;

    switch (field.type) {
      case 'text':
      case 'email':
      case 'number':
      case 'url':
      case 'phone':
        return (
          <>
            <input
              type={field.type === 'phone' ? 'tel' : field.type}
              value={value || ''}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              className={baseInputClass}
              required={field.required}
            />
            {hasError && <p className="text-red-600 text-xs mt-1">{errors[field.name]}</p>}
          </>
        );

      case 'textarea':
        return (
          <>
            <textarea
              value={value || ''}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              rows={4}
              className={baseInputClass}
              required={field.required}
            />
            {hasError && <p className="text-red-600 text-xs mt-1">{errors[field.name]}</p>}
          </>
        );

      case 'select':
        return (
          <>
            <select
              value={value || ''}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              className={baseInputClass}
              required={field.required}
            >
              <option value="">{field.placeholder || 'Choose an option'}</option>
              {field.options?.map((opt, i) => (
                <option key={i} value={opt}>{opt}</option>
              ))}
            </select>
            {hasError && <p className="text-red-600 text-xs mt-1">{errors[field.name]}</p>}
          </>
        );

      case 'radio':
        return (
          <>
            <div className="space-y-2">
              {field.options?.map((opt, i) => (
                <label key={i} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name={field.name}
                    value={opt}
                    checked={value === opt}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    className="text-blue-600 focus:ring-blue-500"
                    required={field.required && i === 0}
                  />
                  <span className="text-sm text-gray-700">{opt}</span>
                </label>
              ))}
            </div>
            {hasError && <p className="text-red-600 text-xs mt-1">{errors[field.name]}</p>}
          </>
        );

      case 'checkbox':
        return (
          <>
            <div className="space-y-2">
              {field.options?.map((opt, i) => (
                <label key={i} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    value={opt}
                    checked={Array.isArray(value) && value.includes(opt)}
                    onChange={(e) => {
                      const currentValues = Array.isArray(value) ? value : [];
                      const newValues = e.target.checked
                        ? [...currentValues, opt]
                        : currentValues.filter(v => v !== opt);
                      handleFieldChange(field.name, newValues);
                    }}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{opt}</span>
                </label>
              ))}
            </div>
            {hasError && <p className="text-red-600 text-xs mt-1">{errors[field.name]}</p>}
          </>
        );

      case 'datetime':
        return (
          <>
            <input
              type="datetime-local"
              value={value || ''}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              className={baseInputClass}
              required={field.required}
            />
            {hasError && <p className="text-red-600 text-xs mt-1">{errors[field.name]}</p>}
          </>
        );

      case 'file':
        return (
          <>
            <input
              type="file"
              onChange={(e) => {
                const files = e.target.files;
                handleFieldChange(field.name, field.multiple ? files : files?.[0]);
              }}
              multiple={field.multiple}
              accept={field.accept}
              className="w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              required={field.required}
            />
            {hasError && <p className="text-red-600 text-xs mt-1">{errors[field.name]}</p>}
          </>
        );

      case 'range':
        return (
          <>
            <div className="space-y-2">
              <input
                type="range"
                min={field.min || 0}
                max={field.max || 100}
                step={field.step || 1}
                value={value || field.min || 0}
                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                className="w-full"
                required={field.required}
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{field.min || 0}</span>
                <span className="font-semibold text-blue-600">{value || field.min || 0}</span>
                <span>{field.max || 100}</span>
              </div>
            </div>
            {hasError && <p className="text-red-600 text-xs mt-1">{errors[field.name]}</p>}
          </>
        );

      case 'datatable':
        return (
          <>
            <DataTableInput
              dataTableName={field.dataTableName || 'table'}
              columns={field.dataTableColumns || [{ name: 'col1', label: 'Column 1' }, { name: 'col2', label: 'Column 2' }, { name: 'col3', label: 'Column 3' }]}
              rows={field.dataTableDefaultRows || 1}
              disabled={false}
              onChange={(data) => handleFieldChange(field.name, data)}
            />
            {hasError && <p className="text-red-600 text-xs mt-1">{errors[field.name]}</p>}
          </>
        );

      case 'wiki':
        return (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-blue-50 border-b border-gray-200 px-4 py-2 flex items-center space-x-2">
              <BookOpen className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-800">{field.wikiTitle || 'Documentation'}</span>
              <span className="text-xs text-gray-500 ml-auto">Read-only</span>
            </div>
            <ModularEditor
              value={field.wikiContent || ''}
              onChange={() => {}}
              height={Math.min(300, field.wikiHeight || 400)}
              disabled={true}
            />
          </div>
        );

      default:
        return (
          <>
            <input
              type="text"
              value={value || ''}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              className={baseInputClass}
              required={field.required}
            />
            {hasError && <p className="text-red-600 text-xs mt-1">{errors[field.name]}</p>}
          </>
        );
    }
  };

  return (
    <div className="space-y-4">

      {steps.length > 1 && (
        <StepProgressIndicator
          steps={steps}
          currentStepIndex={currentStepIndex}
          onStepClick={(index) => {
            // Only allow clicking on completed steps or the next step
            if (index <= currentStepIndex + 1) {
              setCurrentStepIndex(index);
            }
          }}
        />
      )}

      {submitStatus === 'success' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <p className="text-green-800 font-medium">{submitMessage}</p>
        </div>
      )}

      {submitStatus === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-red-800 font-medium">{submitMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-lg border border-gray-200 p-6">
        {displayFields.length === 0 && (
          <div className="text-gray-500 text-center py-8">
            <Layers className="h-6 w-6 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">No fields in this step.</p>
          </div>
        )}

        {displayFields.map((field) => {
          const label = field.label || field.name;
          return (
            <div key={field.id} className="flex flex-col space-y-1">
              <div className="flex items-center space-x-2">
                <div className="flex-shrink-0 text-blue-600">
                  {getFieldIcon(field.type)}
                </div>
                <label className="text-sm font-normal text-gray-700">
                  {label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
              </div>

              {renderField(field)}
            </div>
          );
        })}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200">
          <div>
            {steps.length > 1 && currentStepIndex > 0 && (
              <button
                type="button"
                onClick={handlePrevious}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-normal text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                Previous
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {steps.length > 1 && (
              <span className="text-sm text-gray-500">
                Step {currentStepIndex + 1} of {steps.length}
              </span>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center px-6 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  {isEditMode ? 'Saving...' : 'Submitting...'}
                </>
              ) : steps.length > 0 && currentStepIndex < steps.length - 1 ? (
                'Next'
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  {isEditMode ? 'Save Changes' : 'Submit'}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
