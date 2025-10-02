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

    // Build comprehensive form metadata
    const payload = {
      name: formData.name,
      descr: formData.descr,
      taskSpecific: formData.taskSpecific,
      taskId: formData.taskId,

      // Form configuration
      formType: 'multi_step',
      isTemplate: false,
      isDraft: false,

      // Complete form structure with steps and fields
      formBuilderSchema: {
        steps: formData.schema?.steps || [],
        stepConfiguration: {
          allowStepSkipping: false,
          showStepProgress: true,
          saveProgressOnStepChange: true,
          validateOnStepChange: true,
          stepTransition: 'slide'
        },
        navigation: {
          showPreviousButton: true,
          showNextButton: true,
          previousButtonText: 'Back',
          nextButtonText: 'Next',
          submitButtonText: 'Submit',
          showStepNumbers: true
        }
      },

      // Form builder state for editing
      formBuilderState: {
        currentStepIndex: 0,
        activeFieldId: null,
        lastModified: new Date().toISOString(),
        modifiedBy: userId,
        fieldSequence: formData.fieldSequence || []
      },

      // Step configuration
      stepConfiguration: {
        totalSteps: formData.totalSteps || 1,
        allowStepSkipping: false,
        showStepProgress: true,
        saveProgressOnStepChange: true,
        validateOnStepChange: true,
        stepTransition: 'slide',
        currentStepIndex: 0
      },

      // Validation rules
      validationRules: {
        requiredFields: (formData.schema?.steps || [])
          .flatMap((s: any) => s.fields || [])
          .filter((f: any) => f.required)
          .map((f: any) => f.id || f.name),
        customValidators: [],
        globalRules: []
      },

      // Submission configuration
      submissionConfig: {
        allowDraft: true,
        autoSaveInterval: 30000,
        requireAuthentication: true,
        allowAnonymous: false,
        confirmationMessage: 'Thank you for your submission!',
        redirectUrl: '/form',
        emailNotifications: {
          enabled: false,
          recipients: [],
          template: null,
          ccClient: false
        }
      },

      // Workflow configuration
      workflowConfig: {
        requiresApproval: false,
        approvers: [],
        approvalStages: []
      },

      // Access control
      accessConfig: {
        visibility: 'private',
        allowedRoles: [],
        allowedUsers: [],
        expiresAt: null
      },

      // Analytics and metadata
      metadata: {
        category: taskId ? 'task_form' : 'general',
        department: null,
        estimatedCompletionTime: null,
        completionRate: 0,
        averageCompletionTime: 0,
        totalSubmissions: 0,
        createdBy: userId,
        createdByName: userName,
        tags: formData.tags || []
      },

      // Version control
      versionMetadata: {
        version: 1,
        previousVersionId: null,
        changeLog: [
          {
            version: 1,
            changedBy: userId,
            changedAt: new Date().toISOString(),
            changes: 'Initial form creation'
          }
        ]
      }
    };

    const created = await formApi.create(payload);
    navigate(`/form/${created.id}`);
  };

  const handleSaveDraft = async (formData: any) => {
    const userId = localStorage.getItem('user_id') || undefined;
    const userName = localStorage.getItem('user_name') || undefined;

    // Build draft with partial metadata
    const payload = {
      name: formData.name || 'Untitled Form (Draft)',
      descr: formData.descr,
      taskSpecific: formData.taskSpecific,
      taskId: formData.taskId,

      formType: 'multi_step',
      isTemplate: false,
      isDraft: true,

      formBuilderSchema: {
        steps: formData.schema?.steps || [],
        stepConfiguration: {
          allowStepSkipping: false,
          showStepProgress: true,
          saveProgressOnStepChange: true,
          validateOnStepChange: true,
          stepTransition: 'slide'
        },
        navigation: {
          showPreviousButton: true,
          showNextButton: true,
          previousButtonText: 'Back',
          nextButtonText: 'Next',
          submitButtonText: 'Submit',
          showStepNumbers: true
        }
      },

      formBuilderState: {
        currentStepIndex: formData.schema?.currentStepIndex || 0,
        activeFieldId: null,
        lastModified: new Date().toISOString(),
        modifiedBy: userId,
        fieldSequence: formData.fieldSequence || []
      },

      stepConfiguration: {
        totalSteps: formData.totalSteps || 1,
        allowStepSkipping: false,
        showStepProgress: true,
        saveProgressOnStepChange: true,
        validateOnStepChange: true,
        stepTransition: 'slide',
        currentStepIndex: formData.schema?.currentStepIndex || 0
      },

      metadata: {
        category: 'draft',
        createdBy: userId,
        createdByName: userName,
        tags: ['draft']
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
