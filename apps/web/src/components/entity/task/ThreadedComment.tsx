import React, { useState } from 'react';
import {
  MessageSquare,
  Pin,
  CheckCircle2,
  MoreHorizontal,
  Reply,
  Download,
  Image as ImageIcon,
  FileText,
  Paperclip,
} from 'lucide-react';
import { ReactionBar } from './ReactionBar';

/**
 * ThreadedComment - Single comment/update with threading support (Linear/Slack style)
 *
 * Features:
 * - Rich text content rendering
 * - S3 attachment previews (images inline, files downloadable)
 * - Reactions display and interaction
 * - Reply button with nested replies
 * - Pin/Resolve actions for editors
 * - Collapsible thread when has replies
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
  stage: string;
  updated_by__employee_id: string;
  data_richtext: any;
  update_type: string;
  hours_logged?: number;
  mentioned__employee_ids?: string[];
  reactions_data: Record<string, string[]>;
  pinned_flag: boolean;
  pinned_by__employee_id?: string;
  pinned_ts?: string;
  resolved_flag: boolean;
  resolved_by__employee_id?: string;
  resolved_ts?: string;
  attachments: S3Attachment[];
  created_ts: string;
  updated_ts: string;
  updated_by_name?: string;
  reply_count?: number;
}

interface ThreadedCommentProps {
  update: TaskUpdate;
  currentUserId: string;
  canEdit: boolean;
  isReply?: boolean;
  onReply?: (parentId: string) => void;
  onReact: (dataId: string, emoji: string) => Promise<void>;
  onPin: (dataId: string) => Promise<void>;
  onResolve: (dataId: string) => Promise<void>;
  onLoadReplies?: (parentId: string) => void;
  replies?: TaskUpdate[];
  repliesLoading?: boolean;
  getPresignedUrl?: (s3Key: string) => Promise<string>;
  employeeNames?: Record<string, string>;
}

// Format relative time (Linear style)
const formatRelativeTime = (timestamp: string): string => {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return then.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
};

// Format file size
const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function ThreadedComment({
  update,
  currentUserId,
  canEdit,
  isReply = false,
  onReply,
  onReact,
  onPin,
  onResolve,
  onLoadReplies,
  replies = [],
  repliesLoading = false,
  getPresignedUrl,
  employeeNames = {},
}: ThreadedCommentProps) {
  const [showReplies, setShowReplies] = useState(false);
  const [showActions, setShowActions] = useState(false);

  // Parse rich text content
  const renderRichText = (richtext: any) => {
    if (!richtext) return null;

    let delta = richtext;
    if (typeof richtext === 'string') {
      try {
        delta = JSON.parse(richtext);
      } catch {
        return <p className="text-dark-700">{richtext}</p>;
      }
    }

    if (!delta?.ops) return null;

    const parts: React.ReactNode[] = [];
    delta.ops.forEach((op: any, idx: number) => {
      let text = op.insert || '';
      const attrs = op.attributes || {};

      // Skip attachment references (handled separately)
      if (attrs.attachment) return;

      // Apply formatting
      let element: React.ReactNode = text;

      if (attrs.bold) element = <strong key={idx}>{element}</strong>;
      if (attrs.italic) element = <em key={idx}>{element}</em>;
      if (attrs.code) element = <code key={idx} className="bg-dark-100 px-1 py-0.5 rounded text-sm font-mono">{element}</code>;
      if (attrs.link) element = <a key={idx} href={attrs.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{element}</a>;
      if (attrs.mention) {
        element = (
          <span key={idx} className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-sm">
            @{attrs.mention.name}
          </span>
        );
      }

      parts.push(element);
    });

    return <div className="whitespace-pre-wrap">{parts}</div>;
  };

  // Render S3 attachments
  const renderAttachments = (attachments: S3Attachment[]) => {
    if (!attachments?.length) return null;

    // Parse if string
    let atts = attachments;
    if (typeof attachments === 'string') {
      try {
        atts = JSON.parse(attachments);
      } catch {
        return null;
      }
    }

    const images = atts.filter(a => a.content_type?.startsWith('image/'));
    const files = atts.filter(a => !a.content_type?.startsWith('image/'));

    return (
      <div className="mt-3 space-y-2">
        {/* Image attachments */}
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((att, idx) => (
              <div key={idx} className="relative group">
                {/* For now, show placeholder - in real impl, fetch presigned URL */}
                <div className="w-40 h-32 bg-dark-100 border border-dark-300 rounded-lg flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-dark-400" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/50 to-transparent rounded-b-lg">
                  <span className="text-xs text-white truncate block">{att.filename}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* File attachments */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((att, idx) => (
              <a
                key={idx}
                href="#"
                onClick={async (e) => {
                  e.preventDefault();
                  if (getPresignedUrl) {
                    const url = await getPresignedUrl(att.s3_key);
                    window.open(url, '_blank');
                  }
                }}
                className="inline-flex items-center gap-2 px-3 py-2 bg-dark-50 border border-dark-300 rounded-lg text-sm hover:bg-dark-100 transition-colors"
              >
                {att.content_type?.includes('pdf') ? (
                  <FileText className="w-4 h-4 text-red-500" />
                ) : (
                  <Paperclip className="w-4 h-4 text-dark-500" />
                )}
                <span className="max-w-[200px] truncate">{att.filename}</span>
                {att.size_bytes && (
                  <span className="text-dark-500 text-xs">({formatFileSize(att.size_bytes)})</span>
                )}
                <Download className="w-3.5 h-3.5 text-dark-400" />
              </a>
            ))}
          </div>
        )}
      </div>
    );
  };

  const hasReplies = (update.reply_count || 0) > 0;

  return (
    <div className={`group ${isReply ? 'ml-8 border-l-2 border-dark-200 pl-4' : ''}`}>
      {/* Pinned indicator */}
      {update.pinned_flag && !isReply && (
        <div className="flex items-center gap-1 text-xs text-amber-600 mb-1">
          <Pin className="w-3 h-3" />
          <span>Pinned</span>
        </div>
      )}

      <div className="flex gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
            {update.updated_by_name?.charAt(0).toUpperCase() || 'U'}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-dark-800">
              {update.updated_by_name || 'Unknown User'}
            </span>
            <span className="text-xs text-dark-500">
              {formatRelativeTime(update.created_ts)}
            </span>
            {update.hours_logged && (
              <span className="text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                +{update.hours_logged}h
              </span>
            )}
            {update.resolved_flag && (
              <span className="text-xs text-green-600 flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3" />
                Resolved
              </span>
            )}
          </div>

          {/* Rich text content */}
          <div className="mt-1 text-sm text-dark-700 leading-relaxed">
            {renderRichText(update.data_richtext)}
          </div>

          {/* Attachments */}
          {renderAttachments(update.attachments)}

          {/* Actions row */}
          <div className="mt-2 flex items-center gap-3">
            {/* Reactions */}
            <ReactionBar
              taskId={update.task_id}
              dataId={update.id}
              reactions={
                typeof update.reactions_data === 'string'
                  ? JSON.parse(update.reactions_data)
                  : update.reactions_data || {}
              }
              currentUserId={currentUserId}
              onReact={(emoji) => onReact(update.id, emoji)}
              employeeNames={employeeNames}
            />

            {/* Action buttons (shown on hover or focus) */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Reply button */}
              {!isReply && onReply && (
                <button
                  onClick={() => onReply(update.id)}
                  className="p-1.5 text-dark-500 hover:text-dark-700 hover:bg-dark-100 rounded transition-colors"
                  title="Reply"
                >
                  <Reply className="w-4 h-4" />
                </button>
              )}

              {/* Pin button (editors only) */}
              {canEdit && !isReply && (
                <button
                  onClick={() => onPin(update.id)}
                  className={`p-1.5 rounded transition-colors ${
                    update.pinned_flag
                      ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                      : 'text-dark-500 hover:text-dark-700 hover:bg-dark-100'
                  }`}
                  title={update.pinned_flag ? 'Unpin' : 'Pin'}
                >
                  <Pin className="w-4 h-4" />
                </button>
              )}

              {/* Resolve button (editors only) */}
              {canEdit && !isReply && (
                <button
                  onClick={() => onResolve(update.id)}
                  className={`p-1.5 rounded transition-colors ${
                    update.resolved_flag
                      ? 'text-green-600 bg-green-50 hover:bg-green-100'
                      : 'text-dark-500 hover:text-dark-700 hover:bg-dark-100'
                  }`}
                  title={update.resolved_flag ? 'Unresolve' : 'Mark as resolved'}
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Thread toggle */}
          {hasReplies && !isReply && (
            <button
              onClick={() => {
                setShowReplies(!showReplies);
                if (!showReplies && onLoadReplies) {
                  onLoadReplies(update.id);
                }
              }}
              className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>
                {showReplies ? 'Hide' : 'Show'} {update.reply_count} {update.reply_count === 1 ? 'reply' : 'replies'}
              </span>
            </button>
          )}

          {/* Nested replies */}
          {showReplies && (
            <div className="mt-3 space-y-3">
              {repliesLoading ? (
                <div className="text-xs text-dark-500 ml-8">Loading replies...</div>
              ) : (
                replies.map((reply) => (
                  <ThreadedComment
                    key={reply.id}
                    update={reply}
                    currentUserId={currentUserId}
                    canEdit={canEdit}
                    isReply={true}
                    onReact={onReact}
                    onPin={onPin}
                    onResolve={onResolve}
                    employeeNames={employeeNames}
                    getPresignedUrl={getPresignedUrl}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ThreadedComment;
