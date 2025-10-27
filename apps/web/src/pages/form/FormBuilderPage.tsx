import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FormDesigner } from '../../components/entity/form/FormDesigner';
import { formApi } from '../../lib/api';
import { useSidebar } from '../../contexts/SidebarContext';

export function FormBuilderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const taskId = searchParams.get('taskId') || undefined;
  const { hideSidebar } = useSidebar();

  // Hide sidebar when entering form builder
  useEffect(() => {
    hideSidebar();
  }, []);

  // Track the draft form ID to avoid creating duplicates
  const draftFormIdRef = useRef<string | null>(null);

  const handleSaveDraft = async (formData: any) => {
    try {
      console.log('FormBuilderPage handleSaveDraft called with:', formData);

      const payload = {
        name: formData.name || 'Untitled Form (Draft)',
        descr: formData.descr,
        form_type: 'multi_step',
        form_schema: formData.form_schema,
        approval_status: 'draft',
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

  const handleSave = async (formData: any) => {
    try {
      console.log('FormBuilderPage handleSave (Publish) called with:', formData);

      const payload = {
        name: formData.name,
        descr: formData.descr,
        form_type: 'multi_step',
        form_schema: formData.form_schema,
        approval_status: 'approved',
      };

      console.log('Publish payload to send:', payload);

      // If we have a draft, update it; otherwise create new
      if (draftFormIdRef.current) {
        console.log('Updating existing draft to published:', draftFormIdRef.current);
        const updated = await formApi.update(draftFormIdRef.current, payload);
        console.log('Form published successfully:', updated);
        navigate(`/form/${updated.id}`);
      } else {
        console.log('Creating new published form');
        const created = await formApi.create(payload);
        console.log('Form published successfully:', created);
        navigate(`/form/${created.id}`);
      }
    } catch (error) {
      console.error('Error in handleSave:', error);
      alert(`Failed to publish form: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  };

  const handleExit = () => {
    navigate('/form');
  };

  return (
    <FormDesigner
      onSave={handleSave}
      onSaveDraft={handleSaveDraft}
      onExit={handleExit}
    />
  );
}

export default FormBuilderPage;
