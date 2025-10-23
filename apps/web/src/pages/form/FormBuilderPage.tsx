import React, { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '../../components/shared';
import { AdvancedFormBuilder } from '../../components/entity/form/AdvancedFormBuilder';
import { formApi } from '../../lib/api';

export function FormBuilderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const taskId = searchParams.get('taskId') || undefined;

  // Track the draft form ID to avoid creating duplicates
  const draftFormIdRef = useRef<string | null>(null);

  const handleSave = async (formData: any) => {
    try {
      console.log('FormBuilderPage handleSave called with:', formData);

      const userId = localStorage.getItem('user_id') || undefined;
      const userName = localStorage.getItem('user_name') || undefined;

      // Simplified payload matching backend schema
      const payload = {
        name: formData.name,
        descr: formData.descr,
        form_type: 'multi_step',
        form_schema: formData.form_schema // Already an object, backend will stringify
      };

      console.log('Payload to send:', payload);
      console.log('form_schema type:', typeof payload.form_schema);
      console.log('form_schema:', JSON.stringify(payload.form_schema, null, 2));

      // If we have a draft, update it; otherwise create new
      if (draftFormIdRef.current) {
        console.log('Updating existing draft:', draftFormIdRef.current);
        const updated = await formApi.update(draftFormIdRef.current, payload);
        console.log('Form updated successfully:', updated);
        navigate(`/form/${updated.id}`);
      } else {
        console.log('Creating new form');
        const created = await formApi.create(payload);
        console.log('Form created successfully:', created);
        navigate(`/form/${created.id}`);
      }
    } catch (error) {
      console.error('Error in handleSave:', error);
      alert(`Failed to save form: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  };

  const handleSaveDraft = async (formData: any) => {
    try {
      console.log('FormBuilderPage handleSaveDraft called with:', formData);

      const userId = localStorage.getItem('user_id') || undefined;
      const userName = localStorage.getItem('user_name') || undefined;

      const payload = {
        name: formData.name || 'Untitled Form (Draft)',
        descr: formData.descr,
        form_type: 'multi_step',
        form_schema: formData.form_schema
      };

      console.log('Draft payload to send:', payload);

      // If draft already exists, update it; otherwise create new
      if (draftFormIdRef.current) {
        await formApi.update(draftFormIdRef.current, payload);
        console.log('Draft updated successfully');
      } else {
        const created = await formApi.create(payload);
        draftFormIdRef.current = created.id;
        console.log('Draft created successfully with ID:', created.id);
      }
    } catch (error) {
      console.error('Error in handleSaveDraft:', error);
      // Don't alert for draft errors, just log them
    }
  };

  return (
    <Layout>
      <AdvancedFormBuilder
        taskId={taskId}
        onSave={handleSave}
        onSaveDraft={handleSaveDraft}
        backLink="/form"
        headerTitle="Create Multi-Step Form"
        autoSaveInterval={30000}
      />
    </Layout>
  );
}

export default FormBuilderPage;
