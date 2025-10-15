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
    const rawSchema = form?.schema;
    if (!rawSchema) {
      return { steps: [] };
    }
    if (typeof rawSchema === 'string') {
      try {
        return JSON.parse(rawSchema);
      } catch (err) {
        console.error('Failed to parse form schema string:', err);
        return { steps: [] };
      }
    }
    return rawSchema;
  }, [form]);

  const steps: FormStep[] = useMemo(() => {
    const schemaSteps = Array.isArray(schema?.steps) ? schema.steps : [];
    return schemaSteps.map((step: any, index: number) => ({
      id: step.id || `step-${index + 1}`,
      name: step.name || `step_${index + 1}`,
      title: step.title || `Step ${index + 1}`,
      description: step.description || '',
    }));
  }, [schema]);

  const fields: BuilderField[] = useMemo(() => {
    const schemaSteps = Array.isArray(schema?.steps) ? schema.steps : [];
    return schemaSteps.flatMap((step: any, stepIndex: number) => {
      const stepFields = Array.isArray(step?.fields) ? step.fields : [];
      return stepFields.map((field: any) => ({
        ...field,
        id: field?.id || field?.name || safeUuid(),
        stepId: step.id || `step-${stepIndex + 1}`,
      }));
    });
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
        return input.value;
      }
      return input;
    };

    if (Array.isArray(value)) {
      return value.map(unwrap);
    }

    return unwrap(value);
  }, []);

  const normalizeSubmissionValues = useCallback(
    (raw: any) => {
      if (!raw || typeof raw !== 'object') return {};

      const result: Record<string, any> = {};

      const assignValue = (key: string | null | undefined, value: any) => {
        if (!key) return;
        const field = resolveFieldForKey(key);
        if (field) {
          result[field.name] = normalizeLeafValue(value);
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
    [formId, submissionId, submission, internalSubmission],
  );

  React.useEffect(() => {
    if (!submissionId) {
      setInternalSubmission(null);
      setLoading(false);
      setError(null);
      hasLoadedOnceRef.current = false;
      return;
    }

    if (submission) {
      console.log('🔄 FormSubmissionEditor received submission state', submission);
    }

    const parsedStatePayload = parseSubmissionData(
      submission?.submissionData ?? submission?.submission_data ?? null,
    );

    if (submission && parsedStatePayload) {
      setInternalSubmission(submission);
      setLoading(false);
      setError(null);
      hasLoadedOnceRef.current = true;
      return;
    }

    fetchSubmission({ forceFullLoading: !hasLoadedOnceRef.current });
  }, [submissionId, submission, fetchSubmission]);

  const initialData = useMemo(() => {
    if (!internalSubmission) return {};

    console.log('🔍 Building initial data from submission', internalSubmission);
    const raw = parseSubmissionData(
      internalSubmission.submissionData ?? internalSubmission.submission_data ?? null,
    );

    if (raw) {
      return normalizeSubmissionValues(raw);
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
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-500">
        Select a submission from the Form Data tab to start editing.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
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
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </button>
      </div>
    );
  }

  if (!internalSubmission) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-500">
        Submission not found or no data available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-normal text-gray-800">Edit Form Submission</h2>
            <p className="text-xs text-gray-500 mt-1">
              {form?.name || form?.title || 'Form'} · Submission{' '}
              {submissionId?.substring(0, 8)}…
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {isRefreshing && (
              <span className="inline-flex items-center text-xs text-gray-500">
                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                Refreshing…
              </span>
            )}
            <button
              onClick={() => fetchSubmission({ forceFullLoading: true })}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-normal rounded-lg text-gray-700 bg-white hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Refresh
            </button>
            {onBack && (
              <button
                onClick={onBack}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-normal rounded-lg text-gray-700 bg-white hover:bg-gray-50"
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Back
              </button>
            )}
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="flex items-center space-x-2">
            <Hash className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-gray-500">Form ID</p>
              <p className="font-normal text-gray-700 break-all">{formId}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Hash className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-gray-500">Submission ID</p>
              <p className="font-normal text-gray-700 break-all">{submissionId}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-gray-500">Status</p>
              <p className="font-normal text-gray-700 capitalize">{submissionStatus}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-gray-500">Approval</p>
              <p className="font-normal text-gray-700 capitalize">{approvalStatus || '—'}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-gray-500">Submitted</p>
              <p className="font-normal text-gray-700">
                {createdAt ? new Date(createdAt).toLocaleString('en-CA') : '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-gray-500">Last Updated</p>
              <p className="font-normal text-gray-700">
                {updatedAt ? new Date(updatedAt).toLocaleString('en-CA') : '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-gray-500">Stage</p>
              <p className="font-normal text-gray-700 capitalize">{stage}</p>
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
