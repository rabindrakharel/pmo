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
      day: 'numeric'});
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
          6: 'text-base font-medium mt-2 mb-1'}[block.level || 1];
        return <HeadingTag className={headingClasses}>{block.content}</HeadingTag>;

      case 'paragraph':
        return <p className="mb-4 leading-relaxed text-dark-600">{block.content}</p>;

      case 'quote':
        return (
          <blockquote className="border-l-4 border-dark-3000 pl-6 py-2 my-4 italic text-dark-700 bg-dark-100/50">
            {block.content}
          </blockquote>
        );

      case 'code':
        return (
          <pre className="bg-dark-900 text-gray-100 rounded-lg p-4 my-4 overflow-x-auto">
            <code className="font-mono text-sm">{block.content}</code>
          </pre>
        );

      case 'list': {
        const ListTag = block.level === 1 ? 'ul' : 'ol';
        const bulletStyle = block.level === 1 ? 'list-disc' : 'list-decimal';
        const items = block.properties?.items || [block.content || ''];
        return (
          <ListTag className={`${bulletStyle} ml-6 my-4 space-y-1`}>
            {items.map((item, index) => (
              <li key={index} className="text-dark-600 leading-relaxed">{item}</li>
            ))}
          </ListTag>
        );
      }

      case 'callout':
        return (
          <div className="bg-dark-100 border-l-4 border-dark-3000 p-4 rounded-r my-4">
            <p className="text-dark-600 font-medium">{block.content}</p>
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
              <p className="text-sm text-dark-700 text-center mt-2 italic">
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
        return <hr className="border-t-2 border-dark-400 my-8" />;

      case 'table': {
        const rows = block.properties?.rows || 3;
        const cols = block.properties?.cols || 3;
        const cells = block.properties?.cells ||
          Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));

        return (
          <div className="my-6 overflow-x-auto">
            <table className="min-w-full border border-dark-400">
              <tbody>
                {cells.map((row: string[], rowIndex: number) => (
                  <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-dark-100' : 'bg-dark-100'}>
                    {row.map((cell: string, colIndex: number) => (
                      <td key={colIndex} className="border border-dark-400 p-3 text-sm text-dark-600">
                        {cell || 'Cell'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Content Container */}
      <div className="bg-dark-100 rounded-xl shadow-lg">
        {/* Simple Header */}
        <div className="px-12 pt-12 pb-6 border-b border-dark-300">
          <h1 className="text-4xl font-bold text-dark-600 mb-4">{title || 'Untitled Page'}</h1>

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-6 text-sm text-dark-700">
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
        </div>

        {/* Content */}
        <div className="px-12 py-8">
          {blocks.length === 0 ? (
            <p className="text-dark-600 text-center py-12">No content yet. Add blocks to start writing.</p>
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
