import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, Paperclip, X as XIcon, ZoomIn, FileText, ExternalLink, Table } from 'lucide-react';
import { InteractiveForm } from '../form';
import { Button } from '../../shared/button/Button';

interface TaskUpdate {
  id: string;
  task_id: string;
  project_id: string;
  stage: 'draft' | 'saved';
  updated_by_empid: string;
  data_richtext: any;
  update_type: string;
  hours_logged?: number;
  status_change_from?: string;
  status_change_to?: string;
  created_ts: string;
  updated_ts: string;
  updated_by_name?: string;
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

export function TaskDataContainer({ taskId, projectId, onUpdatePosted, isPublicView = false }: TaskDataContainerProps) {
  const [updates, setUpdates] = useState<TaskUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [updateType, setUpdateType] = useState<string>('comment');
  const [hoursLogged, setHoursLogged] = useState<string>('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ url: string; name: string } | null>(null);

  // Form-based update states
  const [forms, setForms] = useState<any[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [selectedForm, setSelectedForm] = useState<any>(null);
  const [loadingForms, setLoadingForms] = useState(false);

  // Guard: Skip API calls if taskId is invalid
  const isValidTaskId = taskId && taskId !== 'undefined';

  useEffect(() => {
    if (!isValidTaskId) {
      setLoading(false);
      return;
    }
    loadUpdates();
    loadForms();

    // Setup global function for image preview
    (window as any).openImagePreview = (url: string, name: string) => {
      setImagePreview({ url, name });
    };

    return () => {
      delete (window as any).openImagePreview;
    };
  }, [taskId]);

  // Load forms when updateType changes to 'form'
  useEffect(() => {
    if (updateType === 'form' && isValidTaskId) {
      loadForms();
    }
  }, [updateType, isValidTaskId]);

  // Helper function to format relative time (JIRA-style)
  const formatRelativeTime = (timestamp: string): string => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

    // For older, show date
    return then.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const loadUpdates = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};

      // Only add auth header if token exists
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`http://localhost:4000/api/v1/task/${taskId}/data`, {
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        // Parse data_richtext and metadata from string to object if needed
        const parsedUpdates = (data.data || []).map((update: any) => ({
          ...update,
          data_richtext: typeof update.data_richtext === 'string'
            ? JSON.parse(update.data_richtext)
            : update.data_richtext,
          metadata: typeof update.metadata === 'string'
            ? JSON.parse(update.metadata)
            : update.metadata
        }));
        setUpdates(parsedUpdates);
      }
    } catch (error) {
      console.error('Failed to load task updates:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadForms = async () => {
    // Skip loading forms in public view (can't submit anyway)
    if (isPublicView) {
      setLoadingForms(false);
      return;
    }

    setLoadingForms(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`http://localhost:4000/api/v1/task/${taskId}/form`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setForms(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load task forms:', error);
    } finally {
      setLoadingForms(false);
    }
  };

  const handleFormSelect = async (formId: string) => {
    setSelectedFormId(formId);
    if (!formId) {
      setSelectedForm(null);
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`http://localhost:4000/api/v1/form/${formId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const formData = await response.json();
        // Parse form_schema if it's a string
        if (formData.form_schema && typeof formData.form_schema === 'string') {
          formData.form_schema = JSON.parse(formData.form_schema);
        }
        setSelectedForm(formData);
      }
    } catch (error) {
      console.error('Failed to load form details:', error);
    }
  };

  const handleFormSubmitSuccess = async (submissionData: any) => {
    // Step 1: Submit the form data to the form data table
    // Step 2: Create a task update referencing that form submission
    try {
      const token = localStorage.getItem('auth_token');
      const userId = localStorage.getItem('user_id');

      // Step 1: Submit form data to form data table
      console.log('📝 Submitting form data to form table:', { formId: selectedFormId, submissionData });

      const formSubmitResponse = await fetch(`http://localhost:4000/api/v1/form/${selectedFormId}/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          submissionData: submissionData,
          submissionStatus: 'submitted'
        }),
      });

      if (!formSubmitResponse.ok) {
        const errorData = await formSubmitResponse.json();
        throw new Error(`Failed to submit form: ${errorData.error || formSubmitResponse.statusText}`);
      }

      const formSubmitResult = await formSubmitResponse.json();
      const submissionId = formSubmitResult.data?.id || formSubmitResult.id;

      console.log('✅ Form data saved successfully. Submission ID:', submissionId);

      // Step 2: Create task update with reference to form submission
      const deltaOps: any[] = [
        { insert: `Form "${selectedForm?.name}" submitted\n\n`, attributes: { bold: true } },
        { insert: 'Form submission recorded. ', attributes: { italic: true } },
        { insert: `View submission details in the form's data table.\n`, attributes: { italic: true } },
      ];

      const delta = { ops: deltaOps };

      const taskUpdatePayload = {
        task_id: taskId,
        project_id: projectId,
        updated_by_empid: userId,
        data_richtext: delta,
        update_type: 'form',
        hours_logged: hoursLogged ? parseFloat(hoursLogged) : undefined,
        stage: 'saved',
        metadata: {
          form_id: selectedFormId,
          form_name: selectedForm?.name,
          submission_id: submissionId,
          submission_data: submissionData,  // Store the actual form data
          submission_timestamp: new Date().toISOString()
        }
      };

      const taskUpdateResponse = await fetch(`http://localhost:4000/api/v1/task/${taskId}/data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskUpdatePayload),
      });

      if (!taskUpdateResponse.ok) {
        const errorData = await taskUpdateResponse.json();
        throw new Error(`Failed to create task update: ${errorData.error || taskUpdateResponse.statusText}`);
      }

      console.log('✅ Task update created successfully');

      // Reset form state and refresh
      setSelectedFormId('');
      setSelectedForm(null);
      setHoursLogged('');
      await loadUpdates();
      if (onUpdatePosted) onUpdatePosted();

      // Show success message
      alert(`Form submitted successfully! The submission is now available in the form's data table.`);
    } catch (error) {
      console.error('Failed to post form-based update:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to submit form'}`);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachments(prev => [...prev, ...newFiles]);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const uploadAttachments = async (token: string): Promise<any[]> => {
    if (attachments.length === 0) return [];

    const uploadedArtifacts = [];

    for (const file of attachments) {
      try {
        // Convert file to base64 data URL for embedding
        const dataUrl = await fileToDataUrl(file);

        uploadedArtifacts.push({
          id: crypto.randomUUID(),
          name: file.name,
          format: file.type.split('/')[1] || 'file',
          type: file.type,
          dataUrl: dataUrl, // Store the file as base64 data URL
          size: file.size,
          isImage: file.type.startsWith('image/'),
        });
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
      }
    }

    return uploadedArtifacts;
  };

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handlePostUpdate = async () => {
    if (!editorContent.trim() && attachments.length === 0) {
      alert('Please enter a message or attach files');
      return;
    }

    setPosting(true);
    setUploading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const userId = localStorage.getItem('user_id');

      // Upload attachments first
      const uploadedArtifacts = await uploadAttachments(token!);

      // Build Quill Delta with text and attachments
      const deltaOps: any[] = [];

      // Add text content
      if (editorContent.trim()) {
        deltaOps.push({ insert: editorContent + '\n' });
      }

      // Add attachment references
      if (uploadedArtifacts.length > 0) {
        deltaOps.push({ insert: '\nAttachments:\n', attributes: { bold: true } });
        uploadedArtifacts.forEach(artifact => {
          deltaOps.push({
            insert: `📎 ${artifact.name}`,
            attributes: {
              attachment: artifact
            }
          });
          deltaOps.push({ insert: '\n' });
        });
      }

      const delta = { ops: deltaOps };

      const payload = {
        task_id: taskId,
        project_id: projectId,
        updated_by_empid: userId,
        data_richtext: delta,
        update_type: attachments.length > 0 ? 'attachment' : updateType,
        hours_logged: hoursLogged ? parseFloat(hoursLogged) : undefined,
        stage: 'saved',
      };

      const response = await fetch(`http://localhost:4000/api/v1/task/${taskId}/data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setEditorContent('');
        setHoursLogged('');
        setAttachments([]);
        await loadUpdates();
        if (onUpdatePosted) onUpdatePosted();
      } else {
        const error = await response.json();
        alert(`Failed to post update: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to post update:', error);
      alert('Failed to post update');
    } finally {
      setPosting(false);
      setUploading(false);
    }
  };

  type AttachmentOp = {
    id?: string;
    name?: string;
    filename?: string;
    format?: string;
    type?: string;
    dataUrl?: string;
    size?: number;
    isImage?: boolean;
  };

  const renderRichText = (richtext: any) => {
    // Handle string input (parse if needed)
    let deltaObj = richtext;
    if (typeof richtext === 'string') {
      try {
        deltaObj = JSON.parse(richtext);
      } catch (e) {
        console.error('Failed to parse richtext:', e);
        return <span className="text-dark-700">Invalid content format</span>;
      }
    }

    if (!deltaObj || !deltaObj.ops) {
      return <span className="text-dark-700">-</span>;
    }

    const { html, attachments: attachmentOps } = convertDeltaToHtml(deltaObj);

    return (
      <div className="space-y-3">
        {html && (
          <div
            className="prose prose-sm max-w-none text-dark-600"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}

        {attachmentOps.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {attachmentOps.map((att, index) => {
              const key = att.id || att.name || att.filename || `attachment-${index}`;
              const displayName = att.name || att.filename || `Attachment ${index + 1}`;
              const sizeKb = att.size ? `${(att.size / 1024).toFixed(1)} KB` : null;

              if (att.isImage && att.dataUrl) {
                return (
                  <div key={key} className="inline-block">
                    <div className="relative group">
                      <img
                        src={att.dataUrl}
                        alt={displayName}
                        className="max-w-[30vw] md:max-w-xs h-auto rounded-md border border-dark-300 shadow-sm cursor-pointer hover:shadow-sm transition-shadow"
                        onClick={() => setImagePreview({ url: att.dataUrl!, name: displayName })}
                      />
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-black bg-opacity-60 text-white p-1.5 rounded-full">
                          <ZoomIn className="w-4 h-4 stroke-[1.5]" />
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-dark-700 mt-1">
                      {displayName}
                      {sizeKb && <span className="ml-1 text-dark-600">({sizeKb})</span>}
                    </div>
                  </div>
                );
              }

              if (att.dataUrl) {
                return (
                  <a
                    key={key}
                    href={att.dataUrl}
                    download={displayName}
                    className="inline-flex items-center px-3 py-2 bg-dark-100 border border-dark-400 rounded-md text-sm text-dark-700 hover:bg-dark-100 hover:border-dark-500 transition-colors"
                  >
                    <Paperclip className="w-4 h-4 mr-2 stroke-[1.5]" />
                    <span className="font-normal truncate max-w-[12rem]">{displayName}</span>
                    {sizeKb && <span className="ml-2 text-xs text-dark-6000">({sizeKb})</span>}
                  </a>
                );
              }

              return (
                <div
                  key={key}
                  className="inline-flex items-center px-3 py-2 bg-dark-100 border border-dark-300 rounded-md text-sm text-dark-600"
                >
                  <Paperclip className="w-4 h-4 mr-2 stroke-[1.5]" />
                  <span className="font-normal truncate max-w-[12rem]">{displayName}</span>
                  {sizeKb && <span className="ml-2 text-xs text-dark-700">({sizeKb})</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const convertDeltaToHtml = (delta: any): { html: string; attachments: AttachmentOp[] } => {
    if (!delta || !delta.ops) return { html: '', attachments: [] };

    let html = '';
    const attachments: AttachmentOp[] = [];

    delta.ops.forEach((op: any) => {
      let text = op.insert || '';

      if (op.attributes) {
        if (op.attributes.bold) text = `<strong>${text}</strong>`;
        if (op.attributes.italic) text = `<em>${text}</em>`;
        if (op.attributes.underline) text = `<u>${text}</u>`;
        if (op.attributes.strike) text = `<s>${text}</s>`;
        if (op.attributes.code) text = `<code class="bg-dark-100 px-1 py-0.5 rounded">${text}</code>`;
        if (op.attributes.link) text = `<a href="${op.attributes.link}" class="text-dark-700 hover:underline" target="_blank">${text}</a>`;
        if (op.attributes.header) text = `<h${op.attributes.header} class="font-normal mt-4 mb-2">${text}</h${op.attributes.header}>`;
        if (op.attributes['code-block']) text = `<pre class="bg-dark-100 p-2 rounded overflow-x-auto"><code>${text}</code></pre>`;
        if (op.attributes.list === 'bullet') text = `<li class="ml-4">${text}</li>`;
        if (op.attributes.list === 'ordered') text = `<li class="ml-4 list-decimal">${text}</li>`;
        if (op.attributes.mention) {
          text = `<span class="bg-dark-100 text-dark-600 px-1.5 py-0.5 rounded">@${op.attributes.mention.name}</span>`;
        }
        if (op.attributes.attachment) {
          attachments.push(op.attributes.attachment as AttachmentOp);
          return;
        }
      }

      html += text.replace(/\n/g, '<br/>');
    });

    return { html, attachments };
  };

  // Render form submission data in table format
  const renderFormSubmissionData = (metadata: TaskUpdate['metadata']) => {
    if (!metadata || !metadata.submission_data) return null;

    const submissionData = metadata.submission_data;
    const entries = Object.entries(submissionData);

    if (entries.length === 0) return null;

    return (
      <div className="mt-4 space-y-3">
        {/* Link to view/edit submission */}
        {metadata.form_id && metadata.submission_id && (
          <a
            href={`/form/${metadata.form_id}/edit-submission?submissionId=${metadata.submission_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-3 py-2 bg-dark-100 border border-dark-400 rounded-md text-sm text-dark-700 hover:bg-dark-100 hover:border-dark-500 transition-colors"
          >
            <ExternalLink className="h-4 w-4 mr-2 stroke-[1.5]" />
            View/Edit Form Submission
          </a>
        )}

        {/* Submitted Data Table */}
        <div className="bg-dark-100 border border-dark-300 rounded-md overflow-hidden">
          <div className="bg-dark-100 border-b border-dark-300 px-4 py-2 flex items-center space-x-2">
            <Table className="h-4 w-4 text-dark-700 stroke-[1.5]" />
            <span className="text-sm font-normal text-dark-600">Submitted Data</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-dark-400">
              <thead className="bg-dark-100">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-normal text-dark-700 uppercase tracking-wider">
                    Field
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-normal text-dark-700 uppercase tracking-wider">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody className="bg-dark-100 divide-y divide-dark-400">
                {entries.map(([key, value]) => (
                  <tr key={key} className="hover:bg-dark-100">
                    <td className="px-4 py-2 text-sm font-normal text-dark-600 whitespace-nowrap">
                      {key}
                    </td>
                    <td className="px-4 py-2 text-sm text-dark-600">
                      {typeof value === 'object' ? (
                        <pre className="text-xs bg-dark-100 p-2 rounded overflow-x-auto">
                          {JSON.stringify(value, null, 2)}
                        </pre>
                      ) : (
                        <span>{String(value)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Early return if taskId is invalid
  if (!isValidTaskId) {
    return null;
  }

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
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <XIcon className="h-8 w-8 stroke-[1.5]" />
            </button>
            <img
              src={imagePreview.url}
              alt={imagePreview.name}
              className="max-w-full max-h-[85vh] object-contain rounded-md"
            />
            <div className="mt-4 text-center text-white text-sm">{imagePreview.name}</div>
          </div>
        </div>
      )}

      <div className="bg-dark-100 rounded-md border border-dark-300 shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-dark-300">
        <div className="flex items-center space-x-2">
          <MessageSquare className="h-5 w-5 text-dark-700 stroke-[1.5]" />
          <h2 className="text-sm font-normal text-dark-600">Task Updates & Activity</h2>
          <span className="text-xs text-dark-700">({updates.length})</span>
        </div>
      </div>

      {/* New Update Form - Hidden in public view */}
      {!isPublicView && (
      <div className="p-6 border-b border-dark-300 bg-dark-100">
        <div className="space-y-4">
          {/* Update Type Tabs */}
          <div className="space-y-4">
            {/* Tab Buttons */}
            <div className="flex items-center space-x-2 border-b border-dark-400">
              <button
                onClick={() => setUpdateType('comment')}
                className={`px-4 py-2 text-sm font-normal transition-colors border-b-2 ${
                  updateType === 'comment'
                    ? 'border-dark-700 text-dark-700'
                    : 'border-transparent text-dark-700 hover:text-dark-600 hover:border-dark-400'
                }`}
              >
                Comment
              </button>
              <button
                onClick={() => setUpdateType('status_change')}
                className={`px-4 py-2 text-sm font-normal transition-colors border-b-2 ${
                  updateType === 'status_change'
                    ? 'border-dark-700 text-dark-700'
                    : 'border-transparent text-dark-700 hover:text-dark-600 hover:border-dark-400'
                }`}
              >
                Status Change
              </button>
              <button
                onClick={() => setUpdateType('assignment')}
                className={`px-4 py-2 text-sm font-normal transition-colors border-b-2 ${
                  updateType === 'assignment'
                    ? 'border-dark-700 text-dark-700'
                    : 'border-transparent text-dark-700 hover:text-dark-600 hover:border-dark-400'
                }`}
              >
                Assignment
              </button>
              <button
                onClick={() => setUpdateType('attachment')}
                className={`px-4 py-2 text-sm font-normal transition-colors border-b-2 ${
                  updateType === 'attachment'
                    ? 'border-dark-700 text-dark-700'
                    : 'border-transparent text-dark-700 hover:text-dark-600 hover:border-dark-400'
                }`}
              >
                Attachment
              </button>
              <button
                onClick={() => setUpdateType('form')}
                className={`px-4 py-2 text-sm font-normal transition-colors border-b-2 ${
                  updateType === 'form'
                    ? 'border-dark-700 text-dark-700'
                    : 'border-transparent text-dark-700 hover:text-dark-600 hover:border-dark-400'
                }`}
              >
                Form
              </button>
            </div>

            {/* Hours Logged Input */}
            <div className="flex items-center space-x-2">
              <label className="text-sm text-dark-700">Hours Logged:</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={hoursLogged}
                onChange={(e) => setHoursLogged(e.target.value)}
                placeholder="0.0"
                className="w-20 px-3 py-2 text-sm border border-dark-400 rounded-md focus:ring-2 focus:ring-dark-7000 focus:border-dark-3000"
              />
            </div>
          </div>

          {/* Conditional Content: Text Editor or Form Selector */}
          {updateType === 'form' ? (
            // Form Selection and Interactive Form
            <div className="space-y-4">
              {/* Form Selector */}
              <div className="bg-dark-100 rounded-md border border-dark-500 p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <FileText className="h-5 w-5 text-dark-700 stroke-[1.5]" />
                  <label className="text-sm font-normal text-dark-600">Select Form:</label>
                </div>
                {loadingForms ? (
                  <div className="text-sm text-dark-700">Loading forms...</div>
                ) : forms.length === 0 ? (
                  <div className="text-sm text-dark-700 py-3">
                    No forms are linked to this task. Please associate forms with this task first.
                  </div>
                ) : (
                  <select
                    value={selectedFormId}
                    onChange={(e) => handleFormSelect(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-dark-400 rounded-md focus:ring-2 focus:ring-dark-7000 focus:border-dark-3000"
                  >
                    <option value="">Choose a form...</option>
                    {forms.map((form) => (
                      <option key={form.id} value={form.id}>
                        {form.name || 'Untitled Form'}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Interactive Form - Reusing existing component (DRY principle) */}
              {selectedForm && (
                <div className="bg-dark-100 border border-dark-400 rounded-xl p-4">
                  <div className="text-sm font-normal text-dark-600 mb-3 flex items-center space-x-2">
                    <FileText className="h-4 w-4 stroke-[1.5]" />
                    <span>Fill out: {selectedForm.name}</span>
                  </div>
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
            // Text Editor for other update types
            <div className="bg-dark-100 rounded-md border border-dark-400">
              <textarea
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                placeholder="Write your update... Describe progress, issues, or any relevant information."
                className="w-full min-h-[150px] p-4 text-sm border-0 focus:ring-0 focus:outline-none resize-vertical"
                rows={6}
              />
            </div>
          )}

          {/* Attachment Preview */}
          {attachments.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-normal text-dark-700">Attachments ({attachments.length})</div>
              <div className="flex flex-wrap gap-2">
                {attachments.map((file, index) => (
                  <div
                    key={index}
                    className="inline-flex items-center px-3 py-1.5 bg-dark-100 border border-dark-400 rounded-md text-sm text-dark-700 group"
                  >
                    <Paperclip className="h-3.5 w-3.5 mr-1.5 stroke-[1.5]" />
                    <span className="max-w-[200px] truncate">{file.name}</span>
                    <span className="ml-2 text-xs text-dark-6000">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                    <button
                      onClick={() => handleRemoveAttachment(index)}
                      className="ml-2 text-dark-700 hover:text-red-600 transition-colors"
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <label className="inline-flex items-center px-3 py-1.5 text-sm font-normal text-dark-700 hover:text-dark-700 cursor-pointer border border-dark-400 rounded hover:border-dark-600 transition-colors">
                <Paperclip className="h-4 w-4 mr-1.5 stroke-[1.5]" />
                <span>Attach files</span>
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="*/*"
                />
              </label>
              {uploading && (
                <span className="text-xs text-dark-700 animate-pulse">Uploading...</span>
              )}
            </div>
            <Button
              variant="primary"
              onClick={handlePostUpdate}
              disabled={posting || (!editorContent.trim() && attachments.length === 0)}
              icon={Send}
            >
              {posting ? 'Posting...' : 'Post Update'}
            </Button>
          </div>
        </div>
      </div>
      )}

      {/* Updates List - JIRA-style Activity Feed */}
      <div className="p-6 space-y-3">
        {loading ? (
          <div className="text-center py-8 text-dark-700">Loading updates...</div>
        ) : updates.length === 0 ? (
          <div className="text-center py-8 text-dark-700">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 text-dark-600 stroke-[1.5]" />
            <p className="text-sm">{isPublicView ? 'No updates available.' : 'No updates yet. Be the first to add one!'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {updates.map((update, index) => (
              <div key={update.id} className="group">
                {/* Comment Card - JIRA style */}
                <div className="flex space-x-3">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-dark-100 rounded-full flex items-center justify-center text-sm font-normal text-dark-700 shadow-sm">
                      {update.updated_by_name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  </div>

                  {/* Comment Content */}
                  <div className="flex-1 min-w-0">
                    {/* Header: Name, Time, Type */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-normal text-dark-600">
                          {update.updated_by_name || 'Unknown User'}
                        </span>
                        <span className="text-xs text-dark-700">
                          {formatRelativeTime(update.created_ts)}
                        </span>
                        {update.hours_logged && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-normal bg-green-100 text-green-800">
                            {update.hours_logged}h logged
                          </span>
                        )}
                      </div>
                      <span className="px-2.5 py-1 text-xs font-normal rounded bg-dark-100 text-dark-700 capitalize">
                        {update.update_type.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Comment Body - White background like JIRA */}
                    <div className="bg-dark-100 border border-dark-300 rounded-md p-4 group-hover:border-dark-400 transition-colors">
                      <div className="text-sm text-dark-600 leading-relaxed">
                        {renderRichText(update.data_richtext)}
                      </div>

                      {/* Form Submission Data - Only show for form type updates */}
                      {update.update_type === 'form' && renderFormSubmissionData(update.metadata)}
                    </div>

                    {/* Footer: Timestamp and actions */}
                    <div className="mt-2 flex items-center space-x-4 text-xs text-dark-700">
                      <span>{new Date(update.created_ts).toLocaleString('en-CA', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</span>
                      {update.status_change_from && update.status_change_to && (
                        <span className="flex items-center space-x-1">
                          <span className="font-normal">{update.status_change_from}</span>
                          <span>→</span>
                          <span className="font-normal">{update.status_change_to}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Separator line between comments (except last) */}
                {index < updates.length - 1 && (
                  <div className="mt-4 border-b border-dark-300"></div>
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
