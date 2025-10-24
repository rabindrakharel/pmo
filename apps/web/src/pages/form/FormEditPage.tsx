import React, { useEffect, useState } from 'react';
import { Share2, Link as LinkIcon } from 'lucide-react';
import { Layout } from '../../components/shared';
import { ShareModal } from '../../components/shared/modal';
import { UnifiedLinkageModal } from '../../components/shared/modal/UnifiedLinkageModal';
import { useLinkageModal } from '../../hooks/useLinkageModal';
import { useNavigate, useParams } from 'react-router-dom';
import { formApi } from '../../lib/api';
import { AdvancedFormBuilder } from '../../components/entity/form/AdvancedFormBuilder';

export function FormEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<any>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Unified linkage modal
  const linkageModal = useLinkageModal({
    onLinkageChange: () => {
      // Optionally refetch form data
      console.log('Form linkage changed');
    }
  });

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

  const handleSave = async (formData: any) => {
    if (!id) return;

    try {
      console.log('FormEditPage handleSave called with:', formData);

      // Clean payload to match backend schema - only include fields backend accepts
      const payload = {
        name: formData.name,
        descr: formData.descr,
        form_type: 'multi_step',
        form_schema: formData.form_schema // Backend expects this as object, will stringify it
      };

      console.log('Edit payload to send:', payload);
      console.log('form_schema type:', typeof payload.form_schema);
      console.log('form_schema:', JSON.stringify(payload.form_schema, null, 2));

      // Update returns the new form (may be a new version with new ID)
      const updatedForm = await formApi.update(id, payload);
      console.log('Form updated successfully:', updatedForm);

      // Navigate to the new version ID
      navigate(`/form/${updatedForm.id}`);
    } catch (error) {
      console.error('Error in handleSave:', error);
      alert(`Failed to save form: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  };

  const handleSaveDraft = async (formData: any) => {
    if (!id) return;

    try {
      console.log('FormEditPage handleSaveDraft called with:', formData);

      // Clean payload to match backend schema
      const payload = {
        name: formData.name || 'Untitled Form (Draft)',
        descr: formData.descr,
        form_type: 'multi_step',
        form_schema: formData.form_schema
      };

      console.log('Draft edit payload to send:', payload);

      // Draft saves also go through update, which may create new version
      const updatedForm = await formApi.update(id, payload);
      console.log('Draft saved successfully:', updatedForm);

      // Update the form data to reflect the new version
      if (updatedForm.id !== id) {
        // New version was created, update the URL silently
        window.history.replaceState(null, '', `/form/${updatedForm.id}/edit`);
        setFormData(updatedForm);
      }
    } catch (error) {
      console.error('Error in handleSaveDraft:', error);
      // Don't alert for draft errors, just log them
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
        headerActions={
          <>
            <button
              onClick={() => linkageModal.openAssignParent({
                childEntityType: 'form',
                childEntityId: id!,
                childEntityName: formData?.name
              })}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Manage links"
            >
              <LinkIcon className="h-5 w-5 text-gray-600 stroke-[1.5]" />
            </button>
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Share"
            >
              <Share2 className="h-5 w-5 text-gray-600 stroke-[1.5]" />
            </button>
          </>
        }
      />

      {/* Share Modal */}
      {id && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          entityType="form"
          entityId={id}
          entityName={formData?.name}
          currentSharedUrl={formData?.shared_url}
          onShare={async (shareData) => {
            console.log('Sharing form:', shareData);
            // Handle sharing logic
          }}
        />
      )}

      {/* Unified Linkage Modal */}
      <UnifiedLinkageModal {...linkageModal.modalProps} />
    </Layout>
  );
}

export default FormEditPage;
