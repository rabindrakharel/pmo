// ============================================================================
// VIEW FIELD RENDERER - Inline View Mode Rendering
// ============================================================================
// Version: 12.2.0
//
// Handles inline view rendering for fields that don't require custom components.
// Uses pre-formatted data from formatDataset() when available, or formats inline.
//
// Aligns with view-type-mapping.yaml renderType values:
// - text, number, currency, percentage, date, timestamp, time
// - duration, boolean, filesize, badge, entityLink, entityLinks
// - tags, file, image, avatar, color, icon, json
// ============================================================================

import type { ReactElement } from 'react';
import type { ComponentRendererProps } from './ComponentRegistry';
import { getEntityInstanceNameSync } from '@/db/tanstack-index';

// ============================================================================
// renderViewField - Main Entry Point
// ============================================================================

/**
 * Render a field in view mode
 *
 * Uses pre-formatted data from formattedData.display when available.
 * Falls back to inline formatting based on renderType.
 *
 * @param props - Component renderer props
 * @returns React element for the field display
 */
export function renderViewField(props: ComponentRendererProps): ReactElement {
  const { value, field, formattedData, refData, className } = props;
  const { key, renderType, style } = field;

  // ========================================================================
  // Use Pre-Formatted Data (Format-at-Read Pattern)
  // ========================================================================

  // If formattedData exists, prefer it (from formatDataset via TanStack Query select)
  if (formattedData?.display?.[key] !== undefined) {
    const displayValue = formattedData.display[key];
    const styleClasses = formattedData.styles?.[key] || '';

    // Badge rendering with colored background
    if (renderType === 'badge' && styleClasses) {
      return (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styleClasses} ${className || ''}`}
        >
          {displayValue}
        </span>
      );
    }

    // Default text rendering with style
    return (
      <span className={`${styleClasses} ${className || ''}`}>
        {displayValue}
      </span>
    );
  }

  // ========================================================================
  // Inline Formatting (Fallback)
  // ========================================================================

  // Handle null/undefined values
  if (value === null || value === undefined || value === '') {
    const emptyValue = style?.emptyValue || '—';
    return (
      <span className={`text-gray-400 ${className || ''}`}>
        {emptyValue}
      </span>
    );
  }

  // Format based on renderType
  switch (renderType) {
    // --------------------------------------------------------------------
    // TEXT TYPES
    // --------------------------------------------------------------------
    case 'text':
      return (
        <span className={className}>
          {String(value)}
        </span>
      );

    // --------------------------------------------------------------------
    // NUMERIC TYPES
    // --------------------------------------------------------------------
    case 'number':
      return (
        <span className={`font-mono ${className || ''}`}>
          {formatNumber(value, style)}
        </span>
      );

    case 'currency':
      return (
        <span className={`font-mono ${className || ''}`}>
          {formatCurrency(value, style)}
        </span>
      );

    case 'percentage':
      return (
        <span className={`font-mono ${className || ''}`}>
          {formatPercentage(value, style)}
        </span>
      );

    // --------------------------------------------------------------------
    // DATE/TIME TYPES
    // --------------------------------------------------------------------
    case 'date':
      return (
        <span className={className}>
          {formatDate(value, style)}
        </span>
      );

    case 'timestamp':
      return (
        <span className={className}>
          {formatTimestamp(value, style)}
        </span>
      );

    case 'time':
      return (
        <span className={className}>
          {formatTime(value)}
        </span>
      );

    case 'duration':
      return (
        <span className={className}>
          {formatDuration(value, style)}
        </span>
      );

    // --------------------------------------------------------------------
    // BOOLEAN
    // --------------------------------------------------------------------
    case 'boolean':
      return (
        <span className={`${value ? 'text-green-600' : 'text-gray-500'} ${className || ''}`}>
          {formatBoolean(value, style)}
        </span>
      );

    // --------------------------------------------------------------------
    // BADGE (Datalabel)
    // --------------------------------------------------------------------
    case 'badge':
      return (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 ${className || ''}`}
        >
          {String(value)}
        </span>
      );

    // --------------------------------------------------------------------
    // ENTITY REFERENCES
    // --------------------------------------------------------------------
    case 'entityLink':
    case 'entityInstanceId': {
      // Resolve entity instance name using:
      // 1. refData from API response (preferred)
      // 2. TanStack Query cache via getEntityInstanceNameSync
      // 3. Fallback to truncated UUID
      const lookupEntity = field.lookupEntity;
      let displayName: string | null = null;

      // Try refData first (from API response ref_data_entityInstance)
      if (refData && lookupEntity && refData[lookupEntity]) {
        displayName = refData[lookupEntity][String(value)] || null;
      }

      // Try TanStack Query cache
      if (!displayName && lookupEntity) {
        displayName = getEntityInstanceNameSync(lookupEntity, String(value));
      }

      // Fallback to truncated UUID if name not found
      if (!displayName) {
        displayName = `${String(value).slice(0, 8)}...`;
      }

      return (
        <span className={`text-blue-600 ${className || ''}`}>
          {displayName}
        </span>
      );
    }

    case 'entityLinks':
    case 'entityInstanceIds': {
      // Array of entity references - resolve names
      if (!Array.isArray(value) || value.length === 0) {
        return <span className={className}>—</span>;
      }

      const lookupEntityMulti = field.lookupEntity;
      const maxDisplay = style?.maxDisplay || 3;
      const displayItems = value.slice(0, maxDisplay);
      const remaining = value.length - maxDisplay;

      const resolvedNames = displayItems.map((id: string) => {
        let name: string | null = null;

        // Try refData first
        if (refData && lookupEntityMulti && refData[lookupEntityMulti]) {
          name = refData[lookupEntityMulti][String(id)] || null;
        }

        // Try TanStack Query cache
        if (!name && lookupEntityMulti) {
          name = getEntityInstanceNameSync(lookupEntityMulti, String(id));
        }

        // Fallback to truncated UUID
        return name || `${String(id).slice(0, 8)}...`;
      });

      return (
        <span className={`flex flex-wrap gap-1 ${className || ''}`}>
          {resolvedNames.map((name: string, i: number) => (
            <span
              key={i}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700"
            >
              {name}
            </span>
          ))}
          {remaining > 0 && (
            <span className="text-xs text-gray-500">+{remaining} more</span>
          )}
        </span>
      );
    }

    // --------------------------------------------------------------------
    // TAGS
    // --------------------------------------------------------------------
    case 'tags':
      if (Array.isArray(value)) {
        const maxDisplay = style?.maxDisplay || 3;
        const tags = value.slice(0, maxDisplay);
        const remaining = value.length - maxDisplay;

        return (
          <span className={`flex flex-wrap gap-1 ${className || ''}`}>
            {tags.map((tag: string, i: number) => (
              <span
                key={i}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700"
              >
                {tag}
              </span>
            ))}
            {remaining > 0 && (
              <span className="text-xs text-gray-500">+{remaining}</span>
            )}
          </span>
        );
      }
      return <span className={className}>—</span>;

    // --------------------------------------------------------------------
    // FILES & MEDIA
    // --------------------------------------------------------------------
    case 'file':
      return (
        <span className={`text-blue-600 underline ${className || ''}`}>
          {typeof value === 'string' ? value.split('/').pop() : 'File'}
        </span>
      );

    case 'image':
    case 'avatar':
      return (
        <img
          src={String(value)}
          alt=""
          className={`h-8 w-8 rounded ${renderType === 'avatar' ? 'rounded-full' : ''} object-cover ${className || ''}`}
        />
      );

    // --------------------------------------------------------------------
    // COLOR
    // --------------------------------------------------------------------
    case 'color':
      return (
        <span className={`flex items-center gap-2 ${className || ''}`}>
          <span
            className="w-4 h-4 rounded border border-gray-200"
            style={{ backgroundColor: String(value) }}
          />
          {style?.showHex && (
            <span className="font-mono text-xs">{String(value)}</span>
          )}
        </span>
      );

    // --------------------------------------------------------------------
    // JSON
    // --------------------------------------------------------------------
    case 'json':
      return (
        <pre className={`text-xs font-mono bg-gray-50 p-2 rounded overflow-auto max-h-32 ${className || ''}`}>
          {JSON.stringify(value, null, 2)}
        </pre>
      );

    // --------------------------------------------------------------------
    // FILESIZE
    // --------------------------------------------------------------------
    case 'filesize':
      return (
        <span className={`font-mono ${className || ''}`}>
          {formatFilesize(value)}
        </span>
      );

    // --------------------------------------------------------------------
    // ICON
    // --------------------------------------------------------------------
    case 'icon':
      return (
        <span className={className}>
          {String(value)}
        </span>
      );

    // --------------------------------------------------------------------
    // DEFAULT
    // --------------------------------------------------------------------
    default:
      return (
        <span className={className}>
          {String(value)}
        </span>
      );
  }
}

// ============================================================================
// Formatting Helpers
// ============================================================================

function formatNumber(value: any, style?: Record<string, any>): string {
  const num = Number(value);
  if (isNaN(num)) return String(value);

  const decimals = style?.decimals ?? 0;
  const locale = style?.locale || 'en-CA';

  let formatted = num.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  if (style?.unit) {
    formatted += ` ${style.unit}`;
  }

  return formatted;
}

function formatCurrency(value: any, style?: Record<string, any>): string {
  const num = Number(value);
  if (isNaN(num)) return String(value);

  const symbol = style?.symbol || '$';
  const decimals = style?.decimals ?? 2;
  const locale = style?.locale || 'en-CA';

  // Handle cents conversion
  const amount = style?.cents ? num / 100 : num;

  return `${symbol}${amount.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

function formatPercentage(value: any, style?: Record<string, any>): string {
  const num = Number(value);
  if (isNaN(num)) return String(value);

  const decimals = style?.decimals ?? 0;

  return `${num.toFixed(decimals)}%`;
}

function formatDate(value: any, style?: Record<string, any>): string {
  try {
    const date = new Date(value);
    const locale = style?.locale || 'en-CA';
    const format = style?.format || 'short';

    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: format === 'short' ? 'short' : 'long',
      day: 'numeric',
    };

    return date.toLocaleDateString(locale, options);
  } catch {
    return String(value);
  }
}

function formatTimestamp(value: any, style?: Record<string, any>): string {
  try {
    const date = new Date(value);
    const locale = style?.locale || 'en-CA';
    const format = style?.format || 'datetime';

    if (format === 'relative') {
      return formatRelativeTime(date);
    }

    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    };

    return date.toLocaleString(locale, options);
  } catch {
    return String(value);
  }
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

function formatTime(value: any): string {
  if (typeof value === 'string' && /^\d{2}:\d{2}/.test(value)) {
    return value.slice(0, 5);
  }
  try {
    const date = new Date(value);
    return date.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(value);
  }
}

function formatDuration(value: any, style?: Record<string, any>): string {
  const num = Number(value);
  if (isNaN(num)) return String(value);

  const unit = style?.unit || 'minutes';

  switch (unit) {
    case 'ms':
      return `${num}ms`;
    case 'seconds':
      return num < 60 ? `${num}s` : `${Math.floor(num / 60)}m ${num % 60}s`;
    case 'minutes':
      return num < 60 ? `${num}m` : `${Math.floor(num / 60)}h ${num % 60}m`;
    case 'hours':
      return `${num}h`;
    default:
      return `${num} ${unit}`;
  }
}

function formatBoolean(value: any, style?: Record<string, any>): string {
  const isTrue = value === true || value === 'true' || value === 1;
  const trueLabel = style?.trueLabel || 'Yes';
  const falseLabel = style?.falseLabel || 'No';

  return isTrue ? trueLabel : falseLabel;
}

function formatFilesize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}
