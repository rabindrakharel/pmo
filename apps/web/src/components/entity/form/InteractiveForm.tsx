import React, { useState, useEffect } from 'react';
import { getFieldIcon, SignatureCanvas, AddressInput, GeoLocationInput, ModernDateTimePicker, StepProgressIndicator, DataTableInput, SearchableSelect, SearchableMultiSelect, CurrencyInput, DateOnlyInput, TimeOnlyInput, ToggleInput, RatingInput, DurationInput, PercentageInput, CalculationField } from './FormBuilder';
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
  onSubmitSuccess?: (formData?: Record<string, any>) => void;
  skipApiSubmission?: boolean; // When true, only calls onSubmitSuccess without API call
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export function InteractiveForm({
  formId,
  submissionId,
  fields,
  steps = [],
  initialData = {},
  isEditMode = false,
  onSubmitSuccess,
  skipApiSubmission = false
}: InteractiveFormProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, Array<{ value: string; label: string }>>>({});

  // Update formData when initialData changes (for edit mode)
  // DATATABLE UNFLATTENING LOGIC:
  // When loading saved form submissions, datatable data may arrive in two formats:
  //
  // FORMAT 1 (NESTED): { "datatable_1760567271140": { "table__col1_1": "value", "table__col2_1": "value2" } }
  //   - This happens when data is saved with field name as wrapper
  //   - We need to "unflatten" by merging nested object into root level
  //
  // FORMAT 2 (FLAT): { "table__col1_1": "value", "table__col2_1": "value2", "email_123": "test@test.com" }
  //   - This is the correct format that DataTableInput expects
  //   - No transformation needed
  //
  // WHY UNFLATTEN?
  // DataTableInput component looks for keys matching pattern: {dataTableName}__{columnName}_{rowNumber}
  // If these keys are nested under "datatable_XXX" wrapper, the component won't find them.
  //
  // SOLUTION:
  // Detect field names starting with "datatable_" that contain nested objects,
  // merge their contents into root level, and remove the wrapper key.
  React.useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      console.log('📥 InteractiveForm: Loading initial data', initialData);

      // Start with a copy of initialData
      const flattenedData = { ...initialData };

      // Look for nested datatable wrappers
      Object.keys(initialData).forEach(key => {
        if (key.startsWith('datatable_') && typeof initialData[key] === 'object' && initialData[key] !== null) {
          // This is a nested datatable object - merge it into root level
          // Example: { "datatable_123": { "table__col1_1": "A" } } → { "table__col1_1": "A" }
          Object.assign(flattenedData, initialData[key]);
          delete flattenedData[key]; // Remove the wrapper key
          console.log('📊 Unflattened datatable field:', key, '→', initialData[key]);
        }
      });

      console.log('📥 InteractiveForm: Flattened data for DataTable', flattenedData);
      setFormData(flattenedData);
    }
  }, [initialData]);

  // Fetch dynamic options for fields configured with datalabels
  useEffect(() => {
    const fetchDynamicOptions = async () => {
      const fieldsWithDynamicOptions = fields.filter(f => f.useDynamicOptions && f.datalabelTable);

      for (const field of fieldsWithDynamicOptions) {
        const { datalabelTable, datalabelValueColumn, datalabelDisplayColumn } = field;

        if (!datalabelTable || !datalabelValueColumn || !datalabelDisplayColumn) {
          console.warn(`Field ${field.name} has incomplete datalabel configuration`);
          continue;
        }

        try {
          const token = localStorage.getItem('token');
          const response = await fetch(
            `${API_BASE_URL}/api/v1/setting?category=${datalabelTable}`,
            {
              headers: token ? { Authorization: `Bearer ${token}` } : {}
            }
          );

          if (!response.ok) {
            console.error(`Failed to fetch options for ${datalabelTable}`);
            continue;
          }

          const data = await response.json();

          // Map the API response to value/label pairs
          const options = (data.data || []).map((item: any) => ({
            value: String(item[datalabelValueColumn] || ''),
            label: String(item[datalabelDisplayColumn] || '')
          }));

          setDynamicOptions(prev => ({
            ...prev,
            [field.id]: options
          }));

          console.log(`✅ Loaded ${options.length} options for ${field.name} from ${datalabelTable}`);
        } catch (error) {
          console.error(`Error fetching dynamic options for ${field.name}:`, error);
        }
      }
    };

    fetchDynamicOptions();
  }, [fields]);

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
      // Skip API submission if this form is being used for task updates
      if (skipApiSubmission) {
        // Just pass the form data to parent callback
        setSubmitStatus('success');
        setSubmitMessage('Form data captured successfully!');

        if (onSubmitSuccess) {
          onSubmitSuccess(formData);
        }

        // Reset after short delay
        setTimeout(() => {
          setFormData({});
          setCurrentStepIndex(0);
          setSubmitStatus('idle');
        }, 1000);
        return;
      }

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
          onSubmitSuccess(formData);
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
        // Use dynamic options if configured, otherwise fall back to static options
        const selectOptions = field.useDynamicOptions && dynamicOptions[field.id]
          ? dynamicOptions[field.id]
          : (field.options || []).map(opt => ({ value: opt, label: opt }));

        return (
          <>
            <SearchableSelect
              options={selectOptions}
              value={value || ''}
              onChange={(newValue) => handleFieldChange(field.name, newValue)}
              placeholder={field.placeholder || 'Search or select an option...'}
              required={field.required}
              className="w-full"
            />
            {field.useDynamicOptions && !dynamicOptions[field.id] && (
              <p className="text-gray-500 text-xs mt-1">Loading options from {field.datalabelTable}...</p>
            )}
            {hasError && <p className="text-red-600 text-xs mt-1">{errors[field.name]}</p>}
          </>
        );

      case 'select_multiple':
        // Use dynamic options if configured, otherwise fall back to static options
        const multiSelectOptions = field.useDynamicOptions && dynamicOptions[field.id]
          ? dynamicOptions[field.id]
          : (field.options || []).map(opt => ({ value: opt, label: opt }));

        return (
          <>
            <SearchableMultiSelect
              options={multiSelectOptions}
              value={Array.isArray(value) ? value : []}
              onChange={(newValue) => handleFieldChange(field.name, newValue)}
              placeholder={field.placeholder || 'Search and select multiple...'}
              required={field.required}
              className="w-full"
            />
            {field.useDynamicOptions && !dynamicOptions[field.id] && (
              <p className="text-gray-500 text-xs mt-1">Loading options from {field.datalabelTable}...</p>
            )}
            {hasError && <p className="text-red-600 text-xs mt-1">{errors[field.name]}</p>}
          </>
        );

      case 'radio':
        // Use dynamic options if configured, otherwise fall back to static options
        const radioOptions = field.useDynamicOptions && dynamicOptions[field.id]
          ? dynamicOptions[field.id]
          : (field.options || []).map(opt => ({ value: opt, label: opt }));

        return (
          <>
            <div className="space-y-2">
              {radioOptions.map((opt, i) => (
                <label key={i} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name={field.name}
                    value={opt.value}
                    checked={value === opt.value}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    className="text-blue-600 focus:ring-blue-500"
                    required={field.required && i === 0}
                  />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
            {field.useDynamicOptions && !dynamicOptions[field.id] && (
              <p className="text-gray-500 text-xs mt-1">Loading options from {field.datalabelTable}...</p>
            )}
            {hasError && <p className="text-red-600 text-xs mt-1">{errors[field.name]}</p>}
          </>
        );

      case 'checkbox':
        // Use dynamic options if configured, otherwise fall back to static options
        const checkboxOptions = field.useDynamicOptions && dynamicOptions[field.id]
          ? dynamicOptions[field.id]
          : (field.options || []).map(opt => ({ value: opt, label: opt }));

        return (
          <>
            <div className="space-y-2">
              {checkboxOptions.map((opt, i) => (
                <label key={i} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    value={opt.value}
                    checked={Array.isArray(value) && value.includes(opt.value)}
                    onChange={(e) => {
                      const currentValues = Array.isArray(value) ? value : [];
                      const newValues = e.target.checked
                        ? [...currentValues, opt.value]
                        : currentValues.filter(v => v !== opt.value);
                      handleFieldChange(field.name, newValues);
                    }}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
            {field.useDynamicOptions && !dynamicOptions[field.id] && (
              <p className="text-gray-500 text-xs mt-1">Loading options from {field.datalabelTable}...</p>
            )}
            {hasError && <p className="text-red-600 text-xs mt-1">{errors[field.name]}</p>}
          </>
        );

      case 'taskcheck':
        // TaskCheck: Single checkbox that stores { checked: boolean, timestamp: string | null }
        console.log('🔲 TaskCheck field:', field.name, 'value:', value);
        const taskCheckValue = value || { checked: false, timestamp: null };
        console.log('🔲 TaskCheck parsed:', taskCheckValue);
        const isChecked = taskCheckValue.checked === true;
        const checkedAt = taskCheckValue.timestamp;

        return (
          <>
            <div className="space-y-2">
              <label className="flex items-start space-x-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    const newValue = {
                      checked: e.target.checked,
                      timestamp: e.target.checked ? new Date().toISOString() : null
                    };
                    handleFieldChange(field.name, newValue);
                  }}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  required={field.required}
                />
                <div className="flex-1">
                  <span className="text-sm text-gray-700 group-hover:text-gray-900">
                    {field.label || field.name}
                  </span>
                  {isChecked && checkedAt && (
                    <div className="text-xs text-green-600 mt-1 flex items-center space-x-1">
                      <CheckCircle className="h-3 w-3" />
                      <span>
                        Checked on {new Date(checkedAt).toLocaleDateString()} at {new Date(checkedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </div>
              </label>
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
        // For datatable, we need to pass the whole formData because datatable stores
        // its data as multiple keys: tableName__colName_rowNum
        return (
          <>
            <DataTableInput
              dataTableName={field.dataTableName || 'table'}
              columns={field.dataTableColumns || [{ name: 'col1', label: 'Column 1' }, { name: 'col2', label: 'Column 2' }, { name: 'col3', label: 'Column 3' }]}
              rows={field.dataTableDefaultRows || 1}
              disabled={false}
              onChange={(data) => {
                // Merge datatable data into formData
                setFormData(prev => ({ ...prev, ...data }));
              }}
              initialData={formData}
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

      case 'currency':
        return (
          <>
            <CurrencyInput
              value={value || ''}
              onChange={(newValue) => handleFieldChange(field.name, newValue)}
              placeholder={field.placeholder || '0.00'}
              currencySymbol={field.currencySymbol || '$'}
              required={field.required}
            />
            {hasError && <p className="text-red-600 text-xs mt-1">{errors[field.name]}</p>}
          </>
        );

      case 'date':
        return (
          <>
            <DateOnlyInput
              value={value ? new Date(value) : undefined}
              onChange={(date) => handleFieldChange(field.name, date?.toISOString())}
              placeholder={field.placeholder || 'Select date'}
              required={field.required}
            />
            {hasError && <p className="text-red-600 text-xs mt-1">{errors[field.name]}</p>}
          </>
        );

      case 'time':
        return (
          <>
            <TimeOnlyInput
              value={value || ''}
              onChange={(time) => handleFieldChange(field.name, time)}
              placeholder={field.placeholder || 'Select time'}
              required={field.required}
            />
            {hasError && <p className="text-red-600 text-xs mt-1">{errors[field.name]}</p>}
          </>
        );

      case 'toggle':
        return (
          <>
            <ToggleInput
              value={value === true || value === 'true'}
              onChange={(checked) => handleFieldChange(field.name, checked)}
              label={field.placeholder}
              required={field.required}
            />
            {hasError && <p className="text-red-600 text-xs mt-1">{errors[field.name]}</p>}
          </>
        );

      case 'rating':
        return (
          <>
            <RatingInput
              value={typeof value === 'number' ? value : parseInt(value) || 0}
              onChange={(rating) => handleFieldChange(field.name, rating)}
              maxRating={field.maxRating || 5}
              required={field.required}
            />
            {hasError && <p className="text-red-600 text-xs mt-1">{errors[field.name]}</p>}
          </>
        );

      case 'duration':
        return (
          <>
            <DurationInput
              value={value || { hours: 0, minutes: 0 }}
              onChange={(duration) => handleFieldChange(field.name, duration)}
              required={field.required}
            />
            {hasError && <p className="text-red-600 text-xs mt-1">{errors[field.name]}</p>}
          </>
        );

      case 'percentage':
        return (
          <>
            <PercentageInput
              value={typeof value === 'number' ? value : parseFloat(value) || 0}
              onChange={(percent) => handleFieldChange(field.name, percent)}
              placeholder={field.placeholder || '0'}
              min={field.percentageMin ?? 0}
              max={field.percentageMax ?? 100}
              required={field.required}
            />
            {hasError && <p className="text-red-600 text-xs mt-1">{errors[field.name]}</p>}
          </>
        );

      case 'calculation':
        // Calculate value based on other fields
        const calculatedValue = React.useMemo(() => {
          console.log('🧮 Computing calculation for field:', field.name, 'mode:', field.calculationMode);

          // Mode: Custom JavaScript Expression
          if (field.calculationMode === 'expression' && field.calculationExpression) {
            try {
              // Create a safe context with field values and Math
              const context: Record<string, any> = { Math };

              // Extract all form field values and make them available as variables
              Object.keys(formData).forEach(key => {
                const val = formData[key];
                // Parse numeric values
                let numVal = val;
                if (typeof val === 'string') {
                  const parsed = parseFloat(val.replace(/[^0-9.-]/g, ''));
                  numVal = isNaN(parsed) ? 0 : parsed;
                } else if (typeof val === 'object' && val !== null) {
                  // Handle duration objects {hours: X, minutes: Y}
                  if ('hours' in val && 'minutes' in val) {
                    numVal = (val.hours || 0) + (val.minutes || 0) / 60;
                  } else {
                    numVal = 0;
                  }
                }
                context[key] = numVal;
              });

              console.log('📊 Context for expression:', context);
              console.log('📝 Expression:', field.calculationExpression);

              // Build a function from the expression with only safe context
              const funcBody = `
                "use strict";
                const { ${Object.keys(context).join(', ')} } = this;
                return (${field.calculationExpression});
              `;

              const func = new Function(funcBody);
              const result = func.call(context);

              console.log('✅ Expression result:', result);
              return isNaN(result) ? 0 : result;
            } catch (error) {
              console.error('❌ Calculation expression error:', error);
              return 0; // Return 0 on error
            }
          }

          // Mode: Simple Operation (original logic)
          if (!field.calculationFields || field.calculationFields.length === 0) {
            return 0;
          }

          const values = field.calculationFields
            .map(fieldName => {
              const val = formData[fieldName];
              const num = typeof val === 'string' ? parseFloat(val.replace(/[^0-9.-]/g, '')) : val;
              return isNaN(num) ? 0 : num;
            })
            .filter(v => !isNaN(v));

          if (values.length === 0) return 0;

          switch (field.calculationOperation) {
            case 'sum':
              return values.reduce((a, b) => a + b, 0);
            case 'subtract':
              return values.reduce((a, b) => a - b);
            case 'multiply':
              return values.reduce((a, b) => a * b, 1);
            case 'divide':
              return values.reduce((a, b) => (b !== 0 ? a / b : a));
            case 'average':
              return values.reduce((a, b) => a + b, 0) / values.length;
            case 'min':
              return Math.min(...values);
            case 'max':
              return Math.max(...values);
            default:
              return values.reduce((a, b) => a + b, 0);
          }
        }, [formData, field.calculationFields, field.calculationOperation, field.calculationExpression, field.calculationMode]);

        // Update formData with calculated value
        React.useEffect(() => {
          if (formData[field.name] !== calculatedValue) {
            handleFieldChange(field.name, calculatedValue);
          }
        }, [calculatedValue]);

        return (
          <CalculationField
            value={calculatedValue}
            label={field.label}
            currencySymbol={field.currencySymbol || '$'}
            expression={field.calculationMode === 'expression' ? field.calculationExpression : undefined}
            showExpression={field.calculationMode === 'expression'}
          />
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
