import React, { useState, useRef, useEffect } from 'react';
import { Check, X, Edit2, Calendar, Hash, DollarSign, Percent } from 'lucide-react';

/**
 * Inline Editing Components
 *
 * Allow seamless editing of entity fields directly in the view mode.
 * Provides consistent UX across all entity types.
 *
 * Usage:
 * <InlineText value={name} onSave={(newValue) => updateName(newValue)} />
 * <InlineTextarea value={description} onSave={updateDescription} />
 * <InlineSelect value={status} options={statusOptions} onSave={updateStatus} />
 */

interface BaseInlineEditProps {
  value: any;
  onSave: (value: any) => void | Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
  label?: string;
}

// ========== Inline Text Input ==========
export function InlineText({
  value,
  onSave,
  placeholder = 'Click to edit...',
  disabled = false,
  className = '',
  required = false,
  label,
}: BaseInlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (required && !editValue.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value || '');
    setIsEditing(false);
  };

  if (isEditing && !disabled) {
    return (
      <div className={`inline-edit-text flex items-center gap-2 ${className}`}>
        {label && <label className="text-sm font-medium text-dark-600">{label}</label>}
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
          onBlur={handleSave}
          disabled={isSaving}
          className="px-2 py-1 border border-dark-3000 rounded focus:outline-none focus:ring-2 focus:ring-dark-7000"
          placeholder={placeholder}
        />
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
          title="Save"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          onClick={handleCancel}
          disabled={isSaving}
          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
          title="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={`inline-edit-text group flex items-center gap-2 ${className}`}>
      {label && <label className="text-sm font-medium text-dark-600">{label}</label>}
      <span
        onClick={() => !disabled && setIsEditing(true)}
        className={`${
          disabled ? 'cursor-default' : 'cursor-pointer'
        } px-2 py-1 rounded hover:bg-dark-100 transition-colors ${
          !value ? 'text-dark-600 italic' : ''
        }`}
      >
        {value || placeholder}
      </span>
      {!disabled && (
        <Edit2 className="h-3 w-3 text-dark-600 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  );
}

// ========== Inline Textarea ==========
export function InlineTextarea({
  value,
  onSave,
  placeholder = 'Click to add description...',
  disabled = false,
  className = '',
  label,
}: BaseInlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value || '');
    setIsEditing(false);
  };

  if (isEditing && !disabled) {
    return (
      <div className={`inline-edit-textarea ${className}`}>
        {label && <label className="block text-sm font-medium text-dark-600 mb-1">{label}</label>}
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') handleCancel();
            // Ctrl+Enter or Cmd+Enter to save
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSave();
          }}
          disabled={isSaving}
          rows={4}
          className="w-full px-3 py-2 border border-dark-3000 rounded focus:outline-none focus:ring-2 focus:ring-dark-7000"
          placeholder={placeholder}
        />
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
          >
            Save
          </button>
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="px-3 py-1 bg-dark-200 text-dark-600 rounded hover:bg-dark-300 transition-colors text-sm"
          >
            Cancel
          </button>
          <span className="text-xs text-dark-700">Press Ctrl+Enter to save, Esc to cancel</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`inline-edit-textarea group ${className}`}>
      {label && <label className="block text-sm font-medium text-dark-600 mb-1">{label}</label>}
      <div
        onClick={() => !disabled && setIsEditing(true)}
        className={`${
          disabled ? 'cursor-default' : 'cursor-pointer'
        } px-3 py-2 rounded border border-transparent hover:border-dark-400 hover:bg-dark-100 transition-colors whitespace-pre-wrap ${
          !value ? 'text-dark-600 italic' : ''
        }`}
      >
        {value || placeholder}
        {!disabled && (
          <Edit2 className="h-3 w-3 text-dark-600 inline-block ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
    </div>
  );
}

// ========== Inline Select ==========
interface InlineSelectProps extends BaseInlineEditProps {
  options: Array<{ value: string; label: string }>;
}

export function InlineSelect({
  value,
  onSave,
  options,
  placeholder = 'Select...',
  disabled = false,
  className = '',
  label,
}: InlineSelectProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [isSaving, setIsSaving] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isEditing && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = async (newValue: string) => {
    setIsSaving(true);
    try {
      await onSave(newValue);
      setEditValue(newValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value || '');
    setIsEditing(false);
  };

  const selectedOption = options.find((opt) => opt.value === value);

  if (isEditing && !disabled) {
    return (
      <div className={`inline-edit-select flex items-center gap-2 ${className}`}>
        {label && <label className="text-sm font-medium text-dark-600">{label}</label>}
        <select
          ref={selectRef}
          value={editValue}
          onChange={(e) => handleSave(e.target.value)}
          onBlur={() => setIsEditing(false)}
          disabled={isSaving}
          className="px-2 py-1 border border-dark-3000 rounded focus:outline-none focus:ring-2 focus:ring-dark-7000"
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          onClick={handleCancel}
          disabled={isSaving}
          className="p-1 text-dark-700 hover:bg-dark-100 rounded transition-colors"
          title="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={`inline-edit-select group flex items-center gap-2 ${className}`}>
      {label && <label className="text-sm font-medium text-dark-600">{label}</label>}
      <span
        onClick={() => !disabled && setIsEditing(true)}
        className={`${
          disabled ? 'cursor-default' : 'cursor-pointer'
        } px-2 py-1 rounded hover:bg-dark-100 transition-colors ${
          !selectedOption ? 'text-dark-600 italic' : ''
        }`}
      >
        {selectedOption?.label || placeholder}
      </span>
      {!disabled && (
        <Edit2 className="h-3 w-3 text-dark-600 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  );
}

// ========== Inline Number ==========
interface InlineNumberProps extends BaseInlineEditProps {
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  icon?: React.ReactNode;
}

export function InlineNumber({
  value,
  onSave,
  min,
  max,
  step = 1,
  prefix,
  suffix,
  icon,
  placeholder = '0',
  disabled = false,
  className = '',
  label,
}: InlineNumberProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value?.toString() || '');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    const numValue = parseFloat(editValue);
    if (isNaN(numValue)) return;

    setIsSaving(true);
    try {
      await onSave(numValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value?.toString() || '');
    setIsEditing(false);
  };

  if (isEditing && !disabled) {
    return (
      <div className={`inline-edit-number flex items-center gap-2 ${className}`}>
        {label && <label className="text-sm font-medium text-dark-600">{label}</label>}
        {prefix && <span className="text-dark-700">{prefix}</span>}
        {icon && <span className="text-dark-700">{icon}</span>}
        <input
          ref={inputRef}
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
          onBlur={handleSave}
          disabled={isSaving}
          min={min}
          max={max}
          step={step}
          className="w-24 px-2 py-1 border border-dark-3000 rounded focus:outline-none focus:ring-2 focus:ring-dark-7000"
          placeholder={placeholder}
        />
        {suffix && <span className="text-dark-700">{suffix}</span>}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
          title="Save"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          onClick={handleCancel}
          disabled={isSaving}
          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
          title="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const displayValue = value != null ? value : placeholder;

  return (
    <div className={`inline-edit-number group flex items-center gap-2 ${className}`}>
      {label && <label className="text-sm font-medium text-dark-600">{label}</label>}
      {prefix && <span className="text-dark-700">{prefix}</span>}
      {icon && <span className="text-dark-700">{icon}</span>}
      <span
        onClick={() => !disabled && setIsEditing(true)}
        className={`${
          disabled ? 'cursor-default' : 'cursor-pointer'
        } px-2 py-1 rounded hover:bg-dark-100 transition-colors ${
          value == null ? 'text-dark-600 italic' : ''
        }`}
      >
        {displayValue}
      </span>
      {suffix && <span className="text-dark-700">{suffix}</span>}
      {!disabled && (
        <Edit2 className="h-3 w-3 text-dark-600 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  );
}

// ========== Inline Date ==========
export function InlineDate({
  value,
  onSave,
  placeholder = 'Select date...',
  disabled = false,
  className = '',
  label,
}: BaseInlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(() => {
    // Format initial value to yyyy-MM-dd for date input
    if (!value) return '';
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) return '';
      return date.toISOString().split('T')[0];
    } catch {
      return value;
    }
  });
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Format value to yyyy-MM-dd when canceling
    if (value) {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          setEditValue(date.toISOString().split('T')[0]);
        } else {
          setEditValue(value);
        }
      } catch {
        setEditValue(value);
      }
    } else {
      setEditValue('');
    }
    setIsEditing(false);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isEditing && !disabled) {
    return (
      <div className={`inline-edit-date flex items-center gap-2 ${className}`}>
        {label && <label className="text-sm font-medium text-dark-600">{label}</label>}
        <Calendar className="h-4 w-4 text-dark-700" />
        <input
          ref={inputRef}
          type="date"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          disabled={isSaving}
          className="px-2 py-1 border border-dark-3000 rounded focus:outline-none focus:ring-2 focus:ring-dark-7000"
        />
        <button
          onClick={handleCancel}
          disabled={isSaving}
          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
          title="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={`inline-edit-date group flex items-center gap-2 ${className}`}>
      {label && <label className="text-sm font-medium text-dark-600">{label}</label>}
      <Calendar className="h-4 w-4 text-dark-700" />
      <span
        onClick={() => !disabled && setIsEditing(true)}
        className={`${
          disabled ? 'cursor-default' : 'cursor-pointer'
        } px-2 py-1 rounded hover:bg-dark-100 transition-colors ${
          !value ? 'text-dark-600 italic' : ''
        }`}
      >
        {value ? formatDate(value) : placeholder}
      </span>
      {!disabled && (
        <Edit2 className="h-3 w-3 text-dark-600 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  );
}
