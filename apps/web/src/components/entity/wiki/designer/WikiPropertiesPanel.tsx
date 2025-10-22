import React from 'react';
import { Tag, Hash, Palette, Link as LinkIcon, User, Calendar } from 'lucide-react';
import type { WikiBlock } from '../WikiDesigner';

interface WikiPropertiesPanelProps {
  title: string;
  slug: string;
  tags: string[];
  icon: string;
  cover: string;
  pagePath: string;
  author: string;
  createdDate: string;
  updatedDate: string;
  selectedBlock?: WikiBlock;
  onUpdateTitle: (title: string) => void;
  onUpdateSlug: (slug: string) => void;
  onUpdateTags: (tags: string[]) => void;
  onUpdateIcon: (icon: string) => void;
  onUpdateCover: (cover: string) => void;
  onUpdatePath: (path: string) => void;
  onUpdateBlock?: (updates: Partial<WikiBlock>) => void;
}

export function WikiPropertiesPanel({
  title,
  slug,
  tags,
  icon,
  cover,
  pagePath,
  author,
  createdDate,
  updatedDate,
  selectedBlock,
  onUpdateTitle,
  onUpdateSlug,
  onUpdateTags,
  onUpdateIcon,
  onUpdateCover,
  onUpdatePath,
  onUpdateBlock,
}: WikiPropertiesPanelProps) {
  const [tagInput, setTagInput] = React.useState('');

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      onUpdateTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onUpdateTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const coverOptions = [
    { value: 'gradient-blue', label: 'Blue Gradient', class: 'bg-gradient-to-r from-blue-500 to-indigo-600' },
    { value: 'gradient-purple', label: 'Purple Gradient', class: 'bg-gradient-to-r from-purple-500 to-pink-600' },
    { value: 'gradient-green', label: 'Green Gradient', class: 'bg-gradient-to-r from-green-500 to-teal-600' },
    { value: 'gradient-orange', label: 'Orange Gradient', class: 'bg-gradient-to-r from-orange-500 to-red-600' },
    { value: 'solid-gray', label: 'Gray', class: 'bg-gray-500' },
  ];

  // If a block is selected, show block-specific properties
  if (selectedBlock && onUpdateBlock) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Block Properties</h3>
          <div className="space-y-4">
            {/* Block Type */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Block Type</label>
              <div className="px-3 py-2 bg-gray-100 rounded text-sm text-gray-700 capitalize">
                {selectedBlock.type}
              </div>
            </div>

            {/* Heading Level */}
            {selectedBlock.type === 'heading' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Heading Level</label>
                <select
                  value={selectedBlock.level || 1}
                  onChange={(e) => onUpdateBlock({ level: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {[1, 2, 3, 4, 5, 6].map((level) => (
                    <option key={level} value={level}>
                      Heading {level}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* List Type */}
            {selectedBlock.type === 'list' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">List Type</label>
                <select
                  value={selectedBlock.level || 1}
                  onChange={(e) => onUpdateBlock({ level: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={1}>Bulleted</option>
                  <option value={2}>Numbered</option>
                </select>
              </div>
            )}

            {/* Image Properties */}
            {selectedBlock.type === 'image' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Image URL</label>
                  <input
                    type="text"
                    value={selectedBlock.properties?.src || ''}
                    onChange={(e) =>
                      onUpdateBlock({
                        properties: { ...selectedBlock.properties, src: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Alt Text</label>
                  <input
                    type="text"
                    value={selectedBlock.properties?.alt || ''}
                    onChange={(e) =>
                      onUpdateBlock({
                        properties: { ...selectedBlock.properties, alt: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Image description"
                  />
                </div>
              </>
            )}

            {/* Video Properties */}
            {selectedBlock.type === 'video' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Video Embed URL</label>
                <input
                  type="text"
                  value={selectedBlock.properties?.src || ''}
                  onChange={(e) =>
                    onUpdateBlock({
                      properties: { ...selectedBlock.properties, src: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://www.youtube.com/embed/..."
                />
                <p className="mt-1 text-xs text-gray-500">
                  Use embed URL format for YouTube, Vimeo, etc.
                </p>
              </div>
            )}

            {/* Table Properties */}
            {selectedBlock.type === 'table' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Rows</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={selectedBlock.properties?.rows || 3}
                    onChange={(e) =>
                      onUpdateBlock({
                        properties: { ...selectedBlock.properties, rows: parseInt(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Columns</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={selectedBlock.properties?.cols || 3}
                    onChange={(e) =>
                      onUpdateBlock({
                        properties: { ...selectedBlock.properties, cols: parseInt(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Otherwise show page properties
  return (
    <div className="space-y-6">
      {/* Page Icon */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2 flex items-center">
          <Palette className="h-3 w-3 mr-1" />
          Page Icon
        </label>
        <input
          type="text"
          value={icon}
          onChange={(e) => onUpdateIcon(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-2xl text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="📄"
        />
      </div>

      {/* Cover Color */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2 flex items-center">
          <Palette className="h-3 w-3 mr-1" />
          Cover
        </label>
        <div className="space-y-2">
          {coverOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => onUpdateCover(option.value)}
              className={`w-full flex items-center space-x-3 p-2 rounded-lg border-2 transition-all ${
                cover === option.value ? 'border-blue-500' : 'border-transparent hover:border-gray-300'
              }`}
            >
              <div className={`w-8 h-8 rounded ${option.class}`} />
              <span className="text-sm text-gray-700">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Slug */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2 flex items-center">
          <LinkIcon className="h-3 w-3 mr-1" />
          URL Slug
        </label>
        <input
          type="text"
          value={slug}
          onChange={(e) => onUpdateSlug(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
          placeholder="my-wiki-page"
        />
      </div>

      {/* Path */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2 flex items-center">
          <Hash className="h-3 w-3 mr-1" />
          Path
        </label>
        <input
          type="text"
          value={pagePath}
          onChange={(e) => onUpdatePath(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
          placeholder="/wiki"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2 flex items-center">
          <Tag className="h-3 w-3 mr-1" />
          Tags
        </label>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
              >
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 hover:text-blue-900"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex space-x-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Add tag..."
            />
            <button
              onClick={handleAddTag}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="pt-4 border-t border-gray-200 space-y-3">
        <div className="flex items-center text-xs text-gray-500">
          <User className="h-3 w-3 mr-2" />
          <span>Author: {author}</span>
        </div>
        <div className="flex items-center text-xs text-gray-500">
          <Calendar className="h-3 w-3 mr-2" />
          <span>Created: {new Date(createdDate).toLocaleDateString()}</span>
        </div>
        <div className="flex items-center text-xs text-gray-500">
          <Calendar className="h-3 w-3 mr-2" />
          <span>Updated: {new Date(updatedDate).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}
