// ============================================================================
// EDIT FIELD RENDERER - Inline Edit Mode Rendering (HTML5 Inputs)
// ============================================================================
// Version: 12.2.0
//
// Handles inline edit rendering for HTML5 native input types that don't
// require custom components.
//
// Aligns with edit-type-mapping.yaml inputType values:
// - text, textarea, email, tel, url, number, date, time, datetime-local
// - checkbox, color, file, range, hidden, readonly
//
// Custom component input types (select, component, BadgeDropdownSelect, etc.)
// are handled by the ComponentRegistry, not this renderer.
// ============================================================================

import { type ReactElement } from 'react';
import type { ComponentRendererProps } from './ComponentRegistry';

// ============================================================================
// renderEditField - Main Entry Point
// ============================================================================

/**
 * Render a field in edit mode using HTML5 native inputs
 *
 * For custom components (select, component, etc.), use ComponentRegistry instead.
 *
 * @param props - Component renderer props
 * @returns React element for the field input
 */
export function renderEditField(props: ComponentRendererProps): ReactElement {
  const { value, field, onChange, disabled, readonly, className } = props;
  const { key, inputType, style, validation } = field;

  // Shared input props
  // v12.3.0: Added text-sm to match view mode font size (prevents font size jump on edit)
  const baseInputClass = `w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
    disabled:bg-gray-100 disabled:cursor-not-allowed
    ${className || ''}`;

  const handleChange = (newValue: any) => {
    if (onChange && !disabled && !readonly) {
      onChange(newValue);
    }
  };

  // ========================================================================
  // READONLY
  // ========================================================================
  if (inputType === 'readonly' || readonly) {
    return (
      <span className={`text-sm text-gray-600 ${style?.monospace ? 'font-mono' : ''} ${className || ''}`}>
        {value !== null && value !== undefined ? String(value) : '—'}
      </span>
    );
  }

  // ========================================================================
  // HIDDEN
  // ========================================================================
  if (inputType === 'hidden') {
    return (
      <input type="hidden" name={key} value={value ?? ''} />
    );
  }

  // ========================================================================
  // Render by inputType
  // ========================================================================
  switch (inputType) {
    // --------------------------------------------------------------------
    // TEXT INPUTS
    // --------------------------------------------------------------------
    case 'text':
    case 'email':
    case 'tel':
    case 'url':
      return (
        <input
          type={inputType}
          name={key}
          value={value ?? ''}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          placeholder={style?.placeholder}
          autoComplete={style?.autocomplete}
          pattern={validation?.pattern}
          minLength={validation?.minLength}
          maxLength={validation?.maxLength}
          required={validation?.required}
          className={baseInputClass}
        />
      );

    // --------------------------------------------------------------------
    // TEXTAREA
    // --------------------------------------------------------------------
    case 'textarea':
      return (
        <textarea
          name={key}
          value={value ?? ''}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          placeholder={style?.placeholder}
          rows={style?.rows || 4}
          minLength={validation?.minLength}
          maxLength={validation?.maxLength}
          required={validation?.required}
          className={`${baseInputClass} ${style?.resizable === false ? 'resize-none' : 'resize-y'}`}
          style={style?.minHeight ? { minHeight: `${style.minHeight}px` } : undefined}
        />
      );

    // --------------------------------------------------------------------
    // NUMBER
    // --------------------------------------------------------------------
    case 'number':
      return (
        <div className="relative">
          {style?.symbol && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              {style.symbol}
            </span>
          )}
          <input
            type="number"
            name={key}
            value={value ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              handleChange(val === '' ? null : Number(val));
            }}
            disabled={disabled}
            placeholder={style?.placeholder}
            min={validation?.min}
            max={validation?.max}
            step={style?.step ?? (style?.decimals ? Math.pow(10, -style.decimals) : undefined)}
            required={validation?.required}
            className={`${baseInputClass} ${style?.symbol ? 'pl-7' : ''} ${style?.unit ? 'pr-12' : ''}`}
          />
          {style?.unit && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
              {style.unit}
            </span>
          )}
        </div>
      );

    // --------------------------------------------------------------------
    // DATE
    // --------------------------------------------------------------------
    case 'date':
      return (
        <input
          type="date"
          name={key}
          value={formatDateForInput(value)}
          onChange={(e) => handleChange(e.target.value || null)}
          disabled={disabled}
          required={validation?.required}
          className={baseInputClass}
        />
      );

    // --------------------------------------------------------------------
    // TIME
    // --------------------------------------------------------------------
    case 'time':
      return (
        <input
          type="time"
          name={key}
          value={value ?? ''}
          onChange={(e) => handleChange(e.target.value || null)}
          disabled={disabled}
          step={style?.step ? style.step * 60 : undefined}
          required={validation?.required}
          className={baseInputClass}
        />
      );

    // --------------------------------------------------------------------
    // DATETIME-LOCAL
    // --------------------------------------------------------------------
    case 'datetime-local':
      return (
        <input
          type="datetime-local"
          name={key}
          value={formatDateTimeForInput(value)}
          onChange={(e) => handleChange(e.target.value || null)}
          disabled={disabled}
          required={validation?.required}
          className={baseInputClass}
        />
      );

    // --------------------------------------------------------------------
    // CHECKBOX
    // --------------------------------------------------------------------
    case 'checkbox':
      return (
        <label className={`flex items-center gap-2 ${className || ''}`}>
          <input
            type="checkbox"
            name={key}
            checked={Boolean(value)}
            onChange={(e) => handleChange(e.target.checked)}
            disabled={disabled}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          {style?.label && (
            <span className="text-sm text-gray-700">
              {value ? (style.trueLabel || 'Yes') : (style.falseLabel || 'No')}
            </span>
          )}
        </label>
      );

    // --------------------------------------------------------------------
    // COLOR
    // --------------------------------------------------------------------
    case 'color':
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            name={key}
            value={value ?? '#000000'}
            onChange={(e) => handleChange(e.target.value)}
            disabled={disabled}
            className="h-8 w-12 p-1 border border-gray-300 rounded cursor-pointer"
          />
          <input
            type="text"
            value={value ?? ''}
            onChange={(e) => handleChange(e.target.value)}
            disabled={disabled}
            placeholder="#000000"
            pattern="^#[0-9A-Fa-f]{6}$"
            className={`${baseInputClass} w-28 font-mono`}
          />
        </div>
      );

    // --------------------------------------------------------------------
    // FILE
    // --------------------------------------------------------------------
    case 'file':
      return (
        <input
          type="file"
          name={key}
          onChange={(e) => {
            const file = e.target.files?.[0];
            handleChange(file || null);
          }}
          disabled={disabled}
          accept={style?.accept}
          className={`${baseInputClass} file:mr-4 file:py-2 file:px-4 file:rounded file:border-0
            file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100`}
        />
      );

    // --------------------------------------------------------------------
    // RANGE
    // --------------------------------------------------------------------
    case 'range':
      return (
        <div className="flex items-center gap-4">
          <input
            type="range"
            name={key}
            value={value ?? style?.min ?? 0}
            onChange={(e) => handleChange(Number(e.target.value))}
            disabled={disabled}
            min={style?.min ?? validation?.min ?? 0}
            max={style?.max ?? validation?.max ?? 100}
            step={style?.step ?? 1}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          {style?.showValue !== false && (
            <span className="text-sm font-medium text-gray-700 w-12 text-right">
              {value ?? 0}%
            </span>
          )}
        </div>
      );

    // --------------------------------------------------------------------
    // DEFAULT (fallback to text)
    // --------------------------------------------------------------------
    default:
      return (
        <input
          type="text"
          name={key}
          value={value ?? ''}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          className={baseInputClass}
        />
      );
  }
}

// ============================================================================
// Formatting Helpers
// ============================================================================

/**
 * Format a date value for HTML5 date input (YYYY-MM-DD)
 */
function formatDateForInput(value: any): string {
  if (!value) return '';

  try {
    if (typeof value === 'string') {
      // If already in YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
      }
      // ISO string or other format
      const date = new Date(value);
      return date.toISOString().split('T')[0];
    }
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
  } catch {
    // Ignore parse errors
  }

  return '';
}

/**
 * Format a datetime value for HTML5 datetime-local input (YYYY-MM-DDTHH:MM)
 */
function formatDateTimeForInput(value: any): string {
  if (!value) return '';

  try {
    if (typeof value === 'string') {
      // If already in correct format
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
        return value;
      }
      // ISO string or other format
      const date = new Date(value);
      return date.toISOString().slice(0, 16);
    }
    if (value instanceof Date) {
      return value.toISOString().slice(0, 16);
    }
  } catch {
    // Ignore parse errors
  }

  return '';
}
