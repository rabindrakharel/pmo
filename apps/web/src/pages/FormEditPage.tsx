import React, { useEffect, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { useNavigate, useParams } from 'react-router-dom';
import { formApi } from '../lib/api';
import { AdvancedFormBuilder } from '../components/forms/AdvancedFormBuilder';

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
        if (form.schema && typeof form.schema === 'string') {
          form.schema = JSON.parse(form.schema);
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
    await formApi.update(id, payload);
    navigate(`/form/${id}`);
  };

  const handleSaveDraft = async (payload: any) => {
    if (!id) return;
    await formApi.update(id, payload);
    console.log('Draft saved successfully');
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
