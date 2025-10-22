import React from 'react';
import { Calendar, Clock, Tag, User } from 'lucide-react';
import type { WikiBlock } from '../WikiDesigner';

interface WikiPreviewPanelProps {
  blocks: WikiBlock[];
  title: string;
  metadata: {
    author: string;
    createdDate: string;
    updatedDate: string;
    tags: string[];
    icon: string;
    cover: string;
  };
}

export function WikiPreviewPanel({ blocks, title, metadata }: WikiPreviewPanelProps) {
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const now = Date.now();
    const date = new Date(dateString);
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
      day: 'numeric',
    });
  };

  const getCoverGradient = (cover: string) => {
    switch (cover) {
      case 'gradient-blue':
        return 'from-blue-500 to-cyan-500';
      case 'gradient-purple':
        return 'from-purple-500 to-pink-500';
      case 'gradient-green':
        return 'from-emerald-500 to-teal-500';
      case 'gradient-orange':
        return 'from-orange-500 to-red-500';
      case 'solid-gray':
        return 'from-gray-500 to-slate-500';
      default:
        return 'from-blue-500 to-cyan-500';
    }
  };

  const renderBlock = (block: WikiBlock) => {
    switch (block.type) {
      case 'heading':
        const HeadingTag = `h${block.level || 1}` as keyof JSX.IntrinsicElements;
        const headingClasses = {
          1: 'text-4xl font-bold mt-8 mb-4',
          2: 'text-3xl font-bold mt-6 mb-3',
          3: 'text-2xl font-semibold mt-5 mb-2',
          4: 'text-xl font-semibold mt-4 mb-2',
          5: 'text-lg font-medium mt-3 mb-2',
          6: 'text-base font-medium mt-2 mb-1',
        }[block.level || 1];
        return <HeadingTag className={headingClasses}>{block.content}</HeadingTag>;

      case 'paragraph':
        return <p className="mb-4 leading-relaxed text-gray-700">{block.content}</p>;

      case 'quote':
        return (
          <blockquote className="border-l-4 border-blue-500 pl-6 py-2 my-4 italic text-gray-600 bg-blue-50/50">
            {block.content}
          </blockquote>
        );

      case 'code':
        return (
          <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 my-4 overflow-x-auto">
            <code className="font-mono text-sm">{block.content}</code>
          </pre>
        );

      case 'list':
        const ListTag = block.level === 1 ? 'ul' : 'ol';
        const bulletStyle = block.level === 1 ? 'list-disc' : 'list-decimal';
        return (
          <ListTag className={`${bulletStyle} ml-6 my-4`}>
            <li className="text-gray-700 leading-relaxed">{block.content}</li>
          </ListTag>
        );

      case 'callout':
        return (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r my-4">
            <p className="text-blue-900 font-medium">{block.content}</p>
          </div>
        );

      case 'image':
        return block.properties?.src ? (
          <div className="my-6">
            <img
              src={block.properties.src}
              alt={block.properties.alt || ''}
              className="max-w-full h-auto rounded-lg shadow-md"
            />
            {block.properties.alt && (
              <p className="text-sm text-gray-500 text-center mt-2 italic">
                {block.properties.alt}
              </p>
            )}
          </div>
        ) : null;

      case 'video':
        return block.properties?.src ? (
          <div className="my-6 aspect-video">
            <iframe
              src={block.properties.src}
              className="w-full h-full rounded-lg shadow-md"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : null;

      case 'divider':
        return <hr className="border-t-2 border-gray-300 my-8" />;

      case 'table':
        return (
          <div className="my-6 overflow-x-auto">
            <table className="min-w-full border border-gray-300">
              <tbody>
                {Array.from({ length: block.properties?.rows || 3 }).map((_, rowIndex) => (
                  <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    {Array.from({ length: block.properties?.cols || 3 }).map((_, colIndex) => (
                      <td key={colIndex} className="border border-gray-300 p-3 text-sm text-gray-700">
                        {block.content || 'Cell'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Cover Image */}
      <div className={`h-48 rounded-t-xl bg-gradient-to-r ${getCoverGradient(metadata.cover)} flex items-center justify-center`}>
        <span className="text-8xl">{metadata.icon}</span>
      </div>

      {/* Content Container */}
      <div className="bg-white rounded-b-xl shadow-lg -mt-8 relative z-10">
        {/* Header */}
        <div className="px-12 pt-12 pb-6 border-b border-gray-200">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">{title || 'Untitled Page'}</h1>

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600 mb-4">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4" />
              <span>{metadata.author}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>{new Date(metadata.createdDate).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>Updated {formatDate(metadata.updatedDate)}</span>
            </div>
          </div>

          {/* Tags */}
          {metadata.tags && metadata.tags.length > 0 && (
            <div className="flex items-center space-x-2">
              <Tag className="h-4 w-4 text-gray-500" />
              <div className="flex flex-wrap gap-2">
                {metadata.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-12 py-8">
          {blocks.length === 0 ? (
            <p className="text-gray-400 text-center py-12">No content yet. Add blocks to start writing.</p>
          ) : (
            blocks.map((block, index) => (
              <div key={block.id || index}>{renderBlock(block)}</div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
