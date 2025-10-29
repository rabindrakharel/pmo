import React, { useState } from 'react';
import { Plus, Trash2, Check, X } from 'lucide-react';

interface MetadataTableProps {
  value: Record<string, any>;
  onChange?: (newValue: Record<string, any>) => void;
  isEditing?: boolean;
}

/**
 * MetadataTable Component
 *
 * Displays JSONB metadata as an inline editable table.
 * Features:
 * - View mode: Shows key-value pairs in a compact table
 * - Edit mode: Inline editing of keys and values
 * - Add new key-value pairs
 * - Delete existing pairs
 * - Handles nested objects and arrays as JSON strings
 *
 * DRY principle: Reusable across all entities with metadata field
 */
export function MetadataTable({ value, onChange, isEditing = false }: MetadataTableProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);

  const metadata = value || {};
  const entries = Object.entries(metadata);

  const handleUpdateValue = (key: string, newVal: string) => {
    if (!onChange) return;

    // Try to parse as JSON for booleans, numbers, objects
    let parsedValue: any = newVal;
    try {
      // Check if it's a boolean
      if (newVal === 'true') parsedValue = true;
      else if (newVal === 'false') parsedValue = false;
      // Check if it's a number
      else if (!isNaN(Number(newVal)) && newVal.trim() !== '') parsedValue = Number(newVal);
      // Check if it's JSON
      else if (newVal.startsWith('{') || newVal.startsWith('[')) {
        parsedValue = JSON.parse(newVal);
      }
    } catch (e) {
      // Keep as string if parsing fails
    }

    onChange({
      ...metadata,
      [key]: parsedValue
    });
    setEditingKey(null);
  };

  const handleUpdateKey = (oldKey: string, newKeyName: string) => {
    if (!onChange || newKeyName === oldKey) {
      setEditingKey(null);
      return;
    }

    const newMetadata = { ...metadata };
    const value = newMetadata[oldKey];
    delete newMetadata[oldKey];
    newMetadata[newKeyName] = value;

    onChange(newMetadata);
    setEditingKey(null);
  };

  const handleDeleteKey = (key: string) => {
    if (!onChange) return;

    const newMetadata = { ...metadata };
    delete newMetadata[key];
    onChange(newMetadata);
  };

  const handleAddNew = () => {
    if (!onChange || !newKey.trim()) return;

    // Parse value
    let parsedValue: any = newValue;
    try {
      if (newValue === 'true') parsedValue = true;
      else if (newValue === 'false') parsedValue = false;
      else if (!isNaN(Number(newValue)) && newValue.trim() !== '') parsedValue = Number(newValue);
      else if (newValue.startsWith('{') || newValue.startsWith('[')) {
        parsedValue = JSON.parse(newValue);
      }
    } catch (e) {
      // Keep as string
    }

    onChange({
      ...metadata,
      [newKey.trim()]: parsedValue
    });

    setNewKey('');
    setNewValue('');
    setIsAddingNew(false);
  };

  const formatValue = (val: any): string => {
    if (typeof val === 'object' && val !== null) {
      return JSON.stringify(val);
    }
    return String(val);
  };

  if (entries.length === 0 && !isEditing) {
    return <span className="text-gray-400 text-sm">No metadata</span>;
  }

  return (
    <div className="space-y-2">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-1 px-2 text-xs font-medium text-gray-500 w-1/3">Key</th>
            <th className="text-left py-1 px-2 text-xs font-medium text-gray-500">Value</th>
            {isEditing && <th className="w-10"></th>}
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, val]) => (
            <tr key={key} className="border-b border-gray-100 hover:bg-gray-50 group">
              {/* Key column */}
              <td className="py-1.5 px-2">
                {editingKey === `key-${key}` && isEditing ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      defaultValue={key}
                      autoFocus
                      onBlur={(e) => handleUpdateKey(key, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdateKey(key, e.currentTarget.value);
                        if (e.key === 'Escape') setEditingKey(null);
                      }}
                      className="flex-1 px-2 py-0.5 text-xs border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => isEditing && setEditingKey(`key-${key}`)}
                    disabled={!isEditing}
                    className={`text-left w-full font-mono text-xs ${
                      isEditing ? 'text-blue-600 hover:text-blue-800 cursor-pointer' : 'text-gray-700'
                    }`}
                  >
                    {key}
                  </button>
                )}
              </td>

              {/* Value column */}
              <td className="py-1.5 px-2">
                {editingKey === `val-${key}` && isEditing ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      defaultValue={formatValue(val)}
                      autoFocus
                      onBlur={(e) => handleUpdateValue(key, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdateValue(key, e.currentTarget.value);
                        if (e.key === 'Escape') setEditingKey(null);
                      }}
                      className="flex-1 px-2 py-0.5 text-xs border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => isEditing && setEditingKey(`val-${key}`)}
                    disabled={!isEditing}
                    className={`text-left w-full font-mono text-xs ${
                      isEditing ? 'hover:bg-blue-50 rounded px-1 -mx-1 cursor-pointer' : ''
                    }`}
                  >
                    <span className={typeof val === 'boolean' ? 'text-purple-600' :
                                   typeof val === 'number' ? 'text-green-600' :
                                   typeof val === 'object' ? 'text-orange-600' :
                                   'text-gray-700'}>
                      {formatValue(val)}
                    </span>
                  </button>
                )}
              </td>

              {/* Delete button */}
              {isEditing && (
                <td className="py-1.5 px-2">
                  <button
                    onClick={() => handleDeleteKey(key)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all"
                    title="Delete this key"
                  >
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </button>
                </td>
              )}
            </tr>
          ))}

          {/* Add new row */}
          {isEditing && isAddingNew && (
            <tr className="border-b border-gray-100 bg-blue-50">
              <td className="py-1.5 px-2">
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="key"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newKey.trim()) {
                      e.preventDefault();
                      document.getElementById('metadata-new-value')?.focus();
                    }
                    if (e.key === 'Escape') {
                      setIsAddingNew(false);
                      setNewKey('');
                      setNewValue('');
                    }
                  }}
                  className="w-full px-2 py-0.5 text-xs border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </td>
              <td className="py-1.5 px-2">
                <input
                  id="metadata-new-value"
                  type="text"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="value"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddNew();
                    }
                    if (e.key === 'Escape') {
                      setIsAddingNew(false);
                      setNewKey('');
                      setNewValue('');
                    }
                  }}
                  className="w-full px-2 py-0.5 text-xs border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </td>
              <td className="py-1.5 px-2">
                <div className="flex gap-1">
                  <button
                    onClick={handleAddNew}
                    disabled={!newKey.trim()}
                    className="p-1 hover:bg-green-100 rounded disabled:opacity-50"
                    title="Add"
                  >
                    <Check className="h-3 w-3 text-green-600" />
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingNew(false);
                      setNewKey('');
                      setNewValue('');
                    }}
                    className="p-1 hover:bg-red-100 rounded"
                    title="Cancel"
                  >
                    <X className="h-3 w-3 text-red-600" />
                  </button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Add new button */}
      {isEditing && !isAddingNew && (
        <button
          onClick={() => setIsAddingNew(true)}
          className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
        >
          <Plus className="h-3 w-3" />
          Add field
        </button>
      )}

      {/* Type hints */}
      {isEditing && (
        <div className="text-xs text-gray-500 mt-2 space-y-0.5">
          <div>💡 <strong>Tips:</strong></div>
          <div className="ml-4">• Click key or value to edit inline</div>
          <div className="ml-4">• Values: <code className="bg-gray-100 px-1 rounded">true/false</code> = boolean, numbers = number, <code className="bg-gray-100 px-1 rounded">{'{}'}</code> = JSON</div>
          <div className="ml-4">• Press <kbd className="bg-gray-100 px-1 rounded border">Enter</kbd> to save, <kbd className="bg-gray-100 px-1 rounded border">Esc</kbd> to cancel</div>
        </div>
      )}
    </div>
  );
}
