/**
 * ============================================================================
 * COLORED DROPDOWN - Shared dropdown component with Portal rendering
 * ============================================================================
 *
 * Purpose: Reusable dropdown for settings fields with colored badges
 * Used by: EntityDataTable, SettingsDataTable (via DataTableBase)
 *
 * Key Features:
 * - Portal rendering (avoids table overflow clipping)
 * - Dynamic positioning (opens upward/downward based on available space)
 * - Auto-updates position on scroll/resize
 * - Colored badge rendering for settings
 *
 * Architecture:
 * - Shared component in base table ecosystem
 * - Can be used by any table extension
 */

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { renderSettingBadge } from '../../../lib/universalFormatterService';

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
          const maxDropdownHeight = 240; // max-h-60 = 240px
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
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(e);
          setDropdownOpen(!dropdownOpen);
        }}
        className="w-full px-2.5 py-1.5 pr-8 border border-dark-400 rounded-md focus:ring-2 focus:ring-dark-700/30 focus:border-dark-400 bg-dark-100 shadow-sm hover:border-dark-400 transition-colors cursor-pointer text-left"
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
          <span className="text-dark-600">{placeholder}</span>
        )}
      </button>
      <ChevronDown className="h-4 w-4 text-dark-700 absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none" />

      {/* Dropdown menu - rendered via portal to avoid overflow clipping */}
      {dropdownOpen && createPortal(
        <div
          ref={dropdownRef}
          className="bg-dark-100 border border-dark-300 rounded-md overflow-auto"
          style={{
            position: 'absolute',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            maxHeight: '240px',
            zIndex: 9999,
            boxShadow: dropdownPosition.openUpward
              ? '0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)'
              : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          }}
        >
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
                    setDropdownOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-dark-100 transition-colors flex items-center"
                >
                  {renderSettingBadge(optionColor, String(opt.label))}
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
