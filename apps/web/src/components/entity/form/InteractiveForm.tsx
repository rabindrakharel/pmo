import React, { useState, useEffect } from 'react';
import { getFieldIcon, SignatureCanvas, AddressInput, GeoLocationInput, ModernDateTimePicker, StepProgressIndicator, DataTableInput, SearchableSelect, SearchableMultiSelect, CurrencyInput, DateOnlyInput, TimeOnlyInput, ToggleInput, RatingInput, DurationInput, PercentageInput, CalculationField } from './FormBuilder';
import { BuilderField, FormStep } from './FormBuilder';
import { BookOpen, Upload, Layers, Send, CheckCircle, AlertCircle, ChevronDown, ExternalLink } from 'lucide-react';
import { ModularEditor } from '../../shared/editor/ModularEditor';
import { useS3Upload } from '../../../lib/hooks/useS3Upload';

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

// Wrapper component to handle menu button field with hooks
function MenuButtonFieldWrapper({ field }: { field: BuilderField }) {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMenuClick = (url: string, openInNewTab?: boolean) => {
    if (openInNewTab) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      // Check if it's an internal URL (starts with /)
      if (url.startsWith('/')) {
        window.location.href = url;
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const getButtonClasses = () => {
    const sizeClasses =
      field.menuButtonSize === 'sm' ? 'px-3 py-1.5 text-xs' :
      field.menuButtonSize === 'lg' ? 'px-6 py-3 text-base' :
      'px-4 py-2 text-sm';

    const styleClasses =
      field.menuButtonStyle === 'primary' ? 'bg-slate-600 text-white hover:bg-slate-700 shadow-sm' :
      field.menuButtonStyle === 'secondary' ? 'bg-slate-600 text-white hover:bg-slate-700 shadow-sm' :
      'border-2 border-dark-400 bg-dark-100 text-dark-600 hover:bg-dark-100';

    return `inline-flex items-center space-x-2 rounded-md font-medium transition-colors ${sizeClasses} ${styleClasses}`;
  };

  return (
    <div className="space-y-2">
      {field.menuButtonType === 'single' && field.menuButtonItems && field.menuButtonItems.length > 0 && (
        <button
          type="button"
          onClick={() => handleMenuClick(field.menuButtonItems![0].url, field.menuButtonItems![0].openInNewTab)}
          className={getButtonClasses()}
        >
          {field.menuButtonItems[0].icon && <span>{field.menuButtonItems[0].icon}</span>}
          <span>{field.menuButtonItems[0].label}</span>
          {field.menuButtonItems[0].openInNewTab && <ExternalLink className="h-3 w-3" />}
        </button>
      )}

      {field.menuButtonType === 'dropdown' && field.menuButtonItems && field.menuButtonItems.length > 0 && (
        <div ref={dropdownRef} className="relative inline-block">
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={getButtonClasses()}
          >
            <span>{field.label || 'Menu'}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDropdownOpen && (
            <div className="absolute z-10 mt-2 bg-dark-100 border border-dark-300 rounded-md shadow-sm py-2 min-w-[200px] left-0">
              {field.menuButtonItems!.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    handleMenuClick(item.url, item.openInNewTab);
                    setIsDropdownOpen(false);
                  }}
                  className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-dark-600 hover:bg-dark-100 transition-colors text-left"
                >
                  {item.icon && <span>{item.icon}</span>}
                  <span>{item.label}</span>
                  {item.openInNewTab && <ExternalLink className="h-3 w-3 ml-auto" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Wrapper component to handle calculation field with hooks
function CalculationFieldWrapper({
  field,
  formData,
  onValueChange
}: {
  field: BuilderField;
  formData: Record<string, any>;
  onValueChange: (value: number) => void;
}) {
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
  }, [formData, field.calculationFields, field.calculationOperation, field.calculationExpression, field.calculationMode, field.name]);

  // Update formData with calculated value
  React.useEffect(() => {
    if (formData[field.name] !== calculatedValue) {
      onValueChange(calculatedValue);
    }
  }, [calculatedValue, formData, field.name, onValueChange]);

  return (
    <CalculationField
      value={calculatedValue}
      label={field.label}
      currencySymbol={field.currencySymbol || '$'}
      expression={field.calculationMode === 'expression' ? field.calculationExpression : undefined}
      showExpression={field.calculationMode === 'expression'}
    />
  );
}

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
  const [signatureUrls, setSignatureUrls] = useState<Record<string, string>>({});
  const [uploadingSignatures, setUploadingSignatures] = useState<Record<string, boolean>>({});
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});

  // Use reusable S3 upload hook (DRY principle)
  const { uploadToS3, getDownloadUrl, uploadingFiles, errors: uploadErrors } = useS3Upload();

  /**
   * Upload file to S3 (uses reusable hook)
   */
  const uploadFileToS3 = async (fieldName: string, file: File): Promise<string | null> => {
    return uploadToS3({
      entityCode: 'form',
      entityInstanceId: formId,
      file,
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      uploadType: 'file',
      tenantId: 'demo',
      fieldName
    });
  };

  /**
   * Upload signature/initials to S3 (uses reusable hook)
   * Converts base64 data URL to blob first
   */
  const uploadSignatureToS3 = async (fieldName: string, dataUrl: string): Promise<string | null> => {
    try {
      // Set uploading state
      setUploadingSignatures(prev => ({ ...prev, [fieldName]: true }));

      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      // Determine file extension and content type based on data URL
      const isSvg = dataUrl.startsWith('data:image/svg+xml');
      const fileExt = isSvg ? 'svg' : 'png';
      const contentType = isSvg ? 'image/svg+xml' : 'image/png';

      const objectKey = await uploadToS3({
        entityCode: 'form',
        entityInstanceId: formId,
        file: blob,
        fileName: `${fieldName}_${Date.now()}.${fileExt}`,
        contentType,
        uploadType: 'signature',
        tenantId: 'demo',
        fieldName
      });

      return objectKey;
    } finally {
      // Clear uploading state
      setUploadingSignatures(prev => ({ ...prev, [fieldName]: false }));
    }
  };

  /**
   * Fetch presigned download URL for any S3 object (uses reusable hook)
   */
  const fetchS3DownloadUrl = async (objectKey: string): Promise<string | null> => {
    return getDownloadUrl(objectKey);
  };

  // Load signature and file URLs from S3 when form data contains S3 object keys (DRY)
  useEffect(() => {
    const loadUrls = async () => {
      // Load signature URLs
      const signatureFields = fields.filter(f => f.type === 'signature' || f.type === 'initials');
      for (const field of signatureFields) {
        const objectKey = formData[field.name];
        // Check if the value looks like an S3 object key (not a data URL)
        if (objectKey && typeof objectKey === 'string' && !objectKey.startsWith('data:')) {
          const url = await fetchS3DownloadUrl(objectKey);
          if (url) {
            setSignatureUrls(prev => ({ ...prev, [field.name]: url }));
          }
        }
      }

      // Load file URLs (reuses same DRY function)
      const fileFields = fields.filter(f => f.type === 'file');
      for (const field of fileFields) {
        const objectKey = formData[field.name];
        // Check if the value looks like an S3 object key
        if (objectKey && typeof objectKey === 'string' && objectKey.startsWith('tenant_id=')) {
          const url = await fetchS3DownloadUrl(objectKey);
          if (url) {
            setFileUrls(prev => ({ ...prev, [field.name]: url }));
          }
        }
      }
    };

    loadUrls();
  }, [formData, fields]);

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
          const token = localStorage.getItem('auth_token');
          const response = await fetch(
            `${API_BASE_URL}/api/v1/datalabel?name=${datalabelTable}`,
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
          const options = (data.data || []).map((item: any) => {
            const value = item[datalabelValueColumn];
            const label = item[datalabelDisplayColumn];

            // Warn if columns don't exist in the data
            if (value === undefined) {
              console.warn(`⚠️ Column '${datalabelValueColumn}' not found in ${datalabelTable} data. Available columns:`, Object.keys(item));
            }
            if (label === undefined) {
              console.warn(`⚠️ Column '${datalabelDisplayColumn}' not found in ${datalabelTable} data. Available columns:`, Object.keys(item));
            }

            return {
              value: String(value || ''),
              label: String(label || '')
            };
          });

          setDynamicOptions(prev => ({
            ...prev,
            [field.id]: options
          }));

          console.log(`✅ Loaded ${options.length} options for ${field.name} from ${datalabelTable}:`,
            `${datalabelValueColumn} → ${datalabelDisplayColumn}`);
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
      console.log('🔑 Auth token from localStorage:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
      console.log('🔐 Auth header will be:', token ? `Bearer ${token.substring(0, 20)}...` : 'NO AUTH HEADER');

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
        const errorBody = await response.text();
        console.error('❌ Form submission failed:', {
          status: response.status,
          statusText: response.statusText,
          body: errorBody,
          headers: Object.fromEntries(response.headers.entries())
        });
        throw new Error(`Failed to ${isEditMode ? 'update' : 'submit'} form: ${response.status} ${response.statusText} - ${errorBody}`);
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

    const baseInputClass = `w-full px-3 py-2 border rounded-md text-sm transition-colors ${
      hasError
        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
        : 'border-dark-400 focus:border-dark-300 focus:ring-dark-700'
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
              <p className="text-dark-700 text-xs mt-1">Loading options from {field.datalabelTable}...</p>
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
              <p className="text-dark-700 text-xs mt-1">Loading options from {field.datalabelTable}...</p>
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
                    className="text-dark-700 focus:ring-slate-500/50"
                    required={field.required && i === 0}
                  />
                  <span className="text-sm text-dark-600">{opt.label}</span>
                </label>
              ))}
            </div>
            {field.useDynamicOptions && !dynamicOptions[field.id] && (
              <p className="text-dark-700 text-xs mt-1">Loading options from {field.datalabelTable}...</p>
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
                    className="rounded text-dark-700 focus:ring-slate-500/50"
                  />
                  <span className="text-sm text-dark-600">{opt.label}</span>
                </label>
              ))}
            </div>
            {field.useDynamicOptions && !dynamicOptions[field.id] && (
              <p className="text-dark-700 text-xs mt-1">Loading options from {field.datalabelTable}...</p>
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
                  className="mt-0.5 rounded text-dark-700 focus:ring-slate-500/50 h-4 w-4"
                  required={field.required}
                />
                <div className="flex-1">
                  <span className="text-sm text-dark-600 group-hover:text-dark-600">
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
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                // Upload file to S3 and store object key
                const objectKey = await uploadFileToS3(field.name, file);
                if (objectKey) {
                  handleFieldChange(field.name, objectKey);
                }
              }}
              accept={field.accept}
              className="w-full text-sm text-dark-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-dark-100 file:text-dark-700 hover:file:bg-dark-100"
              required={field.required}
              disabled={uploadingFiles[field.name]}
            />
            {uploadingFiles[field.name] && (
              <p className="text-dark-700 text-xs mt-1 flex items-center">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-dark-700 mr-1" />
                Uploading file...
              </p>
            )}
            {value && !uploadingFiles[field.name] && (
              <div className="mt-2">
                <p className="text-green-600 text-xs flex items-center">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  File uploaded to cloud storage
                </p>
                {fileUrls[field.name] && (
                  <a
                    href={fileUrls[field.name]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-dark-700 hover:underline flex items-center mt-1"
                  >
                    View uploaded file
                  </a>
                )}
              </div>
            )}
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
              <div className="flex justify-between text-xs text-dark-700">
                <span>{field.min || 0}</span>
                <span className="font-semibold text-dark-700">{value || field.min || 0}</span>
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
          <div className="border border-dark-300 rounded-md overflow-hidden">
            <div className="bg-dark-100 border-b border-dark-300 px-4 py-2 flex items-center space-x-2">
              <BookOpen className="h-4 w-4 text-dark-700" />
              <span className="text-sm font-semibold text-dark-600">{field.wikiTitle || 'Documentation'}</span>
              <span className="text-xs text-dark-700 ml-auto">Read-only</span>
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
        // Use wrapper component to avoid hooks violation
        return (
          <CalculationFieldWrapper
            field={field}
            formData={formData}
            onValueChange={(value) => handleFieldChange(field.name, value)}
          />
        );

      case 'menu_button':
        // Use wrapper component to avoid hooks violation
        return <MenuButtonFieldWrapper field={field} />;

      case 'signature':
        // If value is an S3 object key, use the presigned URL for display
        const signatureDisplayUrl = signatureUrls[field.name] || (value && value.startsWith('data:') ? value : '');

        return (
          <>
            <SignatureCanvas
              value={signatureDisplayUrl}
              onChange={async (dataUrl) => {
                // Upload signature to S3 and store object key
                const objectKey = await uploadSignatureToS3(field.name, dataUrl);
                if (objectKey) {
                  handleFieldChange(field.name, objectKey);
                }
              }}
              width={field.signatureWidth || 400}
              height={field.signatureHeight || 200}
              isInitials={false}
            />
            {uploadingSignatures[field.name] && (
              <p className="text-dark-700 text-xs mt-1 flex items-center">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-dark-700 mr-1" />
                Uploading signature...
              </p>
            )}
            {value && !uploadingSignatures[field.name] && (
              <p className="text-green-600 text-xs mt-1 flex items-center">
                <CheckCircle className="h-3 w-3 mr-1" />
                Signature saved to cloud storage
              </p>
            )}
            {hasError && <p className="text-red-600 text-xs mt-1">{errors[field.name]}</p>}
          </>
        );

      case 'initials':
        // If value is an S3 object key, use the presigned URL for display
        const initialsDisplayUrl = signatureUrls[field.name] || (value && value.startsWith('data:') ? value : '');

        return (
          <>
            <SignatureCanvas
              value={initialsDisplayUrl}
              onChange={async (dataUrl) => {
                // Upload initials to S3 and store object key
                const objectKey = await uploadSignatureToS3(field.name, dataUrl);
                if (objectKey) {
                  handleFieldChange(field.name, objectKey);
                }
              }}
              width={field.signatureWidth || 200}
              height={field.signatureHeight || 100}
              isInitials={true}
            />
            {uploadingSignatures[field.name] && (
              <p className="text-dark-700 text-xs mt-1 flex items-center">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-dark-700 mr-1" />
                Uploading initials...
              </p>
            )}
            {value && !uploadingSignatures[field.name] && (
              <p className="text-green-600 text-xs mt-1 flex items-center">
                <CheckCircle className="h-3 w-3 mr-1" />
                Initials saved to cloud storage
              </p>
            )}
            {hasError && <p className="text-red-600 text-xs mt-1">{errors[field.name]}</p>}
          </>
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
        <div className="bg-green-50 border border-green-200 rounded-md p-4 flex items-center space-x-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <p className="text-green-800 font-medium">{submitMessage}</p>
        </div>
      )}

      {submitStatus === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-center space-x-3">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-red-800 font-medium">{submitMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 bg-dark-100 rounded-md border border-dark-300 p-6">
        {displayFields.length === 0 && (
          <div className="text-dark-700 text-center py-8">
            <Layers className="h-6 w-6 mx-auto mb-2 text-dark-600" />
            <p className="text-sm">No fields in this step.</p>
          </div>
        )}

        {displayFields.map((field) => {
          const label = field.label || field.name;
          return (
            <div key={field.id} className="flex flex-col space-y-1">
              <div className="flex items-center space-x-2">
                <div className="flex-shrink-0 text-dark-700">
                  {getFieldIcon(field.type)}
                </div>
                <label className="text-sm font-medium text-dark-600">
                  {label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
              </div>

              {renderField(field)}
            </div>
          );
        })}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-6 border-t border-dark-300">
          <div>
            {steps.length > 1 && currentStepIndex > 0 && (
              <button
                type="button"
                onClick={handlePrevious}
                className="px-4 py-2 border border-dark-200 rounded-md text-sm font-medium text-dark-700 bg-white hover:bg-dark-50 hover:border-dark-300 focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none transition-colors"
              >
                Previous
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {steps.length > 1 && (
              <span className="text-sm text-dark-700">
                Step {currentStepIndex + 1} of {steps.length}
              </span>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center px-6 py-2.5 border border-transparent rounded-md text-sm font-medium text-white bg-slate-600 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
