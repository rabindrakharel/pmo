import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { FormSubmissionEditor } from '../components/forms/FormSubmissionEditor';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export function FormDataPreviewPage() {
  const { formId, submissionId } = useParams<{ formId: string; submissionId: string }>();
  const navigate = useNavigate();

  const [formData, setFormData] = useState<any>(null);
  const [submissionData, setSubmissionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
            className="mt-4 inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-normal text-gray-700 bg-white hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Form Data
          </button>
        </div>
      </Layout>
    );
  }

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
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 shadow-sm">
          <FormSubmissionEditor
            form={formData}
            formId={formId!}
            submissionId={submissionId!}
            submission={submissionData}
            onSubmissionUpdated={loadData}
            showHeader={false}
          />
        </div>
     </div>
   </Layout>
 );
}
