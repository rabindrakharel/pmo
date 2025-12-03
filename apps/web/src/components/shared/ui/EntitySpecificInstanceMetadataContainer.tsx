/**
 * ============================================================================
 * ENTITY SPECIFIC INSTANCE METADATA CONTAINER
 * ============================================================================
 *
 * Provides consistent, compact metadata field rendering for entity detail page headers.
 * Includes copy-to-clipboard, inline editing support, and debounced input for performance.
 *
 * Components:
 * - EntityMetadataField: Individual field with label, value, copy, and edit support
 * - EntityMetadataRow: Flex container for grouping fields
 * - EntityMetadataSeparator: Visual dot separator between fields
 */

import React from 'react';
import { Copy, Check } from 'lucide-react';
import { DebouncedInput } from './DebouncedInput';

interface EntityMetadataFieldProps {
  label: string;
  value: string;
  isEditing?: boolean;
  canCopy?: boolean;
  copiedField?: string | null;
  fieldKey: string;
  onCopy?: (value: string, key: string) => void;
  onChange?: (key: string, value: string) => void;
  placeholder?: string;
  prefix?: string;
  className?: string;
  inputWidth?: string;
  badge?: React.ReactNode;
}

/**
 * EntityMetadataField Component
 *
 * Reusable component for displaying entity metadata with:
 * - Compact inline layout
 * - Copy to clipboard functionality
 * - Inline editing support with DEBOUNCED input (prevents re-renders on every keystroke)
 * - Consistent styling
 */
export function EntityMetadataField({
  label,
  value,
  isEditing = false,
  canCopy = true,
  copiedField,
  fieldKey,
  onCopy,
  onChange,
  placeholder,
  prefix,
  className = '',
  inputWidth = '10rem',
  badge
}: EntityMetadataFieldProps) {
  const labelClass = 'text-gray-400 font-normal text-xs flex-shrink-0';
  const valueClass = `text-gray-600 font-normal text-sm ${className}`;

  if (!value && !isEditing) return null;

  return (
    <>
      <span className={labelClass}>{label}:</span>

      {badge ? (
        // Badge rendering (for version, status, etc.)
        badge
      ) : isEditing ? (
        // Edit mode - DEBOUNCED input for performance (prevents re-renders on every keystroke)
        <div className="flex items-center">
          {prefix && <span className="text-dark-700 text-xs mr-0.5">{prefix}</span>}
          <DebouncedInput
            type="text"
            value={value}
            onChange={(newValue) => onChange?.(fieldKey, newValue)}
            debounceMs={300}
            placeholder={placeholder}
            className={`${valueClass} border-0 bg-dark-100/80 focus:bg-dark-100 focus:ring-1 focus:ring-dark-700 rounded px-2 py-0.5 transition-all duration-200`}
            style={{
              width: inputWidth
            }}
          />
        </div>
      ) : (
        // View mode - text with copy button
        <div className="flex items-center gap-1 group">
          <span className={valueClass}>
            {prefix}{value}
          </span>
          {canCopy && onCopy && (
            <button
              onClick={() => onCopy(value, fieldKey)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-all duration-200"
              title={`Copy ${label.toLowerCase()}`}
            >
              {copiedField === fieldKey ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3 text-gray-400 hover:text-gray-600" />
              )}
            </button>
          )}
        </div>
      )}
    </>
  );
}

interface EntityMetadataRowProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * EntityMetadataRow Component
 *
 * Container for metadata fields with consistent, compact spacing
 */
export function EntityMetadataRow({ children, className = '' }: EntityMetadataRowProps) {
  return (
    <div className={`flex items-center gap-3 flex-wrap ${className}`}>
      {children}
    </div>
  );
}

interface EntityMetadataSeparatorProps {
  show?: boolean;
}

/**
 * EntityMetadataSeparator Component
 *
 * Visual separator between metadata fields
 */
export function EntityMetadataSeparator({ show = true }: EntityMetadataSeparatorProps) {
  if (!show) return null;
  return <span className="text-gray-200 flex-shrink-0 mx-2">·</span>;
}
