/**
 * ============================================================================
 * METADATA COMPONENTS - Reusable UI components for entity metadata
 * ============================================================================
 *
 * Provides consistent, compact metadata field rendering across entity pages.
 * Includes copy-to-clipboard and inline editing support.
 */

import React from 'react';
import { Copy, Check } from 'lucide-react';

interface MetadataFieldProps {
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
 * MetadataField Component
 *
 * Reusable component for displaying entity metadata with:
 * - Compact inline layout
 * - Copy to clipboard functionality
 * - Inline editing support
 * - Consistent styling
 */
export function MetadataField({
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
}: MetadataFieldProps) {
  const labelClass = 'text-gray-400 font-normal text-xs flex-shrink-0';
  const valueClass = `text-gray-700 font-medium text-sm ${className}`;

  if (!value && !isEditing) return null;

  return (
    <>
      <span className={labelClass}>{label}:</span>

      {badge ? (
        // Badge rendering (for version, status, etc.)
        badge
      ) : isEditing ? (
        // Edit mode - input field
        <div className="flex items-center">
          {prefix && <span className="text-dark-700 text-xs mr-0.5">{prefix}</span>}
          <input
            type="text"
            value={value}
            onChange={(e) => onChange?.(fieldKey, e.target.value)}
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

interface MetadataRowProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * MetadataRow Component
 *
 * Container for metadata fields with consistent, compact spacing
 */
export function MetadataRow({ children, className = '' }: MetadataRowProps) {
  return (
    <div className={`flex items-center gap-3 flex-wrap ${className}`}>
      {children}
    </div>
  );
}

interface MetadataSeparatorProps {
  show?: boolean;
}

/**
 * MetadataSeparator Component
 *
 * Visual separator between metadata fields
 */
export function MetadataSeparator({ show = true }: MetadataSeparatorProps) {
  if (!show) return null;
  return <span className="text-gray-200 flex-shrink-0 mx-2">·</span>;
}
