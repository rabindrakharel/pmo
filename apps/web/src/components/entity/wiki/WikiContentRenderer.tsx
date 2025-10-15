import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit2, BookOpen, Calendar, User, Eye, Lock, Globe } from 'lucide-react';

interface WikiContentRendererProps {
  data: any;
  onEdit?: () => void;
}

/**
 * WikiContentRenderer
 *
 * Renders wiki page content in the EntityDetailPage.
 * Shows wiki metadata, cover image, and rendered HTML content.
 */
export function WikiContentRenderer({ data, onEdit }: WikiContentRendererProps) {
  const navigate = useNavigate();

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-500">
        No wiki content available
      </div>
    );
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = Date.now();
    const diff = now - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getCoverStyle = (cover?: string) => {
    const coverMap: Record<string, string> = {
      'gradient-blue': 'bg-gradient-to-r from-blue-600 to-indigo-600',
      'gradient-purple': 'bg-gradient-to-r from-purple-600 to-pink-600',
      'emerald': 'bg-gradient-to-r from-emerald-600 to-teal-600',
      'gray': 'bg-gray-200',
      'gradient-orange': 'bg-gradient-to-r from-orange-600 to-red-600',
      'gradient-green': 'bg-gradient-to-r from-green-600 to-emerald-600'
    };
    return coverMap[cover || 'gradient-blue'] || coverMap['gradient-blue'];
  };

  const getVisibilityIcon = (visibility?: string) => {
    switch (visibility) {
      case 'public': return <Globe className="h-4 w-4" />;
      case 'private': return <Lock className="h-4 w-4" />;
      case 'restricted': return <Eye className="h-4 w-4" />;
      default: return <Eye className="h-4 w-4" />;
    }
  };

  const getStatusBadgeClass = (status?: string) => {
    const statusMap: Record<string, string> = {
      'published': 'bg-green-100 text-green-800',
      'draft': 'bg-yellow-100 text-yellow-800',
      'archived': 'bg-gray-100 text-gray-800',
      'deprecated': 'bg-red-100 text-red-800'
    };
    return statusMap[status || 'draft'] || statusMap['draft'];
  };

  const getTypeBadgeClass = (type?: string) => {
    const typeMap: Record<string, string> = {
      'page': 'bg-blue-100 text-blue-800',
      'template': 'bg-purple-100 text-purple-800',
      'workflow': 'bg-green-100 text-green-800',
      'guide': 'bg-yellow-100 text-yellow-800',
      'policy': 'bg-red-100 text-red-800',
      'checklist': 'bg-indigo-100 text-indigo-800'
    };
    return typeMap[type || 'page'] || typeMap['page'];
  };

  const normalizePath = (value?: string) => {
    if (!value) return '';
    let next = value.trim();
    if (!next) return '';
    next = next.replace(/\s+/g, '-');
    if (!next.startsWith('/')) next = `/${next}`;
    next = next.replace(/(?!^)\/{2,}/g, '/');
    if (next.length > 1 && next.endsWith('/')) next = next.slice(0, -1);
    return next;
  };

  const attrPath = normalizePath(data?.attr?.path);
  const slugValue = typeof data?.slug === 'string' ? data.slug : '';
  const fullPath = (() => {
    if (typeof data?.page_path === 'string' && data.page_path) return data.page_path;
    if (attrPath && slugValue) {
      const base = attrPath.endsWith('/') ? attrPath.slice(0, -1) : attrPath;
      return `${base}/${slugValue}`;
    }
    if (attrPath) return attrPath;
    if (slugValue) return `/wiki/${slugValue}`;
    return '';
  })();

  return (
    <div className="space-y-6">
      {/* Cover Image */}
      <div className={`h-48 rounded-xl ${getCoverStyle(data.attr?.cover)}`} />

      {/* Header Section */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          {/* Icon */}
          <div className="w-16 h-16 text-4xl flex items-center justify-center bg-white rounded-xl border-2 border-gray-200 shadow-sm">
            {data.attr?.icon || '📄'}
          </div>

          {/* Title and Metadata */}
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {data.name || data.title}
            </h1>

            {data.summary && (
              <p className="text-lg text-gray-600 mb-3">{data.summary}</p>
            )}

            <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
              {/* Type Badge */}
              {data.wiki_type && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal ${getTypeBadgeClass(data.wiki_type)}`}>
                  <BookOpen className="h-3 w-3 mr-1" />
                  {data.wiki_type}
                </span>
              )}

              {/* Status Badge */}
              {data.publication_status && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal ${getStatusBadgeClass(data.publication_status)}`}>
                  {data.publication_status}
                </span>
              )}

              {/* Category */}
              {data.category && (
                <span className="flex items-center gap-1">
                  <span className="text-gray-400">Category:</span>
                  <span className="font-normal text-gray-700">{data.category}</span>
                </span>
              )}

              {/* Visibility */}
              {data.visibility && (
                <span className="flex items-center gap-1">
                  {getVisibilityIcon(data.visibility)}
                  <span className="capitalize">{data.visibility}</span>
                </span>
              )}

              {/* Author */}
              {data.ownerName && (
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {data.ownerName}
                </span>
              )}

              {/* Last Updated */}
              {data.updated_ts && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(data.updated_ts)}
                </span>
              )}
            </div>

            {/* Tags */}
            {data.tags && data.tags.length > 0 && (
              <div className="flex items-center gap-2 mt-3">
                <span className="text-sm text-gray-500">🏷️ Tags:</span>
                <div className="flex flex-wrap gap-1">
                  {data.tags.map((tag: string, index: number) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-normal bg-blue-50 text-blue-700 border border-blue-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Keywords */}
            {data.keywords && data.keywords.length > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm text-gray-500">🔍 Keywords:</span>
                <div className="flex flex-wrap gap-1">
                  {data.keywords.map((keyword: string, index: number) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-normal bg-gray-100 text-gray-700"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Edit Button */}
        <button
          onClick={() => {
            if (onEdit) {
              onEdit();
            } else {
              navigate(`/wiki/${data.id}/edit`);
            }
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Edit2 className="h-4 w-4" />
          Edit in Wiki Editor
        </button>
      </div>

      {/* Path Information */}
      {fullPath && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600">
          <span className="font-medium">Path:</span> {fullPath}
        </div>
      )}

      {/* Description */}
      {data.descr && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">Description</h3>
          <p className="text-sm text-blue-800 whitespace-pre-wrap">{data.descr}</p>
        </div>
      )}

      {/* Main Content */}
      <article className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="p-8">
          {data.content_html ? (
            <div
              className="prose prose-sm sm:prose lg:prose-lg max-w-none
                prose-headings:text-gray-900 prose-headings:font-bold
                prose-p:text-gray-700 prose-p:leading-relaxed
                prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                prose-strong:text-gray-900 prose-strong:font-semibold
                prose-code:text-pink-600 prose-code:bg-pink-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                prose-pre:bg-gray-900 prose-pre:text-gray-100
                prose-ul:list-disc prose-ol:list-decimal
                prose-li:text-gray-700
                prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:bg-blue-50 prose-blockquote:italic
                prose-img:rounded-lg prose-img:shadow-md
                prose-table:border prose-table:border-gray-300
                prose-th:bg-gray-100 prose-th:font-semibold
                prose-td:border prose-td:border-gray-200"
              dangerouslySetInnerHTML={{ __html: data.content_html }}
            />
          ) : (
            <div className="text-center py-12 text-gray-400">
              <BookOpen className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">No content available</p>
              <p className="text-sm mt-2">Click "Edit in Wiki Editor" to add content</p>
            </div>
          )}
        </div>
      </article>

      {/* Metadata Section */}
      {data.metadata && Object.keys(data.metadata).length > 0 && (
        <details className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <summary className="cursor-pointer font-normal text-gray-700 hover:text-gray-900">
            Additional Metadata
          </summary>
          <pre className="mt-3 text-xs text-gray-600 overflow-auto bg-white p-3 rounded border border-gray-200">
            {JSON.stringify(data.metadata, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
