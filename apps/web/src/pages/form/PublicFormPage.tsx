import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FormPreview } from '../../components/entity/form/FormPreview';
import { CheckCircle, AlertCircle } from 'lucide-react';

export function PublicFormPage() {
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    loadForm();
  }, [id]);

  const loadForm = async () => {
    setLoading(true);
    setError(null);
    try {
      // Public endpoint - no authentication required
      const response = await fetch(`/api/v1/public/form/${id}`);

      if (!response.ok) {
        throw new Error('Form not found or is not publicly accessible');
      }

      const data = await response.json();

      // Parse schema if it's a string
      if (data.form_schema && typeof data.form_schema === 'string') {
        data.form_schema = JSON.parse(data.form_schema);
      }

      setForm(data);
    } catch (err) {
      console.error('Failed to load form:', err);
      setError(err instanceof Error ? err.message : 'Failed to load form');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/public/form/${id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          submissionData: formData,
          submissionStatus: 'submitted',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit form');
      }

      setSubmitted(true);
    } catch (err) {
      console.error('Failed to submit form:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-dark-700" />
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="min-h-screen bg-dark-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 stroke-[1.5] mx-auto mb-4" />
          <h3 className="text-sm font-normal text-dark-600 mb-2">Error</h3>
          <p className="text-dark-700">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-dark-100 flex items-center justify-center">
        <div className="max-w-md w-full bg-dark-100 rounded-lg shadow-lg p-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 stroke-[1.5] mx-auto mb-4" />
          <h2 className="text-sm font-normal text-dark-600 mb-2">Thank You!</h2>
          <p className="text-dark-700 mb-6">Your form has been submitted successfully.</p>
          <button
            onClick={() => {
              setSubmitted(false);
              setFormData({});
            }}
            className="px-6 py-2 bg-dark-700 text-white rounded-lg hover:bg-dark-800"
          >
            Submit Another Response
          </button>
        </div>
      </div>
    );
  }

  const schema = form?.form_schema || {};
  const steps = schema.steps || [];
  const fields = steps.flatMap((step: any) =>
    (step.fields || []).map((field: any) => ({
      ...field,
      id: field.id || field.name || crypto.randomUUID(),
      stepId: step.id
    }))
  );

  return (
    <div className="min-h-screen bg-dark-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-dark-100 rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-dark-700 to-purple-600 px-8 py-6">
            <h1 className="text-sm font-normal text-white">{form?.name}</h1>
            {form?.descr && (
              <p className="mt-2 text-dark-600">{form.descr}</p>
            )}
          </div>

          {/* Form */}
          <div className="px-8 py-6">
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-400 stroke-[1.5]" />
                  <p className="ml-3 text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {fields.map((field: any) => (
                <div key={field.id || field.name}>
                  <label className="block text-sm font-normal text-dark-600 mb-2">
                    {field.label || field.name}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>

                  {field.type === 'textarea' ? (
                    <textarea
                      name={field.name}
                      required={field.required}
                      placeholder={field.placeholder}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      className="w-full px-3 py-2 border border-dark-400 rounded-lg focus:ring-2 focus:ring-dark-7000 focus:border-dark-3000"
                      rows={4}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      name={field.name}
                      required={field.required}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      className="w-full px-3 py-2 border border-dark-400 rounded-lg focus:ring-2 focus:ring-dark-7000 focus:border-dark-3000"
                    >
                      <option value="">Select...</option>
                      {field.options?.map((opt: any) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type || 'text'}
                      name={field.name}
                      required={field.required}
                      placeholder={field.placeholder}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      className="w-full px-3 py-2 border border-dark-400 rounded-lg focus:ring-2 focus:ring-dark-7000 focus:border-dark-3000"
                    />
                  )}
                </div>
              ))}

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-dark-700 text-white py-3 px-6 rounded-lg font-normal hover:bg-dark-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
