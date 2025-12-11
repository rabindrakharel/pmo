/**
 * ============================================================================
 * BADGE DROPDOWN SELECT - Shared dropdown component with Portal rendering
 * ============================================================================
 *
 * v13.1: Design System Compliance
 * - White surface backgrounds (bg-white)
 * - Visible hover states (hover:bg-dark-50)
 * - Consistent focus states (focus-visible:ring-slate-500/30)
 *
 * v8.3.2: Renamed from ColoredDropdown to BadgeDropdownSelect
 *
 * Purpose: Reusable dropdown for datalabel fields with colored badges
 * Used by: EntityListOfInstancesTable, EntityInstanceFormContainer, SettingsDataTable
 *
 * Key Features:
 * - Portal rendering (avoids table overflow clipping)
 * - Dynamic positioning (opens upward/downward based on available space)
 * - Auto-updates position on scroll/resize
 * - Colored badge rendering for datalabel options
 * - Options loaded from datalabel cache (format-at-read pattern)
 *
 * YAML Configuration (edit-type-mapping.yaml):
 *   inputType: BadgeDropdownSelect
 *   lookupSource: datalabel
 *
 * Architecture:
 * - Shared component in base table ecosystem
 * - Can be used by any table extension or form container
 */

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export interface BadgeDropdownSelectOption {
  value: string | number;
  label: string;
  metadata?: {
    color_code?: string;
  };
}

export interface BadgeDropdownSelectProps {
  value: string;
  options: BadgeDropdownSelectOption[];
  onChange: (value: string) => void;
  onClick?: (e: React.MouseEvent) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function BadgeDropdownSelect({
  value,
  options,
  onChange,
  onClick,
  placeholder = 'Select...',
  disabled = false
}: BadgeDropdownSelectProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
    openUpward: false
  });

  // Update dropdown position when it opens or on scroll/resize
  useEffect(() => {
    if (dropdownOpen && buttonRef.current) {
      const updatePosition = () => {
        if (buttonRef.current) {
          const rect = buttonRef.current.getBoundingClientRect();
          const maxDropdownHeight = 400; // Show at least 10 items (40px each)
          const viewportHeight = window.innerHeight;
          const spaceBelow = viewportHeight - rect.bottom - 20; // 20px buffer
          const spaceAbove = rect.top - 20; // 20px buffer

          // Calculate actual content height (estimate)
          const estimatedItemHeight = 40; // px per item
          const estimatedContentHeight = Math.min(options.length * estimatedItemHeight, maxDropdownHeight);

          // Decide if dropdown should open upward
          const shouldOpenUpward = spaceBelow < estimatedContentHeight && spaceAbove > spaceBelow;

          // Calculate position
          let top: number;
          if (shouldOpenUpward) {
            // Open above: position so bottom of dropdown aligns near top of button
            const availableHeight = Math.min(estimatedContentHeight, spaceAbove);
            top = rect.top + window.scrollY - availableHeight - 4;
          } else {
            // Open below: position just below the button
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
  }, [dropdownOpen, options.length]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);
  const selectedColor = selectedOption?.metadata?.color_code;

  return (
    <div className="relative w-full">
      {/* Selected value display */}
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={(e) => {
          if (disabled) return;
          e.stopPropagation();
          onClick?.(e);
          setDropdownOpen(!dropdownOpen);
        }}
        className={`w-full px-1.5 py-0.5 pr-6 border border-dark-border-medium rounded focus-visible:ring-1 focus-visible:ring-dark-accent-ring focus-visible:border-dark-border-strong focus-visible:outline-none bg-dark-surface hover:border-dark-border-strong transition-colors text-left text-xs ${disabled ? 'cursor-not-allowed opacity-50 bg-dark-subtle' : 'cursor-pointer'}`}
      >
        {selectedOption ? (
          <span className={`inline-flex items-center px-1.5 py-px rounded text-[10px] font-medium ${selectedColor || 'bg-dark-subtle text-dark-text-primary'}`}>
            {selectedOption.label}
          </span>
        ) : (
          <span className="text-dark-text-placeholder">{placeholder}</span>
        )}
      </button>
      <ChevronDown className="h-3 w-3 text-dark-text-placeholder absolute right-1.5 top-1/2 transform -translate-y-1/2 pointer-events-none" />

      {/* Dropdown menu - rendered via portal to avoid overflow clipping */}
      {dropdownOpen && createPortal(
        <div
          ref={dropdownRef}
          data-dropdown-portal=""
          className="bg-dark-surface border border-dark-border-default rounded-lg overflow-auto"
          style={{
            position: 'absolute',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${Math.max(dropdownPosition.width, 120)}px`,
            maxHeight: '300px',
            zIndex: 9999,
            boxShadow: dropdownPosition.openUpward
              ? '0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)'
              : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          }}
        >
          <div className="py-0.5">
            {options.map(opt => {
              const optionColor = opt.metadata?.color_code || 'bg-dark-subtle text-dark-text-primary';
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(opt.value as string);
                    setDropdownOpen(false);
                  }}
                  className={`w-full px-2 py-1 text-left transition-colors flex items-center ${
                    isSelected ? 'bg-dark-hover' : 'hover:bg-dark-hover'
                  } focus-visible:bg-dark-active focus-visible:outline-none`}
                >
                  <span className={`inline-flex items-center px-1.5 py-px rounded text-[10px] font-medium ${optionColor}`}>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
