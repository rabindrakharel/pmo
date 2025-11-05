import React, { useState, useRef, useEffect } from 'react';
import { X, ChevronDown, Search } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface SearchableMultiSelectProps {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
}

/**
 * SearchableMultiSelect Component
 *
 * A dropdown multiselect with search functionality
 * - Search/filter options by typing
 * - Select/deselect multiple items
 * - Display selected items as removable badges
 * - Click outside to close dropdown
 */
export function SearchableMultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  readonly = false
}: SearchableMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Filter options based on search term
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get selected option labels
  const selectedOptions = options.filter(opt => value.includes(opt.value));

  // Toggle option selection
  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter(v => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  // Remove selected item
  const removeItem = (optionValue: string) => {
    onChange(value.filter(v => v !== optionValue));
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Selected items display + trigger button */}
      <div
        onClick={() => !disabled && !readonly && setIsOpen(!isOpen)}
        className={`
          min-h-[38px] w-full border border-dark-400 rounded-md bg-dark-100 px-3 py-2
          flex flex-wrap gap-1 items-center cursor-pointer
          ${disabled || readonly ? 'bg-dark-100 cursor-not-allowed' : 'hover:border-dark-400'}
          ${isOpen ? 'ring-2 ring-dark-7000 border-dark-3000' : ''}
        `}
      >
        {selectedOptions.length === 0 ? (
          <span className="text-dark-600 text-sm">{placeholder}</span>
        ) : (
          selectedOptions.map(option => (
            <span
              key={option.value}
              className="inline-flex items-center gap-1 px-2 py-1 bg-dark-100 text-dark-600 rounded text-xs font-medium"
            >
              {option.label}
              {!disabled && !readonly && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeItem(option.value);
                  }}
                  className="hover:bg-dark-200 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))
        )}
        <div className="ml-auto">
          <ChevronDown className={`w-4 h-4 text-dark-600 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
        </div>
      </div>

      {/* Dropdown menu */}
      {isOpen && !disabled && !readonly && (
        <div className="absolute z-50 w-full mt-1 bg-dark-100 border border-dark-400 rounded-md shadow-lg max-h-60 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-dark-300">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-dark-600" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-dark-400 rounded focus:outline-none focus:ring-2 focus:ring-dark-7000 focus:border-dark-3000"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-dark-600 text-center">
                No options found
              </div>
            ) : (
              filteredOptions.map(option => {
                const isSelected = value.includes(option.value);
                return (
                  <div
                    key={option.value}
                    onClick={() => toggleOption(option.value)}
                    className={`
                      px-3 py-2 cursor-pointer text-sm flex items-center gap-2
                      ${isSelected ? 'bg-dark-100 text-dark-600' : 'hover:bg-dark-100'}
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded border-dark-400 text-dark-700 focus:ring-dark-7000"
                    />
                    <span>{option.label}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
