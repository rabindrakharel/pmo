import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
// v9.8.0: Reusable Chip component
import { Chip } from './Chip';

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
  showTooltips?: boolean;
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
  readonly = false,
  showTooltips = true
}: SearchableMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
    openUpward: false
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside (includes portal-rendered dropdown)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update dropdown position when it opens or on scroll/resize
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const updatePosition = () => {
        if (triggerRef.current) {
          const rect = triggerRef.current.getBoundingClientRect();
          const maxDropdownHeight = 300;
          const viewportHeight = window.innerHeight;
          const spaceBelow = viewportHeight - rect.bottom - 20;
          const spaceAbove = rect.top - 20;

          const estimatedItemHeight = 36;
          const estimatedContentHeight = Math.min(options.length * estimatedItemHeight, maxDropdownHeight);

          const shouldOpenUpward = spaceBelow < estimatedContentHeight && spaceAbove > spaceBelow;

          let top: number;
          if (shouldOpenUpward) {
            const availableHeight = Math.min(estimatedContentHeight, spaceAbove);
            top = rect.top + window.scrollY - availableHeight - 4;
          } else {
            top = rect.bottom + window.scrollY + 4;
          }

          setDropdownPosition({
            top,
            left: rect.left + window.scrollX,
            width: rect.width,
            openUpward: shouldOpenUpward,
          });
        }
      };

      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);

      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen, options.length]);

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
        ref={triggerRef}
        onClick={() => !disabled && !readonly && setIsOpen(!isOpen)}
        className={`
          min-h-[36px] w-full border border-dark-300 rounded bg-white px-2.5 py-1.5
          flex flex-wrap gap-1 items-center cursor-pointer transition-colors
          ${disabled || readonly ? 'bg-dark-50 cursor-not-allowed' : 'hover:border-dark-400'}
          ${isOpen ? 'ring-1 ring-slate-500 border-slate-500' : ''}
        `}
      >
        {selectedOptions.length === 0 ? (
          <span className="text-dark-500 text-sm py-0.5">{placeholder}</span>
        ) : (
          // v9.8.0: Use reusable Chip component
          selectedOptions.map(option => (
            <Chip
              key={option.value}
              label={option.label}
              title={showTooltips ? option.label : undefined}
              size="sm"
              maxWidth="150px"
              colorClass="bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200"
              removable={!disabled && !readonly}
              onRemove={() => removeItem(option.value)}
              disabled={disabled}
            />
          ))
        )}
        <div className="ml-auto">
          <ChevronDown className={`w-3.5 h-3.5 text-dark-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
        </div>
      </div>

      {/* Dropdown menu - rendered via portal to avoid overflow clipping */}
      {isOpen && !disabled && !readonly && createPortal(
        <div
          ref={dropdownRef}
          data-dropdown-portal=""
          className="bg-white border border-dark-200 rounded overflow-hidden"
          style={{
            position: 'absolute',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            maxHeight: '300px',
            zIndex: 9999,
            boxShadow: dropdownPosition.openUpward
              ? '0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)'
              : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          }}
        >
          {/* Search input */}
          <div className="p-1.5 border-b border-dark-200 bg-dark-50">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-dark-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full pl-7 pr-2 py-1 text-xs border border-dark-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-52 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-dark-500 text-center">
                No options found
              </div>
            ) : (
              filteredOptions.map(option => {
                const isSelected = value.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className={`
                      flex items-center px-3 py-2 hover:bg-dark-50 rounded-md cursor-pointer transition-colors group
                      ${isSelected ? 'bg-slate-50' : ''}
                    `}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleOption(option.value);
                    }}
                    title={showTooltips ? option.label : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      onClick={(e) => e.stopPropagation()}
                      className="mr-3 text-slate-600 rounded focus:ring-slate-500/30 focus:ring-offset-0 flex-shrink-0"
                    />
                    <span className={`text-sm truncate ${isSelected ? 'text-slate-700 font-medium' : 'text-dark-700'}`}>
                      {option.label}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
