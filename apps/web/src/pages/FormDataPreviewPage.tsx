import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { InteractiveForm } from '../components/forms/InteractiveForm';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export function FormDataPreviewPage() {
  const { formId, submissionId } = useParams<{ formId: string; submissionId: string }>();
  const navigate = useNavigate();

  const [formData, setFormData] = useState<any>(null);
  const [submissionData, setSubmissionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    loadData();
  }, [formId, submissionId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');

      if (!token) {
        throw new Error('No authentication token found');
      }

      console.log('Loading form and submission data...', { formId, submissionId });

      // Load form schema
      const formResponse = await fetch(`${API_BASE_URL}/api/v1/form/${formId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!formResponse.ok) {
        const errorText = await formResponse.text();
        console.error('Form load error:', errorText);
        throw new Error(`Failed to load form: ${formResponse.status} ${formResponse.statusText}`);
      }

      const form = await formResponse.json();
      setFormData(form);
      console.log('✅ Form loaded successfully:', {
        id: form.id,
        name: form.name,
        schema: form.schema,
        hasSteps: !!form.schema?.steps,
        stepCount: form.schema?.steps?.length || 0
      });

      // Load submission data
      const submissionResponse = await fetch(
        `${API_BASE_URL}/api/v1/form/${formId}/data/${submissionId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!submissionResponse.ok) {
        const errorText = await submissionResponse.text();
        console.error('Submission load error:', errorText);
        throw new Error(`Failed to load submission: ${submissionResponse.status} ${submissionResponse.statusText}`);
      }

      const submission = await submissionResponse.json();
      setSubmissionData(submission);
      console.log('✅ Submission loaded successfully - RAW RESPONSE:', submission);
      console.log('✅ Submission loaded successfully:', {
        id: submission.id,
        status: submission.submissionStatus || submission.submission_status,
        hasData: !!submission.submissionData || !!submission.submission_data,
        dataKeys: Object.keys(submission.submissionData || submission.submission_data || {}),
        allKeys: Object.keys(submission)
      });
    } catch (err) {
      console.error('❌ Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(`/form/${formId}/form-data`);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </Layout>
    );
  }

  if (error || !formData || !submissionData) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto mt-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-red-800">{error || 'Form or submission not found'}</p>
            </div>
          </div>
          <button
            onClick={handleBack}
            className="mt-4 inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Form Data
          </button>
        </div>
      </Layout>
    );
  }

  // Extract and prepare fields from schema
  console.log('🔍 Raw formData:', formData);
  console.log('🔍 formData.schema:', formData.schema);
  console.log('🔍 Type of formData.schema:', typeof formData.schema);

  // Handle schema that might be a JSON string or already parsed object
  let schema = formData.schema || {};
  if (typeof schema === 'string') {
    try {
      schema = JSON.parse(schema);
      console.log('✅ Parsed schema from string');
    } catch (e) {
      console.error('❌ Failed to parse schema string:', e);
      schema = {};
    }
  }
  console.log('🔍 Final schema:', schema);

  const steps = schema.steps || [];
  console.log('🔍 Steps array:', steps);

  const fields = steps.flatMap((step: any, stepIndex: number) => {
    const stepFields = step.fields || [];
    console.log(`📌 Step ${stepIndex} "${step.title || step.name || 'Untitled'}" has ${stepFields.length} fields:`, stepFields);
    return stepFields.map((field: any) => ({
      ...field,
      id: field.id || field.name || crypto.randomUUID(),
      stepId: step.id,
    }));
  });

  console.log('📋 FormDataPreviewPage - Prepared data:', {
    hasSchema: !!schema,
    stepCount: steps.length,
    totalFields: fields.length,
    steps: steps.map((s: any, i: number) => ({
      index: i,
      id: s.id,
      title: s.title || s.name,
      fieldCount: s.fields?.length || 0
    })),
    fields: fields.map((f: any) => ({
      name: f.name,
      type: f.type,
      label: f.label,
      stepId: f.stepId
    })),
    submissionDataKeys: Object.keys(submissionData.submissionData || submissionData.submission_data || {})
  });

  // Prepare initial data for the form - Use React.useMemo to prevent re-creation
  const initialData = React.useMemo(() => {
    let data = submissionData.submissionData || submissionData.submission_data || {};
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
        console.log('✅ Parsed submission data from string');
      } catch (e) {
        console.error('❌ Failed to parse submission data string:', e);
        data = {};
      }
    }
    console.log('🔍 Final initialData for form:', data);
    return data;
  }, [submissionData]);

  return (
    <Layout>
      <div className="w-[97%] max-w-[1536px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-sm font-normal text-gray-500">
                Form Data Preview: {formData.name}
                <span className="text-xs font-light text-gray-500 ml-3">
                  Submission · {submissionId?.substring(0, 8)}...
                </span>
              </h1>
            </div>
          </div>
        </div>

        {/* Status Messages */}
        {saveStatus === 'success' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="text-green-800 font-medium">Changes saved successfully!</p>
          </div>
        )}

        {saveStatus === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-800 font-medium">Failed to save changes</p>
          </div>
        )}

        {/* Submission Info */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Status:</span>
              <span className="ml-2 font-medium text-gray-700 capitalize">
                {submissionData.submissionStatus || submissionData.submission_status}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Submitted:</span>
              <span className="ml-2 font-medium text-gray-700">
                {new Date(submissionData.createdTs || submissionData.created_ts).toLocaleString('en-CA')}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Updated:</span>
              <span className="ml-2 font-medium text-gray-700">
                {new Date(submissionData.updatedTs || submissionData.updated_ts).toLocaleString('en-CA')}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Stage:</span>
              <span className="ml-2 font-medium text-gray-700 capitalize">
                {submissionData.stage || 'saved'}
              </span>
            </div>
          </div>
        </div>

        {/* Interactive Form with Pre-filled Data */}
        <InteractiveForm
          key={submissionId}
          formId={formId!}
          submissionId={submissionId!}
          fields={fields}
          steps={steps}
          initialData={initialData}
          isEditMode={true}
          onSubmitSuccess={() => {
            setSaveStatus('success');
            setTimeout(() => {
              setSaveStatus('idle');
              // Optionally reload data
              loadData();
            }, 2000);
          }}
        />
      </div>
    </Layout>
  );
}
