import React, { useState, useRef, useEffect } from 'react';
import { X, Plus } from 'lucide-react';

interface EditableTagsProps {
  tags: string[];
  isEditing: boolean;
  onChange: (newTags: string[]) => void;
  className?: string;
}

/**
 * EditableTags - Editable tags component with pill UI
 *
 * Features:
 * - View mode: Shows tags as read-only pills
 * - Edit mode: Allows adding tags by typing and removing by clicking X
 * - Small, compact pill design
 * - Auto-focus on input when entering edit mode
 */
export function EditableTags({ tags, isEditing, onChange, className = '' }: EditableTagsProps) {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAddTag = () => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue && !tags.includes(trimmedValue)) {
      onChange([...tags, trimmedValue]);
      setInputValue('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (isEditing) {
      onChange(tags.filter(tag => tag !== tagToRemove));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === 'Escape') {
      setInputValue('');
      inputRef.current?.blur();
    }
  };

  return (
    <div className={`flex items-center flex-wrap gap-1.5 ${className}`}>
      {/* Existing Tags */}
      {tags.map((tag, index) => (
        <div
          key={`${tag}-${index}`}
          className={`
            inline-flex items-center gap-1 px-2 py-0.5 rounded
            text-xs font-medium bg-dark-100 text-dark-600
            ${isEditing ? 'hover:bg-dark-200 transition-colors' : ''}
          `}
        >
          <span>{tag}</span>
          {isEditing && (
            <button
              type="button"
              onClick={() => handleRemoveTag(tag)}
              className="hover:bg-dark-300 rounded-full p-0.5 transition-colors"
              title="Remove tag"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}

      {/* Input for adding new tags (edit mode only) */}
      {isEditing && (
        <div className="inline-flex items-center gap-1">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false);
              // Small delay to allow click on add button
              setTimeout(() => {
                if (inputValue.trim()) {
                  handleAddTag();
                }
              }, 200);
            }}
            placeholder="Add tag..."
            className="
              px-2 py-0.5 text-xs border border-dark-400 rounded
              focus:outline-none focus:ring-1 focus:ring-dark-700 focus:border-dark-400
              w-24 transition-all
            "
          />
          {inputValue.trim() && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent input blur
                handleAddTag();
              }}
              className="p-0.5 hover:bg-dark-100 rounded transition-colors"
              title="Add tag"
            >
              <Plus className="h-3.5 w-3.5 text-dark-700" />
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {tags.length === 0 && !isEditing && (
        <span className="text-xs text-dark-600">No tags</span>
      )}
    </div>
  );
}
