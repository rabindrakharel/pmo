import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  Calendar,
  AlertCircle,
  CheckCircle,
  Hash,
  Clock,
} from 'lucide-react';
import { InteractiveForm } from './InteractiveForm';
import { BuilderField, FormStep } from './FormBuilder';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

interface FormSubmissionEditorProps {
  form: any;
  formId: string;
  submissionId?: string | null;
  submission?: any;
  onSubmissionUpdated?: () => void;
  onBack?: () => void;
  showHeader?: boolean;
}

const parseSubmissionData = (value: any) => {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (err) {
      console.error('Failed to parse submission data string:', err);
      return null;
    }
  }
  if (typeof value === 'object') {
    return value;
  }
  return null;
};

const safeUuid = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `field-${Math.random().toString(36).slice(2)}`;

export function FormSubmissionEditor({
  form,
  formId,
  submissionId,
  submission,
  onSubmissionUpdated,
  onBack,
  showHeader = true,
}: FormSubmissionEditorProps) {
  const [internalSubmission, setInternalSubmission] = useState<any | null>(submission ?? null);
  const [loading, setLoading] = useState<boolean>(Boolean(submissionId) && !submission);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasLoadedOnceRef = useRef<boolean>(Boolean(submission));

  const schema = useMemo(() => {
    console.log('📋 Form object received:', form);
    const rawSchema = form?.form_schema || form?.schema;
    console.log('📋 Raw schema:', rawSchema);
    if (!rawSchema) {
      console.warn('⚠️ No schema found in form object');
      return { steps: [] };
    }
    if (typeof rawSchema === 'string') {
      try {
        const parsed = JSON.parse(rawSchema);
        console.log('📋 Parsed schema:', parsed);
        return parsed;
      } catch (err) {
        console.error('Failed to parse form schema string:', err);
        return { steps: [] };
      }
    }
    console.log('📋 Using schema as object:', rawSchema);
    return rawSchema;
  }, [form]);

  const steps: FormStep[] = useMemo(() => {
    const schemaSteps = Array.isArray(schema?.steps) ? schema.steps : [];
    const result = schemaSteps.map((step: any, index: number) => ({
      id: step.id || `step-${index + 1}`,
      name: step.name || `step_${index + 1}`,
      title: step.title || `Step ${index + 1}`,
      description: step.description || '',
    }));
    console.log('📋 Generated steps:', result);
    return result;
  }, [schema]);

  const fields: BuilderField[] = useMemo(() => {
    const schemaSteps = Array.isArray(schema?.steps) ? schema.steps : [];
    const result = schemaSteps.flatMap((step: any, stepIndex: number) => {
      const stepFields = Array.isArray(step?.fields) ? step.fields : [];
      return stepFields.map((field: any) => ({
        ...field,
        id: field?.id || field?.name || safeUuid(),
        stepId: step.id || `step-${stepIndex + 1}`,
      }));
    });
    console.log('📋 Generated fields:', result);
    return result;
  }, [schema]);

  const fieldLookups = useMemo(() => {
    const byName = new Map<string, BuilderField>();
    const byId = new Map<string, BuilderField>();
    const byLabel = new Map<string, BuilderField>();
    const byLabelLower = new Map<string, BuilderField>();

    fields.forEach((field) => {
      if (field.name) {
        byName.set(field.name, field);
      }
      if (field.id) {
        byId.set(field.id, field);
      }
      if (field.label) {
        byLabel.set(field.label, field);
        byLabelLower.set(field.label.toLowerCase(), field);
      }
    });

    return { byName, byId, byLabel, byLabelLower };
  }, [fields]);

  const resolveFieldForKey = useCallback(
    (rawKey: string | null | undefined) => {
      if (!rawKey) return undefined;
      const key = rawKey.toString().trim();
      if (!key) return undefined;

      const direct =
        fieldLookups.byName.get(key) ||
        fieldLookups.byId.get(key) ||
        fieldLookups.byLabel.get(key);
      if (direct) return direct;

      const lowerMatch = fieldLookups.byLabelLower.get(key.toLowerCase());
      if (lowerMatch) return lowerMatch;

      if (key.includes('.')) {
        for (const part of key.split('.')) {
          const trimmed = part.trim();
          if (!trimmed) continue;
          const matched =
            fieldLookups.byName.get(trimmed) ||
            fieldLookups.byId.get(trimmed) ||
            fieldLookups.byLabel.get(trimmed) ||
            fieldLookups.byLabelLower.get(trimmed.toLowerCase());
          if (matched) {
            return matched;
          }
        }
      }

      return undefined;
    },
    [fieldLookups],
  );

  const normalizeLeafValue = useCallback((value: any) => {
    if (value == null) return value;

    const unwrap = (input: any) => {
      if (
        input &&
        typeof input === 'object' &&
        'value' in input &&
        Object.keys(input).length <= 2
      ) {
        console.log('🔄 Unwrapping object with value property:', input, '→', input.value);
        return input.value;
      }
      return input;
    };

    if (Array.isArray(value)) {
      return value.map(unwrap);
    }

    const result = unwrap(value);
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      console.log('🔍 normalizeLeafValue - preserving object:', value, '→', result);
    }
    return result;
  }, []);

  // DATATABLE KEY PRESERVATION LOGIC:
  // This function normalizes submission data by matching keys to form field definitions.
  // However, datatable fields use a special flattened key pattern that doesn't match
  // any single field name, so we need special handling.
  //
  // DATATABLE KEY PATTERN: {dataTableName}__{columnName}_{rowNumber}
  //   Examples: "inventory__col1_1", "schedule__employee_name_3", "table__price_2"
  //
  // PROBLEM:
  // The default field lookup (resolveFieldForKey) won't find these keys because:
  //   - Field name might be "datatable_1760567271140"
  //   - But actual keys are "table_1760567271140__col1_1", "table_1760567271140__col2_1"
  //   - These don't match any field.name, field.id, or field.label
  //
  // SOLUTION:
  // Detect keys matching datatable pattern (contains "__" and ends with "_number")
  // and preserve them as-is without trying to resolve to a field name.
  //
  // REGEX BREAKDOWN:
  //   - key.includes('__') → Must contain double underscore (separator)
  //   - /_\d+$/.test(key) → Must end with underscore + digits (row number)
  //   - Example matches: "table__col1_1" ✅, "schedule__name_12" ✅
  //   - Example non-matches: "email_123" ❌, "textarea__value" ❌
  const normalizeSubmissionValues = useCallback(
    (raw: any) => {
      if (!raw || typeof raw !== 'object') return {};

      const result: Record<string, any> = {};

      const assignValue = (key: string | null | undefined, value: any) => {
        if (!key) return;

        // Preserve datatable flattened keys without field lookup
        // Pattern: tablename__columnname_rownumber (e.g., "inventory__col1_1")
        if (key.includes('__') && /_\d+$/.test(key)) {
          console.log('📊 Preserving datatable key:', key, '=', value);
          result[key] = normalizeLeafValue(value);
          return;
        }

        // For all other keys, try to resolve to a field name
        const field = resolveFieldForKey(key);
        const normalizedValue = normalizeLeafValue(value);
        if (field) {
          console.log('✅ Matched field key:', key, '→', field.name, '=', normalizedValue);
          result[field.name] = normalizedValue;
        } else {
          // If no field match found, preserve the key as-is (it might be a valid field name already)
          console.log('⚠️ No field match for key:', key, '- preserving as-is, value:', normalizedValue);
          result[key] = normalizedValue;
        }
      };

      const traverse = (node: any) => {
        if (node == null) return;
        if (Array.isArray(node)) {
          node.forEach(traverse);
          return;
        }
        if (typeof node !== 'object') return;

        const keyCandidates = [
          (node as any).name,
          (node as any).fieldName,
          (node as any).field_name,
          (node as any).field_id,
          (node as any).id,
          (node as any).key,
          (node as any).label,
        ].filter(Boolean);

        const valueCandidates = [
          (node as any).value,
          (node as any).fieldValue,
          (node as any).field_value,
          (node as any).val,
          (node as any).data,
          (node as any).answer,
          (node as any).response,
        ].filter((candidate) => candidate !== undefined);

        if (keyCandidates.length > 0 && valueCandidates.length > 0) {
          assignValue(keyCandidates[0], valueCandidates[0]);
        }

        const nestedKeys = ['fields', 'answers', 'items', 'children', 'values'];

        Object.entries(node).forEach(([key, value]) => {
          if (nestedKeys.includes(key)) {
            traverse(value);
          } else if (value !== null && typeof value === 'object') {
            traverse(value);
          } else {
            assignValue(key, value);
          }
        });
      };

      traverse(raw);
      return result;
    },
    [normalizeLeafValue, resolveFieldForKey],
  );

  const fetchSubmission = useCallback(
    async (options?: { forceFullLoading?: boolean }) => {
      if (!submissionId) return;

      const hasLoadedOnce = hasLoadedOnceRef.current;
      const showFullSpinner = options?.forceFullLoading ?? !hasLoadedOnce;

      setLoading(showFullSpinner);
      setIsRefreshing(!showFullSpinner);
      setError(null);

      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          throw new Error('No authentication token found');
        }

        const response = await fetch(`${API_BASE_URL}/api/v1/form/${formId}/data/${submissionId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || `Failed to load submission (${response.status})`);
        }

        let result = await response.json();
        let rawPayload = result?.submissionData ?? result?.submission_data ?? null;

        if (!rawPayload) {
          const previousPayload =
            submission?.submissionData ??
            submission?.submission_data ??
            internalSubmission?.submissionData ??
            internalSubmission?.submission_data ??
            null;
          if (previousPayload) {
            result = { ...result, submissionData: previousPayload };
            rawPayload = previousPayload;
          } else {
            console.warn('Submission payload still missing after hydration attempts');
          }
        }

        setInternalSubmission(result);
        hasLoadedOnceRef.current = true;
      } catch (err) {
        console.error('Error loading submission:', err);
        setError(err instanceof Error ? err.message : 'Failed to load submission');
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [formId, submissionId],
  );

  React.useEffect(() => {
    if (!submissionId) {
      setInternalSubmission(null);
      setLoading(false);
      setError(null);
      hasLoadedOnceRef.current = false;
      return;
    }

    // Only set from submission prop if we don't already have data
    if (submission && !hasLoadedOnceRef.current) {
      console.log('🔄 FormSubmissionEditor received submission state', submission);
      const parsedStatePayload = parseSubmissionData(
        submission?.submissionData ?? submission?.submission_data ?? null,
      );

      if (parsedStatePayload) {
        setInternalSubmission(submission);
        setLoading(false);
        setError(null);
        hasLoadedOnceRef.current = true;
        return;
      }
    }

    // Only fetch if we haven't loaded yet
    if (!hasLoadedOnceRef.current) {
      fetchSubmission({ forceFullLoading: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  const initialData = useMemo(() => {
    if (!internalSubmission) return {};

    console.log('🔍 Building initial data from submission', internalSubmission);
    const raw = parseSubmissionData(
      internalSubmission.submissionData ?? internalSubmission.submission_data ?? null,
    );

    console.log('📦 Parsed submission data:', raw);

    if (raw) {
      const normalized = normalizeSubmissionValues(raw);
      console.log('✨ Normalized data from raw:', normalized);
      return normalized;
    }

    const normalized = normalizeSubmissionValues(internalSubmission);
    console.log('🔍 Fallback normalized data', normalized);
    return normalized;
  }, [internalSubmission, normalizeSubmissionValues]);

  const submissionStatus =
    internalSubmission?.submissionStatus ||
    internalSubmission?.submission_status ||
    'submitted';

  const approvalStatus =
    internalSubmission?.approvalStatus ||
    internalSubmission?.approval_status ||
    null;

  const createdAt = internalSubmission?.createdTs || internalSubmission?.created_ts;
  const updatedAt = internalSubmission?.updatedTs || internalSubmission?.updated_ts;
  const stage = internalSubmission?.stage || 'saved';

  const handleRetry = () => {
    fetchSubmission({ forceFullLoading: true });
  };

  const handleSubmitSuccess = () => {
    if (submissionId) {
      fetchSubmission();
    }
    onSubmissionUpdated?.();
  };

  if (!submissionId) {
    return (
      <div className="bg-dark-100 border border-dark-300 rounded-lg p-8 text-center text-sm text-dark-700">
        Select a submission from the Form Data tab to start editing.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dark-700" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center space-x-3">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-red-800 text-sm">{error}</p>
        </div>
        <button
          onClick={handleRetry}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-dark-700 rounded-lg hover:bg-dark-800 transition-colors"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </button>
      </div>
    );
  }

  if (!internalSubmission) {
    return (
      <div className="bg-dark-100 border border-dark-300 rounded-lg p-8 text-center text-sm text-dark-700">
        Submission not found or no data available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="bg-dark-100 border border-dark-300 rounded-lg p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-normal text-dark-600">Edit Form Submission</h2>
            <p className="text-xs text-dark-700 mt-1">
              {form?.name || form?.title || 'Form'} · Submission{' '}
              {submissionId?.substring(0, 8)}…
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {isRefreshing && (
              <span className="inline-flex items-center text-xs text-dark-700">
                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                Refreshing…
              </span>
            )}
            <button
              onClick={() => fetchSubmission({ forceFullLoading: true })}
              className="inline-flex items-center px-3 py-1.5 border border-dark-400 text-xs font-normal rounded-lg text-dark-600 bg-dark-100 hover:bg-dark-100"
            >
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Refresh
            </button>
            {onBack && (
              <button
                onClick={onBack}
                className="inline-flex items-center px-3 py-1.5 border border-dark-400 text-xs font-normal rounded-lg text-dark-600 bg-dark-100 hover:bg-dark-100"
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Back
              </button>
            )}
          </div>
        </div>
      )}

      <div className="bg-dark-100 border border-dark-300 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="flex items-center space-x-2">
            <Hash className="h-4 w-4 text-dark-600" />
            <div>
              <p className="text-dark-700">Form ID</p>
              <p className="font-normal text-dark-600 break-all">{formId}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Hash className="h-4 w-4 text-dark-600" />
            <div>
              <p className="text-dark-700">Submission ID</p>
              <p className="font-normal text-dark-600 break-all">{submissionId}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-dark-600" />
            <div>
              <p className="text-dark-700">Status</p>
              <p className="font-normal text-dark-600 capitalize">{submissionStatus}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-dark-600" />
            <div>
              <p className="text-dark-700">Approval</p>
              <p className="font-normal text-dark-600 capitalize">{approvalStatus || '—'}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-dark-600" />
            <div>
              <p className="text-dark-700">Submitted</p>
              <p className="font-normal text-dark-600">
                {createdAt ? new Date(createdAt).toLocaleString('en-CA') : '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-dark-600" />
            <div>
              <p className="text-dark-700">Last Updated</p>
              <p className="font-normal text-dark-600">
                {updatedAt ? new Date(updatedAt).toLocaleString('en-CA') : '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-dark-600" />
            <div>
              <p className="text-dark-700">Stage</p>
              <p className="font-normal text-dark-600 capitalize">{stage}</p>
            </div>
          </div>
        </div>
      </div>

      <InteractiveForm
        key={submissionId}
        formId={formId}
        submissionId={submissionId}
        fields={fields}
        steps={steps}
        initialData={initialData}
        isEditMode={true}
        onSubmitSuccess={handleSubmitSuccess}
      />
    </div>
  );
}
