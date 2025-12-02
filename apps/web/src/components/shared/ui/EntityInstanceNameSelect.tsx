import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { useRefDataEntityInstanceOptions } from '@/lib/hooks/useRefDataEntityInstance';
// v11.0.0: Use queryClient-based sync accessor for immediate resolution
import { getEntityInstanceNameSync } from '@/db/cache/stores';
import { InlineSpinner } from './EllipsisBounce';

export interface EntityInstanceNameSelectProps {
  entityCode: string;       // e.g., "employee", "project", "client"
  value: string;            // Current UUID
  currentLabel?: string;    // Current display label (for backwards compatibility)
  onChange: (uuid: string, label: string) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;      // For inline editing - auto-open dropdown
}

/**
 * EntityInstanceNameSelect - Searchable single-select dropdown for entity references
 *
 * Used for all entity foreign key fields (_ID fields like manager__employee_id)
 * Metadata-driven: inputType: EntityInstanceNameSelect
 *
 * Features:
 * - Type-to-search filtering
 * - Keyboard navigation (Arrow keys, Enter, Escape)
 * - Click outside to close
 * - Loading state with spinner
 * - Uses ref_data_entityInstance cache (single source of truth)
 *
 * @example
 * <EntityInstanceNameSelect
 *   entityCode="employee"
 *   value="uuid-123"
 *   onChange={(uuid, label) => handleChange(uuid, label)}
 * />
 */
export function EntityInstanceNameSelect({
  entityCode,
  value,
  currentLabel,
  onChange,
  disabled = false,
  required = false,
  placeholder,
  className = '',
  autoFocus = false
}: EntityInstanceNameSelectProps) {
  const [isOpen, setIsOpen] = useState(autoFocus);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Local state for immediate UI feedback (before parent re-renders from async Dexie update)
  const [localValue, setLocalValue] = useState(value);
  const [localLabel, setLocalLabel] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  // Use unified ref_data_entityInstance cache
  const { options, isLoading } = useRefDataEntityInstanceOptions(entityCode);

  // Sync local value with prop when prop changes (parent finally re-rendered)
  useEffect(() => {
    setLocalValue(value);
    setLocalLabel(null); // Clear local label, use prop-based resolution
  }, [value]);

  // Filter options based on search term
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get current selected option label
  // v11.0.0: Use TanStack Query cache accessor for immediate resolution when options not yet loaded
  // Use localValue for display (updates immediately on selection)
  const selectedOption = options.find(opt => opt.value === localValue);
  const cachedName = localValue ? getEntityInstanceNameSync(entityCode, localValue) : null;
  const displayLabel = localLabel || selectedOption?.label || cachedName || currentLabel || '';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
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

  // Reset highlighted index when filtered options change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchTerm]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && optionsRef.current) {
      const highlightedElement = optionsRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  // Handle option selection
  const selectOption = useCallback((optionValue: string, optionLabel: string) => {
    // Update local state immediately for instant UI feedback
    setLocalValue(optionValue);
    setLocalLabel(optionLabel);
    // Notify parent (may be async if using Dexie drafts)
    onChange(optionValue, optionLabel);
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
  }, [onChange]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          const option = filteredOptions[highlightedIndex];
          selectOption(option.value, option.label);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
        break;
      case 'Tab':
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
        break;
    }
  }, [isOpen, filteredOptions, highlightedIndex, selectOption]);

  // Handle clearing selection
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Update local state immediately
    setLocalValue('');
    setLocalLabel(null);
    onChange('', '');
  };

  if (isLoading) {
    return <span className="text-dark-400 text-sm"><InlineSpinner /></span>;
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger button */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`
          min-h-[32px] w-full border border-gray-300 rounded bg-white px-2.5 py-1
          flex items-center justify-between cursor-pointer transition-colors
          ${disabled ? 'bg-gray-50 cursor-not-allowed opacity-60' : 'hover:border-gray-400'}
          ${isOpen ? 'ring-1 ring-slate-500 border-slate-500' : ''}
        `}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className={`text-sm truncate ${localValue ? 'text-gray-900' : 'text-gray-500'}`}>
          {displayLabel || placeholder || `Select ${entityCode}...`}
        </span>
        <div className="flex items-center gap-1 ml-2">
          {localValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
              title="Clear selection"
            >
              <span className="text-xs">×</span>
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'transform rotate-180' : ''}`}
          />
        </div>
      </div>

      {/* Dropdown menu */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-200 bg-gray-50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Search ${entityCode}...`}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Options list */}
          <div ref={optionsRef} className="max-h-48 overflow-y-auto" role="listbox">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-3 text-sm text-gray-500 text-center">
                No {entityCode} found
              </div>
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = option.value === value;
                const isHighlighted = index === highlightedIndex;
                return (
                  <div
                    key={option.value}
                    onClick={() => selectOption(option.value, option.label)}
                    className={`
                      flex items-center justify-between px-3 py-2 cursor-pointer transition-colors
                      ${isHighlighted ? 'bg-slate-100' : ''}
                      ${isSelected ? 'bg-slate-50 text-slate-900' : 'text-gray-700'}
                      ${!isHighlighted && !isSelected ? 'hover:bg-gray-50' : ''}
                    `}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span className={`text-sm truncate ${isSelected ? 'font-medium' : ''}`}>
                      {option.label}
                    </span>
                    {isSelected && (
                      <Check className="w-4 h-4 text-slate-600 flex-shrink-0 ml-2" />
                    )}
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
