import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { AdvancedFormBuilder } from '../components/forms/AdvancedFormBuilder';
import { formApi } from '../lib/api';

export function FormBuilderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const taskId = searchParams.get('taskId') || undefined;

  const handleSave = async (formData: any) => {
    const userId = localStorage.getItem('user_id') || undefined;
    const userName = localStorage.getItem('user_name') || undefined;

    // Simplified payload
    const payload = {
      name: formData.name,
      descr: formData.descr,
      taskId: formData.taskId,
      formType: 'multi_step',
      isTemplate: false,
      isDraft: false,
      schema: formData.schema, // Simple nested JSONB with steps array
      uiSchema: {},
      allowMultipleSubmissions: true,
      requireAuthentication: true,
      autoSaveEnabled: true,
      workflowConfig: { requiresApproval: false, approvers: [], approvalStages: [] },
      notificationSettings: {},
      accessControl: { visibility: 'private', allowedRoles: [], allowedUsers: [], expiresAt: null },
      metadata: {
        category: formData.taskId ? 'task_form' : 'general',
        department: null,
        estimatedCompletionTime: null,
        completionRate: 0,
        averageCompletionTime: 0,
        totalSubmissions: 0,
        createdBy: userId,
        createdByName: userName
      },
      version: 1
    };

    const created = await formApi.create(payload);
    navigate(`/form/${created.id}`);
  };

  const handleSaveDraft = async (formData: any) => {
    const userId = localStorage.getItem('user_id') || undefined;
    const userName = localStorage.getItem('user_name') || undefined;

    const payload = {
      name: formData.name || 'Untitled Form (Draft)',
      descr: formData.descr,
      taskId: formData.taskId,
      formType: 'multi_step',
      isTemplate: false,
      isDraft: true,
      schema: formData.schema,
      uiSchema: {},
      metadata: {
        category: 'draft',
        createdBy: userId,
        createdByName: userName
      }
    };

    await formApi.create(payload);
    console.log('Draft saved successfully');
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
