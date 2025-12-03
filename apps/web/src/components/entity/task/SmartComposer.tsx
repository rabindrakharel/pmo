import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Clock,
  AtSign,
  X as XIcon,
  Loader2,
  Image as ImageIcon,
  FileText,
  Search,
} from 'lucide-react';
import { useS3Upload } from '@/lib/hooks/useS3Upload';
import { Button } from '@/components/shared/button/Button';
import { useRefDataEntityInstanceOptions } from '@/lib/hooks/useRefDataEntityInstance';

/**
 * SmartComposer - Unified input with intent detection (Linear/Notion style)
 *
 * Features:
 * - Auto-detect time entries (e.g., "2h", "30m", "+1.5h")
 * - @mention autocomplete
 * - S3 file upload with drag-drop
 * - Rich text preview
 * - Detected intents shown as chips
 */

interface SmartComposerProps {
  taskId: string;
  parentDataId?: string | null; // For replies
  onSubmit: (data: {
    content: string;
    hoursLogged?: number;
    attachments: Array<{
      s3_bucket: string;
      s3_key: string;
      filename: string;
      content_type: string;
      size_bytes: number;
      uploaded_by__employee_id: string;
      uploaded_ts: string;
    }>;
    mentionedEmployeeIds: string[];
    detectedIntents: Record<string, any>;
  }) => Promise<void>;
  onCancel?: () => void;
  placeholder?: string;
  disabled?: boolean;
}

interface DetectedIntent {
  type: 'time_entry' | 'status_change' | 'mention';
  value: any;
  display: string;
}

// Time entry patterns
const TIME_PATTERNS = [
  { regex: /\+?(\d+(?:\.\d+)?)\s*h(?:ours?)?/gi, unit: 'hours' },
  { regex: /\+?(\d+(?:\.\d+)?)\s*m(?:in(?:utes?)?)?/gi, unit: 'minutes' },
];

// Parse time entries from text
const parseTimeEntries = (text: string): number | null => {
  let totalHours = 0;
  let found = false;

  for (const { regex, unit } of TIME_PATTERNS) {
    const matches = text.matchAll(regex);
    for (const match of matches) {
      found = true;
      const value = parseFloat(match[1]);
      if (unit === 'hours') {
        totalHours += value;
      } else if (unit === 'minutes') {
        totalHours += value / 60;
      }
    }
  }

  return found ? Math.round(totalHours * 100) / 100 : null;
};

// Parse @mentions from text - extracts UUIDs from @[Name](uuid) format
const parseMentionIds = (text: string): string[] => {
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const uuids: string[] = [];
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    uuids.push(match[2]); // Extract UUID from (uuid)
  }
  return uuids;
};

// Parse @mention names for display (both formats: @name and @[Name](uuid))
const parseMentionNames = (text: string): string[] => {
  const names: string[] = [];
  // Match @[Name](uuid) format
  const linkedRegex = /@\[([^\]]+)\]\([^)]+\)/g;
  let match;
  while ((match = linkedRegex.exec(text)) !== null) {
    names.push(match[1]);
  }
  // Also match simple @name format (partial typing)
  const simpleRegex = /@(\w+(?:\s\w+)*)/g;
  while ((match = simpleRegex.exec(text)) !== null) {
    if (!names.includes(match[1])) {
      names.push(match[1]);
    }
  }
  return names;
};

export function SmartComposer({
  taskId,
  parentDataId,
  onSubmit,
  onCancel,
  placeholder = 'Write an update... (Use @name to mention, +2h for time)',
  disabled = false,
}: SmartComposerProps) {
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [detectedIntents, setDetectedIntents] = useState<DetectedIntent[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadToS3, uploadingFiles, uploadProgress, errors, isUploading } = useS3Upload();

  // Load cached employee options for @mentions
  const { options: employeeOptions, lookup: employeeLookup, isLoading: employeesLoading } = useRefDataEntityInstanceOptions('employee');

  // Detect intents as user types
  useEffect(() => {
    const intents: DetectedIntent[] = [];

    // Detect time entries
    const hours = parseTimeEntries(content);
    if (hours !== null && hours > 0) {
      intents.push({
        type: 'time_entry',
        value: hours,
        display: `${hours}h logged`,
      });
    }

    // Detect mentions (show names for display)
    const mentionIds = parseMentionIds(content);
    mentionIds.forEach(id => {
      const name = employeeLookup[id] || 'Unknown';
      intents.push({
        type: 'mention',
        value: id,
        display: `@${name}`,
      });
    });

    setDetectedIntents(intents);
  }, [content, employeeLookup]);

  // Handle @ key for mentions
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === '@') {
      setShowMentions(true);
      setMentionSearch('');
    } else if (e.key === 'Escape') {
      setShowMentions(false);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Handle text changes
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);

    // Update mention search if @ mode active
    if (showMentions) {
      const atIndex = value.lastIndexOf('@');
      if (atIndex !== -1) {
        const search = value.substring(atIndex + 1).split(/\s/)[0];
        setMentionSearch(search);
      } else {
        setShowMentions(false);
      }
    }
  };

  // Handle mention selection (option = { value: uuid, label: name })
  const handleMentionSelect = (option: { value: string; label: string }) => {
    const atIndex = content.lastIndexOf('@');
    if (atIndex !== -1) {
      const beforeAt = content.substring(0, atIndex);
      const afterMention = content.substring(atIndex).replace(/@\w*/, '');
      // Insert name with UUID marker for later resolution
      setContent(`${beforeAt}@[${option.label}](${option.value})${afterMention} `);
    }
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  // Handle drag and drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
      setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
    }
  };

  // Remove file
  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Submit handler
  const handleSubmit = async () => {
    if (disabled || submitting || (!content.trim() && files.length === 0)) return;

    setSubmitting(true);
    try {
      const userId = localStorage.getItem('user_id') || '';

      // Upload files to S3
      const uploadedAttachments = [];
      for (const file of files) {
        const objectKey = await uploadToS3({
          entityCode: 'task_data',
          entityId: taskId,
          file,
          fileName: file.name,
          contentType: file.type,
          uploadType: 'file',
          fieldName: file.name,
        });

        if (objectKey) {
          uploadedAttachments.push({
            s3_bucket: 'pmo-attachments', // Default bucket
            s3_key: objectKey,
            filename: file.name,
            content_type: file.type,
            size_bytes: file.size,
            uploaded_by__employee_id: userId,
            uploaded_ts: new Date().toISOString(),
          });
        }
      }

      // Extract detected values
      const hours = parseTimeEntries(content);
      const mentionedIds = parseMentionIds(content); // UUIDs already embedded in content

      // Build detected intents for storage
      const intentsData: Record<string, any> = {};
      if (hours) intentsData.time_entry = { hours };
      if (mentionedIds.length) intentsData.mentions = mentionedIds;

      await onSubmit({
        content,
        hoursLogged: hours || undefined,
        attachments: uploadedAttachments,
        mentionedEmployeeIds: mentionedIds,
        detectedIntents: intentsData,
      });

      // Reset form
      setContent('');
      setFiles([]);
      setDetectedIntents([]);
    } catch (error) {
      console.error('Failed to submit:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Filter employees for mention autocomplete
  const filteredEmployees = employeeOptions.filter(opt =>
    opt.label.toLowerCase().includes(mentionSearch.toLowerCase())
  ).slice(0, 8);

  const isReply = !!parentDataId;

  return (
    <div
      className={`relative ${dragOver ? 'ring-2 ring-blue-400 ring-offset-2' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div className={`border rounded-lg overflow-hidden ${isReply ? 'border-blue-300 bg-blue-50/50' : 'border-dark-300 bg-white'}`}>
        {/* Detected intents chips */}
        {detectedIntents.length > 0 && (
          <div className="px-3 pt-2 flex flex-wrap gap-1.5">
            {detectedIntents.map((intent, idx) => (
              <span
                key={idx}
                className={`
                  inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                  ${intent.type === 'time_entry' ? 'bg-emerald-100 text-emerald-700' : ''}
                  ${intent.type === 'mention' ? 'bg-blue-100 text-blue-700' : ''}
                `}
              >
                {intent.type === 'time_entry' && <Clock className="w-3 h-3" />}
                {intent.type === 'mention' && <AtSign className="w-3 h-3" />}
                {intent.display}
              </span>
            ))}
          </div>
        )}

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || submitting}
          rows={isReply ? 2 : 4}
          className="w-full px-3 py-3 text-sm resize-none border-0 focus:ring-0 focus:outline-none bg-transparent"
        />

        {/* Mention autocomplete dropdown */}
        {showMentions && (
          <div className="absolute left-3 bottom-full mb-1 bg-white border border-dark-300 rounded-lg shadow-lg z-50 max-h-48 min-w-[280px] overflow-y-auto">
            {employeesLoading ? (
              <div className="px-3 py-3 text-sm text-dark-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading employees...
              </div>
            ) : filteredEmployees.length > 0 ? (
              filteredEmployees.map(option => (
                <button
                  key={option.value}
                  onClick={() => handleMentionSelect(option)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 flex items-center gap-2 transition-colors"
                >
                  <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-medium shadow-sm">
                    {option.label.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-dark-800">{option.label}</span>
                </button>
              ))
            ) : mentionSearch ? (
              <div className="px-3 py-3 text-sm text-dark-500">
                No employees matching "{mentionSearch}"
              </div>
            ) : (
              <div className="px-3 py-3 text-sm text-dark-500">
                Type to search employees...
              </div>
            )}
          </div>
        )}

        {/* File previews */}
        {files.length > 0 && (
          <div className="px-3 pb-2 flex flex-wrap gap-2">
            {files.map((file, idx) => (
              <div
                key={idx}
                className="relative group flex items-center gap-2 px-2 py-1 bg-dark-100 border border-dark-300 rounded text-xs"
              >
                {file.type.startsWith('image/') ? (
                  <ImageIcon className="w-4 h-4 text-blue-500" />
                ) : (
                  <FileText className="w-4 h-4 text-dark-500" />
                )}
                <span className="max-w-[120px] truncate">{file.name}</span>
                {uploadProgress[file.name] !== undefined && (
                  <span className="text-dark-500">({uploadProgress[file.name]}%)</span>
                )}
                <button
                  onClick={() => handleRemoveFile(idx)}
                  className="text-dark-400 hover:text-red-500 transition-colors"
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Action bar */}
        <div className="px-3 py-2 border-t border-dark-200 flex items-center justify-between bg-dark-50/50">
          <div className="flex items-center gap-2">
            {/* Attach file */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || submitting}
              className="p-1.5 text-dark-500 hover:text-dark-700 hover:bg-dark-100 rounded transition-colors"
              title="Attach file"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Mention */}
            <button
              onClick={() => {
                setContent(prev => prev + '@');
                setShowMentions(true);
                textareaRef.current?.focus();
              }}
              disabled={disabled || submitting}
              className="p-1.5 text-dark-500 hover:text-dark-700 hover:bg-dark-100 rounded transition-colors"
              title="Mention someone"
            >
              <AtSign className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Cancel (for replies) */}
            {onCancel && (
              <button
                onClick={onCancel}
                disabled={submitting}
                className="px-3 py-1.5 text-sm text-dark-600 hover:text-dark-800"
              >
                Cancel
              </button>
            )}

            {/* Submit */}
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={disabled || submitting || isUploading || (!content.trim() && files.length === 0)}
              icon={submitting || isUploading ? Loader2 : Send}
            >
              {submitting ? 'Posting...' : isUploading ? 'Uploading...' : isReply ? 'Reply' : 'Post'}
            </Button>
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      {dragOver && (
        <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center">
          <span className="text-blue-600 font-medium">Drop files here</span>
        </div>
      )}
    </div>
  );
}

export default SmartComposer;
