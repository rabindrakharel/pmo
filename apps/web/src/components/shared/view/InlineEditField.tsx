import React from 'react';
import { Edit3, Check, X } from 'lucide-react';

interface InlineEditFieldProps {
  fieldName: string;
  label: string;
  displayValue: string;
  canEdit: boolean;
  isEditing: boolean;
  editValue: string;
  saving: boolean;
  onEdit: (fieldName: string, currentValue: string) => void;
  onSave: (fieldName: string) => void;
  onCancel: () => void;
  onValueChange: (value: string) => void;
  options?: {
    type?: 'text' | 'select' | 'date' | 'number' | 'textarea';
    options?: string[];
    rawValue?: any;
    renderValue?: (value: string) => React.ReactNode;
    rows?: number;
  };
}

export function InlineEditField({
  fieldName,
  label,
  displayValue,
  canEdit,
  isEditing,
  editValue,
  saving,
  onEdit,
  onSave,
  onCancel,
  onValueChange,
  options = {}
}: InlineEditFieldProps) {
  const { type = 'text', options: selectOptions, rawValue, renderValue, rows = 4 } = options;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') {
      onSave(fieldName);
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (type === 'textarea') {
    return (
      <div className="group">
        <dt className="text-sm font-normal text-dark-700 mb-1">{label}</dt>
        <dd>
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editValue}
                onChange={(e) => onValueChange(e.target.value)}
                className="w-full px-3 py-2 border border-dark-500 rounded-md focus:outline-none focus:ring-2 focus:ring-dark-7000"
                rows={rows}
                placeholder={`Enter ${label.toLowerCase()}...`}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onSave(fieldName)}
                  disabled={saving}
                  className="px-3 py-1 bg-slate-600 text-white text-sm rounded hover:bg-slate-700 shadow-sm disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={onCancel}
                  className="px-3 py-1 bg-dark-300 text-dark-600 text-sm rounded hover:bg-dark-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="group">
              <div className="flex items-start justify-between">
                <div className="text-sm text-dark-600 flex-1 whitespace-pre-wrap">
                  {renderValue ? renderValue(displayValue) : displayValue || 'No description provided'}
                </div>
                {canEdit && (
                  <button
                    onClick={() => onEdit(fieldName, rawValue !== undefined ? String(rawValue) : displayValue)}
                    className="ml-2 p-1 text-dark-600 hover:text-dark-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    title={`Edit ${label.toLowerCase()}`}
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </dd>
      </div>
    );
  }

  return (
    <div className="group">
      <dt className="text-sm font-normal text-dark-700 mb-1">{label}</dt>
      <dd className="flex items-center justify-between">
        {isEditing ? (
          <div className="flex items-center space-x-2 flex-1">
            {type === 'select' ? (
              <select
                value={editValue}
                onChange={(e) => onValueChange(e.target.value)}
                className="flex-1 px-2 py-1 border border-dark-500 rounded focus:outline-none focus:ring-2 focus:ring-dark-7000"
                autoFocus
              >
                {selectOptions?.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            ) : type === 'date' ? (
              <input
                type="date"
                value={(() => {
                  if (!editValue) return '';
                  // Format to yyyy-MM-dd if it's a full ISO timestamp
                  try {
                    const date = new Date(editValue);
                    if (isNaN(date.getTime())) return '';
                    return date.toISOString().split('T')[0];
                  } catch {
                    return editValue;
                  }
                })()}
                onChange={(e) => onValueChange(e.target.value)}
                className="flex-1 px-2 py-1 border border-dark-500 rounded focus:outline-none focus:ring-2 focus:ring-dark-7000"
                onKeyDown={handleKeyDown}
                autoFocus
              />
            ) : type === 'number' ? (
              <input
                type="number"
                value={editValue}
                onChange={(e) => onValueChange(e.target.value)}
                className="flex-1 px-2 py-1 border border-dark-500 rounded focus:outline-none focus:ring-2 focus:ring-dark-7000"
                onKeyDown={handleKeyDown}
                autoFocus
              />
            ) : (
              <input
                type="text"
                value={editValue}
                onChange={(e) => onValueChange(e.target.value)}
                className="flex-1 px-2 py-1 border border-dark-500 rounded focus:outline-none focus:ring-2 focus:ring-dark-7000"
                onKeyDown={handleKeyDown}
                autoFocus
              />
            )}
            <button
              onClick={() => onSave(fieldName)}
              disabled={saving}
              className="p-1 text-green-600 hover:text-green-700"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={onCancel}
              className="p-1 text-red-600 hover:text-red-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="text-sm text-dark-600 flex-1">
              {renderValue ? renderValue(displayValue) : displayValue}
            </div>
            {canEdit && (
              <button
                onClick={() => onEdit(fieldName, rawValue !== undefined ? String(rawValue) : displayValue)}
                className="ml-2 p-1 text-dark-600 hover:text-dark-700 opacity-0 group-hover:opacity-100 transition-opacity"
                title={`Edit ${label.toLowerCase()}`}
              >
                <Edit3 className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </dd>
    </div>
  );
}