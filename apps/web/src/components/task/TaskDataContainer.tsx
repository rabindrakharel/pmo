import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, Paperclip, X as XIcon, ZoomIn } from 'lucide-react';

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
}

interface TaskDataContainerProps {
  taskId: string;
  projectId: string;
  onUpdatePosted?: () => void;
}

export function TaskDataContainer({ taskId, projectId, onUpdatePosted }: TaskDataContainerProps) {
  const [updates, setUpdates] = useState<TaskUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [updateType, setUpdateType] = useState<string>('comment');
  const [hoursLogged, setHoursLogged] = useState<string>('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    loadUpdates();

    // Setup global function for image preview
    (window as any).openImagePreview = (url: string, name: string) => {
      setImagePreview({ url, name });
    };

    return () => {
      delete (window as any).openImagePreview;
    };
  }, [taskId]);

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
      const response = await fetch(`http://localhost:4000/api/v1/task/${taskId}/data`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Parse data_richtext from string to object if needed
        const parsedUpdates = (data.data || []).map((update: any) => ({
          ...update,
          data_richtext: typeof update.data_richtext === 'string'
            ? JSON.parse(update.data_richtext)
            : update.data_richtext
        }));
        setUpdates(parsedUpdates);
      }
    } catch (error) {
      console.error('Failed to load task updates:', error);
    } finally {
      setLoading(false);
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
        return <span className="text-gray-500">Invalid content format</span>;
      }
    }

    if (!deltaObj || !deltaObj.ops) {
      return <span className="text-gray-500">-</span>;
    }

    const { html, attachments: attachmentOps } = convertDeltaToHtml(deltaObj);

    return (
      <div className="space-y-3">
        {html && (
          <div
            className="prose prose-sm max-w-none text-gray-700"
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
                        className="max-w-[30vw] md:max-w-xs h-auto rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => setImagePreview({ url: att.dataUrl!, name: displayName })}
                      />
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-black bg-opacity-60 text-white p-1.5 rounded-full">
                          <ZoomIn className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {displayName}
                      {sizeKb && <span className="ml-1 text-gray-400">({sizeKb})</span>}
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
                    className="inline-flex items-center px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-colors"
                  >
                    <Paperclip className="w-4 h-4 mr-2" />
                    <span className="font-medium truncate max-w-[12rem]">{displayName}</span>
                    {sizeKb && <span className="ml-2 text-xs text-blue-500">({sizeKb})</span>}
                  </a>
                );
              }

              return (
                <div
                  key={key}
                  className="inline-flex items-center px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700"
                >
                  <Paperclip className="w-4 h-4 mr-2" />
                  <span className="font-medium truncate max-w-[12rem]">{displayName}</span>
                  {sizeKb && <span className="ml-2 text-xs text-gray-500">({sizeKb})</span>}
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
        if (op.attributes.code) text = `<code class="bg-gray-100 px-1 py-0.5 rounded">${text}</code>`;
        if (op.attributes.link) text = `<a href="${op.attributes.link}" class="text-blue-600 hover:underline" target="_blank">${text}</a>`;
        if (op.attributes.header) text = `<h${op.attributes.header} class="font-semibold mt-4 mb-2">${text}</h${op.attributes.header}>`;
        if (op.attributes['code-block']) text = `<pre class="bg-gray-100 p-2 rounded overflow-x-auto"><code>${text}</code></pre>`;
        if (op.attributes.list === 'bullet') text = `<li class="ml-4">${text}</li>`;
        if (op.attributes.list === 'ordered') text = `<li class="ml-4 list-decimal">${text}</li>`;
        if (op.attributes.mention) {
          text = `<span class="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">@${op.attributes.mention.name}</span>`;
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
              <XIcon className="h-8 w-8" />
            </button>
            <img
              src={imagePreview.url}
              alt={imagePreview.name}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            <div className="mt-4 text-center text-white text-sm">{imagePreview.name}</div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <MessageSquare className="h-5 w-5 text-gray-600" />
          <h2 className="text-sm font-medium text-gray-700">Task Updates & Activity</h2>
          <span className="text-xs text-gray-500">({updates.length})</span>
        </div>
      </div>

      {/* New Update Form */}
      <div className="p-6 border-b border-gray-200 bg-gray-50">
        <div className="space-y-4">
          {/* Update Type Selector */}
          <div className="flex items-center space-x-4">
            <select
              value={updateType}
              onChange={(e) => setUpdateType(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="comment">Comment</option>
              <option value="status_change">Status Change</option>
              <option value="assignment">Assignment</option>
              <option value="attachment">Attachment</option>
            </select>

            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-600">Hours Logged:</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={hoursLogged}
                onChange={(e) => setHoursLogged(e.target.value)}
                placeholder="0.0"
                className="w-20 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Text Editor */}
          <div className="bg-white rounded-lg border border-gray-300">
            <textarea
              value={editorContent}
              onChange={(e) => setEditorContent(e.target.value)}
              placeholder="Write your update... Describe progress, issues, or any relevant information."
              className="w-full min-h-[150px] p-4 text-sm border-0 focus:ring-0 focus:outline-none resize-vertical"
              rows={6}
            />
          </div>

          {/* Attachment Preview */}
          {attachments.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-600">Attachments ({attachments.length})</div>
              <div className="flex flex-wrap gap-2">
                {attachments.map((file, index) => (
                  <div
                    key={index}
                    className="inline-flex items-center px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 group"
                  >
                    <Paperclip className="h-3.5 w-3.5 mr-1.5" />
                    <span className="max-w-[200px] truncate">{file.name}</span>
                    <span className="ml-2 text-xs text-blue-500">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                    <button
                      onClick={() => handleRemoveAttachment(index)}
                      className="ml-2 text-blue-400 hover:text-red-600 transition-colors"
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
              <label className="inline-flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-blue-600 cursor-pointer border border-gray-300 rounded-lg hover:border-blue-400 transition-colors">
                <Paperclip className="h-4 w-4 mr-1.5" />
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
                <span className="text-xs text-blue-600 animate-pulse">Uploading...</span>
              )}
            </div>
            <button
              onClick={handlePostUpdate}
              disabled={posting || (!editorContent.trim() && attachments.length === 0)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="h-4 w-4 mr-2" />
              {posting ? 'Posting...' : 'Post Update'}
            </button>
          </div>
        </div>
      </div>

      {/* Updates List - JIRA-style Activity Feed */}
      <div className="p-6 space-y-3">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading updates...</div>
        ) : updates.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-400" />
            <p className="text-sm">No updates yet. Be the first to add one!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {updates.map((update, index) => (
              <div key={update.id} className="group">
                {/* Comment Card - JIRA style */}
                <div className="flex space-x-3">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-sm font-semibold text-white shadow-sm">
                      {update.updated_by_name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  </div>

                  {/* Comment Content */}
                  <div className="flex-1 min-w-0">
                    {/* Header: Name, Time, Type */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {update.updated_by_name || 'Unknown User'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatRelativeTime(update.created_ts)}
                        </span>
                        {update.hours_logged && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            {update.hours_logged}h logged
                          </span>
                        )}
                      </div>
                      <span className="px-2.5 py-1 text-xs font-medium rounded bg-gray-100 text-gray-600 capitalize">
                        {update.update_type.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Comment Body - White background like JIRA */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 group-hover:border-gray-300 transition-colors">
                      <div className="text-sm text-gray-800 leading-relaxed">
                        {renderRichText(update.data_richtext)}
                      </div>
                    </div>

                    {/* Footer: Timestamp and actions */}
                    <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                      <span>{new Date(update.created_ts).toLocaleString('en-CA', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</span>
                      {update.status_change_from && update.status_change_to && (
                        <span className="flex items-center space-x-1">
                          <span className="font-medium">{update.status_change_from}</span>
                          <span>→</span>
                          <span className="font-medium">{update.status_change_to}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Separator line between comments (except last) */}
                {index < updates.length - 1 && (
                  <div className="mt-4 border-b border-gray-200"></div>
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
