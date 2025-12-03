/**
 * ============================================================================
 * ENTITY INSTANCE NAME MULTI-SELECT - Multi-select dropdown for entity references
 * ============================================================================
 *
 * Used for entityInstanceIds fields (array of UUIDs referencing multiple entities)
 * e.g., stakeholder__employee_ids, assigned__employee_ids
 *
 * Metadata-driven: inputType: EntityInstanceNameMultiSelect
 */
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { useRefDataEntityInstanceOptions } from '@/lib/hooks/useRefDataEntityInstance';
// v11.0.0: Use queryClient-based sync accessor for immediate resolution
import { getEntityInstanceNameSync } from '@/db/cache/stores';
import { InlineSpinner } from './EllipsisBounce';
import { Chip } from './Chip';

export interface EntityInstanceNameMultiSelectProps {
  entityCode: string;         // e.g., "employee", "project", "client"
  value: string[];            // Current array of UUIDs
  onChange: (uuids: string[]) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  maxDisplayed?: number;      // Max chips to show before "+N more"
}

/**
 * EntityInstanceNameMultiSelect - Searchable multi-select dropdown for entity reference arrays
 *
 * Used for all entity foreign key array fields (_IDS fields like stakeholder__employee_ids)
 * Metadata-driven: inputType: EntityInstanceNameMultiSelect
 *
 * Features:
 * - Type-to-search filtering
 * - Multi-select with checkboxes
 * - Selected items shown as removable chips
 * - Keyboard navigation
 * - Uses ref_data_entityInstance cache (single source of truth)
 */
export function EntityInstanceNameMultiSelect({
  entityCode,
  value = [],
  onChange,
  disabled = false,
  required = false,
  placeholder,
  className = '',
  maxDisplayed = 5
}: EntityInstanceNameMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // ============================================================================
  // LOCAL-FIRST CONTROLLED COMPONENT PATTERN
  // ============================================================================
  // Pattern: docs/design_pattern/update_edit_statemanagement.md
  // Local state for immediate UI feedback before parent re-renders from async Dexie update
  // localValue: Current selected UUIDs array for instant display
  // ============================================================================
  const [localValue, setLocalValue] = useState<string[]>(value);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Use unified ref_data_entityInstance cache
  const { options, isLoading } = useRefDataEntityInstanceOptions(entityCode);

  // Sync local value with prop when prop changes (parent finally re-rendered)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Filter options based on search term
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get selected options with labels - use localValue for immediate UI
  // v11.0.0: Use TanStack Query cache accessor as fallback when options not yet loaded
  const selectedOptions = localValue
    .map(uuid => {
      // First try TanStack Query options
      const fromOptions = options.find(opt => opt.value === uuid);
      if (fromOptions) return fromOptions;

      // Fallback to TanStack Query cache for immediate resolution
      const cachedName = getEntityInstanceNameSync(entityCode, uuid);
      if (cachedName) return { value: uuid, label: cachedName };

      // Last resort: show truncated UUID
      return { value: uuid, label: uuid.substring(0, 8) + '...' };
    });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
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

  // Toggle selection
  const toggleOption = (uuid: string) => {
    let newValue: string[];
    if (localValue.includes(uuid)) {
      newValue = localValue.filter(v => v !== uuid);
    } else {
      newValue = [...localValue, uuid];
    }
    // Update local state immediately for instant UI feedback
    setLocalValue(newValue);
    // Notify parent (may be async if using Dexie drafts)
    onChange(newValue);
  };

  // Remove a selected item
  const removeItem = (uuid: string) => {
    const newValue = localValue.filter(v => v !== uuid);
    // Update local state immediately
    setLocalValue(newValue);
    onChange(newValue);
  };

  // Chips to display (with overflow handling)
  const displayedChips = selectedOptions.slice(0, maxDisplayed);
  const overflowCount = selectedOptions.length - maxDisplayed;

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Selected items display + trigger button */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`
          min-h-[36px] w-full border border-gray-300 rounded bg-white px-2.5 py-1.5
          flex flex-wrap gap-1.5 items-center cursor-pointer transition-colors
          ${disabled ? 'bg-gray-50 cursor-not-allowed opacity-60' : 'hover:border-gray-400'}
          ${isOpen ? 'ring-1 ring-slate-500 border-slate-500' : ''}
        `}
      >
        {selectedOptions.length === 0 ? (
          <span className="text-gray-500 text-sm py-0.5">
            {placeholder || `Select ${entityCode}...`}
          </span>
        ) : (
          <>
            {displayedChips.map(option => (
              <Chip
                key={option.value}
                label={option.label}
                size="sm"
                maxWidth="120px"
                colorClass="bg-slate-100 text-slate-700 border border-slate-300"
                removable={!disabled}
                onRemove={() => removeItem(option.value)}
              />
            ))}
            {overflowCount > 0 && (
              <span className="text-xs text-slate-500 font-medium px-1">
                +{overflowCount} more
              </span>
            )}
          </>
        )}
        <div className="ml-auto flex items-center gap-1">
          {isLoading && <InlineSpinner size="sm" />}
          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {/* Dropdown menu */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-[400px] overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-200 bg-gray-50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Search ${entityCode}...`}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-72 overflow-y-auto">
            {isLoading ? (
              <div className="px-3 py-4 text-center">
                <InlineSpinner size="md" />
                <span className="text-sm text-gray-500 ml-2">Loading...</span>
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="px-3 py-3 text-sm text-gray-500 text-center">
                {searchTerm ? 'No matches found' : `No ${entityCode} available`}
              </div>
            ) : (
              filteredOptions.map(option => {
                const isSelected = localValue.includes(option.value);
                return (
                  <div
                    key={option.value}
                    onClick={() => toggleOption(option.value)}
                    className={`
                      flex items-center px-3 py-2 cursor-pointer transition-colors
                      ${isSelected ? 'bg-slate-50' : 'hover:bg-gray-50'}
                    `}
                  >
                    <div className={`
                      w-4 h-4 border rounded mr-3 flex items-center justify-center flex-shrink-0
                      ${isSelected ? 'bg-slate-600 border-slate-600' : 'border-gray-300'}
                    `}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className={`text-sm truncate ${isSelected ? 'text-slate-700 font-medium' : 'text-gray-700'}`}>
                      {option.label}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer with count */}
          {selectedOptions.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
              {selectedOptions.length} selected
            </div>
          )}
        </div>
      )}
    </div>
  );
}
