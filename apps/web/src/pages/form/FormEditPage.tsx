import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/shared';
import { useNavigate, useParams } from 'react-router-dom';
import { formApi } from '../../lib/api';
import { AdvancedFormBuilder } from '../../components/entity/form/AdvancedFormBuilder';

export function FormEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const form = await formApi.get(id);
        // Parse schema if it's a string
        if (form.form_schema && typeof form.form_schema === 'string') {
          form.form_schema = JSON.parse(form.form_schema);
        }
        setFormData(form);
      } catch (e) {
        console.error('Failed to load form', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleSave = async (payload: any) => {
    if (!id) return;
    // Update returns the new form (may be a new version with new ID)
    const updatedForm = await formApi.update(id, payload);
    // Navigate to the new version ID
    navigate(`/form/${updatedForm.id}`);
  };

  const handleSaveDraft = async (payload: any) => {
    if (!id) return;
    // Draft saves also go through update, which may create new version
    const updatedForm = await formApi.update(id, payload);
    console.log('Draft saved successfully');
    // Update the form data to reflect the new version
    if (updatedForm.id !== id) {
      // New version was created, update the URL silently
      window.history.replaceState(null, '', `/form/${updatedForm.id}/edit`);
      setFormData(updatedForm);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  if (!formData) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <h3 className="text-sm font-normal text-gray-900">Form not found</h3>
            <p className="mt-2 text-gray-600">The form you're looking for doesn't exist.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <AdvancedFormBuilder
        title={formData?.name || ''}
        description={formData?.descr || ''}
        taskId={formData?.taskId}
        initialFormData={formData}
        onSave={handleSave}
        onSaveDraft={handleSaveDraft}
        backLink={`/form/${id}`}
        headerTitle="Edit Multi-Step Form"
        autoSaveInterval={30000}
      />
    </Layout>
  );
}

export default FormEditPage;
