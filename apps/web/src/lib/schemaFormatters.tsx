/**
 * ============================================================================
 * SCHEMA FORMATTERS - Thin Wrapper Around Existing Formatters
 * ============================================================================
 *
 * Format field values based on schema format specification.
 * Thin wrapper that delegates to existing formatters in data_transform_render.tsx.
 *
 * BENEFITS:
 * - Reuses existing, tested formatters
 * - Consistent formatting across old and new code
 * - Less code to maintain
 * - Faster implementation
 *
 * USAGE:
 * ```typescript
 * import { formatFieldValue } from './schemaFormatters';
 *
 * const formatted = formatFieldValue(value, schemaColumn);
 * ```
 */

import React from 'react';
import type { SchemaColumn } from './types/table';
import {
  formatCurrency,
  formatRelativeTime,
  renderSettingBadge,
  getSettingColor
} from './data_transform_render';
import { formatters } from './config/locale';
import { DISPLAY_CONFIG } from './config/display';

/**
 * Format field value based on schema format specification
 * Thin wrapper that delegates to existing formatters
 */
export function formatFieldValue(
  value: any,
  column: SchemaColumn
): React.ReactNode {
  // Handle null/undefined/empty
  if (value === null || value === undefined || value === '') {
    return <span className="text-dark-600 italic">—</span>;
  }

  const formatType = column.format?.type || 'text';

  switch (formatType) {
    // ✅ REUSE: formatCurrency() from data_transform_render.tsx
    case 'currency':
      return formatCurrency(value);

    // ✅ REUSE: formatRelativeTime() from data_transform_render.tsx
    case 'relative-time':
      return formatRelativeTime(value);

    // ✅ REUSE: renderSettingBadge() from data_transform_render.tsx
    case 'badge': {
      const datalabel = column.format?.settingsDatalabel || column.key.replace('dl__', '');
      const colorCode = getSettingColor(datalabel, String(value));
      return renderSettingBadge(colorCode, String(value));
    }

    // ✅ NUMBER: Format with thousand separators
    case 'number':
      return formatters.number(value);

    // ✅ PERCENTAGE: Simple formatting
    case 'percentage':
      return formatters.percentage(value);

    // ✅ DATE: Use Intl.DateTimeFormat
    case 'date':
      return formatters.date(value);

    // ✅ DATETIME: Use Intl.DateTimeFormat
    case 'datetime':
      return formatters.datetime(value);

    // ✅ BOOLEAN: Render as badge
    case 'boolean':
      return formatBoolean(value, column.key === 'active_flag');

    // ✅ TAGS: Render as tag list
    case 'tags':
      return formatTags(value);

    // ✅ REFERENCE: Render as link
    case 'reference':
      return formatReference(value, column.format?.entityType);

    // ✅ TEXT: Default
    case 'text':
    default:
      return String(value);
  }
}

// ============================================================================
// SIMPLE FORMATTERS (Delegated to centralized locale formatters)
// ============================================================================

// Note: Number, percentage, date, datetime now use centralized formatters
// from lib/config/locale.ts for consistency

function formatBoolean(value: boolean, isActiveFlag: boolean = false): React.ReactNode {
  if (isActiveFlag) {
    const colorClass = value
      ? 'bg-green-100 text-green-800'
      : 'bg-gray-100 text-gray-600';
    const label = value ? 'Active' : 'Inactive';

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
        {label}
      </span>
    );
  }

  return <span className="text-dark-600">{value ? 'Yes' : 'No'}</span>;
}

function formatTags(value: string[] | string): React.ReactNode {
  let tags: string[];

  if (typeof value === 'string') {
    tags = value.split(',').map(t => t.trim()).filter(Boolean);
  } else if (Array.isArray(value)) {
    tags = value;
  } else {
    return String(value);
  }

  if (tags.length === 0) {
    return <span className="text-dark-600 italic">—</span>;
  }

  const maxDisplay = DISPLAY_CONFIG.MAX_TAGS_DISPLAY;
  const displayTags = tags.slice(0, maxDisplay);
  const remaining = tags.length - maxDisplay;

  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {displayTags.map((tag, i) => (
        <span key={i} className="px-2 py-0.5 bg-dark-100 text-dark-600 rounded text-xs">
          {tag}
        </span>
      ))}
      {remaining > 0 && (
        <span className="text-xs text-dark-600">+{remaining} more</span>
      )}
    </span>
  );
}

function formatReference(value: any, entityType?: string): React.ReactNode {
  if (!value) {
    return <span className="text-dark-600 italic">—</span>;
  }

  // If value is object with name, use that; otherwise use value as string
  const displayText = typeof value === 'object' && value.name
    ? value.name
    : String(value);

  const id = typeof value === 'object' && value.id ? value.id : null;

  if (entityType && id) {
    return (
      <a
        href={`/${entityType}/${id}`}
        className="text-dark-600 hover:text-dark-600 underline"
        onClick={(e) => e.stopPropagation()}
      >
        {displayText}
      </a>
    );
  }

  return <span className="text-dark-600">{displayText}</span>;
}
