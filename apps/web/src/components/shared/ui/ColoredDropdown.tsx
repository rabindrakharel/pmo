/**
 * ============================================================================
 * COLORED DROPDOWN - Shared dropdown component with colored badges
 * ============================================================================
 *
 * Used by both EntityDataTable and SettingsDataTable for:
 * - Settings field editing (project_stage, task_priority, etc.)
 * - Color selection
 * - Any dropdown with visual badges
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { renderSettingBadge } from '../../../lib/data_transform_render';

export interface ColoredDropdownOption {
  value: string | number;
  label: string;
  metadata?: {
    color_code?: string;
  };
}

export interface ColoredDropdownProps {
  value: string;
  options: ColoredDropdownOption[];
  onChange: (value: string) => void;
  onClick?: (e: React.MouseEvent) => void;
  placeholder?: string;
}

export function ColoredDropdown({
  value,
  options,
  onChange,
  onClick,
  placeholder = 'Select...'
}: ColoredDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);
  const selectedColor = selectedOption?.metadata?.color_code;

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Selected value display */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(e);
          setIsOpen(!isOpen);
        }}
        className="w-full px-2.5 py-1.5 pr-8 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400/30 focus:border-gray-300 bg-white shadow-sm hover:border-gray-300 transition-colors cursor-pointer text-left"
        style={{
          fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
          fontSize: '13px',
          minHeight: '32px',
          maxHeight: '32px',
        }}
      >
        {selectedOption ? (
          renderSettingBadge(selectedColor, String(selectedOption.label))
        ) : (
          <span className="text-gray-400">{placeholder}</span>
        )}
      </button>
      <ChevronDown className="h-4 w-4 text-gray-500 absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none" />

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
          <div className="py-1">
            {options.map(opt => {
              const optionColor = opt.metadata?.color_code;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(opt.value as string);
                    setIsOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors flex items-center"
                >
                  {renderSettingBadge(optionColor, String(opt.label))}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
