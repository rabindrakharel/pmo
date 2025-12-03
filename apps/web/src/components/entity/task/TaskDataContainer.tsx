import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Pin, Filter, X as XIcon, FileText, ExternalLink, Table } from 'lucide-react';
import { InteractiveForm } from '../form';
import { SmartComposer } from './SmartComposer';
import { ThreadedComment } from './ThreadedComment';
import { useRefDataEntityInstanceOptions } from '@/lib/hooks/useRefDataEntityInstance';

/**
 * TaskDataContainer v2.0 - Next-Gen Activity Feed
 *
 * Features:
 * - Threading: Nested replies with collapse/expand
 * - Reactions: Emoji reactions with toggle
 * - Pinning: Pin important updates to top
 * - Resolution: Mark threads as resolved
 * - S3 Attachments: Normalized S3 storage (no base64)
 * - Smart Composer: Unified input with intent detection
 */

interface S3Attachment {
  s3_bucket: string;
  s3_key: string;
  filename: string;
  content_type?: string;
  size_bytes?: number;
  uploaded_by__employee_id?: string;
  uploaded_ts?: string;
}

interface TaskUpdate {
  id: string;
  task_id: string;
  task_data_id: string | null;
  stage: 'draft' | 'saved';
  updated_by__employee_id: string;
  data_richtext: any;
  update_type: string;
  hours_logged?: number;
  status_change_from?: string;
  status_change_to?: string;
  mentioned__employee_ids?: string[];
  reactions_data: Record<string, string[]> | string;
  pinned_flag: boolean;
  pinned_by__employee_id?: string;
  pinned_ts?: string;
  resolved_flag: boolean;
  resolved_by__employee_id?: string;
  resolved_ts?: string;
  attachments: S3Attachment[] | string;
  detected_intents_data?: Record<string, any>;
  created_ts: string;
  updated_ts: string;
  updated_by_name?: string;
  reply_count?: number;
  metadata?: {
    form_id?: string;
    form_name?: string;
    submission_id?: string;
    submission_data?: Record<string, any>;
    submission_timestamp?: string;
  };
}

interface TaskDataContainerProps {
  taskId: string;
  projectId?: string;
  onUpdatePosted?: () => void;
  isPublicView?: boolean;
}

const API_BASE_URL = 'http://localhost:4000';

export function TaskDataContainer({ taskId, projectId, onUpdatePosted, isPublicView = false }: TaskDataContainerProps) {
  // Data state
  const [updates, setUpdates] = useState<TaskUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinnedCount, setPinnedCount] = useState(0);
  const [unresolvedCount, setUnresolvedCount] = useState(0);

  // Reply state
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, TaskUpdate[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<Record<string, boolean>>({});

  // Filter state
  const [filter, setFilter] = useState<'all' | 'pinned' | 'unresolved'>('all');

  // Form state (for form-type updates)
  const [showFormSelector, setShowFormSelector] = useState(false);
  const [forms, setForms] = useState<any[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [selectedForm, setSelectedForm] = useState<any>(null);
  const [loadingForms, setLoadingForms] = useState(false);

  // Employee names for reaction tooltips (cached via TanStack Query)
  const { lookup: employeeNames } = useRefDataEntityInstanceOptions('employee');

  // Image preview modal
  const [imagePreview, setImagePreview] = useState<{ url: string; name: string } | null>(null);

  const isValidTaskId = taskId && taskId !== 'undefined';
  const currentUserId = localStorage.getItem('user_id') || '';

  // Load updates
  const loadUpdates = useCallback(async () => {
    if (!isValidTaskId) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const params = new URLSearchParams();
      if (filter === 'pinned') params.append('pinned_only', 'true');
      if (filter === 'unresolved') params.append('unresolved_only', 'true');

      const response = await fetch(`${API_BASE_URL}/api/v1/task/${taskId}/data?${params}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });

      if (response.ok) {
        const data = await response.json();
        setUpdates(data.data || []);
        setPinnedCount(data.pinned_count || 0);
        setUnresolvedCount(data.unresolved_count || 0);
      }
    } catch (error) {
      console.error('Failed to load task updates:', error);
    } finally {
      setLoading(false);
    }
  }, [taskId, filter, isValidTaskId]);

  useEffect(() => {
    if (isValidTaskId) {
      loadUpdates();
    } else {
      setLoading(false);
    }
  }, [isValidTaskId, loadUpdates]);

  // Load replies for a comment
  const loadReplies = async (parentId: string) => {
    setLoadingReplies(prev => ({ ...prev, [parentId]: true }));
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/v1/task/${taskId}/data/${parentId}/replies`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });

      if (response.ok) {
        const data = await response.json();
        setReplies(prev => ({ ...prev, [parentId]: data.data || [] }));
      }
    } catch (error) {
      console.error('Failed to load replies:', error);
    } finally {
      setLoadingReplies(prev => ({ ...prev, [parentId]: false }));
    }
  };

  // Handle new comment/reply submission
  const handleSubmit = async (data: {
    content: string;
    hoursLogged?: number;
    attachments: S3Attachment[];
    mentionedEmployeeIds: string[];
    detectedIntents: Record<string, any>;
  }, parentDataId?: string | null) => {
    const token = localStorage.getItem('auth_token');

    const payload = {
      task_id: taskId,
      task_data_id: parentDataId || null,
      data_richtext: { ops: [{ insert: data.content + '\n' }] },
      update_type: parentDataId ? 'reply' : 'comment',
      hours_logged: data.hoursLogged,
      stage: 'saved',
      mentioned__employee_ids: data.mentionedEmployeeIds,
      attachments: data.attachments,
      detected_intents_data: data.detectedIntents,
    };

    const response = await fetch(`${API_BASE_URL}/api/v1/task/${taskId}/data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Failed to post update');
    }

    // Refresh data
    await loadUpdates();
    if (parentDataId) {
      await loadReplies(parentDataId);
    }
    setReplyingTo(null);
    if (onUpdatePosted) onUpdatePosted();
  };

  // Handle reaction toggle
  const handleReact = async (dataId: string, emoji: string) => {
    const token = localStorage.getItem('auth_token');
    await fetch(`${API_BASE_URL}/api/v1/task/${taskId}/data/${dataId}/react`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emoji }),
    });
    await loadUpdates();
  };

  // Handle pin toggle
  const handlePin = async (dataId: string) => {
    const token = localStorage.getItem('auth_token');
    await fetch(`${API_BASE_URL}/api/v1/task/${taskId}/data/${dataId}/pin`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    await loadUpdates();
  };

  // Handle resolve toggle
  const handleResolve = async (dataId: string) => {
    const token = localStorage.getItem('auth_token');
    await fetch(`${API_BASE_URL}/api/v1/task/${taskId}/data/${dataId}/resolve`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    await loadUpdates();
  };

  // Load forms for form-type updates
  const loadForms = async () => {
    if (isPublicView) return;
    setLoadingForms(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/v1/task/${taskId}/form`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setForms(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load forms:', error);
    } finally {
      setLoadingForms(false);
    }
  };

  // Handle form selection
  const handleFormSelect = async (formId: string) => {
    setSelectedFormId(formId);
    if (!formId) {
      setSelectedForm(null);
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/v1/form/${formId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const formData = await response.json();
        if (formData.form_schema && typeof formData.form_schema === 'string') {
          formData.form_schema = JSON.parse(formData.form_schema);
        }
        setSelectedForm(formData);
      }
    } catch (error) {
      console.error('Failed to load form:', error);
    }
  };

  // Handle form submission
  const handleFormSubmitSuccess = async (submissionData: any) => {
    try {
      const token = localStorage.getItem('auth_token');
      const userId = localStorage.getItem('user_id');

      // Submit form data
      const formSubmitResponse = await fetch(`${API_BASE_URL}/api/v1/form/${selectedFormId}/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ submissionData, submissionStatus: 'submitted' }),
      });

      if (!formSubmitResponse.ok) throw new Error('Failed to submit form');
      const formSubmitResult = await formSubmitResponse.json();
      const submissionId = formSubmitResult.data?.id || formSubmitResult.id;

      // Create task update with form reference
      const deltaOps = [
        { insert: `Form "${selectedForm?.name}" submitted\n\n`, attributes: { bold: true } },
        { insert: 'Form submission recorded.\n', attributes: { italic: true } },
      ];

      const payload = {
        task_id: taskId,
        data_richtext: { ops: deltaOps },
        update_type: 'form',
        stage: 'saved',
        metadata: {
          form_id: selectedFormId,
          form_name: selectedForm?.name,
          submission_id: submissionId,
          submission_data: submissionData,
          submission_timestamp: new Date().toISOString(),
        },
      };

      await fetch(`${API_BASE_URL}/api/v1/task/${taskId}/data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      setSelectedFormId('');
      setSelectedForm(null);
      setShowFormSelector(false);
      await loadUpdates();
      if (onUpdatePosted) onUpdatePosted();
    } catch (error) {
      console.error('Failed to submit form:', error);
      alert('Failed to submit form');
    }
  };


  if (!isValidTaskId) return null;

  // Separate pinned and non-pinned updates
  const pinnedUpdates = updates.filter(u => u.pinned_flag);
  const regularUpdates = updates.filter(u => !u.pinned_flag);

  return (
    <>
      {/* Image Preview Modal */}
      {imagePreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
          onClick={() => setImagePreview(null)}
        >
          <div className="relative max-w-7xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setImagePreview(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              <XIcon className="h-8 w-8" />
            </button>
            <img
              src={imagePreview.url}
              alt={imagePreview.name}
              className="max-w-full max-h-[85vh] object-contain rounded-md"
            />
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-dark-200 shadow-sm">
        {/* Header */}
        <div className="px-6 py-4 border-b border-dark-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-dark-500" />
              <h2 className="text-sm font-medium text-dark-800">Activity Feed</h2>
              <span className="text-xs text-dark-500 bg-dark-100 px-2 py-0.5 rounded-full">
                {updates.length}
              </span>
              {pinnedCount > 0 && (
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Pin className="w-3 h-3" />
                  {pinnedCount} pinned
                </span>
              )}
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  filter === 'all' ? 'bg-dark-800 text-white' : 'text-dark-600 hover:bg-dark-100'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('pinned')}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  filter === 'pinned' ? 'bg-amber-500 text-white' : 'text-dark-600 hover:bg-dark-100'
                }`}
              >
                Pinned
              </button>
              <button
                onClick={() => setFilter('unresolved')}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  filter === 'unresolved' ? 'bg-blue-500 text-white' : 'text-dark-600 hover:bg-dark-100'
                }`}
              >
                Open ({unresolvedCount})
              </button>
            </div>
          </div>
        </div>

        {/* New Update Form - Hidden in public view */}
        {!isPublicView && !replyingTo && (
          <div className="p-6 border-b border-dark-200 bg-dark-50/50">
            {showFormSelector ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-dark-500" />
                    <span className="text-sm font-medium">Submit Form</span>
                  </div>
                  <button
                    onClick={() => { setShowFormSelector(false); setSelectedForm(null); }}
                    className="text-dark-500 hover:text-dark-700"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                </div>

                {loadingForms ? (
                  <div className="text-sm text-dark-500">Loading forms...</div>
                ) : forms.length === 0 ? (
                  <div className="text-sm text-dark-500">No forms linked to this task.</div>
                ) : (
                  <select
                    value={selectedFormId}
                    onChange={(e) => handleFormSelect(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-dark-300 rounded-md"
                  >
                    <option value="">Choose a form...</option>
                    {forms.map((form) => (
                      <option key={form.id} value={form.id}>{form.name || 'Untitled Form'}</option>
                    ))}
                  </select>
                )}

                {selectedForm && (
                  <div className="border border-dark-300 rounded-lg p-4 bg-white">
                    <InteractiveForm
                      formId={selectedFormId}
                      fields={(() => {
                        const schema = selectedForm.form_schema || {};
                        const steps = schema.steps || [];
                        return steps.flatMap((step: any) =>
                          (step.fields || []).map((field: any) => ({
                            ...field,
                            id: field.id || field.name || crypto.randomUUID(),
                            stepId: step.id
                          }))
                        );
                      })()}
                      steps={selectedForm.form_schema?.steps || []}
                      skipApiSubmission={true}
                      onSubmitSuccess={handleFormSubmitSuccess}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <SmartComposer
                  taskId={taskId}
                  onSubmit={(data) => handleSubmit(data)}
                  placeholder="Write an update... Use @name to mention, +2h for time logging"
                />
                <button
                  onClick={() => { setShowFormSelector(true); loadForms(); }}
                  className="text-xs text-dark-500 hover:text-dark-700 flex items-center gap-1"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Submit a form instead
                </button>
              </div>
            )}
          </div>
        )}

        {/* Updates List */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8 text-dark-500">Loading updates...</div>
          ) : updates.length === 0 ? (
            <div className="text-center py-8 text-dark-500">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 text-dark-300" />
              <p className="text-sm">
                {isPublicView ? 'No updates available.' : 'No updates yet. Be the first to add one!'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Pinned Section */}
              {filter === 'all' && pinnedUpdates.length > 0 && (
                <div className="space-y-4">
                  <div className="text-xs font-medium text-amber-600 flex items-center gap-1">
                    <Pin className="w-3.5 h-3.5" />
                    Pinned
                  </div>
                  {pinnedUpdates.map((update) => (
                    <div key={update.id}>
                      <ThreadedComment
                        update={update}
                        currentUserId={currentUserId}
                        canEdit={!isPublicView}
                        onReply={(parentId) => setReplyingTo(parentId)}
                        onReact={handleReact}
                        onPin={handlePin}
                        onResolve={handleResolve}
                        onLoadReplies={loadReplies}
                        replies={replies[update.id]}
                        repliesLoading={loadingReplies[update.id]}
                        employeeNames={employeeNames}
                      />
                      {replyingTo === update.id && (
                        <div className="mt-3 ml-11">
                          <SmartComposer
                            taskId={taskId}
                            parentDataId={update.id}
                            onSubmit={(data) => handleSubmit(data, update.id)}
                            onCancel={() => setReplyingTo(null)}
                            placeholder="Write a reply..."
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  {regularUpdates.length > 0 && (
                    <div className="border-b border-dark-200 my-4" />
                  )}
                </div>
              )}

              {/* Regular Updates */}
              {(filter === 'all' ? regularUpdates : updates).map((update, index) => (
                <div key={update.id}>
                  <ThreadedComment
                    update={update}
                    currentUserId={currentUserId}
                    canEdit={!isPublicView}
                    onReply={(parentId) => setReplyingTo(parentId)}
                    onReact={handleReact}
                    onPin={handlePin}
                    onResolve={handleResolve}
                    onLoadReplies={loadReplies}
                    replies={replies[update.id]}
                    repliesLoading={loadingReplies[update.id]}
                    employeeNames={employeeNames}
                  />
                  {replyingTo === update.id && (
                    <div className="mt-3 ml-11">
                      <SmartComposer
                        taskId={taskId}
                        parentDataId={update.id}
                        onSubmit={(data) => handleSubmit(data, update.id)}
                        onCancel={() => setReplyingTo(null)}
                        placeholder="Write a reply..."
                      />
                    </div>
                  )}
                  {index < (filter === 'all' ? regularUpdates : updates).length - 1 && (
                    <div className="border-b border-dark-100 my-4" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
